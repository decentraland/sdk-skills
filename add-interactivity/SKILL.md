---
name: add-interactivity
description: Event-driven interactivity for Decentraland entities. Covers pointerEventsSystem (onPointerDown/Up/hover on entities), proximity events (onProximityDown/Up/Enter/Leave for nearby interactions without aiming), trigger areas (enter/exit zones), raycasting, and one-shot key presses on entities. Use when the user wants clickable objects, hover highlights, proximity-based interactions, detecting when a player enters a zone, E/F key actions on an entity, or ray-hit detection. For system-level polling (held keys, WASD movement, cursor lock, InputModifier, action bar) see advanced-input. For screen-space UI buttons see build-ui.
---

# Adding Interactivity to Decentraland Scenes

## RULE: Fetch composite entities — never re-create them

If the entity to make interactive was defined in `assets/scene/main.composite`, **look it up by name or tag in `index.ts`**. Do NOT call `engine.addEntity()` + component create — that would create a duplicate.

```typescript
import { engine, pointerEventsSystem, InputAction } from '@dcl/sdk/ecs'
import { EntityNames } from '../assets/scene/entity-names'

export function main() {
  // By name (type-safe via auto-generated EntityNames enum)
  const door = engine.getEntityOrNullByName(EntityNames.Door_1)
  if (door) {
    pointerEventsSystem.onPointerDown(
      { entity: door, opts: { button: InputAction.IA_PRIMARY, hoverText: 'Open' } },
      () => { /* open door */ }
    )
  }

  // By tag (batch operations on groups of composite entities)
  const crystals = engine.getEntitiesByTag('Crystal')
  for (const crystal of crystals) {
    pointerEventsSystem.onPointerDown(
      { entity: crystal, opts: { button: InputAction.IA_PRIMARY, hoverText: 'Collect' } },
      () => { /* collect crystal */ }
    )
  }
}
```

These lookups must happen inside `main()` or functions called after `main()` — composite entities are not instantiated before that point.

---

## Decision Tree

| Need | Approach | API |
|------|----------|-----|
| Click/hover on a specific entity | Pointer events | `pointerEventsSystem.onPointerDown()` |
| Button press when player is nearby (no aiming needed) | Proximity events | `pointerEventsSystem.onProximityDown()` |
| Detect player entering an area | Trigger area | `TriggerArea` + `triggerAreaEventsSystem` |
| Poll key state every frame | Global input | `inputSystem.isTriggered()` / `isPressed()` |
| Detect objects in a direction | Raycasting | `raycastSystem` or `Raycast` component |
| Read cursor position / lock state | Cursor state | `PointerLock`, `PrimaryPointerInfo` |

---

## Pointer Events (Click / Hover)

### Using the Helper System (Recommended)
```typescript
import { engine, Transform, MeshRenderer, pointerEventsSystem, InputAction } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

const cube = engine.addEntity()
Transform.create(cube, { position: Vector3.create(8, 1, 8) })
MeshRenderer.setBox(cube)

// Add click handler
pointerEventsSystem.onPointerDown(
  {
    entity: cube,
    opts: {
      button: InputAction.IA_POINTER,    // Left click
      hoverText: 'Click me!',
      maxDistance: 10
    }
  },
  (event) => {
    console.log('Cube clicked!', event.hit?.position)
  }
)
```

### All Input Actions
```typescript
InputAction.IA_POINTER    // Left mouse button
InputAction.IA_PRIMARY    // E key
InputAction.IA_SECONDARY  // F key
InputAction.IA_ACTION_3   // 1 key
InputAction.IA_ACTION_4   // 2 key
InputAction.IA_ACTION_5   // 3 key
InputAction.IA_ACTION_6   // 4 key
InputAction.IA_JUMP       // Space key
InputAction.IA_FORWARD    // W key
InputAction.IA_BACKWARD   // S key
InputAction.IA_LEFT       // A key
InputAction.IA_RIGHT      // D key
InputAction.IA_WALK       // Shift key
```

### All Event Types
```typescript
PointerEventType.PET_DOWN             // Button pressed
PointerEventType.PET_UP               // Button released
PointerEventType.PET_HOVER_ENTER      // Cursor enters entity
PointerEventType.PET_HOVER_LEAVE      // Cursor leaves entity
PointerEventType.PET_PROXIMITY_ENTER  // Player walks within entity's proximity range
PointerEventType.PET_PROXIMITY_LEAVE  // Player moves out of entity's proximity range
```

### Pointer Up (Release)
```typescript
pointerEventsSystem.onPointerDown(
  { entity: cube, opts: { button: InputAction.IA_POINTER, hoverText: 'Hold me' } },
  () => { console.log('Pressed!') }
)

pointerEventsSystem.onPointerUp(
  { entity: cube, opts: { button: InputAction.IA_POINTER } },
  () => { console.log('Released!') }
)
```

