# Hitscan: Aim Ray, Two-Ray Fire, Tracer

Assumptions: the player is inside the scene, and all positions are scene-relative (`Transform` of root-level entities, `RaycastHit.position`).

## Shared setup

```typescript
import {
  engine, Entity, Transform, Raycast, RaycastResult, RaycastQueryType, raycastSystem,
  ColliderLayer, CameraMode, CameraType, AvatarAttach, AvatarAnchorPointType,
  MeshRenderer, Material, timers
} from '@dcl/sdk/ecs'
import { Vector3, Quaternion, Color3, Color4 } from '@dcl/sdk/math'

export const RANGE = 60 // m. Keep it under the ~64 m raycast-distance cutoff
export const PVP = false

// Walls/floors (CL_PHYSICS) + enemy hitboxes (CL_CUSTOM1). Add CL_PLAYER for PvP.
export const SHOT_MASK =
  ColliderLayer.CL_PHYSICS | ColliderLayer.CL_CUSTOM1 | (PVP ? ColliderLayer.CL_PLAYER : 0)
const QUERY = PVP ? RaycastQueryType.RQT_QUERY_ALL : RaycastQueryType.RQT_HIT_FIRST

type Hit = {
  position?: Vector3; normalHit?: Vector3; length: number; entityId?: number
}

// With player bits in the mask, the shooter's own capsule can show up. Drop it and keep the closest.
// minLength skips hits nearer than that along the ray (third-person aim, below).
export function nearestHit(hits: readonly Hit[], minLength = 0): Hit | undefined {
  let best: Hit | undefined
  for (const h of hits) {
    if (h.entityId === engine.PlayerEntity) continue
    if (h.length < minLength) continue
    if (!best || h.length < best.length) best = h
  }
  return best
}
```

## Aim ray (continuous, follows the camera)

A child of `engine.CameraEntity` inherits the camera's world pose, and `localDirection` is rotated by that pose. The ray always points where the camera looks. Create it on equip and delete it on unequip.

In third person the ray starts at the camera, **behind the avatar**, so it can hit things between the camera and the avatar (a wall behind the player, a pillar the camera passes). Such an aim point lies behind the shoulder, and the shoulder ray would fire backwards. So the aim ray uses `RQT_QUERY_ALL`, and hits nearer than the avatar along the look direction are ignored.

```typescript
let aimRay: Entity | undefined

export function equipAimRay() {
  if (aimRay) return
  aimRay = engine.addEntity()
  Transform.create(aimRay, { parent: engine.CameraEntity })
  Raycast.create(aimRay, {
    direction: { $case: 'localDirection', localDirection: Vector3.Forward() },
    maxDistance: RANGE + 10, // + room for the third-person camera boom
    queryType: RaycastQueryType.RQT_QUERY_ALL, // all hits, so the ones behind the avatar can be skipped
    collisionMask: SHOT_MASK,
    continuous: true
  })
}

export function unequipAimRay() {
  if (aimRay) engine.removeEntity(aimRay)
  aimRay = undefined
}

// Latest aim point: the closest hit, or the far end of the look ray. About 1 tick old.
export function currentAim(): { point: Vector3; hit?: Hit } {
  const cam = Transform.get(engine.CameraEntity)
  const dir = Vector3.rotate(Vector3.Forward(), cam.rotation)
  // Third person: skip hits closer to the camera than the avatar (measured along the look direction)
  const firstPerson = CameraMode.getOrNull(engine.CameraEntity)?.mode === CameraType.CT_FIRST_PERSON
  const chest = Vector3.add(Transform.get(engine.PlayerEntity).position, Vector3.create(0, 1.2, 0))
  const minLength = firstPerson ? 0 : Math.max(0, Vector3.dot(Vector3.subtract(chest, cam.position), dir)) + 0.3
  const res = aimRay ? RaycastResult.getOrNull(aimRay) : null
  const hit = res ? nearestHit(res.hits, minLength) : undefined
  return hit?.position
    ? { point: Vector3.clone(hit.position), hit }
    : { point: Vector3.add(cam.position, Vector3.scale(dir, RANGE)) }
}
```

When the cursor is **unlocked** on desktop, the player aims with the mouse cursor, not the screen centre. Either request pointer lock on equip, or switch the aim ray to `globalDirection` set each tick from the cursor ray. Both components need care (**advanced-input**): `PointerLock.getMutable` throws if the component was never created, and every `PrimaryPointerInfo` field is optional.

```typescript
import { PointerLock, PrimaryPointerInfo } from '@dcl/sdk/ecs'

// Request lock on equip: createOrReplace, never getMutable on a component that may not exist yet
PointerLock.createOrReplace(engine.CameraEntity, { isPointerLocked: true })

// Cursor ray (unlocked aim): create the component if missing, and guard the optional field
const cursorDir = PrimaryPointerInfo.getOrCreateMutable(engine.RootEntity).worldRayDirection
if (cursorDir) { /* Raycast.createOrReplace(aimRay, { direction: { $case: 'globalDirection', globalDirection: cursorDir }, ... }) */ }
```

## Shoulder origin (third person)

