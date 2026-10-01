# Coded UI — free-form React-ECS

Read this only when **Choosing the mode** in `SKILL.md` sent a UI (or one panel of it) to the coded path: the UI is data-driven or dynamic in a way the Creator Hub UI editor cannot represent. Everything in `SKILL.md` about elements, sizing, placement and pointer blocking still applies. This file adds the freedom the editor takes away — and the rules that come with it. Full prop tables live in `ui-components.md`.

## Setup

### File: src/ui.tsx

```tsx
import ReactEcs, { ReactEcsRenderer, UiEntity, Label, Button } from '@dcl/sdk/react-ecs'

const MyUI = () => (
  // Required: root must fill the canvas for absolute positioning to work reliably.
  <UiEntity
    uiTransform={{
      width: '100%',
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center'
    }}
  >
    {/* Labels always declare an explicit box — an unset text dimension is
        measured on Bevy but contributes 0 to layout on Unity. */}
    <Label value="Hello Decentraland!" fontSize={24} uiTransform={{ width: 400, height: 40 }} />
  </UiEntity>
)

export function setupUi() {
  ReactEcsRenderer.setUiRenderer(MyUI, { virtualWidth: 1920, virtualHeight: 1080 })
}
```

### File: src/index.ts

```typescript
import { setupUi } from './ui'

export function main() {
  setupUi()
}
```

Canonical renderer call — use verbatim unless the user specifies otherwise:

```tsx
ReactEcsRenderer.setUiRenderer(MyUI, { virtualWidth: 1920, virtualHeight: 1080 })
```

Only one `setUiRenderer` per scene. **A second call does not throw — it silently overwrites the first** (`system.ts` just assigns `uiComponent = ui`), so only the last root renders and the earlier UI vanishes with no error. Independent modules go through `addUiRenderer` (below). The renderer function may also return an **array** — `setUiRenderer(() => [PanelA(), PanelB()])` — where later items render on top of earlier ones.

## DEFAULT RULE: always set the virtual screen size to 1920x1080

The SDK uses a virtual screen to scale UI consistently across display resolutions: when a virtual size is active, all pixel values in `uiTransform` are relative to the virtual canvas, not the physical screen.

**Whenever you generate coded UI, pass `{ virtualWidth: 1920, virtualHeight: 1080 }` to `setUiRenderer` and `addUiRenderer` by default — without waiting for the user to ask.** Only deviate if the user explicitly requests a different reference resolution. (The editable aggregator is generated without options and gets the platform default — the same canvas.)

Why: pixel values are only meaningful against a reference resolution. Stating it pins the layout intent instead of leaving it to a per-platform default that differs between mobile and desktop. `1920x1080` matches the most common displays and the assumption in most community examples.

The options argument is optional at the API level. **On SDK 7.26.0+, omitting it does not mean "no scaling"** — a platform default applies:

| Case | Resulting virtual screen |
|---|---|
| No virtual size passed, non-mobile | `1920x1080` |
| No virtual size passed, mobile | `1600x720` |
| A 16:9 size passed (e.g. `1920x1080`), mobile | overridden to `1600x720`, logged once to console |
| A non-16:9 size passed | used as-is on every platform |
| A size with any value `<= 0` | virtual screen **disabled** — raw canvas pixels, no scaling. Silent: this is the documented opt-out |
| Only one of the two dimensions passed | also **disabled** (both are required), and logged once per size — treated as a mistake, not an opt-out |

The mobile 16:9 override exists because phone screens are much wider than 16:9 — a 16:9 canvas would letterbox the UI there.

So on 7.26.0+, `{ virtualWidth: 0, virtualHeight: 0 }` — not omitting the options — is how you opt into raw-pixel layout. Only do that if the user explicitly asks. **Below 7.26.0 there are no defaults: omitting the options is what disables scaling.** Because the default rule has you pass the size explicitly either way, generated code behaves identically on both sides of that boundary.

