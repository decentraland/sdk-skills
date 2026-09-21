---
name: audio-video
description: Add sound effects, music, audio streaming, and video players to Decentraland scenes with AudioSource, AudioStream, and VideoPlayer. Use when the user wants sound, music, video screens, radio, live streams, or media playback. Do NOT use for player emotes (see player-avatar) or screen-space UI sounds (sounds attach to entities, not UI).
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

Before referencing any audio file path in code, check `{baseDir}/references/audio-catalog.md`. It lists 50 free Decentraland audio clips with direct downloadable URLs that cover most needs (UI clicks, ambients, music, game mechanics, sound effects).

The expected workflow when a user asks for sound:

1. Read this skill + `references/audio-catalog.md`.
2. If the catalog has fitting clips, surface them to the user as suggestions — name the clip and what it would be used for.
3. **Ask** how they want to proceed. Some creators want catalog clips downloaded; others prefer placeholder paths so they can drop in their own files later. Don't assume.
4. If they pick catalog clips: download with `curl -o assets/Audio/<name>.mp3 "<URL>"` — these URLs work directly from `Bash`, no separate tool needed.
5. If they want placeholders: use a clear placeholder path (e.g. `assets/Audio/<name>.mp3`) and tell the user which files to drop in where.
6. Reference the resulting local path in `AudioSource.audioClipUrl`.

**Things to avoid:**

- Telling the user "I can't download audio files." `Bash` + `curl` works fine on the catalog URLs — the capability is there if they want it.
- Recommending external sources (freesound / mixkit / pixabay) without first checking whether the catalog already has a fitting clip.
- Downloading clips without asking — even if the catalog has a perfect match, confirm before pulling files into the project.

## AudioSource (Sound Effects & Music)

Attach to any entity for positional sound. Fields: `audioClipUrl: string` (local file path, required), `playing?: boolean`, `loop?: boolean`, `volume?: number` (default 1.0), `pitch?: number` (playback speed, default 1.0), `currentTime?: number` (seek position in seconds, default 0 — write-only, see RULE below), `global?: boolean`, `reportPlaybackPosition?: boolean` (default `false` — opt in to playback-position reports, see **Aligning gameplay to the audio** below). Audio files go in `assets/Audio/`. Supported formats: `.mp3` (recommended for music), `.ogg` (recommended for sound effects, smaller), `.wav`. Keep audio files small — large files increase scene load time.

**RULE: `currentTime` is write-only — never read it as a playhead.** Writing it seeks; the renderer never writes the real position back, so `AudioSource.get(entity).currentTime` is whatever the scene last wrote. To learn where the audio actually is, use the playback-position reports (see **Aligning gameplay to the audio** below).

Audio is **spatial by default** — volume decreases with distance from the entity. Set `global: true` for non-spatial (same volume everywhere).

**Retriggering (play a sound again on every click):** use the helper `AudioSource.playSound(entity, clipUrl, resetCursor?)` — do NOT hand-mutate `getMutable().playing`. `playSound` writes a full component (via `createOrReplace`/`getMutableOrNull`), so it reliably re-emits even with identical params. Hand-setting `getMutable(entity).playing = true` (or the old "playing=false then playing=true" trick) can be silently swallowed by LWW-CRDT dedup when the values are unchanged — the second and later triggers may do nothing. `stopSound(entity, resetCursor?)` stops it. `resetCursor` defaults to `true` on both (start/stop at 0); pass `false` to resume/pause at the current `currentTime`.

```typescript
AudioSource.playSound(entity, 'assets/Audio/click.mp3') // retriggers from 0 every call
AudioSource.stopSound(entity)                            // stops, resets cursor to 0
```

Both helpers return `false` if the entity has no `AudioSource`, so create the component first (e.g. `AudioSource.create(entity, { audioClipUrl, playing: false })` at init).

**Detecting when a sound finishes:** when a non-looping clip ends on its own, the engine flips `AudioSource.playing` back to `false`. Poll it with the READ-ONLY getter and edge-detect the `true → false` transition — never poll with `getMutable` (dirties the component every frame):

