# Generating a REAPER project (.rpp) as text

For the headless batch path in `sound-design.md` → *REAPER*. An `.rpp` is plain text; a recipe script writes it, `REAPER -newinst -nosplash -renderproject kit.rpp` renders it, and the user can open it to listen. Everything below rendered correctly in one sound kit of 30+ regions (REAPER 7.x, macOS, 2026-11). Values marked "copy as-is" are the working ones; their other fields were not individually verified.

## Layout

- One **region** per game sound, laid out one after another with a gap (4 s worked); region name = output file name.
- One **track** per layer type (e.g. `voice · rattle`, `wind · canopy`), carrying that layer's filters. Several sounds can share a track.
- One **bus track** per space with a ReaVerbate, fed by `AUXRECV` sends from layer tracks.
- One **item** per layer: source file, offset into it, length, position, varispeed rate, gain, fades.
- Convert sources to WAV first (`ffmpeg -i in.mp3 -ar 48000 -c:a pcm_f32le out.wav`); keep that cache out of git.

## Project header and render keys

```
<REAPER_PROJECT 0.1 "7.0/macOS-arm64" 1762800000
SAMPLERATE 48000 0 0
TEMPO 120 4 4
RENDER_FILE "/abs/path/renders"
RENDER_PATTERN $region
RENDER_FMT 0 2 48000
RENDER_1X 0
RENDER_RANGE 3 0 0 0 1000
RENDER_RESAMPLE 3 0 1
RENDER_ADDTOPROJ 0
RENDER_STEMS 0
RENDER_DITHER 0
RENDER_NORMALIZE 0 1 0
<RENDER_CFG
ZXZhdxgAAA==
>
MARKER 1 1.0 "screech" 1
MARKER 1 3.8 "" 1
```

- `RENDER_RANGE 3 …` = all regions; `RENDER_PATTERN $region` = one file per region, named after it.
- `<RENDER_CFG` `ZXZhdxgAAA==` = WAV, 24-bit (base64 of `evaw` + bytes 0x18 0x00 0x00).
- A region is two `MARKER` lines with the same id and trailing flag `1`: start with the name, end with `""`.

## Track, FX chain, sends, items

```
<TRACK {GUID}
NAME "voice · rattle"
VOLPAN 1 0 -1 -1 1
MAINSEND 1 0
NCHAN 2
<FXCHAIN
SHOW 0
LASTSEL 0
DOCKED 0
BYPASS 0 0 0
<JS sstillwell/hpflpf ""
110 5000 0 - - - …(64 values, "-" for unused)
>
FLOATPOS 0 0 0 0
FXID {GUID}
WAK 0 0
>
<ITEM
POSITION 1.000000
LENGTH 1.900000
LOOP 0
FADEIN 1 0.04 0 1 0 0 0
FADEOUT 1 0.3 0 1 0 0 0
VOLPAN 1.000000 0 1 -1
NAME "rattle · crane"
SOFFS 8.950000
PLAYRATE 0.500000 0 0 -1 0 0.0025
<SOURCE WAVE
FILE "/abs/path/crane.wav"
>
>
>
```

- Each FX in a chain: `BYPASS 0 0 0`, the FX block, `FLOATPOS 0 0 0 0`, `FXID {GUID}`, `WAK 0 0`.
- **Item**: `SOFFS` = offset into the source (s); `LENGTH` = source length ÷ rate (project time); `VOLPAN` first value = linear gain (`10**(dB/20)`); `FADEIN`/`FADEOUT` second value = seconds.
- **`PLAYRATE <rate> 0 …`**: second field `0` = preserve pitch off = varispeed (pitch and speed together). This is the core creature-voice tool. Rest of the line: copy as-is.
- **Send** (on the bus track, one line per source): `AUXRECV <source track index, 0-based> 0 <linear gain> 0 0 0 0 0 0 -1:U 0 -1 ''` (copy the other fields as-is).

## Stock FX state

- **`<JS sstillwell/hpflpf "">`** (RBJ high-pass + low-pass, 12 dB/oct each): sliders in natural units `[HP Hz, LP Hz, gain dB]`. Its UI ranges are HP 0–1000, LP 1000–22000, gain ±20, but the code reads the stored value unclamped, so an HP of 2000 in the `.rpp` works. Two in a row = a steeper slope.
- **`<JS loser/Saturation "">`**: one slider, `[amount %]` (0–100).
- **ReaVerbate** (VST): the block is a fixed first line, a fixed header line, one base64 line of the parameters, and a fixed footer:

```python
import base64, struct
def verbate(wet, dry, room, damp, width, delay, lowpass, hipass):  # all 0..1
    body = bytes.fromhex("efbeadde0df0adde") + struct.pack("<8f", wet, dry, room, damp, width, delay, lowpass, hipass)
    return ['<VST "VST: ReaVerbate (Cockos)" reaverbate.vst.dylib 0 "" 1920361016<56535472766238726561766572626174> ""',
            "OGJ2cu9e7f4CAAAAAQAAAAAAAAACAAAAAAAAAAIAAAABAAAAAAAAAAIAAAAAAAAAKAAAAAAAAAAAABAA",
            base64.b64encode(body).decode(), "AAAQAAAA", ">"]
```

The `.dylib` name is the macOS one [UNVERIFIED on Windows/Linux: add the FX once in REAPER and copy the first line from the saved `.rpp`]. Bus settings that worked (wet 1, dry 0 on the bus):

| Space | room | damp | width | delay | lowpass | hipass |
|---|---|---|---|---|---|---|
| Open night (long, dark, pre-delay) | 0.90 | 0.72 | 1.0 | 0.10 | 0.50 | 0.06 |
| Wooden room | 0.28 | 0.55 | 0.8 | 0.02 | 0.70 | 0.04 |
| Vast (a voice from nowhere) | 0.98 | 0.35 | 1.0 | 0.16 | 0.60 | 0.03 |
| Concrete bunker (bright, ringing) | 0.62 | 0.22 | 0.9 | 0.03 | 0.85 | 0.05 |

For any other stock FX, add it once in REAPER, save, and copy its block from the `.rpp`.

## Recipe shape

Keep each game sound as data so a change is a one-line edit and the credits table can name the layers:

```python
# layer: (track, source, soffs, srclen, pos, rate, vol_db, fade_in, fade_out)
sound("rattle", length=1.9, tail=1.2, loop=False, layers=[
    L(voice_rattle, "crane", 8.95, 0.95, 0.0, rate=0.5, vol=0, fi=0.04, fo=0.3),
    L(voice_rumble, "grizzly", 2.3, 1.2, 0.0, rate=0.8, vol=-5, fi=0.15, fo=0.4),
])
```

Region length = sound length + reverb tail (loops: render a few extra seconds, then crossfade the tail into the head; `sound-design.md` → *Delivery*).