The virtual size is scene-wide, resolved as: the size on `setUiRenderer` wins → else the first `addUiRenderer` that passed one → else the platform default. Options carrying only a `screenInset` or `zIndex` don't count as a passed size. `setUiRenderer` wins the arbitration if it mentions *either* dimension, even when the size is incomplete and therefore invalid — `setUiRenderer(ui, { virtualWidth: 1920 })` disables the virtual screen for the whole scene and discards a valid size passed to any `addUiRenderer`. Never emit a single dimension.

API (verified against `@dcl/react-ecs` `src/system.ts`):

```ts
type UiScreenInset = 'device' | 'interactable' | 'none'
type UiRendererOptions = {
  virtualWidth?: number   // optional
  virtualHeight?: number  // optional
  screenInset?: UiScreenInset  // defaults to 'device'
  zIndex?: number              // 7.29.0+; stacking between renderers, higher in front. Default: first-render order, main UI at the back within a tick
}
setUiRenderer(ui: UiComponent, options?: UiRendererOptions): void
addUiRenderer(entity: Entity, ui: UiComponent, options?: UiRendererOptions): void
```

`screenInset` picks the area a renderer's UI is positioned in and is **per renderer**; `zIndex` stacks whole renderers. Both are detailed in `ui-components.md` (→ screenInset, → Renderer zIndex). **Do NOT wrap UI in `<ScreenInsetArea>` / `<InteractableArea>` while leaving the matching `screenInset` on the renderer** — the inset is applied twice. Rely on `screenInset`, or pass `screenInset: 'none'` and place the wrapper yourself.

## SDK VERSION GATE: 7.26.0 changed three UI-layout behaviors

**Check the scene's `@dcl/sdk` version in its `package.json` before relying on any row below.** `"latest"`, `"^7.x"` or a fresh `create-scene` project means current, so assume 7.26.0+ unless the pin says otherwise. (The editable path requires 7.26.0+ outright, so this gate only matters for coded UI on older scenes.)

| Behavior | 7.26.0 and later | Below 7.26.0 |
|---|---|---|
| **Virtual screen default** | Omitting the size applies `1920x1080` (`1600x720` mobile); a 16:9 size is overridden to `1600x720` on mobile; `<= 0` disables scaling | No default at all — omitting the size means raw canvas pixels, no scaling. `virtualWidth` / `virtualHeight` are **required** when the options object is passed |
| **`screenInset` option** | Exists, defaults to `'device'` — UI is inset from the device safe area automatically | **Does not exist.** Passing it is a type error. To inset UI you must wrap it in `<ScreenInsetArea>` / `<InteractableArea>` yourself |
| **UI scale factor and `vw` / `vh`** | `Math.min(canvasWidth / virtualWidth, canvasHeight / virtualHeight)`; `1vw` is 1% of canvas width, as in CSS | Both additionally divide by `devicePixelRatio`, so the same pixel value renders smaller on a high-density screen |

What this means when writing code:

- **Passing the virtual size explicitly is version-safe** — same layout on both sides. Prefer it always.
- **`screenInset` is not version-safe.** Only emit it on 7.26.0+. Below that, wrap in `<ScreenInsetArea>` instead — the wrapper is *correct* there, since there is no renderer-level inset to double up with. The renderer `zIndex` option is 7.29.0+.
- **Any code that recomputes the scale factor by hand must match the scene's SDK version** — most commonly drag sliders. Below 7.26.0 the `devicePixelRatio` divisor belongs in that formula; from 7.26.0 it does not. See `drag-slider.md`.
- **When migrating a scene up to 7.26.0+**, expect two visible shifts: UI that previously had no scaling now scales against a default virtual screen, and UI gains a device inset on mobile. An existing `<ScreenInsetArea>` wrapper starts double-applying — drop it or pass `screenInset: 'none'`.

## Convention: root `<UiEntity>` sets `width: '100%', height: '100%'`

Set it on the root returned to `setUiRenderer` / `addUiRenderer` whenever the UI uses absolute positioning. Do this by default. Rationale (**empirically verified**, tested in-engine June 2026):

