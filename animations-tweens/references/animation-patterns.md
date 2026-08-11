# Animation & Tween Patterns

## GLTF Animations (Animator)

### Basic Setup
```typescript
import { engine, Transform, GltfContainer, Animator } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

const character = engine.addEntity()
Transform.create(character, { position: Vector3.create(8, 0, 8) })
GltfContainer.create(character, { src: 'models/character.glb' })

Animator.create(character, {
  states: [
    { clip: 'idle', playing: true, loop: true, speed: 1 },
    { clip: 'walk', playing: false, loop: true, speed: 1 },
    { clip: 'attack', playing: false, loop: false, speed: 1.5 }
  ]
})

Animator.playSingleAnimation(character, 'walk')
Animator.stopAllAnimations(character)
```

### Switching Animations
```typescript
function playAnimation(entity: Entity, clipName: string) {
  const animator = Animator.getMutable(entity)
  for (const state of animator.states) {
    state.playing = false
  }
  const state = animator.states.find(s => s.clip === clipName)
  if (state) {
    state.playing = true
  }
}
```

### Animator Extras
```typescript
const clip = Animator.getClip(entity, 'Walk')

// shouldReset: restart from beginning when re-triggered
Animator.playSingleAnimation(entity, 'Attack', true)

// weight: blend between animations (0.0 to 1.0)
const anim = Animator.getMutable(entity)
anim.states[0].weight = 0.5
anim.states[1].weight = 0.5
```

---

## Tweens

### Move
```typescript
import { engine, Transform, Tween, EasingFunction } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

const box = engine.addEntity()
Transform.create(box, { position: Vector3.create(2, 1, 8) })

Tween.create(box, {
  mode: Tween.Mode.Move({
    start: Vector3.create(2, 1, 8),
    end: Vector3.create(14, 1, 8)
  }),
  duration: 2000,
  easingFunction: EasingFunction.EF_EASESINE
})
```

### Rotate
```typescript
Tween.create(box, {
  mode: Tween.Mode.Rotate({
    start: Quaternion.fromEulerDegrees(0, 0, 0),
    end: Quaternion.fromEulerDegrees(0, 360, 0)
  }),
  duration: 3000,
  easingFunction: EasingFunction.EF_LINEAR
})

// Continuous rotation: spin slowly around Y forever.
// 3rd arg is SPEED in DEGREES PER SECOND (here: 1 deg/sec, so a full turn takes 360s), not a duration.
// The quaternion supplies only the rotation AXIS (its angle magnitude is ignored); negative speed reverses.
Tween.setRotateContinuous(myEntity, Quaternion.fromEulerDegrees(0, 45, 0), 1)
```

### Scale
```typescript
Tween.create(box, {
  mode: Tween.Mode.Scale({
    start: Vector3.create(1, 1, 1),
    end: Vector3.create(2, 2, 2)
  }),
  duration: 1000,
  easingFunction: EasingFunction.EF_EASEOUTBOUNCE
})
```

### Multiple Transformations
```typescript
Tween.setMoveRotateScale(mrsEntity, {
  position: { start: Vector3.create(14, 1, 2), end: Vector3.create(14, 3, 2) },
  rotation: { start: Quaternion.fromEulerDegrees(0, 0, 0), end: Quaternion.fromEulerDegrees(0, 180, 90) },
  scale: { start: Vector3.One(), end: Vector3.create(2, 0.5, 2) },
  duration: 2000
})
```

---

## Tween Sequences

```typescript
import { TweenSequence, TweenLoop } from '@dcl/sdk/ecs'

Tween.create(box, {
  mode: Tween.Mode.Move({
    start: Vector3.create(2, 1, 8),
    end: Vector3.create(14, 1, 8)
  }),
  duration: 2000,
  easingFunction: EasingFunction.EF_EASESINE
})

TweenSequence.create(box, {
  sequence: [
    {
      mode: Tween.Mode.Move({
        start: Vector3.create(14, 1, 8),
        end: Vector3.create(2, 1, 8)
      }),
      duration: 2000,
      easingFunction: EasingFunction.EF_EASESINE
    }
  ],
  loop: TweenLoop.TL_RESTART
})
```

---

## Tween Helper Methods

