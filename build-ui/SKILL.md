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

The SDK uses a virtual screen to scale UI consistently across display resolutions: when a virtual size is active, all pixel values in `uiTransform` are relative to the virtual canvas, not the physical screen.

**Whenever you generate UI code, you MUST pass `{ virtualWidth: 1920, virtualHeight: 1080 }` to `setUiRenderer` and `addUiRenderer` by default — without waiting for the user to ask.** Only deviate if the user explicitly requests a different reference resolution.

Why: pixel values in a UI are only meaningful against a reference resolution. Stating it explicitly in the code keeps the scene's layout intent visible and pins it, instead of leaving it to a per-platform default that differs between mobile and desktop. 1920x1080 is the safe default — it matches the most common displays and the assumption made by most community examples.

The options argument is optional at the API level. **On SDK 7.26.0+, omitting it does not mean "no scaling"** — the SDK applies a platform default virtual screen instead:

| Case | Resulting virtual screen |
|---|---|
| No virtual size passed, non-mobile | `1920x1080` |
| No virtual size passed, mobile | `1600x720` |
| A 16:9 size passed (e.g. `1920x1080`), mobile | overridden to `1600x720`, logged once to console |
| A non-16:9 size passed | used as-is on every platform |
| A size with any value `<= 0` | virtual screen **disabled** — raw canvas pixels, no scaling. Silent: this is the documented opt-out |
| Only one of the two dimensions passed | also **disabled** (both are required), and logged once per size — it is treated as a mistake, not an opt-out |

The mobile 16:9 override exists because phone screens are much wider than 16:9 — a 16:9 virtual canvas would letterbox the UI there.

So on 7.26.0+, `{ virtualWidth: 0, virtualHeight: 0 }` — not omitting the options — is how you opt into raw-pixel layout. Only do that if the user explicitly asks for it. **Below 7.26.0 there are no defaults: omitting the options is what disables scaling.** See the version gate below.

Because the default rule above has you pass the size explicitly either way, generated code behaves identically on both sides of that boundary — which is a second reason to always pass it.

The virtual size is scene-wide, resolved as: the size on `setUiRenderer` wins → else the first `addUiRenderer` that passed one → else the platform default. Options carrying only a `screenInset` don't count as a passed size.

Note that `setUiRenderer` wins the arbitration if it mentions *either* dimension, even when the size is incomplete and therefore invalid. So `setUiRenderer(ui, { virtualWidth: 1920 })` disables the virtual screen for the whole scene and discards a valid size passed to any `addUiRenderer`. The SDK logs it once per size, but the scene still loses its virtual screen. Never emit a single dimension.

API (verified against `@dcl/react-ecs`, file `dist/system.d.ts`):

```ts
type UiScreenInset = 'device' | 'interactable' | 'none'
type UiRendererOptions = {
  virtualWidth?: number   // optional
  virtualHeight?: number  // optional
  screenInset?: UiScreenInset  // defaults to 'device'
}
setUiRenderer(ui: UiComponent, options?: UiRendererOptions): void
addUiRenderer(entity: Entity, ui: UiComponent, options?: UiRendererOptions): void
```

### screenInset: which screen area the UI sits in

`screenInset` picks the area a renderer's UI is positioned in. It **defaults to `'device'`**, so UI is kept clear of the notch, status bar and rounded corners out of the box.

| Value | Area |
|---|---|
| `'device'` _(default)_ | Device safe area, from `UiCanvasInformation.screenInsetArea`. Zero on desktop, so a no-op there. |
| `'interactable'` | Area the client designates for scene UI, from `UiCanvasInformation.interactableArea`. Clears the minimap, chat, and left-side controls, but the **bottom-right action buttons are drawn over this area by design** — UI placed there competes for taps. |
| `'none'` | Whole screen, `0,0` at the top-left corner. |

Unlike the virtual size, this is **per renderer** — the main UI and each `addUiRenderer` widget can use different areas at the same time.

**Do NOT wrap UI in `<ScreenInsetArea>` / `<InteractableArea>` while leaving the matching `screenInset` on the renderer** — the inset gets applied twice and the UI is pushed inwards by double the margin. Rely on `screenInset`, or pass `screenInset: 'none'` and place the wrapper yourself.

## SDK VERSION GATE: 7.26.0 changed three UI-layout behaviors

