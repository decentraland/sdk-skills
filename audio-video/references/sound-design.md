# Sound design from real recordings

Build every scene sound the catalog does not cover from **real field recordings**: public-domain or CC0, trimmed, layered, re-pitched and filtered. Creators hear a tone generator or noise-shaped synthesis at once and reject it: an ambience made with `ffmpeg`/python (2026-10) and a whole horror kit called "lacking realism, too synthetic" (2026-11). The redo of that kit from field recordings in REAPER was approved. A real recording trimmed with `ffmpeg` alone already beats a synthesized one, so this route works without any audio editor.

## Steps

1. **Catalog first** for generic UI, music and game cues (`audio-catalog.md`). For anything specific (a creature, a place, a machine, an animal, weather), build it from recordings (steps 2–6) even when a catalog clip is close.
2. **Suggest REAPER to the user**, every time you make or rework sounds: what it gives them, how to get it and the MCP (→ *REAPER*). Carry on with whichever path they have: REAPER (MCP or headless) or plain `ffmpeg`.
3. **Source** recordings (→ *Sources*). Confirm downloads with the user first (**sdk-scenes** → confirmation rules). Write each credit as you download.
4. **Shape** each sound from layers (→ *Processing*, *Recipes*).
5. **Verify by measurement** (→ *Verifying without ears*). Tell the user plainly the renders were checked by measurement, not by listening.
6. **Deliver**: level-match, crossfade loops, encode, keep the kit out of the deploy (→ *Delivery*). Wiring the sounds into the scene: `ambience-design.md`.

Done when every new file in the scene's audio folder has a credit line, a measured level, and its source chain recorded in the scene's notes.

## Sources

Licence filter: **public domain or CC0**. CC BY / CC BY-SA also work but need a credit wherever the scene is published; offer the choice to the user (one owner chose PD/CC0 only).

### NPS Yellowstone sound library

`https://www.nps.gov/yell/learn/photosmultimedia/soundlibrary.htm`. Terms (verified 2026-11-11): "recorded in the park and are in the public domain. They may be downloaded and used without limitation; however, please credit the 'National Park Service' where appropriate."

- Contents: birds (raven, sandhill crane, common loon, Canada goose, …), other animals (red fox, elk, coyotes, wolves, grizzly bear, bison, mountain lion, frogs and toads), geothermal (fumaroles, Black Growler steam vent, geysers, mud pots), natural phenomena (thunder, wildfire, singing lake), soundscapes (night lake, dawn chorus, wind in trees).
- Each sound has its own page (`/yell/learn/photosmultimedia/sounds-<name>.htm`, e.g. `sounds-redfox.htm`; the grizzly page is `grizzlysounds.htm`). The library page links pages, not files. Get the MP3 from the page:
  `curl -sL -A "<tool-name>/1.0" <page-url> | grep -o 'avElement/[^"]*\.mp3' | sort -u`
- MP3 URL pattern: `https://www.nps.gov/nps-audiovideo/legacy/mp3/imr/avElement/yell-<Name>.mp3`.
- Geothermal vents slowed down are excellent drones and hums; slowed animals are excellent creature voices (→ *Recipes*).

### Wikimedia Commons

- Search: `https://commons.wikimedia.org/w/api.php?action=query&list=search&srnamespace=6&srsearch=<terms>+filetype:audio&format=json`, then `action=query&prop=imageinfo&iiprop=url|extmetadata&titles=File:<name>` to read `LicenseShortName`, `Artist` and the file `url`.
- Commons also hosts copies of the NPS Yellowstone recordings (`Yellowstone sound library - <animal> - 001.mp3`), sometimes ones the NPS page lacks.
- Files named `LL-Q…` are Lingua Libre word pronunciations, not sound effects; skip them.
- Rate limits: the API returned HTTP 429 after ~8 rapid requests; the file server (`upload.wikimedia.org`) returned 429 after ~20 quick downloads and locked out for ~15 minutes. Pace downloads **10 s or more apart**.

### Download hygiene

- Use `curl` (`-sSL --fail`). On macOS the system Python's `urllib` failed SSL certificate verification against both hosts; `curl` worked.
- Send an honest, descriptive `User-Agent` naming a generic tool (`-A "scene-audio-research/1.0"`), never a browser string and never the user's personal details.
- Keep raw downloads in a source folder outside the deploy (e.g. `sound-design/src/`), not in `assets/`.
- Write the credit **while downloading**: title, author, licence, source URL, into the scene's notes (e.g. `design/audio-sources.md`), plus one line per game sound naming what it is made from.

