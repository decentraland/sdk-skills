# UI Components Reference — React ECS

## Setup

```typescript
// ui.tsx
import ReactEcs, { ReactEcsRenderer, UiEntity, Label, Button, Input, Dropdown } from '@dcl/sdk/react-ecs'

export function setupUi() {
  ReactEcsRenderer.setUiRenderer(MyUI)
}
```

Only call `ReactEcsRenderer.setUiRenderer()` once per scene. Combine all UI into a single root component. The renderer function may also return an **array** of elements — `setUiRenderer(() => [PanelA(), PanelB()])` — where later items render on top of earlier ones. The options arg (`{ virtualWidth, virtualHeight }`) is optional at the API level but should be passed by default (see SKILL.md).

## UiEntity — All Props

```tsx
<UiEntity
  uiTransform={{
    // Size
    width: 300,                  // Pixels or '50%'
    height: 200,
    minWidth: 100,
    maxWidth: 500,
    minHeight: 50,
    maxHeight: 400,

    // Position
    positionType: 'absolute',    // 'absolute' | 'relative' (default)
    position: { top: 10, right: 10, bottom: 10, left: 10 },

    // Display
    display: 'flex',             // 'flex' | 'none'

    // Flexbox
    flexDirection: 'column',     // 'row' | 'column'
    justifyContent: 'center',    // 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around'
    alignItems: 'center',        // 'flex-start' | 'center' | 'flex-end' | 'stretch'
    alignContent: 'center',      // cross-axis alignment of wrapped lines
    alignSelf: 'center',         // override parent's alignItems for this element
    flexWrap: 'wrap',            // 'nowrap' | 'wrap'
    overflow: 'scroll',          // 'hidden' | 'visible' | 'scroll'
    flexGrow: 1,                 // Fill remaining space in parent

    // Spacing (values: number px, '50%', '400px', or 'auto'; margin also accepts CSS shorthand '16px 0 8px 270px')
    padding: { top: 10, bottom: 10, left: 10, right: 10 },  // or single number
    margin: { top: 5, bottom: 5, left: 5, right: 5 },       // or single number, or shorthand string

    // Layering
    opacity: 1,                  // 0–1; on the root fades whole UI, cascades multiplicatively to children
    zIndex: 0,                   // stacking among siblings; negatives allowed; does not cross parents

    // Border (also valid on Button / Input / Dropdown uiTransform)
    borderWidth: 2,
    borderColor: Color4.White(),
    borderRadius: 8
  }}

  uiBackground={{
    color: Color4.create(0, 0, 0, 0.8),           // Solid color; when combined with texture, acts as a TINT
    texture: { src: 'images/bg.png' },             // Image (src is relative to scene root)
    textureMode: 'stretch',                         // 'stretch' | 'nine-slices' | 'center'
    textureSlices: { top: 0.1, bottom: 0.1, left: 0.1, right: 0.1 },  // For nine-slices
    avatarTexture: { userId: 'user-id' }           // Avatar portrait (use instead of texture)
  }}

  uiText={{
    value: 'Hello!',
    fontSize: 18,
    color: Color4.White(),
    textAlign: 'middle-center',
    font: 'sans-serif'           // 'sans-serif' | 'serif' | 'monospace'
  }}

  // Events
  onMouseDown={() => { }}
  onMouseUp={() => { }}
  onMouseEnter={() => { }}
  onMouseLeave={() => { }}
/>
```

## Label

```tsx
<Label
  value="Score: 100"
  fontSize={18}
  color={Color4.White()}
  textAlign="middle-center"
  font="serif"
  uiTransform={{ width: 200, height: 30 }}
/>
```

**textAlign values:** `top-left`, `top-center`, `top-right`, `middle-left`, `middle-center`, `middle-right`, `bottom-left`, `bottom-center`, `bottom-right`

**font values:** `sans-serif` (default), `serif`, `monospace`

## Button

```tsx
<Button
  value="Click Me"
  variant="primary"           // 'primary' | 'secondary'
  fontSize={16}
  color={Color4.White()}      // Text color
  uiTransform={{ width: 150, height: 40 }}
  uiBackground={{ color: Color4.Blue() }}  // Override default style
  onMouseDown={() => { console.log('clicked') }}
/>
```

