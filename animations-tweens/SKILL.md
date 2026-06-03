---
name: animations-tweens
description: Animate objects in Decentraland scenes. Play GLTF model animations with Animator (clip blending, weights, playSingleAnimation), create procedural motion with Tween (move/rotate/scale, continuous variants, texture UV scrolling), chain sequences with TweenSequence (loop, yoyo), and detect completion with tweenSystem.tweenCompleted. Use when the user wants to animate, move, rotate, spin, slide, bob, scroll a texture, or create motion effects. Do NOT use for audio/video playback (see audio-video), player emotes (see player-avatar), or physics-driven motion (see player-physics).
---

# Animations and Tweens in Decentraland

## When to Use Which Animation Approach

| Need                                   | Approach             | When                                                                          |
| -------------------------------------- | -------------------- | ----------------------------------------------------------------------------- |
| Play animation baked into a .glb model | `Animator`           | Character walks, door opens, flag waves — any animation from Blender/Maya     |
| Move/rotate/scale an entity smoothly   | `Tween`              | Sliding doors, floating platforms, growing objects — procedural A-to-B motion |
| Chain multiple animations in sequence  | `TweenSequence`      | Patrol paths, multi-step doors, complex choreography                          |
| Continuous per-frame control           | `engine.addSystem()` | Physics-like motion, following a target, custom easing                        |

**Decision flow:**

1. Does the .glb already have the animation? → `Animator`
2. Simple move/rotate/scale between two values? → `Tween`
3. Need frame-by-frame control or custom math? → System with `dt`

## GLTF Animations (Animator)

Play animations embedded in .glb models. Supports **skeletal animations**, **object animations**, and **shape key (morph target) animations**. Shape keys are useful for facial expressions, lip sync, or deformations.

Set up with `Animator.create(entity, { states: [{ clip: 'idle', playing: true, loop: true, speed: 1 }] })`. Play a single animation with `Animator.playSingleAnimation(entity, 'walk')`. Stop all with `Animator.stopAllAnimations(entity)`. Get a clip with `Animator.getClip(entity, 'Walk')`. Blend animations by setting `weight` (0.0-1.0) on multiple states.

### PITFALL: `playSingleAnimation` silently no-ops on clips not in `states` (programmatic Animator only)

**Scope:** this applies _only_ when you author the `Animator` entirely in code and call `Animator.playSingleAnimation(entity, clipName)` programmatically. In many practical workflows the clip list is already populated for you — see "When you don't need to register clips manually" below.

The narrow fact (verified — `@dcl/ecs/dist-cjs/components/extended/Animator.js` lines 35-46): `playSingleAnimation(entity, clipName)` returns `false` and does nothing when `clipName` is not present in the entity's `Animator.states` array. The internal `getClipAndAnimator` helper returns a null state, and `playSingleAnimation` exits with `if (!animator || !state) return false`. There is no console warning.

So **when you're building the Animator yourself in TypeScript and you intend to call `playSingleAnimation` with a clip name**, that clip must already be in `states[]`:

```ts
Animator.create(ghost, {
  states: [
    { clip: "Idle_001", playing: true, loop: true },
    { clip: "Idle_002", playing: false, loop: true },
    { clip: "Appear", playing: false, loop: false },
    { clip: "Death", playing: false, loop: false },
    { clip: "Hit", playing: false, loop: false },
  ],
});
```

If you want SDK6's "play any clip, no setup required" ergonomics, wrap `playSingleAnimation` and lazily add missing states:

```ts
function playAnim(entity: Entity, clip: string, loop = false) {
  const a = Animator.getMutableOrNull(entity);
  if (!a) return;
  if (!a.states.find((s) => s.clip === clip)) {
    a.states.push({
      clip,
      playing: false,
      loop,
      shouldReset: true,
      speed: 1,
      weight: 1,
    });
  }
  Animator.playSingleAnimation(entity, clip, true);
  // playSingleAnimation already pauses all other states
}
```

### When you don't need to register clips manually

Several common workflows populate the clip list for you — the rule above does **not** apply in these cases:

- **`GltfContainer` with no `Animator` attached.** The renderer autoplays one of the GLB's clips on its own (observed: the first/default clip baked into the file). Confirmed first-hand in a Halloween scene where small ghosts had no `Animator` and the renderer autoplayed `die` straight from the GLB. Use this when the model should just spawn already animating and you don't need to switch clips at runtime.
- **Creator Hub Inspector placement.** When you drop an asset into the Inspector, the composite is written with an `Animator` whose `states` array already includes _every_ clip from the GLB. Creators using the Inspector never see the registration step because the editor does it.
- **Asset packs / smart items.** These ship with `states` already populated by whoever authored the pack.

The "you have to pre-register" issue only bites the **author-in-code + `playSingleAnimation`** path. If a model is animating without any code-side `Animator.create` call, you're on the autoplay path described above — that's expected.

Related: if a `GltfContainer` model spawns playing the _wrong_ clip (e.g. a death pose on what should be an idling NPC), the entity has no `Animator` and the renderer picked a clip you didn't intend. Add an `Animator.create` with the desired default clip set to `playing: true` to take control.

