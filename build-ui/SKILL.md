---
name: build-ui
description: Build 2D screen-space UI for Decentraland scenes using React-ECS (JSX). Create HUDs, menus, health bars, dialogs, buttons, inputs, and dropdowns. Use when the user wants on-screen UI, menus, or form inputs. Do NOT use for 3D in-world text (see advanced-rendering) or clickable 3D objects (see add-interactivity).
---

# Building UI with React-ECS

Decentraland SDK7 uses a React-like JSX system for 2D UI overlays.

## When to Use Which UI Approach

| Need                             | Approach               | Component                                          |
| -------------------------------- | ---------------------- | -------------------------------------------------- |
| Screen-space HUD, menus, buttons | React-ECS (this skill) | `UiEntity`, `Label`, `Button`, `Input`, `Dropdown` |
| 3D text floating in the world    | TextShape + Billboard  | See **advanced-rendering** skill                   |
| Open a web page                  | `openExternalUrl`      | See **scene-runtime** skill                        |
| Clickable objects in 3D space    | Pointer events         | See **add-interactivity** skill                    |

Use React-ECS for any 2D overlay: scoreboards, health bars, dialogs, inventories, settings menus. Use TextShape for labels above NPCs or objects in the 3D world.

## Setup

Create `src/ui.tsx` with your UI component and call `ReactEcsRenderer.setUiRenderer(MyUI, { virtualWidth: 1920, virtualHeight: 1080 })` from `setupUi()`. Call `setupUi()` from `main()` in `src/index.ts`. The SDK template already includes the required JSX settings in tsconfig.json — do NOT modify it.

## DEFAULT RULE: Always Set Virtual Screen Size to 1920x1080

**Whenever you generate UI code, you MUST pass `{ virtualWidth: 1920, virtualHeight: 1080 }` to `setUiRenderer` and `addUiRenderer` by default — without waiting for the user to ask.** Only deviate if the user explicitly requests a different reference resolution.

Why: Without a virtual size, UI is laid out in raw screen pixels and renders inconsistently across different resolutions and aspect ratios — fonts, spacing, and absolute-positioned elements drift between displays. Setting a virtual screen size makes the engine scale the UI proportionally to a fixed reference frame, so layouts look the same on every screen. 1920x1080 is the safe default — it matches the most common displays and the assumption made by most community examples.

The options argument is optional at the API level — `setUiRenderer(ui)` is valid, and several engine test scenes omit it. Passing it is still the default rule here; only omit it if the user explicitly wants raw-pixel layout.

API (verified against `@dcl/react-ecs` 7.22.5, file `dist/system.d.ts`):

```ts
type UiRendererOptions = { virtualWidth: number; virtualHeight: number }
setUiRenderer(ui: UiComponent, options?: UiRendererOptions): void
addUiRenderer(entity: Entity, ui: UiComponent, options?: UiRendererOptions): void
```

Canonical snippet (use this verbatim unless the user specifies otherwise):

```tsx
import { ReactEcsRenderer } from '@dcl/sdk/react-ecs'

export function setupUi() {
  ReactEcsRenderer.setUiRenderer(MyUI, { virtualWidth: 1920, virtualHeight: 1080 })
}
```

## Core Components

**UiEntity** — Container element. Key props: `uiTransform` (width, height, positionType, position, flexDirection, justifyContent, alignItems, alignContent, alignSelf, padding, margin, display, overflow, flexWrap, flexGrow, `opacity`, `zIndex`, `borderWidth`, `borderColor`, `borderRadius`), `uiBackground` (color, texture, textureMode, textureSlices, uvs, avatarTexture), `uiText` (value, fontSize, color, textAlign, font). Events: `onMouseDown`, `onMouseUp`, `onMouseEnter`, `onMouseLeave`.

- `opacity` (number 0–1): fades the element. Set on the root to fade the whole UI; **cascades multiplicatively to children**.
- `zIndex` (number, incl. negative): controls stacking order among sibling elements. Higher = on top. Does not cross parent boundaries.
- `borderWidth` / `borderColor` (`Color4`) / `borderRadius`: also valid on `Button`, `Input`, `Dropdown` via their `uiTransform`.
- `width`/`height` accept a number (px), `'50%'`, `'400px'`, or `'auto'`. `position`/`padding`/`margin` values accept the same string forms; `margin` also accepts a CSS shorthand string, e.g. `margin: '16px 0 8px 270px'`.

**Label** — Text display. Key props: `value`, `fontSize`, `color`, `textAlign` (e.g. `'middle-center'`), `font` (`'sans-serif'`|`'serif'`|`'monospace'`), `uiTransform`.

**Button** — Clickable button. Key props: `value`, `variant` (`'primary'`|`'secondary'`), `fontSize`, `onMouseDown`, `uiTransform`.

**Input** — Text input field. Key props: `placeholder`, `fontSize`, `color`, `onChange`, `onSubmit`, `uiTransform`.

**Dropdown** — Selection dropdown. Key props: `options` (string[]), `selectedIndex`, `onChange`, `fontSize`, `uiTransform`, `disabled`.