```typescript
let wasPlaying = false
engine.addSystem(() => {
	const isPlaying = AudioSource.get(entity).playing ?? false
	if (wasPlaying && !isPlaying) console.log('sound finished') // chain next sound/action here
	wasPlaying = isPlaying
})
```

The engine only flips the flag on natural completion — a scene-initiated `stopSound()` is your own write, and looping clips never flip it. Alternatively use `audioEventsSystem` for a callback per `MediaState` change (`MS_PLAYING → MS_READY` = stopped, `MS_ERROR` = file failed to load) — see the Audio Events System section below. Both features require a DCL 2.0 desktop client with playback-completion support; on older clients the flag never flips and no finish signal arrives — don't build logic that hard-blocks on it without a timeout fallback.

Players must interact with the scene (click) before audio can play (browser autoplay policy). If an audio file needs to be ready to play the instant the player interacts, use the `AssetLoad` component to pre-load the asset.

A sound started at scene startup plays **behind the Explorer's loading screen** and the player misses it. For welcome VO, an intro sting, or music that should land on the first look at the scene, wait for `EngineInfo.sceneHidden` to flip to `false` (the loading-screen fade-out) before setting `playing: true` — see the **scene-runtime** skill.

**Pause audio when the scene is hidden:** the same `EngineInfo.getOrNull(engine.RootEntity)?.sceneHidden` flag is also `true` whenever any fullscreen Explorer UI (map, backpack, settings) covers the scene. Pause or mute audio sources in that state and resume when `sceneHidden` returns to `false`.

> **Before adding audio**: Confirm with the user before fetching audio from external sources.

## AudioStream (Streaming)

Stream audio from a URL (radio, live streams). Key fields: `url` (streaming URL), `playing`, `volume`. Non-spatial by default — plays at same volume everywhere. Set `spatial: true` with `spatialMinDistance`/`spatialMaxDistance` for distance-based volume.

Query state with `AudioStream.getAudioState(entity)` which returns a `PBAudioEvent | undefined` — an object with a `state` field (a `MediaState` enum: `MS_PLAYING`, `MS_ERROR`, etc.) and a `timestamp` field, not a bare enum. Read the state as `AudioStream.getAudioState(entity)?.state`. For callback-style state changes instead of polling, `audioEventsSystem.registerAudioEventsEntity` works on AudioStream entities too (see the AudioSource finish-detection note above).

> **Before adding a streaming URL**: If not provided by the user, confirm the source first.

## Audio Events System (audioEventsSystem)

Monitor `AudioSource` and `AudioStream` media state changes and, on renderers that report it, the clip's playback position. Import from `@dcl/sdk/ecs`. `registerAudioEventsEntity` fires only when the state changes (not every frame); `registerAudioPlaybackEntity` fires once per scene frame with the newest report, position updates included.

```typescript
import { engine, audioEventsSystem, AudioSource } from '@dcl/sdk/ecs'

const radioEntity = engine.addEntity()
AudioSource.create(radioEntity, { audioClipUrl: 'assets/Audio/music.mp3', playing: true })

audioEventsSystem.registerAudioEventsEntity(radioEntity, (event) => {
  // event is PBAudioEvent: { state: MediaState, timestamp: number, tickNumber?, currentOffset?, clipLength? }
  console.log('Audio state changed:', event.state)
})
```

