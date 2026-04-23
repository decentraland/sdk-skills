# Interactivity Patterns & Code Examples

## Pointer Events

### Basic Click Handler (Helper System)
```typescript
import { engine, Transform, MeshRenderer, pointerEventsSystem, InputAction } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

const cube = engine.addEntity()
Transform.create(cube, { position: Vector3.create(8, 1, 8) })
MeshRenderer.setBox(cube)

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

### Colliders for Pointer Events

Pointer events only work on entities with a collider using the `ColliderLayer.CL_POINTER` layer:

```typescript
import { MeshCollider } from '@dcl/sdk/ecs'
MeshCollider.setBox(entity) // Invisible box collider
```

For GLTF models:
```typescript
GltfContainer.create(entity, {
  src: 'models/button.glb',
  visibleMeshesCollisionMask: ColliderLayer.CL_POINTER
})
```

---

## Proximity Events

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

### Proximity Enter and Leave
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

engine.addSystem(() => {
  if (inputSystem.isTriggered(InputAction.IA_PRIMARY, PointerEventType.PET_DOWN, myEntity)) {
    console.log('Proximity button pressed!')
  }
})
```

Combining pointer and proximity on the same entity:

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

## Trigger Areas

### Basic Setup
```typescript
import { engine, Transform, TriggerArea } from '@dcl/sdk/ecs'
import { triggerAreaEventsSystem } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

const area = engine.addEntity()
TriggerArea.setBox(area) // or TriggerArea.setSphere(area)
Transform.create(area, {
  position: Vector3.create(8, 0, 8),
  scale: Vector3.create(4, 4, 4)
})

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

### ColliderLayer Filtering
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
  continuous: false
})

engine.addSystem(() => {
  const result = RaycastResult.getOrNull(rayEntity)
  if (result && result.hits.length > 0) {
    const hit = result.hits[0]
    console.log('Hit entity:', hit.entityId, 'at', hit.position)
  }
})
```

### Camera Raycast
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

---

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
