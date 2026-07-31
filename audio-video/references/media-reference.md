# Media Components Reference

## AudioSource — Full Fields

```typescript
import { AudioSource } from '@dcl/sdk/ecs'

AudioSource.create(entity, {
  audioClipUrl: 'sounds/effect.mp3',  // Path to local audio file (required)
  playing: false,                      // Start/stop playback
  loop: false,                         // Loop when finished
  volume: 1.0,                         // Volume 0.0 to 1.0 (default 1.0)
  pitch: 1.0,                          // Playback speed (0.5 = half, 2.0 = double, default 1.0)
  currentTime: 0,                      // Playback position in seconds (default 0)
  global: false                        // true = non-spatial, same volume everywhere (default false = spatial)
})
```

**Supported formats:** `.mp3` (recommended), `.ogg`, `.wav`

Audio is spatial by default — volume decreases with distance from the entity. Place the entity where the sound should originate.

### Playback Control

```typescript
const audio = AudioSource.getMutable(entity)
audio.playing = true   // Play
audio.playing = false  // Stop
audio.volume = 0.5     // Adjust volume
audio.pitch = 1.5      // Speed up
```

### Retrigger / Replay (use the helpers)

Use `playSound` / `stopSound` to reliably retrigger. They write the whole component, so identical-parameter clicks still re-emit — hand-mutating `getMutable().playing` can be silently deduped by the LWW-CRDT when values are unchanged, so repeat clicks may do nothing.

```typescript
// Signatures (both return false if the entity has no AudioSource):
//   AudioSource.playSound(entity, src: string, resetCursor = true): boolean
//   AudioSource.stopSound(entity, resetCursor = true): boolean

AudioSource.playSound(entity, 'sounds/effect.mp3')        // play from 0 every call
AudioSource.playSound(entity, 'sounds/effect.mp3', false) // resume from currentTime
AudioSource.stopSound(entity)                             // stop, reset cursor to 0
AudioSource.stopSound(entity, false)                      // stop, keep cursor position
```

`playSound` sets `audioClipUrl = src`, `playing = true`, and (when `resetCursor`) `currentTime = 0`. Equivalent low-level pattern if you need full control: `AudioSource.createOrReplace(entity, { audioClipUrl, playing: true })` — always emits a CRDT PUT.

**Retrigger semantics** (from the protocol): setting `playing = true` while already playing with `currentTime` unset keeps the current position; if the clip was stopped, or `currentTime` is set, it plays from `currentTime` (or the beginning). Changing `audioClipUrl` while playing stops the current clip and plays the new one as a fresh instance.

Do NOT do this for retriggers — it works on the first click but may be swallowed afterward:
```typescript
const audio = AudioSource.getMutable(entity)
audio.playing = true
audio.currentTime = 0   // if playing/currentTime already had these values, LWW may dedup the PUT
```

## AudioStream — Full Fields

```typescript
import { AudioStream } from '@dcl/sdk/ecs'

AudioStream.create(entity, {
  url: 'https://stream.example.com/radio.mp3',  // Streaming URL (required)
  playing: true,                                   // Start/stop stream
  volume: 0.5                                      // Volume 0.0 to 1.0
})
```

**Supported stream formats:** HTTP/HTTPS audio streams (`.mp3`, `.ogg`, `.aac`)

AudioStream is NOT spatial — it plays at the same volume regardless of player distance. Best for background music or radio.

## VideoPlayer — Full Fields

```typescript
import { VideoPlayer } from '@dcl/sdk/ecs'

VideoPlayer.create(entity, {
  src: 'videos/clip.mp4',    // Local file or external URL (required)
  playing: true,              // Start/stop playback
  loop: false,                // Loop when finished
  volume: 1.0,                // Volume 0.0 to 1.0
  playbackRate: 1.0,          // Playback speed
  position: 0                 // Start time in seconds
})
```

