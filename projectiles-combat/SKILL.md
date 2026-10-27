---
name: projectiles-combat
description: Weapons, shooting and combat in Decentraland SDK7 scenes — hitscan guns and lasers (instant raycast from the camera, two-ray third-person aim), visible projectiles (arrows, fireballs, grenades, cannonballs) moved by a system with anti-tunneling raycasts, ballistic arcs, hit feedback (impact particles, sounds, hit markers, damage numbers, recoil), health/damage/invulnerability/death/respawn, fire-rate and auto-fire input, and who decides a hit in multiplayer. Use when the user wants guns, shooting, a turret or cannon, bows and arrows, spells or fireballs, throwing, enemies that take damage, health bars, PvP or PvE combat. For generic raycasts see add-interactivity; for knockback see player-physics.
---

# Projectiles & Combat

Combat in SDK7 is built from parts that already exist: `Raycast`/`raycastSystem` for hit detection, a system that moves projectile entities, custom components for health, `ParticleSystem`/`AudioSource`/UI for feedback. There is no weapon or damage API. This skill sets the conventions.

Imports used throughout:

```typescript
import {
  engine, Transform, Raycast, RaycastResult, RaycastQueryType, raycastSystem, ColliderLayer,
  MeshCollider, MeshRenderer, CameraMode, CameraType, AvatarAttach, AvatarAnchorPointType,
  inputSystem, InputAction, PointerEventType, Schemas, timers
} from '@dcl/sdk/ecs'
import { Vector3, Quaternion } from '@dcl/sdk/math'
```

## Pick the technique

| Weapon | Technique | Why |
|---|---|---|
| Gun, laser, sniper, melee "swing" | **Hitscan** — one ray, no bullet entity | Instant, cheap, nothing to tunnel |
| Arrow, fireball, rocket, slow plasma ball | **Projectile entity** moved in a system, with a look-ahead ray | Player sees it travel and can dodge |
| Grenade, mortar, cannonball, thrown object | **Projectile + gravity**, launch velocity from the **ballistic solver** | Lands where aimed |

Default to hitscan. Use a visible projectile only when travel time is part of the design.

## Raycast facts that shape everything (verified)

Sources: `@dcl/ecs/src/systems/raycast.ts`, protocol `raycast.proto` / `raycast_result.proto` / `common/raycast_hit.proto` / `mesh_collider.proto`, unity-explorer main `ExecuteRaycastSystem.cs` + `PhysicsLayers.cs` (released in v0.191.0-alpha).

- **Results are asynchronous.** The renderer runs the ray and writes `RaycastResult` back. `raycastSystem.register*` also waits one tick before creating the `Raycast` component. Expect the callback **2-3 ticks after you fire**. A continuous `Raycast` component read in a system lags about one tick. You cannot raycast and use the answer in the same tick.
- **One `Raycast` per entity.** Registering again on the same entity replaces both the component and the callback, so the earlier shot's callback never fires. For overlapping shots (auto-fire), give each shot its own entity.
- `raycastSystem` helper defaults: `maxDistance: 16`, `queryType: RQT_HIT_FIRST`, `continuous: false`, `collisionMask: CL_PHYSICS`. The raw component's default mask is `CL_POINTER | CL_PHYSICS`. Always set the range and the mask explicitly.
- Hit fields: `position` (scene-relative), `normalHit`, `length` (distance from the origin), `entityId?`, `meshName?`, `globalOrigin`, `direction`.
- **Player layers on rays** (unity-explorer main): `CL_PLAYER` matches the **local** player and remote avatars, and `CL_MAIN_PLAYER` matches only the local player. A local-player hit reports `entityId === engine.PlayerEntity`. A remote-avatar hit reports **no `entityId`**: you learn that an avatar was hit, but not which one. Masks without player bits never hit avatars.
- Unity collects at most **10 raw hits per ray** before filtering. `RQT_HIT_FIRST` takes the closest qualifying one, but in a cluttered scene a long ray can miss the true nearest. Keep ranges tight.
- **Rays on entities more than about 64 m from the camera are not executed.** The explorer skips `Raycast` entities whose distance bucket from the camera is above 3; the buckets are 16/32/48/64 m (`RaycastBucketThreshold: 3`). The ray stays pending, it does not error. Rays on `engine.PlayerEntity` and `engine.CameraEntity` are exempt. Cap projectile lifetime and range so they die before about 60 m.
- Rays run only while the player is **inside the scene**. On leaving, pending rays get an empty result.
- The ray origin is the entity's world position **plus** `originOffset`. `originOffset` is **not** rotated by the entity. `localDirection` **is** rotated by the entity's world rotation.

## Where shots come from