## Processing

### Without a DAW: ffmpeg

One command trims, filters, varispeeds, fades and encodes (verified, ffmpeg 6.1):

```bash
ffmpeg -ss 0.66 -t 0.64 -i fox.mp3 -af "aresample=48000,\
highpass=f=300:poles=2,highpass=f=300:poles=2,\
afade=t=in:d=0.005,afade=t=out:st=0.5:d=0.14,\
asetrate=48000*0.8,aresample=48000" -ac 1 -c:a libvorbis -q:a 4 scream.ogg
```

- `asetrate=48000*R,aresample=48000` is **varispeed**: pitch and speed change together (R 0.8 → 0.64 s becomes 0.80 s, lower). Fade times before it are in source time.
- Repeat `highpass` for a steeper slope (each is 12 dB/oct).
- Find the events in a long recording with `silencedetect`: `ffmpeg -nostats -i in.mp3 -af silencedetect=noise=-35dB:d=0.2 -f null -` prints `silence_end` = event starts.
- Layer with `amix=inputs=N:normalize=0` (`normalize` defaults to true and drops every input's level).

### REAPER

Layers on tracks, filters per layer, shared reverb buses, varispeed per item, and the user can open the project to listen and tweak.

**Get it** (reaper.fm, checked 2026-11-11): download from `https://www.reaper.fm/download.php` (Windows, macOS, Linux; v7.85 at the time). "Free, fully functional 60-day evaluation", no registration. Licences (`https://www.reaper.fm/purchase.php`): **$60 discounted** for an individual's personal use, an individual or business with yearly gross revenue up to USD 20,000, or an educational/non-profit organization; **$225 commercial** otherwise. The site does not state what happens after the 60 days; don't claim either way.

**REAPER MCP** ([TwelveTake-Studios/reaper-mcp](https://github.com/TwelveTake-Studios/reaper-mcp), MIT, PyPI `twelvetake-reaper-mcp`; README checked 2026-11-11). Needs Python 3.10+ and [`uv`](https://docs.astral.sh/uv/).

1. Install the bridge: `uvx twelvetake-reaper-mcp --install-bridge` copies `reaper_mcp_bridge.lua` into REAPER's `Scripts` folder and the analyzer JSFX the measurement tools use into `Effects/TwelveTake` (ReaPack or a manual copy also work; see its README).
2. Start the bridge **inside REAPER** (the user does this): **Actions → Show action list → New action → Load ReaScript**, pick `reaper_mcp_bridge.lua`, **Run**. It runs in the background until REAPER closes; next time type `mcp bridge` in the action list filter. To start it with REAPER every time: `uvx twelvetake-reaper-mcp --install-bridge --autostart`.
3. Register with Claude Code: `claude mcp add -s user reaper -- uvx twelvetake-reaper-mcp`, then start a new session; tools appear as `mcp__reaper__*`. Other clients: `"mcpServers": { "reaper": { "command": "uvx", "args": ["twelvetake-reaper-mcp"] } }`.
4. Check: `get_project_summary` (or `get_track_count`) answers. A timeout means REAPER is closed or the bridge is not running. Server and bridge talk through JSON files in REAPER's `Scripts/mcp_bridge_data`; there is no port.

**Pick the path by state, and say which one you are on:**

| State | Path |
|---|---|
| `mcp__reaper__*` present and answering | MCP for live work in the user's open project: tracks, FX and params, items, MIDI, `measure_loudness`, `measure_spectrum`, `find_silence`. Each edit is one undo step. |
| `mcp__reaper__*` present, calls time out | **Ask** the user to open REAPER and run the bridge, or to approve the headless path. As a subagent, report the choice to your caller. |
| No MCP, REAPER installed | Headless batch path; mention the MCP and its setup in the report. |
| No REAPER | `ffmpeg` path; suggest REAPER (60-day evaluation) in the report. |

- **Never call `open_project` while the open project has unsaved changes.** REAPER raises its modal "save changes?" dialog, the bridge hangs for good (it stayed dead after the dialog was dismissed) and the user must restart the bridge script. Ask the user to save or open the file themselves. You cannot see or click REAPER dialogs.
- The MCP worked for tracks, FX, params and MIDI. FX params go through it normalized (0–1); to set JSFX filters in natural units (Hz, dB), write them into a generated `.rpp`.

**Headless batch path** (robust for a whole kit; needs no bridge):

1. A recipe script writes the `.rpp` as plain text: one region per game sound, one track per layer with its filters, reverb buses fed by sends, items with source offset, varispeed and fades. Format, FX state and a skeleton: `reaper-rpp.md`.
2. Render every region to its own file: `/Applications/REAPER.app/Contents/MacOS/REAPER -newinst -nosplash -renderproject kit.rpp` (macOS path; flags from `REAPER -h`). A kit of 30+ regions renders in seconds.
3. The user can open the same `.rpp` in REAPER to listen and tweak. Hand edits are lost when the script regenerates it: carry them back into the recipe, or render from REAPER.

## Recipes

Approved by a creator, several called "excellent" (2026-11). Rates are varispeed (pitch follows speed).

| Sound | Made from |
|---|---|
| Creature scream | red fox screams at 0.7–0.8×, around an elk bugle's rising squeal, light saturation |
| Creature call | raven croaks at ~0.6× |
| Deep rolling croak | sandhill crane bugle at 0.5×, over a grizzly roar at 0.8× |
| Close threat | grizzly jaw pops at 0.7×, a breath after |
| Roar / chest rumble | grizzly roar at 0.85× |
| Moans | elk chorus at 0.25× |
| Drone | steam vent at 0.35×, long vast reverb |
| Breath | fumarole steam burst at 0.6×, shaped fades |
| Electrical hum | 50 Hz mains-hum recording at 1.2× = 60 Hz |
| Wingbeat | short shaped bursts of real wind at 0.55× over a slowed thud |
| Far one-shot (scream, knock, creak) | distance baked in: band-limited (no highs, e.g. HP 350 Hz / LP 3.5 kHz) and heavy reverb |
| Tree groan | a door-hinge creak at 0.5× |
| Drip | single glass ticks at 1.5–2.0×, irregular spacing, bright concrete reverb |

- **Steep high-pass on every field recording** (two cascaded filters) to remove wind and traffic rumble.
- **One reverb bus per space**, fed by sends from each layer: open night (long, dark, pre-delay), wooden room (short), vast (for a voice), concrete bunker (bright, ringing).
- **Hear it, don't narrate it.** Where a caption says something is happening (a dog howling, something moving in the trees), the creator wanted the sound instead of the text.

## Verifying without ears

You cannot listen. Measure instead:

- **Spectrogram**, then read the PNG as an image (rumble, missing highs, clicks, tonal lines):
  `ffmpeg -i x.ogg -lavfi showspectrumpic=s=1400x350:legend=1:scale=log:fscale=log:stop=8000 x.png`
- **Loudness and true peak**: `ffmpeg -nostats -i x.ogg -af ebur128=peak=true -f null -` (read the Summary).
- **Events in long recordings**: `silencedetect` (above) or a 10 ms RMS envelope scan with numpy.
- With the MCP: `measure_loudness`, `measure_spectrum`, `find_silence`.

## Delivery

- **Match the level of the file you replace.** One-shots: by the loudest 400 ms RMS window. Loops: by average RMS (matching a loop by its loudest window set it wrong). New files: by peak target. Soft-limit the rare overs rather than clip.
- **Loops**: equal-power crossfade the tail into the head (render the loop with a few seconds of tail; `head = x[:X]·sin(t) + x[L:L+X]·cos(t)`, t from 0 to π/2, keep `x[:L]`).
- **Encode** Ogg Vorbis, `-c:a libvorbis -q:a 4` (mono) to `5` (stereo). Mono for spatial sources; stereo only for `global: true` beds.
- **Keep the kit out of the deploy**: add its folder (`sound-design/`, sources, project, renders) to `.dclignore` (**deploy-scene** → `.dclignore`). Keep large WAV caches and renders out of git (`.gitignore`); commit the recipe scripts, the `.rpp` and the credits.
- **Credit line** for the scene description when sources ask for it, e.g. *Sound recordings: National Park Service (Yellowstone sound library) and Wikimedia Commons contributors, public domain / CC0.*