- Without a full-canvas root, absolute-positioned children using `position: { top, right }` may fail to render entirely. In testing, a root with no explicit `width`/`height` caused a `top-right` positioned child to disappear while a `bottom-left` child rendered correctly. Adding the size fixed it.
- A full-canvas root gives absolute-positioned children a known, full-screen positioning context — the implicit assumption most HUD code makes.
- It avoids edge-case layout surprises with Yoga's default sizing for unspecified `width`/`height`.

Some engine test scenes that lay everything out with flow / `margin` (no absolute children) use a smaller root (`90%`, `50%`) and render fine — a full-canvas root is the safe default and never hurts.

**The corollary: that full-canvas root — and every other `100%`×`100%` wrapper — must stay pointer-transparent.** `uiTransform` and `uiBackground` only; never a listener, never `pointerFilter: 'block'` (`SKILL.md` → **Pointer blocking**).

## addUiRenderer (independent UI modules)

`ReactEcsRenderer.addUiRenderer(ownerEntity, MyWidget, { virtualWidth: 1920, virtualHeight: 1080 })` renders a UI module alongside the main UI without replacing it — smart items, modular scene components, or a coded panel next to an editable `src/ui/`. Remove with `ReactEcsRenderer.removeUiRenderer(owner)`; if the owner entity is destroyed, the UI is removed automatically. Re-registering the same owner replaces the renderer in place (new options applied).

A scene that only ever calls `addUiRenderer` still gets the platform default virtual screen and the default `'device'` inset — the defaults are not tied to the main renderer. The virtual size passed here is ignored if `setUiRenderer` already passed one; `screenInset` and `zIndex` are honored per renderer.

By convention the root returned to `addUiRenderer` follows the same shape as `setUiRenderer`: a full-canvas wrapper containing any absolute-positioned children.

```tsx
import ReactEcs, { ReactEcsRenderer, UiEntity, Label } from '@dcl/sdk/react-ecs'
import { engine } from '@dcl/sdk/ecs'

const MyWidget = () => (
  <UiEntity uiTransform={{ width: '100%', height: '100%' }}>
    <UiEntity uiTransform={{ positionType: 'absolute', position: { top: 10, right: 10 }, width: 120, height: 24 }}>
      <Label value="Widget" fontSize={16} uiTransform={{ width: '100%', height: '100%' }} />
    </UiEntity>
  </UiEntity>
)

export function setupWidget() {
  const owner = engine.addEntity()
  ReactEcsRenderer.addUiRenderer(owner, MyWidget, { virtualWidth: 1920, virtualHeight: 1080 })
}

// To remove:
// ReactEcsRenderer.removeUiRenderer(owner)
```

Renderers stack in the order they first render, the latest on top (main UI at the back within a tick). To pin a module in front or behind regardless, pass `zIndex` in the options (SDK 7.29.0+; `0` means "unset", use a negative value to push behind):

```tsx
// A modal registered at module load, but meant to cover every later HUD element
ReactEcsRenderer.addUiRenderer(owner, Modal, { virtualWidth: 1920, virtualHeight: 1080, zIndex: 100 })
```

Keep scene renderers below `1000` — the Admin Tools smart item's toolkit UI lives there (`ui-components.md` → Renderer zIndex).

## Hybrid scenes: a coded panel next to editable roots

The editable aggregator (`src/ui/index.tsx`) owns `setUiRenderer` with no options. Mount the coded part from a module **outside** `src/ui/` (e.g. `src/coded-ui/Inventory.tsx`) with `addUiRenderer` from `main()`:

```ts
// src/index.ts
import { setupUi } from './ui'                 // editable roots (generated aggregator)
import { registerUiBehaviors } from './ui-behaviors'
import { setupInventory } from './coded-ui/Inventory'

export function main() {
  setupUi()
  registerUiBehaviors()
  setupInventory()   // addUiRenderer(owner, Inventory, { virtualWidth: 1920, virtualHeight: 1080 })
}
```

