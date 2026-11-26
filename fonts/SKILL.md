---
name: fonts
description: "Fonts for Decentraland SDK7 text: the three built-in faces and custom fonts (fontSrc), either a .ttf shipped with the scene or a Google Fonts family name, for 3D and UI text. Use when the user wants a custom or branded typeface, wants to change a text's font, ships a .ttf, names a Google font, or asks why a custom font isn't showing. For text layout see build-ui; for placing 3D text see advanced-rendering."
---

# Fonts in Decentraland

Every text component has two font fields:

| Field | What it takes | Components |
|---|---|---|
| `font` | A built-in face. On `TextShape` / `UiText`: `Font.F_SANS_SERIF` (default), `Font.F_SERIF`, `Font.F_MONOSPACE`. On React-ECS props: `'sans-serif'` (default), `'serif'`, `'monospace'` | All |
| `fontSrc` | A `.ttf` file in the scene's content (path from the scene root), or a [Google Fonts](https://fonts.google.com/) family name such as `'Playfair Display'` | `TextShape`, `UiText`, `UiInput`, `UiDropdown`, and the React-ECS `Label`, `Button`, `Input`, `Dropdown` and `UiEntity uiText` |

The three built-in faces are the only values of `font`.

## RULE: Check the SDK version before writing `fontSrc`

`fontSrc` needs **`@dcl/sdk` 7.31.0** or later. On earlier versions the field does not exist: it is a TypeScript error, and even forced past the types the SDK never sends it to the explorer.

Read the installed version from `node_modules/@dcl/sdk/package.json` before writing it; on a Multiplayer Server scene (`@dcl/sdk@auth-server`) go by the typings, not the version string — the rule is **sdk-scenes** → *A feature that needs a newer SDK*. If the scene is older, upgrade `@dcl/sdk` as that rule says, or stay with a built-in `font`.

## RULE: Always set `font` next to `fontSrc`

`font` renders whenever the custom font cannot: while it loads, on the desktop client for every family name and for a `.ttf` until its asset bundle exists, on mobile apps below 1.16.2, past the mobile app's 16-font cap, and for a rejected file. Pick the closest built-in face, so the fallback still looks intended: `'serif'` for a serif or display face, `'monospace'` for a code or terminal face, `'sans-serif'` otherwise.

Size every fixed box so the fallback fits, never from the custom font's width. Single-line text also needs `textWrap="nowrap"` and spare width: **build-ui** → *Sizing and mobile*. Never put meaning only in the custom font's look (an icon font, a symbol font, a "handwritten" clue): wherever the fallback renders it becomes plain text.

## Which clients show the custom font

| `fontSrc` value | Desktop client (Unity) | Mobile app 1.16.2+ | Bevy web client |
|---|---|---|---|
| `.ttf` in the scene content | Yes, once its asset bundle exists (deployed and converted, or the desktop preview, which converts locally) | Yes | Yes, loaded directly |
| Google Fonts family name | **No**: the fallback `font` | Yes | Yes |
| URL, OpenType with CFF outlines (usually `.otf`), collection (`.ttc`), web font (`.woff`, `.woff2`), missing file, empty string | Fallback | Fallback | Fallback |
| `.ttf` over 16 MB, or with extremely complex glyph outlines | Fallback | Fallback (16 MB cap) | Not documented |

- Mobile apps below 1.16.2 ignore `fontSrc` entirely and render `font`.
- The file check reads the contents, not the extension: an `.otf` renamed to `.ttf` is still rejected.
- All three clients apply `fontSrc` to `TextShape` and to the UI `Label`, `Button`, `Input` and `Dropdown`.

## RULE: Ship a `.ttf` when the look matters on desktop

A family name needs no file and no licence step, but the desktop client always shows the fallback for it. When the user names a font ("use Playfair Display") and the look matters on desktop, ship its `.ttf`: ask for it, or offer to download it, confirming first like any asset download (**sdk-scenes** → Agent Behavioral Guidelines, item 2). A `.ttf` renders on all three clients. Use a family name only when the desktop fallback is acceptable (a mobile-first scene, a decorative touch), and tell the user desktop players see the built-in face.

Family-name rules:

