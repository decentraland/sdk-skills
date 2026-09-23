# Editable component templates

Every example here is code that the editor's parser reads as fully first-class (zero opaque nodes, zero frozen nodes). Copy the shapes exactly.

## 1. The seed the editor itself writes

A new root starts as:

```tsx
/** @jsx ReactEcs.createElement */
import ReactEcs from '@dcl/sdk/react-ecs'

export interface State {}
export const state: State = {}

export function MyScreen(props: {}) {
  return
}
```

No `/** @ui-component */` marker means top-level: the aggregator renders it. Add the marker to make it a reusable component instead.

## 2. Minimal reusable component

State object, an action, a nested component ref, and a visibility gate — the smallest complete widget.

```tsx
/** @jsx ReactEcs.createElement */
import ReactEcs, { Label, UiEntity } from '@dcl/sdk/react-ecs'
import { KitCloseButton } from './KitCloseButton'
import { useInteraction } from './interaction'

export interface State {}
export const state: State = {}

type UiAction = { state: State; props: Parameters<typeof KitToast>[0]; value?: unknown }

/** @ui-action */
function forwardClose({ props }: UiAction) {
  props.onClose?.()
}

/** @ui-component */
export function KitToast(props: {
  message?: string
  visible?: boolean
  onClose?: (value?: unknown) => void
}) {
  const toastBox = useInteraction(
    {
      base: {
        uiTransform: {
          width: 320,
          height: 56,
          borderRadius: 12,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: { left: 16, right: 10 },
        },
        uiBackground: { color: { r: 0.243, g: 0.047, b: 0.369, a: 0.95 } },
      },
      active: { uiTransform: { display: 'none' } },
    },
    props.visible !== true,
  )
  return (
    <UiEntity {...toastBox}>
      <Label
        value={`${props.message}`}
        fontSize={16}
        textAlign="middle-left"
        color={{ r: 0.973, g: 0.976, b: 0.98, a: 1 }}
        uiTransform={{ width: 240, height: 24 }}
      />
      <KitCloseButton onPress={(value?: unknown) => forwardClose({ state, props, value })} />
    </UiEntity>
  )
}
```

Points:

- The message `Label` carries its own `240`×`24` box: an unset text dimension contributes ~0 to layout on the Unity explorer, so a boxless label breaks the row on that engine (see `SKILL.md` → **Sizing and mobile**).
- The root's `width: 320, height: 56` is **mandatory shape, not decoration**: a component root must declare both dimensions explicitly. Here the 56 px height is stated even though the 16 px label would auto-size the box — an unset dimension renders as 0 on the editor canvas (collapsed instance, panel reads height 0) while still laying out correctly at runtime.
- `State` may be empty — a component whose values all arrive as props still declares the pair.
- `` value={`${props.message}`} `` not `value={props.message}`: the template form typechecks against an optional prop and is still a recognized binding.
- The callback prop is forwarded up with a one-line action; the child's `onPress` is wired through the same thunk shape.

## 3. Bindings, mixed text, hover, and a two-variable exit gate