**Check the scene's `@dcl/sdk` version in its `package.json` before relying on any of the three rows below.** All of them are 7.26.0+ behavior; a scene pinned below that gets the "Below 7.26.0" column instead. `"latest"`, `"^7.x"` or a fresh `create-scene` project means current, so assume 7.26.0+ unless the pin says otherwise.

| Behavior | 7.26.0 and later | Below 7.26.0 |
|---|---|---|
| **Virtual screen default** | Omitting the size applies `1920x1080` (`1600x720` mobile); a 16:9 size is overridden to `1600x720` on mobile; `<= 0` disables scaling | No default at all — omitting the size means raw canvas pixels, no scaling. `virtualWidth`/`virtualHeight` are **required** when the options object is passed |
| **`screenInset` option** | Exists, defaults to `'device'` — UI is inset from the device safe area automatically | **Does not exist.** Passing it is a type error. To inset UI you must wrap it in `<ScreenInsetArea>` / `<InteractableArea>` yourself |
| **UI scale factor and `vw`/`vh`** | `Math.min(canvasWidth / virtualWidth, canvasHeight / virtualHeight)`; `1vw` is 1% of canvas width, as in CSS | Both additionally divide by `devicePixelRatio`, so the same pixel value renders smaller on a high-density screen |

What this means when writing code:

- **Passing the virtual size explicitly (the default rule) is version-safe** — it produces the same layout on both sides. Prefer it always.
- **`screenInset` is not version-safe.** Only emit it when the scene is on 7.26.0+. Below that, wrap in `<ScreenInsetArea>` instead — and note the wrapper is *correct* there, since there is no renderer-level inset to double up with.
- **Any code that recomputes the scale factor by hand must match the scene's SDK version** — most commonly drag sliders. Below 7.26.0 the `devicePixelRatio` divisor belongs in that formula; from 7.26.0 it does not. Getting it wrong makes drags over- or under-shoot on high-density screens. See `{baseDir}/references/ui-sliders.md`.
- **When migrating a scene up to 7.26.0+**, expect two visible shifts: UI that previously had no scaling now scales against a default virtual screen, and UI gains a device inset on mobile. An existing `<ScreenInsetArea>` wrapper starts double-applying — drop it or pass `screenInset: 'none'`.

Canonical snippet (use this verbatim unless the user specifies otherwise):

```tsx
import { ReactEcsRenderer } from '@dcl/sdk/react-ecs'

export function setupUi() {
  ReactEcsRenderer.setUiRenderer(MyUI, { virtualWidth: 1920, virtualHeight: 1080 })
}
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

**ScreenInsetArea** — Wrapper that keeps children inside the device's hardware-reserved margins (notch, status bar, home indicator, rounded corners). **Usually unnecessary now: `screenInset` defaults to `'device'`, which already does this for the whole renderer.** Reach for the component only when the renderer opted out with `screenInset: 'none'` and you want to protect just one subtree — wrapping on top of the default double-applies the inset. On mobile it positions itself absolutely using the insets the device reports; on desktop the insets are `(0,0,0,0)`, so it's a no-op. It owns its own `positionType` and `position`; any values you pass for those in `uiTransform` are ignored. All other `uiTransform` props (`padding`, `flexDirection`, `alignItems`, …) and components (`uiBackground`, `onMouseDown`, …) work as usual. A child sized `width: '100%', height: '100%'` fills the safe area exactly. It auto-compensates for the UI scale factor (pre-divides insets so the parser's scale multiplication cancels out), so insets are correct regardless of virtual screen size. Distinct from the *Decentraland system HUD* reserved zones (joystick, chat, profile, interaction button) — avoid those with `screenInset: 'interactable'` or by hand, or, for the mobile input controls specifically, hide them outright with `TouchScreenControls` (see **advanced-input**). Do **not** apply the old "scale sizes ~3× for mobile" rule of thumb on 7.26.0+: with `devicePixelRatio` out of the scale factor, pixel-sized UI is already ~2–3× larger on a phone than it used to be, and the `1600x720` mobile virtual screen adds ~1.2× on top. Start from the desktop sizes and only scale up what actually measures too small on a device.

**InteractableArea** — Wrapper that keeps children inside the renderer-reported *interactable area* — the part of the screen NOT covered by the client's own UI (minimap, chat window, platform overlays). Reads `UiCanvasInformation.interactableArea` and constrains children via absolute positioning; on the Unity desktop client the left ~25% of the screen is reserved, so children fill the remaining ~75%. **Prefer `screenInset: 'interactable'` on the renderer for a whole-UI application**; use the component for a single subtree, or when the renderer uses a different inset. Either form needs an explorer that reports the area: it works on desktop, and on mobile from client `1.12.1` onwards — older mobile clients report no margins and the inset silently does nothing. Like `ScreenInsetArea`, it owns `positionType`/`position` (values you pass are ignored), auto-compensates for the UI scale factor, and falls back to zero insets (no-op) when unavailable. Import from `@dcl/sdk/react-ecs`; usage `<InteractableArea><MyHud /></InteractableArea>`. Distinct from `ScreenInsetArea` (which avoids *device* hardware margins, not client UI). See `{baseDir}/references/ui-components.md` → InteractableArea.

## UiInputBinding (bind InputActions to UI elements)

The `uiInputBinding` prop on `UiEntity` binds `InputAction` values to a UI element so they fire continuously while it is pressed (touch or pointer). This is the primary mechanism for on-screen action buttons on mobile where there is no keyboard.

```tsx
import { InputAction } from '@dcl/sdk/ecs'

