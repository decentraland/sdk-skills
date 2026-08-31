---
name: advanced-input
description: System-level input polling, player movement control, and mobile on-screen controls in Decentraland. Covers inputSystem, InputModifier, PointerLock, PrimaryPointerInfo, and TouchScreenControls. Use when the user wants continuous key polling, WASD-controlled entities, to freeze the player during a cutscene, FPS-style cursor lock, multi-key combo patterns, or to hide/customize the mobile joystick, crosshair, or on-screen buttons. For event-driven clicks and hover on entities see add-interactivity.
---

# Advanced Input Handling in Decentraland

For basic click/hover events, see the `add-interactivity` skill. This skill covers advanced input patterns. Prefer `pointerEventsSystem.onPointerDown()` (add-interactivity) for simple entity clicks; use `inputSystem` for complex multi-key or polling patterns.

## Pointer Lock State

Detect whether the cursor is captured (first-person mode) or free:

```typescript
import { engine, PointerLock } from '@dcl/sdk/ecs'

function checkPointerLock() {
  const isLocked = PointerLock.get(engine.CameraEntity).isPointerLocked

  if (isLocked) {
    // Cursor is captured — player is in first-person control
  } else {
    // Cursor is free — player can click UI elements
  }
}

engine.addSystem(checkPointerLock)
```

### Requesting / releasing pointer lock (writable)

`PointerLock.isPointerLocked` is a plain writable boolean — a scene can request or release cursor capture by mutating it (verified: `31,20-pointer-lock-control` sets it from click handlers and a timed system):

```typescript
PointerLock.createOrReplace(engine.CameraEntity, { isPointerLocked: false })
// request lock (e.g. from a button)
PointerLock.getMutable(engine.CameraEntity).isPointerLocked = true
// release lock
PointerLock.getMutable(engine.CameraEntity).isPointerLocked = false
```

PITFALL: `getMutable(engine.CameraEntity)` throws if `PointerLock` was never created on the camera. Call `PointerLock.createOrReplace(engine.CameraEntity, { isPointerLocked: false })` once in `main()` before mutating. Writing `true` is a *request*; the client/player may still control actual capture (e.g. Esc unlocks).

### Pointer Lock Change Detection

```typescript
PointerLock.onChange(engine.CameraEntity, (pointerLock) => {
  if (pointerLock?.isPointerLocked) {
    console.log('Cursor locked')
  } else {
    console.log('Cursor unlocked')
  }
})
```

## Cursor Position and World Ray

Get the cursor's screen position and the ray it casts into the 3D world:

```typescript
import { engine, PrimaryPointerInfo } from '@dcl/sdk/ecs'

function readPointer() {
  const pointerInfo = PrimaryPointerInfo.getOrCreateMutable(engine.RootEntity)
  console.log('Cursor position:', pointerInfo.screenCoordinates)
  console.log('Cursor delta:', pointerInfo.screenDelta)
  console.log('World ray direction:', pointerInfo.worldRayDirection)
}

engine.addSystem(readPointer)
```

### Field details

