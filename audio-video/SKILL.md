---
name: audio-video
description: Sound and video in Decentraland scenes with AudioSource, AudioStream and VideoPlayer. Use when the user wants sound effects (including UI click sounds), music, ambience, radio, live streams or video screens, or needs audio clips sourced. For emotes see player-avatar; for audio-reactive visuals see audio-analysis.
---

# Audio and Video in Decentraland

## When to Use Which Media Component

| Need                                                  | Component                                | Key Difference                           |
| ----------------------------------------------------- | ---------------------------------------- | ---------------------------------------- |
| Sound effect from a file (click, explosion, footstep) | `AudioSource`                            | Local file, spatial, one-shot or looping |
| Background music or radio stream                      | `AudioStream`                            | External URL, non-spatial, continuous    |
| Video on a surface (screen, billboard)                | `VideoPlayer` + `Material.Texture.Video` | Requires a mesh to display on            |

**Decision flow:**

1. Is it a local audio file? → `AudioSource`
2. Is it a streaming URL (radio, live audio)? → `AudioStream`
3. Is it video content? → `VideoPlayer` on a plane/mesh

## Audio Sourcing

Before referencing any audio file path in code, check `{baseDir}/references/audio-catalog.md`: 50 free Decentraland clips with direct download URLs covering most needs (UI clicks, ambients, music, game mechanics, sound effects). Search it before suggesting external sources.

1. If the catalog has fitting clips, suggest them to the user — name the clip and what it would be used for.
2. **Ask** how they want to proceed: some creators want catalog clips downloaded, others prefer placeholder paths so they can drop in their own files.
3. Catalog clips, once the user confirms: download with any HTTP download, e.g. `curl -o assets/Audio/<name>.mp3 "<URL>"`. Do not tell the user you cannot download audio: `curl` works on the catalog URLs.
4. Placeholders: use a clear path (e.g. `assets/Audio/<name>.mp3`) and tell the user which files to drop in where.
5. Reference the resulting local path in `AudioSource.audioClipUrl`.

Catalog lacks the sound (e.g. environmental machinery: drips, motors, fans, hum)? Source real recordings: `{baseDir}/references/audio-catalog.md` → *Beyond the catalog*.

Folder: default `assets/Audio/`; reuse an existing legacy (`assets/scene/Audio/`) or asset-pack folder if the scene has one rather than creating a parallel `assets/Audio/` (**create-scene** step 3). Reference Creator Hub asset paths (`assets/asset-packs/`, `assets/custom/`) as-is.

## AudioSource (Sound Effects & Music)

Attach to any entity for positional sound. Fields: `audioClipUrl: string` (local file path, required), `playing?: boolean`, `loop?: boolean`, `volume?: number` (default 1.0), `pitch?: number` (playback speed, default 1.0), `currentTime?: number` (playback position in seconds, default 0), `global?: boolean`. `audioClipUrl` must be a **local file** in the scene (download external clips into `assets/Audio/` first). Supported formats: `.mp3` (recommended for music), `.ogg` (recommended for sound effects, smaller), `.wav`. Keep audio files small — large files increase scene load time. A 16-bit `.wav` is several times the size of the same clip as MP3/OGG — convert before dropping it in (`ffmpeg -i in.wav -b:a 128k out.mp3`).

Audio is **spatial by default** — volume decreases with distance from the entity. Set `global: true` for non-spatial (same volume everywhere).

**Every `AudioSource` entity needs a `Transform` — including `global: true` ones.** The Unity Explorer creates the Unity audio source only for entities that carry a `TransformComponent` (`UpdateAudioSourceSystem.CreateAudioSource` query, unity-explorer main 2026-10). Without one the SDK, the build and the headless engine all accept the component, but nothing ever plays and no error is logged. `global` changes spatialization, not this prerequisite. Create `Transform.create(entity)` (any position) before `AudioSource.create` — a silent wind bed and, later, a silent voice cue in the same project were both this (2026-10). Listed as a validation rule in `{baseDir}/../create-scene/references/entity-validation-rules.md`.

**Spatial falloff is very wide — `global: false` is not "only in this room".** `PBAudioSource` has no distance fields at all, and the Explorer sets only `spatialize`/`spatialBlend`/`dopplerLevel` on the pooled Unity `AudioSource`, leaving its distance curve at Unity's defaults (logarithmic, `minDistance` 1 m, `maxDistance` 500 m) — verified in unity-explorer `AudioSourceExtensions.FromPBAudioSourceWithClip` + `AudioSourcesPlugin` and in `audio_source.gen.d.ts` (7.30.1). Several quiet room ambiences therefore all bleed into every room and read as "the sounds play everywhere" (owner-reported symptom, 2026-10-10).

