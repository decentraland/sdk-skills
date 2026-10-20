# Drag sliders in React-ECS UI

Read this when the user asks for a slider, a drag handle, a scrub bar, or any UI driven by dragging.

**Short answer: drag sliders ARE supported.** Build them with `PrimaryPointerInfo.screenDelta`, not with the UI event handlers alone. Confirmed working in-world in both the Unity and the Bevy explorers, and — in the editable form below — **built and verified in-world** in an SDK 7.27.0 scene with zero opaque nodes and zero frozen nodes.

## Why you need `screenDelta`

`Listeners` in `@dcl/react-ecs` is exactly four optional callbacks, and `Callback` takes **zero parameters**:

```ts
export type Callback = () => void

export type Listeners = {
  onMouseDown?: Callback
  onMouseUp?: Callback
  onMouseEnter?: Callback
  onMouseLeave?: Callback
}
```

- No `onMouseDrag` / `onMouseMove` listener exists.
- **No arguments are passed to a handler** — no event object, no pointer position. The reconciler wires each listener through `pointerEventsSystem` and then calls `callback()` with the `PBPointerEventsResult` discarded, so "where on this element did they click" never reaches scene code.
- All four are hardcoded to `InputAction.IA_POINTER`; you cannot bind a UI element to right-click or a key.

So you cannot compute a value from *where* the click landed. You **can** track how far the mouse has *moved* since the drag started — which is what a slider actually needs.

`PrimaryPointerInfo.screenDelta` (on `engine.RootEntity`) is a `Vector2` of pixels moved since the last frame, updated every frame regardless of what the cursor is over. The official docs endorse exactly this for drag gestures: *"slide an entity along a rail using `delta.x` as an offset."*

## The pattern

1. `onMouseDown` on the track starts the drag and records the value at that moment.
2. A system accumulates `screenDelta.x` into the value each frame while the drag is active.
3. A full-screen, pointer-blocking overlay present **only while dragging** catches the release, so letting go outside the narrow track still ends the drag.

Step 3 is one of the two sanctioned exceptions to the rule that a `100%`×`100%` wrapper must never be pointer-blocking (`SKILL.md` → **Pointer blocking**, self-check item 11). It is safe *only* because it is gated: the blocking rect exists for the duration of a drag and is gone the rest of the time. Never hoist that `pointerFilter: 'block'` / `onMouseUp` onto a permanent full-screen wrapper to "simplify" — that blocks every click in the scene forever.

## How the pattern maps onto the editable contract

| Piece of the pattern | In editable UI |
|---|---|
| drag machinery: `screenDelta` accumulation, UI scale-factor correction, `PET_UP` safety net, clamping, interpolation | in the **driver** outside `src/ui/` — the editor never reads it |
| `beginDrag({...})` in `onMouseDown` | a plain `/** @ui-action */` body that sets the value **and** `state.dragTarget` — action bodies are free-form |
| `{isDragging() && <catcher/>}` release overlay | **not expressible** (`{cond && <X/>}` is opaque). Becomes an always-present overlay with an `active` `display: 'none'` layer gated on `state.dragTarget === ''` |
| `width: `${pct}%`` fill | a driver-derived px number bound as `width: props.fillPx` |
| continuous dragged value → readout text | driver interpolates over a designed step table and writes the finished string |

The editor only ever sees bound variables with literal rest values; it has no representation of the drag itself — exactly the driver-pattern split.

## 1. The editable slider component (`src/ui/KitSlider.tsx`)

Hybrid by design: 10 unrolled 40-px click zones give **tap-to-step**, and each press also **begins the drag** through the same `onChange` callback. Tap-to-step is not a nicety — it is the complete mobile interface, because `screenDelta` is always 0 on mobile.