**API** (verified against `@dcl/ecs`, commit `f858f905`; playback additions against js-sdk-toolchain [#1624](https://github.com/decentraland/js-sdk-toolchain/pull/1624)):
- `audioEventsSystem.registerAudioEventsEntity(entity, callback)` -- registers a callback for audio state changes. The callback receives a `PBAudioEvent` with `state` (a `MediaState` enum) and `timestamp`. Fires only when state changes — position-only reports (same `state`, new `tickNumber`/`currentOffset`) do NOT trigger it.
- `audioEventsSystem.removeAudioEventsEntity(entity)` -- unregisters the callback.
- `audioEventsSystem.hasAudioEventsEntity(entity)` -- returns `boolean`.
- `audioEventsSystem.getAudioState(entity)` -- returns `PBAudioEvent | undefined` (the latest state).
- `audioEventsSystem.registerAudioPlaybackEntity(entity, callback)` -- registers a callback that runs once per scene frame with the newest **position** report for the entity, and is skipped on frames where no new position arrived. The renderer writes a report whenever the playhead moves, so a playing clip produces one every render frame; when it samples faster than the scene ticks you get the freshest of that frame's reports, which is the one to align against. The callback receives `{ report, sceneTime, offset }`, already resolved against the scene clock in the tick the renderer sampled the position: `report` is the raw `PBAudioEvent`, `offset` the position in seconds, `sceneTime` the scene clock in seconds at that tick. Reports carrying no position never reach it — those are media-state changes, which `registerAudioEventsEntity` delivers. **The source has to opt in: `reportPlaybackPosition: true` on its `AudioSource`, or this callback never runs.** Independent of `registerAudioEventsEntity` — an entity can hold both.
- `audioEventsSystem.getSceneTimeAtTick(tickNumber)` -- the scene clock recorded in a given tick, or `undefined` outside the short history. Use it to resolve `PBVideoEvent` reports the same way.
- `audioEventsSystem.removeAudioPlaybackEntity(entity)` -- unregisters the playback callback.
- `audioEventsSystem.getAudioPlayback(entity)` -- returns the latest `PBAudioEvent` that carries a `currentOffset`, or `undefined` if the renderer has never reported a position (poll form; stays `undefined` forever without `reportPlaybackPosition: true`, or on renderers without the feature).

**`PBAudioEvent` fields:** `state: MediaState`; `timestamp: number` — a per-entity monotonic report counter, NOT a time; and, optional, only on playback reports: `tickNumber?: number` (the scene tick the position was sampled in, equals `EngineInfo.tickNumber`), `currentOffset?: number` (clip position in seconds at that tick), `clipLength?: number` (total clip length in seconds when known; `undefined` for streams). Mirrors `PBVideoEvent.tickNumber`/`currentOffset`.

**MediaState values:** `MS_LOADING`, `MS_READY`, `MS_PLAYING`, `MS_PAUSED`, `MS_STOPPED`, `MS_ERROR`, `MS_SEEKING`, `MS_BUFFERING`, `MS_NONE`.

Both registrations are dropped automatically if the entity is removed or no longer has an `AudioSource`/`AudioStream` component. Works on entities with either `AudioSource` or `AudioStream` (the renderer adds the underlying `AudioEvent` component to any entity with those components).

**Relationship to `AudioStream.getAudioState`:** `AudioStream.getAudioState` is a convenience wrapper on the `AudioStream` component itself; `audioEventsSystem.getAudioState` reads the underlying `AudioEvent` component and works for both `AudioSource` and `AudioStream`. Use `audioEventsSystem` when you need callback-driven state monitoring or when working with `AudioSource`.

### Aligning gameplay to the audio (rhythm games, beat sync, lip sync, timed cues)

**RULE: the source must opt in — set `reportPlaybackPosition: true` on its `AudioSource`.** Position reports are off by default, and nothing below works without the flag: `registerAudioPlaybackEntity`'s callback never fires, `getAudioPlayback` stays `undefined`, and no error says why. Media-state changes are reported either way, so `registerAudioEventsEntity` keeps working and hides the omission. It is opt-in because a position is written whenever the playhead moves — far more often than a state changes — a scene can hold many sources, and `AudioEvent` is a grow-only set capped at 100 entries per entity, so one always-on source fills its own buffer in under two seconds. Set it only on the sources whose position the scene actually reads.

```typescript
AudioSource.create(musicEntity, {
  audioClipUrl: 'assets/Audio/track.mp3',
  playing: true,
  reportPlaybackPosition: true // without this the callback below never runs
})
```

**RULE: let the SDK resolve a report against your clock — never rebuild the per-tick history.** A report says where the clip was at tick `tickNumber`; it reaches the scene some frames later, so comparing `currentOffset` with the clock at processing time is wrong by the transport delay. `registerAudioPlaybackEntity` hands the reading over already resolved against the scene clock at its own tick, so a scene never keeps a tick history of its own.

`sceneTime - offset` is the scene clock at which the audible clip started. Keep that origin and every later question is one subtraction.

```typescript
import { engine, MediaState, audioEventsSystem } from '@dcl/sdk/ecs'

let clockMs = 0
engine.addSystem((dt) => { clockMs += dt * 1000 })

let originMs: number | undefined   // clockMs at which the audible clip started

audioEventsSystem.registerAudioPlaybackEntity(musicEntity, ({ report, sceneTime, offset }) => {
  if (report.state !== MediaState.MS_PLAYING) return
  originMs = sceneTime * 1000 - offset * 1000
})

// gameplay: const audioMs = originMs === undefined ? undefined : clockMs - originMs
```

`originMs` absorbs the renderer's start delay (100–250 ms, different every start), so recompute it from each sample and smooth if it jitters. A scene that prefers raw reports can call `getSceneTimeAtTick(report.tickNumber)` for the same lookup; it resolves `PBVideoEvent` reports too.

**RULE: degrade gracefully.** Renderers without the feature never set a position even when the source opts in, so the sample callback never fires (`originMs` stays `undefined`, `getAudioPlayback` returns `undefined`): fall back to a fixed lead (about 150 ms) or a tap-to-calibrate step, and never hard-block waiting for a report.

**RULE: know the floor.** `currentOffset` is the decoder's read position, not the moment a sample leaves the speaker. The mixer buffer, driver and device add tens of milliseconds that no field carries, consistently signed and roughly constant per device. Calibrate it once per session if the scene needs alignment finer than a tick.

**Where vs. how loud:** playback reports say *where* the audio is; `AudioAnalysis` (the `audio-analysis` skill) says *how loud* it is right now. Take timing from the reports, visuals from the analysis.

### SDK VERSION GATE: playback-position reports

**Check the scene's `@dcl/sdk` pin before emitting any of the playback API above.** It needs a release that includes js-sdk-toolchain [#1624](https://github.com/decentraland/js-sdk-toolchain/pull/1624) (protocol [#488](https://github.com/decentraland/protocol/pull/488), [ADR-318](https://github.com/decentraland/adr/pull/324)), unreleased at the time of writing; on older SDKs the calls are type errors. Today only the Unity explorer writes position reports (unity-explorer [#10123](https://github.com/decentraland/unity-explorer/pull/10123)), so always ship the fallback.

## VideoPlayer

Play video on a surface. Key fields: `src` (URL or local path), `playing`, `loop`, `volume`, `playbackRate`, `position` (start time in seconds). Non-spatial by default — set `spatial: true` with min/max distances for positional audio.

**Setup requires 3 steps**: create entity with `MeshRenderer.setPlane()`, add `VideoPlayer`, create `Material.Texture.Video({ videoPlayerEntity })` and apply to material. Use `Material.setBasicMaterial` (recommended, better performance) or `Material.setPbrMaterial` with emissive for a brighter screen.

Monitor playback with `videoEventsSystem`:
- `videoEventsSystem.registerVideoEventsEntity(entity, callback)` — callback receives `PBVideoEvent` on each state change.
- `videoEventsSystem.removeVideoEventsEntity(entity)` — unregisters the callback.
- `videoEventsSystem.hasVideoEventsEntity(entity): boolean` — check if an entity is registered.
- `videoEventsSystem.getVideoState(entity): PBVideoEvent | undefined` — poll the latest state without a callback.

States: `VS_READY`, `VS_PLAYING`, `VS_PAUSED`, `VS_ERROR`, `VS_BUFFERING`.

**Re-registration preserves last-reported state:** calling `registerVideoEventsEntity` on an already-registered entity replaces the callback but retains the last-reported state, so the new callback does not replay an already-reported state change. The same behavior applies to `assetLoadLoadingStateSystem.registerAssetLoadLoadingStateEntity` — re-registering preserves the count of already-reported events, avoiding duplicate callbacks. Verified against js-sdk-toolchain commit `9055b4b4`.

Share one VideoPlayer across multiple screens by referencing the same `videoPlayerEntity` in multiple `Material.Texture.Video()` calls.

To play video on a non-primitive shape (curved screens), use `GltfNodeModifiers` to swap the material of a GLTF model.

## Free Audio Files

The audio catalog is the first place to look — see the **Audio Sourcing** section at the top of this skill. It lists 50 free Decentraland clips across music, ambient, interaction sounds, sound effects, and game mechanics, each with a `curl`-ready URL.

Read `{baseDir}/references/audio-catalog.md` before recommending audio so suggestions are concrete, then check with the user whether they want those clips downloaded or prefer placeholders.

> **Important**: `AudioSource` only works with **local files**. Never use external URLs for `audioClipUrl`. Always download into `assets/Audio/` first.

### Asset folder conventions

- **Default** for audio you download yourself: `assets/Audio/`.
- **Legacy scenes** may already have audio under `assets/scene/Audio/` — that path still works; reuse it for any new clips in those scenes instead of creating a parallel `assets/Audio/` folder.
- **Creator Hub assets**: audio imported directly through the Creator Hub UI lands in `assets/Audio/` (same as the standard path). Items from free DCL asset packs land in `assets/asset-packs/` and custom items in `assets/custom/`. Older scenes may also have user imports directly under `assets/scene/`. Reference these paths as-is — never move or rename them.

Always check the scene's existing folders before deciding where to put a new file.

## Audio-reactive scenes (visualizers, beat sync)

For real-time amplitude + frequency-band data from any `AudioSource`, `AudioStream`, or `VideoPlayer`, use the dedicated `audio-analysis` skill. It covers the `AudioAnalysis` component (Unity-explorer only) used for music visualizers, equalizer bars, and reactive lights/particles. For timing, see **Aligning gameplay to the audio** above.

## Permission for External Media

`[LEGACY]` External audio/video URLs do **not** require the `ALLOW_MEDIA_HOSTNAMES` permission. The permission and its `allowedMediaHostnames` list still exist in `@dcl/schemas`, but no current client enforces them — unity-explorer's hostname check is gated behind the `CHECK_ALLOWED_MEDIA_HOSTNAMES` compile define (set in no build config, so `SceneData.TryGetMediaUrl` just does a URL syntax check), and bevy-explorer has no enforcement. Only the retired web client enforced it. Do not add it for new scenes; current clients play external media without it.

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
- [audio-playback-position](https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/89,-12-audio-playback-position) — three beat cubes contrasting the scene's own clock, a reading resolved through `registerAudioPlaybackEntity`, and the same reading timed on arrival instead, so the renderer's start lag and the report's transport delay are both visible against a clip that beeps on the second; also shows `registerAudioEventsEntity` staying silent on position-only reports and the fallback when `getAudioPlayback` stays `undefined`.
- [asset-load](https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/88,-12-asset-load) — `AssetLoad` pre-loading an mp3 alongside a texture, video and glb, with per-asset `assetLoadLoadingStateSystem` state callbacks (including a missing path resolving to `NOT_FOUND`). This is the pattern behind pre-loading audio so it is ready the instant the player first clicks.
- [gltfnodemodifier](https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/74,-8-gltfnodemodifier) — `VideoPlayer` on a GLB rather than a primitive: an HLS `.m3u8` stream driven onto specific GLTF nodes with `GltfNodeModifiers` video textures. The ground truth for the curved-screen / non-primitive case above.

For full code examples and implementation patterns, see `{baseDir}/references/media-patterns.md`. For component field details, see `{baseDir}/references/media-reference.md`.
