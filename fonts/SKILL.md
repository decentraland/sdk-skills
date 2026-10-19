---
name: fonts
description: Fonts for text in Decentraland SDK7 scenes — the three built-in faces and custom TTF fonts shipped with the scene (`fontSrc`) on TextShape, UiText, Label, Button, Input and Dropdown. Use when the user wants a custom, branded or themed typeface, wants to change the font of 3D or UI text, wants to ship a .ttf with a scene, or asks why a custom font is not showing. Do NOT use for text layout, sizing or UI structure (see build-ui) or placing 3D text in the world (see advanced-rendering).
---

# Fonts in Decentraland

Every text component has two font fields:

| Field | What it takes | Components |
|---|---|---|
| `font` | A built-in face. On `TextShape` / `UiText`: `Font.F_SANS_SERIF` (default), `Font.F_SERIF`, `Font.F_MONOSPACE`. On React-ECS props: `'sans-serif'` (default), `'serif'`, `'monospace'` | All |
| `fontSrc` | Path to a `.ttf` file in the scene's content, relative to the scene root | `TextShape`, `UiText`, `UiInput`, `UiDropdown`, and the React-ECS `Label`, `Button`, `Input`, `Dropdown` and `UiEntity uiText` |

Those three built-in faces are the only ones. There is no font name list beyond them.

## RULE: Check the SDK version before writing `fontSrc`

`fontSrc` needs the **first `@dcl/sdk` release after 7.30.1** (decentraland/js-sdk-toolchain#1656). On 7.30.1 and earlier the field does not exist: it is a TypeScript error, and even forced past the types the SDK never sends it to the explorer.

Read the installed version from `node_modules/@dcl/sdk/package.json` (or `package.json`) before writing it. If the scene is older, either upgrade `@dcl/sdk` or stay with a built-in `font`. Never patch the SDK's generated serializers in `node_modules`. The QA scene did that as a temporary bridge, and it breaks on the next install.

## RULE: Always set `font` next to `fontSrc`

`font` is the fallback whenever the custom font cannot be used, and on the Unity explorer that includes local preview (see Testing). Pick the closest built-in face, so the fallback still looks intended: `'serif'` for a serif or display face, `'monospace'` for a code or terminal face, `'sans-serif'` otherwise.

## RULE: Only `.ttf` files inside the scene

The Unity explorer supports exactly one kind of `fontSrc`: a `.ttf` file that is part of the scene's deployed content. Everything else silently falls back to `font` there:

| `fontSrc` value | Unity explorer | Bevy explorer |
|---|---|---|
| `.ttf` in the scene content | Yes, from the asset bundle the converter builds after deploy | Yes |
| `.otf` file | Falls back | Not documented — do not rely on it |
| URL to a `.ttf` | Falls back | Yes |
| Google Fonts family name (`'Playfair Display'`) | Falls back | Yes, through Fontsource |
| Missing file, invalid file, empty string | Falls back | Falls back |

The protocol's doc comment, which shows up in editor tooltips, says a Google Fonts family name works. That is Bevy only: Unity dropped external fonts on purpose (security, code size, runtime glyph rasterising). Do not write a family name or a URL, even if the user asks for "Google Font X". Download the font's `.ttf` (Google Fonts are OFL-licensed) and ship it in the scene instead.

## Adding a font to a scene

1. Put the file under `assets/fonts/`, for example `assets/fonts/BungeeShade-Regular.ttf`. Use a static `.ttf`. If a family ships only as a variable font, use its static instances.
2. Put the font's licence next to it (`assets/fonts/BungeeShade-OFL.txt`). Deploying publishes the file on public content servers, so the licence must allow redistribution and embedding. OFL and Apache fonts allow it. Most commercial desktop licences do not.
3. Reference it by its path from the scene root, the same way as a texture `src`: `fontSrc: 'assets/fonts/BungeeShade-Regular.ttf'`.

One file is one face. For a bold title and regular body text, ship both weights and point each text at its own file. Keep a scene to one or two font files: each is another asset to download and convert.

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

// Switching font at runtime is a plain field write
TextShape.getMutable(sign).fontSrc = 'assets/fonts/BungeeShade-Regular.ttf'
```

## UI text (React-ECS)

```tsx
<Label
  value="Score: 100"
  fontSize={24}
  font="sans-serif"
  fontSrc="assets/fonts/BungeeShade-Regular.ttf"
  uiTransform={{ width: 240, height: 40 }}
/>

<Button value="Play" variant="primary" font="sans-serif" fontSrc="assets/fonts/BungeeShade-Regular.ttf" />

<Input placeholder="Your name" font="serif" fontSrc="assets/fonts/PTSerif-Regular.ttf" />

<Dropdown options={['Easy', 'Hard']} font="serif" fontSrc="assets/fonts/PTSerif-Regular.ttf" />

<UiEntity uiText={{ value: 'Coded-only text bag', font: 'monospace', fontSrc: 'assets/fonts/AzeretMono-Medium.ttf' }} />
```

Editable UI (**build-ui**): a literal `fontSrc` string fits the editable contract, but whether the Creator Hub UI Designer displays and preserves it has not been verified. Open the component in the editor after writing it and check that the prop survives a save.

## Testing a custom font

- **Unity explorer: the custom font never shows in local preview.** Unity loads scene fonts only from the asset bundles the converter builds for a deployment, and has no raw-`.ttf` fallback, so preview always shows the `font` fallback. That is expected, not a bug. To see the font, deploy (a World is the quickest, see **deploy-worlds**) and wait for asset-bundle conversion. Until conversion finishes, the fallback still shows.
- **Bevy explorer** loads the `.ttf` directly, so preview there shows the font.
- Tell the user which of these applies before they report "my font isn't working".
- The reference scene for expected behaviour is `scenes/84,-6-font-src` in decentraland/sdk7-test-scenes (realm `sdk7testscenes.dcl.eth` on zone). It covers each fallback case, fonts shared between components, recreating components and the scene boundary.

## Glyphs and legibility

- A custom font only draws the characters it contains. For accented letters, Cyrillic, CJK and so on, pick a font that includes those scripts. Missing characters are not guaranteed to fall back to a built-in face.
- No emoji in any text value, whatever the font. The Unity explorer has no emoji glyphs (see **build-ui**).
- Keep decorative and display faces for short titles and signs. Body text and anything read while moving needs a plain face at the sizes in **build-ui** (UI) and **advanced-rendering** (3D).
- A monospace face, built-in or custom, does not make spaces line up columns in a `TextShape`. Use one `TextShape` per column (see **advanced-rendering**).

## Cross-references

- **build-ui**: Label, Button, Input and Dropdown props, sizing and the no-emoji rule.
- **advanced-rendering**: `TextShape` placement, orientation, outline and alignment.
- **migrate-sdk6-to-sdk7**: SDK6 `font` names map to the built-in `Font` enum, and custom SDK6 fonts map to `fontSrc`.
- **deploy-worlds** / **deploy-scene**: deploying so Unity converts the font.
