# Drag sliders in editable UI

Read this for any slider, scrub bar or drag handle in a UI that must stay editable in the Creator Hub. It is the worked port of build-ui's `screenDelta` drag pattern (`build-ui/references/ui-sliders.md`) onto this contract — **built and verified in-world** in an SDK 7.27.0 scene, zero opaque nodes, zero frozen nodes.

The mechanic survives the port intact. Only two things change shape: the drag *start* becomes an ordinary action body, and the release catcher stops being conditionally rendered.

## How the pattern maps onto the contract

| Piece of the coded pattern | Under this contract |
|---|---|
| drag machinery: `screenDelta` accumulation, UI scale-factor correction, `PET_UP` safety net, clamping, interpolation | unchanged, in the **driver** outside `src/ui/` — the editor never reads it |
| `beginDrag({...})` in `onMouseDown` | a plain `/** @ui-action */` body that sets the value **and** `state.dragTarget` — action bodies are free-form |
| `{isDragging() && <catcher/>}` release overlay | **not expressible** (`{cond && <X/>}` is opaque). Becomes an always-present overlay with an `active` `display: 'none'` layer gated on `state.dragTarget === ''` |
| `width: `${pct}%`` fill | a driver-derived px number bound as `width: props.fillPx` |
| continuous dragged value → readout text | driver interpolates over a designed step table and writes the finished string |

The editor still only ever sees bound variables with literal rest values. It has no representation of the drag itself — which is exactly the driver-pattern split.

## 1. The slider component (`src/ui/KitSlider.tsx`)

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
- **These handlers belong exactly here.** The zones are the smallest elements that need them (40×44 px each), which is the Lesson-1 rule applied correctly: never the wrapper, always the smallest element.
- **Both header labels declare an explicit `200`/`180` × `26` box** and align inside it (`middle-left` / `middle-right`) rather than relying on `justifyContent: 'space-between'` alone. Text intrinsic sizing is engine-dependent — an unset text dimension contributes ~0 to layout on the Unity explorer — so a label without a box is a cross-engine layout bug. See `SKILL.md` → **Sizing and mobile**.
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

A permanently-blocking full-screen element is the top-severity mistake in scene UI: it locks the player out of every other UI element and the whole 3D world (`SKILL.md` → **Interaction layers**, self-check item 11). The catcher is legitimate because the blocking is **gated**: `pointerFilter: 'block'` is real, but the element is `display: 'none'` except during a drag, which lasts exactly as long as a mouse button is held. The other sanctioned exception is a modal backdrop that is *supposed* to swallow clicks while open. In both cases the blocking is an explicit, gated decision — never a side effect of where a `useInteraction` spread landed.

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

## Gotchas

- **`TRACK_PX` must match the component's track width exactly** (here 400, also the sum of the ten 40-px zones). A mismatch makes drag speed diverge from the cursor and the fill overshoot or fall short of the end.
- **Drag is desktop-only.** `screenDelta` always reports 0 on mobile, so on a phone the slider is *only* the tap-to-step zones. That is why the zones are a full interface on their own (10 steps, 40×44 px targets) rather than a coarse fallback — do not build an editable slider whose zones are too few or too small to be usable alone.
- **The `PET_UP` check in the driver is a safety net, not the primary path.** The overlay's `onMouseUp` normally ends the drag; `PET_UP` catches releases the overlay misses (pointer leaving the window, focus loss). Keep both — a stuck `dragTarget` means the slider follows the cursor forever.
- **The catcher must be the last child of the root** (or otherwise on top). A catcher rendered before the panel sits underneath it, and releases over the panel never reach it — leaving the drag running.
- **`state.dragTarget` is a `string`, not a boolean**, so one overlay and one system serve every slider on the screen. Gate the overlay on `state.dragTarget === ''` and select in the driver with `if/else`. A boolean per slider would need one overlay each.
- **Do not read the dragged value back through a JSX closure.** The driver owns the accumulator and mutates `state` directly; a closure over a render-frame prop returns a stale constant and the slider jitters around its start value (see `build-ui/references/ui-sliders.md`).
- **The scale-factor formula is SDK-version dependent.** The form above is 7.26.0+. Below that, `@dcl/react-ecs` also divides its layout by `devicePixelRatio` and the helper must match. Check `@dcl/sdk` in the scene's `package.json`; details in `build-ui/SKILL.md` → SDK version gate.
- `VIRTUAL_WIDTH`/`VIRTUAL_HEIGHT` must match the canvas the renderer actually resolved to. The editor's generated `index.tsx` passes **no** options, so the scene gets the platform defaults — desktop `1920x1080`, mobile `1600x720`. The constants above are the desktop pair, which is all the drag path needs.
