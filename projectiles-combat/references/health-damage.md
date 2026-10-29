# Health, Damage, Death & Hit Feedback

## Components

```typescript
import {
  engine, Entity, Transform, Schemas, InputModifier, TextShape, Billboard, Tween, EasingFunction,
  ParticleSystem, PBParticleSystem_BlendMode, PBParticleSystem_PlaybackState, AudioSource,
  inputSystem, InputAction, PointerEventType, timers
} from '@dcl/sdk/ecs'
import { Vector3, Color3, Color4 } from '@dcl/sdk/math'
import { movePlayerTo } from '~system/RestrictedActions'

export const Health = engine.defineComponent('combat::Health', {
  hp: Schemas.Number,
  maxHp: Schemas.Number,
  invulnerable: Schemas.Number, // seconds of i-frames left
  lastSource: Schemas.String,   // damage source id of the last hit (kill credit)
  dead: Schemas.Boolean
})

// Put on invisible collider children (head, body). The ray hits the hitbox, damage goes to the owner.
export const Hitbox = engine.defineComponent('combat::Hitbox', {
  owner: Schemas.Entity,
  multiplier: Schemas.Number // 1 body, 2 head, 0.5 armour...
})

export function resolveTarget(hitEntity: Entity): { target: Entity; multiplier: number } | null {
  const hb = Hitbox.getOrNull(hitEntity)
  if (hb) return { target: hb.owner as Entity, multiplier: hb.multiplier }
  if (Health.has(hitEntity)) return { target: hitEntity, multiplier: 1 }
  return null
}
```

Hitbox setup for a rigged enemy (its skinned mesh is not hittable on its own, see **add-interactivity**):

```typescript
import { MeshCollider, ColliderLayer } from '@dcl/sdk/ecs'

function addHitbox(owner: Entity, pos: Vector3, scale: Vector3, multiplier: number) {
  const hb = engine.addEntity()
  Transform.create(hb, { parent: owner, position: pos, scale })
  MeshCollider.setBox(hb, ColliderLayer.CL_CUSTOM1) // CL_CUSTOM1: rays hit it, the player walks through it
  Hitbox.create(hb, { owner, multiplier })
}
// addHitbox(enemy, Vector3.create(0, 0.9, 0), Vector3.create(0.6, 1.2, 0.4), 1)
// addHitbox(enemy, Vector3.create(0, 1.65, 0), Vector3.create(0.3, 0.3, 0.3), 2)
```

## applyDamage: the single entry point

```typescript
type DamageListener = (target: Entity, amount: number, source: string) => void
export const onDamaged: DamageListener[] = []
export const onDeath: DamageListener[] = []

export function applyDamage(target: Entity, amount: number, source: string, iFrames = 0.1): boolean {
  const h = Health.getMutableOrNull(target)
  if (!h || h.dead || h.invulnerable > 0 || amount <= 0) return false
  h.hp = Math.max(0, h.hp - amount)
  h.lastSource = source
  h.invulnerable = iFrames
  for (const cb of onDamaged) cb(target, amount, source)
  if (h.hp === 0) {
    h.dead = true
    for (const cb of onDeath) cb(target, amount, source)
  }
  return true
}

// Count i-frames down with dt. Not timers: this runs per frame.
engine.addSystem((dt) => {
  for (const [e, h] of engine.getEntitiesWith(Health)) {
    if (h.invulnerable > 0) Health.getMutable(e).invulnerable = Math.max(0, h.invulnerable - dt)
  }
})
```

Rules:
- Friendly fire: compare the source id to the target's team before calling `applyDamage`, and keep that decision out of the function itself.
- i-frames: short (0.1 s) for enemies hit by rapid fire, so auto-fire still lands every few shots. If every bullet must count, use 0. Use longer windows (1-2 s) for the local player after a hit and after respawn.
- Network: `applyDamage` mutates local state. What gets sent and who calls it is decided in SKILL.md → *Multiplayer*.

## Local player health, death and respawn

```typescript
export const playerStats = engine.addEntity() // own entity. Do NOT write custom state on engine.PlayerEntity
Health.create(playerStats, { hp: 100, maxHp: 100, invulnerable: 0, lastSource: '', dead: false })

const SPAWN = Vector3.create(8, 0.5, 8)
const SPAWN_LOOK = Vector3.create(8, 1.5, 14)

onDeath.push((target, _amount, source) => {
  if (target !== playerStats) return
  console.log('killed by', source)
  // Freeze the avatar (desktop client; no effect in the web explorer, see advanced-input)
  InputModifier.createOrReplace(engine.PlayerEntity, {
    mode: InputModifier.Mode.Standard({ disableAll: true })
  })
  combatUi.deathScreen = true
  timers.setTimeout(() => {
    void movePlayerTo({ newRelativePosition: SPAWN, cameraTarget: SPAWN_LOOK })
    InputModifier.deleteFrom(engine.PlayerEntity)
    const h = Health.getMutable(playerStats)
    h.hp = h.maxHp
    h.dead = false
    h.invulnerable = 2 // spawn protection
    combatUi.deathScreen = false
  }, 2500)
})
```

## Enemy death

Hitboxes are **child entities**, and `engine.removeEntity` does not remove children: an enemy removed that way leaves its invisible hitboxes behind, blocking later shots. Remove enemies with `engine.removeEntityWithChildren`. Also drop the hitbox colliders at the moment of death, so the corpse doesn't absorb shots while its death animation plays.

```typescript
import { MeshCollider } from '@dcl/sdk/ecs'

onDeath.push((target) => {
  if (target === playerStats) return
  for (const [hb, box] of engine.getEntitiesWith(Hitbox)) {
    if (box.owner === target) MeshCollider.deleteFrom(hb) // stops blocking shots right away
  }
  // stop its AI and play the death animation / particles here
  timers.setTimeout(() => engine.removeEntityWithChildren(target), 1000) // body + every hitbox child
})
```

