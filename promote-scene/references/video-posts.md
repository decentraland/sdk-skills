# Post videos (opt-in): one footage post → `promote/videos/<post id>.mp4`

**Never part of the first run.** A video is made only when the creator asks for one, usually by pasting the prompt that the kit page's **Copy video prompt** button writes ("Generate the video for the footage post `footage-02` … Use the promote-scene skill if you have it …"). The prompt is written for any AI coding assistant, so it also names the kit files to read when this skill is absent. One post per request. Each video is minutes of rendering and a lot of tokens, so do not offer to "do the rest" in the same run; say which post would be the best next one and stop.

The pattern comes from the JAWS ON THE GRID trailer (github.com/dcl-regenesislabs/jaws-in-grids-video-trailer): gameplay clips in `public/`, an edit list in seconds, text cards, placeholders for clips that do not exist yet, a logo end card, music, all rendered with Remotion. This skill ships a smaller data-driven version of it in `{baseDir}/scripts/video/`.

## What a post video is

| Post | Length | Content |
|---|---|---|
| footage post | what its `footage` note says, usually 6–15 s | the moment the note describes, the post's own lines as on-screen text, the logo at the end |
| the "trailer cut" footage post | ≤ 30 s (Foundation limit) | the note's timed shot order; people in motion in the first 3 s (only a real recording can do this); end card with lockup + link |

Always 16:9 1920×1080, 30 fps, H.264. Captions on screen, so it works muted. A 9:16 cut (`<post id>-9x16.mp4`) when the note mentions a reel, story or vertical, or when asked. The page shows the 9:16 cut in Instagram mode.

## Footage ladder (best first; say in the report which rung you used)

