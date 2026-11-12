# Skybox, Sun and EnvironmentFog

Companion to **lighting-environment** → *Skybox, Sun and EnvironmentFog*. Three components override the environment:

- `Skybox` — sky texture, or procedural sky colors, clouds and stars.
- `Sun` — directional light (sun and moon): color, visibility, intensity, fixed direction.
- `EnvironmentFog` — fog color and density.

```typescript
import { engine, Skybox, Sun, EnvironmentFog, ColorGradient } from '@dcl/sdk/ecs'
import { Color4, Vector3 } from '@dcl/sdk/math'
```

## Scope

- **Clients**: not supported yet on mobile (Godot explorer) or the Bevy explorer; those players keep the regular sky, sun and fog. Never make the overrides gameplay-critical.
- **Root entity only**: write them to `engine.RootEntity`. On any other entity they do nothing.
- Every field is optional; an unset field keeps its time-of-day default.
- **The three are independent.** Any one of them on its own puts the scene in control of that part of the environment; they do not need to be set together, and each resets on its own when deleted.
- Active only while the player is inside the scene. Leaving the scene, `deleteFrom`, or unsetting a field restores the defaults instantly (no fade); re-entering re-applies.
- They never affect other scenes, but while active they are global render state: neighbouring parcels seen from inside the scene render with this sky, sun and fog.

## Color gradients

Every color field is a `ColorGradient` over the normalized time of day: `0` = 00:00, `0.5` = 12:00, `1` = 24:00 (the `SkyboxTime` clock / 86400).

```typescript
// One key = constant color.
const constant = (color: Color4): ColorGradient => ({ keys: [{ time: 0, color }] })

// Multi-key: interpolated between keys, clamped at both ends (no midnight wrap:
// repeat the color at time 0 and 1 to loop seamlessly).
const horizon: ColorGradient = {
  keys: [
    { time: 0, color: Color4.create(0.05, 0.05, 0.2, 1) },
    { time: 0.25, color: Color4.create(0.95, 0.5, 0.4, 1) },
    { time: 0.5, color: Color4.create(0.7, 0.9, 1, 1) },
    { time: 0.75, color: Color4.create(0.95, 0.4, 0.2, 1) },
    { time: 1, color: Color4.create(0.05, 0.05, 0.2, 1) }
  ]
}
```

- Values above 1 are HDR; alpha is ignored.
- A `time` outside `0`–`1` **clamps into range** rather than erroring.
- Two keys with the same `time`: the one **later in `keys`** wins.
- Keep gradients to 8 keys or fewer: the Explorer resamples longer ones to 8 evenly spaced keys.
- Pair with `SkyboxTime` to pin a gradient at one time of day.

Payload types are exported from `@dcl/ecs` (so also `@dcl/sdk/ecs`) — `PBSkybox`, `PBSkybox_SkyColors`, `PBSkybox_Clouds`, `PBSkybox_Stars`, `PBSun`, `PBEnvironmentFog`, `ColorGradient`, `ColorKey`. Import them directly; the `Parameters<typeof Skybox.createOrReplace>[1]` derivation used by the `2,2-skybox-control` test scene is a leftover from before they were exported.

## Skybox: sky texture

```typescript
// Equirectangular 2:1 lat-long image in the scene's assets. Centre faces +Z (north), top row = zenith.
Skybox.create(engine.RootEntity, { skyboxTexture: 'images/sky.png' })
```

- `skyboxTexture` is a plain `string` path (same rules as a texture `src`), not a `TextureUnion`.
- The image must be equirectangular 2:1; a cube cross, 3x2 or six-face layout renders distorted. Sampled with horizontal wrap (Repeat) and bilinear filtering.
- A failed load keeps the default sky.
- Size: 2048x1024 is enough for most skies; 4096x2048 at most. The whole panorama is downloaded and stays in memory while the scene is loaded. Prefer `.jpg` for photographic skies.
- The texture does not change the lighting; on the High quality preset, reflections on shiny materials follow it.
- While it is set, `clouds` and `stars` are ignored and `skyColors` no longer color the sky, but `skyColors` still drive the ambient light (next section): set them to match the image. `Sun` and `EnvironmentFog` still apply.
- The sun's lens flare is screen-space and drawn on top of the texture; `Sun.visible: false` is the only way to remove it.

## Skybox: sky colors, clouds and stars

