# Custom fonts (`fontSrc`)

Read this when a scene needs a typeface other than the three built-in ones (`sans-serif`, `serif`, `monospace`), on screen-space UI or on in-world `TextShape`.

## Where it goes

`fontSrc?: string` sits next to the existing `font` on four components:

| Surface | Prop / field | Protocol field |
|---|---|---|
| `Label`, `Button` (react-ecs) | `fontSrc` prop → `UiText.fontSrc` | `PBUiText.font_src` = 9 |
| `Input` (react-ecs) | `fontSrc` prop → `UiInput.fontSrc` | `PBUiInput.font_src` = 16 |
| `Dropdown` (react-ecs) | `fontSrc` prop → `UiDropdown.fontSrc` | `PBUiDropdown.font_src` = 13 |
| `TextShape` (component) | `fontSrc` field | `PBTextShape.font_src` = 22 |

```tsx
<Label value="Welcome" fontSize={32} font="serif" fontSrc="assets/fonts/Lobster-Regular.ttf"
  uiTransform={{ width: 400, height: 50 }} />
<Input placeholder="Name" font="sans-serif" fontSrc="assets/fonts/Lobster-Regular.ttf" uiTransform={{ width: 250, height: 40 }} />
<Dropdown options={['A', 'B']} fontSrc="assets/fonts/Lobster-Regular.ttf" uiTransform={{ width: 200, height: 40 }} />
```

```ts
TextShape.create(sign, {
  text: 'Grand Opening',
  font: Font.F_SANS_SERIF,                     // fallback
  fontSrc: 'assets/fonts/Lobster-Regular.ttf'
})
```

## Value rules

- A path to a `.ttf` **file in the scene's content**, relative to the scene root, like a `GltfContainer` `src`. Convention: `assets/fonts/<File>.ttf`.
- Empty or whitespace-only string == unset.
- **Always also set `font`.** It is the fallback whenever the custom font cannot load (default `sans-serif`).
- **Scene files only.** The proto comment also mentions "a Google Fonts family name", but no client supports that: the Unity explorer rejects family names (`"Roboto"`, `"Playfair Display"`) as not-a-content-file, and its tests assert this. Never emit a family name.
- **No external URLs.** Absolute URLs and protocol-relative `//…` values are rejected (warning `cannot be an external URL`). Download the `.ttf` into the scene instead, and check its licence (OFL fonts ship an `OFL.txt`; keep it beside the font).

## Format limits

- **TrueType only**: `.ttf` with sfnt version `0x00010000`. Refused, built-in font stays: OpenType/CFF `.otf`, Apple `true` fonts, collections `.ttc`, web fonts `.woff` / `.woff2`. Convert an `.otf` to TrueType outlines before adding it.
- Max file size **16 MB**.
- Fonts with extremely complex glyph outlines can be refused (converter caps: 8192 outline points per glyph, plus a render-work budget). Ornate display fonts are the usual suspects.

## Fallback matrix

| `fontSrc` value | Result |
|---|---|
| unset / `''` / whitespace | built-in `font` |
| valid scene `.ttf`, converted | custom font |
| valid `.ttf`, but no converted asset bundle (plain preview, conversion pending) | built-in `font` |
| `.otf` / `.ttc` / `.woff` / `.woff2` | built-in `font` |
| file missing from the scene | built-in `font` |
| corrupt / invalid `.ttf` | built-in `font` + font warning |
| `https://…` or `//…` | built-in `font` + `cannot be an external URL` warning |
| Google Fonts family name | built-in `font` |

Text never disappears, and an `Input` / `Dropdown` keeps working, on any failure. Every rejection logs a console message in category **`SDK_FONTS`** that says why: read it first when a font does not show.

## Fonts come from asset bundles

The explorer loads custom fonts **only from the converted asset bundles** that the asset bundle converter produces for the scene deployment. The `.ttf` itself is never read at runtime.

- **Published scene:** the font appears once conversion for that deployment has finished. Until then the fallback renders.
- **Local preview:** the fallback renders (log: `… the built-in font stays`) unless the preview converts assets locally: Creator Hub **Play Options > Desktop Client > Compress Assets**, or `npm run start -- --asset-bundles`. See **optimize-scene** > *Local Asset Bundle Preview*. A plain preview showing the built-in font is expected, not a bug.

## Glyphs, atlas, cost

- The converter bakes a **1024x1024 SDF atlas** pre-filled with ASCII, common smart punctuation, the euro sign `€` and the Latin-1 letters.
- Other glyphs the font contains (Cyrillic, Greek, CJK…) are rasterized at runtime on first use, which can cause a brief hitch the first time they appear. Pre-show such text early (e.g. behind a loading screen) if the hitch matters.
- Glyphs the font **lacks** fall back per character to the built-in sans-serif, so mixed-script text can render in two faces. Pick a font that covers the scene's languages.
- One font asset is **shared** by every entity with the same `fontSrc` in the scene and released when the last one stops using it. Each distinct font adds its own atlas texture: use 1 or 2 custom fonts per scene, not one per label.
- Changing `fontSrc` on an existing entity swaps the face and keeps the rest of the entity's state: an `Input`'s typed text and a `Dropdown`'s selection survive.

## Platform support

- **Desktop (Unity explorer):** supported on `TextShape`, `UiText`, `UiInput`, `UiDropdown` (explorer v0.185.0-alpha+).
- **Mobile app:** **not supported, no ETA.** The mobile client has no `fontSrc` handling and renders the fallback `font`. Choose a `font` fallback that still fits the design.
- **Bevy / web explorer:** [UNVERIFIED: support not confirmed either way]

## Editable UI (Creator Hub UI editor)

The UI editor does not model `fontSrc`: it is absent from the parser's prop sets for `Label` / `Button` / `Input` / `Dropdown` (creator-hub `main` at `2c2c19c1`), so the property panel neither shows nor edits it. Whether a hand-written `fontSrc` attribute on an element in `src/ui/` survives an editor save is [UNVERIFIED]. Use it freely in coded UI and on `TextShape`. In an editable file, check the attribute is still there after the next editor save before relying on it.

## QA scene

`sdk7-test-scenes/scenes/84,-6-font-src` (https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/84,-6-font-src): fonts under `assets/fonts/`, toggles one `fontSrc` across `TextShape` + `UiText` + `UiInput` + `UiDropdown` through TTF, OTF (rejected), built-in, missing, invalid, empty and external-URL cases, and checks state survives a font switch.

Sources: protocol PR #489 (`d7ddc105`); unity-explorer PR #10317 (`3a96b529`) and `FontSrcResolver.cs` / `LoadFontSystem.cs` on `main`; asset bundle converter `crate/src/fontgen/mod.rs`; js-sdk-toolchain `1fb1939a` (react-ecs `Label.fontSrc`; `Button` extends Label props; `Input` / `Dropdown` pass the generated field); godot-explorer `main` (no `font_src`).