- Camera: `Transform.get(engine.CameraEntity)` gives `position` and `rotation` (scene-relative). Look direction: `Vector3.rotate(Vector3.Forward(), rotation)`.
- Player: `Transform.get(engine.PlayerEntity).position` is the avatar **root at the feet**. The Unity character capsule is 1.6 m tall, centred 0.8 m above the root (`CharacterObject.prefab`). The docs place the first-person camera at about 1.75 m.
- Shoulder or hand: attach an **empty** entity with `AvatarAttach` (`AAPT_RIGHT_SHOULDER` / `AAPT_RIGHT_HAND`). The explorer writes the bone's offset **from the player root** (world axes) back into that entity's `Transform`, so the bone's world position is `playerPos + Transform.get(anchor).position` (see **player-avatar**). Fallback before the first write-back: feet + `(0, 1.4, 0)` [UNVERIFIED estimate].
- Camera mode: `CameraMode.get(engine.CameraEntity).mode` is `CameraType.CT_FIRST_PERSON` or `CT_THIRD_PERSON`. A `CameraModeArea` can force first person in an arena (**camera-control**).

## Hitscan

**First person:** one ray from the camera along the look direction. Cheapest form: a child entity of `engine.CameraEntity` with a **continuous** `Raycast` (`localDirection: (0,0,1)`) while the weapon is equipped. On fire, read its latest `RaycastResult`, so there is no extra async wait.

**Third person: use two rays.** A ray from the camera alone hits things the avatar cannot see: it shoots *past* the cover the avatar stands behind, or around corners.
1. **Aim ray**, from the camera along the look direction. Its closest hit, or `camPos + dir * range` if nothing is hit, is the **aim point**: what the crosshair is on.
2. **Fire ray**, from the shoulder toward the aim point, with `maxDistance = distance(shoulder, aimPoint) + 0.25`. Whatever this ray hits first is what the shot actually hits. If that is a wall before the aim point, the wall takes the hit.

Keep the aim ray continuous, so on fire only the fire ray is async. In first person, skip ray 2.

Self-hits: with player bits in the mask, use `RQT_QUERY_ALL`, drop hits whose `entityId === engine.PlayerEntity`, and pick the smallest `length`. For PvE only, leave player bits out of the mask and `RQT_HIT_FIRST` is fine.

Full code: `{baseDir}/references/hitscan.md`. It covers the aim ray, the two-ray fire, the nearest-hit filter, identifying which remote player was hit, and a tracer.

## Visible projectiles

An entity with a custom `Projectile` component (velocity, gravity, age, max age, owner, damage), moved by one system:

1. **Check before you move.** Each tick, read the projectile's continuous look-ahead `RaycastResult`. If a valid hit lies within this tick's travel distance, measured along the direction of travel (`dot(hit.position - pos, dir) <= speed * dt`, including negative values caught late), it is an impact: resolve it at `hit.position` and remove the projectile.
2. Otherwise move: `pos += v * dt`, then `v.y -= g * dt` (gravity applied by hand), and face the direction of travel with `Quaternion.lookRotation(dir)`.
3. Re-aim the look-ahead ray along the new direction, with `maxDistance = speed * dt * 3 + 0.5`. Because results lag a tick or two, the ray has to reach further than one step. That is what stops fast shots tunneling through thin walls.

Rules:
- **Spawn about 1 m clear of the muzzle**, along the aim direction, so the first step cannot start inside the shooter or the gun. Also drop `entityId === engine.PlayerEntity` hits for the local player's own projectiles.
- **Lifetime cap** (for example 4-6 s), plus the 64 m raycast-distance cutoff above. Always remove the entity, even on a miss.
- **No collider on the projectile.** Use `MeshRenderer` without a `MeshCollider`, or for a GLB set `invisibleMeshesCollisionMask: 0` (its default is `CL_POINTER | CL_PHYSICS`). Otherwise other rays, and the player, collide with bullets.
- A projectile's `Raycast` updates every tick. Keep the number of live projectiles small (tens, not hundreds). Pool entities rather than creating and removing them every shot if fire rates are high.

**Ballistic arcs:** firing a gravity projectile straight along the aim line lands short. Solve the launch velocity instead: `solveBallistic(from, to, speed, g, preferHighArc?)` returns a `Vector3` velocity, or `null` when the target is out of range at that speed. Fall back to the 45° max-range shot, or refuse to fire.

Full system, spawn helper and solver: `{baseDir}/references/projectiles.md`.

## Targets, health, damage