- The aggregator passes no size, so the `addUiRenderer` size becomes the scene-wide virtual size: `1920x1080` on desktop, overridden to `1600x720` on mobile — identical to the platform defaults the editable roots are designed against, so nothing shifts (follows from `getActiveVirtualSize` / `resolveVirtualSize` in `system.ts`).
- The coded renderer gets the default `'device'` inset once (no extra wrapper), while the editable `device` roots are inset twice on mobile (`SKILL.md` → **The aggregator**). On desktop both are zero.
- Use the renderer `zIndex` option to put the coded panel above or below the editable HUD deterministically instead of relying on registration order.
- Keep the coded module's own state and systems in its file; the editable roots' `state` objects stay the driver's business. Tell the user which panel is not editable and why.

## State management

React hooks are **NOT** available. Use module-level variables; the renderer re-renders every frame, so changes show immediately. Export functions to update state from game logic. Conditional rendering and `.map()` are fine here (this is exactly what makes the file non-editable):

```tsx
import { Color4 } from '@dcl/sdk/math'

let score = 0
let showMenu = false

const GameUI = () => (
  <UiEntity uiTransform={{ width: '100%', height: '100%' }}>
    {/* HUD - always visible */}
    <Label
      value={`Score: ${score}`}
      fontSize={20}
      uiTransform={{ width: 240, height: 30, positionType: 'absolute', position: { top: 10, right: 10 } }}
    />

    {/* Menu - conditionally shown */}
    {showMenu && (
      <UiEntity
        uiTransform={{ width: 300, height: 400, positionType: 'absolute', position: { top: '50%', left: '50%' } }}
        uiBackground={{ color: Color4.create(0.1, 0.1, 0.1, 0.9) }}
      >
        <Label value="Game Menu" fontSize={24} uiTransform={{ width: '100%', height: 40, margin: { bottom: 12 } }} />
        <Button value="Resume" variant="primary" onMouseDown={() => { showMenu = false }} uiTransform={{ width: 200, height: 40 }} />
      </UiEntity>
    )}
  </UiEntity>
)

export function addScore(points: number) { score += points }
export function toggleMenu() { showMenu = !showMenu }
```

`display: 'none'` hides an element without removing it. UI renders as a 2D overlay on top of the 3D scene.

## Patterns

### Health bar

```tsx
let health = 100

const HealthBar = () => (
  <UiEntity
    uiTransform={{ width: 200, height: 20, positionType: 'absolute', position: { bottom: 20, left: '50%' } }}
    uiBackground={{ color: Color4.create(0.3, 0.3, 0.3, 0.8) }}
  >
    <UiEntity
      uiTransform={{ width: `${health}%`, height: '100%' }}
      uiBackground={{ color: Color4.create(0.2, 0.8, 0.2, 1) }}
    />
  </UiEntity>
)
```

### Modal dialog / OK prompt

One-button confirmation. A two-button choice adds a second `Button` and an `onReject` handler.

```tsx
let promptOpen = false
let promptText = ''
let onPromptAccept = () => {}

export function showPrompt(text: string, onAccept: () => void) {
  promptText = text
  onPromptAccept = onAccept
  promptOpen = true
}

const OkPrompt = () => {
  if (!promptOpen) return null
  return (
    <UiEntity
      uiTransform={{ width: '100%', height: '100%', positionType: 'absolute', alignItems: 'center', justifyContent: 'center' }}
      uiBackground={{ color: Color4.create(0, 0, 0, 0.5) }}
    >
      <UiEntity
        uiTransform={{ width: 400, height: 200, flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: 20 }}
        uiBackground={{ color: Color4.create(0.15, 0.15, 0.15, 1) }}
      >
        <Label value={promptText} fontSize={20} color={Color4.White()} textAlign="middle-center" uiTransform={{ width: '100%', height: 100 }} />
        <Button
          value="OK"
          variant="primary"
          uiTransform={{ width: 120, height: 40 }}
          onMouseDown={() => { promptOpen = false; onPromptAccept() }}
        />
      </UiEntity>
    </UiEntity>
  )
}
```

