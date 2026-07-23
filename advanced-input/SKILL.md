---
name: advanced-input
description: System-level input polling and player movement control in Decentraland. Covers inputSystem, InputModifier, PointerLock, and PrimaryPointerInfo. Use when the user wants continuous key polling, WASD-controlled entities, to freeze the player during a cutscene, FPS-style cursor lock, or multi-key combo patterns. For event-driven clicks and hover on entities see add-interactivity.
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

PITFALL: every `PrimaryPointerInfo` field is optional (`screenCoordinates?`, `screenDelta?`, `worldRayDirection?`, `pointerType?`) — verified schema and `0,5-primary-cursor-info`, which guards each read (`pointerInfo.screenCoordinates?.x ?? -666`, `pointerInfo.worldRayDirection?.x.toFixed(2)`). Use `getOrCreateMutable(engine.RootEntity)` so the component exists before first read, and always null-check the fields. `worldRayDirection` feeds directly into a camera raycast direction (see the "spawn at cursor" pattern in that scene).

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

## Example scenes

Engine-team test scenes exercising these APIs (ground truth):

- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/0,1-input-modifier — InputModifier standard flags (incl. `disableWalk`/`disableJog`), `getInputCommand(IA_ANY, PET_DOWN)` to read whichever key was pressed.
- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/31,20-pointer-lock-control — writing `PointerLock.isPointerLocked` to request/release cursor capture; `PointerLock.onChange`.
- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/0,5-primary-cursor-info — reading `PrimaryPointerInfo` (screen coords/delta/worldRayDirection) each frame; feeding `worldRayDirection` into a camera raycast.
- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/2,22-virtual-cameras — WASD-driven controllable camera via `isPressed(IA_FORWARD/...)`; toggling InputModifier alongside a VirtualCamera.
- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/0,0-cube-spawner — system-based per-entity click via `getEntitiesWith(Cube, PointerEvents)` + `inputSystem.isTriggered(IA_POINTER, PET_DOWN, entity)`.

## References

- `{baseDir}/references/input-patterns.md` — branch-specific worked patterns: Tag-based per-entity input cookbook, cutscene freeze/restore flow, WASD-driven custom entity, action-bar number-key mapping.

For basic pointer events and click handlers, see the `add-interactivity` skill.