### Resting an animated model at its FIRST frame (start-closed doors / graves / lids)

A common SDK6 → SDK7 port problem: a door/grave/coffin GLB whose "closed" pose is **frame 0** of its open/trigger clip. Under SDK7 the renderer auto-plays a clip on load and holds its final frame, so the model spawns **open** instead of closed.

**Verified fix (user-confirmed in-world):** keep a state actively `playing: true` but frozen with `speed: 0` and `loop: false`, so it holds frame 0 — the closed/rest pose — while still being a controlled, actively-playing state:

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

Then, to open, set the same clip to `speed: 1, playing: true` (a normal `playSingleAnimation` / `playClip` call); to close, play the reverse/close clip. This is the observed behavior + working fix; the precise internals of which clip the renderer auto-plays are not documented in the SDK — treat it as renderer behavior and verify per model.

### BEST PRACTICE: Short-circuit clip-switch helpers called from per-frame callers

**Scope:** this applies when you write your own clip-switch helper that mutates `Animator.states` directly (`s.playing`, `s.loop`, `s.shouldReset`) and that helper is invoked from a per-frame caller (an `engine.addSystem` update, an `inputSystem`/raycast callback that fires every tick, or any code path that runs each frame). The most common reason to write such a helper is porting an SDK6 scene that used lazy clip registration or `noLoop + revertToIdle` semantics ([[migrate-sdk6-to-sdk7]]).

**Why it matters.** A naive helper looks like this:

```ts
function playClip(entity: Entity, name: string, loop: boolean) {
  const a = Animator.getMutableOrNull(entity);
  if (!a) return;
  for (const s of a.states) {
    if (s.clip === name) {
      s.playing = true;
      s.loop = loop;
      s.shouldReset = true; // <-- rewritten every tick if helper is called per-frame
    } else {
      s.playing = false;
    }
  }
}
```

Called every frame, this calls `Animator.getMutableOrNull()` each tick, which marks the entity dirty in the CRDT layer. The ECS then serializes the component to bytes and compares against the last-sent snapshot (`lww-element-set-component-definition.ts`). Since the values are identical frame-to-frame, the CRDT suppression layer silently drops the update — the animation will NOT freeze. However, the per-frame serialization and byte comparison is unnecessary overhead that should be avoided.

**Note on `Animator.playSingleAnimation`.** Verified against `@dcl/ecs/src/components/extended/Animator.ts`: `playSingleAnimation` is NOT idempotent — it writes `playing=false, shouldReset=true` on every state in a loop, then `playing=true, shouldReset=<arg>` on the target. Calling it per-frame triggers the same unnecessary serialization overhead. Prefer to call `playSingleAnimation` from one-shot transitions (`onPointerDown`, state-machine edges) rather than from a system tick.

**Fix — track the last-applied clip and short-circuit:**

```ts
type Anim = { entity: Entity; lastClip?: string };

function playClip(a: Anim, name: string, loop: boolean) {
  if (a.lastClip === name) return; // already applied — skip redundant serialization
  const an = Animator.getMutableOrNull(a.entity);
  if (!an) return;
  for (const s of an.states) {
    if (s.clip === name) {
      s.playing = true;
      s.loop = loop;
      s.shouldReset = true;
    } else {
      s.playing = false;
    }
  }
  a.lastClip = name;
}
```

The short-circuit avoids calling `getMutableOrNull()` on unchanged frames, eliminating the per-frame serialization overhead. The CRDT delta is only sent on actual clip transitions.

**SDK6-port subtlety — `noLoop + revertToIdle`.** An SDK6-style helper that takes `(clipName, noLoop, durationSec)` and schedules a `timers.setTimeout` (from `@dcl/sdk/ecs` — never the native JS `setTimeout`) to revert to an idle clip must:

- On a same-clip re-call (e.g. the player holds the beam and "Hit" keeps being requested every frame), **only refresh the timer** (clear + reschedule) so the clip keeps replaying for as long as input is held. Do not re-mutate `Animator.states`.
- When the revert-to-idle timer fires, **clear `lastClip` before re-calling the helper with the idle clip** — otherwise the short-circuit prevents the idle from being applied if `lastClip` already equals the idle name from a prior tick.

**When to prefer `Animator.playSingleAnimation`.** It's the canonical write: pauses all other states in one pass and accepts a `resetCursor` argument (defaults to `true`). It's not idempotent — but it's the right call site when the trigger is a one-shot event. The custom-helper pattern only exists when porting SDK6 code that needs lazy clip registration (see the previous PITFALL) or `noLoop + revertToIdle` semantics.

## Tweens (Code-Based Animation)

Animate entity properties smoothly over time. Create with `Tween.create(entity, { mode: Tween.Mode.Move/Rotate/Scale({start, end}), duration, easingFunction })`. Duration is in **milliseconds**. An entity can only have one Tween component at a time.

**Helper methods** (create or replace Tween directly):

