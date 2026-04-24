---
name: build-ui
description: Build 2D screen-space UI for Decentraland scenes using React-ECS (JSX). Create HUDs, menus, health bars, scoreboards, dialogs, buttons, inputs, and dropdowns. Use when the user wants screen overlays, on-screen UI, HUD elements, menus, or form inputs. Do NOT use for 3D in-world text (see advanced-rendering) or clickable 3D objects (see add-interactivity).
---

# Building UI with React-ECS

Decentraland SDK7 uses a React-like JSX system for 2D UI overlays.

## When to Use Which UI Approach

| Need | Approach | Component |
|------|----------|-----------|
| Screen-space HUD, menus, buttons | React-ECS (this skill) | `UiEntity`, `Label`, `Button`, `Input`, `Dropdown` |
| 3D text floating in the world | TextShape + Billboard | See **advanced-rendering** skill |
| Open a web page | `openExternalUrl` | See **scene-runtime** skill |
| Clickable objects in 3D space | Pointer events | See **add-interactivity** skill |

Use React-ECS for any 2D overlay: scoreboards, health bars, dialogs, inventories, settings menus. Use TextShape for labels above NPCs or objects in the 3D world.

## Setup

Create `src/ui.tsx` with your UI component and call `ReactEcsRenderer.setUiRenderer(MyUI, { virtualWidth: 1920, virtualHeight: 1080 })` from `setupUi()`. Call `setupUi()` from `main()` in `src/index.ts`. The SDK template already includes the required JSX settings in tsconfig.json — do NOT modify it.

## Core Components

**UiEntity** — Container element. Key props: `uiTransform` (width, height, positionType, position, flexDirection, justifyContent, alignItems, padding, margin, display, overflow), `uiBackground` (color, texture, textureMode, textureSlices, uvs). Events: `onMouseDown`, `onMouseUp`, `onMouseEnter`, `onMouseLeave`.

**Label** — Text display. Key props: `value`, `fontSize`, `color`, `textAlign` (e.g. `'middle-center'`), `font` (`'sans-serif'`|`'serif'`|`'monospace'`), `uiTransform`.

**Button** — Clickable button. Key props: `value`, `variant` (`'primary'`|`'secondary'`), `fontSize`, `onMouseDown`, `uiTransform`.

**Input** — Text input field. Key props: `placeholder`, `fontSize`, `color`, `onChange`, `onSubmit`, `uiTransform`.

**Dropdown** — Selection dropdown. Key props: `options` (string[]), `selectedIndex`, `onChange`, `fontSize`, `uiTransform`, `disabled`.

## Virtual Screen Size (Scaling for All Resolutions)

Always set `virtualWidth` and `virtualHeight` when calling `setUiRenderer` or `addUiRenderer`. Use `1920 x 1080` as the standard reference resolution. This ensures UI elements scale proportionally across all screen sizes.

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

| Problem | Cause | Solution |
|---------|-------|----------|
| UI not appearing at all | Missing `ReactEcsRenderer.setUiRenderer()` call | Add `ReactEcsRenderer.setUiRenderer(MyUI)` in `main()` or `setupUi()` |
| UI elements overlapping | Missing `flexDirection` or wrong layout | Set `flexDirection: 'column'` on the parent container |
| Button clicks not registering | Missing `onMouseDown` handler | Add `onMouseDown={() => { ... }}` to the Button or UiEntity |
| JSX errors at compile time | File extension is `.ts` instead of `.tsx` | Rename the file to `.tsx` |
| Multiple UIs fighting | More than one `setUiRenderer` call | Only call `setUiRenderer` once — combine all UI into a single root component, or use `addUiRenderer` with separate owner entities |
| Text not visible | Text color matches background | Set contrasting `color` on Label or `uiText` |

## Important Notes

- React hooks (`useState`, `useEffect`, etc.) are **NOT** available — use module-level variables
- The UI renderer re-renders every frame, so state changes are reflected immediately
- UI is rendered as a 2D overlay on top of the 3D scene
- Use `display: 'none'` in `uiTransform` to hide elements without removing them
- File extension must be `.tsx` for JSX support
- Only one `ReactEcsRenderer.setUiRenderer()` call per scene — combine all UI into one root component, or use `addUiRenderer()` with separate owner entities
- Always set `virtualWidth` and `virtualHeight` in `setUiRenderer`/`addUiRenderer`
- **Desktop:** Avoid placing UI elements on the leftmost ~25% of the screen (reserved for chat, map, platform UI)
- **Mobile:** Avoid placing UI elements in non-safe zones (notch, status bar, home indicator)

For full code examples, implementation patterns, and dcl-ui-toolkit widget reference, see `{baseDir}/references/ui-patterns.md`. For component prop details, see `{baseDir}/references/ui-components.md`.
