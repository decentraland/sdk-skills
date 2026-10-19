---
name: promote-scene
description: Generate a social-media marketing kit for a creator's Decentraland scene or game — post copy for X and Instagram (launch, coming soon, footage, quote cards, behind the scenes), a logo / wordmark / icon, hero renders of the scene's own 3D models, key art, quote-card images, a footage and trailer shot list, and an offline HTML page to copy and download everything. Use when the user wants to promote or market their scene or game, asks for "material to promote my game", a marketing or press kit, social media posts, tweets, Instagram captions, a logo or key art for the game, launch or teaser announcements, or a trailer shot list. Do NOT use for publishing the scene (see deploy-scene, deploy-worlds) or for the scene's own map thumbnail alone (see deploy-scene, creator-hub-mcp).
---

# Promote a Scene (Marketing Kit)

Builds `promote/` inside the scene project: posts written from the game's own design and in-game lines, a logo set, renders of the scene's own GLBs, composed social images, and `index.html`, a page that works offline where the creator edits, previews (X / Instagram), copies and downloads each post. The worked origin is the Eeireport horror jam kit; its posts and scripts, made generic, ship here.

**Default scope is a first run. Do not produce the expanded kit unless asked.**

| Output | Default (first run) | Expanded (offer afterwards) |
|---|---|---|
| Posts (`posts.json`) | 16–18: launch with link 4, coming soon 4, footage 4–5, quote 3, behind the scenes 2 | 30–35 |
| Logo (`logo/`) | 3: wordmark (transparent, hard shadow), lockup with tagline on black, 1024 icon | + flat white/black/accent wordmarks, themed variant, 400 px icon |
| Renders (`images/renders/`) | 4–6 hero shots, 1600 px square | 10–12 + 1080 px JPEG copies |
| Key art (`images/keyart/`) | 1920×1080 + 1080×1080 | + 1080×1350, 1080×1920 |
| Composed (`images/social/`) | key art with wordmark ×2, 3 quote cards, X header 1500×500 | 7 quote cards, story key art with lockup, event-page banners 1340×670 + 716×1814 (JPEG ≤ 500 KB; default only when the user mentions events) |
| Listing copy (`posts.json` `listing`) | short (~140 chars) + long description, handles, events in UTC if any | — |
| Text | `copy.md`, `footage-shotlist.md`, `README.md` | — |

The kit follows the Decentraland Foundation's marketing package checklist. Walk it with the creator: `{baseDir}/references/marketing-package.md`.

## Workflow

1. **Gather context. Every claim must trace to a source.** Always read `README`, `scene.json` (`display.title`, `display.description`, `tags`) and skim `src/` for quotable strings: dialogue, intercom/announcer lines, item descriptions, signs. These make the best copy. Voiced lines may exist only as audio files, with their wording in the design notes. Then branch on `design/`:
   - **`design/gdd.md` or design notes exist** (or `design/promo-brief.md` from an earlier run): read them.
   - **No design docs**: do not write posts from guesses. Harvest what the repo proves, then get the rest from the creator. If a `dcl-gdd` skill is available, recommend it on its Harvest route with a promotion-only frame (about five minutes; the result is `design/gdd.md`, reusable later). Otherwise run the built-in brief: about six questions, one or two at a time, each with the repo's suggested answer, saved to `design/promo-brief.md`. Questions, handoff frame and template: `{baseDir}/references/promo-brief.md`.

   Note the promise, the pillars, 4–6 signature moments (these become the renders and footage shots), and **the twist or ending to keep secret**.
2. **Derive the link** from `scene.json`:
   - `worldConfiguration.name` set → `https://decentraland.org/jump/?realm=<name>` (World).
   - otherwise Genesis City → `https://decentraland.org/jump/?position=<x>,<y>` from `scene.base`.
   - Not deployed yet → `"link": ""`. Posts keep a `{LINK}` placeholder and lean on the coming-soon kind.
   - Check a deployed link with `curl -sL <link> | grep -oE 'og:(title|description|image)" content="[^"]*"'`. The link unfurls on X and other platforms as a card built from the **deployed** title, description and thumbnail, not the local `scene.json`. If they differ (old title, typo, stale thumbnail), tell the user to redeploy before posting.
