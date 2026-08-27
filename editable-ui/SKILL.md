---
name: editable-ui
description: Write React-ECS scene UI that the Creator Hub's 2D UI editor (UI Designer) can fully read and edit — file layout, the state/props binding surface, useInteraction style layers, actions, platform variants, and the driver pattern for animation. Use when the user wants UI that is editable in the Creator Hub, wants to generate UI for the UI Designer, or wants to adapt an existing coded UI so it opens in the editor. For coded UI with no editor requirement, use build-ui.
---

# Editable UI (Creator Hub UI Designer)

The Creator Hub UI editor has **no saved format of its own**: the scene's real `@dcl/react-ecs` `.tsx` files under `src/ui/` *are* the document. The editor parses them into a node tree, renders that on a canvas, and writes visual edits back as minimal text splices. A 1s disk watcher reflects external edits back onto the canvas.

Consequence: **"editable in the editor" is a checkable property of the code**, not a style preference. Code the parser cannot statically understand degrades in one of two ways:

| Degradation | Trigger | Effect |
|---|---|---|
| **Frozen node** (`dynamicProps`) | any `uiTransform` / `uiBackground` value, or any `Label`/`Input`/`Dropdown` prop, that is neither a literal nor a bare reference | node still renders on the canvas, but the panel refuses **every** edit on it |
| **Opaque node** | unknown element name, spread props, conditional/logical/`.map()` children, JSX comments | grey read-only block; **its children are not walked**, so the whole subtree disappears from the canvas |

Both are silent. Write to the contract below and neither happens.

Prerequisite knowledge: the **build-ui** skill (React-ECS elements, `uiTransform`/`uiBackground`, flex layout). This skill only covers what makes that code editor-editable.

[EXPERIMENTAL] The UI editor is opt-in: the user enables **Settings > Experimental > UI Editor** in the Creator Hub, and the scene must be on `@dcl/sdk` **7.26.0+** (the version that ships `ScreenInsetArea` / `InteractableArea` and the per-device default virtual screen). The 2D/3D mode switch is hidden otherwise. Code written to this contract is ordinary React-ECS and runs anywhere regardless.

## Two workflows

### A. Generate a new editable UI

1. One component per file: `src/ui/<ComponentName>.tsx`. Basename must be a valid PascalCase identifier **equal to the exported function name** — the editor ignores any file whose basename is not already in that form.
2. Create `src/ui/interaction.tsx` and (if you use platform variants) `src/ui/platform.tsx` verbatim from `{baseDir}/references/interaction-helper.md`. These are the two reserved helper filenames; the editor scaffolds them itself and never lists them as UIs.
3. Write each component to the contract in **The contract** below. Start from `{baseDir}/references/component-template.md`.
4. Write `src/ui/index.tsx` in the exact generated shape (see **The aggregator**), and call `setupUi()` from `main()` in `src/index.ts`.
5. Put every clock, easing, timer, formatter and state machine in a plain `.ts` file **outside** `src/ui/` — see **The driver pattern**.
6. Run the self-check list at the bottom of this file over every file you produced.

### B. Adapt an existing coded UI

1. Split the UI into one file per component under `src/ui/`; move any non-JSX logic (helpers, clocks, math, data) out to a `.ts` file outside `src/ui/`.
2. Mechanically eliminate the five blockers, in this order — see `{baseDir}/references/adapting-coded-ui.md` for before/after code on each:
   - `.map()` / loops → unroll every item as sibling elements.
   - `{cond && <X/>}` and `cond ? <A/> : <B/>` → `useInteraction` `active` layer with `display: 'none'` (the only exception: the desktop/mobile platform variant, which is a supported construct).
   - computed style values (arithmetic, `Math.*`, calls, string concat, ternaries, shared theme identifiers) → one driver-maintained bound state variable per derived value, or an inline literal.
   - inline-interpolated text → mixed-text segment bindings, with the formatting moved into the driver.
   - hand-tracked hover/press booleans → `hover` / `press` layers.
3. Replace tween/animation code that computes style values in render with a driver that eases the finished value into a bound state variable.
4. Every size and position value becomes a plain px **number** (see **Sizing and mobile**).
5. Re-run the self-check list.

