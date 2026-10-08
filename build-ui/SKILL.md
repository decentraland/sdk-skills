---
name: build-ui
description: Build 2D screen-space UI for Decentraland scenes with React-ECS (JSX) — HUDs, menus, health bars, dialogs, toasts, notifications, buttons, inputs, dropdowns, sliders. By default writes UI that the Creator Hub's 2D UI editor (UI Designer) can read and edit (one component per file under src/ui/, state/props bindings, useInteraction layers, @ui-action handlers, a driver for animation), and falls back to free-form coded React-ECS only for UI too data-driven or dynamic for the editor. Use when the user wants on-screen UI, menus, form inputs, UI editable in the Creator Hub, or an existing coded UI adapted for the editor. Do NOT use for 3D in-world text (see advanced-rendering) or clickable 3D objects (see add-interactivity).
---

# Building UI with React-ECS

Decentraland SDK7 draws 2D overlays with a React-like JSX system (`@dcl/sdk/react-ecs`). There are two ways to write that code, and **the editable way is the default**:

| Mode | What it is | When |
|---|---|---|
| **Editable** (default) | React-ECS written to the contract the Creator Hub's 2D UI editor (UI Designer) can parse, render on a canvas and write back: one `src/ui/<Component>.tsx` per component, `state`/`props` bindings, `useInteraction` layers, `@ui-action` handlers, animation in a driver outside `src/ui/` | Every HUD, menu, dialog, toast, notification, scoreboard, settings panel, health bar, timer, slider — anything a designer may later restyle without touching code |
| **Coded** (corner case) | Free-form React-ECS: `.map()` over data, conditional subtrees, computed styles, helper components, any file layout | Only when the UI is inherently data-driven or dynamic in a way the contract cannot express — see **Choosing the mode**. Details: `{baseDir}/references/coded-ui.md` |

Both are ordinary React-ECS and run anywhere; the editable contract is a *subset*. Do not ask the user which mode they want: pick editable unless the UI hits a coded-only trigger, and say so when it does.

## When to use which UI approach

| Need | Approach | See |
|---|---|---|
| Screen-space HUD, menus, buttons, inputs | React-ECS (this skill) | below |
| 3D text floating in the world | `TextShape` + `Billboard` | **advanced-rendering** |
| Open a web page | `openExternalUrl` | **scene-runtime** |
| Clickable objects in 3D space | pointer events | **add-interactivity** |
| On-screen buttons that fire InputActions (mobile) | `uiInputBinding` on a `UiEntity` + `TouchScreenControls` | `{baseDir}/references/ui-components.md`, **advanced-input** |

## Choosing the mode

Go **editable** by default. Send a UI — or just one panel of it — to **coded** only when it needs one of these, which the editor has no representation for:

- Rows built from a runtime collection (`.map()` over players, inventory items, chat messages) where the count is unknown at authoring time. A fixed set of up to a handful of rows is unrolled by hand and stays editable.
- Per-call arbitrary content: a function rendering different *structure* or a *set* of alternative textures per call (`showPopup(title, body, imageSrc)` with N images). One text slot per value and one `texture.src` per image is fine editable.
- Generic wrappers with children/slots (`<Card>{children}</Card>`) — component refs take no children.
- Per-row draft objects, per-row closures, remount hacks for uncontrolled inputs.

Almost everything else that looks dynamic — fill bars, timers, eased motion, auto-hide, canvas-responsive px sizes, spinners — is a driver-maintained state variable and stays editable.

If only one panel needs coded, keep the rest editable and mount the coded panel separately with `ReactEcsRenderer.addUiRenderer` from a module outside `src/ui/` (`{baseDir}/references/coded-ui.md` → Hybrid scenes). Tell the user which part is not editable and why. When adapting an existing coded UI, expect the result to be **larger** (unrolled loops and variants are the price of editability); report that trade-off rather than half-porting.

**Prerequisite:** `@dcl/sdk` **7.26.0+** — the version that ships `ScreenInsetArea` / `InteractableArea` and the per-device default virtual screen. The UI editor is stable and always on in the Creator Hub (0.50.0+): there is no Settings > Experimental toggle and no `settings.guiEditor` key — do not tell users to enable it. Below 7.26.0, entering 2D mode shows an SDK-upgrade notice with an **Update SDK** button instead of the canvas.

## How the editor reads code

The editor has **no saved format of its own**: the scene's real `.tsx` files directly under `src/ui/` *are* the document. It parses them into a node tree, renders that on a canvas, and writes visual edits back as minimal text splices, immediately (the badge reads "All changes saved"; there is no manual save). A 1 s disk watcher reflects external edits, so the file is live while the editor is open. "Editable" is therefore a **checkable property of the code**. Code the parser cannot statically understand degrades silently:

| Degradation | Trigger | Effect |
|---|---|---|
| **Frozen node** | any `uiTransform` / `uiBackground` value, or any `Label`/`Input`/`Dropdown` prop, that is neither a literal nor a bare `state.x` / `props.x` reference | node renders on the canvas, but the panel refuses **every** edit on it |
| **Opaque node** | unknown element name, a spread other than one `useInteraction` const, conditional/logical/`.map()` children, JSX comments | grey read-only block; **its children are not walked**, so the subtree disappears from the canvas |

Write to the contract below and neither happens. Editor facts that shape authored code:

- **Layout is two independent axes.** The panel's **Flow** (row / column / **Free**) writes `flexDirection` only — **Free means the key is absent**, not a "free" value. **Ignore Layout Flow** writes `positionType: 'absolute'`. Roots are always absolute. A child dropped under a Free parent is seeded absolute at the drop point; switching a parent to Free pins every existing child at its measured position in one batched edit.
- **The Full Screen widget preset** inserts `uiTransform={{ flexGrow: 1, alignSelf: 'stretch' }}` with no `width`/`height` (`100%` reads back as a Percent unit rather than Fill, and two `100%` siblings overflow Yoga's free space); under a Free parent it uses `positionType: 'absolute'` with `top/right/bottom/left: 0`. Prefer the same pair for a hand-written full-screen wrapper the editor will edit. The `100%`×`100%` literal form also parses — it is what the generated aggregator root and the in-world-verified templates use.
- **Under the Bevy renderer, opening 2D mode freezes the scene** (resumes on returning to 3D). A driver's clock does not advance while the user lays out UI.

Everything else about the editor UI (Scene Inset dropdown, Opacity naming, canvas tools, mode persistence, the mobile preview's guide areas and their limits): `{baseDir}/references/editor-behavior.md`.

## Setup (editable)

### File layout

```
src/ui/
  index.tsx        <- GENERATED aggregator. Never hand-edit.
  interaction.tsx  <- reserved helper (useInteraction). Verbatim.
  platform.tsx     <- reserved helper (usePlatform). Verbatim.
  MyHud.tsx        <- a top-level UI root (rendered by the aggregator)
  KitToast.tsx     <- a reusable component (marked /** @ui-component */)
src/ui-behaviors.ts  <- driver: outside src/ui/, never parsed by the editor
src/mobile-hud.ts    <- GENERATED by the MobileHUD panel. Editor-owned. Never hand-edit.
```

Steps for a new UI:

1. One component per file, `src/ui/<ComponentName>.tsx`. Basename must be a valid PascalCase identifier **equal to the exported function name** — the editor ignores any other file. Exactly one exported component per file (the editor reads the first exported function that returns JSX). Every file starts with `/** @jsx ReactEcs.createElement */` and imports `ReactEcs` from `@dcl/sdk/react-ecs`. `//` comments only — `{/* JSX comments */}` are opaque.
2. Create `src/ui/interaction.tsx` and (for platform variants) `src/ui/platform.tsx` **verbatim** from `{baseDir}/references/interaction-helper.md`. The lowercase names keep them out of the roots list; the editor scaffolds them itself and never lists them as UIs.
3. Write each component to **The contract**. Start from `{baseDir}/references/component-template.md`.
4. Write `src/ui/index.tsx` in the exact generated shape below and call `setupUi()` from `main()` in `src/index.ts`. (The editor does this wiring itself — it uncomments the template's `//setupUi()` line and adds the import — but when authoring by hand, do it yourself.)
5. Put every clock, easing, timer, formatter and state machine in a `.ts` file **outside** `src/ui/` — see **The driver pattern**.
6. Run the **Self-check list** over every file.

A legacy single-file `src/ui.tsx` is **backed up to `src/ui.tsx.bak` and deleted** the first time the editor opens the scene — always author under `src/ui/`. To port an existing coded UI, follow `{baseDir}/references/adapting-coded-ui.md` (the blockers in order: `.map()` → unroll; conditionals → `active` display gates on the element being hidden; computed styles → driver variables; interpolated text → segment bindings; hand-tracked hover → layers; then explicit boxes everywhere).

The SDK template already includes the JSX settings in `tsconfig.json` — do NOT modify it.

### The aggregator (`src/ui/index.tsx`)

Generated from the list of top-level roots and rewritten whenever the editor opens the scene or a root is added, renamed, removed or re-inset — **any hand edit is lost**. Emit exactly:

```tsx
/** @jsx ReactEcs.createElement */
import ReactEcs, { UiEntity, ReactEcsRenderer, ScreenInsetArea } from '@dcl/sdk/react-ecs'
import { MyHud } from './MyHud'

export function setupUi() {
  ReactEcsRenderer.setUiRenderer(() => (
    <UiEntity uiTransform={{ width: '100%', height: '100%' }}>
      <ScreenInsetArea>
        <MyHud />
      </ScreenInsetArea>
    </UiEntity>
  ))
}
```

Screen inset is a per-root choice (the editor's **Scene Inset** dropdown); `device` is its default. Verified against the Creator Hub's aggregator generator (`UIDesigner/code/aggregator.ts`) and `@dcl/react-ecs` `system.ts`:

| Editor inset | Wrapper in `index.tsx` | Intended for |
|---|---|---|
| `device` (**default**) | `<ScreenInsetArea>` | normal scene UI — constrained to the device safe area (notch, status bar, home indicator, rounded corners); desktop insets are zero |
| `interactable` | `<InteractableArea>` | UI that must also avoid the explorer's own on-screen controls (minimap, chat, left-side controls) |
| `none` | bare `<Component />` | letterbox bars, full-screen backdrops, deliberately drawing where platform UI lives |

Two facts about this generated shape:

- `setUiRenderer` is called with **no options**, so the scene gets the SDK platform default virtual canvas — **desktop `1920x1080`, mobile `1600x720`** — and the renderer-level `screenInset` default `'device'`. Never hand-add `virtualWidth`/`virtualHeight` (regeneration drops them); design px values against those two canvases. This is the one place where the coded-UI rule "always pass the virtual size explicitly" cannot be honored.
- The renderer already wraps the whole UI in its own `ScreenInsetArea` when `screenInset` is omitted, and the aggregator's wrapper **nests inside** it. Absolute positioning is relative to the parent box, so on a phone with non-zero insets a `device` root is inset twice, an `interactable` root gets device + interactable insets, and a `none` root still gets the single renderer-level device inset rather than the full canvas. On desktop the insets are zero, so nothing changes. This follows from reading `wrapWithScreenInset` in `@dcl/react-ecs` and the Creator Hub's `aggregator.ts`; it has not been measured on a device. Do not "fix" it in `index.tsx` (regenerated). If exact safe-area placement on mobile matters, pick `none` for that root and measure.

Both wrapper elements belong **only in `index.tsx`** — inside a component file their names are unknown to the parser and make the subtree opaque.

## Elements

Only five element names are modeled: **`UiEntity`, `Label`, `Input`, `Dropdown`, `Button`** — plus a **reference to another `src/ui/` file** (`<KitToast />`), the sanctioned reuse unit. Any other element name (a local helper component, a library component, `ScreenInsetArea`) is opaque. Full prop tables: `{baseDir}/references/ui-components.md`.

- **`UiEntity`** — container. `uiTransform` (width, height, min/max, positionType, position, display, flexDirection, justifyContent, alignItems, alignContent, alignSelf, flexWrap, flexGrow, overflow, padding, margin, opacity, zIndex, borderWidth/Color/Radius, pointerFilter), `uiBackground` (color, texture, textureMode, textureSlices, uvs, avatarTexture), `uiInputBinding`, and the four listeners `onMouseDown` / `onMouseUp` / `onMouseEnter` / `onMouseLeave`.
- **`Label`** / **`Button`** — the only places text lives: `value`, `fontSize`, `textAlign`, `color`, `font`, `textWrap`; `Button` adds `variant` (`'primary'` | `'secondary'`), `disabled`, `onMouseUp`. A `uiText={{…}}` bag on a `UiEntity` is **not modeled** — restructure it as a `Label` child (coded UI may still use it). `value` accepts simple markup like `<b>`.
- **`Input`** — `placeholder`, `value`, `color`, `placeholderColor`, `disabled`, `textAlign`, `font`, `fontSize`, `onChange`, `onSubmit`. Not a React controlled component — see Gotchas.
- **`Dropdown`** — `acceptEmpty`, `emptyLabel`, `options` (`string[]`), `selectedIndex`, `disabled`, `color`, `textAlign`, `font`, `fontSize`, `onChange(index)`.
- **Component ref** `<KitToast … />` — selectable, movable, per-instance editable props. Cannot be moved or sized from outside: give each instance a wrapper `UiEntity` with explicit `width`/`height` **and** its margin/position. Accepts **no nested JSX children**.

The four listeners are the **complete** set of UI event handlers, each `() => void`: no `onMouseDrag`/`onMouseMove`, no event object, no pointer coordinates, all hardcoded to `InputAction.IA_POINTER`. Drag interactions still work via `PrimaryPointerInfo.screenDelta` — `{baseDir}/references/drag-slider.md`.

## The contract

### State: the binding surface

```ts
export interface State {
  score: number
  label: string
  visible: boolean
  panelWidth: number
  labelColor: { r: number; g: number; b: number; a: number }
  options: string[]
}
export const state: State = {
  score: 0, label: '00.00', visible: false, panelWidth: 320,
  labelColor: { r: 1, g: 1, b: 1, a: 1 }, options: ['A', 'B'],
}
```

Module-level `export interface State` + `export const state: State` is the recognized signature; every property is an editable variable. Types: `number`, `string`, `boolean`, `Color4` (annotate **structurally** as `{ r; g; b; a }` — matched by having `r`/`g`/`b` members, not by the name `Color4`) and `string[]`. A `number[]` (e.g. a `uvs` quad) binds and works but the panel mislabels it as a string list.

- `state` is a plain exported object — that is what lets the driver mutate it.
- Module state is shared by every instance of a file. Per-instance values live in the parent and arrive as props.
- No React hooks (`useState`, `useEffect`) in scene UI; state is module-level. The UI re-renders every frame, so mutations show immediately.

### Style bindings

Any `uiTransform` / `uiBackground` key whose value is a **bare reference** — `state.x` or `props.x`, no operators, calls or concatenation — is an editable binding:

```tsx
uiTransform={{ width: state.panelWidth, position: { top: state.panelTop }, borderColor: state.frameColor }}
uiBackground={{ color: state.panelColor, texture: { src: state.iconSrc } }}
```

Recognized positions: top-level keys, members of the edge groups (`position` / `margin` / `padding` → `{ left: state.x }`), whole groups (`borderColor: state.c`), and the dotted paths `texture.src` / `avatarTexture.userId`. Literal and bound siblings mix freely; nesting is one level deep, as in react-ecs itself. Element props bind the same way: `value={state.label}`, `color={state.labelColor}`, `fontSize={state.size}`, `selectedIndex={state.i}`, `options={state.options}`.

### Mixed text

A template literal whose interpolations are **all bare references** round-trips as ordered literal/binding segments:

```tsx
<Label value={`Score: <b>${state.score}</b>`} … />
<Label value={`${state.mins}:${state.secs}`} … />
<Label value={`env: ${state.realm}\nplayers: ${state.count}`} … />
```

One computed interpolation (`${state.a + 1}`, `${fmt(state.t)}`) freezes the node — format in the driver, interpolate the finished value. (Every real `Label` also carries an explicit `uiTransform` box — see **Sizing and mobile**.)

### Actions (event handlers)

```tsx
type UiAction = { state: State; props: Parameters<typeof MyHud>[0]; value?: unknown }

/** @ui-action */
function openPanel({ state }: UiAction) {
  state.visible = true
}
```

Wire with the canonical thunk `onMouseDown={() => openPanel({ state, props })}`, or `onChange={(value) => setName({ state, props, value })}` for value-bearing events. Recognized: `onMouseDown`, `onMouseUp`, `onMouseEnter`, `onMouseLeave`, and `onChange` / `onSubmit` on `Input` / `Dropdown`. Handler **bodies are free-form code**; an unrecognized handler expression (an inline arrow with a block body) is simply not shown as bound and does not freeze the node. Actions mutate state synchronously — anything time-based is a flag the driver picks up next frame.

### Interaction layers

`useInteraction` is the recognized construct for per-state styling. Layers deep-merge in precedence `base → active → hover → press`; the second argument drives `active` and may be **any expression** (stored verbatim).

```tsx
const panel = useInteraction(
  {
    base: { uiTransform: { display: 'flex', width: 320, height: 200 } },
    active: { uiTransform: { display: 'none' } },
  },
  state.visible !== true,
)
return <UiEntity {...panel}>…</UiEntity>
```

- **Visibility is always an `active` display gate.** Never `{state.visible && <X/>}` (opaque) and never `display: state.visible ? 'flex' : 'none'` (frozen). Elements are hidden, not unmounted — the canvas renders the `base` layer, so all states appear stacked while editing; that is expected.
- **Hover/press feedback is always a `hover` / `press` layer**, never hand-tracked booleans on `onMouseEnter` / `onMouseLeave`.
- `{...someInteractionConst}` is the **only** spread the parser accepts. Extra attributes may sit beside it (`<UiEntity {...panel} onMouseDown={…}>`) and win over it.
- **The spread carries all four pointer listeners unconditionally** — even for a `base` + `active` visibility gate. Put the gate on the panel, the smallest element the decision applies to, never on a full-screen wrapper — see **Pointer blocking**.
- For UI that animates **out**, use two variables: `visible` (intent, flipped by actions) plus `hidden` (render gate, set by the driver only after the exit animation). Gate on `state.hidden === true`.

### Component props

```tsx
/** @ui-component */
export function KitToast(props: { message?: string; fillPx?: number; on?: boolean; onClose?: (value?: unknown) => void }) {
```

- The marker before the exported function makes the file a reusable component (rendered only where another root nests it). Without it, the file is a top-level root the aggregator renders.
- Props are an **inline object type** on the single `props` parameter; supported types `number`, `string`, `boolean`, callback `(value?: unknown) => void`. Anything else shows read-only. Always declare props optional.
- Inside, `props.x` joins the binding surface: style keys, text values, the `active` expression (`props.active === true`).
- No color, texture-set or children prop. A `variant` prop that picks a color is not expressible — unroll every visual variant as siblings gated with `active` display layers (`{baseDir}/references/component-template.md` §6).
- `value={props.label}` fails strict TS (`string | undefined`); use `` value={`${props.label}`} `` — still a recognized binding (renders `undefined` if a parent omits the prop).
- Forward a child's callback up with a one-line action: `/** @ui-action */ function forwardClose({ props }: UiAction) { props.onClose?.() }`.

### Platform variants — the only structural conditional

```tsx
const platform = usePlatform()
return platform === 'mobile' ? <PhoneMenu /> : <DesktopBar />
```

Recognized at the component's `return` and as a JSX child; `!==`, reversed operands and an inline `usePlatform() === 'mobile'` all parse. Both branches must be a single JSX element or the literal `null`, and at least one must be an element. Backed by the reserved `src/ui/platform.tsx`. Use it for genuinely different structure per device (a bottom sheet instead of a side rail); per-property overrides are not modeled — the virtual canvas already scales proportionally.

### What is never expressible

| Not expressible | Substitute |
|---|---|
| loops / `.map()` over data | unroll every element by hand; factor a row repeated more than ~3× into its own `@ui-component` file |
| shared theme constants (`color: THEME.primary`) | inline `{ r, g, b, a }` literals at every site — any identifier in a style object freezes the node; a palette change is a find-and-replace |
| computed style values (arithmetic, `Math.*`, calls, concat, ternaries) | one driver-maintained state variable per derived value |
| percent-string bindings (`width: state.pct + '%'`) | bind a px number; static percent **literals** (`width: '90%'`) are fine |
| conditional element props (`disabled={state.i === -1}`) | a pre-computed boolean state variable |
| local helper components in the same file | a separate `src/ui/` file marked `/** @ui-component */` |
| children/slots on a component | keep the layout inline in the screen file; factor out leaf widgets only |
| a color or texture-set as a prop | unroll the variants inside the component (`texture.src` **can** bind to a string prop; `uvs` cannot) |
| data-driven rows with per-row drafts and closures | not portable — coded UI in its own module outside `src/ui/` |

Nine-slice backgrounds (`textureMode: 'nine-slices'` + `textureSlices`), literal 8-float `uvs` atlas crops, `overflow: 'scroll'` (static rows still scroll), `pointerFilter`, border props and the whole flex model round-trip.

## The driver pattern

The editor never parses files outside `src/ui/`, and `state` is a plain exported object: **the editor owns structure, style and rest values; a driver owns the clock and the math.**

```ts
// src/ui-behaviors.ts — outside src/ui/, invisible to the editor
import { engine } from '@dcl/sdk/ecs'
import { state as panel } from './ui/MyPanel'

const OPEN_WIDTH = 480
let anim = 0

export function registerUiBehaviors() {
  engine.addSystem((dt: number) => {
    const target = panel.visible ? 1 : 0
    anim = Math.max(0, Math.min(1, anim + (target > anim ? dt : -dt) / 0.25))
    const t = 1 - Math.pow(1 - anim, 3) // easeOutCubic
    panel.panelWidth = Math.max(1, Math.round(OPEN_WIDTH * t))
    panel.textColor.a = t
    if (target === 0 && anim <= 0) panel.hidden = true // release the display gate
  })
}
```

Register it from `main()` next to `setupUi()`. Every bound variable's initial value in `state` is its **designable rest state** — capture it at registration and animate around it, so a designer can restyle from the panel without touching the driver. Belongs in the driver: clocks, tweens, easings, timers and auto-hide deadlines (`timers.setTimeout` from `@dcl/sdk/ecs`, never the JS global), `padStart` / rounding / text formatting, state machines, derived values (px from percent, canvas-responsive sizes from `UiCanvasInformation`), drag accumulation, `TouchScreenControls` toggles, anything reading the ECS. The animation itself has no editor representation — the editor sees a bound key and its rest value only. Full examples: `{baseDir}/references/driver-pattern.md`.

## Common widgets

Build every widget from the primitives — there is no widget library. Editable templates first; coded fallbacks in `{baseDir}/references/coded-ui.md`.

| Ask | Editable pattern |
|---|---|
| Dialog / prompt / confirmation | full-screen positioning wrapper + gated panel + buttons: `{baseDir}/references/component-template.md` §4 (add a second button for accept/reject) |
| Toast / notification / popup | `KitToast` component (§2) with `visible` prop; auto-hide is a driver countdown (`driver-pattern.md`, `*AutoHide`) |
| Timed announcement / flash message | a gated panel with one `Label`; the driver decrements `hideIn` and flips `visible` |
| Score / counter / timer readout | mixed-text `Label` (§3); the driver formats the string (`driver-pattern.md` §2) |
| Health / progress / fill bar | `KitProgressBar` (§5): the driver writes `fillPx` from a percent against the literal track width |
| Menu / button with hover | `hover` / `press` layers (§3) |
| Settings form (`Input` / `Dropdown`) | `@ui-action` with `value` |
| Slider / scrub bar / drag handle | `{baseDir}/references/drag-slider.md` (tap-to-step zones + drag, gated release catcher) |
| Full-screen modal that pauses play | gated panel + driver toggling `TouchScreenControls` (see **Placement**) |
| Inventory grid / list of unknown length | coded — `coded-ui.md` |

## Sizing and mobile

**Every box is explicit.** Text intrinsic sizing and auto-sizing from children are unreliable across the three surfaces that render this code:

| Surface | Unset `Label` dimension / auto-sized parent |
|---|---|
| Bevy explorer | measures rendered text and feeds it into flex layout — looks correct |
| Unity explorer | contributes ~0 to layout; glyphs still draw on the zero-height node → stacked labels **overlap**, parents **collapse** to padding |
| Creator Hub canvas | a component root or ref wrapper with an unset dimension renders as **0** (collapsed instance, panel reads height 0) even though Yoga lays it out at runtime |

Verified in-world with side-by-side screenshots: a 720-px dialog whose two labels had `width: '100%'`, `textWrap="wrap"` and no `height`, in a panel with no `height`, was correct on Bevy and squashed on Unity — both labels drawn over each other, the panel collapsed to padding + button. Fix: panel `height: 210`, name label `height: 30`, wrapped body label `height: 60`, button label `100%`/`100%`. A correct preview on one surface proves nothing about the others. Rules:

- The root of every `/** @ui-component */` file declares `width` AND `height` (px numbers or percent literals). So does every wrapper `UiEntity` around a component ref, matching the component's root size — a wrapper carrying only `margin` / `position` collapses identically.
- Every `Label` (and `Button` text) declares a `uiTransform` `width` AND `height`; every container that stacks labels has an explicit height. Wrapped text: height = line count × line height (two lines at `fontSize: 20` → 60). A label filling a fixed parent uses `100%` / `100%`.
- Every **bound** size or position is a plain px `number` — no arithmetic, no percent strings. Static percent literals in unbound keys are the right tool for fluid layout.
- Design against **desktop `1920x1080` and mobile `1600x720`**. The mobile canvas is 33% shorter: anchor to edges and use flex/percent for the fluid axis rather than absolute offsets computed for one height. Do **not** apply the old "scale sizes ~3× for mobile" rule on 7.26.0+ — pixel UI is already ~2–3× larger on a phone (`devicePixelRatio` left the scale factor) and the mobile canvas adds ~1.2×; start from desktop sizes and scale up only what measures small on a device.
- Touch targets ≥ ~48 px on the virtual canvas; body text `fontSize` ≥ 16, ≥ 20 for anything read while moving; `textWrap="wrap"` plus an explicit width on any label that can grow.
- **No emoji or decorative Unicode in any text value** (`Label` / `Button` `value`, `uiText.value`, `Input` `placeholder`, `Dropdown` options, bound strings). Glyph coverage comes from the fonts each explorer bundles, not the SDK, and the Unity explorer ships no emoji glyphs — verified in-world: `value="✨ Particles"` lost its sparkle. Use a small `UiEntity` with `uiBackground={{ texture: { src: 'images/icon.png' } }}` beside the label, or an atlas sprite via `uvs`; `texture.src` is a binding, so the icon stays editable. Stick to ASCII plus the accented letters the copy needs.
- Texture `src` paths are relative to the scene root (`'images/panel.png'`), not `src/`.
- `borderRadius` is unsupported on mobile. Hover layers do nothing on touch — never the only affordance or the only way to read a value.

## Placement: never anchor to the top-left; keep mobile UI off the action buttons

The most common layout mistake in generated scenes is a panel pinned to the top-left (`position: { top: 0, left: 0 }`, or a full-canvas root whose children flow from the origin). That corner — and the whole left edge on desktop — is where the explorer draws **its own** UI (minimap, chat, and on mobile the virtual joystick). Scene UI there renders *underneath* the client HUD: occluded, buttons frequently unclickable, and nothing warns. In order of preference:

1. **Small HUD (score, timer, a couple of buttons)** → anchor to the **right** edge or **center** it: `positionType: 'absolute', position: { top: 40, right: 40 }`, or `justifyContent: 'center'` on the root. Never leave a panel at the origin; no `left: 0` without an interactable inset.
2. **Needs a reliable safe area** → the `interactable` inset (editable: the root's Scene Inset; coded: `screenInset: 'interactable'` on the renderer, 7.26.0+, below that wrap in `<InteractableArea>`). It excludes the minimap, chat and left-side controls, so `left: 0` inside it is safe on desktop. It excludes the **left column only** — it shares its right edge with the device area, so the bottom-right action cluster sits *inside* it by design.
3. **Mobile: the bottom-right action buttons (jump, E, F, pointer) are drawn on top of the interactable area**, and taps there go to the client. A **gameplay HUD** stays clear: anchor top-right / top-center, no interactive element bottom-right on mobile (read `UiCanvasInformation.interactableArea` for exact margins; the button slots are fixed). **UI that interrupts gameplay** (scoreboard, results, shop, rules card) hides the touch controls while open — `TouchScreenControls.hideAll()` + `hideJoystick()` on open, `showAll()` + `showJoystick()` on close (no-ops on desktop; `showAll()` also clears custom icons — re-apply them), optionally `InputModifier` `disableAll` on `engine.PlayerEntity` for the same span (desktop client only). Route **every** close path through the same function so controls are never left hidden. Editable: the driver does this when `state.visible` flips; coded pattern: `{baseDir}/references/coded-ui.md` → Full-screen modal. In a scene that uses the UI Designer's MobileHUD panel, that runtime toggle fights the panel's static call — see **MobileHUD**.

Content rule for any panel that explains the game: one screen, no scrolling, 3–5 short lines, show (icon, diagram, highlighted first target) rather than tell — **game-design** skill → "Rules: show, don't tell".

## Pointer blocking

**A UI element with any listener — or `pointerFilter: 'block'` — captures pointer input over its WHOLE rect**, not just its visible pixels, blocking clicks to the 3D world and every UI element behind it. A transparent background changes nothing. An element with no listeners and the default `pointerFilter: 'none'` lets clicks through.

**NEVER put a handler, a `{...useInteraction}` spread, or `pointerFilter: 'block'` on a `100%`×`100%` wrapper.** Its rect is the whole screen, so one stray listener on the layout root makes the player unable to click any other UI element or anything in the world — while the UI still *looks* correct because the visible panel is small. The spread counts because `useInteraction` always returns all four listeners, including when used only as a visibility gate. Attach handlers and gates to the smallest element that needs them (panel, button, row); layout wrappers stay plain literal-styled `UiEntity`s doing positioning only. Check this every time you add a handler. Before/after: `{baseDir}/references/component-template.md` §4.

Two blocking full-screen overlays are legitimate, and both must be a deliberate, gated decision rather than a side effect: a **modal backdrop** meant to swallow clicks while open, and a **drag-release catcher** shown only while a drag runs (`{baseDir}/references/drag-slider.md`). In editable UI the gate is an `active` `display: 'none'` layer; in coded UI, conditional rendering.

## MobileHUD (`src/mobile-hud.ts`) — editor-owned, do not hand-write

Creator Hub 0.50.0+. **MobileHUD** is a fixed first entry in the UI Designer's GUIs rail (once the scene has at least one GUI). It edits the scene's `TouchScreenControls` — the native mobile joystick, crosshair and gamepad buttons — with a read-only canvas preview. It is **not** a react-ecs root: it is a single `TouchScreenControls.createOrReplace(engine.RootEntity, { … })` call written to `src/mobile-hud.ts` (outside `src/ui/`, so the root scanner never treats it as a GUI), exported as `setupMobileHud` and imported in `src/index.ts` next to `setupUi()`.

- **Never hand-write or edit `src/mobile-hud.ts`.** The panel regenerates it from its own parse of that exact format; code it cannot parse is silently reduced to defaults.
- **Never write a second `TouchScreenControls.createOrReplace` anywhere else** in such a scene — one component on `engine.RootEntity`, last write wins.
- The file is written lazily and deleted automatically: it exists only while the config deviates from SDK defaults. A scene with no file is on stock behaviour.
- To change the mobile HUD in a UI-Designer scene, change it in the panel. Genuine *runtime* control (hide buttons during a cutscene or a modal) goes in a driver outside `src/ui/`, accepting that it fights the panel's static call — **advanced-input** has the component API.

What the panel exposes and the protobuf caveat: `{baseDir}/references/editor-behavior.md` → MobileHUD.

## Coded UI (corner cases)

When **Choosing the mode** sends a UI to coded, everything above about elements, sizing, placement and pointer blocking still applies. What changes:

- Any file layout works (`src/ui.tsx` single file, or a module outside `src/ui/` beside editable roots). Conditional rendering, `.map()`, helper components, `uiText` bags, computed styles and theme constants are all fine.
- **Always pass `{ virtualWidth: 1920, virtualHeight: 1080 }`** to `setUiRenderer` / `addUiRenderer`. It pins the reference resolution and is identical on both sides of the **7.26.0 version gate** (below it, omitting the size disables scaling; on 7.26.0+ a 16:9 size is overridden to `1600x720` on mobile anyway). Never emit a single dimension. `screenInset` and the renderer `zIndex` option (7.29.0+) are not version-safe.
- Root `<UiEntity>` sets `width: '100%', height: '100%'` (required for reliable absolute positioning) and stays pointer-transparent.
- Only one `setUiRenderer` per scene — a second call silently overwrites the first. Independent modules use `addUiRenderer(ownerEntity, Widget, options)`, removed with `removeUiRenderer(owner)` or automatically when the owner entity is destroyed; this is also how a coded panel coexists with an editable `src/ui/`, whose aggregator owns `setUiRenderer`.

Virtual-screen and version-gate tables, hybrid scenes, module-level state with conditional rendering, and the from-scratch widget patterns: `{baseDir}/references/coded-ui.md`.

## Gotchas (verified against engine test scenes)

- **`Input` and `Dropdown` are not React controlled components.** `onChange` / `onSubmit` fire with the current value, but the field does not re-read `value` / `selectedIndex` every frame. To clear an `Input`, set `value` to a non-empty sentinel (`' '`) for one frame, then `''`. Trust your scene state, never the rendered field: a controlled `Input` does not follow a programmatic reset (open client issue), and re-writing the same string afterwards fires no `onChange`. `onSubmit` (Enter) commits and clears the field, and the client emits `onSubmit` *then* `onChange`. Removing a focused `Input` inside its own handler is safe. `Dropdown` `onChange` receives the **index**; with `acceptEmpty` the empty entry is index-shifted. Details: `{baseDir}/references/ui-components.md` → Input.
- **`Button` `disabled`** halves text/background alpha and drops `onMouseDown` / `onMouseUp` only — `onMouseEnter` / `onMouseLeave` still fire.
- **`zIndex` is per-sibling-group** — it does not lift an element above a different branch. Use tree order (or array return in coded UI) for cross-branch stacking, and the renderer `zIndex` *option* to stack whole renderers (`ui-components.md` → Renderer zIndex; the Admin Tools smart item sits at 1000).
- **`opacity` multiplies down the tree.** A child at 0.8 inside a root at 0.5 renders at 0.4.
- **`textureMode: 'stretch'` deforms non-uniform art**; use `'nine-slices'` + `textureSlices` for panels/buttons, `'center'` for native size. `color` beside `texture` tints it. ⚠️ **Nine-slice is still unimplemented on mobile** (no ETA as of Oct 2026): the mobile client **tiles** the texture instead of stretching the center, so a nine-sliced panel that looks right on desktop shows a repeating pattern on a phone. For panels in mobile-targeting scenes, prefer a solid `color` background, or art authored so that tiling still reads.
- **Insets do not clip.** `ScreenInsetArea` / `InteractableArea` set no `overflow`, so content positioned past the inset renders into the reserved zone. Overflow past the safe-area outline is a placement bug to fix, not something to hide with `overflow: 'hidden'`.
- **Hand-placed `ScreenInsetArea` / `InteractableArea` on 7.26.0+ stack on the renderer's own `screenInset`** (default `'device'`) — pass `screenInset: 'none'` when you place the wrapper yourself. Below 7.26.0 the wrapper is the only mechanism. The generated aggregator is the exception you cannot change (see **The aggregator**).
- **`UiCanvasInformation.width` / `height` are raw canvas pixels**, not virtual units — inputs for decisions (which layout, which texture), not for computing sizes.

## Troubleshooting

Work through the wiring causes first — they are the cause by a wide margin.

| Problem | Cause | Solution |
|---|---|---|
| UI not rendering / nothing on screen (most common) | `setupUi()` not called from `main()` in `src/index.ts` | Add the call. Always check this first |
| UI not rendering even though `setupUi()` is called | `ReactEcsRenderer.setUiRenderer(...)` missing from `setupUi()` | Restore the aggregator shape (editable) or the canonical call (coded) |
| UI blank on first frames, appears later | root component returns `null` / falsy on first render | Render a placeholder or a gated root instead |
| Multiple UIs fighting / UI missing | more than one `setUiRenderer` — the last silently wins | One `setUiRenderer`; extra modules via `addUiRenderer` with their own owner entities |
| Absolute-positioned children laid out unexpectedly | root `<UiEntity>` lacks `width: '100%', height: '100%'` | Add it (empirically required — a `top-right` child vanished without it) |
| UI elements overlapping | missing `flexDirection`, or labels with no box | `flexDirection: 'column'` on the parent; explicit `Label` boxes |
| Buttons in the top-left / along the left edge visible but not clickable, or partly hidden | scene UI sits under the explorer's HUD (minimap, chat, mobile joystick), which takes the clicks | Anchor right or center, or use the `interactable` inset — see **Placement** |
| Mobile: taps on the lower-right of a large panel do nothing / trigger jump or E | the native action buttons are drawn over the interactable area | Keep interactive elements out of the bottom-right, or hide the touch controls while a full-screen UI is open |
| Button clicks not registering | missing `onMouseDown` | Add it to the `Button` / `UiEntity` (a `@ui-action` thunk in editable UI) |
| **Nothing on screen is clickable any more** | a `100%`×`100%` wrapper carries a listener, a `useInteraction` spread, or `pointerFilter: 'block'` | Strip them from the wrapper; move gates/handlers onto the panel/button |
| Looks right on one explorer, labels overlap / panel squashed on Unity | `Label`s with no explicit box, container auto-sizing from text | Explicit `width` / `height` on every label and every label-stacking container |
| Part of a string missing or shows as □ | emoji / decorative Unicode | Remove it; use a texture icon |
| JSX errors at compile time | file is `.ts` not `.tsx` | Rename |
| Text not visible | color matches background | Contrasting `color` |
| Component looks collapsed / height 0 on the editor canvas, fine in-world | component root or ref wrapper without explicit `width` / `height` | Declare both |
| Panel refuses every edit on a node (frozen) | a computed value, identifier or call in `uiTransform` / `uiBackground` / `Label` props | Literal or bare `state.x` / `props.x`; move the math to the driver |
| Subtree missing from the canvas (opaque) | `{cond && …}`, ternary, `.map()`, JSX comment, unknown element, non-`useInteraction` spread | Substitute per **What is never expressible** |
| Editor shows "UI Editor Unavailable" | `@dcl/sdk` below 7.26.0 | Update the scene's SDK |
| Drag slider jitters / wrong speed | value read through a stale closure, or `TRACK_PX` / scale-factor mismatch | `{baseDir}/references/drag-slider.md` |

## Self-check list

Run over **every** `.tsx` under `src/ui/` you write or adapt. Each item is a silent editor failure if violated.

1. File is `src/ui/<PascalCaseName>.tsx`, basename equals the exported component name, first line is `/** @jsx ReactEcs.createElement */`, exactly one exported component.
2. Every JSX element name is `UiEntity`, `Label`, `Input`, `Dropdown`, `Button`, or a component exported by another `src/ui/` file.
3. No `{cond && <X/>}`, no `cond ? <A/> : <B/>` — except a `usePlatform()` variant whose branches are each a single element or `null`.
4. No `.map()`, loops, or array-built children.
5. No `{/* JSX comments */}`; comments are `//` outside JSX.
6. Every value inside `uiTransform` / `uiBackground` is a literal or a bare `state.x` / `props.x`. Grep those objects for `?`, `+`, `*`, `Math.`, `(` and bare identifiers — each is a frozen node.
7. All text is on `Label` / `Button` `value`; no `uiText` bag on a `UiEntity`.
8. Every template literal in a prop interpolates only bare references.
9. The only spread on any element is a single `{...someUseInteractionConst}`.
10. Visibility is a `useInteraction` `active` layer setting `display: 'none'`; hover/press are `hover` / `press` layers.
11. **No pointer handler, no `{...useInteraction}` spread, no `pointerFilter: 'block'` on any `100%`×`100%` element** (or any unsized element that fills the screen). Sole exceptions, both gated off when idle: a modal backdrop and a drag-release catcher.
12. `export interface State` + `export const state: State` present; every property is `number`, `string`, `boolean`, `string[]`, or a structural `{ r, g, b, a }` color.
13. Declared props are an inline object type of optional `number` / `string` / `boolean` / callback members only.
14. Every handler is a `/** @ui-action */` function taking `({ state, props, value }: UiAction)`, wired through a thunk.
15. All bound sizes/positions are px numbers; no percent strings in bound values.
16. The component root declares both `width` and `height` (px or percent literals), and so does every wrapper `UiEntity` around a component ref, matching that component's root size.
17. No clock, `Date.now()`, `setTimeout`, easing, rounding or string formatting anywhere in `src/ui/` — it lives in the driver.
18. `src/ui/index.tsx` matches the generated shape exactly, each root wrapped in `ScreenInsetArea` unless full-canvas control was explicitly requested.
19. Mobile pass: layout survives a `1600x720` canvas, touch targets ≥ ~48 px, no hover-only affordances, no emoji, nothing anchored top-left, nothing interactive bottom-right.
20. No `TouchScreenControls` call anywhere you wrote in a UI-Designer scene — mobile controls are the MobileHUD panel's, via `src/mobile-hud.ts`. Grep the scene and confirm the only hit is that generated file.

## References

- `{baseDir}/references/component-template.md` — the editor's seed file, a minimal component, a fully-featured one (bindings, mixed text, hover, two-variable exit gate), the dialog before/after, a props-driven fill bar, unrolled variants, the composed screen, the aggregator.
- `{baseDir}/references/interaction-helper.md` — verbatim `src/ui/interaction.tsx` and `src/ui/platform.tsx`, plus the usage shapes the parser recognizes.
- `{baseDir}/references/driver-pattern.md` — eased open/close, formatted timer, two-variable exit gate, action→driver handshake, derived values, naming-convention drivers.
- `{baseDir}/references/adapting-coded-ui.md` — before/after recipes for porting a coded UI, and what to tell the user cannot be ported.
- `{baseDir}/references/drag-slider.md` — why sliders need `PrimaryPointerInfo.screenDelta`, the in-world-verified editable slider (tap-to-step + drag, gated release catcher, driver), the coded variant, the SDK-version-dependent scale factor.
- `{baseDir}/references/editor-behavior.md` — what the Creator Hub UI editor writes and shows: layout axes, widget presets, Scene Inset, canvas tools, mode persistence, the mobile preview and its limits, the MobileHUD panel's fields.
- `{baseDir}/references/ui-components.md` — full prop reference for the five elements, `uiInputBinding`, backgrounds (texture modes, nine-slices, UVs, tint, avatar), element and renderer `zIndex`, `screenInset` / `ScreenInsetArea` / `InteractableArea`, `UiCanvasInformation`, and the engine test scenes that are ground truth.
- `{baseDir}/references/coded-ui.md` — the free-form path: virtual-screen default rule and the 7.26.0 version gate, `addUiRenderer` and hybrid scenes, module-level state with conditional rendering, the from-scratch widget patterns, and each pattern's editable equivalent.
- `{baseDir}/references/custom-fonts.md` — `fontSrc` (scene-supplied TTF for `UiText` / `UiInput` / `UiDropdown` / `TextShape`): **protocol-merged but in no published SDK as of 2026-10-08, do not emit it.** Field numbers, the fallback matrix (OTF / missing / invalid / external URL all degrade to the built-in font), the asset-bundle requirement, and the QA scene.

## Cross-references

- **Platform detection**: `getPlatform()` / `isMobile()` from `@dcl/sdk/platform` (wrapped by `usePlatform()` in editable UI). See **advanced-input**.
- **Localized UI text**: `getPlayerLanguage()` (same module) returns the player's client language as a BCP-47 tag, with `onPlayerLanguageChanged` for mid-session switches. It returns `'en'` until the explorer answers, so read it in a system (the driver), not at module scope. See **advanced-input** > "Player language". [UNRELEASED — ships in the `@dcl/sdk` release after 7.29.0.]
- **Sending the player to a client panel**: `openExplorerUi` opens the map / backpack / places / events panels, and `openExplorerUiAndWait` (`@dcl/sdk/explorer-ui`) resolves when the player closes it. Requires a user gesture. See **scene-runtime** > `references/explorer-ui.md`.
- **Replacing the native mobile controls**: `TouchScreenControls` (SDK 7.26.0+, **advanced-input**) hides the joystick / crosshair / gamepad buttons so scene UI can take their place, with `uiInputBinding` wiring replacement buttons to InputActions. In a UI-Designer scene that config belongs to the MobileHUD panel. The client's own HUD (chat, profile, emote wheel) cannot be hidden.
- **Rules / instructions content**: **game-design** ("Rules: show, don't tell") lists the text-heavy pop-up and unreadable in-world rulebook anti-patterns.
- **Editing the open scene live** (entities, smart items, settings): **creator-hub-mcp**.