### Hover Enter and Leave

Detect when the player's cursor starts or stops pointing at an entity — useful for custom hover effects like sounds or animations:

```typescript
pointerEventsSystem.onPointerHoverEnter(
  { entity: myEntity, opts: { button: InputAction.IA_POINTER } },
  () => { console.log('Cursor started hovering over entity') }
)

pointerEventsSystem.onPointerHoverLeave(
  { entity: myEntity, opts: { button: InputAction.IA_POINTER } },
  () => { console.log('Cursor stopped hovering over entity') }
)
```

### Removing Handlers
```typescript
pointerEventsSystem.removeOnPointerDown(cube)
pointerEventsSystem.removeOnPointerUp(cube)
pointerEventsSystem.removeOnPointerHoverEnter(cube)
pointerEventsSystem.removeOnPointerHoverLeave(cube)
```

### Important: Colliders Required
Pointer events only work on entities with a **collider**, using the `ColliderLayer.CL_POINTER` layer. Add one if your entity doesn't have a mesh:
```typescript
import { MeshCollider } from '@dcl/sdk/ecs'
MeshCollider.setBox(entity) // Invisible box collider
```

For GLTF models, set the collision mask:
```typescript
GltfContainer.create(entity, {
  src: 'models/button.glb',
  visibleMeshesCollisionMask: ColliderLayer.CL_POINTER
})
```

---

## Proximity Events (Nearby Interactions Without Aiming)

Proximity events let entities react to button presses when the player is nearby and roughly facing the entity, **without requiring the player to aim their cursor at it**. The interactive area is a wide triangular slice projecting forward from the avatar's position — the avatar's facing direction matters, not the camera direction.

If the player is both in proximity of an entity with a proximity interaction AND aiming at an entity with a pointer interaction, the **pointer interaction always takes priority**. Among multiple proximity entities in range, only the closest one (or highest priority) is activated.

### Proximity Button Presses

```typescript
pointerEventsSystem.onProximityDown(
  {
    entity: myEntity,
    opts: {
      button: InputAction.IA_PRIMARY,
      hoverText: 'Press E',
      maxPlayerDistance: 5,
    },
  },
  () => { console.log('Player pressed button near entity') }
)

pointerEventsSystem.onProximityUp(
  {
    entity: myEntity,
    opts: {
      button: InputAction.IA_PRIMARY,
      hoverText: 'Release E',
      maxPlayerDistance: 5,
    },
  },
  () => { console.log('Player released button near entity') }
)
```

> **Note**: Only one `onProximityDown` and one `onProximityUp` can be registered per entity. Do not call these within a system loop.

### Proximity Enter and Leave

Detect when a player walks into or out of an entity's proximity range — useful for extra feedback like sounds or animations:

```typescript
pointerEventsSystem.onProximityEnter(
  {
    entity: myEntity,
    opts: { button: InputAction.IA_POINTER, hoverText: 'Nearby', maxPlayerDistance: 5 },
  },
  () => { console.log('Player entered proximity') }
)

pointerEventsSystem.onProximityLeave(
  {
    entity: myEntity,
    opts: { button: InputAction.IA_POINTER, hoverText: 'Nearby', maxPlayerDistance: 5 },
  },
  () => { console.log('Player left proximity') }
)
```

### Priority

When multiple entities are within range, use `priority` to control which one responds. Higher numbers take precedence:

```typescript
pointerEventsSystem.onProximityDown(
  {
    entity: doorEntity,
    opts: { button: InputAction.IA_PRIMARY, hoverText: 'Open door', maxPlayerDistance: 5, priority: 2 },
  },
  () => { console.log('Door activated') }
)

pointerEventsSystem.onProximityDown(
  {
    entity: floorEntity,
    opts: { button: InputAction.IA_PRIMARY, hoverText: 'Step here', maxPlayerDistance: 5, priority: 1 },
  },
  () => { console.log('Floor activated') }
)
```

### Proximity Options

- `button`: Which button to listen for (same as pointer events)
- `maxDistance`: Max distance from the player's **camera** to the entity
- `maxPlayerDistance`: Max distance from the player's **avatar** to the entity (most relevant for proximity)
- `hoverText`: Text shown when player is near
- `showHighlight`: Edge highlight when in range (default: `true`)
- `showFeedback`: Hover feedback around entity center (default: `true`)
- `priority`: Resolves conflicts — higher values take precedence, closest wins on ties

### Remove Proximity Callbacks

```typescript
pointerEventsSystem.removeOnProximityDown(myEntity)
pointerEventsSystem.removeOnProximityUp(myEntity)
pointerEventsSystem.removeOnProximityEnter(myEntity)
pointerEventsSystem.removeOnProximityLeave(myEntity)
```

### Proximity Door Example

