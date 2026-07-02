# Player Physics Patterns & Code Examples

```typescript
import { Physics } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'
```

## Impulse (One-Shot Push)

```typescript
// Launch straight up
Physics.applyImpulseToPlayer(Vector3.create(0, 50, 0))

// Direction + magnitude separately (direction auto-normalized)
Physics.applyImpulseToPlayer(Vector3.create(0, 1, 0), 50)
```

### Launch Pad Example
```typescript
import { Physics, TriggerArea, triggerAreaEventsSystem, ColliderLayer, MeshRenderer, Transform } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

const launchPad = engine.addEntity()
Transform.create(launchPad, { position: Vector3.create(8, 0, 8) })
MeshRenderer.setBox(launchPad)
// CL_MAIN_PLAYER => fires only for the LOCAL player (the one Physics can affect).
// Using CL_PLAYER here would fire for remote avatars only and never launch you.
TriggerArea.setBox(launchPad, ColliderLayer.CL_MAIN_PLAYER)

triggerAreaEventsSystem.onTriggerEnter(launchPad, (result) => {
  Physics.applyImpulseToPlayer(Vector3.create(0, 50, 0))
})
```

## Knockback (Push Away from Point)

```typescript
import { Physics, KnockbackFalloff } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

// Basic knockback
Physics.applyKnockbackToPlayer(Vector3.create(8, 1, 8), 40)

// With radius and falloff
Physics.applyKnockbackToPlayer(
  Vector3.create(8, 1, 8),
  40,                          // magnitude
  10,                          // radius
  KnockbackFalloff.LINEAR      // magnitude fades linearly to 0 at edge
)
```

## Continuous Force

```typescript
// Apply
Physics.applyForceToPlayer(windZoneEntity, Vector3.create(10, 0, 0))

// With direction + magnitude
Physics.applyForceToPlayer(windZoneEntity, Vector3.create(0, 1, 0), 50)

// Remove
Physics.removeForceFromPlayer(windZoneEntity)
```

### Wind Tunnel Example
```typescript
import { Physics, TriggerArea, triggerAreaEventsSystem, ColliderLayer, MeshRenderer, MeshCollider, Transform } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

const windTunnel = engine.addEntity()
Transform.create(windTunnel, {
  position: Vector3.create(8, 1, 8),
  scale: Vector3.create(4, 3, 4),
})
MeshRenderer.setBox(windTunnel)
// CL_MAIN_PLAYER => fires only for the local player, so no remote-vs-local guard needed.
TriggerArea.setBox(windTunnel, ColliderLayer.CL_MAIN_PLAYER)

triggerAreaEventsSystem.onTriggerEnter(windTunnel, (result) => {
  Physics.applyForceToPlayer(windTunnel, Vector3.create(15, 0, 0))
})

triggerAreaEventsSystem.onTriggerExit(windTunnel, (result) => {
  Physics.removeForceFromPlayer(windTunnel)
})
```

## Timed Force

```typescript
import { Physics, timers } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

const gustEntity = engine.addEntity()

Physics.applyForceToPlayerForDuration(gustEntity, 1.5, Vector3.create(0, 50, 0))

// With direction + magnitude
Physics.applyForceToPlayerForDuration(gustEntity, 1.5, Vector3.create(0, 1, 0), 50)
```

## Repulsion Force

```typescript
import { Physics, timers } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

const repulsionSource = engine.addEntity()
Transform.create(repulsionSource, { position: Vector3.create(8, 1, 8) })

Physics.applyRepulsionForceToPlayer(
  repulsionSource,
  Transform.get(repulsionSource).position,  // origin — passed explicitly
  50,                                         // magnitude
  10,                                         // radius
)

// Remove after 500ms
timers.setTimeout(() => {
  Physics.removeForceFromPlayer(repulsionSource)
}, 500)
```

## Coordinate Conversion (Local to World Direction)

```typescript
import { Physics, Transform } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

const worldDir = Transform.localToWorldDirection(myEntity, Vector3.create(0, 0, 1))
Physics.applyImpulseToPlayer(worldDir, 20)
```

## Example scenes

No engine-team test scene exercises the `Physics.*` API directly. For the `TriggerArea` + `ColliderLayer` behavior these patterns depend on (which avatar fires a trigger, per-layer semantics), see:

- [5,5-collider-layers](https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/5,5-collider-layers) — `TriggerArea`, `Raycast`, `MeshCollider`, and `GltfContainer` across every `ColliderLayer`. Confirms `CL_MAIN_PLAYER` = local player, `CL_PLAYER` = remote avatars, `CL_PHYSICS` = scene mesh (never fires for avatars), `CL_POINTER` = cursor clicks; masks combine with `|`.
