---
name: particle-system
description: Emit particles (fire, smoke, snow, fireworks, magic, trails) from an entity in a Decentraland SDK7 scene with the ParticleSystem component. Do NOT use for procedural entity motion (see animations-tweens), GLTF model effects (see add-3d-models), or 2D UI effects (see build-ui).
---

# ParticleSystem (SDK7)

Emit particles from an entity. One `ParticleSystem` component per entity, attached alongside a `Transform`. No mesh required — particles render from the component itself.

## RULE: Transform.scale does NOT scale particles

Particle size is controlled exclusively by `initialSize` and `sizeOverTime` (FloatRange). The `ParticleSystem` also sets emitter shape's spatial dimensions when the shape has size fields (Sphere radius, Box size, Cone radius). These are not affected by the entity's `Transform.scale`. Setting `Transform.scale` larger does not produce bigger particles.

## RULE: Particles only render to players inside scene parcels

Players viewing the scene from outside its parcels see nothing. Particles are not part of the scene LOD silhouette. Position emitters within parcel bounds.

## RULE: Particles only work in the Unity explorer

The mobile Godot explorer and the Bevy explorer don't have this feature implemented. The renderer ignores the component.

## RULE: Engine caps total particles at ~1000

The engine enforces a per-scene particle budget and will scale down emission rates across all active particle systems if total live particles would exceed the limit. Cap each system with `maxParticles` and prefer fewer impactful systems over many small ones.

## RULE: prewarm requires loop = true

`prewarm: true` only takes effect when `loop: true`. On a one-shot system (`loop: false`) prewarm is silently ignored.

## RULE: faceTravelDirection overrides billboard

When `faceTravelDirection: true`, particles orient along their velocity vector and `billboard` is ignored. Use this for trails/streaks (asteroids, bullets, sparks). Set `billboard: false` explicitly to avoid confusion.

## Import

```typescript
import { engine, Transform, ParticleSystem } from '@dcl/sdk/ecs'
import {
	PBParticleSystem_BlendMode,
	PBParticleSystem_PlaybackState,
	PBParticleSystem_SimulationSpace,
} from '@dcl/sdk/ecs'
import { Color4, Vector3, Quaternion } from '@dcl/sdk/math'
```

Aliases `ParticleSystemBlendMode` and `ParticleSystemPlaybackState` are also exported from `@dcl/sdk/ecs` and are interchangeable with the `PB`-prefixed names. **There is no `ParticleSystemSimulationSpace` alias** — only `PBParticleSystem_SimulationSpace`. Prefer the `PB`-prefixed names everywhere for consistency.

## Field reference

| Field                  | Type                                 | Default            | Notes                                                                           |
| ---------------------- | ------------------------------------ | ------------------ | ------------------------------------------------------------------------------- |
| `active`               | `boolean`                            | `true`             | Master on/off for new emission.                                                 |
| `rate`                 | `number`                             | `10`               | Particles emitted per second (continuous). Set to `0` when using `bursts`.      |
| `maxParticles`         | `number`                             | `1000`             | Hard cap on simultaneous live particles for this system.                        |
| `lifetime`             | `number`                             | `5`                | Particle lifespan in seconds.                                                   |
| `gravity`              | `number`                             | `0`                | Multiplier on scene gravity (~ -9.81 m/s²). Negative = particles rise.          |
| `additionalForce`      | `Vector3`                            | —                  | Constant force vector applied each frame (world space).                         |
| `initialSize`          | `FloatRange`                         | `{start:1, end:1}` | Random size at spawn.                                                           |
| `sizeOverTime`         | `FloatRange`                         | `{start:1, end:1}` | Size lerped start→end over particle lifetime.                                   |
| `initialRotation`      | `Quaternion`                         | identity           | Spawn orientation (3D).                                                         |
| `rotationOverTime`     | `Quaternion`                         | identity           | Per-axis angular velocity (quaternion converted to Euler XYZ rad/s-equivalent). |
| `faceTravelDirection`  | `boolean`                            | `false`            | Orient along velocity. Overrides `billboard`.                                   |
| `initialColor`         | `ColorRange`                         | `{white,white}`    | Random color at spawn.                                                          |
| `colorOverTime`        | `ColorRange`                         | `{white,white}`    | Color lerped start→end over lifetime. Use alpha=0 at end to fade out.           |
| `initialVelocitySpeed` | `FloatRange`                         | `{start:1, end:1}` | Initial speed in m/s, randomized per particle.                                  |
| `texture`              | `Texture`                            | white quad         | Particle sprite. Same `Texture` shape as Material textures.                     |
| `blendMode`            | `PBParticleSystem_BlendMode`         | `PSB_ALPHA`        | `PSB_ALPHA` \| `PSB_ADD` \| `PSB_MULTIPLY`.                                     |
| `billboard`            | `boolean`                            | `true`             | Particles always face camera. Disable for 3D-oriented particles.                |
| `spriteSheet`          | `{tilesX, tilesY, framesPerSecond?}` | —                  | Texture-atlas frame animation. `framesPerSecond` defaults to 30.                |
| `shape`                | oneof Point/Sphere/Cone/Box          | Point              | Emitter geometry — see below.                                                   |
| `loop`                 | `boolean`                            | `true`             | Loop the emission cycle. `false` = one-shot.                                    |
| `prewarm`              | `boolean`                            | `false`            | Start as if one full loop has already simulated. Requires `loop: true`.         |
| `simulationSpace`      | `PBParticleSystem_SimulationSpace`   | `PSS_LOCAL`        | `PSS_LOCAL` (move with entity) \| `PSS_WORLD` (stay put after spawn).           |
| `limitVelocity`        | `{speed, dampen?}`                   | —                  | Clamp top speed. `dampen` 0–1, default `1` = hard clamp.                        |
| `playbackState`        | `PBParticleSystem_PlaybackState`     | `PS_PLAYING`       | `PS_PLAYING` \| `PS_PAUSED` \| `PS_STOPPED`.                                    |
| `bursts`               | `{values: Burst[]}`                  | —                  | Discrete emission events (see Bursts).                                          |