```typescript
const doorPivot = engine.addEntity()
Transform.create(doorPivot, { position: Vector3.create(3, 0, 4) })

const door = engine.addEntity()
GltfContainer.create(door, { src: 'assets/door.glb' })
Transform.create(door, { position: Vector3.create(-1, 0, 0), parent: doorPivot })

let isDoorOpen = false
const closedRot = Quaternion.fromEulerDegrees(0, 0, 0)
const openRot = Quaternion.fromEulerDegrees(0, 90, 0)

pointerEventsSystem.onProximityDown(
  {
    entity: door,
    opts: { button: InputAction.IA_PRIMARY, hoverText: 'Open / Close', maxPlayerDistance: 5, priority: 1 },
  },
  () => {
    if (isDoorOpen) {
      Tween.setRotate(doorPivot, openRot, closedRot, 700)
      isDoorOpen = false
    } else {
      Tween.setRotate(doorPivot, closedRot, openRot, 700)
      isDoorOpen = true
    }
  }
)
```

### System-Based Proximity Events

For more control, use the system-based approach with `InteractionType.PROXIMITY`:

```typescript
import { PointerEvents, InteractionType, inputSystem, PointerEventType } from '@dcl/sdk/ecs'

// Define proximity interaction on the entity
PointerEvents.create(myEntity, {
  pointerEvents: [
    {
      eventType: PointerEventType.PET_DOWN,
      eventInfo: {
        button: InputAction.IA_PRIMARY,
        hoverText: 'Press E',
        maxDistance: 5,
        interactionType: InteractionType.PROXIMITY,
      },
    },
  ],
})

// Check in a system
engine.addSystem(() => {
  if (inputSystem.isTriggered(InputAction.IA_PRIMARY, PointerEventType.PET_DOWN, myEntity)) {
    console.log('Proximity button pressed!')
  }
})
```

You can combine pointer and proximity interactions on the same entity using the system-based approach (the helper-based approach is limited to one event type per entity):

```typescript
PointerEvents.create(myEntity, {
  pointerEvents: [
    {
      eventType: PointerEventType.PET_DOWN,
      eventInfo: { button: InputAction.IA_PRIMARY, hoverText: 'Aim & Press E', interactionType: InteractionType.CURSOR },
    },
    {
      eventType: PointerEventType.PET_DOWN,
      eventInfo: { button: InputAction.IA_SECONDARY, hoverText: 'Press F nearby', interactionType: InteractionType.PROXIMITY, maxDistance: 5 },
    },
  ],
})
```

---

## Trigger Areas (Proximity Detection)

Detect when the player enters, exits, or stays inside an area:

```typescript
import { engine, Transform, TriggerArea } from '@dcl/sdk/ecs'
import { triggerAreaEventsSystem } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

const area = engine.addEntity()
TriggerArea.setBox(area) // or TriggerArea.setSphere(area)
Transform.create(area, {
  position: Vector3.create(8, 0, 8),
  scale: Vector3.create(4, 4, 4) // Size the area via Transform.scale
})

// Register enter/exit/stay events
triggerAreaEventsSystem.onTriggerEnter(area, (event) => {
  console.log('Entity entered trigger:', event.trigger.entity)
})

triggerAreaEventsSystem.onTriggerExit(area, () => {
  console.log('Entity exited trigger')
})

triggerAreaEventsSystem.onTriggerStay(area, () => {
  // Called every frame while an entity is inside
})
```

By default, trigger areas react to the player layer. Use `ColliderLayer` to restrict which entities activate the area:

```typescript
import { ColliderLayer, MeshCollider } from '@dcl/sdk/ecs'

// Area that only reacts to custom layers
TriggerArea.setBox(area, ColliderLayer.CL_CUSTOM1 | ColliderLayer.CL_CUSTOM2)

// Mark a moving entity to activate the area
const mover = engine.addEntity()
Transform.create(mover, { position: Vector3.create(8, 0, 8) })
MeshCollider.setBox(mover, ColliderLayer.CL_CUSTOM1)
```

---

## Raycasting

### Raycast Direction Types

Four direction modes are available:

```typescript
// 1. Local direction — relative to entity rotation
{ $case: 'localDirection', localDirection: Vector3.Forward() }

// 2. Global direction — world-space, ignores entity rotation
{ $case: 'globalDirection', globalDirection: Vector3.Down() }

// 3. Global target — aim at a world position
{ $case: 'globalTarget', globalTarget: Vector3.create(10, 0, 10) }

// 4. Target entity — aim at another entity
{ $case: 'targetEntity', targetEntity: entityId }
```

### Callback-Based Raycasting (Recommended)