```typescript
let shoulder: Entity | undefined

export function shoulderPosition(): Vector3 {
  if (!shoulder) {
    shoulder = engine.addEntity()
    Transform.create(shoulder, {})
    AvatarAttach.create(shoulder, { anchorPointId: AvatarAnchorPointType.AAPT_RIGHT_SHOULDER })
  }
  const feet = Transform.get(engine.PlayerEntity).position
  // The explorer writes the bone's offset from the player root (world axes) into this Transform.
  const offset = Transform.get(shoulder).position
  const written = offset.x !== 0 || offset.y !== 0 || offset.z !== 0
  return Vector3.add(feet, written ? offset : Vector3.create(0, 1.37, 0)) // measured in-world 2026-10-27 until the first write-back lands
}
```

## Fire

```typescript
export type ShotResult = { hit?: Hit; from: Vector3; to: Vector3 }

export function fireHitscan(onResult: (r: ShotResult) => void) {
  const firstPerson = CameraMode.getOrNull(engine.CameraEntity)?.mode === CameraType.CT_FIRST_PERSON
  const aim = currentAim()
  const cam = Transform.get(engine.CameraEntity).position

  if (firstPerson) {
    // The aim ray already is the shot.
    onResult({ hit: aim.hit, from: cam, to: aim.point })
    return
  }

  // Third person: the shoulder decides what is actually hit.
  const from = shoulderPosition()
  const camRot = Transform.get(engine.CameraEntity).rotation
  const lookDir = Vector3.rotate(Vector3.Forward(), camRot)
  // Never fire backwards: an aim point behind the shoulder (camera clipping, a stale result) falls back to straight ahead
  if (Vector3.dot(Vector3.subtract(aim.point, from), lookDir) <= 0.5) {
    aim.point = Vector3.add(from, Vector3.scale(lookDir, RANGE))
    aim.hit = undefined
  }
  const toAim = Vector3.subtract(aim.point, from)
  const dist = Vector3.length(toAim)
  if (dist < 0.01) return onResult({ from, to: aim.point })

  const ray = engine.addEntity() // one entity per shot, so overlapping shots don't overwrite each other
  Transform.create(ray, { position: from })
  raycastSystem.registerGlobalDirectionRaycast(
    {
      entity: ray,
      opts: {
        direction: Vector3.normalize(toAim),
        maxDistance: dist + 0.25,
        queryType: QUERY,
        collisionMask: SHOT_MASK
      }
    },
    (result) => {
      engine.removeEntity(ray) // safe in the callback, and the system's own cleanup tolerates it
      const hit = nearestHit(result.hits)
      onResult({ hit, from, to: hit?.position ? Vector3.clone(hit.position) : aim.point })
    }
  )
}
```

Notes:
- The callback arrives 2-3 ticks later. Play the muzzle flash, sound and tracer **immediately** on fire, using `aim.point` as a provisional end point. Apply damage only in `onResult`.
- If the fire ray hits something well short of `aim.point`, the shot was blocked by cover. That is the intended result, not a bug.

## Which remote player was hit (PvP)

A remote-avatar hit has `entityId === undefined`. Match `hit.position` to the closest avatar.

```typescript
import { PlayerIdentityData } from '@dcl/sdk/ecs'

// Remote players' Transforms are in WORLD coordinates (player-avatar). This loop only reads remote
// players, so always subtract the scene origin. Read the base parcel from scene.json.
const BASE = Vector3.create(0 * 16, 0, 0 * 16) // base parcel x*16, 0, y*16

function toSceneLocal(p: Vector3): Vector3 {
  return Vector3.subtract(p, BASE)
}

export function remotePlayerAt(hitPos: Vector3, maxDist = 1.5): string | undefined {
  let best: string | undefined
  let bestD = maxDist
  for (const [entity, id, t] of engine.getEntitiesWith(PlayerIdentityData, Transform)) {
    if (entity === engine.PlayerEntity) continue
    const p = toSceneLocal(t.position)
    const mid = Vector3.add(p, Vector3.create(0, 0.8, 0)) // capsule centre above the root
    const d = Vector3.distance(mid, hitPos)
    if (d < bestD) { bestD = d; best = id.address }
  }
  return best
}
```

## Tracer (visual only)

A thin box stretched from muzzle to impact, removed after 60 ms. No collider.

```typescript
export function spawnTracer(from: Vector3, to: Vector3) {
  const delta = Vector3.subtract(to, from)
  const len = Vector3.length(delta)
  if (len < 0.05) return
  const e = engine.addEntity()
  Transform.create(e, {
    position: Vector3.lerp(from, to, 0.5),
    rotation: Quaternion.lookRotation(delta),
    scale: Vector3.create(0.02, 0.02, len)
  })
  MeshRenderer.setBox(e)
  Material.setPbrMaterial(e, {
    albedoColor: Color4.create(1, 0.9, 0.5, 1),
    emissiveColor: Color3.create(1, 0.8, 0.3), // Color3, not Color4
    emissiveIntensity: 4
  })
  timers.setTimeout(() => engine.removeEntity(e), 60)
}
```

Start the tracer at the gun's muzzle, not at the camera, or it collapses to a dot in first person. Muzzle world position: the camera-parented gun's offset rotated by the camera rotation, `Vector3.add(cam.position, Vector3.rotate(MUZZLE_LOCAL, cam.rotation))`.