- Write the name as Google Fonts lists it (`'Open Sans'`, `'Playfair Display'`); case does not matter.
- Only unaccented letters, digits and spaces. A name with `+`, `.`, an apostrophe or an accented letter is not found and the fallback shows.
- The font comes from Fontsource, which hosts the Google Fonts catalog. Regular text uses weight 400 (or the closest the family has), bold uses 700 (or the closest).
- Only the Latin subset is downloaded (or, for a family with no Latin, the first subset Fontsource lists). Other characters are drawn with the built-in `font`.

## Mobile app (1.16.2+)

- **At most 16 custom fonts per scene.** A font used both in the UI and on a `TextShape` counts twice. Beyond that, text uses the fallback `font`.
- **Bold and italic in the UI**: with a font file the app always simulates them; with a family name it uses the family's real bold and italic faces when it has them.
- **Bold on a `TextShape`**: not simulated. With a family name it uses the family's bold face; with a font file, the regular face.
- **Characters that first appear in a `TextShape`** are rendered in the background, so new text can take a moment to show.
- Fallback faces observed on the app (2026-11): Noto Sans, Noto Serif, Noto Sans Mono, and their bold variants.

**Image text** (a per-glyph bitmap font: one `UiEntity` per character drawing a `uvs` crop of an atlas, **build-ui** → `references/ui-components.md` → *Texture UVs*) is the route only when a display face must look identical everywhere at once, including mobile apps below 1.16.2. Costs: mobile apps below 1.16.0 ignore `uiBackground.color` tint and alpha on `uvs` crops (`{baseDir}/../sdk-scenes/references/mobile-parity.md`), so pre-colour each variant and bake shadows and outlines into the glyph art; and every glyph is a node, so stacked copies multiply it (an outline faked with 17 stacked `Label`s dropped a screen to ~6 FPS). Keep it to titles and short labels.

## Adding a font file to a scene

1. Put the `.ttf` under `assets/fonts/`, for example `assets/fonts/BungeeShade-Regular.ttf`. Use a static `.ttf`. If a family ships only as a variable font, use its static instances.
2. Put the font's licence next to it (`assets/fonts/BungeeShade-OFL.txt`). Deploying publishes the file on public content servers, so the licence must allow redistribution and embedding. OFL and Apache fonts allow it (most Google Fonts are OFL). Most commercial desktop licences do not.
3. Reference it by its path from the scene root, the same way as a texture `src`: `fontSrc: 'assets/fonts/BungeeShade-Regular.ttf'`.

One file is one face. For a bold title and regular body text, ship both weights and point each text at its own file.

Cost: every text entity using the same `fontSrc` shares one loaded copy, so reusing a font across the scene costs no more than using it once. On desktop each distinct font file becomes its own asset bundle of about 700 KB (two texture atlases), plus its own textures in memory. Keep a scene to one or two fonts.

## 3D text (`TextShape`)

```typescript
import { engine, Transform, TextShape, Font } from '@dcl/sdk/ecs'
import { Vector3, Color4, Color3 } from '@dcl/sdk/math'

const sign = engine.addEntity()
Transform.create(sign, { position: Vector3.create(8, 3, 8) })

TextShape.create(sign, {
  text: 'OPEN',
  fontSize: 6,
  textColor: Color4.White(),
  outlineColor: Color3.Black(),
  outlineWidth: 0.1,
  font: Font.F_SERIF,
  fontSrc: 'assets/fonts/AbrilFatface-Regular.ttf'
})

// Switching font at runtime is a plain field write; a family name works the same way
TextShape.getMutable(sign).fontSrc = 'Playfair Display'
```

## UI text (React-ECS)

```tsx
<Label
  value="Score: 100"
  fontSize={24}
  textWrap="nowrap"
  font="sans-serif"
  fontSrc="assets/fonts/BungeeShade-Regular.ttf"
  uiTransform={{ width: 240, height: 40 }}
/>

<Label value="Welcome!" fontSize={40} font="serif" fontSrc="Playfair Display" uiTransform={{ width: 300, height: 60 }} />

<Button value="Play" variant="primary" textWrap="nowrap" font="sans-serif" fontSrc="assets/fonts/BungeeShade-Regular.ttf" />

<Input placeholder="Your name" font="serif" fontSrc="assets/fonts/PTSerif-Regular.ttf" />

<Dropdown options={['Easy', 'Hard']} font="serif" fontSrc="assets/fonts/PTSerif-Regular.ttf" />

<UiEntity uiText={{ value: 'Coded-only text bag', font: 'monospace', fontSrc: 'assets/fonts/AzeretMono-Medium.ttf' }} />
```

