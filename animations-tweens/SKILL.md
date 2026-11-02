---
name: animations-tweens
description: "Animate entities in Decentraland: play GLB clips with Animator, tween position/rotation/scale, chain TweenSequences, scroll textures. Use for moving platforms, doors, spinning or bobbing props, animated models, texture scrolling. Not for player emotes (player-avatar / avatar-animations), audio/video (audio-video) or physics (player-physics)."
---

# Animations and Tweens in Decentraland

## When to Use Which Animation Approach

| Need                                   | Approach             | When                                                                          |
| -------------------------------------- | -------------------- | ----------------------------------------------------------------------------- |
| Play animation baked into a .glb model | `Animator`           | Character walks, door opens, flag waves — any animation from Blender/Maya     |
| Move/rotate/scale an entity smoothly   | `Tween`              | Sliding doors, floating platforms, growing objects — procedural A-to-B motion |
| Chain multiple animations in sequence  | `TweenSequence`      | Patrol paths, multi-step doors, complex choreography                          |
| Continuous per-frame control           | `engine.addSystem()` | Physics-like motion, following a target, custom easing, input-driven user control |

**Decision flow:**

1. Does the .glb already have the animation? → `Animator`
2. Simple move/rotate/scale between two values? → `Tween`
3. Need frame-by-frame control or custom math? → System with `dt`

## GLTF Animations (Animator)

Play animations embedded in .glb models. Supports **skeletal animations**, **object animations**, and **shape key (morph target) animations**. Shape keys are useful for facial expressions, lip sync, or deformations.

Set up with `Animator.create(entity, { states: [{ clip: 'idle', playing: true, loop: true, speed: 1 }] })`. Play a single animation with `Animator.playSingleAnimation(entity, 'walk')`. Stop all with `Animator.stopAllAnimations(entity)`. Get a clip with `Animator.getClip(entity, 'Walk')`. Blend animations by setting `weight` (0.0-1.0) on multiple states.

### Which clip plays: Animator vs autoplay

- **No `Animator` on a `GltfContainer` with clips:** the renderer autoplays a clip of its own choosing — typically the file's first clip (so it depends on export order: a ghost whose first clip was `die` played `die` forever), and not stable across models. Fine when the model should just spawn animating and never stop or switch. To choose the clip, start still, or switch at runtime, add an `Animator` with the intended clip `playing: true`.
- **`playSingleAnimation(entity, clip)` returns `false` and does nothing, with no warning, when `clip` is not in `Animator.states`.** Register every clip you will play in `states[]` when you build the Animator in code. Animators written by the Creator Hub Inspector and by asset packs / smart items already list every clip.
- **Call `playSingleAnimation` (or any clip-switch helper) on transitions, not every frame:** each call rewrites every state and re-serializes the Animator. Read state per frame with `Animator.get()` only.

Lazy-registering wrapper, for code that plays clips by name without setting `states[]` up front:

```ts
function playAnim(entity: Entity, clip: string, loop = false) {
  const a = Animator.getMutableOrNull(entity);
  if (!a) return;
  if (!a.states.find((s) => s.clip === clip)) {
    a.states.push({ clip, playing: false, loop, shouldReset: true, speed: 1, weight: 1 });
  }
  Animator.playSingleAnimation(entity, clip, true); // pauses all other states
}
```

SDK6 port helpers (short-circuiting per-frame clip switches, `noLoop + revertToIdle`): `{baseDir}/references/animation-patterns.md` → Clip-switch helper for SDK6 ports.

### Resting an animated model at its FIRST frame (start-closed doors / graves / lids)

A door/grave/coffin GLB whose "closed" pose is **frame 0** of its open clip can spawn **open**: the renderer auto-plays the clip on load and holds its final frame. Keep a state `playing: true` but frozen with `speed: 0` and `loop: false`, so it holds frame 0 under your control:

```typescript
// Hold `clip` at its first frame (closed pose), under your control.
export function holdFirstFrame(entity: Entity, clip: string) {
  if (!Animator.has(entity)) Animator.create(entity, { states: [] })
  const a = Animator.getMutable(entity)
  if (!a.states.some((s) => s.clip === clip)) a.states = [...a.states, { clip }]
  Animator.stopAllAnimations(entity)
  const state = Animator.getClipOrNull(entity, clip)
  if (state) { state.playing = true; state.loop = false; state.speed = 0 }
}
```