```typescript
import { raycastSystem, RaycastQueryType, ColliderLayer } from '@dcl/sdk/ecs'

// Local direction raycast
raycastSystem.registerLocalDirectionRaycast(
  { entity: myEntity, opts: { queryType: RaycastQueryType.RQT_HIT_FIRST, direction: Vector3.Forward(), maxDistance: 16, collisionMask: ColliderLayer.CL_POINTER } },
  (result) => {
    if (result.hits.length > 0) {
      console.log('Hit:', result.hits[0].entityId)
    }
  }
)

// Global direction raycast
raycastSystem.registerGlobalDirectionRaycast(
  { entity: myEntity, opts: { queryType: RaycastQueryType.RQT_HIT_FIRST, direction: Vector3.Down(), maxDistance: 20 } },
  (result) => { /* handle hits */ }
)

// Target position raycast
raycastSystem.registerGlobalTargetRaycast(
  { entity: myEntity, opts: { globalTarget: Vector3.create(8, 0, 8), maxDistance: 20 } },
  (result) => { /* handle result */ }
)

// Target entity raycast
raycastSystem.registerTargetEntityRaycast(
  { entity: sourceEntity, opts: { targetEntity: targetEntity, maxDistance: 15 } },
  (result) => { /* handle result */ }
)

// Remove raycast from entity
raycastSystem.removeRaycasterEntity(myEntity)
```

### Component-Based Raycasting

```typescript
import { engine, Raycast, RaycastResult, RaycastQueryType } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

const rayEntity = engine.addEntity()
Raycast.create(rayEntity, {
  direction: { $case: 'localDirection', localDirection: Vector3.Forward() },
  maxDistance: 16,
  queryType: RaycastQueryType.RQT_HIT_FIRST,
  continuous: false // Set true for continuous raycasting
})

// Check results
engine.addSystem(() => {
  const result = RaycastResult.getOrNull(rayEntity)
  if (result && result.hits.length > 0) {
    const hit = result.hits[0]
    console.log('Hit entity:', hit.entityId, 'at', hit.position)
  }
})
```

### Camera Raycast

Cast a ray from the camera to detect what the player is looking at:

```typescript
raycastSystem.registerGlobalDirectionRaycast(
  {
    entity: engine.CameraEntity,
    opts: {
      direction: Vector3.rotate(Vector3.Forward(), Transform.get(engine.CameraEntity).rotation),
      maxDistance: 16
    }
  },
  (result) => {
    if (result.hits.length > 0) console.log('Looking at:', result.hits[0].entityId)
  }
)
```

---

## Global Input Handling

Listen for key presses anywhere (not entity-specific):

```typescript
import { inputSystem, InputAction, PointerEventType } from '@dcl/sdk/ecs'

engine.addSystem(() => {
  // Check if E key was just pressed this frame
  if (inputSystem.isTriggered(InputAction.IA_PRIMARY, PointerEventType.PET_DOWN)) {
    console.log('E key pressed!')
  }

  // Check if a key is currently held down
  if (inputSystem.isPressed(InputAction.IA_SECONDARY)) {
    console.log('F key is held!')
  }

  // Entity-specific input via system
  const clickData = inputSystem.getInputCommand(
    InputAction.IA_POINTER,
    PointerEventType.PET_DOWN,
    myEntity
  )
  if (clickData) {
    console.log('Entity clicked via system:', clickData.hit.entityId)
  }
})
```

## Cursor State

```typescript
import { PointerLock, PrimaryPointerInfo } from '@dcl/sdk/ecs'

// Check if cursor is locked
const isLocked = PointerLock.get(engine.CameraEntity).isPointerLocked

// Get cursor position and world ray
const pointerInfo = PrimaryPointerInfo.get(engine.RootEntity)
console.log('Cursor position:', pointerInfo.screenCoordinates)
console.log('World ray direction:', pointerInfo.worldRayDirection)
```

---

## Toggle Pattern (Click to Switch States)

Common pattern for toggleable objects:

```typescript
let doorOpen = false

pointerEventsSystem.onPointerDown(
  { entity: door, opts: { button: InputAction.IA_POINTER, hoverText: 'Toggle door' } },
  () => {
    doorOpen = !doorOpen
    const mutableTransform = Transform.getMutable(door)
    mutableTransform.rotation = doorOpen
      ? Quaternion.fromEulerDegrees(0, 90, 0)
      : Quaternion.fromEulerDegrees(0, 0, 0)
  }
)
```

## Best Practices

- Always set `maxDistance` on pointer events (8-16m is typical)
- Always set `hoverText` so users know what outcome their interaction will have
- Clean up handlers when entities are removed
- Use `MeshCollider` for invisible trigger surfaces
- For complex interactions, use a system with state tracking
- Set `continuous: false` on raycasts unless you need per-frame results
- Design for both desktop and mobile — mobile has no keyboard, rely on pointer and on-screen buttons

For the full input action list and advanced patterns, see `{baseDir}/references/input-reference.md`.
