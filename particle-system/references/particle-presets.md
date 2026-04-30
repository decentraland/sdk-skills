# ParticleSystem Presets

17 production-ready presets ported verbatim from the official SDK7 test scene
(`https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/0%2C7-particle-system`).
Each is a complete `ParticleSystem.create(...)` payload — drop in next to a `Transform` and it works.

## Imports (every preset assumes these)

```typescript
import { engine, Transform, ParticleSystem } from '@dcl/sdk/ecs'
import {
  PBParticleSystem_BlendMode,
  PBParticleSystem_PlaybackState,
  PBParticleSystem_SimulationSpace
} from '@dcl/sdk/ecs'
import { Color4, Vector3, Quaternion } from '@dcl/sdk/math'
```

---

## 1. Fire Ember — Point + ADD, warm orange/red, slight upward drift

```typescript
const entity = engine.addEntity()
Transform.create(entity, { position: Vector3.create(6, 1, 6) })

ParticleSystem.create(entity, {
  active: true,
  rate: 40,
  lifetime: 2,
  maxParticles: 200,
  initialSize: { start: 0.1, end: 0.3 },
  sizeOverTime: { start: 1.0, end: 0.0 },
  initialColor: { start: Color4.create(1, 0.6, 0.1, 1), end: Color4.create(1, 0.2, 0, 1) },
  colorOverTime: { start: Color4.create(1, 0.5, 0.1, 1), end: Color4.create(0.2, 0, 0, 0) },
  initialVelocitySpeed: { start: 1.5, end: 2.5 },
  gravity: -0.3,
  blendMode: PBParticleSystem_BlendMode.PSB_ADD,
  billboard: true,
  shape: ParticleSystem.Shape.Point(),
  playbackState: PBParticleSystem_PlaybackState.PS_PLAYING
})
```

## 2. Magic Aura — Sphere r=0.8, ALPHA, blue-to-white, slow rotation

```typescript
ParticleSystem.create(entity, {
  active: true,
  rate: 20,
  lifetime: 3,
  maxParticles: 150,
  initialSize: { start: 0.2, end: 0.5 },
  sizeOverTime: { start: 0.5, end: 1.2 },
  initialColor: { start: Color4.create(0.2, 0.5, 1, 1), end: Color4.create(0.5, 0.8, 1, 1) },
  colorOverTime: { start: Color4.create(0.4, 0.6, 1, 1), end: Color4.create(1, 1, 1, 0) },
  initialVelocitySpeed: { start: 0.5, end: 1.0 },
  rotationOverTime: { x: 0, y: 0, z: 0.7071, w: 0.7071 }, // ≈ 90°/s spin around Z
  blendMode: PBParticleSystem_BlendMode.PSB_ALPHA,
  shape: ParticleSystem.Shape.Sphere({ radius: 0.8 }),
  playbackState: PBParticleSystem_PlaybackState.PS_PLAYING
})
```

## 3. Snowfall — Cone aimed downward, gravity 1.5

The parent Transform's rotation aims the cone — without rotation a cone sprays *up*. Here the entity is rotated to point down.

```typescript
const entity = engine.addEntity()
Transform.create(entity, {
  position: Vector3.create(26, 5, 6),
  rotation: Quaternion.fromEulerDegrees(50, -90, 0)
})

ParticleSystem.create(entity, {
  active: true,
  rate: 30,
  lifetime: 4,
  maxParticles: 300,
  initialSize: { start: 0.06, end: 0.14 },
  sizeOverTime: { start: 1.0, end: 0.8 },
  initialColor: { start: Color4.create(0.9, 0.95, 1, 0.9), end: Color4.create(0.9, 0.95, 1, 0.9) },
  colorOverTime: { start: Color4.create(1, 1, 1, 0.8), end: Color4.create(1, 1, 1, 0) },
  initialVelocitySpeed: { start: 2, end: 3 },
  gravity: 1.5,
  blendMode: PBParticleSystem_BlendMode.PSB_ALPHA,
  shape: ParticleSystem.Shape.Cone({ angle: 15, radius: 2 }),
  playbackState: PBParticleSystem_PlaybackState.PS_PLAYING
})
```

## 4. Vortex Spiral — Cone, ADD, billboard OFF, tilted with rotation over time