Editable UI (**build-ui**): write `fontSrc` on the element by hand. The Creator Hub UI Designer neither shows nor edits it, but its saves splice only the props they change, so a hand-written `fontSrc` survives (Prettier may re-indent the line). Its canvas renders the `font` fallback. A custom font alone is not a reason to switch a UI to coded mode.

## Testing a custom font

The desktop client loads scene fonts only from asset bundles, never from the raw file, and never loads family names:

- **Local preview** (`npm run start` or Creator Hub Play, no flag needed): the Desktop Explorer converts the scene's assets itself before the scene loads, `.ttf` fonts included, so the font shows unless **Load Raw GLTFs** is on. If it still shows its fallback, the converter did not run or could not serve this scene; the **AB** panel of the Explorer's debug menu says why (**optimize-scene** → *Local Asset Bundle Preview*). The converter is a separate `abgen` process on `127.0.0.1:5147` that can outlive a force-quit Explorer. The next launch adopts it when it is the same Explorer build serving the same scene and already ready; any other leftover blocks the port, the session degrades to raw GLTFs and the built-in font, and the **AB** panel names the pid — stop that `abgen` (`pgrep -fl abgen`) and relaunch once (observed 2026-11).
- **Deployed scene:** the font appears once the server's asset-bundle conversion finishes. Until then the fallback shows. Scenes deployed before font conversion existed get font bundles only when they are deployed again.
- **Bevy web client** loads the `.ttf` (or the family) directly, so its preview shows the font without conversion.
- **Mobile app:** 1.16.2+ shows `.ttf` files and family names (the limits above); older apps show the fallback.
- **Why it fell back (desktop):** the client logs an `SDK_FONTS` line naming the value and the reason: a warning for a URL (`font_src "…" cannot be an external URL`), a plain log line for anything that isn't a file of the scene, family names included (`font_src "…" is not a content file of the scene …`), or a scene with no converted font yet. These lines are hidden by default: type `/log-matrix enable SDK_FONTS Warning` and `/log-matrix enable SDK_FONTS Log` in the chat, `/reload`, then `/logs` to open the log folder. If the font was not converted, check that it is a TrueType `.ttf` under 16 MB, then publish again.
- **Fallback fit check:** before shipping text-heavy UI, look at it once on the fallback by removing `fontSrc` temporarily so the `font` face renders (restore it afterwards). Overlaps there are what desktop players see until the font's bundle is ready, and always for a family name. A fallback much wider than the custom face ran text over the key icons beside it and made two phrases overlap although nothing wrapped (in-world, 2026-11).
- Tell the user which of these applies before they report "my font isn't working".
- The reference scene for expected behaviour is `scenes/84,-6-font-src` in decentraland/sdk7-test-scenes (realm `sdk7testscenes.dcl.eth` on zone). It covers each fallback case, fonts shared between components, recreating components and the scene boundary.

## Glyphs and legibility

- A custom font only draws the characters it contains. Characters it lacks are drawn with the built-in sans-serif, mid-word, which looks broken. For accented letters, Cyrillic, CJK and so on, pick a font that includes those scripts (and, with a family name, remember only Latin is downloaded).
- On desktop the font's bundle comes with Latin (ASCII and Latin-1) already rendered. Any other character the font includes (Cyrillic, Greek, CJK…) is rendered the first time it appears, which causes a brief hitch. For text in those scripts, show it early (a loading or intro screen) rather than at a critical moment.
- No emoji in any text value, whatever the font. The Unity explorer has no emoji glyphs (see **build-ui**).
- Keep decorative and display faces for short titles and signs. Body text and anything read while moving needs a plain face at the sizes in **build-ui** (UI) and **advanced-rendering** (3D).
- A monospace face, built-in or custom, does not make spaces line up columns in a `TextShape`. Use one `TextShape` per column (see **advanced-rendering**).

## Cross-references

- **build-ui**: Label, Button, Input and Dropdown props, sizing and the no-emoji rule.
- **advanced-rendering**: `TextShape` placement, orientation, outline and alignment.
- **migrate-sdk6-to-sdk7**: SDK6 `font` names map to the built-in `Font` enum, and custom SDK6 fonts map to `fontSrc`.
- **deploy-worlds** / **deploy-scene**: deploying so the server converts the font.
- **optimize-scene**: asset-bundle conversion and why it matters for load time.
