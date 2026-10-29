# Advanced Input — Branch-Specific Patterns

Long worked patterns extracted from the `advanced-input` SKILL.md. Read this file when a task needs one of these specific flows. Basic capability usage (isTriggered/isPressed teaching, InputModifier basics + desktop-client warning, PointerLock detection, PrimaryPointerInfo basics, the InputAction/event-type tables, rules, and troubleshooting) stays in SKILL.md.

## Per-Entity Input Command Cookbook (Tag-based)

(For the single-entity `getInputCommand` and `IA_ANY` global basics, see SKILL.md.)

Best practice: use the Tag component to mark all entities that share a same interaction, then iterate over them in a system.

```typescript
import { engine, inputSystem, InputAction, PointerEventType, Tags } from '@dcl/sdk/ecs'

function myInputSystem() {

  // fetch entities with a particular tag
  const taggedEntities = engine.getEntitiesByTag('myTag')
  
  // iterate over those entities
	for (const entity of taggedEntities) {
         // Check for click on a specific entity
        const clickData = inputSystem.getInputCommand(
          InputAction.IA_POINTER,
          PointerEventType.PET_DOWN,
          entity
        )

        if (clickData) {
          console.log('Entity clicked via system:', clickData.hit.entityId)
        }
    }

}

engine.addSystem(myInputSystem)
```

## Root-Entity Input (timestamp watermark)

Use when a scene must tell a press that hit no entity from a click on some entity (e.g. "press E anywhere except on a station"). The entity-less `isTriggered` / `getInputCommand` cannot: they read every entity's results, and `engine.RootEntity` (`0`, falsy) takes the same branch. Read the root's own result list instead. It grows across frames, so track the newest timestamp already handled:

```typescript
import { engine, PointerEventsResult, PointerEventType } from '@dcl/sdk/ecs'

let lastRootTimestampSeen = 0
engine.addSystem(() => {
  let maxTimestamp = lastRootTimestampSeen
  for (const cmd of PointerEventsResult.get(engine.RootEntity)) {
    if (cmd.timestamp <= lastRootTimestampSeen) continue
    if (cmd.timestamp > maxTimestamp) maxTimestamp = cmd.timestamp
    if (cmd.state !== PointerEventType.PET_DOWN) continue
    // ...handle the root-level press (cmd.button is the InputAction)...
  }
  lastRootTimestampSeen = maxTimestamp
})
```

Ground truth: `149,149-synthetic-input-showcase` in sdk7-test-scenes.

## Cutscene Pattern (freeze player during a cinematic)

Freeze the player during a cinematic sequence:

```typescript
function startCutscene() {
  // Freeze player
  InputModifier.create(engine.PlayerEntity, {
    mode: InputModifier.Mode.Standard({ disableAll: true })
  })

  // ... play cinematic with VirtualCamera ...

  // After cutscene ends, restore movement
  // InputModifier.deleteFrom(engine.PlayerEntity)
}
```

## WASD Movement Pattern (drive a custom entity)

Poll movement keys to control custom entities:

```typescript
import { engine, inputSystem, InputAction, PointerEventType, Transform } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

const MOVE_SPEED = 5

function customMovementSystem(dt: number) {
  const transform = Transform.getMutable(controllableEntity)
  let moveX = 0
  let moveZ = 0

  if (inputSystem.isPressed(InputAction.IA_FORWARD)) moveZ += 1
  if (inputSystem.isPressed(InputAction.IA_BACKWARD)) moveZ -= 1
  if (inputSystem.isPressed(InputAction.IA_LEFT)) moveX -= 1
  if (inputSystem.isPressed(InputAction.IA_RIGHT)) moveX += 1

  transform.position.x += moveX * MOVE_SPEED * dt
  transform.position.z += moveZ * MOVE_SPEED * dt
}

engine.addSystem(customMovementSystem)
```

WASD keys (`IA_FORWARD`, etc.) also control player movement — polling them reads the movement state but does not override it. To make WASD drive a custom entity instead of the avatar, freeze the avatar with `InputModifier`.

## Action Bar with Number Keys

```typescript
function actionBarSystem() {
  if (inputSystem.isTriggered(InputAction.IA_ACTION_3, PointerEventType.PET_DOWN)) {
    console.log('Slot 1 activated')
    useAbility(1)
  }
  if (inputSystem.isTriggered(InputAction.IA_ACTION_4, PointerEventType.PET_DOWN)) {
    console.log('Slot 2 activated')
    useAbility(2)
  }
  if (inputSystem.isTriggered(InputAction.IA_ACTION_5, PointerEventType.PET_DOWN)) {
    console.log('Slot 3 activated')
    useAbility(3)
  }
  if (inputSystem.isTriggered(InputAction.IA_ACTION_6, PointerEventType.PET_DOWN)) {
    console.log('Slot 4 activated')
    useAbility(4)
  }
}

engine.addSystem(actionBarSystem)
```