```typescript
const initRot = { x: 0.3827, y: 0, z: 0, w: 0.9239 }       // ≈ Quaternion.fromEulerDegrees(45, 0, 0)
const rotOverTime = { x: 0.0381, y: 0.6964, z: 0.2126, w: 0.6848 }  // ≈ Quaternion.fromEulerDegrees(0, 90, 30)

ParticleSystem.create(entity, {
  active: true,
  rate: 35,
  lifetime: 3,
  maxParticles: 200,
  initialSize: { start: 0.15, end: 0.3 },
  sizeOverTime: { start: 1.0, end: 0.2 },
  initialColor: { start: Color4.create(0.3, 0.8, 1, 1), end: Color4.create(0.6, 0.2, 1, 1) },
  colorOverTime: { start: Color4.create(0.5, 0.6, 1, 0.9), end: Color4.create(0.8, 0.1, 1, 0) },
  initialVelocitySpeed: { start: 1.5, end: 3.0 },
  gravity: -0.8,
  additionalForce: Vector3.create(0.3, 0, 0),
  billboard: false,
  initialRotation: initRot,
  rotationOverTime: rotOverTime,
  blendMode: PBParticleSystem_BlendMode.PSB_ADD,
  shape: ParticleSystem.Shape.Cone({ angle: 15, radius: 0.3 }),
  playbackState: PBParticleSystem_PlaybackState.PS_PLAYING
})
```

## 5. Gravity Fountain — Sphere r=0.1, fast upward, strong gravity pulls down

```typescript
ParticleSystem.create(entity, {
  active: true,
  rate: 30,
  lifetime: 3,
  maxParticles: 200,
  initialSize: { start: 0.15, end: 0.25 },
  sizeOverTime: { start: 1.0, end: 0.5 },
  initialColor: { start: Color4.create(0.3, 0.8, 1, 1), end: Color4.create(0.1, 0.5, 1, 1) },
  colorOverTime: { start: Color4.create(0.5, 0.9, 1, 1), end: Color4.create(0.1, 0.3, 0.8, 0) },
  initialVelocitySpeed: { start: 3, end: 5 },
  gravity: -2.5,                                    // negative gravity here = falls down (sign convention is multiplier on scene gravity)
  blendMode: PBParticleSystem_BlendMode.PSB_ALPHA,
  shape: ParticleSystem.Shape.Sphere({ radius: 0.1 }),
  playbackState: PBParticleSystem_PlaybackState.PS_PLAYING
})
```

## 6. Bat Swarm — Sphere r=1.5, sprite-sheet 4×4 (16 frames at 24fps)

```typescript
ParticleSystem.create(entity, {
  active: true,
  rate: 5,
  lifetime: 4,
  maxParticles: 40,
  initialSize: { start: 0.6, end: 1.0 },
  sizeOverTime: { start: 1.0, end: 0.8 },
  initialColor: { start: Color4.create(1, 1, 1, 1), end: Color4.create(1, 1, 1, 1) },
  colorOverTime: { start: Color4.create(1, 1, 1, 1), end: Color4.create(1, 1, 1, 0) },
  initialVelocitySpeed: { start: 0.5, end: 1.5 },
  rotationOverTime: { x: 0, y: 0, z: 0.1305, w: 0.9914 },
  billboard: true,
  blendMode: PBParticleSystem_BlendMode.PSB_ALPHA,
  texture: { src: 'assets/32x32-bat-sprite.png' },
  spriteSheet: { tilesX: 4, tilesY: 4, framesPerSecond: 24 },
  shape: ParticleSystem.Shape.Sphere({ radius: 1.5 }),
  playbackState: PBParticleSystem_PlaybackState.PS_PLAYING
})
```

## 7. Tumbling Leaves — Sphere r=1, billboard OFF, 3D rotation

```typescript
const initRot = { x: 0.1768, y: 0.4619, z: -0.0924, w: 0.8624 }      // fromEulerDegrees(30, 60, 0)
const rotOverTime = { x: 0.1464, y: -0.0616, z: 0.3536, w: 0.9224 }  // fromEulerDegrees(20, 0, 45)

ParticleSystem.create(entity, {
  active: true,
  rate: 6,
  lifetime: 5,
  maxParticles: 50,
  initialSize: { start: 0.3, end: 0.5 },
  sizeOverTime: { start: 1.0, end: 0.7 },
  initialColor: { start: Color4.create(0.4, 0.7, 0.2, 0.9), end: Color4.create(0.8, 0.6, 0.1, 0.9) },
  colorOverTime: { start: Color4.create(0.6, 0.7, 0.2, 0.8), end: Color4.create(0.5, 0.3, 0.05, 0) },
  initialVelocitySpeed: { start: 0.2, end: 0.6 },
  gravity: 0.4,
  billboard: false,
  initialRotation: initRot,
  rotationOverTime: rotOverTime,
  blendMode: PBParticleSystem_BlendMode.PSB_ALPHA,
  shape: ParticleSystem.Shape.Sphere({ radius: 1.0 }),
  playbackState: PBParticleSystem_PlaybackState.PS_PLAYING
})
```

