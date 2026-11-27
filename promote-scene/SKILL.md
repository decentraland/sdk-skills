---
name: promote-scene
description: "Audience-first marketing for a creator's Decentraland scene or game: names who it is for and where they gather (web-verified venues), then writes posts for X, Instagram, subreddits and YouTube Shorts, each venue in its own language, a logo, in-game stills, key art, quote cards, a shot list, a first-20-players plan and an offline kit page; brings an existing kit up to date after a deploy or a redesign; on request, an event's listing and posts, one post's video, or video and image creatives for a paid ad campaign. Use when the user wants to promote or market a scene or game or find its first players, or asks for a marketing or press kit, social or Reddit posts, Shorts, a logo or key art, launch, teaser or event posts, a kit update, a trailer shot list, a footage post's video, or ads (Meta, TikTok, Google PMax). Not for deploying (deploy-scene, deploy-worlds) or the map thumbnail alone (deploy-scene, creator-hub-mcp)."
---

# Promote a Scene (Marketing Kit)

Builds `promote/` inside the scene project: an audience the creator can name (who, where they are, every row with its source and the assumptions flagged), posts written from the game's own design and in-game lines for X and Instagram, for specific subreddits, and as YouTube Shorts proposals, a logo set, stills taken in the running game (or renders of the scene's own GLBs), composed social images, a first-20-players plan, and `index.html`, a page that works offline where the creator edits, previews (X / Instagram / Reddit / a phone), copies and downloads each post. The scripts come from the Eeireport horror jam kit, made generic. The audience-first method comes from the Decentraland Foundation's *Find your first 100 players* playbook: `{baseDir}/references/audience-and-venues.md`.

**Prerequisites**: Python 3 with Pillow (`python3 -c "import PIL"`; ask before installing), Blender 4.2 or newer for key art and renders, `ffmpeg` + `ffprobe` on PATH for gameplay capture and for video sizes on the kit page, a desktop Explorer for in-game stills and footage (**unity-explorer-mcp**), Node 18+ only for the opt-in videos. On Windows the scripts run with `python` or `py -3` where `python3` is not on PATH; the Python tools pick fonts and GPU backends per OS by themselves.

**Default scope is a first run. Do not produce the expanded kit unless asked.**

| Output | Default (first run) | Expanded (offer afterwards) |
|---|---|---|
| Audience (`posts.json` `audience`) | who, not for, insight, 3–6 "likes" in their words, who they trust, outside interests, 3–6 verified venues, the assumptions list | — |
| Posts (`posts.json`) | 20–24: launch with link 4, coming soon 4, footage 4–5, quote 3, behind the scenes 2, **Reddit 2–4 (one per venue that allows a post), Shorts 2–3**; + 4 event posts and the listing when the creator named a dated gathering | 35–40 |
| Plan (`posts.json` `plan`) | first experiment, 20 by hand, what "got it" means, stop rule; the five checks and seven days are defaults | — |
| Logo (`logo/`) | 3: wordmark (transparent, hard shadow), lockup with tagline on black, 1024 icon | + flat white/black/accent wordmarks, themed variant, 400 px icon |
| Stills (`images/screens/`, or `images/renders/`) | 4–6 signature moments: in-world stills (16:9, 1920 wide) when an Explorer preview can run, otherwise Blender renders (1600 px square) | 10–12 + 1080 px JPEG copies |
| Key art (`images/keyart/`) | 1920×1080 + 1080×1080 | + 1080×1350, 1080×1920 |
| Composed (`images/social/`) | key art with wordmark ×2, 3 quote cards, X header 1500×500 | 7 quote cards, story key art with lockup, event-page banners 1340×670 + 716×1814 (JPEG ≤ 500 KB; default only when the user mentions events) |
| Scene description (`posts.json` `listing`) | the proposed `display.description` (~140 chars) + the long description, events in UTC if any; `copy.md` and README only, not on the page | — |
| Text | `copy.md`, `footage-shotlist.md`, `README.md` | — |
| Videos (`videos/`) | **none**: footage posts and Shorts show a placeholder and a **Copy video prompt** button | one post or Short per explicit request, never all at once: `{baseDir}/references/video-posts.md` |

The kit follows the Decentraland Foundation's marketing package checklist. Walk it with the creator: `{baseDir}/references/marketing-package.md`.

## Workflow

**`promote/` already exists?** Do not start over. A kit to bring up to date (deployed since, renamed, redesigned, an event passed) or a run that stopped mid-way: `{baseDir}/references/update-and-resume.md`.