Expect the adapted file to be **larger** than the original: unrolling loops and variants is the price of editability. Report that trade-off to the user rather than silently half-porting.

## File layout

```
src/ui/
  index.tsx        <- GENERATED aggregator. Never hand-edit.
  interaction.tsx  <- reserved helper (useInteraction). Verbatim.
  platform.tsx     <- reserved helper (usePlatform). Verbatim.
  MyScreen.tsx     <- a top-level UI (rendered by the aggregator)
  MyWidget.tsx     <- a reusable component (marked /** @ui-component */)
src/ui-behaviors.ts  <- driver: outside src/ui/, never parsed by the editor
```

- A legacy single-file `src/ui.tsx` is **backed up to `src/ui.tsx.bak` and deleted** the first time the editor opens the scene. Always author under `src/ui/`.
- Every file starts with `/** @jsx ReactEcs.createElement */` and imports `ReactEcs` from `@dcl/sdk/react-ecs`.
- Exactly one exported component per file (the editor reads the first exported function that returns JSX).
- Use `//` comments only. `{/* JSX comments */}` parse as opaque expression children.

## The aggregator (`src/ui/index.tsx`)

Generated from the list of top-level roots. It is rewritten whenever the editor opens the scene and whenever a root file is added, renamed, removed or re-inset — so **any hand edit to it is lost**. Emit it in exactly this shape:

```tsx
/** @jsx ReactEcs.createElement */
import ReactEcs, { UiEntity, ReactEcsRenderer, ScreenInsetArea } from '@dcl/sdk/react-ecs'
import { MyScreen } from './MyScreen'

export function setupUi() {
  ReactEcsRenderer.setUiRenderer(() => (
    <UiEntity uiTransform={{ width: '100%', height: '100%' }}>
      <ScreenInsetArea>
        <MyScreen />
      </ScreenInsetArea>
    </UiEntity>
  ))
}
```

**Screen inset is a per-root choice, and `device` is the default.** Verified against `@dcl/react-ecs` 7.27.0 (`components/ScreenInsetArea`, `components/InteractableArea`):

| Inset | Wrapper element | Use for |
|---|---|---|
| `device` (**default**) | `<ScreenInsetArea>` | all normal scene UI — constrains children to the device safe area (notch, status bar, home indicator, rounded corners); desktop insets are typically zero |
| `interactable` | `<InteractableArea>` | UI that must also avoid the explorer's own on-screen controls |
| `none` | none — bare `<Component />` | only when true full-canvas control is needed: letterbox bars, full-screen backdrops, or deliberately drawing where platform UI lives |

`ScreenInsetArea` owns its own `positionType`/`position`; a child sized `100%`×`100%` fills the safe area exactly. Both wrappers belong **only in `index.tsx`** — inside a component file their element names are unknown to the parser and would make the subtree opaque.

`setUiRenderer` is generated with **no options object**, so the scene gets the SDK platform default virtual canvas (desktop `1920x1080`, mobile `1600x720`). Do not hand-add `virtualWidth`/`virtualHeight` here — the next regeneration drops them. This is the one place where build-ui's "always pass the virtual size explicitly" rule cannot be honored; design px values against those two canvases instead.