```typescript
import { Tween, EasingFunction } from '@dcl/sdk/ecs'

Tween.setMove(entity,
  Vector3.create(0, 1, 0), Vector3.create(0, 3, 0),
  1500, EasingFunction.EF_EASEINBOUNCE
)

Tween.setRotate(entity,
  Quaternion.fromEulerDegrees(0, 0, 0), Quaternion.fromEulerDegrees(0, 180, 0),
  2000, EasingFunction.EF_EASEOUTQUAD
)

Tween.setScale(entity,
  Vector3.One(), Vector3.create(2, 2, 2),
  1000, EasingFunction.EF_LINEAR
)
```

---

## Continuous Tweens

3rd arg is **speed**, NOT a duration. For move it is units/sec along the direction vector; for rotate it is **degrees/sec** and the quaternion supplies only the rotation axis (angle magnitude ignored — see SKILL.md).
Optional final `duration` is a stop-after time in **milliseconds** (`0` / omitted = forever).

```typescript
// Move forward at 0.5 m/s, forever
Tween.setMoveContinuous(entity, Vector3.Forward(), 0.5)

// Move forward at 0.5 m/s, stop after 3 seconds
Tween.setMoveContinuous(entity, Vector3.Forward(), 0.5, 3000)

// Rotate around Y at 1 deg/sec (full turn = 360s), forever
Tween.setRotateContinuous(entity, Quaternion.fromEulerDegrees(0, 45, 0), 1)
```

---

## Follow a constantly changing target (chase / homing)

Use `setMoveContinuous`, **not** a `setMove` tween re-created every frame. The re-created-Move approach stutters: `Transform.get(entity).position` is what the renderer last wrote back over CRDT (~1-3 frames stale), and the renderer applies that `start` immediately, so the entity snaps backwards on every re-aim. A direction + speed has no scene-supplied start to disagree with the renderer, so replacing it mid-motion never snaps.

```typescript
const CHASE_SPEED = 3 // meters/second
const STOP_DISTANCE = 1 // stop this far short of the target

engine.addSystem(() => {
  if (!Transform.has(engine.PlayerEntity)) return
  const playerPos = Transform.get(engine.PlayerEntity).position
  const myPos = Transform.get(chaser).position

  if (Vector3.distance(myPos, playerPos) <= STOP_DISTANCE) {
    // A continuous tween has no destination — the stop check is what ends the chase
    if (Tween.has(chaser)) Tween.deleteFrom(chaser)
    return
  }

  const direction = Vector3.subtract(playerPos, myPos)
  direction.y = 0 // stay grounded even if the player jumps
  Tween.setMoveContinuous(chaser, Vector3.normalize(direction), CHASE_SPEED)
})
```

Notes: re-aim only when the direction has changed materially, or this sends a CRDT update every frame. Because the stop check has to round-trip to the renderer, the entity can drift slightly inside `STOP_DISTANCE` before halting. Discrete retargeting (clicks, waypoints) is still fine with `setMove` — see "Move from the current position". (verified in `79,-4-tween-following-cube`, which switches between both modes live)

---

## Texture Scrolling

```typescript
import { Vector2 } from '@dcl/sdk/math'
import { TextureMovementType, TextureWrapMode } from '@dcl/sdk/ecs'

// The material texture must use TWM_REPEAT for seamless tiling:
// Material.Texture.Common({ src, wrapMode: TextureWrapMode.TWM_REPEAT, tiling, offset })

// From UV (0,0) to (1,0) over 2 seconds. movementType defaults to TMT_OFFSET.
Tween.setTextureMove(entity, Vector2.create(0, 0), Vector2.create(1, 0), 2000)

// Animate the TILING instead of the offset (TMT_TILING).
Tween.setTextureMove(
  entity, Vector2.create(1, 1), Vector2.create(2, 2), 4000,
  TextureMovementType.TMT_TILING
)

// Continuous scroll: 3rd arg is SPEED in UV units/sec (not a duration).
// Scroll up the V axis at 0.5 UV/sec, forever.
Tween.setTextureMoveContinuous(entity, Vector2.create(0, 1), 0.5)
```

`TextureMovementType.TMT_OFFSET = 0` (default) | `TMT_TILING = 1`. Signatures (verified against SDK source):
`setTextureMove(entity, start, end, duration, movementType?, easingFunction?)` — movementType 5th, easing 6th.
`setTextureMoveContinuous(entity, direction, speed, movementType?, duration?)` — movementType 4th, stop-after duration 5th.

---

## Loop a base Tween with an empty sequence

An empty `TweenSequence` loops the entity's plain `Tween` — no steps needed. Idiomatic for a single move/rotate/scale/texture tween that should repeat forever.