To open, set the same clip to `speed: 1, playing: true` (a normal `playSingleAnimation` call); to close, play the reverse/close clip. Which clip the renderer auto-plays is renderer behaviour; verify per model.

## Detecting Animation Completion

When a non-looping clip finishes, the engine flips that state's `playing` back to `false` — no `setTimeout(clipLength)` guessing needed. Poll with the READ-ONLY `Animator.get()` and edge-detect the `true → false` transition:

```typescript
let wasPlaying = false
engine.addSystem(() => {
	const state = Animator.get(entity).states.find((s) => s.clip === 'Bite')
	const isPlaying = state?.playing ?? false
	if (wasPlaying && !isPlaying) {
		console.log('Bite finished')
		Animator.playSingleAnimation(entity, 'Walk') // chain the next clip
	}
	wasPlaying = isPlaying
})
```

- **Poll with `Animator.get()` only.** `Animator.getClip()` and `getMutable()` return a mutable ref and mark the component dirty every frame.
- The engine only flips the flag when the clip ends by itself. Looping clips never flip it, `speed: 0` states never finish, and a scene-side `stopAllAnimations()` is your own write (track it yourself if you need to tell them apart).
- Treat the flag as a *notification*, not a guarantee: never hard-block gameplay on it. Where a missed signal would wedge the scene, keep a `timers.setTimeout` fallback sized from the clip length.

## Tweens (Code-Based Animation)

Animate entity properties smoothly over time. Create with `Tween.create(entity, { mode: Tween.Mode.Move/Rotate/Scale({start, end}), duration, easingFunction })`. Duration is in **milliseconds** (1000 = 1 second). An entity can only have one Tween component at a time.

**Helper methods** (create or replace Tween directly):

- `Tween.setMove(entity, start, end, duration, easing?)`
- `Tween.setRotate(entity, start, end, duration, easing?)`
- `Tween.setScale(entity, start, end, duration, easing?)`
- `Tween.setMoveRotateScale(entity, { position?, rotation?, scale?, duration })` — simultaneous

**Continuous tweens** (move/rotate at a constant speed). Third arg is **speed** (units per second, applied along the direction vector), NOT a duration. Optional final arg `duration` is a stop-after time in **milliseconds** — `0` or omitted = runs forever:

- `Tween.setMoveContinuous(entity, direction: Vector3, speed: number, duration?: number)` — speed in meters/sec
- `Tween.setRotateContinuous(entity, direction: Quaternion, speed: number, duration?: number)` — `speed` is **degrees per second** (a full 360° revolution takes `360/speed` seconds). The `direction` quaternion contributes only its rotation **axis** (its imaginary `x,y,z` part, sign preserved); its rotation **angle/magnitude is ignored** — `Quaternion.fromEulerDegrees(0, 45, 0)` and `(0, 90, 0)` both spin around +Y, only `speed` sets the rate. Negative `speed` reverses direction.
- `Tween.setTextureMoveContinuous(entity, direction: Vector2, speed: number, movementType?: TextureMovementType, duration?: number)` — speed in UV units/sec

**Texture scrolling** (UV animation for waterfalls, conveyor belts):

- `Tween.setTextureMove(entity, start: Vector2, end: Vector2, duration, movementType?: TextureMovementType, easing?)` — `movementType` is the 5th param, easing 6th

**Control**: `Tween.getMutable(entity).playing = false` (pause), `.currentTime = 0` (reset). Toggle a running continuous tween by reading `Tween.getMutableOrNull(entity)` and flipping `.playing` (verified in `78,-4-tweens`). Remove a tween entirely with `Tween.deleteFrom(entity)`; `Tween.has(entity)` checks presence.

**Retrigger / replace at runtime**: use `Tween.createOrReplace(entity, {...})` (and `TweenSequence.createOrReplace`) instead of `create` when the entity may already have a tween — e.g. a platform re-triggered while still moving. Pass `currentTime: 0` in the config to restart from the beginning in case it was mid-flight (verified in `77,-5-tweens-moving-platforms`).

