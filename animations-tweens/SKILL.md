---
name: animations-tweens
description: Animate objects in Decentraland scenes. Play GLTF model animations with Animator (clip blending, weights, playSingleAnimation), create procedural motion with Tween (move/rotate/scale, continuous variants, texture UV scrolling), chain sequences with TweenSequence (loop, yoyo), and detect completion with tweenSystem.tweenCompleted. Use when the user wants to animate, move, rotate, spin, slide, bob, scroll a texture, or create motion effects. Do NOT use for audio/video playback (see audio-video), player emotes (see player-avatar), or physics-driven motion (see player-physics).
---

# Animations and Tweens in Decentraland

## When to Use Which Animation Approach

| Need | Approach | When |
|------|----------|------|
| Play animation baked into a .glb model | `Animator` | Character walks, door opens, flag waves — any animation from Blender/Maya |
| Move/rotate/scale an entity smoothly | `Tween` | Sliding doors, floating platforms, growing objects — procedural A-to-B motion |
| Chain multiple animations in sequence | `TweenSequence` | Patrol paths, multi-step doors, complex choreography |
| Continuous per-frame control | `engine.addSystem()` | Physics-like motion, following a target, custom easing |

**Decision flow:**
1. Does the .glb already have the animation? → `Animator`
2. Simple move/rotate/scale between two values? → `Tween`
3. Need frame-by-frame control or custom math? → System with `dt`

## GLTF Animations (Animator)

Play animations embedded in .glb models. Supports **skeletal animations**, **object animations**, and **shape key (morph target) animations**. Shape keys are useful for facial expressions, lip sync, or deformations.

Set up with `Animator.create(entity, { states: [{ clip: 'idle', playing: true, loop: true, speed: 1 }] })`. Play a single animation with `Animator.playSingleAnimation(entity, 'walk')`. Stop all with `Animator.stopAllAnimations(entity)`. Get a clip with `Animator.getClip(entity, 'Walk')`. Blend animations by setting `weight` (0.0-1.0) on multiple states.

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

| Problem | Cause | Solution |
|---------|-------|----------|
| GLTF animation not playing | Wrong clip name | Check exact clip names (case-sensitive) in a viewer |
| Animator has no effect | Missing `GltfContainer` | `Animator` only works on entities with a loaded GLTF model |
| Tween doesn't move | Same start and end | Verify values differ in `Tween.Mode.Move()` |
| Tween plays once then stops | No loop | Add `TweenSequence` with `loop: TweenLoop.TL_YOYO` |
| Animation jitters | Creating Tween every frame | Only create Tween once, not inside a system |

## Best Practices

- Use Tweens for simple A-to-B animations (doors, platforms, UI elements)
- Use Animator for character/model animations baked into GLTF files
- Use Systems for continuous user control or physics-based animations
- Tween durations are in **milliseconds** (1000 = 1 second)
- For looping: use `TweenSequence` with `loop: TweenLoop.TL_RESTART`

For full code examples (Animator setup, all tween types, sequences, helpers, texture scrolling), see `{baseDir}/references/animation-patterns.md`.
