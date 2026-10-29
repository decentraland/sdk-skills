---
name: player-physics
description: Apply physics forces to the player in Decentraland scenes. Impulses (one-shot pushes), knockback (push away from a point with falloff), continuous forces (wind tunnels, anti-gravity, lift, hover), timed forces, and repulsion fields. Use when the user wants launch pads, knockback on hit, wind zones, gravity fields, or lifting/floating/hovering the player. THIS is also the right skill when an agent's first instinct is to mutate `Transform` on `engine.PlayerEntity` to move/lift/push the player — that does NOT work (player Transform is engine-controlled and read-only); use the Physics API instead. Do NOT use for player movement speed (see player-avatar AvatarLocomotionSettings) or platform movement (see animations-tweens).
---

# Player Physics in Decentraland

Apply forces to the player's avatar using the `Physics` API from `@dcl/sdk/ecs`. All physics operations affect the **local player** only.

## Why this skill exists — the Transform mistake

The player's `Transform` (on `engine.PlayerEntity`) is **engine-controlled and read-only from scene code**. Writing to it via `Transform.getMutable`, `Transform.createOrReplace`, or direct `.position` / `.rotation` mutation **silently does nothing** — the code compiles, the system ticks, no error is thrown, and the avatar never moves.

**If your goal is to lift, float, push, knock back, or apply any sustained force to the player, use this skill's `Physics` API.** For instant teleports / smooth slides to a specific position, use `movePlayerTo` from `~system/RestrictedActions` (skill: `player-avatar`).

```typescript
// WRONG — has no effect in-world
const t = Transform.getMutable(engine.PlayerEntity)
t.position.y += 0.1  // ignored every frame

// CORRECT — lift the player upward
import { Physics } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'
Physics.applyImpulseToPlayer(Vector3.create(0, 50, 0))   // one-shot upward launch
// or, sustained lift / hover:
const lifter = engine.addEntity()
Physics.applyForceToPlayer(lifter, Vector3.create(0, 1, 0), 12)  // continuous upward force
// stop with: Physics.removeForceFromPlayer(lifter)
```

## Impulse (One-Shot Push)

Apply a single instantaneous force with `Physics.applyImpulseToPlayer(direction, magnitude?)`. Direction is auto-normalized when magnitude is passed separately. Multiple calls within the same frame are accumulated. Use for launch pads, jumps, and explosions.

## Knockback (Push Away from a Point)

Push the player away from a source position with `Physics.applyKnockbackToPlayer(sourcePos, magnitude, radius?, falloff?)`. Direction is computed automatically from source to player.

### KnockbackFalloff Options

| Falloff | Behavior |
|---------|----------|
| `KnockbackFalloff.CONSTANT` | Same magnitude at any distance within radius (default) |
| `KnockbackFalloff.LINEAR` | Smooth linear decrease to 0 at the radius edge |
| `KnockbackFalloff.INVERSE_SQUARE` | Sharp, physically-realistic drop-off |

If the player is exactly at the source, they are pushed straight up. A **negative magnitude** pulls the player toward the point. Same falloff values apply to `applyRepulsionForceToPlayer()`. Prefer `KnockbackFalloff.LINEAR` for most area effects — it feels natural and predictable.

## Continuous Force

Apply a persistent directional force identified by an **entity** (the force "owner"). Multiple forces from different entities stack.

- Apply: `Physics.applyForceToPlayer(entity, direction, magnitude?)`
- Remove: `Physics.removeForceFromPlayer(entity)`

Use with trigger zones for wind tunnels, conveyor belts, and gravity fields.

## Timed Force

Apply a force for a fixed duration: `Physics.applyForceToPlayerForDuration(entity, seconds, direction, magnitude?)`. Expires automatically.

## Repulsion Force

Continuous push away from a fixed point with distance-based falloff, recalculated each frame: `Physics.applyRepulsionForceToPlayer(entity, position, magnitude, radius)`. The position must be passed explicitly — not read from the entity's Transform automatically. Remove with `Physics.removeForceFromPlayer(entity)`.

## Coordinate Conversion (Local to World Direction)

Convert local direction to world space with `Transform.localToWorldDirection(entity, localDir)`. Use when pushing relative to an entity's orientation (e.g. "forward from this cannon").

## Quick Reference

