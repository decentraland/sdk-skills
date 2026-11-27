# Post videos (opt-in): one footage post → `promote/videos/<post id>.mp4`

**Never part of the first run.** A video is made only when the creator asks for one, usually by pasting the prompt that the kit page's **Copy video prompt** button writes ("Generate the video for the footage post `footage-02` … Use the promote-scene skill if you have it …"). The prompt is written for any AI coding assistant, so it also names the kit files to read when this skill is absent. One post per request. Each video is minutes of rendering and a lot of tokens, so do not offer to "do the rest" in the same run; say which post would be the best next one and stop.

The pattern comes from the JAWS ON THE GRID trailer (github.com/dcl-regenesislabs/jaws-in-grids-video-trailer): gameplay clips in `public/`, an edit list in seconds, text cards, placeholders for clips that do not exist yet, a logo end card, music, all rendered with Remotion. This skill ships a smaller data-driven version of it in `{baseDir}/scripts/video/`.

## What a post video is

| Post | Length | Content |
|---|---|---|
| footage post | what its `footage` note says, usually 6–15 s | the moment the note describes, the post's own lines as on-screen text, the logo at the end |
| the "trailer cut" footage post | ≤ 30 s (Foundation limit) | the note's timed shot order; people in motion in the first 3 s (only a real recording can do this); end card with lockup + link |

Always 16:9 1920×1080, 30 fps, H.264. Captions on screen, so it works muted. A 9:16 cut (`<post id>-9x16.mp4`) when the note mentions a reel, story or vertical, or when asked. The page shows the 9:16 cut in Instagram mode.

**Shorts (`kind: "short"`)** are vertical only: set `vertical: true` on the edit and render the `<id>-9x16` composition straight to `../videos/<id>.mp4` (1080×1920; `build_kit.py` expects that size for a short and warns over 60 s). The first card is the post's `hook`, over the picture, from 0 to about 2 s; the `beats` follow as cards in order; the end card carries the link. Same footage ladder; set `focus` on every shot so the middle third keeps the subject. The same file serves Reels and TikTok. Learned on the Eeireport Shorts (2026-10-22): a 9:16 cover crop keeps the full height of a 16:9 take and only the middle 56 % of its width, so a wide composition (a rope line, a booth to one side) loses its context and a dark take (the carousel hall) reads as a black band: read a 1-fps sheet of the vertical render before calling it done, move `focus` or `trimStart` to a window where the subject sits mid-frame, and lift a dark take with `grade: "brightness(2) contrast(1.15)"`. Third-person takes put the avatar and its nameplate in every frame, so the avatar check in `video-capture.md` matters twice as much here.

## Footage ladder (best first; say in the report which rung you used)

Full rules, the capture script and what was learned recording real scenes: `{baseDir}/references/video-capture.md`. Read it before choosing a source.

1. **Real playthroughs that already exist** (`promote/footage/`, playtests, earlier capture sessions), indexed with `footage_index.py`.
2. **Takes recorded from the Explorer** with `promote/tools/capture_play.py`, for the moments the recordings miss.
3. **Blender clips** of the scene's own models (`render_shots.py -- clip`): mood and establishing shots.
4. **The kit's own stills** with slow camera motion: a teaser, not footage.

A shot whose footage does not exist in any form gets `{ placeholder: "RECORD: …" }`, which renders a labelled slate. A kit image that is not on disk yet (key art before `compose_social.py`, the lockup before `make_logo.py`) renders a `MISSING: <file>` slate, and the end card shows the game name until the lockup exists, so the cut renders anyway. Fine for timing a trailer; never ship a video with a slate in it.

Square images (renders, quote cards) are cover-cropped to 16:9: set `focus: [50, 100]` on a quote card so its text at the bottom survives, and check the frame sheet.

**Audio**: only the scene's own files (`assets/**/*.ogg|mp3|wav`, copied or symlinked into `promote/music/`) or a track the creator put in `promote/music/` and named the licence for. Never download music. Scene ambience loops (a drone, a hum) work well under 10 s posts. `music: null` is a valid answer. Recordings are used muted; the mix is music only.

## Setup (first video only)