`FloatRange = { start: number, end: number }` — random value sampled per particle.
`ColorRange = { start: Color4, end: Color4 }` — random color sampled per particle (each end of the range is sampled independently of the other particle randoms).

## Emitter shapes

Build with the `ParticleSystem.Shape.*` helpers — never assemble the `oneof` manually:

```typescript
shape: ParticleSystem.Shape.Point()
shape: ParticleSystem.Shape.Sphere({ radius: 1 }) // default radius=1
shape: ParticleSystem.Shape.Cone({ angle: 25, radius: 1 }) // angle = half-angle in degrees
shape: ParticleSystem.Shape.Box({ size: Vector3.create(1, 1, 1) })
```

- **Point** — emits from the entity origin.
- **Sphere** — random points inside a sphere of `radius`.
- **Cone** — emits from base disk, projecting outward within `angle` half-angle. Default cone direction is the entity's local forward; rotate the parent Transform to aim it.
- **Box** — random points inside an axis-aligned box of `size`.

To **rotate the emission direction** (e.g. point a cone downward for snow/rain), rotate the parent entity's `Transform.rotation`. Example: snow falling from a cone uses `rotation: Quaternion.fromEulerDegrees(180, 0, 0)` on the entity, or any orientation that flips the cone axis.

## Bursts

Discrete emission events at specific times. Set `rate: 0` to use bursts only, or combine with `rate > 0` for continuous + bursty.

```typescript
bursts: {
	values: [{ time: 0, count: 100, cycles: 1, interval: 0.01, probability: 1.0 }]
}
```

Burst fields: `time` (s from cycle start), `count` (particles per burst), `cycles` (default `1`, `0` = infinite), `interval` (s between cycles, default `0.01`), `probability` (0–1 chance per cycle, default `1`).

Multiple bursts in one cycle = staggered ignition pattern (fireworks).

## Common patterns

Anatomy of a `ParticleSystem` definition — attach to an entity that also has a `Transform`:

```typescript
const emitter = engine.addEntity()
Transform.create(emitter, { position: Vector3.create(8, 1, 8) })
ParticleSystem.create(emitter, {
	rate: 20, // particles per second
	lifetime: 2, // seconds each particle lives
	maxParticles: 100,
	initialSize: { start: 0.1, end: 0.3 }, // FloatRange sampled per particle
	sizeOverTime: { start: 1.0, end: 0.0 }, // shrink to nothing over lifetime
	initialVelocitySpeed: { start: 1, end: 2 },
	colorOverTime: {
		// fade out via alpha = 0 at end
		start: Color4.create(1, 1, 1, 1),
		end: Color4.create(1, 1, 1, 0),
	},
	shape: ParticleSystem.Shape.Point(), // emitter geometry
})
```

For full production-ready configurations, see `{baseDir}/references/particle-presets.md` — 17 presets: Fire Ember, Magic Aura, Snowfall, Vortex Spiral, Gravity Fountain, Bat Swarm, Tumbling Leaves, Lightning Sparks, Heavy Rain, One-Shot Burst, Asteroid Trail, Purple Swirl, Bee Swarm, Fireworks Loop, Campfire, Flame Wisps, Moving Trail. The explosion/pickup VFX (Point/Cone + ADD fire, one-shot Sphere burst) all live there — e.g. **Fire Ember** (preset 1), the **One-Shot Burst** explosion (preset 10), and looping **Fireworks Loop** (preset 14).

