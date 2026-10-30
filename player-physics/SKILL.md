---
name: player-physics
description: "Push, launch or lift the player with the Physics API: impulses, knockback, continuous and timed forces, repulsion fields (launch pads, wind zones, hover, hit knockback). Also load it when tempted to write Transform on engine.PlayerEntity to move the player. For run speed or jump height see player-avatar; for moving platforms see animations-tweens."
---

# Player Physics in Decentraland

Apply forces to the player's avatar using the `Physics` API from `@dcl/sdk/ecs`. All physics operations affect the **local player** only.

## The Transform mistake

Writes to `Transform` on `engine.PlayerEntity` compile, run and do nothing: the player Transform is engine-controlled and read-only. Push, lift or knock back with `Physics`; teleport or slide to a point with `movePlayerTo`. Full intent table: **player-avatar** → *CRITICAL: The player Transform is READ-ONLY*.

```typescript
Transform.getMutable(engine.PlayerEntity).position.y += 0.1   // WRONG: ignored
Physics.applyImpulseToPlayer(Vector3.create(0, 50, 0))        // CORRECT: one-shot launch
Physics.applyForceToPlayer(lifter, Vector3.create(0, 1, 0), 12) // CORRECT: sustained lift; stop with removeForceFromPlayer(lifter)
```

## API

| Method | Type | Notes |
|--------|------|-------|
| `Physics.applyImpulseToPlayer(dir, mag?)` | One-shot | Launch pads, jumps, explosions. `dir` is normalized when `mag` is passed. Several calls in one frame accumulate. |
| `Physics.applyKnockbackToPlayer(sourcePos, mag, radius?, falloff?)` | One-shot | Pushes away from `sourcePos`; at the exact source, straight up. A **negative** `mag` pulls toward the point. |
| `Physics.applyForceToPlayer(entity, dir, mag?)` | Continuous | The entity is the force's owner. Forces from different entities stack. Wind tunnels, conveyors, gravity fields (pair with trigger zones). |
| `Physics.removeForceFromPlayer(entity)` | Control | Stops that entity's continuous or repulsion force. |
| `Physics.applyForceToPlayerForDuration(entity, secs, dir, mag?)` | Timed | Expires automatically. |
| `Physics.applyRepulsionForceToPlayer(entity, pos, mag, radius?, falloff?)` | Continuous | Push away from `pos`, recalculated each frame as the player moves; a **negative** `mag` attracts. Pass `pos` explicitly: it is not read from the entity's Transform. |
| `Transform.localToWorldDirection(entity, dir)` | Utility | Local direction to world space, e.g. "forward from this cannon". |

Knockback and repulsion falloff (`KnockbackFalloff`):

| Falloff | Behavior |
|---------|----------|
| `KnockbackFalloff.CONSTANT` | Same magnitude at any distance within radius (default) |
| `KnockbackFalloff.LINEAR` | Smooth linear decrease to 0 at the radius edge; prefer it for most area effects |
| `KnockbackFalloff.INVERSE_SQUARE` | Sharp, physically-realistic drop-off |

Full code (launch pad, wind tunnel, repulsion field, coordinate conversion): `{baseDir}/references/physics-patterns.md`.

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

Mobile app 1.15.0 aligned capsule size, step height, jump arc, gravity, run speed and air control with desktop in a first pass; older mobile apps differ more. Physics-relevant rules on mobile: give every collider at least 1 cm of thickness (thinner ones collide only from above); never fence a play area or kill boundary with an invisible collider alone (invisible blockers may not block), back it with a `TriggerArea` + `movePlayerTo` or visible geometry; leave a margin on step and ledge heights and on landing zones after an impulse or knockback, and verify precision platforming on a device. Full list of movement and collision differences (including `TweenSequence` moving platforms, which do not move on mobile): `{baseDir}/../sdk-scenes/references/mobile-parity.md`.