```bash
cp -R {baseDir}/scripts/video promote/video
cd promote/video && mkdir -p public && for d in images logo footage clips music fonts; do mkdir -p ../$d; ln -sfn ../../$d public/$d; done
npm ci                 # pinned by the shipped package-lock.json; ~40 s, ~340 MB in promote/video/node_modules, ~1.1 GB once the first render has downloaded the headless Chrome shell (git-ignored by the template; promote/ is already in .dclignore)
```

Windows (cmd, no admin needed): `mklink /J public\images ..\images` for each of the six folders instead of `ln -sfn`.

`public/` holds symlinks into the kit, so `staticFile("images/renders/hero.png")`, `"footage/…"`, `"clips/…"`, `"logo/…"`, `"music/…"`, `"fonts/…"` all resolve without copying anything (verified: Remotion follows them when bundling). `src/lib/config.ts` imports `promote/posts.json` for the game name, tagline, link, `brand.accent` and the image list, so the cards match the kit's colours and the shipped `example` edit renders from whatever stills the kit has. The first `npx remotion render` downloads a headless Chrome shell (one-off).

**Font.** By default the cards use Bebas Neue fetched from Google Fonts at render time, so a render with no network fails. To render offline, or to match the kit's wordmark, copy `brand.font` into `promote/fonts/` and set `"video_font": "fonts/<file>.ttf"` in `brand` (`posts.json`); `src/lib/fonts.ts` then loads that file through `@remotion/fonts` and never touches the network.