1. **Gather context. Every claim must trace to a source.** Always read `README`, `scene.json` (`display.title`, `display.description`, `tags`) and skim `src/` for quotable strings: dialogue, intercom/announcer lines, item descriptions, signs. These make the best copy. Voiced lines may exist only as audio files, with their wording in the design notes. Then branch on `design/`:
   - **`design/gdd.md` or design notes exist** (or `design/promo-brief.md` from an earlier run): read them.
   - **No design docs**: do not write posts from guesses. Harvest what the repo proves, then get the rest from the creator. If a `dcl-gdd` skill is available, recommend it on its Harvest route with a promotion-only frame (about five minutes; the result is `design/gdd.md`, reusable later). Otherwise run the built-in brief: about six questions, one or two at a time, each with the repo's suggested answer, saved to `design/promo-brief.md`. Questions, handoff frame and template: `{baseDir}/references/promo-brief.md`.

   Note the promise, the pillars, 4–6 signature moments (these become the renders and footage shots), and **the twist or ending to keep secret**.
   **1b. Name the audience before writing anything.** Read `{baseDir}/references/audience-and-venues.md` first, then fill `audience` for `posts.json`, every row labelled with its source (`gdd` §8, `brief`, `repo`, `creator`, `research` with a URL, or `assumed`); ask the deck's questions when the docs are silent, or go on assumptions listed in `audience.assumptions`; **verify 3–6 venues by search** (URL, rules, date read, the language it writes in; a venue whose rules forbid posting gets no post); and write the `plan` at the same time.
2. **Derive the link** from `scene.json`:
   - `worldConfiguration.name` set → `https://decentraland.org/jump/?realm=<name>` (World).
   - otherwise Genesis City → `https://decentraland.org/jump/?position=<x>,<y>` from `scene.base`.
   - Not deployed yet → `"link": ""`. Posts keep a `{LINK}` placeholder and lean on the coming-soon kind.
   - Check a deployed link with `curl -sL <link> | grep -oE 'og:(title|description|image)" content="[^"]*"'`. The link unfurls on X and other platforms as a card built from the **deployed** title, description and thumbnail, not the local `scene.json`. If they differ (old title, typo, stale thumbnail), tell the user to redeploy before posting.
