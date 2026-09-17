# Audio & Video Patterns

## AudioSource

### Basic Setup
```typescript
import { engine, Transform, AudioSource } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

const speaker = engine.addEntity()
Transform.create(speaker, { position: Vector3.create(8, 1, 8) })

AudioSource.create(speaker, {
  audioClipUrl: 'assets/Audio/music.mp3',
  playing: true,
  loop: true,
  volume: 0.5,
  pitch: 1.0,
})
```

### Play/Stop/Toggle
```typescript
// Prefer the helpers — they retrigger reliably and reset the cursor by default.
AudioSource.playSound(speaker, 'assets/Audio/music.mp3') // play from 0
AudioSource.stopSound(speaker)                            // stop, reset to 0

// Toggle
let playing = false
playing = !playing
if (playing) AudioSource.playSound(speaker, 'assets/Audio/music.mp3')
else AudioSource.stopSound(speaker)
```

Simple one-time volume/property tweaks on an already-playing clip are fine via `getMutable` (changing volume/loop/pitch keeps it playing). It's specifically *retriggering* `playing` that should go through `playSound`.

### Play on Click
```typescript
import { pointerEventsSystem, InputAction } from '@dcl/sdk/ecs'

const button = engine.addEntity()
// ... set up transform and mesh ...

const audioEntity = engine.addEntity()
Transform.create(audioEntity, { position: Vector3.create(8, 1, 8) })
AudioSource.create(audioEntity, {
  audioClipUrl: 'assets/Audio/click.mp3',
  playing: false,
  loop: false,
  volume: 0.8,
})

pointerEventsSystem.onPointerDown(
  {
    entity: button,
    opts: { button: InputAction.IA_POINTER, hoverText: 'Play sound' },
  },
  () => {
    // playSound reliably retriggers from 0 on every click (createOrReplace under the hood).
    // Do NOT hand-mutate getMutable().playing for retriggers — LWW-CRDT may dedup repeat clicks.
    AudioSource.playSound(audioEntity, 'assets/Audio/click.mp3')
  }
)
```

### File Organization
```
project/
├── assets/
│   └── scene/
│       └── Audio/
│           ├── click.mp3
│           ├── background-music.mp3
│           └── explosion.ogg
├── src/
│   └── index.ts
└── scene.json
```

---

## AudioStream

### Basic Setup
```typescript
import { engine, Transform, AudioStream } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

const radio = engine.addEntity()
Transform.create(radio, { position: Vector3.create(8, 1, 8) })

AudioStream.create(radio, {
  url: 'https://example.com/stream.mp3',
  playing: true,
  volume: 0.3,
})
```

### State Monitoring
```typescript
import { AudioStream, MediaState } from '@dcl/sdk/ecs'

// getAudioState returns PBAudioEvent | undefined ({ state, timestamp }), not a bare enum
const state = AudioStream.getAudioState(radio)?.state
if (state === MediaState.MS_PLAYING) {
  console.log('Stream is playing')
} else if (state === MediaState.MS_ERROR) {
  console.log('Stream error occurred')
}

// Monitor state changes in a system
let lastState: MediaState | undefined = undefined
engine.addSystem(() => {
  const current = AudioStream.getAudioState(radio)?.state
  if (lastState !== current) {
    console.log('Stream state changed:', current)
    lastState = current
  }
})
```

---

## VideoPlayer

### Basic Setup
```typescript
import { engine, Transform, VideoPlayer, Material, MeshRenderer } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

const screen = engine.addEntity()
Transform.create(screen, {
  position: Vector3.create(8, 3, 15.9),
  scale: Vector3.create(8, 4.5, 1), // 16:9 ratio
})
MeshRenderer.setPlane(screen)

VideoPlayer.create(screen, {
  src: 'https://example.com/video.mp4',
  playing: true,
  loop: true,
  volume: 0.5,
  playbackRate: 1.0,
  position: 0,
})

const videoTexture = Material.Texture.Video({ videoPlayerEntity: screen })

// Basic material (recommended — better performance)
Material.setBasicMaterial(screen, { texture: videoTexture })
```