- `screenCoordinates` _(optional Vector2)_ — cursor position in pixels. **Origin is the bottom-left corner of the screen** (positive Y = up). When the cursor is locked, freezes at the screen center.
- `screenDelta` _(optional Vector2)_ — how many pixels the mouse moved since the last frame. Positive `x` = right, positive `y` = up (bottom-left origin). **Keeps reporting raw mouse movement while the cursor is locked** — unlike `screenCoordinates` and `worldRayDirection`, which freeze at screen center. This makes `screenDelta` the only way to read mouse movement during pointer lock, and the correct input for mouselook / FPS camera controls (see the **camera-control** skill's mouselook pattern). `screenDelta` is always 0 on mobile (no continuous cursor); `screenCoordinates` and `worldRayDirection` work on both platforms.
- `worldRayDirection` _(optional Vector3)_ — direction from the camera through the cursor. Freezes at center ray while locked.
- `pointerType` — `0` for none, `1` for mouse.

PITFALL: every field is optional — verified schema and `0,5-primary-cursor-info`, which guards each read (`pointerInfo.screenCoordinates?.x ?? -666`, `pointerInfo.worldRayDirection?.x.toFixed(2)`). Use `getOrCreateMutable(engine.RootEntity)` so the component exists before first read, and always null-check the fields. `worldRayDirection` feeds directly into a camera raycast direction (see the "spawn at cursor" pattern in that scene).

## Input Polling with inputSystem

### Per-Entity Input Commands

Check if a specific input action occurred on a specific entity:

```typescript
import { engine, inputSystem, InputAction, PointerEventType } from '@dcl/sdk/ecs'

function myInputSystem() {
  // Check for click on a specific entity
  const clickData = inputSystem.getInputCommand(
    InputAction.IA_POINTER,
    PointerEventType.PET_DOWN,
    myEntity
  )

  if (clickData) {
    console.log('Entity clicked via system:', clickData.hit.entityId)
  }
}

engine.addSystem(myInputSystem)
```

The returned command carries `hit` data (position and entity) — use `getInputCommand()` when you need to know what was clicked.

Omit the entity argument to check globally (any entity / no target). Pass `InputAction.IA_ANY` to match any action — `getInputCommand(InputAction.IA_ANY, PointerEventType.PET_DOWN)` returns the command for whatever key was pressed, and `cmd.button` tells you which one (verified: `0,1-input-modifier`).

For the Tag-based per-entity cookbook (mark entities with a Tag, fetch them with `engine.getEntitiesByTag`, and poll each with `getInputCommand` inside a system), see `{baseDir}/references/input-patterns.md` → "Per-Entity Input Command Cookbook (Tag-based)".



### Global Input Checks

Check if a specific key was pressed, regardless of if the player's cursor was pointing at an entity or not.

Use `isTriggered()` for one-shot actions (fire a weapon, open a door) — it returns true only on the frame the key is first pressed. Use `isPressed()` for continuous actions (movement, holding a shield) — it returns true every frame while held.

```typescript
function globalInputSystem() {
  // Was the key just pressed this frame?
  if (inputSystem.isTriggered(InputAction.IA_PRIMARY, PointerEventType.PET_DOWN)) {
    console.log('E key pressed!')
  }

  // Is the key currently held down?
  if (inputSystem.isPressed(InputAction.IA_SECONDARY)) {
    console.log('F key is held!')
  }
}

engine.addSystem(globalInputSystem)
```

## All InputAction Values

| InputAction | Key/Button |
|-------------|-----------|
| `IA_POINTER` | Left mouse button |
| `IA_PRIMARY` | E key |
| `IA_SECONDARY` | F key |
| `IA_ACTION_3` | 1 key |
| `IA_ACTION_4` | 2 key |
| `IA_ACTION_5` | 3 key |
| `IA_ACTION_6` | 4 key |
| `IA_JUMP` | Space key |
| `IA_FORWARD` | W key |
| `IA_BACKWARD` | S key |
| `IA_LEFT` | A key |
| `IA_RIGHT` | D key |
| `IA_WALK` | Control key |
| `IA_MODIFIER` | Shift key (run) |
| `IA_ANY` | Matches any input action (wildcard — use with `getInputCommand`) |

## Event Types

```typescript
PointerEventType.PET_DOWN         // Button/key pressed
PointerEventType.PET_UP           // Button/key released
PointerEventType.PET_HOVER_ENTER  // Cursor enters entity
PointerEventType.PET_HOVER_LEAVE  // Cursor leaves entity
```

## InputModifier (Movement Restriction)

Restrict or freeze the player's movement:

```typescript
import { engine, InputModifier } from '@dcl/sdk/ecs'

// Freeze player completely
InputModifier.create(engine.PlayerEntity, {
  mode: InputModifier.Mode.Standard({ disableAll: true })
})

// Restrict specific movement (all flags optional; a false/omitted flag is ignored)
InputModifier.createOrReplace(engine.PlayerEntity, {
  mode: InputModifier.Mode.Standard({
    disableWalk: true,
    disableJog: true,
    disableRun: true,
    disableJump: true,
    disableEmote: true,
    disableDoubleJump: true,
    disableGliding: true
  })
})

// Restore normal movement
InputModifier.deleteFrom(engine.PlayerEntity)
```

**Standard flags** (all optional booleans; verified `input_modifier.gen.d.ts`): `disableAll`, `disableWalk`, `disableJog`, `disableRun`, `disableJump`, `disableEmote`, `disableDoubleJump`, `disableGliding`. A `false`/omitted flag is ignored (consumes no bandwidth). `InputModifier.Mode.Standard({...})` and the raw `{ $case: 'standard', standard: {...} }` form are equivalent (both seen in test scenes).

**Important:** InputModifier only works in the DCL 2.0 desktop client. It has no effect in the web browser explorer — test with the desktop client if your scene relies on it.

### Cutscene Pattern

For the worked cutscene flow (freeze the player with `disableAll` during a cinematic, then restore movement with `InputModifier.deleteFrom`), see `{baseDir}/references/input-patterns.md` → "Cutscene Pattern (freeze player during a cinematic)".

## WASD Movement Pattern

For the WASD-driven custom-entity pattern (poll `IA_FORWARD`/`IA_BACKWARD`/`IA_LEFT`/`IA_RIGHT` with `isPressed` to move a `Transform`, plus the note on freezing the avatar with `InputModifier` and how polling WASD relates to player movement), see `{baseDir}/references/input-patterns.md` → "WASD Movement Pattern (drive a custom entity)".

## Combining Input Patterns

For the action-bar / number-key pattern (map `IA_ACTION_3`–`IA_ACTION_6` to ability slots via `isTriggered`), see `{baseDir}/references/input-patterns.md` → "Action Bar with Number Keys".

## Platform detection

Detect whether the scene is running on mobile to conditionally adapt controls and UI:

```typescript
import { getPlatform, isMobile } from '@dcl/sdk/platform'

// getPlatform() returns 'mobile' | 'desktop' | 'web' | null
// Returns null until the explorer reports its platform (async, shortly after scene start)
// Defer platform-dependent setup until getPlatform() is non-null:
function platformCheckSystem() {
  if (getPlatform() === null) return
  engine.removeSystem(platformCheckSystem)
  if (isMobile()) {
    // mobile-specific setup here (e.g. larger UI, touch-friendly interactions)
  }
}
engine.addSystem(platformCheckSystem)
```

Import from `@dcl/sdk/platform`. Verified against docs commit `17ca7be`.

## On-screen touch controls (`TouchScreenControls`)

Brief: configures the mobile client's **native** on-screen controls — the virtual joystick, the crosshair, and the gamepad buttons. SDK **7.26.0+**.

```typescript
import { engine, TouchScreenControls, InputAction } from '@dcl/sdk/ecs'
```

- Set it on **`engine.RootEntity`** — the client reads it nowhere else.
- Applied while the player is inside the scene; reverts to defaults on exit, so scenes that don't use it are unaffected.
- **No-op** on platforms without native on-screen controls (desktop), and no effect in VR. Safe to write unconditionally — no `isMobile()` guard needed.
- Covers **input controls only**. The client's own HUD (emote wheel, profile, chat, minimap) is not affected by this component.

`PBTouchScreenControls` fields:

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `touchInputs` | `PBTouchScreenControls_TouchInput[]` | `[]` | Per-button overrides. A button not listed keeps its default (shown, default glyph). |
| `mainAction` | `InputAction \| undefined` | `undefined` | Which action the large central button triggers. When unset, the default (`IA_JUMP`) is kept. |
| `hideJoystick` | `boolean` | `false` | Removes the native virtual joystick. |
| `hideCrosshair` | `boolean` | `false` | Hides the on-screen crosshair / reticle. |

`TouchInput` entry: `{ inputAction: InputAction, hide: boolean, icon?: TextureUnion }` — `icon` overrides the button glyph with a scene image; on `IA_JUMP` it replaces all of its dynamic states (jump / double-jump / glide).

**Only gamepad actions map to an on-screen button**: `IA_POINTER` (interaction), `IA_PRIMARY` (E), `IA_SECONDARY` (F), `IA_JUMP` (central), `IA_ACTION_3`..`IA_ACTION_6` (1/2/3/4). Any other `InputAction` — movement actions, `IA_ANY`, `IA_MODIFIER`, unknown/future values — is ignored: a `touchInputs` entry naming one has no effect, and a `mainAction` that isn't a valid gamepad action falls back to `IA_JUMP`.

Convenience helpers on the component (each writes `RootEntity` and merges with the current value, so they can be called from anywhere):

| Helper | Effect |
| --- | --- |
| `TouchScreenControls.hide(actions: InputAction[])` | Hide the given buttons, merged into the current config. |
| `TouchScreenControls.hideAll()` | Hide all eight gamepad buttons. |
| `TouchScreenControls.showAll()` | Clear the button hide list. Does **not** touch joystick/crosshair. |
| `TouchScreenControls.setMainAction(action: InputAction)` | Set the large central button's action. |
| `TouchScreenControls.hideJoystick()` / `.showJoystick()` | Toggle the native virtual joystick. |
| `TouchScreenControls.hideCrosshair()` / `.showCrosshair()` | Toggle the crosshair / reticle. |

```typescript
TouchScreenControls.hideJoystick()
TouchScreenControls.setMainAction(InputAction.IA_PRIMARY)
TouchScreenControls.hide([InputAction.IA_ACTION_3, InputAction.IA_ACTION_4])
```

Gotchas:
- `showAll()` resets `touchInputs` to `[]`, which also **discards any custom `icon`** set through it. Re-apply icons afterwards.
- Hiding a button does not disable the action — `inputSystem` still reports it if it can be triggered another way. Hiding removes the *button*, not the *input*.
- Hiding the joystick leaves mobile players with no native way to walk; replace it with scene UI or make the scene intentionally stationary.
- Buttons cannot be repositioned. Their slots are fixed; a scene only chooses which are visible and which one leads.

Combine with `UiInputBinding` (the `uiInputBinding` prop on `UiEntity`, see **build-ui**) to build custom on-screen action buttons: hide the native buttons here, then bind the same `InputAction`s to your own scene UI.

For the button priority stack and the "+" overflow rules, custom icons, and full worked examples, see `{baseDir}/references/touch-screen-controls.md`.

## Mobile considerations

Key facts from the mobile docs expansion (commit `17ca7be`):
- **Touch-only input** -- no mouse hover states, keyboard shortcuts, or right-click.
- **`borderRadius` unsupported on mobile UI** -- avoid rounded corners in mobile-targeting scenes.
- **On-screen controls ARE scene-configurable** on SDK 7.26.0+ via `TouchScreenControls` -- hide the joystick, the crosshair, or individual gamepad buttons, re-bind the central button, or swap a button glyph for a scene image. Their positions are still fixed. This supersedes older docs claiming the mobile HUD is static. See the `TouchScreenControls` section above.
- **The old "~3x scaling for mobile" rule no longer applies as written.** On SDK 7.26.0+ pixel-sized UI is already ~2–3× larger on a phone than before (`devicePixelRatio` was removed from the UI scale factor), and the mobile virtual screen (`1600x720` vs desktop's `1920x1080`) adds ~1.2× more. Start from the desktop sizes, measure on a device, and scale up only what comes up short. See [[build-ui]].
- **UI is kept inside the device's safe area (notch, home indicator) automatically on SDK 7.26.0+** — the renderer's `screenInset` option defaults to `'device'`. Only pass `screenInset: 'none'` if you want the UI over the whole screen; the `ScreenInsetArea` component is then available to inset individual subtrees. Below 7.26.0, wrap the UI in `ScreenInsetArea` (from `@dcl/sdk/react-ecs`) yourself. See [[build-ui]].
- **SDK features not yet on mobile:** ParticleSystem, scene dynamic lights (PBPointLight), AudioAnalysis, nine-slice UI tile mode. Check the docs for the latest feature parity tracker.

## Example scenes

Engine-team test scenes exercising these APIs (ground truth):

- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/0,1-input-modifier — InputModifier standard flags (incl. `disableWalk`/`disableJog`), `getInputCommand(IA_ANY, PET_DOWN)` to read whichever key was pressed.
- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/31,20-pointer-lock-control — writing `PointerLock.isPointerLocked` to request/release cursor capture; `PointerLock.onChange`.
- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/0,5-primary-cursor-info — reading `PrimaryPointerInfo` (screen coords/delta/worldRayDirection) each frame; feeding `worldRayDirection` into a camera raycast.
- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/2,22-virtual-cameras — WASD-driven controllable camera via `isPressed(IA_FORWARD/...)`; toggling InputModifier alongside a VirtualCamera.
- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/0,0-cube-spawner — system-based per-entity click via `getEntitiesWith(Cube, PointerEvents)` + `inputSystem.isTriggered(IA_POINTER, PET_DOWN, entity)`.
- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/32,20-virtual-camera-mouse-look — `PrimaryPointerInfo.screenDelta` driving mouselook camera while pointer locked; shows `screenDelta` continuing to report raw mouse movement during lock (while `screenCoordinates` freezes at screen center).

## References

- `{baseDir}/references/input-patterns.md` — branch-specific worked patterns: Tag-based per-entity input cookbook, cutscene freeze/restore flow, WASD-driven custom entity, action-bar number-key mapping.
- `{baseDir}/references/touch-screen-controls.md` — `TouchScreenControls`: button priority stack and "+" overflow rules, custom button icons, declutter/full-custom-HUD examples, helper semantics.

For basic pointer events and click handlers, see the `add-interactivity` skill.
