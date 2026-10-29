---
name: particle-system
description: "Emit particles from an entity with the ParticleSystem component: fire, smoke, sparks, rain, snow, fireworks, magic, trails, explosion bursts. Use for any particle or VFX effect. For entity motion see animations-tweens; for UI effects see build-ui."
---

# ParticleSystem (SDK7)

Emit particles from an entity. One `ParticleSystem` component per entity, attached alongside a `Transform`. No mesh required — particles render from the component itself.

## RULE: Size particles with `initialSize` / `sizeOverTime` (Transform.scale is ignored)

Particle size comes only from `initialSize` and `sizeOverTime` (FloatRange), and the emitter's extent only from the shape's own size fields (Sphere radius, Box size, Cone radius). The entity's `Transform.scale` affects neither.

## RULE: Particles only render to players inside scene parcels

Players viewing the scene from outside its parcels see nothing. Particles are not part of the scene LOD silhouette. Position emitters within parcel bounds.

## RULE: Budget particles — ≤ 8 emitters, `maxParticles` summing to ≤ 1,000

The desktop (Unity) explorer budgets **1,000 live particles per scene** and scales down emission rates across all active systems when the total would exceed it. `maxParticles` defaults to 1,000 per system, so a single system left at the default can claim the whole scene budget: set `maxParticles` on every system so the sum stays within 1,000, and prefer fewer impactful systems over many small ones. This desktop budget is the design target for a cross-platform scene; the mobile limits below are looser.

Mobile limits (soft = a warning in the mobile performance panel; hard = the scene will not load):

| | Soft | Hard |
| --- | --- | --- |
| VFX emitters (particle systems in the scene) | 8 | 10 |
| Live particles | 25,000 | 50,000 |

Mobile also clamps at runtime to 5,000 particles per emitter and 50,000 per scene. Full mobile limit table: **optimize-scene** → *Mobile Scene Limits*. `ParticleSystem` itself is supported on mobile.

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
| `maxParticles`         | `number`                             | `1000`             | Cap on simultaneous live particles for this system. See the budget RULE.        |
| `lifetime`             | `number`                             | `5`                | Particle lifespan in seconds.                                                   |
| `gravity`              | `number`                             | `0`                | Multiplier on scene gravity (~ -9.81 m/s²). Negative = particles rise.          |
| `additionalForce`      | `Vector3`                            | —                  | Constant force vector applied each frame (world space).                         |
| `initialSize`          | `FloatRange`                         | `{start:1, end:1}` | Random size at spawn.                                                           |
| `sizeOverTime`         | `FloatRange`                         | `{start:1, end:1}` | Size lerped start→end over particle lifetime.                                   |
| `initialRotation`      | `Quaternion`                         | identity           | Spawn orientation (3D).                                                         |
| `rotationOverTime`     | `Quaternion`                         | identity           | Per-axis angular velocity (quaternion converted to Euler XYZ rad/s-equivalent). |
| `faceTravelDirection`  | `boolean`                            | `false`            | Orient along velocity. See RULE above.                                          |
| `initialColor`         | `ColorRange`                         | `{white,white}`    | Random color at spawn.                                                          |
| `colorOverTime`        | `ColorRange`                         | `{white,white}`    | Color lerped start→end over lifetime. Use alpha=0 at end to fade out.           |
| `initialVelocitySpeed` | `FloatRange`                         | `{start:1, end:1}` | Initial speed in m/s, randomized per particle.                                  |
| `texture`              | `Texture`                            | white quad         | Particle sprite. Same `Texture` shape as Material textures.                     |
| `blendMode`            | `PBParticleSystem_BlendMode`         | `PSB_ALPHA`        | `PSB_ALPHA` \| `PSB_ADD` \| `PSB_MULTIPLY`.                                     |
| `billboard`            | `boolean`                            | `true`             | Particles always face camera. Disable for 3D-oriented particles.                |
| `spriteSheet`          | `{tilesX, tilesY, framesPerSecond?}` | —                  | Texture-atlas frame animation. `framesPerSecond` defaults to 30.                |
| `shape`                | oneof Point/Sphere/Cone/Box          | Point              | Emitter geometry — see below.                                                   |
| `loop`                 | `boolean`                            | `true`             | Loop the emission cycle. `false` = one-shot.                                    |
| `prewarm`              | `boolean`                            | `false`            | Start as if one full loop has already simulated. See RULE above.                |
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