- **Hittable = has a collider on the ray's mask + a `Health` component** (or a `Hitbox` child that points to the owner). Check `Health.has(hit.entityId)` and do not trust the layer alone.
- **Rigged/skinned GLB enemies:** `visibleMeshesCollisionMask` does not make the skinned mesh hittable (**add-interactivity**). Give them an invisible `MeshCollider` child as the hitbox. Put hitboxes on `CL_CUSTOM1` (not `CL_PHYSICS`) when the player should not bump into them, and add `CL_CUSTOM1` to the shot mask. One hitbox per region (head, body) with a `multiplier` gives headshots.
- `applyDamage(target, amount, sourceId)` is the single entry point. It ignores dead or invulnerable targets, subtracts HP, records `lastDamageSource`, starts a short **invulnerability window** (i-frames, about 0.1-0.5 s for multi-hit weapons, about 1-2 s after the local player takes damage or respawns), then fires feedback and, at 0 HP, the death handler.
- **Damage source id:** use a string (`getPlayer()?.userId` for players, `'npc:<name>'` or `'hazard:<name>'` otherwise). It decides kill credit and ignores friendly fire, and it is what you send over the network.
- **Local player health** lives in your own state entity. Do not put it on `engine.PlayerEntity`, whose Transform is engine-owned. Death: freeze with `InputModifier` (`disableAll`), show the UI, then `timers.setTimeout`, `movePlayerTo({ newRelativePosition: spawn })` from `~system/RestrictedActions`, remove the `InputModifier`, restore HP, and grant spawn protection.
- **Enemy death:** play the animation or particles, stop its AI, then remove it after a `timers.setTimeout` (or pool it).

Code: `{baseDir}/references/health-damage.md`.

## Hit feedback

| Cue | How (SDK7) | Notes |
|---|---|---|
| Impact effect | One-shot `ParticleSystem` burst entity at `hit.position` (`loop: false`, `rate: 0`, one burst). Remove it after its `lifetime` | Also on a **miss** that hits a wall. A ray that hits nothing needs only a tracer. Presets: **particle-system** (One-Shot Burst) |
| Hit sound | `AudioSource.playSound(entity, src)` on an impact entity (spatial) or on a child of `engine.CameraEntity` (always audible) | `playSound` re-triggers cleanly. See **audio-video** |
| Hit marker / damage flash | Screen UI driven by module state the combat code sets (`hitMarkerUntil`, `damageFlashUntil`) | Build with **build-ui**. A full-screen flash must be pointer-transparent (no listener, no `pointerFilter: 'block'`) or it eats every click |
| Damage numbers | World-space `TextShape` + `Billboard` + `Tween.setMove` upward, removed after about 0.8 s | Give the text an outline for contrast. Code in health-damage.md |
| Recoil | `Tween.setMove` of the camera-parented gun model back from a kicked offset | First person only. Visual only, does not move the aim |
| Player knockback when hit | `Physics.applyKnockbackToPlayer(sourcePos, mag, radius, falloff)` | **player-physics** |

**Camera shake: not available.** Scenes cannot offset the player's camera. A `VirtualCamera` replaces the camera outright (and in third person takes away orbit control), so it is unsuitable for a hit cue. Use flash, sound, recoil and knockback instead.

## Input

- **Bind fire to `InputAction.IA_POINTER`** (left mouse; the interaction button on mobile). Secondary or alt fire: `IA_PRIMARY` (E) / `IA_SECONDARY` (F). Weapon slots: `IA_ACTION_3`-`IA_ACTION_6` (keys 1-4). There is **no right-mouse `InputAction`** (protocol `input_action.proto`), so aim-down-sights needs a key.
- **Semi-auto:** `inputSystem.isTriggered(IA_POINTER, PET_DOWN)` fires once per press. **Auto:** `inputSystem.isPressed(IA_POINTER)` every tick, gated by a cooldown. Both called **without an entity** are answered from every entity's input results (see **advanced-input**). For a gun that is what you want: a click anywhere fires.
- **Fire-rate cooldown:** accumulate `dt` in the weapon system (`cooldown -= dt; if (cooldown <= 0 && wantsFire) { fire(); cooldown = 1 / roundsPerSecond }`). Do not use `timers` for this.
- **Pointer lock:** when locked, the desktop explorer shows its own centre crosshair (unity-explorer `UpdateCursorInputSystem`), so the look ray matches it. When unlocked, the player aims with the cursor: cast along `PrimaryPointerInfo.worldRayDirection` instead of camera forward, or request lock on equip with `PointerLock.getMutable(engine.CameraEntity).isPointerLocked = true` (**advanced-input**). The native crosshair cannot be hidden on desktop. On mobile, `TouchScreenControls.hideCrosshair()` hides it.
- **Mobile:** the scene can't read where a tap lands. Aim with the camera centre. Consider `TouchScreenControls.setMainAction(InputAction.IA_POINTER)` so the big button fires [UNVERIFIED whether that reports as a global `IA_POINTER` press — test on device].
- Gate firing on game state (equipped, alive, round active) so `IA_POINTER` still works for normal clicks elsewhere.

