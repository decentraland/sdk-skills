---
name: audio-analysis
description: Read real-time amplitude and 8-band frequency data from any AudioSource, AudioStream, or VideoPlayer entity in a Decentraland SDK7 scene with the AudioAnalysis component. Use when the user asks for music visualizers, beat reactivity, equalizers, or audio-reactive scenes. To play sound see audio-video.
---

# AudioAnalysis

Real-time audio signal analysis attached to any entity that already has an `AudioSource`, `AudioStream`, or `VideoPlayer`. The renderer analyzes the audio frame buffer and writes results back into the component each tick. Scenes read those results to drive visualizers, beat-reactive geometry, audio-driven lights, etc.

## RULE: Requires an audio-emitting component on the same entity

`AudioAnalysis` does nothing on its own. The entity MUST also have one of: `AudioSource`, `AudioStream`, or `VideoPlayer`. The renderer taps that component's audio frame buffer to compute amplitude/bands. An entity with only `AudioAnalysis` produces no data.

## RULE: Audio must be playing for non-zero output

Values are derived from live audio frames. If the source is paused, muted, or not yet loaded, `amplitude` and all `bands[]` stay at `0`. There is no "ready" event — start your reactive systems unconditionally, they will simply animate toward `0` while silent.

## RULE: Not implemented everywhere — always design a silent fallback

- **Unity (desktop):** implemented.
- **Mobile (Godot):** app 1.14.0+, `AudioSource` only; older mobile apps write no analysis. `AudioStream` and `VideoPlayer` read `0`: their audio is decoded by native platform players and never reaches the analyser. Band values differ from desktop by a constant factor (and band edges differ, since mobile downmixes to mono first), so tune thresholds and gains on both clients.
- **Bevy:** ignores the component (no analysis written).

Where it is unimplemented (including a stream or video on mobile) the values simply stay at `0` — same shape as silence — so the scene never errors, it just goes still. Always design a fallback that does not depend on `amplitude` (e.g. a base scale, a looping tween) so the scene still reads on every client.

## RULE: Read via `readIntoView` into a pre-allocated view

`readIntoView` / `tryReadIntoView` write into a caller-owned `AudioAnalysisView = { amplitude: number, bands: number[] }`. Allocate the view once at scene init and reuse it every frame — do not `new` it inside the system. The `bands` array MUST be pre-sized to 8.

## RULE: Use `createAudioAnalysis`, not `create`

Use the helper `AudioAnalysis.createAudioAnalysis(entity, mode?, amplitudeGain?, bandsGain?)`. It pre-fills all required protobuf fields (8 bands + amplitude + mode) with safe defaults. Calling the raw `AudioAnalysis.create(entity, {...})` requires you to provide every band/amplitude field manually. Use `createOrReplaceAudioAnalysis` to overwrite an existing one without throwing.

## Import

```typescript
import {
  AudioAnalysis,
  AudioAnalysisView,
  PBAudioAnalysisMode,
  AudioSource, // or AudioStream / VideoPlayer
  engine,
  Transform,
} from "@dcl/sdk/ecs";
import { Vector3 } from "@dcl/sdk/math";
```

`AudioAnalysisView` is a TypeScript type alias (not a component), exported from `@dcl/sdk/ecs`: `{ amplitude: number, bands: number[] }`, `bands[0]` = lowest frequency, `bands[7]` = highest.

## Component fields

Component ID is `1212`.

Output (filled by the renderer; read in your systems):

| Field       | Type     | Range               | Notes                                                         |
| ----------- | -------- | ------------------- | ------------------------------------------------------------- |
| `amplitude` | `number` | `0..~1` (mode-dep.) | Aggregate signal strength of the current audio frame.         |
| `band0`     | `number` | `0..~1` (mode-dep.) | Lowest frequency bin (sub-bass).                              |
| `band1..6`  | `number` | `0..~1` (mode-dep.) | Increasing frequency bands (fixed edges in both modes; see *Desktop band model*). |
| `band7`     | `number` | `0..~1` (mode-dep.) | Highest frequency bin (treble/air).                           |

Inputs (configure once at create time):

| Field           | Type                  | Default             | Notes                                                                                                                |
| --------------- | --------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `mode`          | `PBAudioAnalysisMode` | `MODE_LOGARITHMIC`  | `MODE_RAW = 0` (raw FFT magnitudes) \| `MODE_LOGARITHMIC = 1` (perceptual log mapping, recommended for visualizers). |
| `amplitudeGain` | `number?` (optional)  | `5.0` when omitted  | Multiplier applied to `amplitude`. Only used in MODE_LOGARITHMIC.                                                    |
| `bandsGain`     | `number?` (optional)  | `0.05` when omitted | Multiplier applied to all 8 bands. Only used in MODE_LOGARITHMIC.                                                    |

> `MODE_LOGARITHMIC` values are clamped to `0..1`; `MODE_RAW` values are unbounded. For typical music at default gains, normal content sits around `0..0.5`.

## Reading the data

```typescript
const view: AudioAnalysisView = { amplitude: 0, bands: new Array<number>(8) };

engine.addSystem(() => {
  // Throws if the entity has no AudioAnalysis
  AudioAnalysis.readIntoView(audioEntity, view);

  // Or, defensive variant — returns false if missing, no throw
  // if (!AudioAnalysis.tryReadIntoView(audioEntity, view)) return

  // view.amplitude and view.bands[0..7] are now populated
});
```

`readIntoView(entity, out)` — populates `out` from the latest analysis. Throws if the entity has no `AudioAnalysis`.
`tryReadIntoView(entity, out): boolean` — same, but returns `false` instead of throwing when the component is missing; use it when the analysis may be attached later (e.g. added at runtime).