**Supported formats:**
- `.mp4` (H.264) — most compatible
- `.webm` — good quality, smaller files
- `.ogg` — open format
- `.m3u8` (HLS) — live streaming, most reliable for streams

### Video Texture Setup

VideoPlayer alone doesn't display video. You must create a video texture and apply it to a mesh:

```typescript
// 1. Create mesh surface
MeshRenderer.setPlane(entity)

// 2. Create video texture referencing the VideoPlayer entity
const videoTexture = Material.Texture.Video({ videoPlayerEntity: entity })

// 3. Apply as basic material (best performance)
Material.setBasicMaterial(entity, { texture: videoTexture })

// OR as PBR material with emissive (self-lit screen)
Material.setPbrMaterial(entity, {
  texture: videoTexture,
  roughness: 1.0,
  specularIntensity: 0,
  metallic: 0,
  emissiveTexture: videoTexture,
  emissiveIntensity: 0.6,
  emissiveColor: Color3.White()
})
```

### Live Streaming

```typescript
// HLS stream
VideoPlayer.create(entity, {
  src: 'https://example.com/stream.m3u8',
  playing: true
})

// LiveKit video stream
VideoPlayer.create(entity, {
  src: 'livekit-video://current-stream',
  playing: true
})
```

### Video Events

```typescript
import { videoEventsSystem, VideoState } from '@dcl/sdk/ecs'

videoEventsSystem.registerVideoEventsEntity(entity, (event) => {
  console.log('State:', event.state)          // VideoState enum
  console.log('Time:', event.currentOffset)   // Current playback time
  console.log('Length:', event.videoLength)    // Total duration
})

// Poll current state
const state = videoEventsSystem.getVideoState(entity)
```

**VideoState values:** `VS_READY`, `VS_PLAYING`, `VS_PAUSED`, `VS_ERROR`, `VS_BUFFERING`, `VS_SEEKING`, `VS_NONE`

### Multiple Screens, One Video

```typescript
// One VideoPlayer, shared across screens
VideoPlayer.create(screen1, { src: 'videos/shared.mp4', playing: true })
const tex = Material.Texture.Video({ videoPlayerEntity: screen1 })
Material.setBasicMaterial(screen1, { texture: tex })
Material.setBasicMaterial(screen2, { texture: tex })
```

### Video Limits

| Quality Setting | Max Simultaneous Videos |
|----------------|------------------------|
| Low | 1 |
| Medium | 5 |
| High | 10 |

### Media Permissions in scene.json

`[LEGACY]` External audio/video URLs do **not** require any permission on current clients — no current client enforces `ALLOW_MEDIA_HOSTNAMES` (unity-explorer gates it behind the unset `CHECK_ALLOWED_MEDIA_HOSTNAMES` compile define; bevy-explorer has no enforcement). Only the retired web client enforced it. For legacy scenes that still declare it, the syntax is:

```json
{
  "requiredPermissions": ["ALLOW_MEDIA_HOSTNAMES"],
  "allowedMediaHostnames": ["stream.example.com", "cdn.example.com"]
}
```

## AudioAnalysis (Advanced)

Real-time amplitude + 8-band frequency data from any `AudioSource`, `AudioStream`, or `VideoPlayer`. Used for music visualizers, reactive environments, and beat-synced animations. **Unity explorer only.**

```typescript
import { AudioAnalysis, AudioAnalysisView } from '@dcl/sdk/ecs'

// Enable on an entity that already has AudioSource / AudioStream / VideoPlayer
AudioAnalysis.createAudioAnalysis(audioEntity)

// Pre-allocate the view ONCE; reuse every frame
const view: AudioAnalysisView = { amplitude: 0, bands: new Array<number>(8) }

engine.addSystem(() => {
  AudioAnalysis.readIntoView(audioEntity, view)
  // view.amplitude (number) and view.bands[0..7] are now populated
})
```

For full coverage (modes, gains, gotchas, and a complete visualizer example) see the dedicated `audio-analysis` skill.