Pooling instead: hide the enemy (`VisibilityComponent`), keep the hitbox colliders off, and restore both on respawn.

Environmental damage to the local player (lava, spikes, enemy fireballs): `applyDamage(playerStats, n, 'hazard:lava', 1)`. Pair with `Physics.applyKnockbackToPlayer` (**player-physics**) so the hit is felt.

## UI state for hit marker / damage flash / health bar

Build the widgets with **build-ui** (editable UI by default; `KitProgressBar` for the health bar). The combat code only writes this state:

```typescript
import { getPlayer } from '@dcl/sdk/src/players'
const myId = () => getPlayer()?.userId ?? '' // call inside systems/handlers, not at module load

export const combatUi = { time: 0, hitMarkerUntil: 0, headshot: false, damageFlashUntil: 0, deathScreen: false }
engine.addSystem((dt) => { combatUi.time += dt })

onDamaged.push((target, _amount, source) => {
  if (target === playerStats) combatUi.damageFlashUntil = combatUi.time + 0.25
  else if (source === myId()) combatUi.hitMarkerUntil = combatUi.time + 0.15 // I hit something
})
// UI visibility: combatUi.time < combatUi.hitMarkerUntil
```

The damage flash is a full-screen, semi-transparent red panel. It must carry **no** pointer listener and no `pointerFilter: 'block'`, or it swallows every click while visible (**build-ui**).

## Damage numbers (world space)

```typescript
export function spawnDamageNumber(pos: Vector3, amount: number, crit = false) {
  const e = engine.addEntity()
  const start = Vector3.add(pos, Vector3.create(0, 0.3, 0))
  Transform.create(e, { position: start })
  TextShape.create(e, {
    text: `${Math.round(amount)}`,
    fontSize: crit ? 5 : 3.5, // 10 is about 1 m tall
    textColor: crit ? Color4.create(1, 0.85, 0.2, 1) : Color4.White(),
    outlineWidth: 0.15,        // contrast on any background
    outlineColor: Color3.Black()
  })
  Billboard.create(e, {})      // faces the camera (default BM_ALL)
  Tween.setMove(e, start, Vector3.add(start, Vector3.create(0, 1, 0)), 800, EasingFunction.EF_EASEOUTQUAD)
  timers.setTimeout(() => engine.removeEntity(e), 800)
}
```

## Impact effect (hit or miss)

```typescript
export function spawnImpact(pos: Vector3, normal?: Vector3, sound = 'assets/Audio/impact.mp3') {
  const e = engine.addEntity()
  // Nudge off the surface along the normal so the burst is not half inside the wall
  Transform.create(e, { position: normal ? Vector3.add(pos, Vector3.scale(normal, 0.05)) : pos })
  ParticleSystem.create(e, {
    active: true,
    loop: false,
    rate: 0,
    lifetime: 0.5,
    maxParticles: 30,
    initialSize: { start: 0.05, end: 0.12 },
    sizeOverTime: { start: 1, end: 0 },
    initialColor: { start: Color4.create(1, 0.85, 0.4, 1), end: Color4.create(1, 0.5, 0.1, 1) },
    initialVelocitySpeed: { start: 2, end: 5 },
    blendMode: PBParticleSystem_BlendMode.PSB_ADD,
    shape: ParticleSystem.Shape.Sphere({ radius: 0.05 }),
    playbackState: PBParticleSystem_PlaybackState.PS_PLAYING,
    bursts: { values: [{ time: 0, count: 20, cycles: 1, probability: 1 }] }
  })
  AudioSource.playSound(e, sound) // spatial by default (global: false)
  timers.setTimeout(() => engine.removeEntity(e), 1500) // after the particles AND the sound finish
}
```

More looks (sparks, smoke, magic): **particle-system** → `references/particle-presets.md`. A miss into a wall gets the same call with a dustier preset. A ray that hits nothing gets only the tracer.

## Recoil on a camera-parented gun (first person)

```typescript
const REST = Vector3.create(0.25, -0.2, 0.5)
const KICK = Vector3.create(0.25, -0.17, 0.42) // up and back toward the camera

export function kick(gun: Entity) {
  Tween.setMove(gun, KICK, REST, 120, EasingFunction.EF_EASEOUTQUAD) // local position, parent = engine.CameraEntity
}
```

This is visual only: the aim ray follows the camera, not the gun.

## Weapon input loop (semi-auto / auto + fire rate)

```typescript
const ROUNDS_PER_SECOND = 8
const AUTO = true
let cooldown = 0
export let weaponEquipped = false

engine.addSystem((dt) => {
  cooldown = Math.max(0, cooldown - dt)
  if (!weaponEquipped || Health.get(playerStats).dead) return

  const wantsFire = AUTO
    ? inputSystem.isPressed(InputAction.IA_POINTER)
    : inputSystem.isTriggered(InputAction.IA_POINTER, PointerEventType.PET_DOWN)

  if (wantsFire && cooldown <= 0) {
    cooldown = 1 / ROUNDS_PER_SECOND
    fire() // hitscan.md fireHitscan(...) or projectiles.md spawnProjectile(...)
  }
})
declare function fire(): void
```

- Semi-auto: a press during the cooldown is dropped. To buffer it, remember `pressedAt` and fire when the cooldown ends, if the press is under about 0.1 s old.
- Weapon switching: `IA_ACTION_3`-`IA_ACTION_6` with `isTriggered`. Reload: `IA_PRIMARY` (E).
