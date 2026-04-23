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

// Continuous rotation:
Tween.setRotateContinuous(myEntity, Quaternion.fromEulerDegrees(0, -1, 0), 700)
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

```typescript
// Move by (0, 0, 1) every 2 seconds, forever
Tween.setMoveContinuous(entity, Vector3.create(0, 0, 1), 2000)

// Rotate 90deg around Y every 2 seconds, forever
Tween.setRotateContinuous(entity, Quaternion.fromEulerDegrees(0, 90, 0), 2000)
```

---

## Texture Scrolling

```typescript
import { Vector2 } from '@dcl/sdk/math'

// From UV (0,0) to (1,0) over 2 seconds
Tween.setTextureMove(entity, Vector2.create(0, 0), Vector2.create(1, 0), 2000)

// Continuous scroll
Tween.setTextureMoveContinuous(entity, Vector2.create(0, 1), 2000)
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
