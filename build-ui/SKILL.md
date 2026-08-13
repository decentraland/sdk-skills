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

Create `src/ui.tsx` with your UI component and call `ReactEcsRenderer.setUiRenderer(MyUI)` from `setupUi()`. Call `setupUi()` from `main()` in `src/index.ts`. The SDK template already includes the required JSX settings in tsconfig.json -- do NOT modify it.

## Virtual Screen Size and UI Scaling

The SDK uses a virtual screen to scale UI consistently across display resolutions. When a virtual size is active, all pixel values in `uiTransform` are relative to the virtual canvas, not the physical screen.

**Platform defaults (when no virtual size is provided):**
- Desktop: 1920x1080
- Mobile: 1600x720

These defaults apply automatically -- `setUiRenderer(ui)` with no options uses 1920x1080 on desktop and 1600x720 on mobile. You do NOT need to pass `{ virtualWidth: 1920, virtualHeight: 1080 }` explicitly unless you want a non-default size. Passing it explicitly is harmless on desktop (matches the default) but on mobile a 16:9 size is overridden to 1600x720 anyway (see below).

**Mobile 16:9 override:** any provided virtual size with a 16:9 aspect ratio (e.g. 1920x1080, 2560x1440) is silently overridden to 1600x720 on mobile. Phone screens are much wider than 16:9, so a 16:9 virtual canvas would letterbox the UI. A non-16:9 size (e.g. 1600x720, 1024x600) is used as-is on all platforms.

**Disabling the virtual screen:** pass a value <= 0 for either dimension (e.g. `{ virtualWidth: 0, virtualHeight: 0 }`) to disable UI scaling entirely -- pixel values map 1:1 to canvas pixels. Providing only one dimension (e.g. `{ virtualWidth: 1920 }` with `virtualHeight` omitted) also disables scaling and logs a warning.

**DPR (devicePixelRatio) is NOT part of the scaling formula.** The scale factor is `Math.min(canvasWidth / virtualWidth, canvasHeight / virtualHeight)` -- a pure contain-fit. `devicePixelRatio` is a density hint for asset selection, not a layout unit.

API (verified against `@dcl/react-ecs`, commit `08dff786`):

```ts
type UiScreenInset = 'device' | 'interactable' | 'none'
type UiRendererOptions = {
  virtualWidth?: number   // optional; defaults to 1920 (desktop) / 1600 (mobile)
  virtualHeight?: number  // optional; defaults to 1080 (desktop) / 720 (mobile)
  screenInset?: UiScreenInset  // default 'device'
}
setUiRenderer(ui: UiComponent, options?: UiRendererOptions): void
addUiRenderer(entity: Entity, ui: UiComponent, options?: UiRendererOptions): void
```

### `screenInset` option

Each renderer's `screenInset` selects the screen area the UI is positioned in:
- `'device'` (default): wraps the renderer's component in a `ScreenInsetArea` -- UI stays inside the device's hardware safe area (notch, status bar, rounded corners). No-op on desktop.
- `'interactable'`: wraps in an `InteractableArea` -- UI stays inside the area free of the Explorer's native HUD (minimap, chat).
- `'none'`: no wrapper -- UI covers the whole screen from `(0,0)`.

Each renderer (`setUiRenderer` and each `addUiRenderer`) honors its own `screenInset` independently, so the main UI and additional renderers can use different insets simultaneously.

Canonical snippet (use this verbatim unless the user specifies otherwise):

```tsx
import { ReactEcsRenderer } from '@dcl/sdk/react-ecs'

export function setupUi() {
  ReactEcsRenderer.setUiRenderer(MyUI)
}
```

If the user wants explicit control, pass options:

```tsx
ReactEcsRenderer.setUiRenderer(MyUI, {
  virtualWidth: 1920,
  virtualHeight: 1080,
  screenInset: 'device'
})
```

## Core Components

**UiEntity** — Container element. Key props: `uiTransform` (width, height, positionType, position, flexDirection, justifyContent, alignItems, alignContent, alignSelf, padding, margin, display, overflow, flexWrap, flexGrow, `opacity`, `zIndex`, `borderWidth`, `borderColor`, `borderRadius`, `pointerFilter`), `uiBackground` (color, texture, textureMode, textureSlices, uvs, avatarTexture), `uiText` (value, fontSize, color, textAlign, font). Events: `onMouseDown`, `onMouseUp`, `onMouseEnter`, `onMouseLeave`.

- **These four are the complete set of UI event handlers, and each is `() => void`.** There is no `onMouseDrag`/`onMouseMove`, and **no arguments — no pointer coordinates, no event object — are passed to a handler**. All four are hardcoded to `InputAction.IA_POINTER`; you cannot bind a UI element to right-click or a key. Drag interactions are still fully possible via `PrimaryPointerInfo.screenDelta` — see "Sliders" below.

- `opacity` (number 0–1): fades the element. Set on the root to fade the whole UI; **cascades multiplicatively to children**.
- `zIndex` (number, incl. negative): controls stacking order among sibling elements. Higher = on top. Does not cross parent boundaries.
- `borderWidth` / `borderColor` (`Color4`) / `borderRadius`: also valid on `Button`, `Input`, `Dropdown` via their `uiTransform`.
- `width`/`height` accept a number (px), `'50%'`, `'400px'`, or `'auto'`. `position`/`padding`/`margin` values accept the same string forms; `margin` also accepts a CSS shorthand string, e.g. `margin: '16px 0 8px 270px'`.