For a bed that must stay inside one room, gate it yourself in a system on distance from the player: set `playing: false` and `volume: 0` beyond a radius and ramp the volume up inside it. The right radius depends on the room size, the clip and its `volume` — tune it in-world. Throttle the system and write only on change. *Fix verified in code only — not re-listened in-world.*

**Retriggering (play a sound again on every click):** use the helper `AudioSource.playSound(entity, clipUrl, resetCursor?)` — do NOT hand-mutate `getMutable().playing`. `playSound` writes a full component (via `createOrReplace`/`getMutableOrNull`), so it reliably re-emits even with identical params. Hand-setting `getMutable(entity).playing = true` (or the old "playing=false then playing=true" trick) can be silently swallowed by LWW-CRDT dedup when the values are unchanged — the second and later triggers may do nothing. `stopSound(entity, resetCursor?)` stops it. `resetCursor` defaults to `true` on both (start/stop at 0); pass `false` to resume/pause at the current `currentTime`.

```typescript
AudioSource.playSound(entity, 'assets/Audio/click.mp3') // retriggers from 0 every call
AudioSource.stopSound(entity)                            // stops, resets cursor to 0
```

`playSound` creates the `AudioSource` if the entity has none and always returns `true`; it spreads the existing fields, so `volume`/`pitch`/`global`/`loop` set earlier carry over. `stopSound` returns `false` when there is no `AudioSource` (verified in `@dcl/ecs` 7.31.0 `components/extended/AudioSource`).

**Vary pitch on repeated one-shots.** The same clip retriggered identically (footsteps, hits, coin pickups, clicks) sounds mechanical. Randomize `pitch` by about ±5–7% per play. `pitch` is `PBAudioSource` field 4 (`optional float`, default `1.0`); the Unity Explorer copies it straight onto Unity's `AudioSource.pitch` (`AudioSourceExtensions.cs`), so it shifts speed and tone together — keep the spread small. The Explorer does the same for its own UI and avatar sounds (`AudioPlaybackUtilities.GetPitchWithVariation`).

```typescript
// entity already has an AudioSource (getMutable throws otherwise)
function playVaried(entity: Entity, clip: string, spread = 0.06) {
  AudioSource.getMutable(entity).pitch = 1 + (Math.random() * 2 - 1) * spread // 0.94–1.06
  AudioSource.playSound(entity, clip) // keeps the pitch just set, restarts from 0
}
```

Skip it for music, voice lines and UI cues whose exact note matters.

