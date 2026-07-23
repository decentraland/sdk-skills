---
name: lighting-environment
description: Dynamic lighting and environment in Decentraland scenes. LightSource, shadows, SkyboxTime, realm detection, and emissive materials. Use when the user wants lights, shadows, skybox control, day-night cycle, or glowing materials. Do NOT use for PBR material properties like metallic/roughness (see advanced-rendering).
---

# Lighting and Environment in Decentraland

## Point Lights

Emit light in all directions from a position:

```typescript
import { engine, Transform, LightSource } from '@dcl/sdk/ecs'
import { Vector3, Color3 } from '@dcl/sdk/math'

const light = engine.addEntity()
Transform.create(light, { position: Vector3.create(8, 3, 8) })

LightSource.create(light, {
  type: LightSource.Type.Point({}),
  color: Color3.White(),
  intensity: 16000  // candela
})
```

### Colored Point Light

```typescript
LightSource.create(light, {
  type: LightSource.Type.Point({}),
  color: Color3.create(1, 0.5, 0),  // Warm orange
  intensity: 16000,
  range: 15  // Maximum distance in meters
})
```

Defaults (from the protocol): `active` true, `color` white, `intensity` 16000 candela, `range` -1 (auto), `shadow` false. `color` is `Color3` (RGB, each 0–1).

## Spot Lights

Emit a cone of light in a direction:

```typescript
import { Quaternion } from '@dcl/sdk/math'

const spotlight = engine.addEntity()
Transform.create(spotlight, {
  position: Vector3.create(8, 4, 8),
  rotation: Quaternion.fromEulerDegrees(-90, 0, 0)  // Point downward
})

LightSource.create(spotlight, {
  type: LightSource.Type.Spot({ innerAngle: 25, outerAngle: 45 }),
  color: Color3.White(),
  intensity: 16000
})
```

- `innerAngle` — full-brightness cone angle (degrees). Default `21.8`. Min `0`, max `179`.
- `outerAngle` — outer fade angle (degrees). Default `30`. Max `179`.
- `innerAngle` cannot exceed `outerAngle` — if it does, the engine clamps them to the same value.
- The light direction follows the entity's forward vector (set via Transform rotation).
- `type` is a discriminated union. To read/mutate spot params at runtime, narrow first:
  `if (comp.type?.$case === 'spot') { comp.type.spot.innerAngle = 30 }`

## Shadows

Enable shadows on point or spot lights:

```typescript
LightSource.create(spotlight, {
  type: LightSource.Type.Spot({ innerAngle: 25, outerAngle: 45 }),
  shadow: true,
  intensity: 800
})
```

Note: shadows are only rendered for spot lights, not point lights. `shadow` is a top-level boolean on the component (not inside `Spot`/`Point`).

### Shadow Mask Textures (Gobos)

Project a pattern through the light:

```typescript
const maskedLight = LightSource.getMutable(spotlight)
maskedLight.shadowMaskTexture = Material.Texture.Common({
  src: 'assets/Images/lightmask1.png'
})
```

- Set `shadowMaskTexture = undefined` to remove the mask again.
- The mask projects light shape (e.g. a window pattern) — simulating caustics/soft shadows. Used on spot lights.

## Toggling Lights

```typescript
// Toggle on/off
const lightData = LightSource.getMutable(light)
lightData.active = !lightData.active
```

## Light Limits

- A scene may **create** many lights (the engine test scene spawns ~9 across 2 parcels); the renderer decides how many render.
- Depending on the player's quality settings, between ~4 and ~10 lights render at once. If the scene has more than that, only the closest lights to the player are rendered.
- Up to ~3 shadow-casting lights render at once.
- The renderer auto-culls lights based on quality settings and proximity.
- Intensity is in **candela** (lumens/m² at 1m, i.e. lumens/4π). Default `16000`.
- `range` default is `-1` → auto-computed as `intensity^0.25` (fourth root, in meters). Set an explicit `range` to override — this also limits a light's influence and saves performance.
- Spread lights out so few are near the player at once (only the closest ones render).

## SkyboxTime (Day/Night Cycle)

Use SkyboxTime for atmosphere — nighttime scenes with point lights create dramatic environments.

### Fixed Time in scene.json

Set a permanent time of day without code. Two valid locations:

```json
// Genesis City scene — top-level
{ "skyboxConfig": { "fixedTime": 43200 } }

// World — inside worldConfiguration
{ "worldConfiguration": { "name": "my-name.dcl.eth", "skyboxConfig": { "fixedTime": 36000 } } }
```

Time values (seconds since midnight, full day = 86400): 0 = midnight, 21600 = 6 AM, 43200 = noon, 64800 = 6 PM (dusk), 86400 = full day.

**Precedence** (verified against the engine test scenes): `worldConfiguration.skyboxConfig.fixedTime` wins over top-level `skyboxConfig.fixedTime`; either JSON value is in turn overridden at runtime by a `SkyboxTime` component on `engine.RootEntity`.

### Read Current World Time

```typescript
import { getWorldTime } from '~system/Runtime'

executeTask(async () => {
  const time = await getWorldTime({})
  console.log('Seconds since midnight:', time.seconds)
})
```

### Change Time Dynamically