```tsx
/** @jsx ReactEcs.createElement */
import ReactEcs, { Label, UiEntity } from '@dcl/sdk/react-ecs'

export interface State {}
export const state: State = {}

type UiAction = { state: State; props: Parameters<typeof KitSlider>[0]; value?: unknown }

/** @ui-action */
function pressStep({ props, value }: UiAction) {
  props.onChange?.(value)
}

// A stepped slider: 10 click zones over a 400px track. The parent binds
// fillPx (0..400, derived by the driver from the current step) and receives
// the clicked step index (0..9) through onChange.
/** @ui-component */
export function KitSlider(props: {
  label?: string
  valueText?: string
  fillPx?: number
  onChange?: (value?: unknown) => void
}) {
  return (
    <UiEntity uiTransform={{ width: 400, height: 70, flexDirection: 'column', margin: { bottom: 10 } }}>
      <UiEntity
        uiTransform={{
          width: '100%',
          height: 26,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Label
          value={`${props.label}`}
          fontSize={16}
          textAlign="middle-left"
          color={{ r: 0.95, g: 0.95, b: 0.98, a: 0.9 }}
          uiTransform={{ width: 200, height: 26 }}
        />
        <Label
          value={`${props.valueText}`}
          fontSize={16}
          textAlign="middle-right"
          color={{ r: 0.95, g: 0.8, b: 0.4, a: 1 }}
          uiTransform={{ width: 180, height: 26 }}
        />
      </UiEntity>
      <UiEntity uiTransform={{ width: '100%', height: 44 }}>
        <UiEntity
          uiTransform={{
            positionType: 'absolute',
            position: { top: 16, left: 0 },
            width: '100%',
            height: 12,
            borderRadius: 6,
          }}
          uiBackground={{ color: { r: 0.95, g: 0.95, b: 0.98, a: 0.15 } }}
        >
          <UiEntity
            uiTransform={{ width: props.fillPx, height: 12, borderRadius: 6 }}
            uiBackground={{ color: { r: 0.55, g: 0.4, b: 0.88, a: 1 } }}
          >
            <UiEntity
              uiTransform={{
                positionType: 'absolute',
                position: { right: -10, top: -4 },
                width: 20,
                height: 20,
                borderRadius: 10,
              }}
              uiBackground={{ color: { r: 0.95, g: 0.95, b: 0.98, a: 1 } }}
            />
          </UiEntity>
        </UiEntity>
        <UiEntity uiTransform={{ width: '100%', height: '100%', flexDirection: 'row' }}>
          <UiEntity uiTransform={{ width: 40, height: '100%' }} onMouseDown={() => pressStep({ state, props, value: 0 })} />
          <UiEntity uiTransform={{ width: 40, height: '100%' }} onMouseDown={() => pressStep({ state, props, value: 1 })} />
          <UiEntity uiTransform={{ width: 40, height: '100%' }} onMouseDown={() => pressStep({ state, props, value: 2 })} />
          <UiEntity uiTransform={{ width: 40, height: '100%' }} onMouseDown={() => pressStep({ state, props, value: 3 })} />
          <UiEntity uiTransform={{ width: 40, height: '100%' }} onMouseDown={() => pressStep({ state, props, value: 4 })} />
          <UiEntity uiTransform={{ width: 40, height: '100%' }} onMouseDown={() => pressStep({ state, props, value: 5 })} />
          <UiEntity uiTransform={{ width: 40, height: '100%' }} onMouseDown={() => pressStep({ state, props, value: 6 })} />
          <UiEntity uiTransform={{ width: 40, height: '100%' }} onMouseDown={() => pressStep({ state, props, value: 7 })} />
          <UiEntity uiTransform={{ width: 40, height: '100%' }} onMouseDown={() => pressStep({ state, props, value: 8 })} />
          <UiEntity uiTransform={{ width: 40, height: '100%' }} onMouseDown={() => pressStep({ state, props, value: 9 })} />
        </UiEntity>
      </UiEntity>
    </UiEntity>
  )
}
```

Why it is shaped this way:

