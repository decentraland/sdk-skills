# Status Effects

Timed modifiers (slow, poison, burn, stun, buffs) attached to entities as a custom SDK7 component. Effects are keyed by a string id, use **refresh-don't-stack** semantics (re-applying the same id resets its timer instead of adding a second copy), auto-expire, and can drive stat multipliers plus visual feedback.

---

## Component definition

Store effects as parallel arrays inside one component (SDK7 `Schemas` support `Schemas.Array`). Each slot holds an id, a remaining-time counter, a speed multiplier, and a stat multiplier.

```typescript
import { engine, Schemas } from '@dcl/sdk/ecs'

export const StatusEffects = engine.defineComponent('game::StatusEffects', {
  ids: Schemas.Array(Schemas.String),          // effect identifiers, e.g. 'slow'
  remaining: Schemas.Array(Schemas.Float),      // ms left per effect
  speedMul: Schemas.Array(Schemas.Float),       // multiplier on movement speed
  statMul: Schemas.Array(Schemas.Float),        // generic multiplier (damage, etc.)
})
```

> Parallel arrays keep the schema flat and CRDT-friendly (see multiplayer note). If you never sync effects, a plain `Map<Entity, Effect[]>` in module scope is also fine and simpler — but a component lets you query all affected entities with `engine.getEntitiesWith(StatusEffects)`.

---

## Apply, remove, query

```typescript
import { Entity } from '@dcl/sdk/ecs'

export type EffectSpec = {
  id: string
  durationMs: number
  speedMul?: number  // default 1 (no change)
  statMul?: number   // default 1
}

export function applyEffect(entity: Entity, spec: EffectSpec) {
  const se = StatusEffects.getMutableOrNull(entity)
    ?? StatusEffects.create(entity, { ids: [], remaining: [], speedMul: [], statMul: [] })
  const i = se.ids.indexOf(spec.id)
  if (i >= 0) {
    // Refresh, don't stack: reset the timer (and refresh multipliers).
    se.remaining[i] = spec.durationMs
    se.speedMul[i] = spec.speedMul ?? 1
    se.statMul[i] = spec.statMul ?? 1
  } else {
    se.ids.push(spec.id)
    se.remaining.push(spec.durationMs)
    se.speedMul.push(spec.speedMul ?? 1)
    se.statMul.push(spec.statMul ?? 1)
  }
  refreshVisual(entity)
}

export function hasEffect(entity: Entity, id: string): boolean {
  const se = StatusEffects.getOrNull(entity)
  return !!se && se.ids.includes(id)
}

export function removeEffect(entity: Entity, id: string) {
  const se = StatusEffects.getMutableOrNull(entity)
  if (!se) return
  const i = se.ids.indexOf(id)
  if (i < 0) return
  se.ids.splice(i, 1); se.remaining.splice(i, 1)
  se.speedMul.splice(i, 1); se.statMul.splice(i, 1)
  refreshVisual(entity)
}

// Aggregate multipliers for use by movement / combat.
export function speedMultiplier(entity: Entity): number {
  const se = StatusEffects.getOrNull(entity)
  return se ? se.speedMul.reduce((m, v) => m * v, 1) : 1
}
export function statMultiplier(entity: Entity): number {
  const se = StatusEffects.getOrNull(entity)
  return se ? se.statMul.reduce((m, v) => m * v, 1) : 1
}
```

---

## Auto-expiry system

One system per frame decrements timers and removes expired effects.

```typescript
export function statusEffectSystem(dt: number) {
  const ms = dt * 1000
  for (const [entity, se] of engine.getEntitiesWith(StatusEffects)) {
    const mut = StatusEffects.getMutable(entity)
    let changed = false
    for (let i = mut.ids.length - 1; i >= 0; i--) {
      mut.remaining[i] -= ms
      if (mut.remaining[i] <= 0) {
        mut.ids.splice(i, 1); mut.remaining.splice(i, 1)
        mut.speedMul.splice(i, 1); mut.statMul.splice(i, 1)
        changed = true
      }
    }
    if (changed) refreshVisual(entity)
  }
}
engine.addSystem(statusEffectSystem)
```

---

## Visual feedback while active

Tint or make the model glow while any effect is active. Use `Material.setPbrMaterial` with `emissiveColor`/`emissiveIntensity` (verified fields) so the effect reads even in shadow. Restore the base material when the last effect clears.

```typescript
import { Material } from '@dcl/sdk/ecs'
import { Color3, Color4 } from '@dcl/sdk/math'

function refreshVisual(entity: Entity) {
  const se = StatusEffects.getOrNull(entity)
  const active = !!se && se.ids.length > 0
  if (active) {
    // Blue slow-tint glow (pick a colour per effect id if you like).
    Material.setPbrMaterial(entity, {
      albedoColor: Color4.create(0.5, 0.7, 1, 1),
      emissiveColor: Color3.create(0.2, 0.5, 1),
      emissiveIntensity: 1.5,
    })
  } else {
    // Restore neutral material (or re-apply the model's original).
    Material.setPbrMaterial(entity, { albedoColor: Color4.White() })
  }
}
```

> `Material` tint applies to primitive `MeshRenderer` entities. For a `GltfContainer` model, tinting the whole GLB is not a single-field operation — instead show effect state with a small child primitive (a glowing ring/orb at the model's feet) or a particle emitter, and toggle its visibility in `refreshVisual`.

---

## Worked example — slow effect from a tower hit

A frost tower applies a 50%-speed slow for 2 seconds on hit. Because path-followers move via constant-speed Tweens, a slow that changes speed every frame needs a **lerp-based** movement system rather than a fixed-duration Tween (see the note in `{baseDir}/references/wave-spawner.md`). The slow simply scales the per-frame step:

```typescript
// On projectile impact (see combat-behaviors):
applyEffect(targetEnemy, { id: 'slow', durationMs: 2000, speedMul: 0.5 })

// In the enemy's lerp movement system, scale the step by the aggregate multiplier:
const baseSpeed = 2 // m/s
const step = baseSpeed * speedMultiplier(enemy) * dt
// advance the enemy `step` metres along the path...
```

Re-applying `'slow'` before it expires refreshes the 2 s timer (no stacking to 25% speed). To stack distinct debuffs (e.g. `slow` + `poison`), give them different ids — their multipliers combine via `speedMultiplier` / `statMultiplier`.

---

## Multiplayer

- **Local-only:** each client computes effects on its own enemies. No sync needed if enemies are already local.
- **Shared game:** add `StatusEffects.componentId` to the enemy's `syncEntity` call so all players see the same debuffs and tint. The parallel-array schema is CRDT-compatible; last-write-wins resolves concurrent applications. See **multiplayer-sync**.
- **Effects on the player avatar** (e.g. a slow trap that reduces the local player's movement) require an `InputModifier` on `engine.PlayerEntity` rather than this component — you cannot tween the avatar's speed directly. See **advanced-input** and **player-physics**.
