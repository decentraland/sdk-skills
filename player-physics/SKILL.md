---
name: player-physics
description: Apply physics forces to the player in Decentraland scenes. Impulses (one-shot pushes), knockback (push away from a point with falloff), continuous forces (wind tunnels), timed forces, and repulsion fields. Use when the user wants launch pads, knockback on hit, wind zones, gravity fields, or any scene-applied force on the player. Do NOT use for player movement speed (see player-avatar) or platform movement (see animations-tweens).
---

# Player Physics in Decentraland

Apply forces to the player's avatar using the `Physics` API. All physics operations affect the **local player** only.

```typescript
import { Physics } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'
```

## Impulse (One-Shot Push)

Apply a single instantaneous force — useful for launch pads, jumps, and explosions.

```typescript
// Launch straight up
Physics.applyImpulseToPlayer(Vector3.create(0, 50, 0))

// Pass direction + magnitude separately (direction is normalized automatically)
Physics.applyImpulseToPlayer(Vector3.create(0, 1, 0), 50)
```

Multiple `applyImpulseToPlayer()` calls **within the same frame** are accumulated and applied as a single combined impulse.

### Launch Pad Example

```typescript
import { Physics, TriggerArea, triggerAreaEventsSystem, ColliderLayer, MeshRenderer, Transform } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

const launchPad = engine.addEntity()
Transform.create(launchPad, { position: Vector3.create(8, 0, 8) })
MeshRenderer.setBox(launchPad)
TriggerArea.setBox(launchPad, ColliderLayer.CL_PLAYER)

triggerAreaEventsSystem.onTriggerEnter(launchPad, (result) => {
	if (result.trigger?.entity !== engine.PlayerEntity) return
	Physics.applyImpulseToPlayer(Vector3.create(0, 50, 0))
})
```

## Knockback (Push Away from a Point)

Push the player away from a source position with one impulse. The direction is computed automatically from source to player. Use for explosions, impacts, and area-of-effect blasts.

```typescript
import { Physics, KnockbackFalloff } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

// Basic knockback from explosion center
Physics.applyKnockbackToPlayer(Vector3.create(8, 1, 8), 40)

// With radius and falloff
Physics.applyKnockbackToPlayer(
	Vector3.create(8, 1, 8),
	40,                          // magnitude
	10,                          // radius: no effect beyond 10 meters
	KnockbackFalloff.LINEAR      // magnitude fades linearly to 0 at edge
)
```

### KnockbackFalloff Options

| Falloff | Behavior |
|---|---|
| `KnockbackFalloff.CONSTANT` | Same magnitude at any distance within radius (default) |
| `KnockbackFalloff.LINEAR` | Smooth linear decrease to 0 at the radius edge |
| `KnockbackFalloff.INVERSE_SQUARE` | Sharp, physically-realistic drop-off |

> **Notes:**
> - If the player is exactly at the source position, they are pushed straight up.
> - A **negative magnitude** pulls the player toward the point instead of pushing them away.
> - The same falloff values apply to `applyRepulsionForceToPlayer()`.

## Continuous Force

Apply a persistent directional force that stays active until explicitly removed. Use for wind tunnels, conveyor belts, and gravity fields.

Each continuous force is identified by an **entity** — that entity acts as the "owner" of the force. Multiple forces from different entities stack.

```typescript
// Apply continuous sideways push
Physics.applyForceToPlayer(windZoneEntity, Vector3.create(10, 0, 0))

// With separate direction + magnitude
Physics.applyForceToPlayer(windZoneEntity, Vector3.create(0, 1, 0), 50)

// Remove the force
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
TriggerArea.setBox(windTunnel, ColliderLayer.CL_PLAYER)

triggerAreaEventsSystem.onTriggerEnter(windTunnel, (result) => {
	if (result.trigger?.entity !== engine.PlayerEntity) return
	Physics.applyForceToPlayer(windTunnel, Vector3.create(15, 0, 0))
})

triggerAreaEventsSystem.onTriggerExit(windTunnel, (result) => {
	if (result.trigger?.entity !== engine.PlayerEntity) return
	Physics.removeForceFromPlayer(windTunnel)
})
```

## Timed Force

Apply a force for a fixed duration, then it expires automatically.

```typescript
import { Physics, timers } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

const gustEntity = engine.addEntity()

// Strong upward force for 1.5 seconds
Physics.applyForceToPlayerForDuration(gustEntity, 1.5, Vector3.create(0, 50, 0))

// With separate direction + magnitude
Physics.applyForceToPlayerForDuration(gustEntity, 1.5, Vector3.create(0, 1, 0), 50)
```

## Repulsion Force

Push the player away from a fixed point continuously, with distance-based falloff. The force direction is recalculated each frame as the player moves.

```typescript
import { Physics, timers } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

const repulsionSource = engine.addEntity()
Transform.create(repulsionSource, { position: Vector3.create(8, 1, 8) })

// Pass the entity's position explicitly as the repulsion origin
Physics.applyRepulsionForceToPlayer(
	repulsionSource,
	Transform.get(repulsionSource).position,  // origin — passed explicitly, not read automatically
	50,                                         // magnitude
	10,                                         // radius of effect in meters
)

// Remove after 500ms
timers.setTimeout(() => {
	Physics.removeForceFromPlayer(repulsionSource)
}, 500)
```

> **Note:** The position must be passed explicitly — the API does not read it from the entity's Transform automatically.

## Coordinate Conversion (Local to World Direction)

When you want to push the player relative to an entity's local orientation (e.g., "forward from this cannon"), convert the local direction to world space first:

```typescript
import { Physics, Transform } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

// Push the player in the direction the entity's local +Z axis points in world space
const worldDir = Transform.localToWorldDirection(myEntity, Vector3.create(0, 0, 1))
Physics.applyImpulseToPlayer(worldDir, 20)
```

## Quick Reference

| Method | Type | Description |
|---|---|---|
| `Physics.applyImpulseToPlayer(dir, mag?)` | One-shot | Instant directional push |
| `Physics.applyKnockbackToPlayer(pos, mag, radius?, falloff?)` | One-shot | Push away from point |
| `Physics.applyForceToPlayer(entity, dir, mag?)` | Continuous | Persistent push while active |
| `Physics.removeForceFromPlayer(entity)` | Control | Stop a continuous force |
| `Physics.applyForceToPlayerForDuration(entity, secs, dir, mag?)` | Timed | Force that expires automatically |
| `Physics.applyRepulsionForceToPlayer(entity, pos, mag, radius)` | Continuous | Distance-based push from point |
| `Transform.localToWorldDirection(entity, dir)` | Utility | Convert local direction to world space |

## Best Practices

- Use `applyImpulseToPlayer` for one-off events (jump pads, explosions, hits)
- Use `applyForceToPlayer` + `removeForceFromPlayer` with trigger zones for areas (wind tunnels, conveyor belts)
- Use `KnockbackFalloff.LINEAR` for most area effects — it feels natural and predictable
- Always check `result.trigger?.entity !== engine.PlayerEntity` in trigger callbacks to only affect the local player
- A negative knockback magnitude creates a pull/gravity well effect
- Multiple forces from different entities stack — each entity tracks its own force independently