**One `AudioSource` plays one clip at a time.** `playSound` on an entity that is already playing replaces that clip (the retrigger test scene's URL-swap case), so cues that can overlap — a click, a verdict sting, a death sound — each need their own entity, and positional repeats that can stack (several tiles clicked in a row) need a small pool of entities used round-robin. Also check each clip's length against the moment it plays in (`ffprobe -v quiet -show_entries format=duration -of csv=p=0 file.mp3`): a 10 s sting over a 2 s gameplay beat is either cut off by the next cue or spills past it (owner-reported, 2026-10).

**There is no fade or crossfade API.** `PBAudioSource` has `volume` and nothing else for levels, so ducking is a system that eases `AudioSource.getMutable(entity).volume` toward a target per frame (write only while the value is changing). To duck music and bring it back mid-track, keep it `playing: true` at volume 0 — or pause with `stopSound(entity, false)` and resume with `playSound(entity, url, false)`, since the default `resetCursor` would restart the track.

**Detecting when a sound finishes:** when a non-looping clip ends on its own, the engine flips `AudioSource.playing` back to `false`. Poll it with the READ-ONLY getter and edge-detect the `true → false` transition — never poll with `getMutable` (dirties the component every frame):

```typescript
let wasPlaying = false
engine.addSystem(() => {
	const isPlaying = AudioSource.get(entity).playing ?? false
	if (wasPlaying && !isPlaying) console.log('sound finished') // chain next sound/action here
	wasPlaying = isPlaying
})
```

The engine only flips the flag on natural completion — a scene-initiated `stopSound()` is your own write, and looping clips never flip it. Alternatively use `audioEventsSystem` for a callback per `MediaState` change (`MS_PLAYING → MS_READY` = stopped, `MS_ERROR` = file failed to load) — see the Audio Events System section below. Treat both as notifications rather than guarantees — don't build logic that hard-blocks on them without a timeout fallback. On mobile, `AudioEvent` needs app 1.14.0+; older mobile apps emit no audio events (the timeout fallback covers that case) and mix volume and spatial attenuation audibly differently from desktop.

Players must interact with the scene (click) before audio can play (browser autoplay policy). If an audio file needs to be ready to play the instant the player interacts, use the `AssetLoad` component to pre-load the asset.

A sound started at scene startup plays **behind the Explorer's loading screen**, and full-screen Explorer UI (map, backpack) hides the scene the same way. Gate intro audio on `EngineInfo.sceneHidden` flipping to `false`, and pause audio while it is `true`: **scene-runtime**.

## AudioStream (Streaming)

Stream audio from a URL (radio, live streams). If the user did not supply the URL, confirm the source with them before adding one. Key fields: `url` (streaming URL), `playing`, `volume`. Non-spatial by default — plays at same volume everywhere. Set `spatial: true` with `spatialMinDistance`/`spatialMaxDistance` for distance-based volume.

Query state with `AudioStream.getAudioState(entity)` which returns a `PBAudioEvent | undefined` — an object with a `state` field (a `MediaState` enum: `MS_PLAYING`, `MS_ERROR`, etc.) and a `timestamp` field, not a bare enum. Read the state as `AudioStream.getAudioState(entity)?.state`. For callback-style state changes instead of polling, `audioEventsSystem.registerAudioEventsEntity` works on AudioStream entities too (see the AudioSource finish-detection note above).

## Audio Events System (audioEventsSystem)

Monitor `AudioSource` and `AudioStream` media state changes. Import from `@dcl/sdk/ecs`. The system fires a callback only when the state changes (not every frame).

```typescript
import { engine, audioEventsSystem, AudioSource } from '@dcl/sdk/ecs'

const radioEntity = engine.addEntity()
AudioSource.create(radioEntity, { audioClipUrl: 'assets/Audio/music.mp3', playing: true })

audioEventsSystem.registerAudioEventsEntity(radioEntity, (event) => {
  // event is PBAudioEvent: { state: MediaState, timestamp: number }
  console.log('Audio state changed:', event.state)
})
```

**API:**
- `audioEventsSystem.registerAudioEventsEntity(entity, callback)` -- registers a callback for audio state changes. The callback receives a `PBAudioEvent` with `state` (a `MediaState` enum) and `timestamp`. Fires only when state changes.
- `audioEventsSystem.removeAudioEventsEntity(entity)` -- unregisters the callback.
- `audioEventsSystem.hasAudioEventsEntity(entity)` -- returns `boolean`.
- `audioEventsSystem.getAudioState(entity)` -- returns `PBAudioEvent | undefined` (the latest state).

**MediaState values:** `MS_LOADING`, `MS_READY`, `MS_PLAYING`, `MS_PAUSED`, `MS_STOPPED`, `MS_ERROR`, `MS_SEEKING`, `MS_BUFFERING`, `MS_NONE`.

The entity is auto-unregistered if it is removed or no longer has an `AudioSource`/`AudioStream` component. Works on entities with either `AudioSource` or `AudioStream` (the renderer adds the underlying `AudioEvent` component to any entity with those components).

**Relationship to `AudioStream.getAudioState`:** `AudioStream.getAudioState` is a convenience wrapper on the `AudioStream` component itself; `audioEventsSystem.getAudioState` reads the underlying `AudioEvent` component and works for both `AudioSource` and `AudioStream`. Use `audioEventsSystem` when you need callback-driven state monitoring or when working with `AudioSource`.

## VideoPlayer

Play video on a surface. Key fields: `src` (URL or local path), `playing`, `loop`, `volume`, `playbackRate`, `position` (start time in seconds). Non-spatial by default — set `spatial: true` with min/max distances for positional audio.

**Setup requires 3 steps**: create entity with `MeshRenderer.setPlane()`, add `VideoPlayer`, create `Material.Texture.Video({ videoPlayerEntity })` and apply to material. Use `Material.setBasicMaterial` (recommended, better performance) or `Material.setPbrMaterial` with emissive for a brighter screen.

Monitor playback with `videoEventsSystem`:
- `videoEventsSystem.registerVideoEventsEntity(entity, callback)` — callback receives `PBVideoEvent` on each state change.
- `videoEventsSystem.removeVideoEventsEntity(entity)` — unregisters the callback.
- `videoEventsSystem.hasVideoEventsEntity(entity): boolean` — check if an entity is registered.
- `videoEventsSystem.getVideoState(entity): PBVideoEvent | undefined` — poll the latest state without a callback.

States: `VS_READY`, `VS_PLAYING`, `VS_PAUSED`, `VS_ERROR`, `VS_BUFFERING`.

**Re-registration preserves last-reported state:** calling `registerVideoEventsEntity` on an already-registered entity replaces the callback but retains the last-reported state, so the new callback does not replay an already-reported state change. The same holds for `assetLoadLoadingStateSystem.registerAssetLoadLoadingStateEntity`: re-registering keeps the count of already-reported events, so callbacks are not duplicated.

Share one VideoPlayer across multiple screens by referencing the same `videoPlayerEntity` in multiple `Material.Texture.Video()` calls.

To play video on a non-primitive shape (curved screens), use `GltfNodeModifiers` to swap the material of a GLTF model.

## Scene open in the Creator Hub

Dragging an audio or `.mp4` file from **Local Assets** onto the viewport spawns a ready sound or Video Screen Smart Item pointed at it (**creator-hub-mcp**).

⚠️ **`VideoPlayer.src` alone is not enough on a Video Screen item.** The admin message bus re-seeds `src` from `asset-packs::VideoScreen.defaultURL` at runtime, so a `src` you set without updating `defaultURL` is silently replaced by the template's stream URL.

⚠️ **Silence in the editor is not a diagnosis.** Babylon plays no scene audio and Bevy has a persistent *Mute scene audio* toggle (**creator-hub-mcp** → Gotchas); verify audio in a real preview before changing `volume` or `playing`.

## Audio-reactive scenes (visualizers, beat sync)

For real-time amplitude + frequency-band data from any `AudioSource`, `AudioStream`, or `VideoPlayer`, use the dedicated `audio-analysis` skill. It covers the `AudioAnalysis` component used for music visualizers, equalizer bars, and reactive lights/particles.

## Permission for External Media

External audio/video URLs need no scene.json permission: `{baseDir}/../create-scene/references/scene-json.md` → Required Permissions.

## Video Limits & Tips

- **Simultaneous videos**: Avoid playing multiple videos at once. Only play more than 1 simultaneous video if explicitly requested. The maximum depends on each player's quality setting (as low as 1 on Low quality — see the Video Limits table in `{baseDir}/references/media-reference.md`), so treat 1 as the only safe floor.
- **HTTPS required**: Video sources must be HTTPS URLs — HTTP won't work
- **Distance-based control**: Pause video when player is far away to save bandwidth
- **Supported formats**: `.mp4` (H.264), `.webm`, HLS (`.m3u8`) for live streaming
- **Live streaming**: Use HLS (`.m3u8`) URLs — most reliable across clients

## Example scenes

Engine-team test scenes exercised against the real explorer:

- [audio-source-retrigger-test](https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/89,-10-audio-source-retrigger-test) — `AudioSource.playSound`/`stopSound`, same-URL retrigger, URL-swap on one entity, `resetCursor` semantics, volume/pitch/loop variations, and why `playSound` beats hand-mutating `getMutable` (LWW dedup).
- [audio-visualization](https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/88,-10-audio-visualization) — `AudioAnalysis` music visualizer (see the `audio-analysis` skill).
- [audio-finish](https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/89,-11-audio-finish) — natural-finish detection via the `playing` flip + `audioEventsSystem` callback, and how a scene-initiated stop is distinguished from a natural finish.
- [asset-load](https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/88,-12-asset-load) — `AssetLoad` pre-loading an mp3 alongside a texture, video and glb, with per-asset `assetLoadLoadingStateSystem` state callbacks (including a missing path resolving to `NOT_FOUND`). This is the pattern behind pre-loading audio so it is ready the instant the player first clicks.
- [gltfnodemodifier](https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/74,-8-gltfnodemodifier) — `VideoPlayer` on a GLB rather than a primitive: an HLS `.m3u8` stream driven onto specific GLTF nodes with `GltfNodeModifiers` video textures. The ground truth for the curved-screen / non-primitive case above.

For full code examples and implementation patterns, see `{baseDir}/references/media-patterns.md`. For component field details, see `{baseDir}/references/media-reference.md`.
