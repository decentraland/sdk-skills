---
name: build-ui
description: Build 2D screen-space UI for Decentraland scenes using React-ECS (JSX). Create HUDs, menus, health bars, scoreboards, dialogs, buttons, inputs, and dropdowns. Use when the user wants screen overlays, on-screen UI, HUD elements, menus, or form inputs. Do NOT use for 3D in-world text (see advanced-rendering) or clickable 3D objects (see add-interactivity).
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

Why: Without a virtual size, UI is laid out in raw screen pixels and renders inconsistently across different resolutions and aspect ratios — fonts, spacing, and absolute-positioned elements drift between displays. Setting a virtual screen size makes the engine scale the UI proportionally to a fixed reference frame, so layouts look the same on every screen. 1920x1080 is the safe default — it matches the most common displays and matches the assumption made by `dcl-ui-toolkit` and most community examples.

API (verified against `@dcl/react-ecs` 7.22.5, file `dist/system.d.ts`):

```ts
type UiRendererOptions = { virtualWidth: number; virtualHeight: number }
setUiRenderer(ui: UiComponent, options?: UiRendererOptions): void
addUiRenderer(entity: Entity, ui: UiComponent, options?: UiRendererOptions): void
```

Canonical snippet (use this verbatim unless the user specifies otherwise):

```tsx
import { ReactEcsRenderer } from "@dcl/sdk/react-ecs";

export function setupUi() {
  ReactEcsRenderer.setUiRenderer(MyUI, {
    virtualWidth: 1920,
    virtualHeight: 1080,
  });
}
```

## Core Components

**UiEntity** — Container element. Key props: `uiTransform` (width, height, positionType, position, flexDirection, justifyContent, alignItems, padding, margin, display, overflow), `uiBackground` (color, texture, textureMode, textureSlices, uvs). Events: `onMouseDown`, `onMouseUp`, `onMouseEnter`, `onMouseLeave`.

**Label** — Text display. Key props: `value`, `fontSize`, `color`, `textAlign` (e.g. `'middle-center'`), `font` (`'sans-serif'`|`'serif'`|`'monospace'`), `uiTransform`.

**Button** — Clickable button. Key props: `value`, `variant` (`'primary'`|`'secondary'`), `fontSize`, `onMouseDown`, `uiTransform`.

**Input** — Text input field. Key props: `placeholder`, `fontSize`, `color`, `onChange`, `onSubmit`, `uiTransform`.

**Dropdown** — Selection dropdown. Key props: `options` (string[]), `selectedIndex`, `onChange`, `fontSize`, `uiTransform`, `disabled`.

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

## dcl-ui-toolkit (Pre-Built Widgets)

Install with `npm install dcl-ui-toolkit`. Register with `ReactEcsRenderer.setUiRenderer(ui.render)` or combine: `ReactEcsRenderer.setUiRenderer(() => [ui.render(), MyCustomUI()])`.

**When to use dcl-ui-toolkit vs React-ECS:**

- Prompt/dialog? → `displayOkPrompt`, `displayOptionPrompt`, `CustomPrompt`
- Health bar, score counter? → `createBar`, `createCounter`
- Flash announcement? → `displayAnnouncement`
- Custom panel, inventory, complex layout? → React-ECS directly

## Troubleshooting