### Video Controls
```typescript
VideoPlayer.getMutable(screen).playing = true    // Play
VideoPlayer.getMutable(screen).playing = false   // Pause
VideoPlayer.getMutable(screen).volume = 0.8      // Change volume
VideoPlayer.getMutable(screen).src = 'https://example.com/other.mp4'  // Change source
```

### Enhanced Video Material (PBR)

For a brighter, emissive video screen:

```typescript
import { Color3 } from '@dcl/sdk/math'

const videoTexture = Material.Texture.Video({ videoPlayerEntity: screen })
Material.setPbrMaterial(screen, {
  texture: videoTexture,
  roughness: 1.0,
  specularIntensity: 0,
  metallic: 0,
  emissiveTexture: videoTexture,
  emissiveIntensity: 0.6,
  emissiveColor: Color3.White(),
})
```

### Video Events
```typescript
import { videoEventsSystem, VideoState } from '@dcl/sdk/ecs'

videoEventsSystem.registerVideoEventsEntity(screen, (videoEvent) => {
  switch (videoEvent.state) {
    case VideoState.VS_PLAYING:
      console.log('Video started playing')
      break
    case VideoState.VS_PAUSED:
      console.log('Video paused')
      break
    case VideoState.VS_READY:
      console.log('Video ready to play')
      break
    case VideoState.VS_ERROR:
      console.log('Video error occurred')
      break
  }
})
```

### Video State Polling
```typescript
engine.addSystem(() => {
  const state = videoEventsSystem.getVideoState(videoEntity)
  if (state) {
    console.log('Video state:', state.state)
    console.log('Current time:', state.currentOffset)
  }
})
```

### Multiple Video Surfaces

Share one VideoPlayer across multiple screens:

```typescript
Material.setPbrMaterial(screen1, {
  texture: Material.Texture.Video({ videoPlayerEntity: videoEntity }),
})
Material.setPbrMaterial(screen2, {
  texture: Material.Texture.Video({ videoPlayerEntity: videoEntity }),
})
```

### Video on glTF Model

Use `GltfNodeModifiers` to swap the material of a GLTF model for a video texture:

```typescript
VideoPlayer.create(myEntity, {
  src: 'https://player.vimeo.com/external/552481870.m3u8?s=c312c8533f97e808fccc92b0510b085c8122a875',
  playing: true,
})

GltfNodeModifiers.create(myEntity, {
  modifiers: [
    {
      path: '',
      material: {
        material: {
          $case: 'pbr',
          pbr: {
            texture: Material.Texture.Video({
              videoPlayerEntity: myEntity,
            }),
          },
        },
      },
    },
  ],
})
```

---

## Spatial Audio

### Global (Non-Spatial) AudioSource
```typescript
AudioSource.create(sourceEntity, {
  audioClipUrl: 'assets/Audio/music.mp3',
  playing: true,
  global: true,
})
```

### Spatial VideoPlayer and AudioStream

VideoPlayer and AudioStream are global by default. Make them spatial with min/max distances:

```typescript
VideoPlayer.create(videoPlayerEntity, {
  src: 'https://example.com/video.mp4',
  playing: true,
  spatial: true,
  spatialMinDistance: 5,
  spatialMaxDistance: 10,
})

AudioStream.create(audioStreamEntity, {
  url: 'https://radioislanegra.org/listen/up/stream',
  playing: true,
  volume: 1.0,
  spatial: true,
  spatialMinDistance: 5,
  spatialMaxDistance: 10,
})
```

---

## Free Audio Files Usage

```bash
# Download from catalog
mkdir -p assets/Audio
curl -o assets/Audio/ambient_1.mp3 "https://builder-items.decentraland.org/contents/bafybeic4faewxkdqx67dloyw57ikgaeibc2e2dbx34hwjubl3gfvs2r4su"
```