## 8. Lightning Sparks — Point + ADD, very fast, short life, velocity-clamped

```typescript
ParticleSystem.create(entity, {
  active: true,
  rate: 80,
  lifetime: 0.4,
  maxParticles: 200,
  initialSize: { start: 0.05, end: 0.12 },
  sizeOverTime: { start: 1.0, end: 0.0 },
  initialColor: { start: Color4.create(0.5, 1, 1, 1), end: Color4.create(0, 0.8, 1, 1) },
  colorOverTime: { start: Color4.create(0.6, 1, 1, 1), end: Color4.create(0, 0.5, 0.8, 0) },
  initialVelocitySpeed: { start: 6, end: 12 },
  limitVelocity: { speed: 4, dampen: 0.9 },
  blendMode: PBParticleSystem_BlendMode.PSB_ADD,
  shape: ParticleSystem.Shape.Point(),
  playbackState: PBParticleSystem_PlaybackState.PS_PLAYING
})
```

## 9. Heavy Rain — Box(6, 0.1, 6), entity rotated 180° to fall

```typescript
const entity = engine.addEntity()
Transform.create(entity, {
  position: Vector3.create(26, 6, 22),
  rotation: Quaternion.fromEulerDegrees(180, 0, 0)
})

ParticleSystem.create(entity, {
  active: true,
  rate: 100,
  lifetime: 3,
  maxParticles: 600,
  initialSize: { start: 0.04, end: 0.07 },
  sizeOverTime: { start: 1.0, end: 0.8 },
  initialColor: { start: Color4.create(0.7, 0.8, 1, 0.7), end: Color4.create(0.6, 0.7, 0.9, 0.7) },
  colorOverTime: { start: Color4.create(0.7, 0.8, 1, 0.6), end: Color4.create(0.5, 0.6, 0.8, 0) },
  initialVelocitySpeed: { start: 4, end: 6 },
  limitVelocity: { speed: 5, dampen: 1 },
  gravity: 2,
  blendMode: PBParticleSystem_BlendMode.PSB_ALPHA,
  shape: ParticleSystem.Shape.Box({ size: Vector3.create(6, 0.1, 6) }),
  playbackState: PBParticleSystem_PlaybackState.PS_PLAYING
})
```

## 10. One-Shot Burst — Sphere, single 100-particle burst, no loop

```typescript
ParticleSystem.create(entity, {
  active: true,
  loop: false,
  prewarm: false,
  rate: 0,
  lifetime: 3,
  maxParticles: 150,
  initialSize: { start: 0.1, end: 0.25 },
  sizeOverTime: { start: 1.0, end: 0.0 },
  initialColor: { start: Color4.create(1, 0.8, 0.3, 1), end: Color4.create(1, 0.5, 0.1, 1) },
  colorOverTime: { start: Color4.create(1, 0.7, 0.2, 1), end: Color4.create(1, 1, 1, 0) },
  initialVelocitySpeed: { start: 2, end: 4 },
  limitVelocity: { speed: 2, dampen: 0.6 },
  blendMode: PBParticleSystem_BlendMode.PSB_ALPHA,
  shape: ParticleSystem.Shape.Sphere({ radius: 0.5 }),
  playbackState: PBParticleSystem_PlaybackState.PS_PLAYING,
  bursts: { values: [
    { time: 0, count: 100, cycles: 1, interval: 0.01, probability: 1.0 }
  ] }
})
```

## 11. Asteroid Trail — Cone, ADD, faceTravelDirection (streaks along velocity)

```typescript
ParticleSystem.create(entity, {
  active: true,
  rate: 50,
  lifetime: 1.5,
  maxParticles: 200,
  initialSize: { start: 0.05, end: 0.15 },
  sizeOverTime: { start: 1.0, end: 0.0 },
  initialColor: { start: Color4.create(1, 0.7, 0.2, 1), end: Color4.create(0.8, 0.3, 0.1, 1) },
  colorOverTime: { start: Color4.create(1, 0.6, 0.1, 1), end: Color4.create(0.2, 0, 0, 0) },
  initialVelocitySpeed: { start: 5, end: 8 },
  limitVelocity: { speed: 3, dampen: 0.5 },
  gravity: -0.5,
  blendMode: PBParticleSystem_BlendMode.PSB_ADD,
  faceTravelDirection: true,             // overrides billboard
  shape: ParticleSystem.Shape.Cone({ angle: 10, radius: 0.1 }),
  playbackState: PBParticleSystem_PlaybackState.PS_PLAYING
})
```