A `Button` can also carry a textured background and border props, e.g. a nine-slices image button. `value` supports simple markup like `<b>`:

```tsx
<Button
  value="<b>OK</b>"
  textAlign="middle-center"
  fontSize={28}
  color={Color4.White()}
  uiTransform={{ width: 214, height: 74 }}
  uiBackground={{ texture: { src: 'images/ok_button.png' }, textureMode: 'nine-slices' }}
  onMouseDown={() => {}}
/>
```

Alternatively, a plain `UiEntity` with `uiText`, `uiBackground` and `onMouseDown` behaves as a clickable button without the `Button` component's default styling.

## Input

```tsx
<Input
  placeholder="Enter text..."
  placeholderColor={Color4.Gray()}
  color={Color4.Black()}
  fontSize={16}
  font="sans-serif"
  textAlign="middle-left"
  disabled={false}
  uiTransform={{ width: 250, height: 40 }}           // also accepts borderWidth/borderColor/borderRadius
  uiBackground={{ color: Color4.White() }}
  onChange={(value) => { console.log('Changing:', value) }}
  onSubmit={(value) => { console.log('Submitted:', value) }}
/>
```

**Uncontrolled:** the field manages its own text; it does not re-read the `value` prop every frame like React. To clear it programmatically, set `value` to a non-empty sentinel (`' '`) for one frame, then back to `''`. Read typed text from `onChange`, not from a bound `value`.

## Dropdown

```tsx
<Dropdown
  options={['Option A', 'Option B', 'Option C']}
  selectedIndex={0}
  onChange={(index) => { console.log('Selected:', index) }}
  fontSize={14}
  color={Color4.Black()}
  font="sans-serif"
  textAlign="middle-left"
  uiTransform={{ width: 200, height: 40 }}            // also accepts borderWidth/borderColor/borderRadius
  uiBackground={{ color: Color4.Teal() }}
  acceptEmpty={true}
  emptyLabel="-- Select --"
  disabled={false}
/>
```

`onChange` receives the selected **index**. With `acceptEmpty` the empty entry is index-shifted; drive `selectedIndex` from a module variable to control it externally (e.g. prev/next buttons).

## ScreenInsetArea (Mobile Hardware-Safe Region)

Wraps children so they stay inside the device's hardware-reserved margins — notch, status bar, home indicator, rounded corners. Mobile-only effect: on desktop the insets are `(0,0,0,0)`, so the wrapper has no effect and is safe to leave in cross-platform UI. Reacts automatically to insets reported by the device (rotation, system bars appearing/hiding).

The component sets its own `positionType: 'absolute'` and `position` from the device insets — those two fields in `uiTransform` are reserved and ignored. All other `uiTransform`, `uiBackground`, and event props are forwarded normally.

```tsx
import ReactEcs, { ReactEcsRenderer, UiEntity, ScreenInsetArea } from '@dcl/sdk/react-ecs'
import { Color4 } from '@dcl/sdk/math'

export function setupUi() {
  ReactEcsRenderer.setUiRenderer(() => (
    <ScreenInsetArea
      uiTransform={{
        // positionType and position are reserved — any values here are ignored
        padding: 10,
        flexDirection: 'column',
        alignItems: 'center'
      }}
    >
      {/* A child sized 100%×100% fills the safe area exactly */}
      <UiEntity
        uiTransform={{ width: '100%', height: '100%' }}
        uiBackground={{ color: Color4.create(0, 0, 0, 0.5) }}
      />
    </ScreenInsetArea>
  ), { virtualWidth: 1920, virtualHeight: 1080 })
}
```

**Hardware insets vs. Decentraland system HUD:** `ScreenInsetArea` only covers the physical device's reserved regions. It does *not* avoid Decentraland's on-screen controls (joystick, chat, profile, interaction button) — keep those clear manually by placing UI away from the left side, top-right, and bottom-right of the canvas on mobile.

## Layout Patterns

### Health Bar