- **Root declares `width: 400, height: 70` explicitly** (26-px label row + 44-px track row). The column would auto-size correctly at runtime and read **height 0** on the editor canvas — the standard editable-UI collapse. See `SKILL.md` → **Sizing and mobile**.
- **10 unrolled zones, 40 px each = the 400-px track.** No `.map()` exists here; the repetition is the price of editability, and it is what carries the step value: `value: 0…9` is passed straight into the action and out through `props.onChange`.
- **The zone layer is a `100%`×`100%` sibling rendered after the groove**, so it sits on top and takes the clicks. The groove is `positionType: 'absolute'`, so it consumes no flow space and the zones fill the row. Net effect: a **44-px tall hit area** over a 12-px visible groove — comfortably tappable on mobile.
- **These handlers belong exactly here.** The zones are the smallest elements that need them (40×44 px each): never the wrapper, always the smallest element.
- **Both header labels declare an explicit `200` / `180` × `26` box** and align inside it (`middle-left` / `middle-right`) rather than relying on `justifyContent: 'space-between'` alone. Text intrinsic sizing is engine-dependent — an unset text dimension contributes ~0 to layout on the Unity explorer — so a label without a box is a cross-engine layout bug.
- `props.fillPx` is a bare-reference binding; the driver derives it. `` value={`${props.valueText}`} `` is a mixed-text binding, so the formatting also lives in the driver.

## 2. The screen: state, actions, and the drag catcher

Excerpts from the screen that hosts three of these sliders (`src/ui/ParticleSettings.tsx`).

`state.dragTarget` is a plain `string` — `''` means "no drag running", otherwise it names which slider is being dragged. That one variable is both the driver's selector and the overlay's gate.

```tsx
export interface State {
  menuVisible: boolean
  dragTarget: string
  hueStep: number
  amountStep: number
  sizeStep: number
  colorFillPx: number
  amountFillPx: number
  sizeFillPx: number
  colorText: string
  amountText: string
  sizeText: string
}
export const state: State = {
  menuVisible: false,
  dragTarget: '',
  hueStep: 8,
  amountStep: 4,
  sizeStep: 4,
  colorFillPx: 356,
  amountFillPx: 178,
  sizeFillPx: 178,
  colorText: 'Purple',
  amountText: 'x1',
  sizeText: 'x1',
}
```

Each slider's `onChange` action does two mutations — jump to the tapped step, and start the drag. Action bodies are free-form code, so nothing here needs to be expressible as a style:

```tsx
// Each slider press jumps to the pressed step and starts a drag; the driver
// accumulates cursor movement into the value until the pointer is released.
/** @ui-action */
function setHue({ state, value }: UiAction) {
  state.hueStep = value as number
  state.dragTarget = 'hue'
}

/** @ui-action */
function setAmount({ state, value }: UiAction) {
  state.amountStep = value as number
  state.dragTarget = 'amount'
}

/** @ui-action */
function endDrag({ state }: UiAction) {
  state.dragTarget = ''
}
```

The release catcher: **always present in the tree**, gated off whenever no drag is running.

```tsx
  // Full-screen release catcher for slider drags: shown only while a drag is
  // active, so releasing the pointer anywhere ends the drag.
  const dragCatcher = useInteraction(
    {
      base: {
        uiTransform: {
          positionType: 'absolute',
          position: { top: 0, left: 0 },
          width: '100%',
          height: '100%',
          pointerFilter: 'block',
        },
      },
      active: { uiTransform: { display: 'none' } },
    },
    state.dragTarget === '',
  )
```

Instances are wired with a plain thunk carrying `value`, and the catcher is the **last child of the root** so it stacks above everything:

```tsx
  return (
    <UiEntity uiTransform={{ width: '100%', height: '100%' }}>
      <UiEntity {...panel}>
        …
        <KitSlider
          label="Color"
          valueText={state.colorText}
          fillPx={state.colorFillPx}
          onChange={(value?: unknown) => setHue({ state, props, value })}
        />
        …
      </UiEntity>
      <UiEntity {...dragCatcher} onMouseUp={() => endDrag({ state, props })} />
    </UiEntity>
  )
```

Note the root wrapper is a plain `UiEntity` with **no** spread and no handler — the only full-screen blocking element in this UI is the catcher, and it blocks only while `dragTarget !== ''`.

### This is a sanctioned deliberate-blocking exception