| Problem                                                        | Cause                                                                                                                | Solution                                                                                                                                     |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| UI not rendering / invisible / nothing on screen (most common) | `setupUi()` is not called from `main()` in `src/index.ts` — the SDK template ships with `// setupUi()` commented out | Uncomment / add the `setupUi()` call inside `main()`. Always check this first.                                                               |
| UI not rendering even though `setupUi()` is called             | `ReactEcsRenderer.setUiRenderer(...)` missing from `setupUi()` itself                                                | Add `ReactEcsRenderer.setUiRenderer(MyUI, { virtualWidth: 1920, virtualHeight: 1080 })`                                                      |
| UI blank on first frames, sometimes appears later              | Root component returns `null` (or falsy) on first render with no fallback                                            | Render a placeholder or hidden root instead of returning `null`                                                                              |
| Multiple UIs fighting                                          | More than one `setUiRenderer` call                                                                                   | Only call `setUiRenderer` once — combine all UI into a single root component, or use `addUiRenderer` with separate owner entities            |
| Absolute-positioned children laid out unexpectedly             | Root `<UiEntity>` has no `width`/`height` (convention is `'100%'`/`'100%'`)                                          | Add `uiTransform={{ width: '100%', height: '100%' }}` to the root. Convention, not a proven requirement — see "Convention" section near top. |
| UI elements overlapping                                        | Missing `flexDirection` or wrong layout                                                                              | Set `flexDirection: 'column'` on the parent container                                                                                        |
| Button clicks not registering                                  | Missing `onMouseDown` handler                                                                                        | Add `onMouseDown={() => { ... }}` to the Button or UiEntity                                                                                  |
| JSX errors at compile time                                     | File extension is `.ts` instead of `.tsx`                                                                            | Rename the file to `.tsx`                                                                                                                    |
| Text not visible                                               | Text color matches background                                                                                        | Set contrasting `color` on Label or `uiText`                                                                                                 |

## Diagnosing "UI not showing" — check these first, in order

When a user reports the UI is not rendering, work through this list before any speculation about layout or sizing:

1. **`setupUi()` is not called from `main()` in `src/index.ts`.** This is the most common cause by a wide margin. The SDK template ships with `// setupUi()` commented out — if nothing else changed, this is almost always the bug. Open `src/index.ts` and confirm `setupUi()` (or whatever name the project uses) is uncommented and called inside `main()`.
2. **`ReactEcsRenderer.setUiRenderer(...)` is missing from `setupUi()` itself.** Open the UI module and confirm the renderer is registered.
3. **The renderer function returns `null` (or a falsy value) on first render with no fallback.** A guard like `if (!data) return null` at the top of the root component will produce a blank screen until `data` is populated. Render a placeholder or a hidden root instead so the renderer has something to mount.
4. **`tsconfig.json` JSX settings are missing or wrong.** The SDK template ships with the right settings — a common mistake is editing them. If JSX errors appear at compile time, the file extension may be `.ts` instead of `.tsx`.
5. **Multiple `setUiRenderer` calls.** Only one wins — later calls replace earlier ones. Use `addUiRenderer` for additional independent modules.

Only after the above are confirmed should layout-level causes (sizing, `display: 'none'`, off-screen positioning, color-on-color) be considered.

## Convention: root `<UiEntity>` should set `width: '100%', height: '100%'`

Every working scene surveyed in the Decentraland scene library sets `uiTransform={{ width: '100%', height: '100%' }}` on the root `<UiEntity>` returned to `setUiRenderer` / `addUiRenderer`. Treat this as the default.

Rationale (convention-level, **mechanism not empirically verified**):

- A full-canvas root gives absolute-positioned children (`positionType: 'absolute'` with `position: { top, left, ... }`) a known, full-screen positioning context. This matches the implicit assumption most HUD code makes.
- It avoids edge-case layout surprises with Yoga's default sizing for unspecified `width`/`height`.

## Important Notes

- React hooks (`useState`, `useEffect`, etc.) are **NOT** available — use module-level variables
- The UI renderer re-renders every frame, so state changes are reflected immediately
- UI is rendered as a 2D overlay on top of the 3D scene
- Use `display: 'none'` in `uiTransform` to hide elements without removing them
- File extension must be `.tsx` for JSX support
- Only one `ReactEcsRenderer.setUiRenderer()` call per scene — combine all UI into one root component, or use `addUiRenderer()` with separate owner entities
- Always pass `{ virtualWidth: 1920, virtualHeight: 1080 }` to `setUiRenderer`/`addUiRenderer` by default (see "DEFAULT RULE" above) — only change if the user explicitly asks
- **Desktop:** Avoid placing UI elements on the leftmost ~25% of the screen (reserved for chat, map, platform UI)
- **Mobile:** Avoid placing UI elements in non-safe zones (notch, status bar, home indicator)

For full code examples, implementation patterns, and dcl-ui-toolkit widget reference, see `{baseDir}/references/ui-patterns.md`. For component prop details, see `{baseDir}/references/ui-components.md`.