<UiEntity
  uiTransform={{ width: 80, height: 80 }}
  uiBackground={{ color: Color4.Red() }}
  uiInputBinding={{ actions: [InputAction.IA_JUMP] }}
/>
```

While the element is held down, `InputAction.IA_JUMP` fires as if the player were pressing the spacebar. Multiple actions can be bound to one element. The underlying ECS component is `PBUiInputBinding { actions: InputAction[] }`.

Combine with `TouchScreenControls` (see the **advanced-input** skill) for full mobile control customization: hide the native on-screen buttons, then bind the same actions to your own UI. Verified against js-sdk-toolchain commit `82368ee4`.

## Adding Independent UI Renderers (addUiRenderer)

Use `ReactEcsRenderer.addUiRenderer(ownerEntity, MyWidget, { virtualWidth: 1920, virtualHeight: 1080 })` to render a UI module independently without replacing the main UI. Useful for smart items or modular scene components. Remove with `ReactEcsRenderer.removeUiRenderer(owner)`. If the owner entity is destroyed, the UI is removed automatically.

A scene that only ever calls `addUiRenderer` (no `setUiRenderer` at all) still gets the platform default virtual screen and the default `'device'` inset — the defaults are not tied to the main renderer. The virtual size passed here is ignored if `setUiRenderer` already passed one; `screenInset` is always honored per renderer.

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
- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/81,-2-ui-screen-inset-area — the three `screenInset` modes of `setUiRenderer`/`addUiRenderer` (`'none'`, `'device'`, `'interactable'`) as three coexisting renderers, each framing the area it is positioned in and printing the live `UiCanvasInformation.screenInsetArea` / `.interactableArea` values.
- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/8,7-portable-experience-hide-ui — hiding a portable experience's UI via `featureToggles.portableExperiences: "hideUi"` in `scene.json` (scene-config, not React-ECS).

For full code examples and implementation patterns, see `{baseDir}/references/ui-patterns.md`. For component prop details, see `{baseDir}/references/ui-components.md`. For sliders and the limits of UI pointer input, see `{baseDir}/references/ui-sliders.md`.

## Cross-references

- **UI that must be editable in the Creator Hub**: the Creator Hub's 2D UI editor (UI Designer) parses the scene's real `.tsx` files under `src/ui/` as its document, and only a subset of React-ECS code round-trips. If the user wants to design or restyle the UI visually in the Creator Hub, follow the **editable-ui** skill instead of writing free-form React-ECS — computed style values, loops, conditionals and unknown elements silently become read-only there.
- **Platform detection**: Use `getPlatform()` / `isMobile()` from `@dcl/sdk/platform` to branch UI for mobile vs. desktop. See the **advanced-input** skill.
- **Mobile UI limitations**: `borderRadius` is unsupported on mobile. Design for touch (larger tap targets, no hover states). See the mobile considerations in the **advanced-input** skill.
- **Replacing the native mobile controls**: the on-screen joystick, crosshair, and gamepad buttons are not fixed — `TouchScreenControls` (SDK 7.26.0+, see **advanced-input**) hides any of them so scene UI can take their place, with `UiInputBinding` (above) wiring the replacement buttons to InputActions.