```typescript
import { engine, SkyboxTime, TransitionMode } from '@dcl/sdk/ecs'

// Set time of day (must target the root entity)
SkyboxTime.create(engine.RootEntity, { fixedTime: 43200 })  // Noon

// Change with transition direction
SkyboxTime.createOrReplace(engine.RootEntity, {
  fixedTime: 64800,  // Dusk (6 PM)
  transitionMode: TransitionMode.TM_BACKWARD  // TM_FORWARD (0, default) or TM_BACKWARD (1)
})

// Remove the component to hand control back to global/world time
SkyboxTime.deleteFrom(engine.RootEntity)
```

- `transitionMode` (optional) sets the animation direction when the time changes. Default `TM_FORWARD`.
- The component must live on `engine.RootEntity`. Deleting it reverts to the scene.json/world time (or the global day/night cycle).

### Day/Night Cycle System

```typescript
let currentTime = 43200
const CYCLE_SPEED = 100  // Time units per second

function dayNightCycle(dt: number) {
  currentTime = (currentTime + CYCLE_SPEED * dt) % 86400
  SkyboxTime.createOrReplace(engine.RootEntity, {
    fixedTime: currentTime
  })
}

engine.addSystem(dayNightCycle)
```

## Realm Info

Detect which realm (server) the player is connected to:

```typescript
import { getRealm } from '~system/Runtime'

executeTask(async () => {
  const realm = await getRealm({})
  console.log('Realm:', realm.realmInfo?.realmName)
  console.log('Network:', realm.realmInfo?.networkId)
  console.log('Base URL:', realm.realmInfo?.baseUrl)
})
```

## Emissive Materials (Glow Effects)

For a visual glow without casting light on surroundings:

```typescript
import { engine, Material } from '@dcl/sdk/ecs'
import { Color4, Color3 } from '@dcl/sdk/math'

// Self-illuminated material (emissiveColor uses Color3, not Color4)
Material.setPbrMaterial(entity, {
  albedoColor: Color4.create(0, 0, 0, 1),
  emissiveColor: Color3.create(0, 1, 0),  // Green glow
  emissiveIntensity: 2.0
})
```

Note: emissive materials don't illuminate other surrounding entities, they just have a glow effect on them.

### Combining Emissive + LightSource

For an object that both glows visually and casts light:

```typescript
// Visual glow on the mesh
Material.setPbrMaterial(bulb, {
  emissiveColor: Color3.create(1, 0.9, 0.7),
  emissiveIntensity: 1.5
})

// Actual light emission
LightSource.create(bulb, {
  type: LightSource.Type.Point({}),
  color: Color3.create(1, 0.9, 0.7),
  intensity: 200,
  range: 10
})
```

### Shadow Quality

`shadow` is a top-level optional boolean on the LightSource component (default `false`). There is no shadow-type enum — quality is automatic and distance-based. `Spot({...})` accepts only `innerAngle?` and `outerAngle?`.

```typescript
import { LightSource } from '@dcl/sdk/ecs'

// Spot light with shadows enabled
LightSource.create(spotEntity, {
  type: LightSource.Type.Spot({ innerAngle: 25, outerAngle: 45 }),
  shadow: true,  // top-level boolean
  intensity: 800
})
```

Constraints:
- Shadows are only supported for **spot** lights; point lights do not cast shadows.
- Max **3** shadow-casting lights rendered at a time — disable `shadow` on lights that don't need it. Spot lights with shadows suit dramatic effects such as flashlights.
- Shadow quality/culling is automatic, based on the light's distance from the player. Exact distances vary by light type and the player's quality settings; general rule:

| Distance from player | Result |
|----------------------|--------|
| < 10 m | Soft shadows (high quality) |
| 10–20 m | Hard shadows (low quality) |
| > 20 m | No shadows rendered |

- The **light itself keeps illuminating** at much larger distances — it is only disabled when the player is more than **160 m away (10 parcels)**. This makes LightSource suitable for large-scale setups like stage lighting at live events, where most of the audience is far from the fixtures.
- Lights only render while the player is standing **inside** the scene; outside, they are not rendered.

> **Need advanced material effects?** See the **advanced-rendering** skill for metallic, roughness, transparency, texture maps, texture tweens, and texture modes.

## Gotchas

- `range` left unset (`-1`) is auto-derived from intensity as `intensity^0.25` — small intensities give surprisingly short range. Set `range` explicitly for predictable falloff.
- `shadow` only affects spot lights; setting it on a point light has no effect.
- Animating a light's direction: put a `Tween`/`TweenSequence` (Rotate mode) on the light entity — the beam follows the entity's forward vector.
- `SkyboxTime` on `RootEntity` overrides any scene.json `fixedTime`; `deleteFrom` reverts to it.

## Example scenes

Engine-team test scenes (real API, exercised against the engine):

- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/0,4-dynamic-lights — point & spot LightSource: toggle active, color, range, intensity, spot inner/outer angle at runtime, shadow-mask (gobo) swapping, and tweened light rotation.
- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/2,0-skybox-scene-json — fixed skybox time via top-level `skyboxConfig.fixedTime`; reads it back with `getSceneInformation`.
- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/3,0-skybox-world-json — fixed skybox time via `worldConfiguration.skyboxConfig.fixedTime` (World variant); demonstrates the worldConfiguration-wins precedence.
- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/2,1-skybox-sdk-scene-a and https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/3,1-skybox-sdk-scene-b — runtime `SkyboxTime` on `RootEntity` with `TransitionMode`, plus `deleteFrom` to return to global time.