## Common patterns

```typescript
// 1. Pulse an entity's scale to overall amplitude
const view: AudioAnalysisView = { amplitude: 0, bands: new Array<number>(8) };
engine.addSystem(() => {
  AudioAnalysis.readIntoView(audioEntity, view);
  const t = Transform.getMutable(pulseEntity);
  const s = 1 + view.amplitude * 10; // base 1, gain to taste
  t.scale = Vector3.create(s, s, s);
});

// 2. 8-bar equalizer (one entity per band, scale Y by bands[i])
for (const [entity, _] of engine.getEntitiesWith(VisualBar, Transform)) {
  const i = VisualBar.get(entity).index; // 0..7
  Transform.getMutable(entity).scale = Vector3.create(
    1,
    view.bands[i] * BAR_HEIGHT,
    1
  );
}

// 3. Bass-only kick — react to the lowest band
const bass = view.bands[0] + view.bands[1]; // sub + low
if (bass > 0.7) {
  /* trigger flash */
}

// 4. Custom gains (less sensitive amplitude, punchier bands)
AudioAnalysis.createAudioAnalysis(
  audioEntity,
  PBAudioAnalysisMode.MODE_LOGARITHMIC,
  2.0,
  0.1
);
```

Beat-driven flashes and sky or light changes fall under **lighting-environment** → *RULE: Photosensitivity* (≤ 3 flashes/s, and a toggle for a music-reactive show).

For a complete music visualizer (audio source + amplitude sphere + 8-band equalizer bars), see `{baseDir}/references/audio-analysis-example.md`.

## Mode selection

- `MODE_LOGARITHMIC` (default) — bands are gain-scaled and log-mapped into `0..1`. Use this for visualizers, scaling, color reactivity. `amplitudeGain` and `bandsGain` apply.
- `MODE_RAW` — the same bands, unscaled mean FFT magnitudes (unbounded; they scale with the audio buffer length). Gains are ignored. Use only if you intend to do your own normalization.

## Gotchas

- **Throttled updates.** The renderer runs analysis under a frame-time budget — values update each frame in normal conditions but can skip frames under heavy load. Drive smooth animations with `dt` interpolation rather than assuming a fixed update cadence.
- **Desktop band model** (Unity Explorer native analyser, from source):
  - Each update analyses the latest audio buffer only (1024 frames ≈ 21 ms at 48 kHz): no window, no averaging over time, no smoothing. Values jitter frame to frame; smooth them yourself.
  - Band `i` is the mean FFT magnitude between fixed edges 0, 60, 120, 250, 500, 1000, 2000, 4000 Hz and Nyquist; `amplitude` is the buffer's RMS. `MODE_LOGARITHMIC` returns `min(1, log10(x × gain + 1))` with `amplitudeGain` 5 and `bandsGain` 0.05 by default.
  - Stereo output is analysed as one interleaved signal, so for ordinary stereo music each frequency lands at about half its value: in practice ~0–120, 120–240, 240–500, 500–1000 Hz, 1–2, 2–4, 4–8 kHz and 8 kHz+. [UNVERIFIED: derived from source and a numeric model, not measured in-world]
  - Tune thresholds as a ratio to a running average of the same band, never as absolute values from an offline simulation (in-world 2026-11-23: offline-tuned absolute thresholds never fired).
  - To mark a moment in a stream (a song start), prepend a short pattern of alternating tones that fall in two different bands and detect each band against its own on/off contrast; this needs no knowledge of band edges or gains (worked on a live stream with live guitar over it, owner report 2026-11-25).
- **Multi-source scenes.** Each audio-emitting entity needs its own `AudioAnalysis` if you want to react to that specific source. There is no global mix-down; you pick the entity to analyze.
- **Works on `VideoPlayer` audio too** — call `AudioAnalysis.createAudioAnalysis(videoEntity)` on the same entity that has `VideoPlayer`. The renderer taps the video's audio frame buffer the same way it does for `AudioSource`. This holds for both progressive files (MP4/WebM at a direct URL) and **HLS streams (`.m3u8`)**; the `88,-10-audio-visualization` test scene drives a third visualizer group from a live HLS stream.
- **No `pitch` interaction.** `AudioSource.pitch` changes playback speed; the analysis runs on the actual played audio frames, so a higher pitch shifts perceived band energy upward. This is expected, not a bug.

## Permissions

No scene permission or hostname whitelist is needed: `ALLOW_MEDIA_HOSTNAMES` / `allowedMediaHostnames` are legacy and ignored (`{baseDir}/../create-scene/references/scene-json.md` → Required Permissions).

## Example scenes

- [audio-visualization](https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/88,-10-audio-visualization) — engine-team test scene: three independent visualizer groups side by side, each 8 bars + an amplitude sphere driven by its own `AudioAnalysis`. Group 0: `AudioSource` (local mp3). Group 1: `VideoPlayer` on a progressive MP4. Group 2: `VideoPlayer` on an HLS `.m3u8` stream. Each group owns a pre-allocated `AudioAnalysisView` and gets its own `readIntoView` call in a single read system. Demonstrates that `AudioAnalysis` behaves identically across all three source kinds. Each amplitude sphere is also the play/pause button for its source — `MeshCollider.setSphere` makes it clickable, and the handler flips `playing` on `AudioSource.getMutable` / `VideoPlayer.getMutable` (the same toggle works for MP4 and HLS).

## Resources

- `{baseDir}/references/audio-analysis-example.md` — full music visualizer scene from the SDK examples (audio source + amplitude pulse + 8-bar equalizer).