```tsx
/** @jsx ReactEcs.createElement */
import ReactEcs, { Label, UiEntity } from '@dcl/sdk/react-ecs'
import { useInteraction } from './interaction'

// The driver (src/ui-behaviors.ts) owns the clock: it formats `label`, eases
// `panelTop` and `panelColor.a`, and clears `hidden` only after the fade-out.
export interface State {
  visible: boolean
  hidden: boolean
  hintVisible: boolean
  label: string
  score: number
  panelTop: number
  panelWidth: number
  labelColor: { r: number; g: number; b: number; a: number }
  panelColor: { r: number; g: number; b: number; a: number }
  nextRequested: boolean
}
export const state: State = {
  visible: false,
  hidden: true,
  hintVisible: true,
  label: '00.00',
  score: 0,
  panelTop: 32,
  panelWidth: 480,
  labelColor: { r: 1, g: 1, b: 1, a: 1 },
  panelColor: { r: 0, g: 0, b: 0, a: 0.8 },
  nextRequested: false,
}

type UiAction = { state: State; props: Parameters<typeof GpTimerPanel>[0]; value?: unknown }

/** @ui-action */
function pressNext({ state }: UiAction) {
  state.nextRequested = true // the driver reacts; the action never waits
}

/** @ui-action */
function dismiss({ state }: UiAction) {
  state.visible = false // intent only — the driver clears `hidden` after the animation
}

/** @ui-component */
export function GpTimerPanel(props: { hint?: string }) {
  // The gate goes on the PANEL, never on the full-screen wrapper below: the
  // useInteraction spread always carries all four pointer listeners, and a
  // 100%x100% element with a listener swallows every click in the scene.
  const panel = useInteraction(
    {
      base: {
        uiTransform: {
          width: 520,
          height: 220,
          flexDirection: 'column',
          justifyContent: 'flex-start',
          alignItems: 'center',
          margin: { top: state.panelTop },
        },
      },
      active: { uiTransform: { display: 'none' } },
    },
    state.hidden === true,
  )
  const hint = useInteraction(
    {
      base: {
        uiTransform: { width: 520, height: 26, justifyContent: 'center', alignItems: 'center', margin: { bottom: 4 } },
      },
      active: { uiTransform: { display: 'none' } },
    },
    state.hintVisible !== true,
  )
  const nextButton = useInteraction({
    base: {
      uiTransform: { width: 200, height: 48, justifyContent: 'center', alignItems: 'center', borderRadius: 10 },
      uiBackground: { color: { r: 1, g: 0.2, b: 0.36, a: 1 } },
    },
    hover: { uiBackground: { color: { r: 1, g: 0.2, b: 0.36, a: 0.85 } } },
    press: { uiBackground: { color: { r: 0.8, g: 0.15, b: 0.29, a: 1 } } },
  })
  return (
    <UiEntity
      uiTransform={{
        width: '100%',
        height: '100%',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        alignItems: 'center',
      }}
    >
      <UiEntity {...panel}>
        <UiEntity {...hint}>
          <Label
            value={`${props.hint}`}
            fontSize={20}
            textAlign="middle-center"
            color={{ r: 1, g: 1, b: 1, a: 0.6 }}
            uiTransform={{ width: '100%', height: '100%' }}
          />
        </UiEntity>
        <UiEntity
          uiTransform={{
            width: state.panelWidth,
            height: 96,
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: { left: 20, right: 20, top: 8, bottom: 8 },
            borderRadius: 8,
          }}
          uiBackground={{ color: state.panelColor }}
        >
          <Label
            value={state.label}
            fontSize={35}
            textAlign="middle-center"
            color={state.labelColor}
            uiTransform={{ width: '100%', height: 44 }}
          />
          <Label
            value={`Score: <b>${state.score}</b>`}
            fontSize={20}
            textAlign="middle-center"
            color={{ r: 1, g: 1, b: 1, a: 1 }}
            uiTransform={{ width: '100%', height: 28 }}
          />
        </UiEntity>
        <UiEntity {...nextButton} onMouseDown={() => pressNext({ state, props })}>
          <Label
            value="Next [E]"
            fontSize={18}
            textAlign="middle-center"
            color={{ r: 1, g: 1, b: 1, a: 1 }}
            uiTransform={{ width: '100%', height: '100%' }}
          />
        </UiEntity>
      </UiEntity>
    </UiEntity>
  )
}
```

Every dynamic value here is a bare reference: `margin: { top: state.panelTop }`, `width: state.panelWidth`, `uiBackground={{ color: state.panelColor }}`, `color={state.labelColor}`, `value={state.label}`, and one mixed-text label. Nothing is computed in the file.

Note every box in this tree is explicit — the panel (`520`×`220`), the hint wrapper (`520`×`26`), the readout column (`state.panelWidth`×`96`, `flexDirection: 'column'`) and each of the four labels. Only the bound `panelWidth` varies. Nothing auto-sizes from text, because an unset text dimension lays out as ~0 on the Unity explorer (labels overlap, parents collapse) even though Bevy measures it correctly.

Two structural points worth copying:

- **The `100%`×`100%` root is a plain literal-styled `UiEntity` with no spread and no handler.** It exists only to give the panel a full-screen box to center in. The visibility gate lives on the 520-px panel. Reversing that — `{...panel}` on the root — is the top-severity mistake in editable UI: the spread's four listeners would make the whole screen capture clicks (see the rule in `SKILL.md` → **Interaction layers**), and the bug is invisible in a screenshot because the panel is what you look at.
- **The slide-in animates `margin.top`, not `position.top`.** With the panel in flow inside a centering wrapper, a bound `margin` member gives the same eased drop while keeping horizontal centering for free — and `margin` members are a recognized binding position, exactly like `position` members.

## 4. Dialog: full-screen wrapper + gated panel (before/after)