**Licence.** Remotion is free for individuals, non-profits and for-profit companies with up to three employees; larger for-profit organisations need a company licence (https://www.remotion.dev/docs/license). Put that line in the README's Rights note when a video is made, so a studio knows before it ships one.

The Remotion skills the jaws repo used (`npx skills add remotion-dev/skills`) are optional, third-party and unpinned: the template already covers what a post video needs, so do not install them by default, and if the creator wants something the template does not do (captions from a transcript, maps, 3D), read what that package installs before adding it.

## Authoring the edit (`promote/video/src/edits.ts`)

Add one `Edit` to `EDITS` with `id` = the post id (this is the composition id, so `npx remotion render footage-02 …` works). Delete the `example` entry once a real one exists. Types and the four source kinds are documented at the top of the file.

- **Times in seconds**, `duration` = the length the footage note asks for. Shots must tile the whole duration up to `end.from`; a gap shows black.
- **Cards are the post's lines, verbatim**, split at the post's own line breaks, about six words per card. Nothing the footage note says to keep out (the ending, the solution, the final card, instant-death options), and nothing the post text does not say. Captions (`caption` on a shot) are short labels for a mechanic or UI element named in the note.
- **Cutscene shots end before the camera cuts back**: the dip back lands on whatever the game state was (an overlay, the previous room). Find the return frame on the take's sheet and set `to` a few frames before it.
- **Frame 0 is the thumbnail** (Slack, X, every feed): open on bright gameplay with the hook already on screen. A card with `from: 0` and `over: true` is fully visible at frame 0; give the first shot no `dip` (an `over: false` card at 0 is a black frame).
- **Rhythm**: one `punch` or `flash` on the beat of the post's key line, a hard `cut` elsewhere. Do not stack fx on short shots. Stills get a `move`; recordings get a slow push automatically.
- **End card**: `logo` = the lockup on black (or the wordmark) from `promote/logo/`, `line` = "Live on Decentraland", "Coming soon" or a date when the logo is the lockup (it already carries the tagline; repeating it under the logo reads as a mistake), the tagline itself only under the bare wordmark, `link` = the jump link from `posts.json` or `""`. Give it 2.5–3.5 s. Optional `backdrop` = the landscape key art, blurred behind.
- **Vertical** (`vertical: true`): the same edit in 1080×1920. `objectFit: cover` keeps the middle third of each 16:9 source, so set `focus: [x%, y%]` on any shot whose subject is off-centre. Text scales up on portrait automatically, and stays inside the platforms' safe zone (x 120–960, y 240–1260), clear of the Reels / TikTok / Shorts buttons.
- **More sizes** (`sizes: ["9x16", "1x1", "4x5"]`): each one its own composition (`<id>-1x1` 1080×1080, `<id>-4x5` 1080×1350), laid out natively.
- **Languages** (`langs: ["pt", "en"]`): every card, caption and end line becomes `{ pt: "…", en: "…" }`, and each composition is registered once per language (`footage-02-pt`, `footage-02-9x16-en`). The bare ids (`footage-02`, `footage-02-9x16`) render the first language, so the commands below and `videos/<post id>.mp4` work unchanged; render the others to `videos/<post id>-<lang>.mp4`. A missing translation, or a line left as a plain string, stops the render instead of shipping one language's line in another.
- **`zoom`** on a video source (e.g. `zoom: 1.15, focus: [50, 100]`) scales around the focus point and pushes the opposite edge out of frame: a currency HUD, a nameplate, a dev overlay.
- Keep the trailer honest: no "players love it", no claims the GDD or brief does not make, no inspirations unless the owner opted in (same rules as the posts).

## Render and verify

**First, mark the post as in progress** so the kit page shows a spinner on that card instead of the bare placeholder (the page re-reads its data every 30 s):

```bash
python3 promote/tools/build_kit.py --rendering footage-02   # writes promote/videos/footage-02.rendering (UTC time) and rebuilds; same on Windows
```

As soon as the video file is in place, `python3 promote/tools/build_kit.py --done footage-02` deletes the marker and rebuilds; a marker left behind keeps the spinner up (the builder warns when one is over three hours old).

```bash
cd promote/video
npx remotion still footage-02 --frame=45 out/f45.png        # ~3 s: check a card over its shot before rendering everything
npx remotion render footage-02 ../videos/footage-02.mp4      # 15-60 s per post video (an 8 s still-based post ~13 s, the 30 s trailer ~45 s)
npx remotion render footage-02-9x16 ../videos/footage-02-9x16.mp4
```

Then read the result, not just the log:
- `ffprobe -v error -show_entries stream=codec_type,width,height,duration -of csv=p=0 ../videos/footage-02.mp4` → 1920×1080, the intended length, an audio stream only if `music` is set.
- `ffmpeg -v error -y -i ../videos/footage-02.mp4 -vf "fps=1,scale=480:-1,tile=5x2" -frames:v 1 out/sheet.png` and read it: every card legible, no slate, the end card complete, nothing cut off in the vertical version.
- Frame 0 is not dark: `ffprobe -v error -f lavfi -i "movie=../videos/footage-02.mp4,select=eq(n\,0),signalstats" -show_entries frame_tags=lavfi.signalstats.YAVG -of csv=p=0` prints its mean luma (black is 16; bright gameplay reads around 100).
- `npx remotion studio` is the live editor if the creator wants to scrub through and adjust timings themselves.

`python3 promote/tools/build_kit.py --done footage-02` removes the marker and picks the files up by name (`videos/<post id>.mp4`, `videos/<post id>-9x16.mp4`; or an explicit `"video": "videos/<file>.mp4"` on the post), embeds them on the page, lists them in `copy.md` and the shot list, and warns if a video is over 30 s or not 1920×1080. Delete `promote/video/out/` and `images/preview/*_clip.mp4`.

## README, report and the follow-up

Add a **Videos** section to `promote/README.md`: each file, its post, the footage rung it came from, the music and its licence, how to re-render (`cd promote/video && npx remotion render <id> ../videos/<id>.mp4`), that `promote/video/node_modules` can be deleted and reinstalled with `npm ci`, and the Remotion licence line (free for individuals and companies up to three people; company licence above that) in the Rights note. Report, in this order:

1. **Where the video is, unmissably.** The absolute path of every file written, each as a clickable link to the local file, in a list of its own at the top of the report, not inside a sentence: `[footage-02.mp4](file:///Users/…/promote/videos/footage-02.mp4)` (and the `-9x16` file, and `promote/index.html` where it plays). Say the length and format next to each. A creator who has to hunt for the file has not received it.
2. The file paths and lengths, the source used per video (which takes were recorded, which moments stayed on Blender clips and why, and that the Explorer was driven by `capture_play.py` over HTTP if the native tools were not bound), what was kept out, and the one post that would be the best next candidate. Do not generate it.
3. **Ask what worked and what did not, and mean it.** A first cut is a draft: the timing of a card, a shot that runs long, a take with the wrong moment, music too loud. End the report by asking the creator directly which parts work and which do not (name the things most likely to need a change: shot order, card timing, the moment chosen, the music), and offer the concrete knobs: `edits.ts` times, a retake of one named take, a different footage rung. Then iterate on exactly what they name: edit, re-render that one video, rebuild the kit, give the link again. Repeat until they are happy; do not move on to another post on your own.