3. **Check the scene metadata** (`scene.json` `display.title`, `display.description`, `tags`, `display.navmapThumbnail`) against the Foundation's asks in `{baseDir}/references/marketing-package.md`. Field rules, the valid tag list and the thumbnail spec are in **deploy-scene**; **creator-hub-mcp** > Gotchas covers a custom cover in the Hub. Do not re-derive them here.
   - **Description**: ~140 characters saying what the player *does*. Missing, too long or only a mood → propose a rewrite, usually `listing.short`.
   - **Tags**: 1–3 valid tags, `"game"` for a game. **Thumbnail**: exists, 16:9, under 1 MB, text inside the central 1080×1080.
   - **Title**: flag possible IP problems (a franchise, an existing game's name, a brand); never claim a name check passed (`{baseDir}/references/brand-and-ip.md`).
   - **Deployed vs local**: step 2's card check. If they differ, tell the user to redeploy.
   **Propose; don't overwrite.** Ask before changing the live title or description. With the scene open in the Creator Hub, apply approved changes through its scene settings or the MCP `set_scene_settings` (**creator-hub-mcp**); otherwise edit `scene.json`.
4. **Ask once, briefly** (skip anything the brief or GDD interview already answered; or state assumptions and go): the handle the mockups should show (`handle`) and the creator's handles on every other social, for the README's marketing-package section (the Foundation tags and credits them); published or coming soon (and date if known); what must stay secret; whether inspirations or comparisons (other games, films, memes) may be named. **Default: keep inspirations out of the copy.** If they confirm nothing, use `@yourhandle` and spoiler-free copy.
5. **Set up the folder.** Create `promote/` and `promote/tools/`, and add `promote/` to `.dclignore` (next to `design/`) so it is never deployed. Copy the scripts in, so the creator can regenerate without this skill:
   - `{baseDir}/scripts/render_shots.py`, `make_logo.py`, `compose_social.py`, `build_kit.py`, `research_venues.py` → `promote/tools/`
   - `{baseDir}/scripts/kit-template.html` → `promote/index.html` (no edits needed; it reads `kit-data.js`)
   - `{baseDir}/scripts/posts.example.json` → starting shape for `promote/posts.json`. Replace all its content.
   - For in-world stills (step 7), also `capture_play.py` and `takes.example.py` (as `takes.py`), now: a write under the scene folder restarts a running preview.
6. **Write `posts.json`**, including the `listing` object (the scene-description rewrites from step 3: short and long, UTC schedule if any; they go to `copy.md`, not the page), the `audience` and `plan` from step 1b, and the posts. Schema, kinds, writing rules and Eeireport style examples are in `{baseDir}/references/posts-guide.md`. Reddit posts (one per venue whose rules allow it, modelled on posts that worked there, signed as the dev) and Shorts (proposals: hook, beats, title, description, vertical shot note) follow `{baseDir}/references/audience-and-venues.md`. A venue that writes in another language gets its post written natively in it, with a `gloss` for the creator (same reference > Language). A dated gathering the creator named gets an `event` object and four event posts: `{baseDir}/references/events.md`.
7. **Stills and key art.** One picture per signature moment. Source rules, commands and gotchas: `{baseDir}/references/renders-and-images.md`.
   - **An Explorer preview of the scene can run** (follow **unity-explorer-mcp**'s gates; ask first if the creator is playing in it): take them in the game. Write `STILLS` in `promote/tools/takes.py`, look at the avatar and ask before the rest, then `python3 promote/tools/capture_play.py still --crop`, **read every PNG**, fix and retake by name, and finish with `--to-kit` (`images/screens/`).
   - **It cannot**: Blender. Rewrite the `SHOTS` table in `promote/tools/render_shots.py`, one function per moment, built from the scene's own GLBs. Run `-- preview`, **read every preview PNG**, fix framing/orientation/lighting, then `-- final`.
   - **Key art** is Blender's either way: reuse the scene's thumbnail if it is good and has no text in it, otherwise set `KEYART_SHOT` and run `-- keyart preview`, then `-- keyart`.
   - **One Blender process at a time, one or two shots per command**, started in the background and waited for; time the first final before launching the rest. Why and the measured times: the reference's render framework section.
8. **Logo + composition.** `python3 promote/tools/make_logo.py` (quick and independent of the renders, so it can run before them), then `python3 promote/tools/compose_social.py` once the renders and key art exist. Read the outputs. The logo must not cover the subject (`keyart_logo_y`, `x_header_logo`), and quote lines must fit. If the creator mentioned events, set `"event_banners": true` (or pass `--events`) for the Foundation's event-page banners.
9. **Build the page.** `python3 promote/tools/build_kit.py --skill {baseDir}/scripts`, which writes `kit-data.js`, `copy.md` (the scene-description rewrites, then the audience with sources, the posts, the plan) and `footage-shotlist.md` (which always opens with the Foundation's screenshot and trailer asks and includes the Shorts) and warns about anything missing or malformed (images, keys, `listing`, `audience`, `plan`, venues, languages, the event, Reddit and Shorts fields) and about tool copies older than the skill's. Fix every warning. Screenshot it and look at it, the Audience panel first (are the assumptions the ones you actually made?):
   `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars --window-size=1400,2200 --virtual-time-budget=3000 --screenshot=<scratch>/kit.png "file://<scene>/promote/index.html"`
   (Windows: `"C:\Program Files\Google\Chrome\Application\chrome.exe"` with the same flags and a `file:///C:/...` URL; Linux: `google-chrome` or `chromium`.)
10. **README + cleanup.** Write `promote/README.md` **last, from the folder as it is**: run `find promote -type f -not -path '*/node_modules/*' | sort` and describe only files that exist, after `build_kit.py` ran without missing-image warnings. A README that lists stills nobody produced reads as a finished kit. Contents: `{baseDir}/references/kit-page.md` > The README. Delete `promote/images/preview/`.
11. **Report**: whether a brief or GDD was created this run (point at the file), **the audience in two lines and the assumptions you made** (the creator corrects these first), the venues verified and the ones whose rules forbid a post, what was generated (counts), the metadata findings and proposed rewrites, which source the stills came from, what is a placeholder (footage posts, Shorts and the trailer need capture; so do the Foundation's screenshots when no in-world still qualifies), what could not be captured or rendered and why, the `[CHECK]` items, the path to `promote/index.html`, then offer the expanded kit. Mention that each footage card and Short has a **Copy video prompt** button for when they want one video cut by an AI assistant (any; one at a time; see below), and that recordings go in `promote/footage/`.

## Videos for footage posts (opt-in, one per request)

The first run never renders video. When the creator asks for the video of a specific footage post (usually by pasting the page's prompt: "Generate the video for the footage post `footage-02` … Use the promote-scene skill if you have it …"), follow `{baseDir}/references/video-posts.md`: the footage ladder of `{baseDir}/references/video-capture.md` (real playthroughs that already exist, indexed with `footage_index.py` → takes recorded by `capture_play.py` through the Explorer MCP server → `render_shots.py -- clip` camera moves → the kit's stills with motion), the Remotion project copied from `{baseDir}/scripts/video/` into `promote/video/` on first use, one `Edit` per post in `src/edits.ts`, render to `promote/videos/<post id>.mp4` (+ `-9x16` on request), verify by reading frames, then `build_kit.py` so the page embeds it. The report leads with every file's absolute path as a clickable link, then asks what works and iterates on that one video. Do exactly the post asked for. If asked for "all the videos", explain the cost (minutes and many tokens each), do the one they rank first, and stop. Rules that still apply: verbatim lines, no spoilers, no downloaded music, no claims the design docs do not make.

## Paid-ad mode (opt-in)

When the request is for an ad, a paid or acquisition campaign, or Meta / TikTok / Google PMax creatives, follow `{baseDir}/references/paid-ads.md` from §1. The goal changes from attention to **players who reach the game and stay**, and with it the inputs, the audience (per game and market), the truth rules (only what a new player meets in the first session), a slate of 4–6 concepts, the delivery set (9:16, 1:1, 4:5, 16:9 and stills) and a scripted delivery check. Same Remotion project and footage ladder as post videos; output goes to `promote/ads/`; no kit run is needed first. Organic rules that still hold: verbatim lines, no spoilers, no downloaded music, no claims the design docs do not make.

## RULE: No invented facts, no spoilers

- Every post claim (length, mechanics, how many endings, "free", "in your browser") must come from `design/` (including the promo brief), the repo (code, scene, assets) or the creator's answer in this session. `[agent-decided]` lines in a GDD are not confirmed. Mark anything uncertain with `[CHECK: …]` in the post text and list it in the report.
- In-game lines are quoted verbatim. Do not polish them.
- Footage notes and quote cards never show the ending, the correct solution or the final card. Say in the shot-list tips what to keep out of public clips.
- Inspirations stay separate from the copy unless the owner opts in (the Eeireport kit kept "the Backrooms" out on purpose).

## RULE: Audience and venues are evidence, not invention

- No post is written before `audience` exists. "Gamers", "Web3 gamers" or "cozy gamers" are not an audience; a group in a thread, server or meetup you can name is. If nobody can name one, say so and make finding one the first line of the plan.
- Every venue, rule, member count and "post that worked" comes from this session's search (URL and date) or is marked `[CHECK: …]`. Nothing from memory alone.
- A venue's rules win. "No self-promotion" means listen, comment, talk to the mods, and no post from the kit. The kit never suggests a second account, a friend's account, posing as a player, or asking for upvotes: that is astroturfing and vote manipulation, it breaks Reddit's rules and the Decentraland Content Policy's "not false or misleading", and it burns the one room the game needs.
- Inspirations may choose a venue (the Backrooms community for a liminal airport) while staying out of the copy, as the owner decided.
- The plan is an experiment with a stop rule, reported as behaviour (new players → got it → came back), never as reach. The kit promises no result.

## RULE: Brand and rights

Details and sources: `{baseDir}/references/brand-and-ip.md` (Decentraland brand guidelines, logo files, Content Policy).

- The kit is the creator's brand. Mentioning Decentraland or showing its logo is **optional**. When it is mentioned: "Decentraland" in full ("DCL" only for insiders), capitalised Wearables / Emotes / LAND / NAMEs / Worlds / MANA, times in UTC, and nothing that reads as an official endorsement or as Decentraland speaking ("we").
- The Decentraland logo, when used, comes from the official PNGs, unaltered, with clear space and minimum size respected, never in grayscale, never the outline icon next to text, never the hero of the image. The scripts do not place it.
- Everything in the kit must be the creator's or licensed to them (Content Policy sections 2.2, 6, 8). Flag title conflicts, third-party models, fonts, music and inspirations; never clear them. Restricted (18+) content keeps its warning in promo material. Put a "Rights" note in the README.

## RULE: Avatars exist only in the Explorer

Anything that is an `AvatarShape` in the scene (NPCs, copies of the player, the player) has no GLB to render in Blender. Do not fake it with a placeholder mesh. Take those moments as in-world stills (step 7); without an Explorer, route them to footage posts and the shot list, and say so in the README.

## The kit page

`promote/index.html` is one template with no scene content in it; `build_kit.py` writes everything into `kit-data.js` from `posts.json`, so copy edits never touch the HTML, and the page works offline. Tabs, mockups, buttons, embedded images, how videos and the "in the making" marker show up: `{baseDir}/references/kit-page.md`.

## Gotchas

- **Fonts**: the image scripts need a font file; which one they pick and how to set `brand.font`: `{baseDir}/references/renders-and-images.md` > Logo.
- **Social images are not the scene thumbnail.** The Worlds thumbnail limits (16:9 ±1 %, PNG/JPEG, ≤ 1,048,576 bytes, see **deploy-scene** > Thumbnail image) apply only to `display.navmapThumbnail`. Never overwrite the scene's thumbnail from this skill.
- **Asset credits** (e.g. CC BY audio from Wikimedia Commons listed in `design/references.md`) belong in the scene description, not in posts. Flag them in the README if the scene description lacks them.
- **Hashtags**: core = game name + `#Decentraland` + genre. The rest go in `extra`. Do not put hashtags in the post text unless they are part of the joke (the page appends them).
- **The new players this kit brings in can also pay.** A published scene whose creator owns the LAND, NAME or World can be enrolled in the Creator Fund, which rewards exactly what the kit works on — new Decentraland players, playtime and return visits. Worth one line when handing the kit over (opt in from the **Earn** tab in Creator Hub); facts and eligibility: `{baseDir}/../dcl-gdd/references/funding-and-scope.md` → Creator Fund. Never promise an amount.
- Renders are batch work, so headless Blender is the default here. If a Blender MCP is connected and the creator wants to watch or adjust shots live, offer it (the no-silent-fallback rule in **add-3d-models** applies when the user is working in the MCP).

## References

- `{baseDir}/references/promo-brief.md`: no design docs → repo harvest, `dcl-gdd` handoff frame, the six-question brief, `design/promo-brief.md` template.
- `{baseDir}/references/audience-and-venues.md`: the audience-first method (the Foundation's *Find your first 100 players* moves and the guerrilla notes), the `audience` step and its sources, how to verify a venue, Reddit post rules, YouTube Shorts rules, the plan, what the step never does.
- `{baseDir}/references/marketing-package.md`: the Decentraland Foundation's marketing package checklist (basics, descriptions, images, extras, trailer) and where each item comes from.
- `{baseDir}/references/posts-guide.md`: `posts.json` schema, the kinds, writing rules, languages, footage-note recipe, two worked examples (a horror game and a cosy one).
- `{baseDir}/references/renders-and-images.md`: in-world stills, the Blender render framework, room building, lighting recipes, key art, logo and composition, verification.
- `{baseDir}/references/update-and-resume.md`: coming back to an existing kit: what is stale and what to redo, coming-soon to launch, resuming an interrupted run.
- `{baseDir}/references/events.md`: a dated gathering: the `event` object, the Events-page listing, the announce / countdown / live / recap posts.
- `{baseDir}/references/brand-and-ip.md`: Decentraland name and logo rules (brand guidelines and media kit links), Content Policy IP points, what to flag and where the Rights note goes.
- `{baseDir}/references/video-posts.md`: opt-in post videos: Remotion setup, edit authoring, render and verification, README and report.
- `{baseDir}/references/video-capture.md`: the footage ladder: indexing real playthroughs, recording takes from the Explorer (screen or frames, vertical, close-ups), Blender clips, stills.
- `{baseDir}/references/kit-page.md`: the page's tabs, mockups, buttons, badges, embedded images, video cards and the rendering marker; what the README contains.
- `{baseDir}/references/paid-ads.md`: paid-ad mode: inputs and blockers, deriving the audience per game and market (Brazil worked example), the promise ledger, concept slate, delivery sizes and naming, production rules, checks before delivery, the test plan.
- `{baseDir}/scripts/`: `research_venues.py` (top posts of a subreddit via RSS, YouTube Shorts search with view counts; the evidence for venues and `modelled_on`; copied to `promote/tools/`), `render_shots.py` (stills, key art and `-- clip` camera moves), `make_logo.py`, `compose_social.py`, `build_kit.py`, `kit-template.html`, `posts.example.json`, `video/` (the Remotion project copied to `promote/video/` on the first video request), `capture_play.py` + `takes.example.py` (in-world stills, and gameplay takes from the Explorer for footage posts and ads, 16:9 or `--vertical`), `footage_index.py` (indexes every recording with timestamped contact sheets, so cuts start from real playthroughs), `ad_stills.py` + `check_ads.py` (paid-ad stills in every size; the delivery check of `promote/ads/`); all copied to `promote/tools/` when used. Every tool carries a `tool version` line; `build_kit.py --skill` compares the kit's copies with these.
