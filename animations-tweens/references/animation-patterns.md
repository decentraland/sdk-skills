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
// 3rd arg is SPEED (rotation/sec applied along the direction quaternion), not a duration.
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

3rd arg is **speed** (units per second along the direction vector), NOT a duration.
Optional final `duration` is a stop-after time in **milliseconds** (`0` / omitted = forever).

```typescript
// Move forward at 0.5 m/s, forever
Tween.setMoveContinuous(entity, Vector3.Forward(), 0.5)

// Move forward at 0.5 m/s, stop after 3 seconds
Tween.setMoveContinuous(entity, Vector3.Forward(), 0.5, 3000)

// Rotate slowly around Y, forever
Tween.setRotateContinuous(entity, Quaternion.fromEulerDegrees(0, 45, 0), 1)
```

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

Use `createOrReplace` when the entity may already have a tween (e.g. re-triggered mid-motion). `currentTime: 0` restarts from the beginning.

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
