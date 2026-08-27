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
        color={{ r: 0.973, g: 0.976, b: 0.98, a: 1 }}
      />
      <KitCloseButton onPress={(value?: unknown) => forwardClose({ state, props, value })} />
    </UiEntity>
  )
}
```

Points:

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
  const root = useInteraction(
    {
      base: {
        uiTransform: {
          width: '100%',
          height: '100%',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          alignItems: 'center',
          positionType: 'absolute',
          position: { top: state.panelTop },
        },
      },
      active: { uiTransform: { display: 'none' } },
    },
    state.hidden === true,
  )
  const hint = useInteraction(
    {
      base: { uiTransform: { justifyContent: 'center', alignItems: 'center', margin: { bottom: 4 } } },
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
    <UiEntity {...root}>
      <UiEntity {...hint}>
        <Label value={`${props.hint}`} fontSize={20} textAlign="middle-center" color={{ r: 1, g: 1, b: 1, a: 0.6 }} />
      </UiEntity>
      <UiEntity
        uiTransform={{
          width: state.panelWidth,
          justifyContent: 'center',
          alignItems: 'center',
          padding: { left: 20, right: 20, top: 8, bottom: 8 },
          borderRadius: 8,
        }}
        uiBackground={{ color: state.panelColor }}
      >
        <Label value={state.label} fontSize={35} textAlign="middle-center" color={state.labelColor} />
        <Label value={`Score: <b>${state.score}</b>`} fontSize={20} color={{ r: 1, g: 1, b: 1, a: 1 }} />
      </UiEntity>
      <UiEntity {...nextButton} onMouseDown={() => pressNext({ state, props })}>
        <Label value="Next [E]" fontSize={18} textAlign="middle-center" color={{ r: 1, g: 1, b: 1, a: 1 }} />
      </UiEntity>
    </UiEntity>
  )
}
```

Every dynamic value here is a bare reference: `position: { top: state.panelTop }`, `width: state.panelWidth`, `uiBackground={{ color: state.panelColor }}`, `color={state.labelColor}`, `value={state.label}`, and one mixed-text label. Nothing is computed in the file.

## 4. Props-driven styling (a fill bar)

A `props.x` reference binds a style key inside a component, so one file serves many differently-sized instances.

```tsx
/** @jsx ReactEcs.createElement */
import ReactEcs, { Label, UiEntity } from '@dcl/sdk/react-ecs'

export interface State {}
export const state: State = {}

/** @ui-component */
export function KitProgressBar(props: { label?: string; percent?: number; fillPx?: number }) {
  return (
    <UiEntity uiTransform={{ width: 560, flexDirection: 'column' }}>
      <UiEntity
        uiTransform={{ width: '100%', height: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <Label value={`${props.label}`} fontSize={14} color={{ r: 0.973, g: 0.976, b: 0.98, a: 0.9 }} />
        <Label value={`${props.percent}%`} fontSize={14} color={{ r: 0.973, g: 0.976, b: 0.98, a: 0.7 }} />
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

## 5. Unrolled visual variants (no color props)

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
    <UiEntity uiTransform={{ flexDirection: 'row' }}>
      <UiEntity {...primary} onMouseDown={() => press({ state, props })}>
        <Label value={`${props.label}`} fontSize={18} textAlign="middle-center" color={{ r: 1, g: 1, b: 1, a: 1 }} />
      </UiEntity>
      <UiEntity {...danger} onMouseDown={() => press({ state, props })}>
        <Label value={`${props.label}`} fontSize={18} textAlign="middle-center" color={{ r: 1, g: 1, b: 1, a: 1 }} />
      </UiEntity>
    </UiEntity>
  )
}
```

The `active` expression may be any code, so the coalescing default and the comparison live there safely — only **style values** must stay bare references. The repetition is paid once inside the component instead of at every use site.

## 6. The screen that composes them

A top-level root (no `@ui-component` marker) is pure composition. Each instance that needs positioning gets a wrapper `UiEntity`, because a component ref cannot be moved or sized from outside.

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
      <UiEntity uiTransform={{ positionType: 'absolute', position: { left: 40, bottom: 40 } }}>
        <KitProgressBar label="Download" percent={42} fillPx={state.downloadPx560} />
      </UiEntity>
      <UiEntity uiTransform={{ positionType: 'absolute', position: { right: 24, top: 24 } }}>
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

## 7. The aggregator

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
