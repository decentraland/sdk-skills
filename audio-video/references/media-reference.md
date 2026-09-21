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
  currentTime: 0,                      // Seek position in seconds (default 0). WRITE-ONLY: never reflects the playhead
  global: false,                       // true = non-spatial, same volume everywhere (default false = spatial)
  reportPlaybackPosition: false        // true = renderer reports the playhead in PBAudioEvent (default false, opt-in)
})
```

`reportPlaybackPosition` is the gate for playback-position reports — see **Align Gameplay to Audio** below. Every other field is unaffected by it.

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

### Audio Events (playback state changes, incl. finish detection)

Mirrors `videoEventsSystem`, but for `AudioSource` and `AudioStream` entities. The event's `state` is a `MediaState` enum value (`MS_NONE`, `MS_ERROR`, `MS_LOADING`, `MS_READY`, `MS_PLAYING`, `MS_BUFFERING`, `MS_SEEKING`, `MS_PAUSED`).

**`PBAudioEvent` fields** (protocol [#488](https://github.com/decentraland/protocol/pull/488) added the three optional ones):

| Field | Type | Notes |
|---|---|---|
| `state` | `MediaState` | Current media state. |
| `timestamp` | `number` | Per-entity monotonic report counter. NOT a time. |
| `tickNumber?` | `number` | Playback reports only. Scene tick the position was sampled in; equals `EngineInfo.tickNumber`. |
| `currentOffset?` | `number` | Playback reports only. Clip position in seconds at `tickNumber`. |
| `clipLength?` | `number` | Playback reports only. Total clip length in seconds, when known (`undefined` for streams). |

**`audioEventsSystem` functions** (js-sdk-toolchain [#1624](https://github.com/decentraland/js-sdk-toolchain/pull/1624) added the last three):

| Function | Fires / returns |
|---|---|
| `registerAudioEventsEntity(entity, cb)` | `cb(event)` on media-state changes only. Position-only reports do not trigger it. |
| `removeAudioEventsEntity(entity)` | Unregisters the state callback. |
| `hasAudioEventsEntity(entity): boolean` | Whether a state callback is registered. |
| `getAudioState(entity): PBAudioEvent \| undefined` | Latest report of any kind. |
| `registerAudioPlaybackEntity(entity, cb)` | `cb({ report, sceneTime, offset })` once per scene frame with the newest position report, already resolved against the scene clock at the sampling tick. The renderer writes one whenever the playhead moves, so every render frame while a clip plays. Position-less reports never reach it. Requires `reportPlaybackPosition: true` on the entity's `AudioSource`, or it never runs. |
| `getSceneTimeAtTick(tick): number \| undefined` | Scene clock (s) recorded in that tick. Resolves `PBVideoEvent` reports too. |
| `removeAudioPlaybackEntity(entity)` | Unregisters the playback callback. |
| `getAudioPlayback(entity): PBAudioEvent \| undefined` | Latest report carrying `currentOffset`; `undefined` if the source never opted in or the renderer never reported a position. |

```typescript
import { audioEventsSystem, MediaState } from '@dcl/sdk/ecs'

audioEventsSystem.registerAudioEventsEntity(entity, (event) => {
  // MS_PLAYING -> MS_READY = the sound stopped (natural finish for AudioSource clips)
  // MS_ERROR = the file failed to load
  console.log('audio state:', event.state, 'at', event.timestamp)
})

// needs reportPlaybackPosition: true on the entity's AudioSource (set in the full-fields block above)
audioEventsSystem.registerAudioPlaybackEntity(entity, ({ report, sceneTime, offset }) => {
  // newest report of the frame, already resolved: offset is report.currentOffset in seconds, sceneTime the scene
  // clock at report.tickNumber. report also carries clipLength when known.
})

const latest = audioEventsSystem.getAudioState(entity)     // last reported PBAudioEvent | undefined
const position = audioEventsSystem.getAudioPlayback(entity) // last report with currentOffset | undefined
audioEventsSystem.hasAudioEventsEntity(entity)             // is a state callback registered
audioEventsSystem.removeAudioEventsEntity(entity)          // unregister state callback
audioEventsSystem.removeAudioPlaybackEntity(entity)        // unregister playback callback
```

Both registrations are dropped automatically when the entity is removed or loses its `AudioSource`/`AudioStream`.

For AudioSource clips the engine also flips the component's `playing` field back to `false` on natural finish — pollable with the read-only `AudioSource.get(entity).playing` (see SKILL.md). Requires a DCL 2.0 desktop client with playback-completion support.

### Align Gameplay to Audio (playback-position reports)

**RULE: the source must opt in — set `reportPlaybackPosition: true` on its `AudioSource`.** Position reports are off by default (`musicEntity` below is assumed to have been created with the flag). Without it `registerAudioPlaybackEntity`'s callback never fires and `getAudioPlayback` stays `undefined`, silently — media-state changes still arrive, so `registerAudioEventsEntity` keeps working and hides the omission. Positions are written far more often than state changes and `AudioEvent` is a grow-only set capped at 100 entries per entity, so a scene opts in only where it reads the position.

`AudioSource.currentTime` is a write-only seek (reading it never gives the playhead) and renderers start a clip 100–250 ms after being asked, so the reports are the only source of truth for where the audio is. A report must be compared against the scene clock **at the tick it was sampled in**, not at the moment the callback runs, or the result is off by however long the report spent in transit. `registerAudioPlaybackEntity` does that lookup for you — do not rebuild a per-tick history by hand.

`sceneTime - offset` is the scene clock at which the audible clip effectively started. Keep that origin and every later question ("where is the audio now?") is one subtraction.

```typescript
import { engine, MediaState, audioEventsSystem } from '@dcl/sdk/ecs'

let clockMs = 0
engine.addSystem((dt) => { clockMs += dt * 1000 })

let originMs: number | undefined   // clockMs at which the audible clip started

audioEventsSystem.registerAudioPlaybackEntity(musicEntity, ({ report, sceneTime, offset }) => {
  if (report.state !== MediaState.MS_PLAYING) return
  originMs = sceneTime * 1000 - offset * 1000
})

const audioNowMs = () => (originMs === undefined ? undefined : clockMs - originMs)
```

Accuracy: the report carries the decoder's playhead, not the moment sound leaves the speaker. The mixer buffer, driver and device add tens of milliseconds more, consistently signed and roughly constant per device, and no field carries it. Treat it as a per-session constant to calibrate if you need alignment finer than a tick.

Fallback: a source that never opted in, and renderers without the feature (today everything but the Unity explorer), never set `currentOffset`, so the sample callback never fires and `getAudioPlayback` stays `undefined` — check the flag first, then use a fixed lead (~150 ms) or manual calibration and never hard-block on a report. Needs an `@dcl/sdk` release containing js-sdk-toolchain [#1624](https://github.com/decentraland/js-sdk-toolchain/pull/1624); check the scene's pin first. Rules and gate in SKILL.md.

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
