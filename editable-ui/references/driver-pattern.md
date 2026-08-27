# The driver pattern

The editor parses **only** `.tsx` files directly under `src/ui/`. A component's `export const state` is a plain module object, so ordinary scene code can import it and mutate it every frame. That split is the whole technique:

> **The editor owns structure, style, and every bound value's rest state. The driver owns the clock, the easing math, and every derived value.**

Everything that used to be impossible in an editable UI — timers, tweens, auto-hide, live progress, UV-rotation spinners, slide-in transitions, one-shot click animations — works through this, at zero editability cost. What the editor has no representation for is the motion itself: it sees a bound key and its rest value; the curve, duration and target live in driver code it never reads.

Put the driver in `src/ui-behaviors.ts` (or any `.ts` file **outside** `src/ui/`) and register it from `main()`.

## What must move into the driver

| Belongs in the driver | Because in `src/ui/` it would |
|---|---|
| clocks, elapsed time, `Date.now()` deadlines, `setTimeout`-style auto-hide | be a computed value → frozen node |
| easing / tween math | be arithmetic in a style value → frozen node |
| `padStart`, rounding, number→string formatting | be a call inside a template literal → frozen node |
| percent → px conversion for a fill bar | be arithmetic → frozen node |
| state machines, sequencing, queues | need conditionals → opaque or frozen |
| reading the ECS (player position, camera, component data) | not be expressible at all |

## 1. Eased open/close on a bound width and alpha

The rest value in `state` is the fully-open design; the driver animates from 0 up to it.

```ts
// src/ui-behaviors.ts
import { engine } from '@dcl/sdk/ecs'
import { state as banner } from './ui/GpMessageBanner'

const OPEN_TIME = 0.25 // s
const OPEN_WIDTH = 894 // must match banner.panelWidth's rest value

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)
const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t)

let anim = 0

export function registerUiBehaviors() {
  engine.addSystem((dt: number) => {
    const target = banner.visible ? 1 : 0
    anim = clamp01(anim + ((target > anim ? 1 : -1) * dt) / OPEN_TIME)
    const t = easeOutCubic(anim)
    banner.panelWidth = Math.max(1, Math.round(OPEN_WIDTH * t))
    banner.textColor.a = t
  })
}
```

The component binds `width: state.panelWidth` and `color={state.textColor}` and contains no math.

## 2. Formatted text into a string variable

```ts
import { state as timer } from './ui/GpParkourTimer'

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0')
  const cs = Math.floor((seconds % 1) * 100).toString().padStart(2, '0')
  return mins > 0 ? `${mins}:${secs}.${cs}` : `${secs}.${cs}`
}

let elapsed = 0

// inside the system:
elapsed += dt
timer.label = formatTime(elapsed)
timer.labelColor = { r: 1, g: 1, b: 1, a: 1 }
```

The component is just `<Label value={state.label} color={state.labelColor} />`. For a readout with fixed surrounding text, keep the literal in the UI and bind only the value: `` value={`Score: <b>${state.score}</b>`} `` with the driver writing a rounded `state.score`.

## 3. Two-variable exit gate (animate out, then hide)

A single `visible` flag cannot both drive an exit animation and hide the element — the display gate would hide it before the animation plays. Use two variables:

- `visible: boolean` — **intent**, flipped by `@ui-action` handlers and by gameplay code.
- `hidden: boolean` — the **render gate** the `useInteraction` active layer reads (`state.hidden === true`), cleared/set by the driver only.

```ts
import { state as dialog } from './ui/GpGuideDialog'

let anim = 0

// inside the system:
if (dialog.visible) dialog.hidden = false // show immediately, then fade in
const target = dialog.visible ? 1 : 0
anim = clamp01(anim + ((target > anim ? 1 : -1) * dt) / 0.25)
const t = easeOutCubic(anim)
dialog.panelColor.a = t
dialog.borderColor.a = t
dialog.textColor.a = t
if (target === 0 && anim <= 0) dialog.hidden = true // release only when finished
```

## 4. Action → driver handshake (no timers in the UI)

An action mutates state synchronously and returns. Anything time-based is a request the driver picks up next frame.

```tsx
// in src/ui/GpGuideDialog.tsx
/** @ui-action */
function pressNext({ state }: UiAction) {
  state.nextRequested = true
}
```

```ts
// in the driver's system
if (dialog.nextRequested) {
  dialog.nextRequested = false
  dialogLine++
  if (dialogLine >= LINES.length) dialog.visible = false
  else dialog.text = LINES[dialogLine]
}
```

The same shape covers one-shot animations: the action sets `state.pulsePlay = true`, the driver plays one burst and clears the flag.

## 5. Derived values need their own variable

There is no way to express "45% of this track" in an editable style value. Give every derived value its own state variable and keep the relationship in the driver.

```ts
// downloadPercent is the meaningful value; downloadPx560 is what the 560px bar binds
ui.downloadPx560 = Math.round((ui.downloadPercent / 100) * 560)
```

Name the variable after the track it feeds so the pairing is visible to whoever reads the file next. The editor cannot see the relationship — it only sees two independent variables.

## 6. Naming-convention drivers (optional, for larger UIs)

Once a scene has many animated variables, a suffix convention keeps the driver generic instead of hand-written per component: register a component's `state` object once, and let the driver drive any variable whose name matches a suffix.

```ts
export function registerUiBehaviors(state: Record<string, unknown>) { /* scan keys once, tick them */ }
```

Conventions that have been built and verified in a real scene:

| Suffix | Type | Behavior |
|---|---|---|
| `*Cycle` | number | counts 0–239 at 8 steps/s — any cadence derives from it in an `active` expression (`state.motionCycle % 8 === 3`) |
| `*Blink` | boolean | flips every 0.5 s |
| `*Seconds` | number | elapsed whole seconds |
| `*Percent` | number | drifts to a new random 0–100 target every 3 s |
| `*Px<N>` | number | the matching `*Percent` scaled onto an N-px track (`downloadPx560`) |
| `*AutoHide` | boolean | turns itself off 2.5 s after being set true |
| `*SpinUvs` / `*WiggleUvs` | number[] | rotates / wiggles a `uvs` quad around its center |
| `*PulseSize` | number | eases 0.8×–1.2× of its initial value |
| `*Bounce` / `*Shake` | number | eased offset for `position.top` / `position.left` |
| `*FlashColor` | Color4 | lerps to a companion `<name>To` color and back |
| `*Slide` | number | replays an eased 40-px approach whenever its trigger variable changes |
| `<name>Play` | boolean | gates any of the above into a one-shot; the driver clears it |

Two caveats found in practice: all instances of a convention share one phase (module state), so two toasts cannot slide independently — a real app wants per-instance variables; and a `number[]` variable binds correctly but the panel mislabels it as a string list.

## Registration

```ts
// src/index.ts
import { setupUi } from './ui'
import { registerUiBehaviors } from './ui-behaviors'

export function main() {
  setupUi()
  registerUiBehaviors()
}
```

Capture each bound variable's initial value at registration time and animate around it — that keeps the value in `state` meaningful as the **designable rest state**, so a designer can restyle from the editor panel without touching driver code.