- `Tween.setMove(entity, start, end, duration, easing?)`
- `Tween.setRotate(entity, start, end, duration, easing?)`
- `Tween.setScale(entity, start, end, duration, easing?)`
- `Tween.setMoveRotateScale(entity, { position?, rotation?, scale?, duration })` — simultaneous

**Continuous tweens** (loop forever by relative delta):

- `Tween.setMoveContinuous(entity, delta, cycleDuration)`
- `Tween.setRotateContinuous(entity, deltaQuat, cycleDuration)`

**Texture scrolling** (UV animation for waterfalls, conveyor belts):

- `Tween.setTextureMove(entity, startUV, endUV, duration)`
- `Tween.setTextureMoveContinuous(entity, deltaUV, cycleDuration)`

**Control**: `Tween.getMutable(entity).playing = false` (pause), `.currentTime = 0` (reset).

## Tween Sequences (Chained Animations)

Chain with `TweenSequence.create(entity, { sequence: [...tweenConfigs], loop })`. Loop modes: `TweenLoop.TL_RESTART` (loop from start), `TweenLoop.TL_YOYO` (reverse at each end).

## Detecting Tween Completion

Use `tweenSystem.tweenCompleted(entity)` in an `engine.addSystem()` to check if a tween finished this frame.

## Easing Functions

Available from `EasingFunction`: `EF_LINEAR`, `EF_EASEINQUAD`/`EASEOUTQUAD`/`EASEQUAD`, `EF_EASEINSINE`/`EASEOUTSINE`/`EASESINE`, `EF_EASEINEXPO`/`EASEOUTEXPO`/`EASEEXPO`, `EF_EASEINELASTIC`/`EASEOUTELASTIC`/`EASEELASTIC`, `EF_EASEOUTBOUNCE`/`EASEINBOUNCE`/`EASEBOUNCE`, `EF_EASEINBACK`/`EASEOUTBACK`/`EASEBACK`, `EF_EASEINCUBIC`/`EASEOUTCUBIC`/`EASECUBIC`, `EF_EASEINQUART`/`EASEOUTQUART`/`EASEQUART`, `EF_EASEINQUINT`/`EASEOUTQUINT`/`EASEQUINT`, `EF_EASEINCIRC`/`EASEOUTCIRC`/`EASECIRC`.

## Custom Animation Systems

For complex animations, create a system with `engine.addSystem((dt) => { ... })` and modify `Transform.getMutable(entity)` each frame. Use a custom component (e.g. `Spinner`) to mark which entities need animating.

## Troubleshooting

| Problem                                             | Cause                                                                                                                                                                    | Solution                                                                                                                                                                                                           |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GLTF animation not playing                          | Wrong clip name                                                                                                                                                          | Check exact clip names (case-sensitive) in a viewer                                                                                                                                                                |
| `playSingleAnimation` does nothing, returns `false` | Clip name not in `Animator.states` for an Animator you built in code                                                                                                     | Add the clip to `states[]` at `Animator.create` time, or use the lazy-add wrapper above. Only applies when you authored the Animator programmatically — Inspector / asset-pack Animators are already pre-populated |
| Model autoplays an unexpected animation on spawn    | No `Animator` component — `GltfContainer` autoplays one clip from the .glb (the same mechanism that lets clip-less Inspector scenes animate without manual registration) | Add `Animator.create` with the intended default clip set to `playing: true` to take control                                                                                                                        |
| Door/grave/lid spawns OPEN instead of closed        | The renderer auto-plays the clip and holds its final (open) frame; the model's closed pose is frame 0 of that clip                                                       | Hold frame 0 with a `playing: true, speed: 0, loop: false` state — see "Resting an animated model at its FIRST frame" above                                                                                          |
| Unnecessary per-frame serialization overhead        | Clip-switch helper calls `getMutableOrNull` every tick with identical values (custom helper or `playSingleAnimation` called from a system / per-frame input callback)     | Track the last-applied clip and short-circuit when unchanged, or only call the helper on state transitions — see "Short-circuit clip-switch helpers" best practice above                                           |
| Animator has no effect                              | Missing `GltfContainer`                                                                                                                                                  | `Animator` only works on entities with a loaded GLTF model                                                                                                                                                         |
| Tween doesn't move                                  | Same start and end                                                                                                                                                       | Verify values differ in `Tween.Mode.Move()`                                                                                                                                                                        |
| Tween plays once then stops                         | No loop                                                                                                                                                                  | Add `TweenSequence` with `loop: TweenLoop.TL_YOYO`                                                                                                                                                                 |
| Animation jitters                                   | Creating Tween every frame                                                                                                                                               | Only create Tween once, not inside a system                                                                                                                                                                        |

## Best Practices

- Use Tweens for simple A-to-B animations (doors, platforms, UI elements)
- Use Animator for character/model animations baked into GLTF files
- Use Systems for continuous user control or physics-based animations
- Tween durations are in **milliseconds** (1000 = 1 second)
- For looping: use `TweenSequence` with `loop: TweenLoop.TL_RESTART`

For full code examples (Animator setup, all tween types, sequences, helpers, texture scrolling), see `{baseDir}/references/animation-patterns.md`.