A dialog is where the pointer-blocking mistake actually gets made, because a dialog *is* a small panel inside a full-screen layout box. Shipped, in-world-verified shape:

```tsx
// BEFORE — BROKEN. The gate is on the layout wrapper.
// useInteraction returns onMouseDown/Up/Enter/Leave unconditionally, even for a
// base+active gate, so this 100%x100% element captures pointer input over the
// entire screen: no other UI element and nothing in the world can be clicked.
const root = useInteraction(
  {
    base: { uiTransform: { width: '100%', height: '100%', justifyContent: 'flex-end', alignItems: 'center' } },
    active: { uiTransform: { display: 'none' } },
  },
  state.visible !== true,
)
return (
  <UiEntity {...root}>
    <UiEntity uiTransform={{ width: 720, height: 210, flexDirection: 'column' }}>…</UiEntity>
  </UiEntity>
)
```

```tsx
// AFTER — the wrapper is plain; the gate moved onto the 720px panel.
/** @jsx ReactEcs.createElement */
import ReactEcs, { Label, UiEntity } from '@dcl/sdk/react-ecs'
import { useInteraction } from './interaction'

export interface State {
  visible: boolean
}
export const state: State = {
  visible: true,
}

type UiAction = { state: State; props: Parameters<typeof WizardDialog>[0]; value?: unknown }

/** @ui-action */
function closeDialog({ state }: UiAction) {
  state.visible = false
}

export function WizardDialog(props: {}) {
  // The visibility gate lives on the panel itself — never on the full-screen
  // wrapper: useInteraction attaches pointer handlers to the element it styles,
  // and a 100%x100% element with handlers blocks clicks to the world and to
  // every other UI.
  const panel = useInteraction(
    {
      base: {
        uiTransform: {
          width: 720,
          height: 210,
          flexDirection: 'column',
          alignItems: 'center',
          padding: { left: 28, right: 28, top: 20, bottom: 20 },
          borderRadius: 16,
          borderWidth: 2,
          borderColor: { r: 0.85, g: 0.7, b: 0.35, a: 1 },
        },
        uiBackground: { color: { r: 0.07, g: 0.05, b: 0.14, a: 0.92 } },
      },
      active: { uiTransform: { display: 'none' } },
    },
    state.visible !== true,
  )
  const okButton = useInteraction({
    base: {
      uiTransform: {
        width: 180,
        height: 48,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 10,
        margin: { top: 20 },
      },
      uiBackground: { color: { r: 0.45, g: 0.3, b: 0.75, a: 1 } },
    },
    hover: { uiBackground: { color: { r: 0.55, g: 0.4, b: 0.88, a: 1 } } },
    press: { uiBackground: { color: { r: 0.35, g: 0.22, b: 0.6, a: 1 } } },
  })
  return (
    <UiEntity
      uiTransform={{
        width: '100%',
        height: '100%',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        alignItems: 'center',
        padding: { bottom: 48 },
      }}
    >
      <UiEntity {...panel}>
        <Label
          value="Eldrin the Wizard"
          fontSize={24}
          textAlign="middle-left"
          textWrap="wrap"
          color={{ r: 0.95, g: 0.8, b: 0.4, a: 1 }}
          uiTransform={{ width: '100%', height: 30, margin: { bottom: 10 } }}
        />
        <Label
          value="Welcome, traveler. You stand within a magical forest, alive with ancient enchantments. But heed my warning: do not come here at night."
          fontSize={20}
          textAlign="middle-left"
          textWrap="wrap"
          color={{ r: 0.95, g: 0.95, b: 0.98, a: 1 }}
          uiTransform={{ width: '100%', height: 60 }}
        />
        <UiEntity {...okButton} onMouseDown={() => closeDialog({ state, props })}>
          <Label
            value="Understood"
            fontSize={18}
            textAlign="middle-center"
            color={{ r: 1, g: 1, b: 1, a: 1 }}
            uiTransform={{ width: '100%', height: '100%' }}
          />
        </UiEntity>
      </UiEntity>
    </UiEntity>
  )
}
```

Points:

- The full-screen wrapper does all the positioning (bottom-anchored, horizontally centered, 48 px off the bottom edge) with plain literals. It has no spread, no listener, no `pointerFilter` — so it is pointer-transparent and clicks pass through to the world and to other UI.
- The panel carries both its own styling and the `active` display gate. Only its 720-px box captures clicks, and only while the dialog is open — once `state.visible` is false the panel is `display: 'none'` and captures nothing.
- **The panel states `height: 210`, and every `Label` states a box** — `height: 30` for the one-line name, `height: 60` for the two-line wrapped body, `100%`/`100%` for the button's centered text. Do **not** let the panel auto-size to its text children: text intrinsic sizing is engine-dependent, and on the Unity explorer an unset text dimension contributes ~0 to layout while the glyphs still draw, so the earlier version of this dialog (no panel height, labels with `width: '100%'` only) rendered correctly on Bevy and came out squashed on Unity with both labels overlapping. See `SKILL.md` → **Sizing and mobile**.
- `textWrap="wrap"` plus an explicit `width` **and** `height` on each `Label` is what makes the body copy wrap inside the panel instead of running off in one line — the width gives it something to wrap against, the height reserves the two lines it wraps into.

## 5. Props-driven styling (a fill bar)

A `props.x` reference binds a style key inside a component, so one file serves many differently-sized instances.

```tsx
/** @jsx ReactEcs.createElement */
import ReactEcs, { Label, UiEntity } from '@dcl/sdk/react-ecs'

export interface State {}
export const state: State = {}

/** @ui-component */
export function KitProgressBar(props: { label?: string; percent?: number; fillPx?: number }) {
  return (
    <UiEntity uiTransform={{ width: 560, height: 36, flexDirection: 'column' }}>
      <UiEntity
        uiTransform={{ width: '100%', height: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <Label
          value={`${props.label}`}
          fontSize={14}
          textAlign="middle-left"
          color={{ r: 0.973, g: 0.976, b: 0.98, a: 0.9 }}
          uiTransform={{ width: 400, height: 24 }}
        />
        <Label
          value={`${props.percent}%`}
          fontSize={14}
          textAlign="middle-right"
          color={{ r: 0.973, g: 0.976, b: 0.98, a: 0.7 }}
          uiTransform={{ width: 140, height: 24 }}
        />
      </UiEntity>
      <UiEntity
        uiTransform={{ width: '100%', height: 12, borderRadius: 6 }}
        uiBackground={{ color: { r: 0.973, g: 0.976, b: 0.98, a: 0.15 } }}
      >
        <UiEntity
          uiTransform={{ width: props.fillPx, height: 12, borderRadius: 6 }}
          uiBackground={{ color: { r: 1, g: 0.459, b: 0.22, a: 1 } }}
        />
      </UiEntity>
    </UiEntity>
  )
}
```

The px width is what binds — the driver derives `fillPx` from a percent against this track's literal 560 px width. `` value={`${props.percent}%`} `` is a mixed-text binding (bare reference + literal suffix), not a computed value.

The root's `height: 36` is the sum of its two fixed-height children (24 + 12). Omitting it — letting the column auto-size — is the single most common editor bug: correct in-world, height 0 on the canvas.

## 6. Unrolled visual variants (no color props)

A `variant` prop cannot pick a color. Author every variant as a sibling and gate the unused ones off:

```tsx
export interface State {}
export const state: State = {}

type UiAction = { state: State; props: Parameters<typeof KitButton>[0]; value?: unknown }

/** @ui-action */
function press({ props }: UiAction) {
  props.onPress?.()
}

/** @ui-component */
export function KitButton(props: { label?: string; variant?: string; onPress?: (value?: unknown) => void }) {
  const primary = useInteraction(
    {
      base: { uiTransform: { width: 180, height: 48, justifyContent: 'center', alignItems: 'center', borderRadius: 8 },
              uiBackground: { color: { r: 1, g: 0.459, b: 0.22, a: 1 } } },
      hover: { uiBackground: { color: { r: 1, g: 0.55, b: 0.32, a: 1 } } },
      active: { uiTransform: { display: 'none' } },
    },
    (props.variant ?? 'primary') !== 'primary',
  )
  const danger = useInteraction(
    {
      base: { uiTransform: { width: 180, height: 48, justifyContent: 'center', alignItems: 'center', borderRadius: 8 },
              uiBackground: { color: { r: 0.9, g: 0.2, b: 0.25, a: 1 } } },
      hover: { uiBackground: { color: { r: 1, g: 0.28, b: 0.33, a: 1 } } },
      active: { uiTransform: { display: 'none' } },
    },
    (props.variant ?? 'primary') !== 'danger',
  )
  return (
    <UiEntity uiTransform={{ width: 180, height: 48, flexDirection: 'row' }}>
      <UiEntity {...primary} onMouseDown={() => press({ state, props })}>
        <Label
          value={`${props.label}`}
          fontSize={18}
          textAlign="middle-center"
          color={{ r: 1, g: 1, b: 1, a: 1 }}
          uiTransform={{ width: '100%', height: '100%' }}
        />
      </UiEntity>
      <UiEntity {...danger} onMouseDown={() => press({ state, props })}>
        <Label
          value={`${props.label}`}
          fontSize={18}
          textAlign="middle-center"
          color={{ r: 1, g: 1, b: 1, a: 1 }}
          uiTransform={{ width: '100%', height: '100%' }}
        />
      </UiEntity>
    </UiEntity>
  )
}
```