```tsx
<UiEntity
  uiTransform={{ width: 200, height: 20, positionType: 'absolute', position: { bottom: 20, left: '50%' } }}
  uiBackground={{ color: Color4.create(0.3, 0.3, 0.3, 0.8) }}
>
  <UiEntity
    uiTransform={{ width: `${health}%`, height: '100%' }}
    uiBackground={{ color: Color4.create(0.2, 0.8, 0.2, 1) }}
  />
</UiEntity>
```

### Modal Dialog

```tsx
const Modal = () => {
  if (!isOpen) return null
  return (
    <UiEntity
      uiTransform={{ width: '100%', height: '100%', positionType: 'absolute', alignItems: 'center', justifyContent: 'center' }}
      uiBackground={{ color: Color4.create(0, 0, 0, 0.5) }}
    >
      <UiEntity
        uiTransform={{ width: 400, height: 300, flexDirection: 'column', alignItems: 'center', padding: 20 }}
        uiBackground={{ color: Color4.create(0.2, 0.2, 0.2, 1) }}
      >
        <Label value="Title" fontSize={24} />
        <Button value="Close" variant="primary" onMouseDown={() => { isOpen = false }} uiTransform={{ width: 100, height: 40 }} />
      </UiEntity>
    </UiEntity>
  )
}
```

### Scrollable Container

```tsx
<UiEntity
  uiTransform={{
    width: 300,
    height: 400,
    overflow: 'scroll',
    flexDirection: 'column',
  }}
>
  {/* Children exceeding 400px height become scrollable via drag or mouse wheel */}
  {items.map((item, i) => (
    <UiEntity
      key={i}
      uiTransform={{ width: '100%', height: 80 }}
      uiBackground={{ color: i % 2 === 0 ? Color4.create(0.2, 0.2, 0.2, 1) : Color4.create(0.25, 0.25, 0.25, 1) }}
    >
      <Label value={item.name} fontSize={14} />
    </UiEntity>
  ))}
</UiEntity>
```

### Dialog with Fixed Header and Scrollable Body

```tsx
<UiEntity uiTransform={{ width: 400, height: 500, flexDirection: 'column' }}>
  {/* Fixed header */}
  <UiEntity uiTransform={{ width: '100%', height: 60 }}>
    <Label value="Inventory" fontSize={20} />
  </UiEntity>
  {/* Scrollable body fills remaining space */}
  <UiEntity
    uiTransform={{
      width: '100%',
      flexGrow: 1,
      overflow: 'scroll',
      flexDirection: 'column',
    }}
  >
    {items.map((item, i) => (
      <UiEntity key={i} uiTransform={{ width: '100%', height: 80 }}>
        <Label value={item.name} fontSize={14} />
      </UiEntity>
    ))}
  </UiEntity>
</UiEntity>
```

### Inventory Grid

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

## UiCanvasInformation (Responsive Design)

Fields: `width`, `height`, `devicePixelRatio` (all numbers, in virtual/scaled units when a virtual size is set).

```typescript
import { UiCanvasInformation, engine } from '@dcl/sdk/ecs'

const canvasInfo = UiCanvasInformation.get(engine.RootEntity)   // throws if not yet present
const canvasInfoSafe = UiCanvasInformation.getOrNull(engine.RootEntity) // null-safe
```

**Verified responsive pattern (test scene 76):** the component sizes itself from a module-level object that a system refreshes each frame, so absolute pixel sizes track the live canvas:

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

Prefer `%` sizing where possible; reach for `UiCanvasInformation` when you need exact pixel math against the current screen.

## State Management

React hooks (`useState`, `useEffect`) are NOT available. Use module-level variables:

```typescript
let score = 0
let showMenu = false

const UI = () => (
  <UiEntity uiTransform={{ width: '100%', height: '100%' }}>
    <Label value={`Score: ${score}`} fontSize={20} />
    {showMenu && <MenuPanel />}
  </UiEntity>
)

// Update from game logic
export function addScore(points: number) { score += points }
export function toggleMenu() { showMenu = !showMenu }
```

The UI re-renders every frame, so module-level variable changes are reflected immediately.

## Important Rules

- File must be `.tsx` for JSX support
- Only one `ReactEcsRenderer.setUiRenderer()` per scene
- No React hooks — use module-level variables
- Use `display: 'none'` to hide elements without removing them
- UI renders as a 2D overlay on top of the 3D scene
