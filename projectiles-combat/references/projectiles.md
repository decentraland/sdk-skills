# Visible Projectiles & Ballistic Arcs

## Component

Local-only state. Do not sync it: in multiplayer, broadcast a "fired" event and let each client simulate its own copy.

```typescript
import {
  engine, Entity, Transform, Raycast, RaycastResult, RaycastQueryType, ColliderLayer,
  MeshRenderer, GltfContainer, Schemas
} from '@dcl/sdk/ecs'
import { Vector3, Quaternion } from '@dcl/sdk/math'
import { applyDamage, resolveTarget, playerStats, spawnImpact } from './health-damage' // health-damage.md

export const Projectile = engine.defineComponent('combat::Projectile', {
  velocity: Schemas.Vector3,   // m/s
  gravity: Schemas.Number,     // m/s^2, positive = falls. 0 = straight line
  age: Schemas.Number,         // s
  maxAge: Schemas.Number,      // s. Hard lifetime cap
  maxRange: Schemas.Number,    // m from the camera. Past ~64 m the explorer stops running its raycast
  damage: Schemas.Number,
  source: Schemas.String,      // damage source id (userId, 'npc:turret-1', ...)
  mask: Schemas.Number,        // ColliderLayer bits the projectile collides with
  fromLocalPlayer: Schemas.Boolean // true: ignore hits on engine.PlayerEntity (own capsule)
})

const LOOKAHEAD_TICKS = 3 // results lag 1-2 ticks, so the ray must reach further than one step
const MAX_RANGE = 60       // m from the camera: stay under the ~64 m raycast cutoff (SKILL.md)
```

Typical masks:
- Player's arrow (PvE): `CL_PHYSICS | CL_CUSTOM1` (walls + enemy hitboxes).
- Player's arrow (PvP): add `CL_PLAYER`, with `fromLocalPlayer: true`.
- Enemy fireball aimed at the local player: `CL_PHYSICS | CL_MAIN_PLAYER`, with `fromLocalPlayer: false`. Each client simulates it and damages only its own player: a hit on `engine.PlayerEntity` goes to `playerStats` (see `onProjectileImpact` below).

## Spawn

```typescript
export function spawnProjectile(o: {
  muzzle: Vector3; velocity: Vector3; damage: number; source: string; mask: number
  fromLocalPlayer: boolean; gravity?: number; maxAge?: number; maxRange?: number; model?: string; clearance?: number
}): Entity {
  const dir = Vector3.normalize(o.velocity)
  const clearance = o.clearance ?? 1 // spawn ~1 m in front of the muzzle
  const e = engine.addEntity()
  Transform.create(e, {
    position: Vector3.add(o.muzzle, Vector3.scale(dir, clearance)),
    rotation: Quaternion.lookRotation(dir),
    scale: o.model ? Vector3.One() : Vector3.create(0.15, 0.15, 0.15)
  })
  if (o.model) {
    // No colliders on the projectile itself: other rays and the player must not hit it.
    GltfContainer.create(e, { src: o.model, visibleMeshesCollisionMask: 0, invisibleMeshesCollisionMask: 0 })
  } else {
    MeshRenderer.setSphere(e) // MeshRenderer alone has no collider
  }
  Projectile.create(e, {
    velocity: Vector3.clone(o.velocity),
    gravity: o.gravity ?? 0,
    age: 0,
    maxAge: o.maxAge ?? 5,
    maxRange: Math.min(o.maxRange ?? MAX_RANGE, MAX_RANGE),
    damage: o.damage,
    source: o.source,
    mask: o.mask,
    fromLocalPlayer: o.fromLocalPlayer
  })
  // First look-ahead ray starts back at the muzzle (originOffset is world-space, not rotated),
  // so a wall inside the clearance gap still registers.
  const speed = Vector3.length(o.velocity)
  Raycast.create(e, {
    direction: { $case: 'globalDirection', globalDirection: dir },
    originOffset: Vector3.scale(dir, -clearance),
    maxDistance: clearance + speed * (1 / 30) * LOOKAHEAD_TICKS + 0.5,
    queryType: RaycastQueryType.RQT_QUERY_ALL,
    collisionMask: o.mask,
    continuous: true
  })
  return e
}
```

## System: check, move, re-aim