The `active` expression may be any code, so the coalescing default and the comparison live there safely — only **style values** must stay bare references. The repetition is paid once inside the component instead of at every use site.

The root repeats the variants' `180x48` box explicitly. Since exactly one variant is ever displayed, the root's own size cannot be inferred from its children — state it.

## 7. The screen that composes them

A top-level root (no `@ui-component` marker) is pure composition. Each instance that needs positioning gets a wrapper `UiEntity`, because a component ref cannot be moved or sized from outside. Every such wrapper carries explicit `width`/`height` matching the wrapped component's root box — a wrapper holding only `position` or `margin` collapses to 0 on the editor canvas and takes the instance's preview with it.

```tsx
/** @jsx ReactEcs.createElement */
import ReactEcs, { UiEntity } from '@dcl/sdk/react-ecs'
import { GpTimerPanel } from './GpTimerPanel'
import { KitProgressBar } from './KitProgressBar'
import { KitToast } from './KitToast'
import { usePlatform } from './platform'
import { MobileControls } from './MobileControls'
import { DesktopHotkeyHints } from './DesktopHotkeyHints'

export interface State {
  toastMessage: string
  toastVisible: boolean
  downloadPx560: number
}
export const state: State = { toastMessage: 'Saved', toastVisible: false, downloadPx560: 0 }

type UiAction = { state: State; props: Parameters<typeof MyHud>[0]; value?: unknown }

/** @ui-action */
function closeToast({ state }: UiAction) {
  state.toastVisible = false
}

export function MyHud(props: {}) {
  const platform = usePlatform()
  return (
    <UiEntity uiTransform={{ width: '100%', height: '100%' }}>
      <GpTimerPanel hint="REACH THE TOP" />
      <UiEntity
        uiTransform={{ width: 560, height: 36, positionType: 'absolute', position: { left: 40, bottom: 40 } }}
      >
        <KitProgressBar label="Download" percent={42} fillPx={state.downloadPx560} />
      </UiEntity>
      <UiEntity
        uiTransform={{ width: 320, height: 56, positionType: 'absolute', position: { right: 24, top: 24 } }}
      >
        <KitToast
          message={state.toastMessage}
          visible={state.toastVisible}
          onClose={(value?: unknown) => closeToast({ state, props })}
        />
      </UiEntity>
      {platform === 'mobile' ? <MobileControls /> : <DesktopHotkeyHints />}
    </UiEntity>
  )
}
```

Instance props take literals (`label="Download"`, `percent={42}`) or bare state references (`fillPx={state.downloadPx560}`) — both are editable per instance from the panel.

## 8. The aggregator

Generated; reproduce it exactly and never hand-edit it (it is rewritten when the editor opens the scene and on every root add/rename/remove).

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

Mixed insets in one scene — the HUD inside the safe area, a letterbox root at full canvas:

```tsx
import ReactEcs, { UiEntity, ReactEcsRenderer, ScreenInsetArea } from '@dcl/sdk/react-ecs'
import { GpCinematicBars } from './GpCinematicBars'
import { MyHud } from './MyHud'

export function setupUi() {
  ReactEcsRenderer.setUiRenderer(() => (
    <UiEntity uiTransform={{ width: '100%', height: '100%' }}>
      <GpCinematicBars />
      <ScreenInsetArea>
        <MyHud />
      </ScreenInsetArea>
    </UiEntity>
  ))
}
```

`InteractableArea` is the third option (safe area **plus** the explorer's own on-screen controls) and imports from the same module.

Then, in `src/index.ts`:

```ts
import { setupUi } from './ui'
import { registerUiBehaviors } from './ui-behaviors'

export function main() {
  setupUi()
  registerUiBehaviors()
}
```
