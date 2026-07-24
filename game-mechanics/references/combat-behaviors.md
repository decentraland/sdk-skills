# Combat Behaviors

Composable enemy and turret behaviors built as custom components + systems: patrol, chase, melee attack, ranged attack with pooled projectiles, targeting-mode selection for towers, projectile lead prediction, and a simple enemy finite-state machine that ties them together.

Two things drive combat targets in DCL:

- **The player is the avatar.** To chase or attack the player, read `Transform.get(engine.PlayerEntity).position` — you do not spawn a player character. In a shared scene this is the _local_ player's avatar; see the multiplayer note.
- **Towers target enemies**, which you already track (see `{baseDir}/references/wave-spawner.md`).

---

## Behavior components

```typescript
import { engine, Schemas } from '@dcl/sdk/ecs'

export const Patrol = engine.defineComponent('game::Patrol', {
  waypoints: Schemas.Array(Schemas.Vector3),
  index: Schemas.Int,
  speed: Schemas.Float,
})

export const Chase = engine.defineComponent('game::Chase', {
  speed: Schemas.Float,
  detectRange: Schemas.Float,   // start chasing within this distance
  giveUpRange: Schemas.Float,   // stop chasing beyond this distance
  stopRange: Schemas.Float,     // stop this far from target (melee/ranged standoff)
})

export const Melee = engine.defineComponent('game::Melee', {
  damage: Schemas.Float,
  range: Schemas.Float,
  cooldownMs: Schemas.Float,
  timer: Schemas.Float,         // counts down; 0 = ready
})

export const Ranged = engine.defineComponent('game::Ranged', {
  damage: Schemas.Float,
  range: Schemas.Float,
  cooldownMs: Schemas.Float,
  timer: Schemas.Float,
  projectileSpeed: Schemas.Float,
})

export const Health = engine.defineComponent('game::Health', {
  hp: Schemas.Float,
  maxHp: Schemas.Float,
})
```

---

## Patrol and chase systems

```typescript
import { engine, Entity, Transform } from '@dcl/sdk/ecs'
import { Vector3, Quaternion } from '@dcl/sdk/math'

function moveToward(entity: Entity, target: Vector3, speed: number, dt: number): number {
  const t = Transform.getMutable(entity)
  const dist = Vector3.distance(t.position, target)
  const step = speed * dt
  if (dist <= step || dist === 0) { t.position = target; return 0 }
  const dir = Vector3.normalize(Vector3.subtract(target, t.position))
  t.position = Vector3.add(t.position, Vector3.scale(dir, step))
  // Face travel direction (flat yaw):
  t.rotation = Quaternion.fromLookAt(t.position, target)
  return dist - step
}

export function patrolSystem(dt: number) {
  for (const [entity, patrol] of engine.getEntitiesWith(Patrol)) {
    if (patrol.waypoints.length === 0) continue
    const p = Patrol.getMutable(entity)
    const wp = p.waypoints[p.index]
    const remaining = moveToward(entity, wp, p.speed, dt)
    if (remaining === 0) p.index = (p.index + 1) % p.waypoints.length
  }
}

export function chaseSystem(dt: number) {
  const playerPos = Transform.get(engine.PlayerEntity).position
  for (const [entity, chase] of engine.getEntitiesWith(Chase)) {
    const pos = Transform.get(entity).position
    const dist = Vector3.distance(pos, playerPos)
    if (dist > chase.giveUpRange) continue // out of range: idle / hand back to patrol via FSM
    if (dist > chase.stopRange) moveToward(entity, playerPos, chase.speed, dt)
    // within stopRange: hold position and let melee/ranged fire
  }
}
engine.addSystem(patrolSystem)
engine.addSystem(chaseSystem)
```

---

## Melee attack

```typescript
export function meleeSystem(dt: number) {
  const ms = dt * 1000
  const playerPos = Transform.get(engine.PlayerEntity).position
  for (const [entity, melee] of engine.getEntitiesWith(Melee)) {
    const m = Melee.getMutable(entity)
    if (m.timer > 0) { m.timer -= ms; continue }
    const pos = Transform.get(entity).position
    if (Vector3.distance(pos, playerPos) <= m.range) {
      dealDamageToPlayer(m.damage)  // your damage sink (UI, knockback, etc.)
      m.timer = m.cooldownMs
    }
  }
}
engine.addSystem(meleeSystem)
```

For melee **against enemies** (a player-controlled attack), read the player's position/facing and test enemy distance on an E-key press instead (see **add-interactivity**). For knockback pushing the avatar on hit, apply an impulse — see **player-physics**.

---

## Targeting modes (towers / turrets)

A tower must pick which enemy to shoot. Support the classic modes: first (furthest along the path), last (least progress), closest, strongest (highest HP).

```typescript
export type TargetingMode = 'first' | 'last' | 'closest' | 'strongest'

// `enemies` is your live set; `progressOf` returns 0..1 path progress (see wave-spawner).
export function selectTarget(
  towerPos: Vector3,
  range: number,
  enemies: Iterable<Entity>,
  mode: TargetingMode,
  progressOf: (e: Entity) => number,
): Entity | null {
  let best: Entity | null = null
  let bestScore = -Infinity
  for (const e of enemies) {
    const pos = Transform.getOrNull(e)?.position
    if (!pos) continue
    const dist = Vector3.distance(towerPos, pos)
    if (dist > range) continue
    let score: number
    switch (mode) {
      case 'first':    score = progressOf(e); break
      case 'last':     score = -progressOf(e); break
      case 'closest':  score = -dist; break
      case 'strongest': score = Health.getOrNull(e)?.hp ?? 0; break
    }
    if (score > bestScore) { bestScore = score; best = e }
  }
  return best
}
```