The editor also ensures `main()` calls `setupUi()` (it uncomments the template's `//setupUi()` line and adds the import). When authoring by hand, wire it yourself.

## The contract

### Elements

Only these five element names are modeled: **`UiEntity`, `Label`, `Input`, `Dropdown`, `Button`**.

The one additional first-class element is a **reference to another root file** in `src/ui/` — `<MyWidget />`. That is the sanctioned reuse unit: selectable, movable, with per-instance editable props. Any other element name (a local helper component, a library component, `ScreenInsetArea`) is opaque.

- Text lives on `Label` / `Button` only: `value`, `fontSize`, `textAlign`, `color`, `font`, `textWrap`. A `uiText={{...}}` bag on a `UiEntity` is **not modeled** — restructure it as a `Label` child.
- `Input` props: `placeholder`, `value`, `color`, `placeholderColor`, `disabled`, `textAlign`, `font`, `fontSize`.
- `Dropdown` props: `acceptEmpty`, `emptyLabel`, `options`, `selectedIndex`, `disabled`, `color`, `textAlign`, `font`, `fontSize`.
- A `<MyWidget />` instance cannot be moved or sized from outside — give each instance a wrapper `UiEntity` when it needs margins or positioning.
- Component refs accept **no nested JSX children** — there is no slot/`children` mechanism, so a generic `<Card>` wrapper is not expressible.

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
  score: 0,
  label: '00.00',
  visible: false,
  panelWidth: 320,
  labelColor: { r: 1, g: 1, b: 1, a: 1 },
  options: ['A', 'B'],
}
```

Module-level `export interface State` + `export const state: State` is the recognized signature; every property is an editable variable. Supported types: `number`, `string`, `boolean`, `Color4` (annotate **structurally** as `{ r: number; g: number; b: number; a: number }` — the annotation is matched by having `r`/`g`/`b` members, not by the name `Color4`), and `string[]`.

- `state` is a plain exported module object — that is exactly what lets the driver mutate it (see below).
- Module state is shared by every instance of a file. Per-instance values must live in the parent and arrive as props (React's controlled-component pattern).
- A `number[]` variable (e.g. a `uvs` quad) binds and works, but the panel infers `string[]` from the initializer and mislabels it as an options list. Usable; just a wrong label.

### Style bindings

Any `uiTransform` / `uiBackground` key whose value is a **bare reference** — `state.x` or `props.x`, with no operators, calls, or concatenation — is a first-class editable **binding**, not a freeze:

```tsx
uiTransform={{ width: state.panelWidth, position: { top: state.panelTop }, borderColor: state.frameColor }}
uiBackground={{ color: state.panelColor, texture: { src: state.iconSrc } }}
```

Recognized binding positions: top-level keys (`width`, `height`, `zIndex`, `color`, `uvs`, …), members of the nested edge groups (`position`/`margin`/`padding` → `{ left: state.x }`), whole groups written at once (`borderColor: state.c`), and the dotted paths `texture.src` / `avatarTexture.userId`. Literal and bound siblings mix freely in one object. Nesting is one level deep — exactly react-ecs's own shape.

Text and element props bind the same way: `value={state.label}`, `color={state.labelColor}`, `fontSize={state.size}`, `selectedIndex={state.i}`, `options={state.options}`.

### Mixed text (the counter/timer/readout workhorse)

A template literal whose interpolations are **all bare references** round-trips as ordered literal/binding segments and stays fully editable:

```tsx
<Label value={`Score: <b>${state.score}</b>`} />
<Label value={`${state.mins}:${state.secs}`} />
<Label value={`env: ${state.realm}\nplayers: ${state.count}`} />
```

Multi-line `\n` literals are fine. One computed interpolation (`${state.a + 1}`, `${fmt(state.t)}`) breaks the whole attribute and freezes the node — do the formatting in the driver and interpolate the finished value.

### Actions (event handlers)

```tsx
type UiAction = { state: State; props: Parameters<typeof MyScreen>[0]; value?: unknown }

