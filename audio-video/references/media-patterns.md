# Audio & Video Patterns

## AudioSource

### Basic Setup
```typescript
import { engine, Transform, AudioSource } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

const speaker = engine.addEntity()
Transform.create(speaker, { position: Vector3.create(8, 1, 8) })

AudioSource.create(speaker, {
  audioClipUrl: 'assets/scene/Audio/music.mp3',
  playing: true,
  loop: true,
  volume: 0.5,
  pitch: 1.0,
})
```

### Play/Stop/Toggle
```typescript
// Play
AudioSource.getMutable(speaker).playing = true

// Stop
AudioSource.getMutable(speaker).playing = false

// Toggle
const audio = AudioSource.getMutable(speaker)
audio.playing = !audio.playing
```

### Play on Click
```typescript
import { pointerEventsSystem, InputAction } from '@dcl/sdk/ecs'

const button = engine.addEntity()
// ... set up transform and mesh ...

const audioEntity = engine.addEntity()
Transform.create(audioEntity, { position: Vector3.create(8, 1, 8) })
AudioSource.create(audioEntity, {
  audioClipUrl: 'assets/scene/Audio/click.mp3',
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
    const audio = AudioSource.getMutable(audioEntity)
    audio.playing = false
    audio.playing = true
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

const state = AudioStream.getAudioState(radio)
if (state === MediaState.MS_PLAYING) {
  console.log('Stream is playing')
} else if (state === MediaState.MS_ERROR) {
  console.log('Stream error occurred')
}

// Monitor state changes in a system
let lastState: MediaState | undefined = undefined
engine.addSystem(() => {
  const current = AudioStream.getAudioState(radio)
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
  audioClipUrl: 'assets/scene/Audio/music.mp3',
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
mkdir -p assets/scene/Audio
curl -o assets/scene/Audio/ambient_1.mp3 "https://builder-items.decentraland.org/contents/bafybeic4faewxkdqx67dloyw57ikgaeibc2e2dbx34hwjubl3gfvs2r4su"
```

```typescript
// Reference in code — must be a local file path
AudioSource.create(entity, {
  audioClipUrl: 'assets/scene/Audio/ambient_1.mp3',
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
  }
})
```

---

## Permission for External Media

```json
{
  "requiredPermissions": ["ALLOW_MEDIA_HOSTNAMES"],
  "allowedMediaHostnames": ["stream.example.com", "cdn.example.com"]
}
```