The `100%`×`100%` backdrop deliberately has **no** pointer handler and no `pointerFilter`: only the `OK` button does. If the modal should swallow background clicks while open, add `pointerFilter: 'block'` to the backdrop as a conscious choice — safe here only because the component returns `null` when closed, so the blocking rect does not exist the rest of the time.

### Full-screen modal that hides the touch controls

For UI that interrupts gameplay (scoreboard, results, shop, rules card). On mobile the native jump / E / F / interaction buttons are drawn **over** the interactable area, so a large panel is partly covered and taps there go to the client. Hide the controls while the modal is open and restore them on close. `TouchScreenControls` is a no-op on desktop, so no `isMobile()` guard is needed. Optional: freeze the avatar too with `InputModifier` (desktop client only). In a scene that uses the UI Designer's MobileHUD panel, this runtime toggle fights the panel's static call (`SKILL.md` → **MobileHUD**).

```tsx
import { engine, InputModifier, TouchScreenControls } from '@dcl/sdk/ecs'
import { Color4 } from '@dcl/sdk/math'

let scoreboardOpen = false

export function openScoreboard() {
  scoreboardOpen = true
  TouchScreenControls.hideAll()
  TouchScreenControls.hideJoystick()
  InputModifier.createOrReplace(engine.PlayerEntity, {
    mode: InputModifier.Mode.Standard({ disableAll: true })
  })
}

export function closeScoreboard() {
  scoreboardOpen = false
  TouchScreenControls.showAll()      // also clears any custom button icons — re-apply them here if the scene set some
  TouchScreenControls.showJoystick()
  InputModifier.deleteFrom(engine.PlayerEntity)
}

const Scoreboard = () => {
  if (!scoreboardOpen) return null
  return (
    <UiEntity
      uiTransform={{ width: '100%', height: '100%', positionType: 'absolute', alignItems: 'center', justifyContent: 'center' }}
      uiBackground={{ color: Color4.create(0, 0, 0, 0.7) }}
    >
      <UiEntity
        uiTransform={{ width: 700, height: 500, flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: 24 }}
        uiBackground={{ color: Color4.create(0.12, 0.12, 0.12, 1) }}
      >
        <Label value="Scoreboard" fontSize={32} color={Color4.White()} uiTransform={{ width: '100%', height: 48 }} textAlign="middle-center" />
        {/* rows … */}
        <Button value="Close" variant="primary" uiTransform={{ width: 160, height: 48 }} onMouseDown={closeScoreboard} />
      </UiEntity>
    </UiEntity>
  )
}
```

Always route every close path (close button, timer, leaving the area) through `closeScoreboard()` so the controls are never left hidden. If the modal is a **rules card**, keep its content to 3–5 short lines or a diagram image (**game-design** → "Rules: show, don't tell").

### Timed announcement

Centered flash message that clears itself. Uses `timers.setTimeout` from `@dcl/sdk/ecs` (not the native global).

```tsx
import { timers } from '@dcl/sdk/ecs'
import { Color4 } from '@dcl/sdk/math'

let announcement = ''

export function announce(text: string, seconds: number = 3) {
  announcement = text
  timers.setTimeout(() => { announcement = '' }, seconds * 1000)
}

const Announcement = () => {
  if (!announcement) return null
  return (
    <UiEntity
      uiTransform={{ width: '100%', height: '100%', positionType: 'absolute', alignItems: 'center', justifyContent: 'center' }}
    >
      {/* Dark backing panel keeps white text legible over any background. Explicit sizes,
          not auto-sizing from the text: an unset text dimension contributes 0 on Unity. */}
      <UiEntity
        uiTransform={{ width: 900, height: 64, padding: { top: 8, bottom: 8, left: 24, right: 24 } }}
        uiBackground={{ color: Color4.create(0, 0, 0, 0.6) }}
      >
        <Label value={announcement} fontSize={40} color={Color4.White()} textAlign="middle-center" uiTransform={{ width: '100%', height: '100%' }} />
      </UiEntity>
    </UiEntity>
  )
}
```