```typescript
Skybox.createOrReplace(engine.RootEntity, {
  skyColors: {
    zenith: constant(Color4.create(0.55, 0.25, 0.12, 1)),
    horizon: constant(Color4.create(0.95, 0.55, 0.3, 1)),
    nadir: constant(Color4.create(0.35, 0.15, 0.08, 1)),  // sky below the horizon, where no terrain covers it
    rim: constant(Color4.create(1.5, 0.6, 0.2, 1))        // horizon-line glow
  },
  clouds: { opacity: 0.3, speed: 0.01, color: constant(Color4.create(0.9, 0.6, 0.4, 1)) },
  stars: { brightness: 4.62 }
})
```

- `skyColors` are also the ambient light: zenith → sky ambient, horizon → equator ambient, nadir → ground ambient. There is no separate ambient field. Recoloring only the fog or the sun leaves ambient at its default, so set all three for a coherent look.
- `rim` unset → follows the `horizon` override when set, else the default.
- `clouds.opacity` default 1, range 0–1 (0 hides clouds). `clouds.speed` default 0.01 rad/s around the sky axis — one turn every ~10 minutes; `0` = static, **negative reverses the direction**. `clouds.color` unset → default time-of-day cloud tint, even on a recolored sky.
- `stars.brightness` default 4.62, a multiplier on the star texture (1 = as authored, above 1 is HDR). `0` hides them, negative clamps to 0. Stars only render at night.

## Sun

```typescript
Sun.create(engine.RootEntity, {
  color: constant(Color4.create(1, 0.65, 0.4, 1)),  // tints the light and the sun disc
  visible: true,                                    // false hides sun/moon discs + lens flare; light keeps shining
  intensity: 0.5,                                   // multiplier on the time-of-day intensity
  direction: Vector3.create(-1, -1, 0)              // light travels this way => sun in the east, 45° up, fixed all day
})
```

- `visible` default true. `intensity` default 1; negative clamps to 0.
- **`intensity` never touches the lens flare.** `intensity: 0` puts the directional light out while the sun/moon discs and their screen-space lens flare keep drawing at full strength (`0.5` draws the flare unchanged too). Only `visible: false` removes them, so a starry night built on `intensity: 0` alone still shows a moon flare over the sky — set both. Verified in `2,2-skybox-control` → *Starry night (lens flare repro)*, which copies a creator's reported setup.
- **The flare already varies with the time of day**, so pin `SkyboxTime.fixedTime` before judging whether a flare change worked: the default look draws no flare at all around 03:30–06:30 and 18:15–20:45, the moon flare is at 0.6 at 00:00, and the sun flare at 1 at 12:00.
- `direction` is the direction the light travels in scene space (`(0,-1,0)` = overhead; the renderer normalizes it). Set → the sun stays fixed at every time of day, while color and intensity still follow the time of day. Unset or zero → normal path.

## EnvironmentFog

```typescript
EnvironmentFog.create(engine.RootEntity, {
  color: constant(Color4.create(0.85, 0.5, 0.3, 1)),
  density: 0.01  // fog = 1 - e^(-density * distance); 1/density ≈ 63% fog distance
})
```

- `density` default 0.0005 (≈ 2 km); negative clamps to 0. Exponential only: there is no linear start/end range.
- Fog on/off is a player quality setting the scene cannot force.

## Dark but readable

For a night scene players must still read, start from a dim ambient rather than complete darkness: keep all three `skyColors` (the ambient light, see above) around 0.08-0.2 grey-blue and judge from a screenshot with every scene light off; values below about 0.05 read as black (in-world screenshots and owner reports, 2026-11-05; values settled by the owner, 2026-11-06). Expect the owner to retune, and a preview-only slider panel for sky brightness saves round trips.

## Complete darkness

The scene's own `LightSource`s become the only illumination:

```typescript
const black = constant(Color4.Black())
Skybox.createOrReplace(engine.RootEntity, {
  skyColors: { zenith: black, horizon: black, nadir: black },
  clouds: { opacity: 0 },
  stars: { brightness: 0 }
})
Sun.createOrReplace(engine.RootEntity, { intensity: 0, visible: false })
EnvironmentFog.createOrReplace(engine.RootEntity, { color: black })
```

Scene lights do not render on desktop *Low* (**lighting-environment** → *Light Limits*), so a dark scene must stay playable from emissive materials alone. On mobile and Bevy the components are ignored and the scene keeps the regular sky.

## Back to the default sky and lighting

```typescript
Skybox.deleteFrom(engine.RootEntity)
Sun.deleteFrom(engine.RootEntity)
EnvironmentFog.deleteFrom(engine.RootEntity)
```