## Creator Hub editor integration

The Creator Hub inspector has a dedicated **ParticleSystem panel** (works on multi-entity selections). The recommended way to create and tune particle effects in Creator Hub scenes is:

1. Add a `ParticleSystem` component to an entity in the editor.
2. Tweak all fields live in the inspector panel -- no code, no scene reload.

Reserve code (`ParticleSystem.create`/`getMutable` in `src/` or via a Script component) for dynamic runtime behavior only: toggling emitters from game logic, wiring play/stop to triggers/actions, or computing configs at runtime.

### Programmatic / composite component name

- Component name: `core::ParticleSystem` (component id `1217`).
- `shape` is a protobuf oneof, serialized as `{"$case":"sphere","sphere":{"radius":1}}`, `{"$case":"cone","cone":{"angle":25,"radius":1}}`, `{"$case":"box","box":{"size":{"x":1,"y":1,"z":1}}}`, or `{"$case":"point","point":{}}`.
- `texture` is a flat `Texture` (NOT `TextureUnion`), serialized as `{"src":"assets/Images/spark.png"}`. The `$case`/`tex` wrapper used by `Material` does not apply here.

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

- **Texture path** — textures go in `assets/Images/` (folder conventions: **add-3d-models** → Asset folder conventions).
- **Quaternion rotation fields** — `rotationOverTime` is interpreted as per-axis angular velocity (quaternion → Euler XYZ). `Quaternion.fromEulerDegrees(0, 90, 0)` = spin 90°/s on Y. Identity = no spin.
- **`additionalForce` is world-space** even when `simulationSpace = PSS_LOCAL`. Wind/drift directions stay constant regardless of emitter rotation.
- **`limitVelocity.dampen = 1`** = hard clamp (particles never exceed `speed`). Lower values let velocity exceed cap briefly then decay.
- **Fade particles out with alpha 0 at the end of `colorOverTime`**, alongside or instead of `sizeOverTime` ending at 0.
- **Bursts ignore `active = false`** at the moment of evaluation — `active` is checked once per frame for continuous rate; setting it after a burst time will not retroactively cancel that burst.
- **No mesh attached to the emitter entity** — adding `MeshRenderer` is unrelated; particles render via the ParticleSystem component itself.

## Performance

- Keep `lifetime * rate` low; that product is the steady-state live count.
- Disable systems out of view via `playbackState = PS_STOPPED` or `active = false`.
- Prefer `PSB_ALPHA` for opaque/translucent effects. `PSB_ADD` is best for glow/fire (it stacks visually) but multi-layer additive overdraw is the most expensive case.
- Sprite sheets are cheap; multiple textures per system is not supported (one texture per system).

## Resources

- `{baseDir}/references/particle-presets.md` — the 17 presets listed above.
- Live tuner: `ParticleLab.dcl.eth` (open with Decentraland client).

## Example scenes

- `https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/0,7-particle-system` — engine-team ground truth: all 17 presets above, every shape (Point/Sphere/Cone/Box), `PSB_ADD`/`PSB_ALPHA`, continuous `rate` vs `bursts` (one-shot + looping fireworks), `spriteSheet` (4×4/4×3/1×20), `limitVelocity`, `initialRotation`/`rotationOverTime` with `billboard: false`, `faceTravelDirection`, `additionalForce`, and a Tween-driven emitter demonstrating `simulationSpace`.