Mount `OkPrompt` and `Announcement` as children of the root UI component so they overlay the rest of the HUD. Both full-screen wrappers carry **no** pointer handler and no `pointerFilter`.

### Scrollable container

Set `overflow: 'scroll'` on a parent with fixed dimensions; content that exceeds it scrolls via drag or mouse wheel. Values: `'hidden'` (clip), `'visible'` (overflow extends beyond parent), `'scroll'`.

```tsx
<UiEntity uiTransform={{ width: 300, height: 400, overflow: 'scroll', flexDirection: 'column' }}>
  {items.map((item, i) => (
    <UiEntity
      key={i}
      uiTransform={{ width: '100%', height: 80 }}
      uiBackground={{ color: i % 2 === 0 ? Color4.create(0.2, 0.2, 0.2, 1) : Color4.create(0.25, 0.25, 0.25, 1) }}
    >
      <Label value={item.name} fontSize={14} uiTransform={{ width: '100%', height: '100%' }} />
    </UiEntity>
  ))}
</UiEntity>
```

Fixed header + scrollable body with `flexGrow: 1`:

```tsx
<UiEntity uiTransform={{ width: 400, height: 500, flexDirection: 'column' }}>
  <UiEntity uiTransform={{ width: '100%', height: 60 }}>
    <Label value="Inventory" fontSize={20} uiTransform={{ width: '100%', height: '100%' }} />
  </UiEntity>
  <UiEntity uiTransform={{ width: '100%', flexGrow: 1, overflow: 'scroll', flexDirection: 'column' }}>
    {items.map((item, i) => (
      <UiEntity key={i} uiTransform={{ width: '100%', height: 80 }}>
        <Label value={item.name} fontSize={14} uiTransform={{ width: '100%', height: '100%' }} />
      </UiEntity>
    ))}
  </UiEntity>
</UiEntity>
```

### Inventory grid (flex wrap)

```tsx
<UiEntity uiTransform={{ width: 350, flexDirection: 'row', flexWrap: 'wrap' }}>
  {items.map((item, i) => (
    <UiEntity
      key={i}
      uiTransform={{ width: 70, height: 70, margin: 5, alignItems: 'center', justifyContent: 'center' }}
      uiBackground={{ color: Color4.create(0.3, 0.3, 0.3, 1) }}
      uiText={{ value: item.name, fontSize: 10 }}
      onMouseDown={() => selectItem(i)}
    />
  ))}
</UiEntity>
```

### Hover events (hand-tracked)

```tsx
<UiEntity
  uiTransform={{ width: 100, height: 40 }}
  onMouseEnter={() => { isHovered = true }}
  onMouseLeave={() => { isHovered = false }}
  uiBackground={{ color: isHovered ? Color4.White() : Color4.Gray() }}
/>
```

### Texture UV helpers (sprite sheets, rotation)

Static crops and the UV order are in `ui-components.md` → Backgrounds. Computed UVs are coded-only (in editable UI a driver writes a `number[]` state variable — `driver-pattern.md` `*SpinUvs`).

```tsx
function getFrameUVs(col: number, row: number, totalCols: number, totalRows: number): number[] {
  const stepU = 1 / totalCols
  const stepV = 1 / totalRows
  const left = col * stepU
  const right = (col + 1) * stepU
  const top = 1 - row * stepV
  const bottom = 1 - (row + 1) * stepV
  return [left, bottom, left, top, right, top, right, bottom]
}

// Display column 2, row 0 of a 4x2 sprite sheet
<UiEntity
  uiTransform={{ width: 128, height: 128 }}
  uiBackground={{ textureMode: 'stretch', texture: { src: 'images/spritesheet.png' }, uvs: getFrameUVs(2, 0, 4, 2) }}
/>
```

