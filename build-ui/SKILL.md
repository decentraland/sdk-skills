---
name: build-ui
description: Build 2D screen-space UI for Decentraland scenes using React-ECS (JSX). Create HUDs, menus, health bars, scoreboards, dialogs, buttons, inputs, and dropdowns. Use when the user wants screen overlays, on-screen UI, HUD elements, menus, or form inputs. Do NOT use for 3D in-world text (see advanced-rendering) or clickable 3D objects (see add-interactivity).
---

# Building UI with React-ECS

Decentraland SDK7 uses a React-like JSX system for 2D UI overlays.

## When to Use Which UI Approach

| Need | Approach | Component |
|------|----------|-----------|
| Screen-space HUD, menus, buttons | React-ECS (this skill) | `UiEntity`, `Label`, `Button`, `Input`, `Dropdown` |
| 3D text floating in the world | TextShape + Billboard | See **advanced-rendering** skill |
| Open a web page | `openExternalUrl` | See **scene-runtime** skill |
| Clickable objects in 3D space | Pointer events | See **add-interactivity** skill |

Use React-ECS for any 2D overlay: scoreboards, health bars, dialogs, inventories, settings menus. Use TextShape for labels above NPCs or objects in the 3D world.

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

### tsconfig.json (already configured by /init)

The SDK template already includes the required JSX settings — do NOT modify tsconfig.json:
- `"jsx": "react-jsx"`
- `"jsxImportSource": "@dcl/sdk/react-ecs-lib"`

## Core Components

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

## Virtual Screen Size (Scaling for All Resolutions)

Always set `virtualWidth` and `virtualHeight` when calling `setUiRenderer` or `addUiRenderer`. This establishes a reference coordinate system so UI elements scale proportionally across all screen sizes.

```tsx
ReactEcsRenderer.setUiRenderer(MyUI, { virtualWidth: 1920, virtualHeight: 1080 })
```

The scaling factor is `Math.min(realWidth / virtualWidth, realHeight / virtualHeight)`. For example, on a 4K (3840×2160) screen, a 100px element scales to 200 actual pixels — maintaining the same proportions as on a 1080p screen.

Use `1920 × 1080` as the standard reference resolution.

## Adding Independent UI Renderers (addUiRenderer)

Use `ReactEcsRenderer.addUiRenderer()` to render a UI module independently from the main UI, without replacing it. This is useful for smart items or modular scene components that each manage their own UI.

Each renderer requires an entity as its owner:

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
```

To remove it:
```typescript
ReactEcsRenderer.removeUiRenderer(owner)
```

If the owner entity is destroyed, the UI is removed automatically.

## State Management

Use module-level variables for UI state (React hooks are NOT available):

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

Read screen size via `UiCanvasInformation`:

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

Use `textureSlices` for scalable UI backgrounds (buttons, panels) that don't stretch corners:

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

Use the `uvs` property on a `uiBackground` component to display a specific region of a texture. This is useful for picking individual sprites from a sprite sheet, or for rotating an image.

The `uvs` field takes an array of 8 numbers, representing 4 pairs of UV coordinates for the four corners of the texture region. The order is: **bottom-left**, **top-left**, **top-right**, **bottom-right**. Each value ranges from 0 to 1, where `(0, 0)` is the bottom-left corner of the image and `(1, 1)` is the top-right.

When using custom `uvs`, set `textureMode` to `'stretch'` so the selected region fills the entity's area.

**Sprites from a sprite sheet:**

```tsx
import { UiEntity, ReactEcs } from '@dcl/sdk/react-ecs'

// Display the left half of a texture (e.g. the first card in a 2-column sheet)
export const uiMenu = () => (
  <UiEntity
    uiTransform={{ width: 200, height: 300 }}
    uiBackground={{
      textureMode: 'stretch',
      texture: { src: 'images/card-atlas.png' },
      uvs: [
        // bottom-left, top-left, top-right, bottom-right
        0, 0,
        0, 1,
        0.5, 1,
        0.5, 0
      ]
    }}
  />
)
```

For a sprite sheet with a grid of frames, calculate UVs based on column and row:

```tsx
import { UiEntity, ReactEcs } from '@dcl/sdk/react-ecs'

// Pick a single frame from a grid sprite sheet
function getFrameUVs(col: number, row: number, totalCols: number, totalRows: number): number[] {
  const stepU = 1 / totalCols
  const stepV = 1 / totalRows
  const left = col * stepU
  const right = (col + 1) * stepU
  const top = 1 - row * stepV
  const bottom = 1 - (row + 1) * stepV
  return [
    left, bottom,
    left, top,
    right, top,
    right, bottom
  ]
}

// Display column 2, row 0 of a 4x2 sprite sheet
export const uiMenu = () => (
  <UiEntity
    uiTransform={{ width: 128, height: 128 }}
    uiBackground={{
      textureMode: 'stretch',
      texture: { src: 'images/spritesheet.png' },
      uvs: getFrameUVs(2, 0, 4, 2)
    }}
  />
)
```

**Rotating an image with UVs:**

Rotate a texture by applying a 2D rotation to the UV coordinates — useful for spinners or loading indicators.

```tsx
import { UiEntity, ReactEcs } from '@dcl/sdk/react-ecs'
import { engine } from '@dcl/sdk/ecs'