/** @ui-action */
function openPanel({ state }: UiAction) {
  state.visible = true
}
```

Wire with the canonical thunk: `onMouseDown={() => openPanel({ state, props })}`, or for value-bearing events `onChange={(value) => setName({ state, props, value })}`. Recognized events: `onMouseDown`, `onMouseUp`, `onMouseEnter`, `onMouseLeave`, and `onChange`/`onSubmit` on `Input`/`Dropdown`.

- Handler **bodies are free-form code** — any logic is allowed there. They are never parsed as styles.
- An unrecognized handler expression (an inline arrow with a block body) is simply not shown as bound; it does **not** freeze the node.
- Actions mutate state synchronously. Anything time-based belongs in the driver — an action sets a flag, the driver animates.

### Interaction layers: hover, press, and visibility

`useInteraction` is the recognized construct for per-state styling. Layers are deep-merged in precedence order `base → active → hover → press`; the second argument drives the `active` layer and may be **any expression** (stored verbatim).

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

Rules:

- **Visibility is always an `active` display gate.** Never `{state.visible && <X/>}` (opaque) and never `display: state.visible ? 'flex' : 'none'` (frozen).
- **Hover/press feedback is always a `hover`/`press` layer.** Never hand-tracked booleans with `onMouseEnter`/`onMouseLeave`.
- `{...someInteractionConst}` is the **only** spread the parser accepts. Any other spread makes the node opaque. Extra attributes may sit alongside the spread (`<UiEntity {...panel} onMouseDown={…}>`).
- Elements are hidden, not unmounted — everything is present in the tree at all times, and the canvas renders the `base` layer, so all states appear stacked while editing. That is expected.
- For UI that animates **out** before disappearing, use the two-variable pattern: `visible` (intent, flipped by actions) plus `hidden` (render gate, cleared by the driver only after the exit animation finishes). Gate on `state.hidden === true`.

### Component props

```tsx
/** @ui-component */
export function MyWidget(props: { label?: string; fillPx?: number; on?: boolean; onPress?: (value?: unknown) => void }) {
```

- `/** @ui-component */` before the exported function marks the file as a reusable component (rendered only where another root nests it). Without the marker the file is a top-level root and the aggregator renders it.
- Declared props are an **inline object type** on the single `props` parameter. Supported types: `number`, `string`, `boolean`, and callback (`(value?: unknown) => void`). Anything else shows read-only. Always declare props optional.
- Inside the component, `props.x` joins the binding surface: style keys, text values, and the `useInteraction` active expression (`props.active === true`) can all reference it.
- There is **no** color, texture-array, or children prop. A `variant` prop that picks a color is not expressible — unroll every visual variant as siblings inside the component and gate them with `active` display layers.
- `value={props.label}` fails strict TS (`string | undefined`). Use `` value={`${props.label}`} `` — it typechecks and is still a recognized binding (it renders the text `undefined` if a parent omits the prop).
- Forward a child's callback up with a one-line action: `/** @ui-action */ function forwardClose({ props }: UiAction) { props.onClose?.() }`.

### Platform variants — the only structural conditional

```tsx
const platform = usePlatform()
return platform === 'mobile' ? <PhoneMenu /> : <DesktopBar />
```

Recognized at the component's `return` and as a JSX child. `!==`, reversed operands, and an inline `usePlatform() === 'mobile'` all parse. Both branches must be a single JSX element or the literal `null`, and at least one must be an element. Backed by the reserved `src/ui/platform.tsx` helper. Any other conditional is opaque.

Use it for genuinely different structure per device. Per-property overrides are not modeled — proportional scaling is already handled by the virtual canvas.

## What is never expressible

Do not attempt these; choose the listed substitute instead.

| Not expressible | Substitute |
|---|---|
| loops / `.map()` over data | unroll every element by hand |
| shared theme constants (`color: THEME.primary`) | inline `{ r, g, b, a }` literals at every site (an identifier in a style object freezes the node) |
| computed style values (arithmetic, `Math.*`, calls, concat, ternaries) | one driver-maintained state variable per derived value |
| percent-string bindings (`width: state.pct + '%'`) | bind a px number; static percent **literals** (`width: '90%'`) are fine |
| conditional element props (`disabled={state.i === -1}`) | a pre-computed boolean state variable |
| local helper components in the same file | a separate `src/ui/` file marked `/** @ui-component */` |
| children/slots on a component | keep the layout inline in the screen file; factor out leaf widgets only |
| a color or texture-set as a prop | unroll the variants inside the component (`texture.src` **can** bind to a string prop; `uvs` cannot) |
| data-driven rows with per-row drafts and closures | not portable — tell the user this part must stay coded, in its own non-`src/ui/` module |

Nine-slice backgrounds (`textureMode: 'nine-slices'` + `textureSlices`) and literal 8-float `uvs` atlas crops **do** round-trip.

## The driver pattern

The editor never parses files outside `src/ui/`, and `state` is a plain exported object. So: **the editor owns structure, style and rest values; a driver owns the clock and the math.**

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

Register it from `main()`. Every bound variable's initial value in `state` is its **designable rest state** — capture it at registration and animate around it, so a designer can restyle from the panel without touching the driver.

What belongs in the driver: clocks, tweens, easings, timers and auto-hide deadlines, `padStart`/rounding/text formatting, state machines, derived values (a px width from a percent), and anything reading the ECS (player position, etc.). The animation itself has no editor representation — the editor sees a bound key and its rest value only.

Full examples (eased open/close, formatted timer label, two-variable exit gate, click-triggered one-shots, naming-convention drivers): `{baseDir}/references/driver-pattern.md`.

## Sizing and mobile

- **Every bound size or position is a plain px `number`.** No arithmetic in the value, no percent strings. Static percent literals in unbound keys are fine and are the best tool for fluid layout.
- Design against the two default virtual canvases: **desktop `1920x1080`, mobile `1600x720`**. The mobile canvas is 33% shorter, so tall stacked layouts that fit desktop can overflow on a phone. Anchor to edges and use flex/percent literals for the fluid axis instead of absolute offsets computed for one height.
- Touch targets: give every pressable element a real box of at least ~48 px on the virtual canvas — never rely on text-sized hit areas.
- Text: body copy at `fontSize` ≥ 16, and prefer ≥ 20 for anything a mobile player must read while moving. Set `textWrap="wrap"` plus an explicit width on any label that can grow.
- Reach for the platform variant when the mobile layout genuinely differs in structure (a bottom sheet instead of a side rail, fewer visible columns) rather than shrinking a desktop layout until it fits.
- Hover layers do nothing on touch: never make a `hover` layer the only affordance or the only way to read a value.

## Self-check list

Run this over **every** `.tsx` file you write or adapt. Each item is a silent editor failure if violated.

1. File is `src/ui/<PascalCaseName>.tsx`, basename equals the exported component name, first line is `/** @jsx ReactEcs.createElement */`, exactly one exported component.
2. Every JSX element name is `UiEntity`, `Label`, `Input`, `Dropdown`, `Button`, or a component exported by another file in `src/ui/`.
3. No `{cond && <X/>}`, no `cond ? <A/> : <B/>` — except a `usePlatform()` variant whose branches are both a single element or `null`.
4. No `.map()`, no loops, no array-built children.
5. No `{/* JSX comments */}` anywhere; comments are `//` outside JSX.
6. Every value inside `uiTransform` / `uiBackground` is either a literal or a bare `state.x` / `props.x` reference. Grep the file for `?`, `+`, `*`, `Math.`, `(` and any bare identifier inside those objects — each one is a frozen node.
7. All text is on `Label` / `Button` `value` props; no `uiText` bag on a `UiEntity`.
8. Every template literal in a prop interpolates only bare references.
9. The only spread on any element is a single `{...someUseInteractionConst}`.
10. Visibility is a `useInteraction` `active` layer setting `display: 'none'`; hover/press are `hover`/`press` layers.
11. `export interface State` + `export const state: State` present; every property is `number`, `string`, `boolean`, `string[]`, or a structural `{ r, g, b, a }` color.
12. Declared props are an inline object type of optional `number` / `string` / `boolean` / callback members only.
13. Every handler is a `/** @ui-action */` function taking `({ state, props, value }: UiAction)`, wired through a thunk.
14. All bound sizes/positions are px numbers; no percent strings in bound values.
15. No clock, `Date.now()`, `setTimeout`, easing, rounding or string formatting anywhere in `src/ui/` — it all lives in the driver.
16. `src/ui/index.tsx` matches the generated shape exactly, each root wrapped in `ScreenInsetArea` unless full-canvas control was explicitly requested.
17. Mobile pass: layout survives a 1600x720 canvas, touch targets ≥ ~48 px, no hover-only affordances.

## References

- `{baseDir}/references/interaction-helper.md` — verbatim source for `src/ui/interaction.tsx` and `src/ui/platform.tsx` (required in any scene not created by the editor).
- `{baseDir}/references/component-template.md` — a minimal editable component, a fully-featured one (bindings, actions, hover, gates, platform variant), and the composed screen + aggregator.
- `{baseDir}/references/driver-pattern.md` — driver examples: eased open/close, formatted timer, two-variable exit gate, one-shot animations, naming conventions.
- `{baseDir}/references/adapting-coded-ui.md` — before/after recipes for porting a production coded UI, and what to tell the user cannot be ported.