3. **Check the scene metadata against the Foundation's recommendations.** Read `scene.json` `display.title`, `display.description`, `tags` and `display.navmapThumbnail`. Field rules, the valid tag list and the thumbnail spec are in **deploy-scene** (pre-deploy checklist and "Thumbnail image"). Do not re-derive them here. Check:
   - **Description**: ~140 characters / 1–3 sentences saying what the player *does*. If it is missing, too long, or only sets a mood, propose a rewrite. That rewrite is usually `listing.short`.
   - **Tags**: 1–3 valid tags, including `"game"` when it is a game.
   - **Title**: present. Flag possible IP problems (a known franchise, an existing game's name, a brand). Never claim a trademark or name check passed. Rights and brand rules: `{baseDir}/references/brand-and-ip.md`.
   - **Thumbnail**: file exists, 16:9, under 1 MB, gameplay screenshot with a distinctive logo, text inside the central 1080×1080.
   - **Deployed vs local**: compare with the link-card check above. If they differ, tell the user to redeploy.
   **Propose; don't overwrite.** Ask before changing the live title or description. When the scene is open in the Creator Hub, apply approved changes through its scene settings or the MCP `set_scene_settings` (see **creator-hub-mcp**). Otherwise edit `scene.json`.
4. **Ask once, briefly** (skip anything the brief or GDD interview already answered; or state assumptions and go): social handles on every platform they use; published or coming soon (and date if known); what must stay secret; whether inspirations or comparisons (other games, films, memes) may be named. **Default: keep inspirations out of the copy.** If they confirm nothing, use `@yourhandle` and spoiler-free copy.
5. **Set up the folder.** Create `promote/` and `promote/tools/`, and add `promote/` to `.dclignore` (next to `design/`) so it is never deployed. Copy the scripts in, so the creator can regenerate without this skill:
   - `{baseDir}/scripts/render_shots.py`, `make_logo.py`, `compose_social.py`, `build_kit.py` → `promote/tools/`
   - `{baseDir}/scripts/kit-template.html` → `promote/index.html` (no edits needed; it reads `kit-data.js`)
   - `{baseDir}/scripts/posts.example.json` → starting shape for `promote/posts.json`. Replace all its content.
6. **Write `posts.json`**, including the `listing` object (short and long description, handles, UTC schedule if any). Schema, kinds, writing rules and Eeireport style examples are in `{baseDir}/references/posts-guide.md`.
7. **Renders.** Rewrite the `SHOTS` table in `promote/tools/render_shots.py`, with one function per signature moment, built from the scene's own GLBs. Run `-- preview`, **read every preview PNG**, fix framing/orientation/lighting, then `-- final`. Key art: reuse the scene's thumbnail if it is good and has no text in it, otherwise set `KEYART_SHOT` and run `-- keyart preview`, then `-- keyart`. Framework, lighting recipes and gotchas: `{baseDir}/references/renders-and-images.md`.
   **Budget the final pass.** A final still takes from under a minute (a small room) to about three minutes (a whole interior with many lights and glass), and the key-art sizes about the same each, so a 5-shot `-- final` plus `-- keyart` can run past a 10-minute shell timeout and the run dies with the kit half-built. Render finals one or two shots per command (`-- final console panel`), or start the command in the background and wait for it, and run `-- keyart` as a second Blender process at the same time (two Cycles processes side by side were fine on Apple Silicon). Each `RENDERED` line prints the seconds it took: use the first one to plan the rest.
8. **Logo + composition.** `python3 promote/tools/make_logo.py` (quick and independent of the renders, so it can run before them), then `python3 promote/tools/compose_social.py` once the renders and key art exist. Read the outputs. The logo must not cover the subject (`keyart_logo_y`, `x_header_logo`), and quote lines must fit. If the creator mentioned events, set `"event_banners": true` (or pass `--events`) for the Foundation's event-page banners.
9. **Build the page.** `python3 promote/tools/build_kit.py`, which writes `kit-data.js`, `copy.md` (listing copy first) and `footage-shotlist.md` (which always opens with the Foundation's screenshot and trailer asks) and warns about missing images, bad keys, or a missing or overlong `listing.short`. Screenshot it and look at it:
   `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars --window-size=1400,2200 --virtual-time-budget=3000 --screenshot=<scratch>/kit.png "file://<scene>/promote/index.html"`
10. **README + cleanup.** Write `promote/README.md` **last, and only after the files it describes exist**: run `find promote -type f | sort` and check it against `images/renders/`, `images/keyart/`, `images/social/`, `logo/`, `kit-data.js`, `copy.md` and `footage-shotlist.md` before describing them, and make sure `build_kit.py` ran without missing-image warnings. A README that lists stills the render pass never produced reads as a finished kit to the creator. Contents: what each file/folder is, the link, the regenerate commands (in run order), and notes (what could not be rendered, inspirations kept out, asset credits, a Rights note per `{baseDir}/references/brand-and-ip.md`, which marketing-package items are done / in the kit / shot list / missing, and event banners if generated). Delete `promote/images/preview/`.
11. **Report**: whether a brief or GDD was created this run (point at the file), what was generated (counts), the metadata findings and proposed rewrites, what is a placeholder (footage posts, the in-world screenshot, the stills and the trailer all need capture), what could not be rendered and why, the path to `promote/index.html`, then offer the expanded kit.

## Resuming an interrupted run

If `promote/` already exists when the skill starts (a previous session stopped mid-way, usually during the final renders), do not start over and do not trust `README.md`:

1. `find promote -type f | sort`, and compare with the full list in step 10. Typical state: `posts.json`, `tools/`, `logo/` and `images/preview/` are there, `images/renders/` has the first shot or two, and `keyart/`, `social/`, `kit-data.js`, `copy.md` and `footage-shotlist.md` are missing.
2. `pgrep -fl Blender` to make sure nothing is still rendering.
3. Read the preview PNGs and whatever finals exist. If they look right, the `SHOTS` section is done: render only the missing shots by name (`-- final cage plaque`) and `-- keyart`, then continue from step 8.
4. Re-read the README against the finished folder and fix anything it claims that is not true.

## RULE: No invented facts, no spoilers

- Every post claim (length, mechanics, how many endings, "free", "in your browser") must come from `design/` (including the promo brief), the repo (code, scene, assets) or the creator's answer in this session. `[agent-decided]` lines in a GDD are not confirmed. Mark anything uncertain with `[CHECK: …]` in the post text and list it in the report.
- In-game lines are quoted verbatim. Do not polish them.
- Footage notes and quote cards never show the ending, the correct solution or the final card. Say in the shot-list tips what to keep out of public clips.
- Inspirations stay separate from the copy unless the owner opts in (the Eeireport kit kept "the Backrooms" out on purpose).

## RULE: Brand and rights

Details and sources: `{baseDir}/references/brand-and-ip.md` (Decentraland brand guidelines, logo files, Content Policy).

- The kit is the creator's brand. Mentioning Decentraland or showing its logo is **optional**. When it is mentioned: "Decentraland" in full ("DCL" only for insiders), capitalised Wearables / Emotes / LAND / NAMEs / Worlds / MANA, times in UTC, and nothing that reads as an official endorsement or as Decentraland speaking ("we").
- The Decentraland logo, when used, comes from the official PNGs, unaltered, with clear space and minimum size respected, never in grayscale, never the outline icon next to text, never the hero of the image. The scripts do not place it.
- Everything in the kit must be the creator's or licensed to them (Content Policy sections 2.2, 6, 8). Flag title conflicts, third-party models, fonts, music and inspirations; never clear them. Restricted (18+) content keeps its warning in promo material. Put a "Rights" note in the README.

## RULE: Avatars cannot be rendered outside the Explorer

Anything that is an `AvatarShape` in the scene (NPCs, copies of the player, the player) has no GLB to render in Blender. Do not fake it with a placeholder mesh. Route those moments to footage posts and the shot list, and say so in the README. If the Explorer MCP is connected (see **unity-explorer-mcp**), an in-world screenshot can stand in for a still. Ask first if the creator is playtesting in that Explorer.

## The kit page (`index.html` + `kit-data.js`)

- One template, no scene content in it. `build_kit.py` writes `window.KIT = {...}` from `posts.json`, so copy edits never touch the HTML.
- Images are embedded as data URIs downscaled to 1200 px (logos 900 px). On `file://`, `fetch()` and canvas reads of sibling files are blocked, so this is what makes the page work offline and makes **Copy image** work (`navigator.clipboard.write([new ClipboardItem({'image/png': blob})])` from a canvas). Download links point at the full-size files. `kit-data.js` comes out at roughly 100–130 KB per image (about 1 MB for the 9-image example, 1.8 MB for a 14-image kit).
- Features: filter by kind; X / Instagram mockups (`ig_image` swaps in a square or portrait image); hashtag toggle (none / core / all; skipped when a post already has hashtags); editable text with Reset; a character counter under each post (every URL counts as 23 characters, as on X; warns over 280) and a link to the image file; Copy text (copies the edited text as shown in the preview) / Copy image / Download; brand and gallery sections; footage tips.
- With `"link": ""` the page shows "not published yet" and highlights `{LINK}` in every post. Rebuild after deploying.

## Gotchas

- **Fonts**: Pillow needs a font file path. Use a bold condensed display face already on the machine: macOS `/System/Library/Fonts/Supplemental/Impact.ttf`, `DIN Condensed Bold.ttf`, `Courier New Bold.ttf`. If the scene's cover/thumbnail already uses a face, match it. Check `python3 -c "import PIL"` first. If Pillow is missing, ask before installing it.
- **Social images are not the scene thumbnail.** The Worlds thumbnail limits (16:9 ±1 %, PNG/JPEG, ≤ 1,048,576 bytes, see **creator-hub-mcp**) apply only to `display.navmapThumbnail`. Never overwrite the scene's thumbnail from this skill.
- **Asset credits** (e.g. CC BY audio from Wikimedia Commons listed in `design/references.md`) belong in the scene description, not in posts. Flag them in the README if the scene description lacks them.
- **Hashtags**: core = game name + `#Decentraland` + genre. The rest go in `extra`. Do not put hashtags in the post text unless they are part of the joke (the page appends them).
- Renders are batch work, so headless Blender is the default here. If a Blender MCP is connected and the creator wants to watch or adjust shots live, offer it (the no-silent-fallback rule in **add-3d-models** applies when the user is working in the MCP).

## References

- `{baseDir}/references/promo-brief.md`: no design docs → repo harvest, `dcl-gdd` handoff frame, the six-question brief, `design/promo-brief.md` template.
- `{baseDir}/references/marketing-package.md`: the Decentraland Foundation's marketing package checklist (basics, descriptions, images, extras, trailer) and where each item comes from.
- `{baseDir}/references/posts-guide.md`: `posts.json` schema, the five kinds, writing rules, footage-note recipe, Eeireport examples.
- `{baseDir}/references/renders-and-images.md`: Blender render framework, room building, lighting recipes, key art, logo and composition, verification.
- `{baseDir}/references/brand-and-ip.md`: Decentraland name and logo rules (brand guidelines and media kit links), Content Policy IP points, what to flag and where the Rights note goes.
- `{baseDir}/scripts/`: `render_shots.py`, `make_logo.py`, `compose_social.py`, `build_kit.py`, `kit-template.html`, `posts.example.json`.