| Method | Type | Description |
|--------|------|-------------|
| `Physics.applyImpulseToPlayer(dir, mag?)` | One-shot | Instant directional push |
| `Physics.applyKnockbackToPlayer(pos, mag, radius?, falloff?)` | One-shot | Push away from point |
| `Physics.applyForceToPlayer(entity, dir, mag?)` | Continuous | Persistent push while active |
| `Physics.removeForceFromPlayer(entity)` | Control | Stop a continuous force |
| `Physics.applyForceToPlayerForDuration(entity, secs, dir, mag?)` | Timed | Force that expires automatically |
| `Physics.applyRepulsionForceToPlayer(entity, pos, mag, radius)` | Continuous | Distance-based push from point |
| `Transform.localToWorldDirection(entity, dir)` | Utility | Convert local direction to world space |

## Trigger-zone collider layers — which player fires the trigger

`Physics.*` always affects the **local** player. When you drive forces from a `TriggerArea`, the collider mask decides which avatars fire the callback (verified in test scene [`5,5-collider-layers`](https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/5,5-collider-layers)):

| Mask | Fires for |
|------|-----------|
| `ColliderLayer.CL_MAIN_PLAYER` | the **local** player only |
| `ColliderLayer.CL_PLAYER` | **remote** avatars only (NOT the local player) |
| `CL_PLAYER \| CL_MAIN_PLAYER` | both local and remote |
| `ColliderLayer.CL_PHYSICS` | never fires for any avatar (targets scene mesh/walls, not characters) |

**Prefer `CL_MAIN_PLAYER` for player-physics trigger zones.** Because the callback then only fires for the local player, you do not need a remote-vs-local guard, and the force is applied to the one avatar it can affect. A launch pad using `CL_PLAYER` alone will NOT fire for the local player (only for remote avatars), so it never launches the person standing on it — a common bug.

If you do use `CL_PLAYER | CL_MAIN_PLAYER`, guard with `result.trigger?.entity === engine.PlayerEntity` — `result.trigger?.entity` is the entity that entered. Note: `result.triggeredEntity` is the trigger area's OWN entity, not the entrant, so comparing it to `PlayerEntity` never distinguishes who entered.

## Forces while gliding

While the player is gliding (glider open), forces behave differently:
- **Continuous forces** (`applyForceToPlayer`, `applyForceToPlayerForDuration`, `applyRepulsionForceToPlayer`) are **1.5× stronger** — the open glider catches the airflow, so wind zones/currents feel more responsive.
- The **upward component** of a continuous force can **lift** a gliding player. `glidingFallingSpeed` (in `AvatarLocomotionSettings`) only caps *descent* speed; it does not cancel upward motion, so an angled or vertical current pushes the player along the full force direction. Enables thermal updrafts / wind corridors.
- **One-shot impulses** (`applyImpulseToPlayer`, `applyKnockbackToPlayer`) are **NOT** affected by gliding — identical whether the glider is open or closed.

## Mobile does not move exactly like desktop

Mobile app **v1.15.0** (Oct 2026) landed a **first** Unity-parity pass — capsule size, step height, jump arc and gravity, run speed and air control — and fixed downward player raycasts, which now report the correct `hitDistance` on sloped geometry. It is a first pass, not parity: the following are still open with no ETA (docs commit `5f212e3`).

- **Slopes, edges, walls, landing and moving platforms** still behave differently from Unity, as does **glide** behavior (fixes in review).
- **Scene colliders thinner than 1 cm only collide from above.** A 0.5 cm wall, a thin invisible floor plate or a paper-thin ramp is walk-through from the side on mobile. **Give every collider at least 1 cm of thickness** — cheap insurance, and the single most actionable rule here.
- **Invisible blockers and some SDK collision layers do not block the player at all** on mobile. Do not fence a play area, a kill boundary or a "stay inside" rule with an invisible collider alone; back it with a `TriggerArea` + `movePlayerTo`, or with geometry the player can see.
- **Spawn, landing and jump animations and movement blending are missing** — the avatar reads as stiffer; do not time a mechanic to an animation beat the mobile client never plays.

A step, kerb or ledge height tuned until it "just barely" works on desktop may still be unclimbable — or climbable when it shouldn't be — on a phone, and landing position after an impulse or knockback can differ. Give traversal geometry a **margin** rather than tuning to the exact threshold, keep a forgiving landing area on any forced-movement mechanic, and verify on a device before shipping precision platforming. Also note **`TweenSequence` does not animate on mobile** (**animations-tweens**) — a moving platform built on one is a dead platform on a phone. Mobile parity list: **advanced-input** → *Mobile considerations*.

For full code examples (launch pad, wind tunnel, repulsion field, coordinate conversion), see `{baseDir}/references/physics-patterns.md`.

Knockback as hit feedback in combat (explosions, enemy hits) together with health and damage: **projectiles-combat**.