A permanently-blocking full-screen element is the top-severity mistake in scene UI: it locks the player out of every other UI element and the whole 3D world. The catcher is legitimate because the blocking is **gated**: `pointerFilter: 'block'` is real, but the element is `display: 'none'` except during a drag, which lasts exactly as long as a mouse button is held. The other sanctioned exception is a modal backdrop that is *supposed* to swallow clicks while open. In both cases the blocking is an explicit, gated decision — never a side effect of where a `useInteraction` spread landed.

## 3. The driver's drag section (`src/ui-behaviors.ts`)

Outside `src/ui/`, so all of this is invisible to the editor.

```ts
import {
  engine,
  InputAction,
  inputSystem,
  PointerEventType,
  PrimaryPointerInfo,
  UiCanvasInformation,
} from '@dcl/sdk/ecs'
import { state as menu } from './ui/ParticleSettings'

const TRACK_PX = 400 // must match KitSlider's track width
const HUE_NAMES = ['Red', 'Orange', 'Yellow', 'Lime', 'Green', 'Turquoise', 'Cyan', 'Blue', 'Purple', 'Magenta']
const AMOUNT_MULT = [0.2, 0.4, 0.6, 0.8, 1, 1.5, 2, 3, 4, 5]

// Default virtual canvas on desktop (drags are desktop-only: screenDelta is
// always 0 on mobile, where the sliders fall back to tap-to-step).
const VIRTUAL_WIDTH = 1920
const VIRTUAL_HEIGHT = 1080

function stepToPx(step: number): number {
  return Math.round((step / 9) * TRACK_PX)
}

function clampStep(v: number): number {
  return Math.min(9, Math.max(0, v))
}

// Piecewise-linear interpolation over the step tables, so dragged fractional
// values map smoothly between the designed anchor points.
function lerpTable(table: number[], v: number): number {
  const i = Math.floor(v)
  if (i >= table.length - 1) return table[table.length - 1]
  return table[i] + (table[i + 1] - table[i]) * (v - i)
}

// screenDelta is in real screen pixels; the UI is laid out in virtual pixels.
// Mirrors @dcl/react-ecs's own UiScaleSystem (SDK 7.26.0+ form, no
// devicePixelRatio divisor).
function uiScaleFactor(): number {
  const c = UiCanvasInformation.getOrNull(engine.RootEntity)
  if (!c?.width || !c?.height) return 1
  const s = Math.min(c.width / VIRTUAL_WIDTH, c.height / VIRTUAL_HEIGHT)
  return Number.isFinite(s) && s > 0 ? s : 1
}

// While a drag is active, accumulate cursor movement into the dragged value.
// The full-screen catcher in the UI ends the drag on release; the PET_UP check
// is the safety net for releases the overlay misses.
function updateDrag() {
  if (menu.dragTarget === '') return
  if (inputSystem.isTriggered(InputAction.IA_POINTER, PointerEventType.PET_UP)) {
    menu.dragTarget = ''
    return
  }
  const delta = PrimaryPointerInfo.getOrNull(engine.RootEntity)?.screenDelta
  if (!delta || delta.x === 0) return
  const dSteps = (delta.x / uiScaleFactor()) * (9 / TRACK_PX)
  if (menu.dragTarget === 'hue') menu.hueStep = clampStep(menu.hueStep + dSteps)
  else if (menu.dragTarget === 'amount') menu.amountStep = clampStep(menu.amountStep + dSteps)
  else if (menu.dragTarget === 'size') menu.sizeStep = clampStep(menu.sizeStep + dSteps)
}

export function registerUiBehaviors() {
  engine.addSystem(() => {
    updateDrag()

    // Derived values the UI binds — the editor sees only their rest state.
    menu.colorFillPx = stepToPx(menu.hueStep)
    menu.amountFillPx = stepToPx(menu.amountStep)
    menu.sizeFillPx = stepToPx(menu.sizeStep)
    menu.colorText = HUE_NAMES[Math.round(menu.hueStep)] ?? ''
    menu.amountText = `x${Math.round(lerpTable(AMOUNT_MULT, menu.amountStep) * 10) / 10}`
  })
}
```

Register it from `main()` alongside `setupUi()`.

Two things this driver does that a stepped-only slider would not need:

- **Values are continuous, not integer.** `hueStep` becomes fractional the moment the player drags, so the readouts cannot index the step tables directly — `lerpTable` interpolates between the designed anchor points. Discrete labels (`HUE_NAMES`) round instead. Design the tables at whole steps; let the driver fill in between.
- **`stepToPx` is the only place the track geometry appears twice.** `TRACK_PX` must equal `KitSlider`'s track width (400) or the drag will not track the cursor and the fill will not reach the ends.

## 4. Coded variant (non-editable UI)

Same mechanic with conditional rendering — for a slider inside a coded panel (`coded-ui.md`).

### Drag state + system

```ts
import { engine, PrimaryPointerInfo, UiCanvasInformation, InputAction, PointerEventType, inputSystem } from '@dcl/sdk/ecs'

const VIRTUAL_WIDTH = 1920
const VIRTUAL_HEIGHT = 1080

type DragArgs = {
  unitsPerVirtualPx: number // (max - min) / trackWidthInVirtualPx
  min: number
  max: number
  start: number             // value when the drag began
  set: (v: number) => void
}

// The accumulator owns `current`. Do NOT read the value back through a closure
// over JSX props — see the stale-closure gotcha below.
let drag: (DragArgs & { current: number }) | null = null

export const isDragging = () => drag !== null
export const endDrag = () => { drag = null }
export const beginDrag = (a: DragArgs) => { drag = { ...a, current: a.start } }

function uiScaleFactor(): number {
  const c = UiCanvasInformation.getOrNull(engine.RootEntity)
  if (!c?.width || !c?.height) return 1
  const s = Math.min(c.width / VIRTUAL_WIDTH, c.height / VIRTUAL_HEIGHT)
  return Number.isFinite(s) && s > 0 ? s : 1
}

export function dragSliderSystem() {
  if (!drag) return
  // safety net if the overlay's onMouseUp does not fire
  if (inputSystem.isTriggered(InputAction.IA_POINTER, PointerEventType.PET_UP)) { drag = null; return }

  const delta = PrimaryPointerInfo.getOrNull(engine.RootEntity)?.screenDelta
  if (!delta || delta.x === 0) return

  drag.current = Math.min(drag.max, Math.max(drag.min, drag.current + (delta.x / uiScaleFactor()) * drag.unitsPerVirtualPx))
  drag.set(drag.current)
}
```

Register it once: `engine.addSystem(dragSliderSystem)`.

### The UI

```tsx
const TRACK_WIDTH_PX = 208 // track width in VIRTUAL px — must match the layout below

function Slider(props: { value: number; min: number; max: number; onChange: (v: number) => void }) {
  const { value, min, max, onChange } = props
  const pct = Math.max(0, Math.min(1, (value - min) / (max - min))) * 100

  return (
    <UiEntity uiTransform={{ width: '100%', height: '100%', positionType: 'absolute' }}>
      {/* release catcher — only while dragging */}
      {isDragging() && (
        <UiEntity
          uiTransform={{
            positionType: 'absolute', position: { top: 0, left: 0 },
            width: '100%', height: '100%', pointerFilter: 'block'
          }}
          onMouseUp={endDrag}
        />
      )}
      {/* track */}
      <UiEntity
        uiTransform={{ width: TRACK_WIDTH_PX, height: 10 }}
        uiBackground={{ color: Color4.create(0.15, 0.15, 0.18, 0.9) }}
        onMouseDown={() =>
          beginDrag({ unitsPerVirtualPx: (max - min) / TRACK_WIDTH_PX, min, max, start: value, set: onChange })
        }
      >
        <UiEntity uiTransform={{ width: `${pct}%`, height: '100%' }} uiBackground={{ color: Color4.create(1, 0.6, 0.2, 1) }} />
      </UiEntity>
    </UiEntity>
  )
}
```

If the track is sized with `flexGrow: 1`, compute `TRACK_WIDTH_PX` from the parent: e.g. a 300-wide panel with `padding: 14` and two 26px buttons with 6px margins gives `300 - 28 - 26 - 26 - 12 = 208`. Pair the track with `-` / `+` stepper `Button`s — fine adjustment on desktop and the whole interface on mobile. Branch with `isMobile()` from `@dcl/sdk/platform` to hide the track entirely if wanted.

