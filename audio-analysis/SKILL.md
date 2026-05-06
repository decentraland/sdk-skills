---
name: audio-analysis
description: Read real-time amplitude and 8-band frequency data from any AudioSource, AudioStream, or VideoPlayer entity in a Decentraland SDK7 scene with the AudioAnalysis component. Renderer fills the component each frame; scenes copy values into a plain JS view via readIntoView/tryReadIntoView and drive entity scale, color, lights, materials, particles, or UI from amplitude (overall loudness) and bands[0..7] (low→high frequency bins). Use when the user asks for music visualizers, beat reactivity, audio-reactive scenes, equalizers, dancing lights, scaling cubes that pulse to music, audio-driven materials, or anything that should react to sound. Do NOT use to play sound (see audio-video) or to detect player-emitted audio (this reads only entity-attached AudioSource/AudioStream/VideoPlayer audio).
---

# AudioAnalysis

Real-time audio signal analysis attached to any entity that already has an `AudioSource`, `AudioStream`, or `VideoPlayer`. The renderer analyzes the audio frame buffer and writes results back into the component each tick. Scenes read those results to drive visualizers, beat-reactive geometry, audio-driven lights, etc.

## RULE: Requires an audio-emitting component on the same entity

`AudioAnalysis` does nothing on its own. The entity MUST also have one of: `AudioSource`, `AudioStream`, or `VideoPlayer`. The renderer taps that component's audio frame buffer to compute amplitude/bands. An entity with only `AudioAnalysis` produces no data.

## RULE: Audio must be playing for non-zero output

Values are derived from live audio frames. If the source is paused, muted, or not yet loaded, `amplitude` and all `bands[]` stay at `0`. There is no "ready" event — start your reactive systems unconditionally, they will simply animate toward `0` while silent.

## RULE: Only the Unity explorer implements this

Bevy and the mobile Godot explorer ignore the component (no analysis written). Treat `AudioAnalysis` as a Unity-explorer-only enhancement and design fallbacks (e.g. a base scale that doesn't depend on `amplitude`) so the scene still looks reasonable elsewhere.

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

`AudioAnalysisView` is a TypeScript type alias (not a component), exported from `@dcl/sdk/ecs`.

## Component fields

Output (filled by the renderer; read in your systems):

| Field       | Type     | Range               | Notes                                                         |
| ----------- | -------- | ------------------- | ------------------------------------------------------------- |
| `amplitude` | `number` | `0..~1` (mode-dep.) | Aggregate signal strength of the current audio frame.         |
| `band0`     | `number` | `0..~1` (mode-dep.) | Lowest frequency bin (sub-bass).                              |
| `band1..6`  | `number` | `0..~1` (mode-dep.) | Increasing frequency bins, log-spaced under MODE_LOGARITHMIC. |
| `band7`     | `number` | `0..~1` (mode-dep.) | Highest frequency bin (treble/air).                           |

Inputs (configure once at create time):

| Field           | Type                  | Default             | Notes                                                                                                                |
| --------------- | --------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `mode`          | `PBAudioAnalysisMode` | `MODE_LOGARITHMIC`  | `MODE_RAW = 0` (raw FFT magnitudes) \| `MODE_LOGARITHMIC = 1` (perceptual log mapping, recommended for visualizers). |
| `amplitudeGain` | `number?` (optional)  | `5.0` when omitted  | Multiplier applied to `amplitude`. Only used in MODE_LOGARITHMIC.                                                    |
| `bandsGain`     | `number?` (optional)  | `0.05` when omitted | Multiplier applied to all 8 bands. Only used in MODE_LOGARITHMIC.                                                    |

> Values are unbounded floats — gains can push them above `1`. Clamp or scale in your system if the visual you drive needs `0..1`. For typical music at default gains, expect peaks roughly in `0..1` with normal content sitting `0..0.5`.

## AudioAnalysisView

Read-only convenience shape used by `readIntoView` / `tryReadIntoView`:

```typescript
type AudioAnalysisView = {
  amplitude: number;
  bands: number[]; // length 8 — bands[0] = lowest freq, bands[7] = highest
};
```

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
`tryReadIntoView(entity, out): boolean` — same, but returns `false` instead of throwing when the component is missing.

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

For a complete music visualizer (audio source + amplitude sphere + 8-band equalizer bars), see `{baseDir}/references/audio-analysis-example.md`.

## Mode selection

- `MODE_LOGARITHMIC` (default) — bands are log-spaced and gain-scaled to roughly fit `0..1` for typical music. Use this for visualizers, scaling, color reactivity. `amplitudeGain` and `bandsGain` apply.
- `MODE_RAW` — raw FFT-derived magnitudes, linearly spaced. Lower bands dominate visually because most musical energy is there. `amplitudeGain` / `bandsGain` are ignored. Use only if you intend to do your own normalization.

## Gotchas

- \*\*Component ID is `1212`
- **`amplitudeGain` and `bandsGain` are no-ops in MODE_RAW.** Setting them won't error, but the renderer ignores them outside MODE_LOGARITHMIC.
- **Output values can exceed `1.0`** with high gains or loud source material. Clamp downstream if you feed UI bars or alpha channels expecting `0..1`.
- **Throttled updates.** The renderer runs analysis under a frame-time budget — values update each frame in normal conditions but can skip frames under heavy load. Drive smooth animations with `dt` interpolation rather than assuming a fixed update cadence.
- **Multi-source scenes.** Each audio-emitting entity needs its own `AudioAnalysis` if you want to react to that specific source. There is no global mix-down; you pick the entity to analyze.
- **Works on `VideoPlayer` audio too.** The renderer's `MediaPlayerComponent` (which backs both `AudioStream` and `VideoPlayer`) implements the same audio frame buffer interface as `AudioSource`, so you can drive visuals from a video's soundtrack.
- **No `pitch` interaction.** `AudioSource.pitch` changes playback speed; the analysis runs on the actual played audio frames, so a higher pitch shifts perceived band energy upward. This is expected, not a bug.
- **Don't call `readIntoView` before `createAudioAnalysis`.** Reading without the component throws. Use `tryReadIntoView` if the component may not be attached yet (e.g. analysis added at runtime).

## Permissions

No special scene permission is needed beyond what the underlying `AudioSource` / `AudioStream` / `VideoPlayer` already requires. Streamed audio still needs `ALLOW_MEDIA_HOSTNAMES` in `scene.json` for its hostname (see `audio-video` skill).

## Resources

- `{baseDir}/references/audio-analysis-example.md` — full music visualizer scene from the SDK examples (audio source + amplitude pulse + 8-bar equalizer).
- Source PRs: protocol [#328](https://github.com/decentraland/protocol/pull/328), js-sdk-toolchain [#1256](https://github.com/decentraland/js-sdk-toolchain/pull/1256), unity-explorer [#6361](https://github.com/decentraland/unity-explorer/pull/6361).
- Reference scene: [`sdk7-goerli-plaza/audio-visualization`](https://github.com/decentraland/sdk7-goerli-plaza/tree/main/audio-visualization).
