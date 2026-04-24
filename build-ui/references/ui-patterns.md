# UI Patterns & Code Examples

## Setup

### File: src/ui.tsx
```tsx
import ReactEcs, { ReactEcsRenderer, UiEntity, Label, Button } from '@dcl/sdk/react-ecs'

const MyUI = () => (
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

```tsx
import ReactEcs, { ReactEcsRenderer, UiEntity, Label } from '@dcl/sdk/react-ecs'
import { engine } from '@dcl/sdk/ecs'

const MyWidget = () => (
  <UiEntity uiTransform={{ positionType: 'absolute', position: { top: 10, right: 10 } }}>
    <Label value="Widget" fontSize={16} />
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

## dcl-ui-toolkit (Pre-Built Widgets)

### Setup
```typescript
import * as ui from 'dcl-ui-toolkit'
import { ReactEcsRenderer } from '@dcl/sdk/react-ecs'

// Register in main():
ReactEcsRenderer.setUiRenderer(ui.render)

// To combine with your own React-ECS UI:
// ReactEcsRenderer.setUiRenderer(() => [ui.render(), MyCustomUI()])
```

### Simple Prompts
```typescript
// Single-button confirmation
ui.displayOkPrompt({ title: 'Notice', text: 'Quest complete!', onAccept: () => {} })

// Two-button choice
ui.displayOptionPrompt({
  title: 'Confirm',
  text: 'Buy this item for 10 MANA?',
  onAccept: () => { buyItem() },
  onReject: () => {}
})

// Text input prompt
ui.displayFillInPrompt({
  title: 'Enter name',
  placeholder: 'Type here...',
  onAccept: (value) => { console.log('Name:', value) },
  onReject: () => {}
})
```

### CustomPrompt (Fully Configurable Dialog)
```typescript
const prompt = ui.createComponent(ui.CustomPrompt, { style: ui.PromptStyles.DARKSLANTED })
// Styles: DARKSLANTED, LIGHTROUND, DARKROUND, LIGHTSLANTED

prompt.addText({ value: 'Welcome!', color: Color4.Yellow(), size: 24 })
prompt.addButton({ style: ui.ButtonStyles.E, text: 'Accept', onMouseDown: () => { prompt.hide() } })
prompt.addButton({ style: ui.ButtonStyles.F, text: 'Decline', onMouseDown: () => { prompt.hide() } })
// ButtonStyles: E, F, CLOSE, ROUNDGREEN, ROUNDWHITE, ROUNDRED, SQUAREGREEN, SQUAREWHITE, SQUARERED
prompt.addCheckbox({ text: 'Don\'t show again', onCheck: () => {}, onUncheck: () => {} })
prompt.addSwitch({ text: 'Enable notifications', onCheck: () => {}, onUncheck: () => {}, style: ui.PromptSwitchStyles.ROUNDGREEN })
prompt.addTextBox({ placeholder: 'Enter text...', onChange: (value) => {} })
prompt.addIcon({ image: 'images/icon.png', width: 64, height: 64 })

prompt.show()   // show the prompt
prompt.hide()   // hide the prompt
```

### HUD Elements
```typescript
// Flash announcement (center screen)
ui.displayAnnouncement('Round starts in 3...', 3, { color: Color4.Red(), fontSize: 24 })

// Numeric counter (top-left area)
const counter = ui.createCounter({ value: 0, xOffset: 10, yOffset: 10 })
counter.setValue(5)
counter.increment()     // +1
counter.decrement()     // -1
counter.hide()
counter.show()

// Corner text label
const label = ui.createCornerLabel({ value: 'Score: 0', xOffset: 10, yOffset: 50 })
label.setValue('Score: 150')

// Progress bar
const bar = ui.createBar({
  value: 50,            // 0-100
  xOffset: 10, yOffset: 120,
  width: 200, height: 20,
  color: Color4.Green(),
  backgroundColor: Color4.Gray()
})
bar.setValue(75)

// Corner icon
const icon = ui.createCornerIcon({ image: 'images/heart.png', xOffset: 10, yOffset: 200, width: 48, height: 48 })

// Loading spinner
const loading = ui.createLoadingIcon({ xOffset: 0, yOffset: 0 })
loading.start()
loading.stop()

// Full-screen image flash
const splashImg = ui.createLargeImage({ image: 'images/splash.jpg', xOffset: 0, yOffset: 0, width: 800, height: 600 })
```