// Rotate a 2D point around a center
function rotate2D(angle: number, x: number, y: number, cx: number, cy: number): number[] {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return [
    cos * (x - cx) - sin * (y - cy) + cx,
    sin * (x - cx) + cos * (y - cy) + cy
  ]
}

// Build rotated UV coordinates
function rotateUVs(angle: number): number[] {
  const uv00 = rotate2D(angle, 0, 0, 0.5, 0.5)
  const uv01 = rotate2D(angle, 0, 1, 0.5, 0.5)
  const uv11 = rotate2D(angle, 1, 1, 0.5, 0.5)
  const uv10 = rotate2D(angle, 1, 0, 0.5, 0.5)
  return [uv00[0], uv00[1], uv01[0], uv01[1], uv11[0], uv11[1], uv10[0], uv10[1]]
}

let spinnerAngle = 0

// System that updates the angle each frame
engine.addSystem((dt: number) => {
  spinnerAngle += dt * 5
})

export const uiMenu = () => (
  <UiEntity
    uiTransform={{ width: 128, height: 128 }}
    uiBackground={{
      textureMode: 'stretch',
      texture: { src: 'images/spinner.png' },
      uvs: rotateUVs(spinnerAngle)
    }}
  />
)
```

### Hover Events

Respond to mouse enter/leave for hover effects:

```tsx
<UiEntity
  uiTransform={{ width: 100, height: 40 }}
  onMouseEnter={() => { isHovered = true }}
  onMouseLeave={() => { isHovered = false }}
  uiBackground={{ color: isHovered ? Color4.White() : Color4.Gray() }}
/>
```

### Flex Wrap

Allow UI children to wrap to the next line:

```tsx
<UiEntity uiTransform={{ flexWrap: 'wrap', width: 300 }}>
  {items.map(item => (
    <UiEntity key={item.id} uiTransform={{ width: 80, height: 80, margin: 4 }} />
  ))}
</UiEntity>
```

### Dropdown Extras

The `Dropdown` component supports additional props:

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

## dcl-ui-toolkit (Pre-Built Widgets)

For common UI elements (prompts, counters, progress bars, announcements), use `dcl-ui-toolkit` instead of building everything from scratch with React-ECS.

```bash
npm install dcl-ui-toolkit
```

### Setup

```typescript
import * as ui from 'dcl-ui-toolkit'
import { ReactEcsRenderer } from '@dcl/sdk/react-ecs'

// Register in main() — use ui.render as the renderer, or combine with custom UI:
ReactEcsRenderer.setUiRenderer(ui.render)

// To combine with your own React-ECS UI:
// ReactEcsRenderer.setUiRenderer(() => [ui.render(), MyCustomUI()])
```

**When to use dcl-ui-toolkit vs React-ECS:**
- Prompt/dialog? → `displayOkPrompt`, `displayOptionPrompt`, `CustomPrompt`
- Health bar, score counter? → `createBar`, `createCounter`
- Flash announcement? → `displayAnnouncement`
- Custom panel, inventory, complex layout? → React-ECS directly

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

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| UI not appearing at all | Missing `ReactEcsRenderer.setUiRenderer()` call | Add `ReactEcsRenderer.setUiRenderer(MyUI)` in `main()` or `setupUi()` |
| UI elements overlapping | Missing `flexDirection` or wrong layout | Set `flexDirection: 'column'` on the parent container |
| Button clicks not registering | Missing `onMouseDown` handler | Add `onMouseDown={() => { ... }}` to the Button or UiEntity |
| JSX errors at compile time | File extension is `.ts` instead of `.tsx` | Rename the file to `.tsx` |
| Multiple UIs fighting | More than one `setUiRenderer` call | Only call `setUiRenderer` once — combine all UI into a single root component, or use `addUiRenderer` with separate owner entities for independent modules |
| Text not visible | Text color matches background | Set contrasting `color` on Label or `uiText` |

> **World interactions instead of screen UI?** See the **add-interactivity** skill for click handlers and pointer events on 3D objects.

## Important Notes

- React hooks (`useState`, `useEffect`, etc.) are **NOT** available — use module-level variables
- The UI renderer re-renders every frame, so state changes are reflected immediately
- UI is rendered as a 2D overlay on top of the 3D scene
- Use `display: 'none'` in `uiTransform` to hide elements without removing them
- File extension must be `.tsx` for JSX support
- Only one `ReactEcsRenderer.setUiRenderer()` call per scene — combine all UI into one root component, or use `addUiRenderer()` with separate owner entities for independent modules
- Always set `virtualWidth` and `virtualHeight` in `setUiRenderer`/`addUiRenderer` so the UI scales correctly across screen sizes
- **Desktop:** Avoid placing UI elements on the leftmost ~25% of the screen, as that area is reserved for the chat, map, and other platform UI
- **Mobile:** Avoid placing UI elements in the device's non-safe zones (notch, status bar, home indicator areas)

For full component props (UiEntity, Label, Button, Input, Dropdown), layout patterns, and responsive design, see `{baseDir}/references/ui-components.md`.