**Label** — Text display. Key props: `value`, `fontSize`, `color`, `textAlign` (e.g. `'middle-center'`), `font` (`'sans-serif'`|`'serif'`|`'monospace'`), `uiTransform`.

**Button** — Clickable button. Key props: `value`, `variant` (`'primary'`|`'secondary'`), `fontSize`, `onMouseDown`, `uiTransform`.

**Input** — Text input field. Key props: `placeholder`, `fontSize`, `color`, `onChange`, `onSubmit`, `uiTransform`.

**Dropdown** — Selection dropdown. Key props: `options` (string[]), `selectedIndex`, `onChange`, `fontSize`, `uiTransform`, `disabled`.

**ScreenInsetArea** — Wrapper that keeps children inside the device's hardware-reserved margins (notch, status bar, home indicator, rounded corners). On mobile, it positions itself absolutely using the insets the device reports. On desktop the insets are `(0,0,0,0)`, so it's a no-op -- safe to leave in cross-platform UI. It owns its own `positionType` and `position`; any values you pass for those in `uiTransform` are ignored. All other `uiTransform` props (`padding`, `flexDirection`, `alignItems`, ...) and components (`uiBackground`, `onMouseDown`, ...) work as usual. Wrap any mobile-sensitive HUD in it; a child sized `width: '100%', height: '100%'` fills the safe area exactly. Distinct from the *Decentraland system HUD* reserved zones (joystick, chat, profile, interaction button) -- those still need to be avoided manually; use both together. UI designed for desktop typically needs sizes scaled ~3x for mobile readability. The component auto-compensates for the UI scale factor (pre-divides insets so the parser's scale multiplication cancels out), so insets are always correct regardless of virtual screen size. Also applied automatically via the `screenInset: 'device'` option on `setUiRenderer`/`addUiRenderer` (the default).

**InteractableArea** — Wrapper that keeps children inside the renderer-reported *interactable area* -- the part of the screen NOT covered by the client's own UI (minimap, chat window, platform overlays). Reads `UiCanvasInformation.interactableArea` and constrains children via absolute positioning; on the Unity desktop client the left ~25% of the screen is reserved, so children fill the remaining ~75%. Like `ScreenInsetArea`, it owns `positionType`/`position` (values you pass are ignored) and falls back to zero insets (no-op) when unavailable. Import from `@dcl/sdk/react-ecs`; usage `<InteractableArea><MyHud /></InteractableArea>`. Distinct from `ScreenInsetArea` (which avoids *device* hardware margins, not client UI). Auto-compensates for the UI scale factor like `ScreenInsetArea`. Also applied automatically via the `screenInset: 'interactable'` option on `setUiRenderer`/`addUiRenderer`. See `{baseDir}/references/ui-components.md` -> InteractableArea.

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
- **No pointer coordinates in UI handlers.** `onMouseDown`/`onMouseUp`/`onMouseEnter`/`onMouseLeave` are `() => void` — the reconciler discards the `PBPointerEventsResult` before calling your callback, so "where on this element did they click" is unavailable. Track *movement* instead of position: `PrimaryPointerInfo.screenDelta` reports per-frame mouse travel and drives drag interactions fine. See `{baseDir}/references/ui-sliders.md`.
- **UI elements with a handler become pointer-blocking.** Adding `onMouseDown` makes the element block clicks to the 3D world behind it; elements without one let clicks through. Override either way with `uiTransform.pointerFilter: 'block' | 'none'` (default `'none'`).

## Common Widgets — Build From Scratch

Build every widget from React-ECS primitives (`UiEntity`, `Label`, `Button`). There is no pre-built widget library to install.

- **Prompt / dialog / confirmation?** → full-screen overlay + centered panel + `Button`s. See the **Modal Dialog** pattern in `references/ui-components.md`.
- **Health bar, progress bar, score?** → nested `UiEntity` with the inner one sized `width: `${pct}%``. See the **Health Bar** patterns in `references/ui-components.md` and `references/ui-patterns.md`; a score is a `Label` bound to a module-level variable.
- **Flash announcement (timed, centered)?** → a centered `Label` gated on a module-level flag, cleared with `timers.setTimeout`. See **Timed Announcement** in `references/ui-patterns.md`.
- **Slider / drag handle / scrub bar?** → **drag sliders work.** UI handlers get no pointer coordinates, so instead: `onMouseDown` on the track starts a drag, and a system accumulates `PrimaryPointerInfo.screenDelta.x` (divided by the UI scale factor) into the value. A full-screen `pointerFilter: 'block'` overlay rendered only while dragging catches the release. Verified in-world on both the Unity and Bevy explorers. Desktop only — `screenDelta` is always 0 on mobile, so pair the track with `-`/`+` stepper `Button`s. Full implementation in `{baseDir}/references/ui-sliders.md`.
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

For full code examples and implementation patterns, see `{baseDir}/references/ui-patterns.md`. For component prop details, see `{baseDir}/references/ui-components.md`. For sliders and the limits of UI pointer input, see `{baseDir}/references/ui-sliders.md`.

## Cross-references

- **Platform detection**: Use `getPlatform()` / `isMobile()` from `@dcl/sdk/platform` to branch UI for mobile vs. desktop. See the **advanced-input** skill.
- **Mobile UI limitations**: `borderRadius` is unsupported on mobile. Design for touch (larger tap targets, no hover states). See the mobile considerations in the **advanced-input** skill.