```typescript
Tween.setMove(platform, Vector3.create(2, 1.5, 8), Vector3.create(2, 1.5, 10), 2000)
TweenSequence.create(platform, { sequence: [], loop: TweenLoop.TL_YOYO }) // bob back and forth

// One-directional repeat (e.g. scrolling texture): TL_RESTART
Tween.setTextureMove(plane, Vector2.create(1, 1), Vector2.create(2, 2), 4000, TextureMovementType.TMT_TILING)
TweenSequence.create(plane, { sequence: [], loop: TweenLoop.TL_RESTART })
```

---

## Retrigger / replace a running tween

Use `createOrReplace` when the entity may already have a tween (e.g. re-triggered mid-motion). `currentTime: 0` restarts from the beginning — i.e. from `start`, not from where the entity is now. To CONTINUE from the entity's live position instead, read the Transform for `start` — see the next section.

```typescript
Tween.createOrReplace(platform, {
  mode: Tween.Mode.Move({ start: posA, end: posB }),
  duration: 2000,
  easingFunction: EasingFunction.EF_LINEAR,
  currentTime: 0 // in case it was already moving
})
TweenSequence.createOrReplace(platform, {
  sequence: [
    { mode: Tween.Mode.Move({ start: posB, end: posA }), duration: 2000, easingFunction: EasingFunction.EF_LINEAR }
  ]
}) // omit `loop` for a one-shot there-and-back
```

---

## Move from the current position (retarget mid-travel)

The engine writes the tweened entity's interpolated Transform back to the scene every frame a tween is active, so `Transform.get(entity).position` is the live mid-flight position. Passing it as `start` moves the entity from wherever it currently is — and calling the helper again while a previous tween is still running smoothly redirects it mid-travel (the `set*` helpers use `createOrReplace`, which re-triggers even with identical values). No snap, no teleport. (verified in `79,-4-tween-following-cube`)

```typescript
import { engine, Transform, Tween, EasingFunction, pointerEventsSystem, InputAction } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

function moveTo(target: Vector3) {
  // start = the LIVE position — correct even while a previous tween is still mid-flight
  Tween.setMove(mover, Transform.get(mover).position, target, 2500, EasingFunction.EF_EASEOUTQUAD)
}

// Wire several clickable pads; clicking another pad mid-travel
// redirects the mover smoothly from wherever it currently is.
for (const { pad, target } of pads) {
  pointerEventsSystem.onPointerDown(
    { entity: pad, opts: { button: InputAction.IA_POINTER, hoverText: 'Move here' } },
    () => moveTo(target)
  )
}
```

**WARNING — omitting `start` is NOT "current position".** An unset `start` is treated as `(0,0,0)`: the entity teleports to the scene origin before moving. A hardcoded stale `start` likewise causes a visible teleport to that point before the motion begins. Always read `Transform.get(entity).position` when you mean "from here".

---

## Pause / toggle / remove a continuous tween

```typescript
const comp = Tween.getMutableOrNull(entity)
if (comp) { comp.playing = !comp.playing }   // toggle pause/resume
else { Tween.setMoveContinuous(entity, Vector3.create(0, 1, 0), 1, 5000) } // first click: create

if (Tween.has(entity)) Tween.deleteFrom(entity) // remove tween entirely (stops it)
```

---

## Pause / Reset a Tween

```typescript
const tween = Tween.getMutable(entity)
tween.playing = false   // pause
tween.currentTime = 0   // reset to beginning
tween.playing = true    // resume
```

---

## Yoyo Loop Mode

```typescript
TweenSequence.create(entity, {
  sequence: [{ duration: 1000, ... }],
  loop: TweenLoop.TL_YOYO
})
```

---

## Detecting Tween Completion

```typescript
engine.addSystem(() => {
  if (tweenSystem.tweenCompleted(entity)) {
    console.log('Tween finished on', entity)
  }
})
```

---

## Custom Animation System

```typescript
function spinSystem(dt: number) {
  for (const [entity] of engine.getEntitiesWith(Transform, Spinner)) {
    const transform = Transform.getMutable(entity)
    const spinner = Spinner.get(entity)
    const currentRotation = Quaternion.toEulerAngles(transform.rotation)
    transform.rotation = Quaternion.fromEulerDegrees(
      currentRotation.x,
      currentRotation.y + spinner.speed * dt,
      currentRotation.z
    )
  }
}

engine.addSystem(spinSystem)
```