```tsx
function rotate2D(angle: number, x: number, y: number, cx: number, cy: number): number[] {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return [cos * (x - cx) - sin * (y - cy) + cx, sin * (x - cx) + cos * (y - cy) + cy]
}

function rotateUVs(angle: number): number[] {
  const uv00 = rotate2D(angle, 0, 0, 0.5, 0.5)
  const uv01 = rotate2D(angle, 0, 1, 0.5, 0.5)
  const uv11 = rotate2D(angle, 1, 1, 0.5, 0.5)
  const uv10 = rotate2D(angle, 1, 0, 0.5, 0.5)
  return [uv00[0], uv00[1], uv01[0], uv01[1], uv11[0], uv11[1], uv10[0], uv10[1]]
}

let spinnerAngle = 0
engine.addSystem((dt: number) => { spinnerAngle += dt * 5 })

<UiEntity
  uiTransform={{ width: 128, height: 128 }}
  uiBackground={{ textureMode: 'stretch', texture: { src: 'images/spinner.png' }, uvs: rotateUVs(spinnerAngle) }}
/>
```

### Stacked panels via array return (verified in test scene 81,-3)

```tsx
ReactEcsRenderer.setUiRenderer(() => [Panel4(), Panel3(), Panel2(), Panel1()],
  { virtualWidth: 1920, virtualHeight: 1080 })
```

Each panel is a full-canvas root; later items render on top.

### Uncontrolled input — clear trick (verified in test scene 81,-3)

```tsx
let clearInput = false
function Panel() {
  const inputValue = clearInput ? ' ' : ''
  if (clearInput) clearInput = false
  return <Input value={inputValue} onChange={(v) => { typed = v }} />
}
// on submit: typed = ''; clearInput = true
```

### Responsive sizing from UiCanvasInformation (verified in test scene 76)

A system refreshes a module-level object each frame; the component sizes itself from it. `width` / `height` are raw canvas pixels (see `ui-components.md`). Prefer `%` sizing where possible.

```typescript
// index.ts
export let canvasInfo = { width: 0, height: 0 }

export function main() {
  setupUi()
  engine.addSystem(() => {
    const c = UiCanvasInformation.getOrNull(engine.RootEntity)
    if (!c) return
    canvasInfo.width = c.width
    canvasInfo.height = c.height
  })
}
```

```tsx
// ui.tsx
import { canvasInfo } from './index'
<UiEntity uiTransform={{ width: canvasInfo.width * 0.8, height: canvasInfo.height * 0.8 }} />
```

### Dropdown driven externally

Drive `selectedIndex` from a module variable to control it from prev/next buttons:

```tsx
<Dropdown options={['Option A', 'Option B', 'Option C']} selectedIndex={selectedIdx}
  onChange={(idx) => { selectedIdx = idx }} fontSize={14} color={Color4.White()} disabled={false} />
```

## Editable equivalents

Every coded pattern above has an editable form; use it unless the pattern is genuinely data-driven.

| Coded pattern | Editable form |
|---|---|
| `{cond && <X/>}` / `return null` | `useInteraction` `active` `display: 'none'` gate on the element being hidden |
| `${health}%` fill width | driver writes `fillPx` (px) against the literal track width (`component-template.md` §5) |
| `timers.setTimeout` auto-hide | driver decrements `hideIn` per frame and flips `visible` |
| hand-tracked `isHovered` | `hover` / `press` layers |
| `.map()` over a fixed set | unrolled siblings; a `@ui-component` file for the row |
| `.map()` over runtime data | **stays coded** (own module, `addUiRenderer`) |
| `uiText` bag on a `UiEntity` | a `Label` child |
| computed UVs (spinner) | driver writes a `number[]` state variable bound to `uvs` |
| `canvasInfo.width * 0.8` | driver writes a px state variable from `UiCanvasInformation` |
| array-return stacking | tree order inside one root, or separate roots in the aggregator |
| `TouchScreenControls` on open/close | driver reacts to `state.visible`; MobileHUD panel owns the static config |