**ScreenInsetArea** — Wrapper that keeps children inside the device's hardware-reserved margins (notch, status bar, home indicator, rounded corners). On mobile, it positions itself absolutely using the insets the device reports. On desktop the insets are `(0,0,0,0)`, so it's a no-op — safe to leave in cross-platform UI. It owns its own `positionType` and `position`; any values you pass for those in `uiTransform` are ignored. All other `uiTransform` props (`padding`, `flexDirection`, `alignItems`, …) and components (`uiBackground`, `onMouseDown`, …) work as usual. Wrap any mobile-sensitive HUD in it; a child sized `width: '100%', height: '100%'` fills the safe area exactly. Distinct from the *Decentraland system HUD* reserved zones (joystick, chat, profile, interaction button) — those still need to be avoided manually; use both together. UI designed for desktop typically needs sizes scaled ~3× for mobile readability.

**InteractableArea** — Wrapper that keeps children inside the renderer-reported *interactable area* — the part of the screen NOT covered by the client's own UI (minimap, chat window, platform overlays). Reads `UiCanvasInformation.interactableArea` and constrains children via absolute positioning; on the Unity desktop client the left ~25% of the screen is reserved, so children fill the remaining ~75%. Like `ScreenInsetArea`, it owns `positionType`/`position` (values you pass are ignored) and falls back to zero insets (no-op) when unavailable. Import from `@dcl/sdk/react-ecs`; usage `<InteractableArea><MyHud /></InteractableArea>`. Distinct from `ScreenInsetArea` (which avoids *device* hardware margins, not client UI). See `{baseDir}/references/ui-components.md` → InteractableArea.

## Adding Independent UI Renderers (addUiRenderer)

Use `ReactEcsRenderer.addUiRenderer(ownerEntity, MyWidget, { virtualWidth: 1920, virtualHeight: 1080 })` to render a UI module independently without replacing the main UI. Useful for smart items or modular scene components. Remove with `ReactEcsRenderer.removeUiRenderer(owner)`. If the owner entity is destroyed, the UI is removed automatically.

## State Management

Use module-level variables for UI state — React hooks (`useState`, `useEffect`, etc.) are **NOT** available. The UI renderer re-renders every frame, so state changes are reflected immediately. Export functions to update state from game logic.

## Common UI Patterns

- **Health bar** — Nested UiEntity with width as percentage
- **Image background** — `uiBackground` with `texture` and `textureMode: 'stretch'`
- **Screen dimensions** — Read via `UiCanvasInformation.getOrNull(engine.RootEntity)`
- **Nine-slice textures** — `textureMode: 'nine-slices'` with `textureSlices` for scalable panels
- **Texture UVs / Sprite sheets** — `uvs` array (8 numbers) to select texture regions
- **Hover events** — `onMouseEnter`/`onMouseLeave` on UiEntity
- **Flex wrap** — `flexWrap: 'wrap'` for grid layouts
- **Scrollable containers** — `overflow: 'scroll'` on a fixed-size parent to scroll through overflowing content (drag or mouse wheel). Use `overflow: 'hidden'` to clip overflow without scrolling. Use `flexGrow: 1` on scrollable entities to fill remaining space
- **Texture tint** — set `color` alongside `texture` in `uiBackground` to tint the image (works with `stretch` and `nine-slices`)
- **Multiple stacked layers** — the renderer function may return an array of elements, e.g. `setUiRenderer(() => [PanelA(), PanelB()])`; later items in the array render on top of earlier ones
- **Opacity / z-index** — `opacity` and `zIndex` on `uiTransform` (see Core Components); root `opacity` fades the whole HUD

## Gotchas (verified against engine test scenes)

- **`Input` and `Dropdown` are uncontrolled.** `onChange`/`onSubmit` fire with the current value, but the field does not read back from the `value`/`selectedIndex` prop you pass each frame the way React does. To programmatically clear an `Input`, briefly set `value` to a non-empty sentinel (e.g. `' '`) for one frame, then back to `''`. Do not expect setting `value` to force the displayed text every frame.
- **`zIndex` is per-sibling-group.** It orders siblings within the same parent; it does not lift an element above elements in a different branch of the tree. Use array-return ordering or tree structure for cross-branch stacking.
- **`opacity` multiplies down the tree.** A child at `opacity: 0.8` inside a root at `opacity: 0.5` renders at 0.4 effective. Don't stack opacities unintentionally.
- **`textureMode: 'stretch'` deforms non-uniform art**; use `'nine-slices'` (with `textureSlices`) for panels/buttons that must scale without distorting borders, and `'center'` to draw the texture at native size centered in the element.
- **Texture `src` paths are relative to the scene root** (e.g. `'images/panel.png'`), not to `src/`.

## Common Widgets — Build From Scratch

Build every widget from React-ECS primitives (`UiEntity`, `Label`, `Button`). There is no pre-built widget library to install.

