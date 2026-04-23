---
name: audio-video
description: Add sound effects, music, audio streaming, and video players to Decentraland scenes. Covers AudioSource (local files, spatial audio, pitch), AudioStream (streaming URLs, MediaState polling), VideoPlayer (video on meshes or GLBs), VideoState events, spatial min/max distances, and ALLOW_MEDIA_HOSTNAMES permissions. Use when the user wants sound, music, audio, video screens, radio, live streams, or media playback. Do NOT use for player emotes (see player-avatar) or screen-space UI sounds (sounds attach to entities, not UI).
---

# Audio and Video in Decentraland

## When to Use Which Media Component

| Need | Component | Key Difference |
|------|-----------|---------------|
| Sound effect from a file (click, explosion, footstep) | `AudioSource` | Local file, spatial, one-shot or looping |
| Background music or radio stream | `AudioStream` | External URL, non-spatial, continuous |
| Video on a surface (screen, billboard) | `VideoPlayer` + `Material.Texture.Video` | Requires a mesh to display on |

**Decision flow:**

1. Is it a local audio file? → `AudioSource`
2. Is it a streaming URL (radio, live audio)? → `AudioStream`
3. Is it video content? → `VideoPlayer` on a plane/mesh

## AudioSource (Sound Effects & Music)

Attach to any entity for positional sound. Key fields: `audioClipUrl` (local file path), `playing` (boolean), `loop`, `volume` (0-1), `pitch` (playback speed). Audio files go in `assets/scene/Audio/`. Supported formats: `.mp3` (recommended), `.ogg`, `.wav`.

Audio is **spatial by default** — volume decreases with distance from the entity. Set `global: true` for non-spatial (same volume everywhere).

Control playback via `AudioSource.getMutable(entity).playing = true/false`. To replay from start, set `playing = false` then `playing = true`.

> **Before adding audio**: Confirm with the user before fetching audio from external sources.

## AudioStream (Streaming)

Stream audio from a URL (radio, live streams). Key fields: `url` (streaming URL), `playing`, `volume`. Non-spatial by default — plays at same volume everywhere. Set `spatial: true` with `spatialMinDistance`/`spatialMaxDistance` for distance-based volume.

Query state with `AudioStream.getAudioState(entity)` which returns a `MediaState` enum (`MS_PLAYING`, `MS_ERROR`, etc.).

> **Before adding a streaming URL**: If not provided by the user, confirm the source first.

## VideoPlayer

Play video on a surface. Key fields: `src` (URL or local path), `playing`, `loop`, `volume`, `playbackRate`, `position` (start time in seconds). Non-spatial by default — set `spatial: true` with min/max distances for positional audio.

**Setup requires 3 steps**: create entity with `MeshRenderer.setPlane()`, add `VideoPlayer`, create `Material.Texture.Video({ videoPlayerEntity })` and apply to material. Use `Material.setBasicMaterial` (recommended, better performance) or `Material.setPbrMaterial` with emissive for a brighter screen.

Monitor playback with `videoEventsSystem.registerVideoEventsEntity()` for state callbacks, or `videoEventsSystem.getVideoState()` for polling. States: `VS_READY`, `VS_PLAYING`, `VS_PAUSED`, `VS_ERROR`, `VS_BUFFERING`.

Share one VideoPlayer across multiple screens by referencing the same `videoPlayerEntity` in multiple `Material.Texture.Video()` calls.

To play video on a non-primitive shape (curved screens), use `GltfNodeModifiers` to swap the material of a GLTF model.

## Free Audio Files

Always check the audio catalog before creating placeholder sound file references. It contains 50 free sounds from the Creator Hub asset packs.

Read `{baseDir}/references/audio-catalog.md` for music tracks, ambient sounds, interaction sounds, sound effects, and game mechanic sounds.

**Workflow**: Read catalog → suggest specific sounds → download with `curl -o assets/scene/Audio/<name>.mp3 "<URL>"` → reference with local path in `audioClipUrl`.

> **Important**: `AudioSource` only works with **local files**. Never use external URLs for `audioClipUrl`. Always download into `assets/scene/Audio/` first.

## Permission for External Media

External audio/video URLs require the `ALLOW_MEDIA_HOSTNAMES` permission in scene.json with specific hostnames listed in `allowedMediaHostnames`.

## Video Limits & Tips

- **Simultaneous videos**: Avoid playing multiple videos at once. Only play more than 1 simultaneous video if explicitly requested. Maximum 5 simultaneous videos.
- **Distance-based control**: Pause video when player is far away to save bandwidth
- **Supported formats**: `.mp4` (H.264), `.webm`, HLS (`.m3u8`) for live streaming
- **Live streaming**: Use HLS (`.m3u8`) URLs — most reliable across clients

## Important Notes

- Audio files must be in the project's directory (relative paths from project root)
- Video requires HTTPS URLs — HTTP won't work
- Players must interact with the scene (click) before audio can play (browser autoplay policy)
- Keep audio files small — large files increase scene load time
- Use `.mp3` for music and `.ogg` for sound effects (smaller file sizes)
- For live video streaming, use HLS (.m3u8) URLs when possible
- If an audio file needs to be ready to play as the player interacts, use the `AssetLoad` component to pre-load the asset

For full code examples and implementation patterns, see `{baseDir}/references/media-patterns.md`. For component field details, see `{baseDir}/references/media-reference.md`.