## 12. Purple Swirl — Sphere r=0.3, sideways force, fast rotation

```typescript
ParticleSystem.create(entity, {
  active: true,
  rate: 25,
  lifetime: 4,
  maxParticles: 150,
  initialSize: { start: 0.15, end: 0.35 },
  sizeOverTime: { start: 0.8, end: 1.2 },
  initialColor: { start: Color4.create(0.6, 0.1, 1, 1), end: Color4.create(0.8, 0.3, 1, 1) },
  colorOverTime: { start: Color4.create(0.7, 0.2, 1, 1), end: Color4.create(0.4, 0, 0.8, 0) },
  initialVelocitySpeed: { start: 0.5, end: 1.5 },
  rotationOverTime: { x: 0, y: 0, z: 1, w: 0 },     // 180° flip on Z = full spin
  additionalForce: Vector3.create(0.5, 0, 0),
  blendMode: PBParticleSystem_BlendMode.PSB_ALPHA,
  shape: ParticleSystem.Shape.Sphere({ radius: 0.3 }),
  playbackState: PBParticleSystem_PlaybackState.PS_PLAYING
})
```

## 13. Bee Swarm — Sphere r=1, 1×20 sprite-sheet strip at 30fps

```typescript
ParticleSystem.create(entity, {
  active: true,
  rate: 8,
  lifetime: 5,
  maxParticles: 40,
  initialSize: { start: 0.4, end: 0.6 },
  sizeOverTime: { start: 1.0, end: 1.0 },
  initialColor: { start: Color4.create(1, 1, 1, 1), end: Color4.create(1, 1, 1, 1) },
  colorOverTime: { start: Color4.create(1, 1, 1, 1), end: Color4.create(1, 1, 1, 0) },
  initialVelocitySpeed: { start: 0.3, end: 0.8 },
  rotationOverTime: { x: 0, y: 0, z: 0.0872, w: 0.9962 },
  blendMode: PBParticleSystem_BlendMode.PSB_ALPHA,
  texture: { src: 'assets/dcl-particles/bee.png' },
  spriteSheet: { tilesX: 1, tilesY: 20, framesPerSecond: 30 },
  shape: ParticleSystem.Shape.Sphere({ radius: 1.0 }),
  playbackState: PBParticleSystem_PlaybackState.PS_PLAYING
})
```

## 14. Fireworks Loop — Cone + ADD, three staggered bursts per cycle

```typescript
ParticleSystem.create(entity, {
  active: true,
  loop: true,
  rate: 0,
  lifetime: 2,
  maxParticles: 300,
  initialSize: { start: 0.08, end: 0.18 },
  sizeOverTime: { start: 1.0, end: 0.0 },
  initialColor: { start: Color4.create(1, 0.9, 0.4, 1), end: Color4.create(1, 0.4, 0.1, 1) },
  colorOverTime: { start: Color4.create(1, 0.8, 0.5, 1), end: Color4.create(0.8, 0.2, 0, 0) },
  initialVelocitySpeed: { start: 3, end: 6 },
  gravity: -1,
  blendMode: PBParticleSystem_BlendMode.PSB_ADD,
  shape: ParticleSystem.Shape.Cone({ angle: 30, radius: 0.2 }),
  playbackState: PBParticleSystem_PlaybackState.PS_PLAYING,
  bursts: { values: [
    { time: 0,   count: 40, cycles: 2, interval: 0.15, probability: 1.0 },
    { time: 0.5, count: 60, cycles: 1, interval: 0.01, probability: 0.8 },
    { time: 1.2, count: 30, cycles: 3, interval: 0.10, probability: 0.9 }
  ] }
})
```

## 15. Campfire — Point + ADD, fire sprite-sheet 4×3

```typescript
ParticleSystem.create(entity, {
  active: true,
  rate: 12,
  lifetime: 1.8,
  maxParticles: 40,
  initialSize: { start: 0.8, end: 1.4 },
  sizeOverTime: { start: 1.0, end: 0.3 },
  initialColor: { start: Color4.create(1, 0.9, 0.7, 1), end: Color4.create(1, 0.7, 0.3, 1) },
  colorOverTime: { start: Color4.create(1, 0.8, 0.5, 1), end: Color4.create(0.4, 0.1, 0, 0) },
  initialVelocitySpeed: { start: 0.3, end: 0.8 },
  gravity: -0.5,
  blendMode: PBParticleSystem_BlendMode.PSB_ADD,
  texture: { src: 'assets/dcl-particles/sprite_fire3.png' },
  spriteSheet: { tilesX: 4, tilesY: 3, framesPerSecond: 12 },
  shape: ParticleSystem.Shape.Point(),
  playbackState: PBParticleSystem_PlaybackState.PS_PLAYING
})
```