## Gotchas

- **Do not read the current value back through a JSX closure.** `get: () => props.value` captures the props object from the render frame where the drag began, so it returns a stale constant — the slider jitters around its start value instead of accumulating. The drag state (or the editable `state` object) must own its own accumulator. (Hit and fixed during in-engine testing.)
- **The track width constant must match the rendered track width in virtual px** (`TRACK_PX` 400 = the ten 40-px zones; `TRACK_WIDTH_PX` 208 in the coded example), or drag speed won't match the cursor and the fill overshoots or falls short of the end.
- **Always divide by the UI scale factor**, computed with the same formula the scene's `@dcl/react-ecs` uses. Skipping it makes the drag over- or under-shoot on any screen whose resolution differs from the virtual size.
- **The formula is SDK-version dependent — check `@dcl/sdk` in the scene's `package.json`.** `uiScaleFactor()` above is the **7.26.0+** form. On a scene pinned **below 7.26.0**, react-ecs also divides its layout by `devicePixelRatio`, so the helper must match it or the drag under-shoots on every high-density screen:

  ```ts
  // Below SDK 7.26.0 ONLY — react-ecs divides its own layout by devicePixelRatio there.
  // Do NOT use this form on 7.26.0+; it reintroduces the very mismatch it corrects.
  const s = Math.min(c.width / VIRTUAL_WIDTH, c.height / VIRTUAL_HEIGHT) / (c.devicePixelRatio || 1)
  ```

  If you inherit slider code carrying the `devicePixelRatio` divisor and the scene is on 7.26.0+, remove the divisor. See the version gate in `coded-ui.md`. (The editable path requires 7.26.0+, so it always uses the form above.)
- **`VIRTUAL_WIDTH` / `VIRTUAL_HEIGHT` must match what the renderer actually resolved to**, not just what you think you passed. The editor's generated `index.tsx` passes **no** options, so the scene gets the platform defaults — desktop `1920x1080`, mobile `1600x720`; the desktop pair is all the drag path needs. In coded UI, passing the size explicitly to `setUiRenderer` keeps these constants honest (a 16:9 size passed on mobile is still overridden to `1600x720`).
- **Desktop only.** `screenDelta` always reports 0 on mobile (no free-moving cursor), and `pointerType` only has `POT_NONE` / `POT_MOUSE`. On a phone the slider is *only* the tap-to-step zones (or the stepper buttons) — make them a full interface on their own (10 steps, 40×44 px targets), not a coarse fallback.
- **The `PET_UP` check in the driver is a safety net, not the primary path.** The overlay's `onMouseUp` normally ends the drag; `PET_UP` catches releases the overlay misses (pointer leaving the window, focus loss). Keep both — a stuck `dragTarget` means the slider follows the cursor forever.
- **The catcher must be the last child of the root** (or otherwise on top). A catcher rendered before the panel sits underneath it, and releases over the panel never reach it — leaving the drag running.
- **`state.dragTarget` is a `string`, not a boolean**, so one overlay and one system serve every slider on the screen. Gate the overlay on `state.dragTarget === ''` and select in the driver with `if/else`. A boolean per slider would need one overlay each.
- **Read `screenDelta` inside a system.** It only holds one frame of movement, and touching `engine.RootEntity` during initial scene load can error.
- **Vertical sliders**: the screen origin is top-left, so positive `delta.y` means the mouse moved down — that already matches a track whose value grows downwards. Invert it for a bottom-up track (a volume fader that fills upwards). Horizontal drags need no adjustment.

## Why not `screenCoordinates`

`PrimaryPointerInfo.screenCoordinates` gives an absolute cursor position, which looks like a way to jump the value to the clicked position. Avoid it for sliders: it forces you to hardcode the track's screen rect as canvas fractions, breaks the moment the track sits inside a flex layout or an `InteractableArea` / `ScreenInsetArea` wrapper, and freezes at the screen center whenever the cursor is locked. Delta accumulation has none of those failure modes.