1. **The creator's recordings in `promote/footage/`.** Anything they captured in the Explorer (QuickTime, OBS, the phone via `adb shell screenrecord` or `scrcpy --record`). Inspect before cutting: `ffprobe -v error -show_entries stream=width,height,r_frame_rate,duration -of csv=p=0 <file>`, then a contact sheet you can read: `ffmpeg -v error -y -i <file> -vf "fps=1,scale=320:-1,tile=6x5" -frames:v 1 <scratch>/sheet.png` (one frame per second). Pick `trimStart` from the sheet. Phone captures are wider than 16:9: `objectFit: cover` crops the sides, so check the subject is still in frame.
2. **Record it yourself from the Explorer with `promote/tools/capture_play.py`** (verified on The Horseman's Night, 2026-10-19: seven gameplay takes in about 15 minutes). The scene preview must run with the Explorer MCP server on (`npm run start -- --mcp --skip-auth-screen true`); follow **unity-explorer-mcp**'s intent and launch gates before starting or touching an Explorer. The script talks to that server over plain HTTP (`http://127.0.0.1:8123/unity-explorer-mcp`), so it works whether or not the `mcp__explorer__*` tools are bound in the session; it is the pre-established driver the creator can re-run, not the per-action curl loop. Copy `{baseDir}/scripts/capture_play.py` and `{baseDir}/scripts/takes.example.py` (as `takes.py`) into `promote/tools/`, rewrite `takes.py` from the scene's source (trigger rectangles, NPC spots, input actions, debug keys), then `python3 promote/tools/capture_play.py probe` (scene ready, player state, frames per second) and `… take <name>`. A take moves the player (`move_to` teleports between shots, `walk` for anything on camera, `press_input` for the scene's actions) and wraps the stretch to record in `with rec.take("name"):`: a background thread calls the `screenshot` tool as fast as it serialises (12–14 frames/s at 1920 wide, world-only, Apple Silicon) and ffmpeg holds each frame for the time it really took, giving a 1920×1080 30 fps clip in real time (slightly stepped motion; `assemble … --smooth` interpolates, better for pans than for cuts). Rules learned on the first scene:
   - **Look at the avatar before the first take, and ask.** Take one screenshot with the player in frame and read it: the wearables (an aura, a glowing effect, a loud outfit, a costume from another game), the nameplate, any emote still playing. Judge whether that avatar belongs in this game's footage (a horror airport is not the place for a purple particle halo). If it does not fit, stop and ask the creator what they think and whether they want to change wearables before the next shot: the avatar is in every third-person frame, the Explorer cannot swap outfits for you, and a wearable change is a session-level decision only they can make. Say what you saw, suggest the plainest fitting look, and wait for the answer before recording anything else. Ask once per session, not per take, unless they change the avatar.
   - **Write nothing under the scene folder while the Explorer is up.** The dev server rebuilds and restarts the scene on any change there, `promote/` included (`.dclignore` does not stop the watcher), and a restart mid-take brings the title card back and locks the player. Frames and clips go to `$CAPTURE_OUT` (default `<scene>/../capture/`); copy the clips into `promote/footage/` once all takes are done; edit `takes.py` in a scratch copy. A restart also resets session progress and re-arms once-per-session events (apparitions, cutscenes), which is how to retake one.
   - `walk` is camera-relative. Under a fixed SDK camera forward is the camera's yaw (north-east at yaw 45°), so measure one leg against `get_player_state` first. `look_at` is refused under a scene camera; `move_to` with `lookAt*` still turns the avatar, and scenes usually aim attacks where the avatar faces or last walked (a 0.12 s `walk` nudge re-aims).
   - `press_input` aimed at an empty world point (`x/y/z`, nothing clickable there) reaches the scene root: that is how global inputs go in (slash, dash, E, the title-card click, the scene's debug keys). A scene's own cheats and skips are fair game for reaching a moment (one-hit kills, "break the next seal"), but keep their overlay out of the frames.
   - Cheap targets: scripted events and cutscenes (walk into the trigger, wait), dialogues (E, then a click per line), a player walking (the trailer's "people in motion"), a parry on a telegraphed projectile (keep swinging every 0.35 s while it arrives). Hard: anything that needs enemy positions, since `list_scene_entities` returns ids, not names — airborne enemies, shield blockers, a boss phase. Use Blender clips for those and say so in the README.
   - Captures are world-only (no HUD, no letterbox bars) but the avatar's nameplate stays in; the Foundation's clean "no UI" screenshot still needs a human take with nameplates hidden.
   - Dev overlays draw into world-only captures (debug shapes, hit labels): scenes often ship with one on by default. Turn it off before recording and toggle it back only for a skip key.
   - Long fight takes are raw material, not kit files: record two minutes, pick the window from the sheet, trim that window into `promote/footage/` (`ffmpeg -ss <s> -t <len> -i take.mp4 -c:v libx264 -crf 18 …`) and keep the raw take outside the kit.
   - Pick the input cadence from the mechanic's own windows in the source (a parry that accepts any bolt within 2 m of a swing needs a swing every 0.35 s; a dialogue needs one click per line). Reading forgiveness windows beats guessing.
   - Read a contact sheet of every take before cutting (`ffmpeg … -vf "fps=1,scale=480:-1,tile=5x4"`); check the player actually moved (`ex.pos()` before and after) because a locked player records a static shot without any error.
   - A real screen recording still beats frame bursts (60 fps, the scene's audio). On macOS `screencapture -V <seconds> <file>` needs Screen Recording permission for the terminal: without it the command exits 1 and writes nothing. When the creator grants it, drive the same takes and record the screen instead of frames.
3. **Blender clips of the scene's own models**: `$B -b -P promote/tools/render_shots.py -- clip preview <shot>` (640×360, writes `images/preview/<shot>_clip.mp4`), read two frames of it (`ffmpeg -i … -vf "select='eq(n\,0)+eq(n\,179)',tile=2x1" -vsync 0 check.png`), then `-- clip <shot>` → `promote/clips/<shot>.mp4` (1920×1080, `CLIP_SECONDS` = 6 s, EEVEE). The move is a slow push-in with a 4° orbit by default; set `CLIP_MOVES['<shot>'] = dict(orbit=…, dolly=…, rise=…)` for something else (`dolly` is a fraction of the camera distance, negative = closer). The same `SHOTS` functions and lighting are used, so nothing new to frame. Measured on Apple Silicon: a 6 s 1080p clip takes 2–3 minutes (Eeireport's kit-built rooms 130–180 s each, nine clips in 22 min sequentially); a whole-interior scene with many point lights is at the slow end, and the 360 px preview costs 40–130 s, most of it scene build and shader compile. A shot longer than `CLIP_SECONDS` can use `rate: 0.85` (slow motion) in the edit rather than a longer clip. Nothing animates inside the shot (no avatars, no particles, no tweens), so these suit mood, establishing and "the place" shots, not the mechanic itself.
4. **The kit's own stills with slow camera motion** (`images/renders/`, `images/keyart/`, `images/social/` quote cards). Always available, needs nothing new, and still produces a watchable post. Say so plainly in the report: this is a teaser, not footage, and the footage note remains open.

A shot whose footage does not exist in any form gets `{ placeholder: "RECORD: …" }`, which renders a labelled slate. Fine for timing a trailer; never ship a video with a slate in it.

Square images (renders, quote cards) are cover-cropped to 16:9: set `focus: [50, 100]` on a quote card so its text at the bottom survives, and check the frame sheet.

**Audio**: only the scene's own files (`assets/**/*.ogg|mp3|wav`, copied or symlinked into `promote/music/`) or a track the creator put in `promote/music/` and named the licence for. Never download music. Scene ambience loops (a drone, a hum) work well under 10 s posts. `music: null` is a valid answer. Recordings are used muted; the mix is music only.

## Setup (first video only)

```bash
cp -R {baseDir}/scripts/video promote/video
cd promote/video && mkdir -p public && for d in images logo footage clips music; do mkdir -p ../$d; ln -sfn ../../$d public/$d; done
npm install            # ~40 s, ~340 MB in promote/video/node_modules, ~1.1 GB once the first render has downloaded the headless Chrome shell (git-ignored by the template; promote/ is already in .dclignore)
```

`public/` holds symlinks into the kit, so `staticFile("images/renders/hero.png")`, `"footage/…"`, `"clips/…"`, `"logo/…"`, `"music/…"` all resolve without copying anything (verified: Remotion follows them when bundling). `src/lib/config.ts` imports `promote/posts.json` for the game name, tagline, link and `brand.accent`, so the cards match the kit's colours. The first `npx remotion render` downloads a headless Chrome shell (one-off).

The Remotion skills the jaws repo used (`npx skills add remotion-dev/skills`) are optional. The template already covers what a post video needs; reach for them only if the creator wants something the template does not do (captions from a transcript, maps, 3D).

## Authoring the edit (`promote/video/src/edits.ts`)

Add one `Edit` to `EDITS` with `id` = the post id (this is the composition id, so `npx remotion render footage-02 …` works). Delete the `example` entry once a real one exists. Types and the four source kinds are documented at the top of the file.

- **Times in seconds**, `duration` = the length the footage note asks for. Shots must tile the whole duration up to `end.from`; a gap shows black.
- **Cards are the post's lines, verbatim**, split at the post's own line breaks, about six words per card. Nothing the footage note says to keep out (the ending, the solution, the final card, instant-death options), and nothing the post text does not say. Captions (`caption` on a shot) are short labels for a mechanic or UI element named in the note.
- **Cutscene shots end before the camera cuts back**: the dip back lands on whatever the game state was (an overlay, the previous room). Find the return frame on the take's sheet and set `to` a few frames before it.
- **Rhythm**: a dip-from-black into the first shot, one `punch` or `flash` on the beat of the post's key line, a hard `cut` elsewhere. Do not stack fx on short shots. Stills get a `move`; recordings get a slow push automatically.
- **End card**: `logo` = the lockup on black (or the wordmark) from `promote/logo/`, `line` = "Live on Decentraland", "Coming soon" or a date when the logo is the lockup (it already carries the tagline; repeating it under the logo reads as a mistake), the tagline itself only under the bare wordmark, `link` = the jump link from `posts.json` or `""`. Give it 2.5–3.5 s. Optional `backdrop` = the landscape key art, blurred behind.
- **Vertical** (`vertical: true`): the same edit in 1080×1920. `objectFit: cover` keeps the middle third of each 16:9 source, so set `focus: [x%, y%]` on any shot whose subject is off-centre. Text scales up on portrait automatically.
- Keep the trailer honest: no "players love it", no claims the GDD or brief does not make, no inspirations unless the owner opted in (same rules as the posts).

## Render and verify

**First, mark the post as in progress** so the kit page shows a spinner on that card instead of the bare placeholder (the page re-reads its data every 30 s):

```bash
date -u +%FT%TZ > promote/videos/footage-02.rendering && python3 promote/tools/build_kit.py
```

Delete the marker as soon as the video file is in place and run `build_kit.py` again; a marker left behind keeps the spinner up (the builder warns when one is over three hours old).

```bash
cd promote/video
npx remotion still footage-02 --frame=45 out/f45.png        # ~3 s: check a card over its shot before rendering everything
npx remotion render footage-02 ../videos/footage-02.mp4      # 15-60 s per post video (an 8 s still-based post ~13 s, the 30 s trailer ~45 s)
npx remotion render footage-02-9x16 ../videos/footage-02-9x16.mp4
```

Then read the result, not just the log:
- `ffprobe -v error -show_entries stream=codec_type,width,height,duration -of csv=p=0 ../videos/footage-02.mp4` → 1920×1080, the intended length, an audio stream only if `music` is set.
- `ffmpeg -v error -y -i ../videos/footage-02.mp4 -vf "fps=1,scale=480:-1,tile=5x2" -frames:v 1 out/sheet.png` and read it: every card legible, no slate, the end card complete, nothing cut off in the vertical version.
- `npx remotion studio` is the live editor if the creator wants to scrub through and adjust timings themselves.

`rm promote/videos/footage-02.rendering`, then `python3 promote/tools/build_kit.py` picks the files up by name (`videos/<post id>.mp4`, `videos/<post id>-9x16.mp4`; or an explicit `"video": "videos/<file>.mp4"` on the post), embeds them on the page, lists them in `copy.md` and the shot list, and warns if a video is over 30 s or not 1920×1080. Delete `promote/video/out/` and `images/preview/*_clip.mp4`.

## README, report and the follow-up

Add a **Videos** section to `promote/README.md`: each file, its post, the footage rung it came from, the music and its licence, how to re-render (`cd promote/video && npx remotion render <id> ../videos/<id>.mp4`), and that `promote/video/node_modules` can be deleted and reinstalled with `npm install`. Report, in this order:

1. **Where the video is, unmissably.** The absolute path of every file written, each as a clickable link to the local file, in a list of its own at the top of the report, not inside a sentence: `[footage-02.mp4](file:///Users/…/promote/videos/footage-02.mp4)` (and the `-9x16` file, and `promote/index.html` where it plays). Say the length and format next to each. A creator who has to hunt for the file has not received it.
2. The file paths and lengths, the source used per video (which takes were recorded, which moments stayed on Blender clips and why, and that the Explorer was driven by `capture_play.py` over HTTP if the native tools were not bound), what was kept out, and the one post that would be the best next candidate. Do not generate it.
3. **Ask what worked and what did not, and mean it.** A first cut is a draft: the timing of a card, a shot that runs long, a take with the wrong moment, music too loud. End the report by asking the creator directly which parts work and which do not (name the things most likely to need a change: shot order, card timing, the moment chosen, the music), and offer the concrete knobs: `edits.ts` times, a retake of one named take, a different footage rung. Then iterate on exactly what they name: edit, re-render that one video, rebuild the kit, give the link again. Repeat until they are happy; do not move on to another post on your own.
