# UI Patterns & Code Examples

## Conventions for every example below

- **The root `<UiEntity>` sets `width: '100%', height: '100%'`.** This is required for reliable absolute positioning — without it, some children (e.g. `position: { top, right }`) may not render. See the "Convention" section in `build-ui/SKILL.md` for details.
- All `setUiRenderer` / `addUiRenderer` calls pass `{ virtualWidth: 1920, virtualHeight: 1080 }` by default.

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
    <Label value="Hello Decentraland!" fontSize={24} />
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

## Core Component Examples

### UiEntity (Container)
```tsx
import { Color4 } from '@dcl/sdk/math'

<UiEntity
  uiTransform={{
    width: 300,              // Pixels or '50%'
    height: 200,
    positionType: 'absolute', // 'absolute' or 'relative' (default)
    position: { top: 10, right: 10 }, // Only with absolute
    flexDirection: 'column',  // 'row' | 'column'
    justifyContent: 'center', // 'flex-start' | 'center' | 'flex-end' | 'space-between'
    alignItems: 'center',     // 'flex-start' | 'center' | 'flex-end' | 'stretch'
    padding: { top: 10, bottom: 10, left: 10, right: 10 },
    margin: { top: 5 },
    display: 'flex'           // 'flex' | 'none' (hide)
  }}
  uiBackground={{
    color: Color4.create(0, 0, 0, 0.8) // Semi-transparent black
  }}
/>
```

### Label (Text)
```tsx
import { Color4 } from '@dcl/sdk/math'

<Label
  value="Score: 100"
  fontSize={18}
  color={Color4.White()}
  textAlign="middle-center"
  font="sans-serif"
  uiTransform={{ width: 200, height: 30 }}
/>
```

### Button
```tsx
<Button
  value="Click Me"
  variant="primary"  // 'primary' | 'secondary'
  fontSize={16}
  uiTransform={{ width: 150, height: 40 }}
  onMouseDown={() => {
    console.log('Button clicked!')
  }}
/>
```

### Input
```tsx
import { Input } from '@dcl/sdk/react-ecs'
import { Color4 } from '@dcl/sdk/math'

<Input
  placeholder="Type here..."
  fontSize={14}
  color={Color4.White()}
  uiTransform={{ width: 250, height: 35 }}
  onChange={(value) => {
    console.log('Value changing:', value)
  }}
  onSubmit={(value) => {
    console.log('Submitted:', value)
  }}
/>
```

### Dropdown
```tsx
import { Dropdown } from '@dcl/sdk/react-ecs'

<Dropdown
  options={['Option A', 'Option B', 'Option C']}
  selectedIndex={0}
  onChange={(index) => {
    console.log('Selected:', index)
  }}
  uiTransform={{ width: 200, height: 35 }}
  fontSize={14}
/>
```

---

## addUiRenderer (Independent UI Modules)

By convention, the root returned to `addUiRenderer` follows the same shape as `setUiRenderer`: a full-canvas wrapper containing any absolute-positioned children. This makes absolute positioning predictable across the project. The pattern below shows that shape.

```tsx
import ReactEcs, { ReactEcsRenderer, UiEntity, Label } from '@dcl/sdk/react-ecs'
import { engine } from '@dcl/sdk/ecs'

const MyWidget = () => (
  <UiEntity uiTransform={{ width: '100%', height: '100%' }}>
    <UiEntity uiTransform={{ positionType: 'absolute', position: { top: 10, right: 10 } }}>
      <Label value="Widget" fontSize={16} />
    </UiEntity>
  </UiEntity>
)

export function setupWidget() {
  const owner = engine.addEntity()
  ReactEcsRenderer.addUiRenderer(owner, MyWidget, { virtualWidth: 1920, virtualHeight: 1080 })
}

// To remove:
// ReactEcsRenderer.removeUiRenderer(owner)
// If the owner entity is destroyed, the UI is removed automatically.
```

---

## State Management Example

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
      uiTransform={{
        positionType: 'absolute',
        position: { top: 10, left: 10 }
      }}
    />

    {/* Menu - conditionally shown */}
    {showMenu && (
      <UiEntity
        uiTransform={{
          width: 300,
          height: 400,
          positionType: 'absolute',
          position: { top: '50%', left: '50%' }
        }}
        uiBackground={{ color: Color4.create(0.1, 0.1, 0.1, 0.9) }}
      >
        <Label value="Game Menu" fontSize={24} />
        <Button
          value="Resume"
          variant="primary"
          onMouseDown={() => { showMenu = false }}
          uiTransform={{ width: 200, height: 40 }}
        />
      </UiEntity>
    )}
  </UiEntity>
)

// Update state from game logic
export function addScore(points: number) {
  score += points
}