## 16. Flame Wisps — Cone(angle=20, r=0.3) + ADD, flame sprite-sheet 4×3

```typescript
ParticleSystem.create(entity, {
  active: true,
  rate: 10,
  lifetime: 2,
  maxParticles: 50,
  initialSize: { start: 0.5, end: 1.0 },
  sizeOverTime: { start: 1.0, end: 0.0 },
  initialColor: { start: Color4.create(1, 0.8, 0.6, 0.9), end: Color4.create(1, 0.5, 0.2, 0.9) },
  colorOverTime: { start: Color4.create(1, 0.7, 0.4, 0.8), end: Color4.create(0.8, 0.2, 0.05, 0) },
  initialVelocitySpeed: { start: 0.5, end: 1.2 },
  gravity: -0.4,
  rotationOverTime: { x: 0, y: 0, z: 0.2588, w: 0.9659 },
  blendMode: PBParticleSystem_BlendMode.PSB_ADD,
  texture: { src: 'assets/dcl-particles/sprite_flame.png' },
  spriteSheet: { tilesX: 4, tilesY: 3, framesPerSecond: 10 },
  shape: ParticleSystem.Shape.Cone({ angle: 20, radius: 0.3 }),
  playbackState: PBParticleSystem_PlaybackState.PS_PLAYING
})
```

## 17. Moving Trail — Tweened emitter, simulationSpace LOCAL leaves cloud with the entity

For a true persistent trail behind a moving emitter, set `simulationSpace: PBParticleSystem_SimulationSpace.PSS_WORLD` instead. The test scene uses LOCAL — the cloud follows the entity.

```typescript
import { Tween, TweenSequence, TweenLoop, EasingFunction } from '@dcl/sdk/ecs'

const entity = engine.addEntity()
const posA = Vector3.create(6, 1, 44)
const posB = Vector3.create(26, 1, 44)
Transform.create(entity, { position: posA })

ParticleSystem.create(entity, {
  active: true,
  rate: 40,
  lifetime: 2,
  maxParticles: 200,
  initialSize: { start: 0.1, end: 0.2 },
  sizeOverTime: { start: 1.0, end: 0.0 },
  initialColor: { start: Color4.create(0.2, 1, 0.5, 1), end: Color4.create(0.1, 0.8, 1, 1) },
  colorOverTime: { start: Color4.create(0.3, 1, 0.7, 1), end: Color4.create(0, 0.3, 0.5, 0) },
  initialVelocitySpeed: { start: 0.5, end: 1.5 },
  blendMode: PBParticleSystem_BlendMode.PSB_ADD,
  shape: ParticleSystem.Shape.Point(),
  simulationSpace: PBParticleSystem_SimulationSpace.PSS_LOCAL,
  playbackState: PBParticleSystem_PlaybackState.PS_PLAYING
})

Tween.create(entity, {
  mode: Tween.Mode.Move({ start: posA, end: posB }),
  duration: 3000,
  easingFunction: EasingFunction.EF_LINEAR
})
TweenSequence.create(entity, {
  sequence: [
    { mode: Tween.Mode.Move({ start: posB, end: posA }), duration: 3000, easingFunction: EasingFunction.EF_LINEAR }
  ],
  loop: TweenLoop.TL_RESTART
})
```

---

## Quick selection guide

| Effect | Preset | Key fields |
|---|---|---|
| Glowing fire / embers | 1, 15, 16 | Point/Cone, `PSB_ADD`, gravity < 0 |
| Magic glow / aura | 2, 12 | Sphere, `PSB_ALPHA`, slow rotation |
| Falling weather (snow/rain) | 3, 9 | Cone or flat Box, parent rotated downward, gravity > 0 |
| Sparks / streaks | 8, 11 | Short lifetime, high speed, `PSB_ADD`, optional `faceTravelDirection` |
| Fountain | 5 | Spherical spread, high upward speed, gravity > 0 |
| Swarms (animated sprites) | 6, 13 | Sphere, sprite-sheet texture, `PSB_ALPHA` |
| One-shot pickup / explosion | 10 | `loop: false`, `rate: 0`, single burst |
| Looping fireworks | 14 | `rate: 0`, multiple staggered bursts, gravity < 0 |
| Tumbling debris | 7 | `billboard: false`, 3D `rotationOverTime` |
| Trails on moving emitters | 17 | Tween + `simulationSpace`, LOCAL = follows / WORLD = leaves trail |