```typescript
type Hit = { position?: Vector3; normalHit?: Vector3; length: number; entityId?: number }

function nearestValidHit(hits: readonly Hit[], fromLocalPlayer: boolean): Hit | undefined {
  let best: Hit | undefined
  for (const h of hits) {
    if (fromLocalPlayer && h.entityId === engine.PlayerEntity) continue
    if (!best || h.length < best.length) best = h
  }
  return best
}

export function projectileSystem(dt: number) {
  for (const [e] of engine.getEntitiesWith(Projectile, Transform)) {
    const p = Projectile.getMutable(e)
    p.age += dt
    if (p.age > p.maxAge) { despawn(e); continue } // lifetime cap: always clean up

    const t = Transform.getMutable(e)
    // Range cap: past ~64 m from the camera the look-ahead ray stops running and the shot would tunnel
    if (Vector3.distance(t.position, Transform.get(engine.CameraEntity).position) > p.maxRange) { despawn(e); continue }
    const speed = Vector3.length(p.velocity)
    if (speed < 0.01) { despawn(e); continue }
    const dir = Vector3.scale(p.velocity, 1 / speed)
    const step = speed * dt

    // 1. CHECK BEFORE MOVING: does the latest look-ahead hit lie within this step?
    const res = RaycastResult.getOrNull(e)
    const hit = res ? nearestValidHit(res.hits, p.fromLocalPlayer) : undefined
    if (hit?.position) {
      const along = Vector3.dot(Vector3.subtract(hit.position, t.position), dir)
      if (along <= step) { // a negative value = a hit caught a tick late; still an impact
        onProjectileImpact(e, hit, Projectile.get(e))
        continue
      }
    }

    // 2. MOVE with the exact constant-gravity step, so the path matches solveBallistic.
    // (Moving with the old velocity and only then applying gravity makes every arc land long.)
    t.position = Vector3.create(
      t.position.x + p.velocity.x * dt,
      t.position.y + p.velocity.y * dt - 0.5 * p.gravity * dt * dt,
      t.position.z + p.velocity.z * dt
    )
    p.velocity.y -= p.gravity * dt
    t.rotation = Quaternion.lookRotation(p.velocity)

    // 3. RE-AIM the look-ahead ray from the new position along the new direction
    Raycast.createOrReplace(e, {
      direction: { $case: 'globalDirection', globalDirection: Vector3.normalize(p.velocity) },
      maxDistance: step * LOOKAHEAD_TICKS + 0.5,
      queryType: RaycastQueryType.RQT_QUERY_ALL,
      collisionMask: p.mask,
      continuous: true
    })
  }
}
engine.addSystem(projectileSystem)

function despawn(e: Entity) {
  engine.removeEntity(e) // also drops its Raycast / RaycastResult
}

// Called once per projectile.
function onProjectileImpact(e: Entity, hit: Hit, p: { damage: number; source: string; fromLocalPlayer: boolean }) {
  if (hit.entityId === engine.PlayerEntity) {
    // An enemy shot reached the local player's capsule (CL_MAIN_PLAYER). The player's HP lives on playerStats.
    if (!p.fromLocalPlayer) applyDamage(playerStats, p.damage, p.source, 1)
  } else if (hit.entityId !== undefined) {
    const t = resolveTarget(hit.entityId as Entity) // a Hitbox child resolves to its owner + multiplier
    if (t) applyDamage(t.target, p.damage * t.multiplier, p.source)
  }
  if (hit.position) spawnImpact(hit.position, hit.normalHit)
  despawn(e)
}
```

Notes:
- With `gravity: 0`, the direction never changes, so you can skip step 3 after spawn and let the continuous ray ride along. Re-aiming every tick is only needed for arcs. To save CRDT traffic, re-aim only when the direction has turned more than about 1°.
- An explosive (grenade, rocket) applies area damage at impact: loop over `Health` entities within a radius, and use `Physics.applyKnockbackToPlayer(pos, mag, radius, KnockbackFalloff.LINEAR)` for the local player (**player-physics**).
- A grenade with a fuse instead of impact: on a world hit, reflect the velocity, `v - 2*dot(v,n)*n`, times a damping factor (for example 0.4), using `hit.normalHit`, and explode when `age` reaches the fuse time.
- Live-projectile budget: every projectile is one ray per tick. Keep it to tens.
- Remote players' projectiles are visual copies: simulate them with the same system but leave out the damage (for example a `damage: 0` copy), or the hit is counted on every client.

## Ballistic solver

Launch velocity that lands exactly at `to`, under gravity `g` (positive), at a fixed launch `speed`. Returns `null` when the target is out of range at that speed.

```typescript
export function solveBallistic(
  from: Vector3, to: Vector3, speed: number, g: number, highArc = false
): Vector3 | null {
  const dx = to.x - from.x
  const dz = to.z - from.z
  const h = to.y - from.y
  const d = Math.sqrt(dx * dx + dz * dz) // horizontal distance
  const v2 = speed * speed

  if (g <= 0) { // no gravity: straight shot
    const len = Math.sqrt(d * d + h * h)
    return len < 1e-4 ? null : Vector3.create((dx / len) * speed, (h / len) * speed, (dz / len) * speed)
  }
  if (d < 1e-4) { // target straight above or below
    if (h > 0 && v2 < 2 * g * h) return null
    return Vector3.create(0, h >= 0 ? speed : -speed, 0)
  }

  const disc = v2 * v2 - g * (g * d * d + 2 * h * v2)
  if (disc < 0) return null // out of range at this speed

  const root = Math.sqrt(disc)
  const tanTheta = (v2 + (highArc ? root : -root)) / (g * d) // low arc by default (flatter, faster)
  const cos = 1 / Math.sqrt(1 + tanTheta * tanTheta)
  const sin = tanTheta * cos
  return Vector3.create((dx / d) * speed * cos, speed * sin, (dz / d) * speed * cos)
}

// Flight time, for leading or for an NPC "incoming!" warning:
// t = d / (speed * cos)
// Max range on flat ground (45 deg): speed^2 / g
```

Usage (a mortar aimed at the crosshair):

```typescript
const target = currentAim().point // hitscan.md
const v = solveBallistic(muzzle, target, 22, 9.8)
if (v) spawnProjectile({ muzzle, velocity: v, gravity: 9.8, damage: 40, source: myId, mask, fromLocalPlayer: true })
else { /* out of range: show a red reticle, or fire the 45-deg max-range shot */ }
```

`g` is your own gameplay constant. It does not need to match the avatar's gravity: the Unity character controller uses 10 m/s² (`CharacterControllerSettings.asset`), and many games use a heavier `g` for snappier arcs. Use the **same** `g` in the solver and in the system.

Leading a moving target: `aimAt = targetPos + targetVel * flightTime`. Iterate twice (solve, compute `t`, re-solve) for a good enough lead.
