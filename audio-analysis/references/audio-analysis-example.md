# AudioAnalysis — Music Visualizer Example

Full reference scene from the merged `sdk7-goerli-plaza/audio-visualization` example. Plays a music track, drives a pulsing sphere from `amplitude`, and an 8-bar equalizer from `bands[0..7]`.

## File layout

```
src/
  components.ts   — custom tag components (VisualAmplitude, VisualBar)
  factory.ts      — entity factories for the visual elements
  index.ts        — main(): wires audio + analysis + reactive systems
assets/scene/Audio/
  Vexento.mp3     — source audio file
```

## src/components.ts

```typescript
import { Schemas, engine } from '@dcl/sdk/ecs'

export const VisualAmplitude = engine.defineComponent('amplitude', {})
export const VisualBar = engine.defineComponent('bar', { index: Schemas.Number })
```

`VisualAmplitude` is a tag (no fields) that marks the sphere reacting to overall amplitude. `VisualBar` carries a band index (0..7) so each bar knows which band to read.

## src/factory.ts

```typescript
import {
  Entity,
  engine,
  Transform,
  MeshRenderer,
  Material,
} from '@dcl/sdk/ecs'
import { Color4 } from '@dcl/sdk/math'
import { VisualAmplitude, VisualBar } from './components'

export function createVisualBar(x: number, y: number, z: number, index: number): Entity {
  const entity = engine.addEntity()
  VisualBar.create(entity, { index })
  Transform.create(entity, { position: { x, y, z } })
  MeshRenderer.setBox(entity)
  Material.setPbrMaterial(entity, { albedoColor: Color4.Yellow() })
  return entity
}

export function createVisualAmplitude(x: number, y: number, z: number): Entity {
  const entity = engine.addEntity()
  VisualAmplitude.create(entity)
  Transform.create(entity, { position: { x, y, z } })
  MeshRenderer.setSphere(entity)
  Material.setPbrMaterial(entity, { albedoColor: Color4.Purple() })
  return entity
}
```

## src/index.ts

```typescript
import {
  PBAudioAnalysisMode,
  AudioAnalysis,
  AudioSource,
  engine,
  Transform,
  AudioAnalysisView,
} from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'
import { VisualAmplitude, VisualBar } from './components'
import { createVisualBar, createVisualAmplitude } from './factory'

const BANDS = 8
const BARS_HEIGHT = 12
const AMPLITUDE_VISUAL_BASE = 1
const AMPLITUDE_VISUAL_SCALE = 10

export function main() {
  // Pre-allocate the view once — reused every frame
  const currentAnalysis: AudioAnalysisView = {
    amplitude: 0,
    bands: new Array<number>(BANDS),
  }

  // Audio source + analysis on the SAME entity
  const audioEntity = engine.addEntity()
  AudioSource.create(audioEntity, {
    audioClipUrl: 'assets/scene/Audio/Vexento.mp3',
    playing: true,
    loop: true,
  })
  AudioAnalysis.createAudioAnalysis(audioEntity) // defaults: MODE_LOGARITHMIC, gain 5.0/0.05
  Transform.create(audioEntity)

  // Spawn 8 equalizer bars
  const half = BANDS / 2
  for (let i = 0; i < BANDS; i++) {
    createVisualBar(0, 0, i + half, i)
  }

  // Spawn the amplitude sphere
  createVisualAmplitude(5, 1, 5)

  // System 1 — pull latest analysis values into the shared view ONCE per frame
  engine.addSystem(() => {
    AudioAnalysis.readIntoView(audioEntity, currentAnalysis)
  })

  // System 2 — drive each bar's Y scale from its band
  engine.addSystem(() => {
    for (const [entity, _bar, _t] of engine.getEntitiesWith(VisualBar, Transform)) {
      const index = VisualBar.get(entity).index
      const t = Transform.getMutable(entity)
      const next = Vector3.One()
      next.y = currentAnalysis.bands[index] * BARS_HEIGHT
      t.scale = next
    }
  })

  // System 3 — drive sphere uniform scale from overall amplitude
  engine.addSystem(() => {
    for (const [entity, _amp, _t] of engine.getEntitiesWith(VisualAmplitude, Transform)) {
      const t = Transform.getMutable(entity)
      const v = AMPLITUDE_VISUAL_BASE + currentAnalysis.amplitude * AMPLITUDE_VISUAL_SCALE
      t.scale = Vector3.create(v, v, v)
    }
  })
}
```

## Why the systems are split

System 1 reads the analysis into the shared `currentAnalysis` view.
Systems 2 and 3 are pure consumers — they read from the view but never call `readIntoView` themselves.

This is the canonical pattern: **one read-into-view system per analyzed entity per frame, N consumer systems**. It avoids duplicate component reads when many systems react to the same audio source.

## Variations

- **Tint instead of scale** — replace `Material.setPbrMaterial` calls in consumer systems with a per-frame mutation: `Material.getMutable(entity).material.pbr.albedoColor = Color4.create(amp, 0, 1 - amp, 1)`. Be aware mutating Material every frame is expensive — prefer scale/position changes.
- **Light reactivity** — drive `LightSource.intensity` from `view.amplitude * peakIntensity`.
- **Particle reactivity** — drive `ParticleSystem.rate` from a band, e.g. `ParticleSystem.getMutable(fx).rate = 10 + view.bands[0] * 100` for bass-driven sparks.
- **VideoPlayer source** — swap `AudioSource.create(...)` for `VideoPlayer.create(...)` on the same entity; analysis still works because the renderer's MediaPlayerComponent exposes the same audio frame buffer.
- **Smoothing** — bands jitter frame-to-frame. Lerp toward the new value: `smoothed[i] += (raw[i] - smoothed[i]) * 0.2 * dt * 60` for a noticeably calmer animation.

## Source

Adapted from the merged example at `decentraland/sdk7-goerli-plaza/audio-visualization` ([PR #273](https://github.com/decentraland/sdk7-goerli-plaza/pull/273)).