---

## Ranged attack with pooled projectiles and lead prediction

Projectiles are pooled (see **optimize-scene**) — never create/destroy one per shot at scale. To hit a moving target, **lead** it: aim at where the target will be after the projectile's travel time, not where it is now.

```typescript
// Predict the intercept point: lead the target based on projectile speed.
// A one-step estimate (good enough for most games): compute travel time to the
// target's CURRENT position, then offset by the target's velocity over that time.
export function predictIntercept(
  shooterPos: Vector3, targetPos: Vector3, targetVel: Vector3, projSpeed: number,
): Vector3 {
  const dist = Vector3.distance(shooterPos, targetPos)
  const travelTime = projSpeed > 0 ? dist / projSpeed : 0
  return Vector3.add(targetPos, Vector3.scale(targetVel, travelTime))
}

// Fire a pooled projectile toward an aim point, moving it with a Tween.
import { Tween, EasingFunction, MeshRenderer, MeshCollider } from '@dcl/sdk/ecs'

export function fireProjectile(from: Vector3, aim: Vector3, speed: number, getProjectile: () => Entity) {
  const proj = getProjectile()               // pooled entity
  Transform.createOrReplace(proj, { position: from })
  MeshRenderer.setSphere(proj)
  const dist = Vector3.distance(from, aim)
  Tween.createOrReplace(proj, {
    mode: Tween.Mode.Move({ start: from, end: aim, faceDirection: true }),
    duration: (dist / speed) * 1000,
    easingFunction: EasingFunction.EF_LINEAR,
  })
  // On tweenCompleted(proj): apply damage if still in range, then return proj to the pool.
}
```

Track each target's velocity by storing its last position and diffing per frame (`vel = (pos - lastPos) / dt`), or read it from your path system. For path-following enemies, the target's velocity is its path direction × speed. When the target dies mid-flight, either destroy the projectile or let it fly to the last aim point — decide per game.

---

## Enemy FSM

Tie the behaviors together with a small state machine per enemy: `idle → patrol → chase → attack → dead`. Store the state on a component; one system evaluates transitions and delegates to the behavior systems above.

```typescript
export enum EnemyState { Idle = 0, Patrol = 1, Chase = 2, Attack = 3, Dead = 4 }

export const Enemy = engine.defineComponent('game::Enemy', {
  state: Schemas.EnumNumber<EnemyState>(EnemyState, EnemyState.Patrol),
})

export function enemyFsmSystem(_dt: number) {
  const playerPos = Transform.get(engine.PlayerEntity).position
  for (const [entity, enemy] of engine.getEntitiesWith(Enemy)) {
    if (enemy.state === EnemyState.Dead) continue
    const e = Enemy.getMutable(entity)
    const hp = Health.getOrNull(entity)
    if (hp && hp.hp <= 0) { e.state = EnemyState.Dead; onEnemyDead(entity); continue }

    const dist = Vector3.distance(Transform.get(entity).position, playerPos)
    const chase = Chase.getOrNull(entity)
    const melee = Melee.getOrNull(entity)
    const atkRange = melee?.range ?? Ranged.getOrNull(entity)?.range ?? 0

    switch (e.state) {
      case EnemyState.Patrol:
        if (chase && dist <= chase.detectRange) e.state = EnemyState.Chase
        break
      case EnemyState.Chase:
        if (chase && dist > chase.giveUpRange) e.state = EnemyState.Patrol
        else if (dist <= atkRange) e.state = EnemyState.Attack
        break
      case EnemyState.Attack:
        if (dist > atkRange) e.state = EnemyState.Chase
        break
    }
  }
}
engine.addSystem(enemyFsmSystem)
```

The behavior systems (`patrolSystem`, `chaseSystem`, `meleeSystem`) can each early-out when the FSM state does not match (e.g. only run `patrolSystem` logic when `Enemy.state === Patrol`), or you can guard inside them. `onEnemyDead` plays a death effect, awards currency, notifies the wave manager (`waveManager.killEnemy(entity)`), and returns the entity to the pool.

> For **conversational NPCs** (dialog trees, greeting the player) rather than combat enemies, use the **npcs** skill — it wraps AvatarShape and a dialog toolkit. This file is about hostile/target behaviors.

---

## Multiplayer

- **`engine.PlayerEntity` is the local player.** Chase/melee systems targeting `engine.PlayerEntity` naturally target each client's own avatar. To make enemies target _any_ player, iterate `Transform` of entities with `PlayerIdentityData` and pick the nearest (see **multiplayer-sync**).
- **Shared enemies:** if all players must see the same enemies and damage, either run combat on one authority and `syncEntity` the enemy entities, or use an **authoritative-server**. Running full combat independently on every client will desync HP and deaths.
- **Local-only horde:** each client runs its own enemies against its own avatar — simplest, and correct when players are not sharing the same fight.
- **Knockback on the player:** apply via **player-physics** impulses; you cannot directly set the avatar's velocity through `Transform`.