export function toggleMenu() {
  showMenu = !showMenu
}
```

---

## Common UI Patterns

### Health Bar
```tsx
import { Color4 } from '@dcl/sdk/math'

let health = 100

const HealthBar = () => (
  <UiEntity
    uiTransform={{
      width: 200, height: 20,
      positionType: 'absolute',
      position: { bottom: 20, left: '50%' }
    }}
    uiBackground={{ color: Color4.create(0.3, 0.3, 0.3, 0.8) }}
  >
    <UiEntity
      uiTransform={{ width: `${health}%`, height: '100%' }}
      uiBackground={{ color: Color4.create(0.2, 0.8, 0.2, 1) }}
    />
  </UiEntity>
)
```

### Image Background
```tsx
<UiEntity
  uiTransform={{ width: 200, height: 200 }}
  uiBackground={{
    textureMode: 'stretch',
    texture: { src: 'images/logo.png' }
  }}
/>
```

### Screen Dimensions
```typescript
import { UiCanvasInformation } from '@dcl/sdk/ecs'

engine.addSystem(() => {
  const canvas = UiCanvasInformation.getOrNull(engine.RootEntity)
  if (canvas) {
    console.log('Screen:', canvas.width, 'x', canvas.height)
  }
})
```

### Nine-Slice Textures
```tsx
<UiEntity
  uiTransform={{ width: 200, height: 100 }}
  uiBackground={{
    textureMode: 'nine-slices',
    texture: { src: 'images/panel.png' },
    textureSlices: { top: 0.1, bottom: 0.1, left: 0.1, right: 0.1 }
  }}
/>
```

### Texture UVs

Use `uvs` to display a specific region of a texture. The field takes 8 numbers (4 UV pairs): bottom-left, top-left, top-right, bottom-right. Values range 0-1. Set `textureMode: 'stretch'`.

**Sprites from a sprite sheet:**
```tsx
// Display the left half of a texture
<UiEntity
  uiTransform={{ width: 200, height: 300 }}
  uiBackground={{
    textureMode: 'stretch',
    texture: { src: 'images/card-atlas.png' },
    uvs: [0, 0, 0, 1, 0.5, 1, 0.5, 0]
  }}
/>
```

**Grid sprite sheet helper:**
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
  uiBackground={{
    textureMode: 'stretch',
    texture: { src: 'images/spritesheet.png' },
    uvs: getFrameUVs(2, 0, 4, 2)
  }}
/>
```

**Rotating an image with UVs:**
```tsx
function rotate2D(angle: number, x: number, y: number, cx: number, cy: number): number[] {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return [
    cos * (x - cx) - sin * (y - cy) + cx,
    sin * (x - cx) + cos * (y - cy) + cy
  ]
}

function rotateUVs(angle: number): number[] {
  const uv00 = rotate2D(angle, 0, 0, 0.5, 0.5)
  const uv01 = rotate2D(angle, 0, 1, 0.5, 0.5)
  const uv11 = rotate2D(angle, 1, 1, 0.5, 0.5)
  const uv10 = rotate2D(angle, 1, 0, 0.5, 0.5)
  return [uv00[0], uv00[1], uv01[0], uv01[1], uv11[0], uv11[1], uv10[0], uv10[1]]
}

let spinnerAngle = 0

engine.addSystem((dt: number) => {
  spinnerAngle += dt * 5
})

<UiEntity
  uiTransform={{ width: 128, height: 128 }}
  uiBackground={{
    textureMode: 'stretch',
    texture: { src: 'images/spinner.png' },
    uvs: rotateUVs(spinnerAngle)
  }}
/>
```

### Opacity & Z-Index (verified in test scene 0,6-ui-zindex-and-opacity)

`opacity` (0–1) and `zIndex` (integer, negatives allowed) live on `uiTransform`. Root opacity fades the whole UI and cascades multiplicatively to children. `zIndex` orders overlapping siblings; higher renders on top.

```tsx
<UiEntity uiTransform={{ width: '100%', height: '100%', opacity: rootOpacity }}>
  <UiEntity
    uiTransform={{
      width: 500, height: 200,
      positionType: 'absolute', position: { top: '50%', left: '45%' },
      margin: { top: -140, left: -250 },   // negative margins to center an absolute box
      zIndex: redZIndex, opacity: redOpacity
    }}
    uiBackground={{ color: Color4.Red() }}
  />
</UiEntity>
```

### Textured Backgrounds with Tint (verified in test scene 70,-9)

Setting `color` alongside a `texture` tints the image. `textureMode` controls scaling:

```tsx
// stretch tint — borders deform when the element is non-square
<UiEntity uiTransform={{ width: '50%', height: 244 }}
  uiBackground={{ color: tint, textureMode: 'stretch', texture: { src: 'img.png' } }} />

// nine-slices — borders stay crisp while the center stretches
<UiEntity uiTransform={{ width: 256, height: 256 }}
  uiBackground={{ textureMode: 'nine-slices', texture: { src: 'img.png' },
    textureSlices: { top: 0.1, bottom: 0.1, left: 0.1, right: 0.1 } }} />

// center — texture drawn at native size, centered
<UiEntity uiTransform={{ width: 300, height: 180 }}
  uiBackground={{ textureMode: 'center', texture: { src: 'img.png' } }} />

// avatar portrait — use avatarTexture instead of texture
<UiEntity uiTransform={{ width: 200, height: 200 }}
  uiBackground={{ textureMode: 'center', avatarTexture: { userId } }} />
```

### Stacked Panels via Array Return (verified in test scene 81,-3)

The renderer function can return an array; later items render on top. Each panel is a full-canvas root, so they overlay.

```tsx
ReactEcsRenderer.setUiRenderer(() => [Panel4(), Panel3(), Panel2(), Panel1()],
  { virtualWidth: 1920, virtualHeight: 1080 })
```

### Uncontrolled Input — Clear Trick (verified in test scene 81,-3)

`Input` keeps its own text; it does not re-read `value` each frame. To clear it on submit, flash a sentinel for one frame:

```tsx
let clearInput = false
function Panel() {
  const inputValue = clearInput ? ' ' : ''
  if (clearInput) clearInput = false
  return <Input value={inputValue} onChange={(v) => { typed = v }}
    onMouseDown={/* on submit */ undefined} />
}
// on submit: typed = ''; clearInput = true
```

### Hover Events
```tsx
<UiEntity
  uiTransform={{ width: 100, height: 40 }}
  onMouseEnter={() => { isHovered = true }}
  onMouseLeave={() => { isHovered = false }}
  uiBackground={{ color: isHovered ? Color4.White() : Color4.Gray() }}
/>
```

### Flex Wrap
```tsx
<UiEntity uiTransform={{ flexWrap: 'wrap', width: 300 }}>
  {items.map(item => (
    <UiEntity key={item.id} uiTransform={{ width: 80, height: 80, margin: 4 }} />
  ))}
</UiEntity>
```

### Scrollable Container

Set `overflow: 'scroll'` on a parent with fixed dimensions. Content that exceeds the parent size becomes scrollable via drag or mouse wheel. Values: `'hidden'` (clip overflow), `'visible'` (overflow extends beyond parent), `'scroll'` (scrollable).

```tsx
<UiEntity
  uiTransform={{
    width: 300,
    height: 400,
    overflow: 'scroll',
    flexDirection: 'column',
  }}
>
  {menuItems.map((item, i) => (
    <UiEntity
      key={i}
      uiTransform={{ width: '100%', height: 80 }}
      uiBackground={{ color: Color4.create(0.2, 0.2, 0.2, 1) }}
    >
      <Label value={item.name} fontSize={14} />
    </UiEntity>
  ))}
</UiEntity>
```

Use `flexGrow: 1` on scrollable entities to fill remaining space in a parent, useful for dialogs with a fixed header and scrollable body:

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

### Dropdown Extras
```tsx
<Dropdown
  options={['Option A', 'Option B', 'Option C']}
  selectedIndex={selectedIdx}
  onChange={(idx) => { selectedIdx = idx }}
  fontSize={14}
  color={Color4.White()}
  disabled={false}
/>
```

---

## Common Widgets (From Scratch)

Build widgets from React-ECS primitives — there is no pre-built widget library.

- **Prompt / dialog / confirmation** → see the **Modal Dialog** pattern in `ui-components.md` (full-screen overlay + centered panel + `Button`s). Add a second `Button` for a two-option (accept/reject) prompt.
- **Progress / health / fill bar** → see **Health Bar** above (nested `UiEntity`, inner sized `width: `${pct}%``).

### OK-Prompt Modal

One-button confirmation. A two-button choice adds a second `Button` and an `onReject` handler.

```tsx
import { Color4 } from '@dcl/sdk/math'

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

### Timed Announcement

Centered flash message that clears itself after a delay. Uses `timers.setTimeout` from `@dcl/sdk/ecs` (not the native global).

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
      {/* Dark backing panel keeps white text legible over any background */}
      <UiEntity
        uiTransform={{ padding: { top: 8, bottom: 8, left: 24, right: 24 } }}
        uiBackground={{ color: Color4.create(0, 0, 0, 0.6) }}
      >
        <Label value={announcement} fontSize={40} color={Color4.White()} textAlign="middle-center" />
      </UiEntity>
    </UiEntity>
  )
}
```

Mount `OkPrompt` and `Announcement` as children of your root UI component so they overlay the rest of the HUD.