## First-person weapon model (viewmodel)

- **Verified pattern:** parent the gun to the camera: `Transform.create(gun, { parent: engine.CameraEntity, position: Vector3.create(0.25, -0.2, 0.5) })`. It follows camera yaw **and pitch** with no animation jitter (**player-avatar** → *Held items vs cosmetic items*).
- `AvatarAttach` to `AAPT_RIGHT_HAND` follows the animated bone (idle bob, walk cycle). Use it for what **other** players see, or for third-person looks, never for aim.
- Muzzle position = gun world position + the rotated barrel offset. For hitscan, the tracer starts at the muzzle, but the **hit is decided by the camera and shoulder rays**, never by the gun.
- The camera-parented model also shows in third person, floating at the camera. Hide it outside first person (`VisibilityComponent`), or force first person with `CameraModeArea`.

## Multiplayer: who decides a hit

Any client-reported hit can be forged. A modified client can send "I hit X for 999" or ignore damage it receives. Pick the level of trust deliberately:

| Model | APIs | Use for |
|---|---|---|
| **Shooter decides, victim applies** | Shooter raycasts locally, then `MessageBus.emit('hit', { target, dmg, src })`. Each client owns its own HP and applies hits addressed to it | Casual PvP / co-op. Cheap, cheatable |
| **Shared target state** | Target `Health` on a `syncEntity`'d entity | Co-op PvE objects. CRDT is **last-write-wins**: two players damaging at once can lose a hit. Send hits as messages to one owner instead of writing HP from every client |
| **Server decides** | Client sends a *fire intent* via `room.send('fire', { origin, dir })`. The server checks rate, the origin against the server-read player position, and range, applies damage to a server-owned synced `Health` (with `validateBeforeChange` server-only), and broadcasts results | Competitive PvP, rewards, leaderboards. See **authoritative-server** |

- `MessageBus.emit` also delivers to the sender's own `on()` handler, with `sender === 'self'`. Skip those messages or the shooter applies damage twice. `MessageBus` is client-only and marked deprecated in source (**multiplayer-sync**).
- **Don't `syncEntity` a projectile's Transform every tick.** Broadcast one "fired" event (origin, velocity, owner) and let each client simulate its own copy. Only the owner (or the server) resolves damage.
- The headless server has no renderer, so do not expect `RaycastResult` there [UNVERIFIED]. Server validation is math: distance, cone, rate limits, simple shape tests.
- Remote-avatar ray hits carry no `entityId`. Identify the victim by the nearest `PlayerIdentityData` + `Transform` to `hit.position`, normalising coordinates as **player-avatar** describes (remote Transforms may be world-space). Code in hitscan.md.

## Gotchas

- Mutating `Transform` on `engine.PlayerEntity` does nothing, so knockback must use **player-physics**.
- Firing from the camera alone in third person is the classic wall-hack bug. Use two rays.
- The aim ray picks up the shooter's own capsule when its mask includes player bits.
- A target with no collider on the mask's layers is invisible to rays. A GLB's visible meshes default to mask `0`.
- `raycastSystem` defaults to 16 m range. Long-range shots silently miss if you forget `maxDistance`.
- Raycast callbacks arrive ticks later. Never assume `hits` is ready in the tick you fire.
- Don't put `Raycast` on more than a few dozen entities. Every live projectile costs one ray per tick.
- Use `timers.setTimeout` / `timers.setInterval` from `@dcl/sdk/ecs` (not the native globals) for despawn delays and respawn timers. Use a `dt` accumulator for anything per-frame (cooldowns, regeneration).

## Example scenes

- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/77,-1-raycast-unit-tests — component-based `Raycast` / `RaycastResult` for all four direction modes, including origins under transformed parents.
- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/5,5-collider-layers — raycast emitter cycling `CL_PLAYER` / `CL_MAIN_PLAYER` / `CL_PHYSICS` / `CL_CUSTOM1` masks against `MeshCollider` and `GltfContainer` targets.
- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/0,7-particle-system — one-shot burst preset used for impacts.

No engine-team shooter test scene exists yet. The patterns above are assembled from the verified pieces.

## References

- `{baseDir}/references/hitscan.md` — aim ray, two-ray third-person fire, nearest-hit filter, remote-player identification, tracer.
- `{baseDir}/references/projectiles.md` — `Projectile` component and system with look-ahead raycast, spawn helper, ballistic solver.
- `{baseDir}/references/health-damage.md` — `Health` / `Hitbox` components, `applyDamage`, i-frames, death and respawn, damage numbers, impact burst, recoil, weapon input loop.