**Move from the CURRENT position / retarget mid-travel**: pass `Transform.get(entity).position` as `start` — the engine writes the tweened entity's interpolated Transform back to the scene every frame a tween is active, so that read is the live mid-flight position. `Tween.setMove(entity, Transform.get(entity).position, target, duration, easing)` therefore moves from wherever the entity currently is, and calling it again while a previous tween is still running smoothly redirects the entity mid-travel — no snap, no teleport (the `set*` helpers use `createOrReplace`, which re-triggers even with identical values) (verified in `79,-4-tween-following-cube`).

**PITFALL — omitting `start` on Move does NOT mean "current position"**: an unset `start` is treated as `(0,0,0)` — the entity teleports to the scene origin before moving. A hardcoded stale `start` likewise causes a visible teleport to that point before the motion begins. Always supply `start`, and read `Transform.get(entity).position` when you mean "from wherever it is now" (verified in `79,-4-tween-following-cube`).

**PITFALL — a CONSTANTLY changing target needs `setMoveContinuous`, not repeated `setMove`**: re-creating a Move tween every frame to chase a moving target (following the player, homing at a runaway entity) makes the entity visibly **stutter**. `Transform.get(entity).position` is what the renderer last wrote back over CRDT, so it trails the entity's real position by ~1-3 frames; the renderer applies the new `start` the instant it arrives, snapping the entity backwards on every re-aim. One correction is invisible, ~30/second is jitter — and raising the re-aim threshold only makes the stutter coarser, since the replacement *frequency* is the problem. Use `Tween.setMoveContinuous(entity, direction, speed)` instead: continuous modes take their start from the renderer's own live transform, so replacing them mid-motion cannot snap. Caveats: it has no destination (stop it yourself with `Tween.deleteFrom` on a distance check, or pass the optional stop-after `duration`), and you should only re-aim when the direction has changed materially, or you send a CRDT update per frame. Discrete retargeting (clicks, waypoints) is still fine with `setMove` (verified in `79,-4-tween-following-cube`, which switches between both modes live).

`Tween.Mode.MoveRotateScale({...})` and `setMoveRotateScale` accept a **partial** transform — supply only the axes you want (`position` / `rotation` / `scale`); at least one is required. Omitted axes are left unchanged (verified against SDK source + `78,-4-tweens`). On mobile it needs app 1.15.0+; older mobile apps do not animate it.

**Texture movement type** (`setTextureMove` / `setTextureMoveContinuous`, and `Tween.Mode.TextureMove`): the `movementType` param is `TextureMovementType.TMT_OFFSET` (default, `=0` — scrolls the UV offset) or `TextureMovementType.TMT_TILING` (`=1` — animates the tiling). Import `TextureMovementType` from `@dcl/sdk/ecs`. The texture must use `wrapMode: TextureWrapMode.TWM_REPEAT` for continuous scrolling to tile seamlessly (verified in `0,3-texture-movement`, `78,-4-tweens`).

## Tween Sequences (Chained Animations)

Chain with `TweenSequence.create(entity, { sequence: [...tweenConfigs], loop })`. Loop modes: `TweenLoop.TL_RESTART` (`=0`, loop from start), `TweenLoop.TL_YOYO` (`=1`, reverse at each end).

> ⚠️ **`TweenSequence` is NOT implemented on the mobile client — sequenced tweens do not animate.** Not a timing or easing difference: nothing moves. Plain `Tween` works on mobile (including `MoveRotateScale` from app 1.15.0); it is the sequence wrapper that is absent. This kills the two most common uses on a phone: **looping platforms** and **patrol paths**. If the scene targets mobile:
> - **Do not build traversal geometry on a `TweenSequence`.** A moving platform that is the only way across a gap becomes an impassable scene on mobile.
> - Drive repeat and multi-leg motion from a system instead: run one plain `Tween` at a time and start the next leg on `tweenSystem.tweenCompleted(entity)`. That is mobile-safe and costs a few lines.
> - Decorative sequences (a drifting cloud, an idle bob) degrade to a static prop — acceptable, but check the scene still reads with them frozen.
>
> This includes the empty-`sequence` looping idiom below: it is a `TweenSequence` too. Other mobile gaps: `{baseDir}/../sdk-scenes/references/mobile-parity.md`.

### PATTERN: empty sequence loops the base Tween

