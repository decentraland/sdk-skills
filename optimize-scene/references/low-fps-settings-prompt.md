# Low-FPS settings prompt

Companion to **optimize-scene** → *Low-FPS settings prompt*. Detects a low frame rate from scene code and offers a button that opens the Explorer's settings panel, so a player whose graphics settings are too high for their machine can lower them. Source: the Decentraland docs, *Performance optimization → Help players adjust their settings*.

## Rules the pattern encodes

- **Measure the Explorer's frames, not your ticks.** FPS = `EngineInfo.frameNumber` delta ÷ `totalRuntime` delta. Only the scene the player stands in ticks once per frame; a tick counter reads low in any other loaded scene, on any machine.
- **5 s windows, threshold 20 FPS** (average). Drop a window longer than 10 s (scene paused, clock changed): it says nothing.
- **Start over while `sceneHidden`** (loading screen up), and **skip the first window after each loading screen**: it can still include assets loading in, which is slow on any machine.
- **Prompt once per session**, with a Dismiss button. A recurring popup on a struggling machine makes it worse.
- **`openExplorerUi` first in the button handler.** The click is the player gesture the call needs; anything awaited before it pushes the call out of the window (**scene-runtime** → *openExplorerUi*). Treat the result as a rough signal, not a measurement.

## Code

```tsx
import { engine, EngineInfo, ExplorerUi } from '@dcl/sdk/ecs'
import { openExplorerUi } from '~system/RestrictedActions'
import ReactEcs, { Button, Label, ReactEcsRenderer, UiEntity } from '@dcl/sdk/react-ecs'

let showSettingsTip = false
let tipAlreadyShown = false

// Average Explorer FPS over 5 s windows
let windowStartFrame = -1
let windowStartTime = 0
let firstWindow = true

engine.addSystem(() => {
  const info = EngineInfo.getOrNull(engine.RootEntity)
  if (!info || tipAlreadyShown) return
  if (info.sceneHidden) {
    // Loading screen up: start over, and skip the first window after it
    windowStartFrame = -1
    firstWindow = true
    return
  }
  if (windowStartFrame < 0) {
    windowStartFrame = info.frameNumber
    windowStartTime = info.totalRuntime
    return
  }
  const elapsed = info.totalRuntime - windowStartTime
  if (elapsed > 0 && elapsed < 5) return
  const valid = elapsed >= 5 && elapsed < 10
  if (valid && !firstWindow && (info.frameNumber - windowStartFrame) / elapsed < 20) {
    showSettingsTip = true
    tipAlreadyShown = true
  }
  if (valid) firstWindow = false
  windowStartFrame = info.frameNumber
  windowStartTime = info.totalRuntime
})

ReactEcsRenderer.setUiRenderer(() => (
  <UiEntity
    uiTransform={{
      display: showSettingsTip ? 'flex' : 'none',
      flexDirection: 'column',
      positionType: 'absolute',
      position: { top: 40, right: 40 },
      padding: 10,
    }}
    uiBackground={{ color: { r: 0, g: 0, b: 0, a: 0.8 } }}
  >
    <Label value="Running slow? Try lowering your graphics settings." fontSize={16} />
    <UiEntity uiTransform={{ flexDirection: 'row', margin: { top: 8 } }}>
      <Button
        value="Open Settings"
        fontSize={16}
        uiTransform={{ height: 36 }}
        onMouseDown={() => {
          void openExplorerUi({ ui: ExplorerUi.EU_SETTINGS }) // first, before anything else
          showSettingsTip = false
        }}
      />
      <Button
        value="Dismiss"
        fontSize={16}
        uiTransform={{ height: 36, margin: { left: 8 } }}
        onMouseDown={() => {
          showSettingsTip = false
        }}
      />
    </UiEntity>
  </UiEntity>
))
```

In a scene that already has a UI renderer, render the tip from that renderer instead of calling `setUiRenderer` again, and give the Label and Buttons explicit sizes and `textWrap="nowrap"` (**build-ui** → *Sizing and mobile*).