```typescript
// Reference in code — must be a local file path
AudioSource.create(entity, {
  audioClipUrl: 'assets/Audio/ambient_1.mp3',
  playing: true,
  loop: true,
})
```

---

## Audio Playback Events

```typescript
import { AudioEvent } from '@dcl/sdk/ecs'

engine.addSystem(() => {
  const event = AudioEvent.getOrNull(audioEntity)
  if (event) {
    console.log('Audio state:', event.state)
    // Playback reports (Unity explorer, while playing) also carry:
    // event.tickNumber, event.currentOffset (s), event.clipLength (s, when known)
  }
})
```

---

## Align Gameplay to Audio (playback-position reports)

`AudioSource.currentTime` is write-only (a seek, never the playhead) and the renderer starts a clip 100–250 ms after `playing: true`. To know where the music actually is, consume the renderer's playback-position reports and correlate them by `tickNumber` — never by the time the report is processed.

```typescript
import { engine, EngineInfo, MediaState, audioEventsSystem, AudioSource } from '@dcl/sdk/ecs'

const music = engine.addEntity()
AudioSource.create(music, { audioClipUrl: 'assets/Audio/track.mp3', playing: true, global: true })

// 1. Scene clock remembered per tick — the renderer reports "position X at tick N" a few frames late
const clockAtTick = new Map<number, number>()
let clockMs = 0
engine.addSystem((dt) => {
  clockMs += dt * 1000
  const tick = EngineInfo.getOrNull(engine.RootEntity)?.tickNumber
  if (tick === undefined) return
  clockAtTick.set(tick, clockMs)
  clockAtTick.delete(tick - 120)
})

// 2. Lag between the scene clock and the audio actually heard, refreshed on every report
let lagMs: number | undefined
audioEventsSystem.registerAudioPlaybackEntity(music, (report) => {
  if (report.state !== MediaState.MS_PLAYING) return
  if (report.tickNumber === undefined || report.currentOffset === undefined) return
  const sampledAt = clockAtTick.get(report.tickNumber)
  if (sampledAt === undefined) return
  lagMs = sampledAt - report.currentOffset * 1000
})

// 3. Gameplay reads the audio position, with a fixed-lead fallback for renderers that never report
const FALLBACK_LEAD_MS = 150
const startedAtMs = clockMs
function audioPositionMs(): number {
  return lagMs !== undefined ? clockMs - lagMs : clockMs - startedAtMs - FALLBACK_LEAD_MS
}

// e.g. fire a cue on every beat of a 120 BPM track
const BEAT_MS = 500
let nextBeatMs = 0
engine.addSystem(() => {
  const pos = audioPositionMs()
  if (pos >= nextBeatMs) {
    nextBeatMs = Math.floor(pos / BEAT_MS) * BEAT_MS + BEAT_MS
    // trigger the beat visual here
  }
})
```

Notes:
- `registerAudioEventsEntity` does not run on position-only reports — use `registerAudioPlaybackEntity` (callback) or `audioEventsSystem.getAudioPlayback(music)` (poll) for positions.
- The Unity explorer reports every 15 ticks (about twice a second) while playing. Other renderers leave `currentOffset` undefined, so `lagMs` stays `undefined` and the fallback branch runs — keep it.
- Needs an `@dcl/sdk` release containing js-sdk-toolchain [#1624](https://github.com/decentraland/js-sdk-toolchain/pull/1624); check the scene's `@dcl/sdk` pin before emitting these calls.

---

## Permission for External Media

`[LEGACY]` Not required — no current client enforces `ALLOW_MEDIA_HOSTNAMES`. For legacy scenes that still declare it:

```json
{
  "requiredPermissions": ["ALLOW_MEDIA_HOSTNAMES"],
  "allowedMediaHostnames": ["stream.example.com", "cdn.example.com"]
}
```