`TweenSequence.create(entity, { sequence: [], loop: TweenLoop.TL_YOYO })` on an entity that already has a plain `Tween` makes **that base tween itself** loop/yoyo — no sequence steps needed. This is the idiomatic way to make a single `setMove`/`setRotate`/`setScale`/`setTextureMove` repeat forever (verified in `77,-5-tweens-moving-platforms`, `0,3-texture-movement`). Use `TL_YOYO` for back-and-forth (platform bobbing), `TL_RESTART` for a hard reset each cycle (scrolling texture, one-directional spin).

For a multi-waypoint path, the base `Tween` is the first leg and `sequence[]` holds the remaining legs; each step's `start`/`end` must chain from the previous leg's end (verified in `77,-5-tweens-moving-platforms` platform4).

## Detecting Tween Completion

Use `tweenSystem.tweenCompleted(entity)` in an `engine.addSystem()` to check if a tween finished this frame.

## Easing Functions

Available from `EasingFunction`: `EF_LINEAR`, `EF_EASEINQUAD`/`EASEOUTQUAD`/`EASEQUAD`, `EF_EASEINSINE`/`EASEOUTSINE`/`EASESINE`, `EF_EASEINEXPO`/`EASEOUTEXPO`/`EASEEXPO`, `EF_EASEINELASTIC`/`EASEOUTELASTIC`/`EASEELASTIC`, `EF_EASEOUTBOUNCE`/`EASEINBOUNCE`/`EASEBOUNCE`, `EF_EASEINBACK`/`EASEOUTBACK`/`EASEBACK`, `EF_EASEINCUBIC`/`EASEOUTCUBIC`/`EASECUBIC`, `EF_EASEINQUART`/`EASEOUTQUART`/`EASEQUART`, `EF_EASEINQUINT`/`EASEOUTQUINT`/`EASEQUINT`, `EF_EASEINCIRC`/`EASEOUTCIRC`/`EASECIRC`.

## Custom Animation Systems

For complex animations, create a system with `engine.addSystem((dt) => { ... })` and modify `Transform.getMutable(entity)` each frame. Use a custom component (e.g. `Spinner`) to mark which entities need animating.

### Following / easing toward a moving goal: tween first, `dt`-based smoothing second

- **Default: continuous tweens.** For an entity that keeps chasing a goal that moves (pet, homing pickup, follower, drifting marker), use `Tween.setMoveContinuous` / `setRotateContinuous`, re-aimed only when the direction changes materially. The renderer interpolates at display frame rate from its own live transform, so motion is frame-rate independent with no per-frame CRDT writes. Full chase loop: `{baseDir}/references/animation-patterns.md` → *Follow a constantly changing target*.
- Continuous modes move at **constant speed** and have no destination. Stop them yourself (`Tween.deleteFrom` on a distance check, or the stop-after `duration`).
- **Use a system instead** when the motion must *decelerate into* the goal (a follow that slows as it arrives) or when the eased value is not a transform (volume, a UI number, a material color). A system writes a CRDT update every frame for each moving entity, so keep it to a few entities.
- **In a system, never use a fixed lerp factor per frame** (`x += (goal - x) * 0.1`). It converges faster at 60 fps than at 30 fps, so the feel changes with the player's frame rate. Make the factor depend on `dt` (seconds):

```typescript
const RATE = 8 // per second; ~5 = floaty, ~12 = snappy
engine.addSystem((dt) => {
  const pos = Transform.get(follower).position
  const goal = Transform.get(engine.PlayerEntity).position
  if (Vector3.distanceSquared(pos, goal) < 0.0001) return // settled: stop writing
  const t = 1 - Math.exp(-RATE * dt)                      // same feel at any frame rate
  Transform.getMutable(follower).position = Vector3.lerp(pos, goal, t)
})
```

For rotations use `Quaternion.slerp(current, target, t)` with the same `t`; for plain numbers, `Scalar.lerp` (all from `@dcl/sdk/math`).

## Troubleshooting

