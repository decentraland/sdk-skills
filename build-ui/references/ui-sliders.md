# Drag sliders in React-ECS UI

Read this when the user asks for a slider, a drag handle, a scrub bar, or any UI driven by dragging.

**Short answer: drag sliders ARE supported.** Build them with `PrimaryPointerInfo.screenDelta`, not with the UI event handlers alone. Confirmed working in-world in both the Unity and the Bevy explorers.

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
3. A full-screen, pointer-blocking overlay rendered **only while dragging** catches the release, so letting go outside the narrow track still ends the drag.

Step 3 is one of the two sanctioned exceptions to build-ui's rule that a `100%`×`100%` wrapper must never be pointer-blocking. It is safe *only* because it is gated: `{isDragging() && …}` means the blocking rect exists for the duration of a drag and is gone the rest of the time. Never hoist that `pointerFilter: 'block'` / `onMouseUp` onto a permanent full-screen wrapper to "simplify" — that blocks every click in the scene forever.

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

// screenDelta is in REAL screen pixels; the UI is laid out in virtual pixels
// scaled by react-ecs. Undo that scaling so the drag tracks the cursor 1:1.
// Mirrors @dcl/react-ecs's own UiScaleSystem — SDK 7.26.0+ form.
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

## Gotchas

- **Do not read the current value back through a JSX closure.** `get: () => props.value` captures the props object from the render frame where the drag began, so it returns a stale constant — the slider jitters around its start value instead of accumulating. The drag state must own its own `current` accumulator. (Hit and fixed during in-engine testing.)
- **`TRACK_WIDTH_PX` must match the rendered track width in virtual px**, or drag speed won't match the cursor. If the track is sized with `flexGrow: 1`, compute it from the parent: e.g. a 300-wide panel with `padding: 14` and two 26px buttons with 6px margins gives `300 - 28 - 26 - 26 - 12 = 208`.
- **Always divide by the UI scale factor**, and compute it with the same formula the scene's `@dcl/react-ecs` uses. Skipping it makes the drag over- or under-shoot on any screen whose resolution differs from `virtualWidth`/`virtualHeight`.
- **The formula is SDK-version dependent — check `@dcl/sdk` in the scene's `package.json`.** `uiScaleFactor()` above is the **7.26.0+** form. On a scene pinned **below 7.26.0**, react-ecs also divides its layout by `devicePixelRatio`, so the helper must match it or the drag under-shoots on every high-density screen:

  ```ts
  // Below SDK 7.26.0 ONLY — react-ecs divides its own layout by devicePixelRatio there.
  // Do NOT use this form on 7.26.0+; it reintroduces the very mismatch it corrects.
  const s = Math.min(c.width / VIRTUAL_WIDTH, c.height / VIRTUAL_HEIGHT) / (c.devicePixelRatio || 1)
  ```

  If you inherit slider code carrying the `devicePixelRatio` divisor and the scene is on 7.26.0+, remove the divisor. See the version gate in `build-ui/SKILL.md`.
- **`VIRTUAL_WIDTH`/`VIRTUAL_HEIGHT` must match what the renderer actually resolved to**, not just what you think you passed. If the renderer options omit a virtual size, the SDK applies a platform default (`1920x1080` non-mobile, `1600x720` mobile), and a 16:9 size passed on mobile is overridden to `1600x720`. Passing the size explicitly to `setUiRenderer` keeps these constants honest.
- **Desktop only.** `screenDelta` always reports 0 on mobile (no free-moving cursor), and `pointerType` only has `POT_NONE`/`POT_MOUSE`. Pair the track with `-`/`+` stepper `Button`s — they give fine adjustment on desktop and are the whole interface on mobile. Branch with `isMobile()` from `@dcl/sdk/platform` if you want to hide the track entirely.
- **Read `screenDelta` inside a system.** It only holds one frame of movement, and touching `engine.RootEntity` during initial scene load can error.
- **Vertical sliders**: the SDK docs state the screen origin is bottom-left, so positive `delta.y` means the mouse moved up — invert it for a top-down track. Horizontal drags need no such adjustment.

## Porting this to an editor-editable UI

The mechanic ports cleanly to UI that the Creator Hub's UI Designer can read and edit — verified in-world in a real scene. The drag machinery is unaffected (it lives in the driver, outside `src/ui/`); only two things change shape:

- Starting a drag becomes a `/** @ui-action */` body that sets both the value and a `state.dragTarget` selector — action bodies are free-form, so nothing is lost.
- The conditionally-rendered release catcher above is **not** expressible there (`{cond && <X/>}` makes the subtree opaque). It becomes an always-present full-screen overlay whose `useInteraction` `active` layer sets `display: 'none'` while no drag is running — same gating, different mechanism.

Full worked implementation (reusable slider component, hybrid tap-to-step + drag, driver): see the **editable-ui** skill, `references/drag-slider.md`.

## Why not `screenCoordinates`

`PrimaryPointerInfo.screenCoordinates` gives an absolute cursor position, which looks like a way to jump the value to the clicked position. Avoid it for sliders: it forces you to hardcode the track's screen rect as canvas fractions, breaks the moment the track sits inside a flex layout or an `InteractableArea`/`ScreenInsetArea` wrapper, and freezes at the screen center whenever the cursor is locked. Delta accumulation has none of those failure modes.