- **Prompt / dialog / confirmation?** → full-screen overlay + centered panel + `Button`s. See the **Modal Dialog** pattern in `references/ui-components.md`.
- **Health bar, progress bar, score?** → nested `UiEntity` with the inner one sized `width: `${pct}%``. See the **Health Bar** patterns in `references/ui-components.md` and `references/ui-patterns.md`; a score is a `Label` bound to a module-level variable.
- **Flash announcement (timed, centered)?** → a centered `Label` gated on a module-level flag, cleared with `timers.setTimeout`. See **Timed Announcement** in `references/ui-patterns.md`.
- **Custom panel, inventory, complex layout?** → React-ECS directly (see `references/ui-patterns.md`).

## Troubleshooting

Work through the wiring causes in this table in order before speculating about layout-level causes (sizing, `display: 'none'`, off-screen positioning, color-on-color) — wiring problems are the cause by a wide margin.

| Problem                                                        | Cause                                                                                                                | Solution                                                                                                                                     |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| UI not rendering / invisible / nothing on screen (most common) | `setupUi()` is not called from `main()` in `src/index.ts` — users sometimes remove or comment out this call | Add the `setupUi()` call inside `main()`. Always check this first.                                                                           |
| UI not rendering even though `setupUi()` is called             | `ReactEcsRenderer.setUiRenderer(...)` missing from `setupUi()` itself                                                | Add `ReactEcsRenderer.setUiRenderer(MyUI, { virtualWidth: 1920, virtualHeight: 1080 })`                                                      |
| UI blank on first frames, sometimes appears later              | Root component returns `null` (or falsy) on first render with no fallback                                            | Render a placeholder or hidden root instead of returning `null`                                                                              |
| Multiple UIs fighting / UI missing                             | More than one `setUiRenderer` call — later calls replace earlier ones, so only the last one wins                     | Only call `setUiRenderer` once — combine all UI into a single root component, or use `addUiRenderer` with separate owner entities            |
| Absolute-positioned children laid out unexpectedly             | Root `<UiEntity>` has no `width`/`height` — without a full-canvas root, some absolute-positioned children may not render | Add `uiTransform={{ width: '100%', height: '100%' }}` to the root — see "Convention" section below for empirical evidence.                   |
| UI elements overlapping                                        | Missing `flexDirection` or wrong layout                                                                              | Set `flexDirection: 'column'` on the parent container                                                                                        |
| Button clicks not registering                                  | Missing `onMouseDown` handler                                                                                        | Add `onMouseDown={() => { ... }}` to the Button or UiEntity                                                                                  |
| JSX errors at compile time                                     | File extension is `.ts` instead of `.tsx`                                                                            | Rename the file to `.tsx`                                                                                                                    |
| Text not visible                                               | Text color matches background                                                                                        | Set contrasting `color` on Label or `uiText`                                                                                                 |

## Convention: root `<UiEntity>` must set `width: '100%', height: '100%'`

Set `uiTransform={{ width: '100%', height: '100%' }}` on the root `<UiEntity>` returned to `setUiRenderer` / `addUiRenderer` whenever the UI uses absolute positioning. Do this by default.

Note: this is required specifically so absolute-positioned children get a full-screen positioning context. Some engine test scenes that lay everything out with flow/`margin` (no absolute children) use a smaller root (e.g. `90%` or `50%`) and render fine — but a full-canvas root is the safe default and never hurts.

Rationale (**empirically verified** — tested in-engine June 2026):

- Without a full-canvas root, absolute-positioned children using `position: { top, right }` may fail to render entirely. In testing, a root with no explicit `width`/`height` caused a `top-right` positioned child to disappear while a `bottom-left` child rendered correctly. Adding `width: '100%', height: '100%'` to the root fixed the issue.
- A full-canvas root gives absolute-positioned children (`positionType: 'absolute'` with `position: { top, left, ... }`) a known, full-screen positioning context. This matches the implicit assumption most HUD code makes.
- It avoids edge-case layout surprises with Yoga's default sizing for unspecified `width`/`height`.

## Example scenes

Engine-team test scenes exercised against the real renderer (ground truth for the APIs above):

- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/0,6-ui-zindex-and-opacity — `zIndex` (incl. negative) and `opacity` on `uiTransform`, including root-level opacity cascade; buttons cycle values.
- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/70,-9-sdk7-ui-backgrounds — every `uiBackground` texture mode (`stretch`, `nine-slices`, `center`), color tinting over textures, `avatarTexture`, and `textureSlices`.
- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/80,-3-ui — `Label`/`Input`/`Dropdown`/`Button` end to end, `uiText` on `UiEntity`, `margin` CSS-shorthand strings, `'auto'` sizing, `UiCanvasInformation`.
- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/81,-3-ui-2 — array-return of stacked panels, `disabled` toggling, border props (`borderWidth`/`borderColor`/`borderRadius`) on Input/Dropdown/Button, uncontrolled-input clear trick, textured `Button` (nine-slices) vs. clickable `UiEntity`.
- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/76,-10-UiCanvasInformation — reading `UiCanvasInformation` each frame into a module variable to size UI responsively.
- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/8,7-portable-experience-hide-ui — hiding a portable experience's UI via `featureToggles.portableExperiences: "hideUi"` in `scene.json` (scene-config, not React-ECS).

For full code examples and implementation patterns, see `{baseDir}/references/ui-patterns.md`. For component prop details, see `{baseDir}/references/ui-components.md`.
