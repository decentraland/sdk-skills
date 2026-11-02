---
name: lighting-environment
description: Lights and sky in Decentraland scenes - LightSource point and spot lights, shadows and gobos, a light that does not show, light budgets on desktop and mobile, SkyboxTime and day/night cycles, fixtures that glow and cast light. For emissive, metallic, roughness or transparent materials see advanced-rendering.
---

# Lighting and Environment in Decentraland

## RULE: Use Smart Items for lights when the Creator Hub MCP is available

When the user asks to add a light and the Creator Hub MCP tools (`search_catalog`, `place_smart_item`) are available, **always `search_catalog` first** before manually creating an entity with `LightSource`. The Creator Hub catalog includes ready-made light Smart Items:

- **Spotlight** (`87c829b3-8e8d-4fcb-9f43-85d3aa9084f6`, category `lights`) -- comes with a real GLB model (`assets/asset-packs/spotlight/spotlight.glb`), a pre-configured `core::LightSource`, built-in Turn On / Turn Off / Toggle actions, and proper `inspector::Config` for the Creator Hub UI.
- **Point Light** (category `lights`) -- same pattern: GLB placeholder, pre-configured `core::LightSource` of type Point, built-in actions.
- There is also a **decorative** "Spotlight" (category `decorations`) that is a visual-only fixture model with no `LightSource` -- make sure you pick from the `lights` category when the user wants actual illumination.

Use `place_smart_item` with the `assetId` and a `position`. It handles everything: downloading the GLB files, resolving asset paths, setting up `asset-packs::Placeholder`, `asset-packs::Script`, `asset-packs::Actions`, and `inspector::Config` components. The entity is immediately usable in the editor with action triggers wired up.

**Only fall back to manual `create_entity` + `set_component` `core::LightSource`** when:
- No Creator Hub MCP tools are available (pure code workflow).
- The user needs a light with no visual model (invisible light source).
- The user needs non-standard light parameters that a Smart Item does not expose.

The manual `LightSource` component API documented below remains the authoritative reference for both paths -- Smart Items use the same underlying component.

If you must set a light Smart Item's `asset-packs::Placeholder` by hand via `set_component`, use the real on-disk path (e.g. `assets/asset-packs/spotlight/spotlight.glb`), not the template variable `{assetPath}/spotlight.glb`, which leaves an invisible/broken gizmo. `place_smart_item` resolves it automatically.

## RULE: 3D model light fixtures do not emit light

Light-looking geometry in a GLB model (lamp meshes, bulb shapes, glowing filaments) is purely visual -- it does not cast actual dynamic light in Decentraland. The renderer treats it as regular geometry (possibly with an emissive material for a glow effect, but no illumination of surrounding objects). To get real dynamic lighting from a fixture model, attach a `LightSource` component to the same entity or to a child entity positioned at the light source. When a user has a scene model with built-in light fixtures, proactively mention this: "The light fixtures in your model are decorative geometry only -- I need to add `LightSource` components for actual illumination."

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
  rotation: Quaternion.fromEulerDegrees(90, 0, 0)  // Point straight down — +90, not -90 (see below)
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
- `Spot({...})` accepts only `innerAngle?` and `outerAngle?`.
- The cone shines along the entity's local **+Z** (its forward). **Pitch `+90` about X points it straight down; `-90` points it at the sky** (`Quaternion.fromEulerDegrees(90, 0, 0)` rotates `Vector3.Forward()` to `(0, -1, 0)`). The SDK docs' spot example writes `-90` for "downward", so a ceiling spot copied from there that seems to do nothing may be lighting the roof; check the cone once with the sanity test under Light Limits.
- `type` is a discriminated union. To read/mutate spot params at runtime, narrow first:
  `if (comp.type?.$case === 'spot') { comp.type.spot.innerAngle = 30 }`

## Shadows

`shadow` is a top-level optional boolean on the LightSource component (default `false`), not inside `Spot`/`Point`. There is no shadow-type enum — quality is automatic and distance-based.

```typescript
LightSource.create(spotlight, {
  type: LightSource.Type.Spot({ innerAngle: 25, outerAngle: 45 }),
  shadow: true,  // top-level boolean
  intensity: 800
})
```

- Shadows render only for **spot** lights; `shadow` on a point light has no effect.
- Max **3** shadow-casting lights render at a time — disable `shadow` on lights that don't need it. Spot lights with shadows suit dramatic effects such as flashlights.
- Shadow quality/culling follows the light's distance from the player. Exact distances vary by light type and the player's quality settings; general rule:

| Distance from player | Result |
|----------------------|--------|
| < 10 m | Soft shadows (high quality) |
| 10–20 m | Hard shadows (low quality) |
| > 20 m | No shadows rendered |

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
- The desktop quality preset caps scene lights: **Low = 0 (scene lights disabled entirely), Medium = 6, High = 10** (unity-explorer `QualityPreset*.asset`; the Settings slider can lower a preset's cap further). If the scene has more than the cap, only the closest lights to the player render.
- **Troubleshoot "my light doesn't show" by checking the player's active preset first** — on Low a correctly authored `LightSource` renders nothing, and no amount of intensity, range, material or attachment-offset tuning changes that. State the supported minimum (Medium) rather than demanding High. A visible emissive flame is not proof the candle lights the room: keep the glowing mesh and the light cast onto surroundings as separate checks.
- The renderer auto-culls lights based on quality settings and proximity.
- Intensity is in **candela** (lumens/m² at 1m, i.e. lumens/4π). Default `16000`.
- `range` default is `-1` → auto-computed as `intensity^0.25` (fourth root, in meters). Set an explicit `range` to override — this also limits a light's influence and saves performance.
- Spread lights out so few are near the player at once (only the closest ones render).
- **Keep the scene readable with no scene light at all.** Desktop *Low*, mobile *Very Low* and older mobile apps render zero scene lights. Anything gameplay-critical — the path, the interactable, a "lights turn warm" story beat — must survive on emissive materials, textures and the skybox; `LightSource` is accent. Cast shadows are not guaranteed either, so never make a shadow the only cue for an object's position.
- The **light itself keeps illuminating** at much larger distances — it is only disabled when the player is more than **160 m away (10 parcels)**. This makes LightSource suitable for large-scale setups like stage lighting at live events, where most of the audience is far from the fixtures.
- Lights only render while the player is standing **inside** the scene; outside, they are not rendered.
- **One-minute sanity test before tuning anything:** at the default `intensity: 16000`, place one point light 2.5 m above the floor and one spot at the same height pitched `+90` (straight down), next to an emissive plane as a reference. Point visible, spot dark → aim or preset, not intensity. Neither visible → the preset is Low. Only then tune. The catalog's Point Light / Spotlight Smart Items start at 16000 for a reason.

## SkyboxTime (Day/Night Cycle)

Use SkyboxTime for atmosphere — nighttime scenes with point lights create dramatic environments.

### Fixed Time in scene.json

A permanent time of day needs no code: `skyboxConfig.fixedTime` in `scene.json` (top-level, or inside `worldConfiguration` for a World). Locations, time values and precedence: `{baseDir}/../create-scene/references/scene-json.md` → *Skybox fixed time*. A `SkyboxTime` component on `engine.RootEntity` overrides either JSON value at runtime.

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

## Glow + Light

Emissive materials glow but do not illuminate surrounding entities; a `LightSource` illuminates but has no visible body. Emissive material fields (`emissiveColor` is `Color3`, `emissiveIntensity`, `emissiveTexture`): **advanced-rendering** → *Emissive (Glow Effects)*.

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

## Platform Support

- **Desktop (Unity explorer):** Full support (point lights, spot lights, shadows), capped per quality preset (see Light Limits).
- **Mobile (Godot explorer):** `LightSource` (scene dynamic lights) works from app 1.13.0, budgeted at runtime (see below). Older mobile apps draw no scene lights, so the scene must read without them, as for the zero-light profiles above.
- **Bevy explorer:** Full support (point lights, spot lights, shadows).

### Mobile light budget

Mobile enforces flat scene limits on **authored** lights: **8 soft / 16 hard** light sources, **2 soft / 4 hard** shadow-casting lights. Soft = warning in the mobile performance panel; hard = the scene will not load.

On top of that, each mobile **graphics profile** only activates a budget of the **nearest** light sources — **0 on Very Low, up to 8 on High** — and lower profiles may disable shadows entirely. So:

- Authoring 20 lights still costs the full scene budget even though at most 8 ever emit. Author to 8 rather than leaning on the runtime budget.
- On Very Low **no** scene light is active: keep the no-light baseline from Light Limits.

Full mobile limit table: **optimize-scene** → *Mobile Scene Limits*.

## Gotchas

- Animating a light's direction: put a `Tween`/`TweenSequence` (Rotate mode) on the light entity — the beam follows the entity's forward vector.

## Example scenes

Engine-team test scenes (real API, exercised against the engine):

- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/0,4-dynamic-lights — point & spot LightSource: toggle active, color, range, intensity, spot inner/outer angle at runtime, shadow-mask (gobo) swapping, and tweened light rotation.
- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/2,0-skybox-scene-json — fixed skybox time via top-level `skyboxConfig.fixedTime`; reads it back with `getSceneInformation`.
- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/3,0-skybox-world-json — fixed skybox time via `worldConfiguration.skyboxConfig.fixedTime` (World variant); demonstrates the worldConfiguration-wins precedence.
- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/2,1-skybox-sdk-scene-a and https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/3,1-skybox-sdk-scene-b — runtime `SkyboxTime` on `RootEntity` with `TransitionMode`, plus `deleteFrom` to return to global time.