## Playback control

```typescript
const ps = ParticleSystem.getMutable(entity)

// Pause emission and freeze existing particles
ps.playbackState = PBParticleSystem_PlaybackState.PS_PAUSED

// Resume
ps.playbackState = PBParticleSystem_PlaybackState.PS_PLAYING

// Stop and clear all live particles
ps.playbackState = PBParticleSystem_PlaybackState.PS_STOPPED

// Disable new emission (existing particles continue to live out their lifetime)
ps.active = false
```

Use `playbackState = PS_STOPPED` for a hard cut. Use `active = false` for a graceful trail-off.

## Sprite-sheet animation

Texture atlas with frames laid out in a grid (left-to-right, top-to-bottom). Total frames = `tilesX * tilesY`.

```typescript
texture: { src: 'assets/Images/flame-sheet.png' },
spriteSheet: { tilesX: 4, tilesY: 3, framesPerSecond: 12 }   // 12 frames, plays at 12fps
```

Test-scene examples use `4x4` (16 frames, bat swarm @24fps), `4x3` (12 frames, fire/flame @10–12fps), and `1x20` (20-frame strip, bee @30fps) sheets.

## Simulation space (local vs world)

- `PSS_LOCAL` (default) — particles move with the emitter. A moving emitter drags its particle cloud along. Suits aura/halo effects on a moving entity.
- `PSS_WORLD` — particles stay at their spawn position in world space, so a moving emitter leaves a trail behind it.

For a Tween-driven emitter (verified in `0,7-particle-system`, "Moving Trail"): `PSS_LOCAL` keeps the cloud attached to the entity as it moves; switch to `PSS_WORLD` if you want the spawned particles to stay put and form a persistent trail. The test scene demonstrates the effect with `PSS_LOCAL` — pick the space by the look you want, not as a hard requirement.

## Texture field

The `texture` field uses the same `Texture` type as `Material`. Common case (local file):

```typescript
texture: {
	src: 'assets/Images/spark.png'
}
```

The full Texture form supports filterMode/wrapMode but particle systems generally only need `src`. Avatar/Video textures on particles are unverified — stick with file textures.

## Gotchas

- **Texture path** — particle textures default to `assets/Images/`. Same path conventions as Material textures. Legacy scenes may have them under `assets/scene/Images/` or `assets/scene/textures/` (still works); Creator Hub assets land in `assets/asset-packs/`, `assets/custom/`, or `assets/scene/` — reference those paths as-is.
- **Quaternion rotation fields** — `rotationOverTime` is interpreted as per-axis angular velocity (quaternion → Euler XYZ). `Quaternion.fromEulerDegrees(0, 90, 0)` = spin 90°/s on Y. Identity = no spin.
- **`additionalForce` is world-space** even when `simulationSpace = PSS_LOCAL`. Wind/drift directions stay constant regardless of emitter rotation.
- **`limitVelocity.dampen = 1`** = hard clamp (particles never exceed `speed`). Lower values let velocity exceed cap briefly then decay.
- **Color.alpha = 0 at end of `colorOverTime`** is the standard way to fade particles out — don't rely on `sizeOverTime` ending at 0 alone.
- **Bursts ignore `active = false`** at the moment of evaluation — `active` is checked once per frame for continuous rate; setting it after a burst time will not retroactively cancel that burst.
- **No mesh attached to the emitter entity** — adding `MeshRenderer` is unrelated; particles render via the ParticleSystem component itself.

## Performance

- Keep `lifetime * rate` low; that product is the steady-state live count.
- Disable systems out of view via `playbackState = PS_STOPPED` or `active = false`.
- Prefer `PSB_ALPHA` for opaque/translucent effects. `PSB_ADD` is best for glow/fire (it stacks visually) but multi-layer additive overdraw is the most expensive case.
- Sprite sheets are cheap; multiple textures per system is not supported (one texture per system).

## Resources

- `{baseDir}/references/particle-presets.md` — 17 ready-to-use preset configurations from the SDK7 test scene (fire, magic, snowfall, vortex, fountain, swarms, sparks, rain, bursts, fireworks, campfire, trails).
- Live tuner: `ParticleLab.dcl.eth` (open with Decentraland client).

## Example scenes

- `https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/0,7-particle-system` — engine-team ground truth: all 17 presets above, every shape (Point/Sphere/Cone/Box), `PSB_ADD`/`PSB_ALPHA`, continuous `rate` vs `bursts` (one-shot + looping fireworks), `spriteSheet` (4×4/4×3/1×20), `limitVelocity`, `initialRotation`/`rotationOverTime` with `billboard: false`, `faceTravelDirection`, `additionalForce`, and a Tween-driven emitter demonstrating `simulationSpace`.