| Problem                                             | Cause                                                                                                                                                                    | Solution                                                                                                                                                                                                           |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GLTF animation not playing                          | Wrong clip name                                                                                                                                                          | Check exact clip names (case-sensitive) in a viewer                                                                                                                                                                |
| `playSingleAnimation` does nothing, returns `false` | Clip name not in `Animator.states` for an Animator you built in code                                                                                                     | Add the clip to `states[]` at `Animator.create` time, or use the `playAnim` wrapper above |
| Model autoplays an unexpected animation on spawn    | No `Animator` component — the renderer autoplays a clip of its own choosing | Add `Animator.create` with the intended default clip set to `playing: true` to take control                                                                                                                        |
| Door/grave/lid spawns OPEN instead of closed        | The renderer auto-plays the clip and holds its final (open) frame; the model's closed pose is frame 0 of that clip                                                       | Hold frame 0 with a `playing: true, speed: 0, loop: false` state — see "Resting an animated model at its FIRST frame" above                                                                                          |
| Unnecessary per-frame serialization overhead        | Clip-switch helper calls `getMutableOrNull` every tick with identical values (custom helper or `playSingleAnimation` called from a system / per-frame input callback)     | Call the helper only on state transitions, or short-circuit when the clip is unchanged — see `references/animation-patterns.md` → Clip-switch helper for SDK6 ports |
| Animator has no effect                              | Missing `GltfContainer`                                                                                                                                                  | `Animator` only works on entities with a loaded GLTF model                                                                                                                                                         |
| Need to know when a non-looping clip ends           | Guessing with `timers.setTimeout(clipLength)`                                                                                                                            | Edge-detect `playing` flipping to `false` via read-only `Animator.get()` — see "Detecting Animation Completion" above                                                                                              |
| Tween doesn't move                                  | Same start and end                                                                                                                                                       | Verify values differ in `Tween.Mode.Move()`                                                                                                                                                                        |
| Entity teleports when a Move tween starts           | `start` doesn't match the entity's current position — omitted `start` = `(0,0,0)` (scene origin), hardcoded/stale `start` = wherever you wrote                            | Pass `Transform.get(entity).position` as `start` — it's the live position even while a previous tween is mid-flight                                                                                                |
| Tween plays once then stops                         | No loop                                                                                                                                                                  | Desktop-only scene: empty-sequence `TweenSequence` with `loop: TweenLoop.TL_YOYO`. Mobile: restart the plain `Tween` on `tweenSystem.tweenCompleted(entity)` (see *Tween Sequences*) |
| Animation jitters                                   | Creating Tween every frame                                                                                                                                               | Only create Tween once, not inside a system                                                                                                                                                                        |
| Intro animation/tween is over by the time the player sees the scene | It was started at scene startup and played out behind the Explorer's loading screen | Gate it on `EngineInfo.sceneHidden` flipping to `false` (the loading-screen fade-out) — see the **scene-runtime** skill |

For full code examples (Animator setup, all tween types, sequences, helpers, texture scrolling), see `{baseDir}/references/animation-patterns.md`.

## Example scenes

Engine-team test scenes (ground-truth API usage):

- `https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/73,-8-animator-tests-shark` — `Animator` with two states + `weight`; clicking cycles `playSingleAnimation('swim')` / `('bite')` and demonstrates concurrent blend by also setting `getClip('bite').playing = true`.
- `https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/73,-9-animation-finish` — animation-completion detection: non-looping `bite` finish flips `playing` to `false` (observed via read-only `Animator.get()`), chains into `swim`; proves looping clips never report finish.
- `https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/78,-4-tweens` — every finite mode (`setMove`/`setRotate`/`setScale`/`setTextureMove`/`setMoveRotateScale`), continuous modes, `createOrReplace`, `deleteFrom`, pause-toggle via `getMutableOrNull().playing`, and mixed-mode `TweenSequence`.
- `https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/77,-5-tweens-moving-platforms` — `Tween.setMove` + empty-sequence `TL_YOYO` for bobbing platforms, multi-waypoint path via `sequence[]`, and `createOrReplace` retrigger from a `TriggerArea`.
- `https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/79,-4-tween-following-cube` — a cube that chases the player, with a pad that switches live between `setMoveContinuous` (smooth, the default) and re-creating a `setMove` tween from `Transform.get(entity).position` on every re-aim (visibly jittery). Both modes share the same re-aim trigger and speed, so the difference is attributable to the tween mode alone. Also shows `Billboard` with `BM_Y` on floating labels.
- `https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/0,3-texture-movement` — `setTextureMove` with `TMT_OFFSET` vs `TMT_TILING`, empty-sequence loop/yoyo, `TWM_REPEAT` tiling.
- `https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/10,0-move-to-test` — custom per-frame spin system (`Quaternion.multiply` + `fromAngleAxis(dt*speed, Up())`) marking entities with a `Spinner` component. (The `movePlayerTo` portion belongs to restricted-actions, not tweens.)
