# posts.json: schema, kinds, writing rules

`promote/posts.json` is the single source of truth for the kit. `make_logo.py`, `compose_social.py` and `build_kit.py` all read it. A complete runnable example (Eeireport, 5 posts) is `{baseDir}/scripts/posts.example.json`.

## Schema

| Key | Type | Used by | Notes |
|---|---|---|---|
| `game` | string | all | Display name. Lower-cased and slugged for logo file names (`<slug>_wordmark.png`). |
| `tagline` | string | logo, page | One line, from the GDD's promise. Upper-cased on the lockup. |
| `link` | string | page, copy.md | Jump link (see SKILL.md step 2), or `""` when unpublished. |
| `handle` | string | page mockups | `@yourhandle` until the creator gives one. |
| `listing` | `{short, long, events?}` | copy.md, README | The scene-description rewrites for the Places card and the Foundation package, see below. **Not shown on the page.** `events`: optional recurring schedule, day and time in UTC. |
| `event_banners` | bool | compose | Foundation event-page banners (1340×670, 716×1814, JPEG ≤ 500 KB). Default `false`; set `true` when the creator mentions events. |
| `hashtags` | `{core: string[], extra: string[]}` | page, copy.md | core ≈ 3 tags, extra ≈ 4–6. |
| `brand` | object | logo, compose, page | `text`, `ink`, `accent` (hex); `font`, `font_small` (absolute .ttf paths); optional `wordmark` (override text), `icon_text` (1–3 chars, default the initial), `icon_top`, `icon_bottom`, `quote_tag` (small accent label on quote cards). |
| `keyart` | `{"<w>x<h>": path}` | compose | Text-free plates relative to `promote/`. Missing sizes are centre-cropped from the first entry. |
| `keyart_logo_y` | number 0.12–0.9 | compose | Vertical centre of the wordmark on key art (default 0.42). Stay within 0.25–0.75 unless the subject fills the middle; a band near 0.9 (the ground) or 0.15 (the sky) is the fallback for a tall centred subject. |
| `x_header_logo` | `"left"` \| `"right"` | compose | Side of the X header the wordmark goes on (default left). |
| `quote_cards` | `[{id, render, line}]` | compose | `line` uses `\n` for breaks (~28 characters per line at 1080 px). `id` becomes `images/social/<id>.png`. |
| `images` | `{key: {file, alt}}` | page, copy.md | Every image a post can reference. `file` is relative to `promote/`. `alt` is the accessibility text on the mockup image. |
| `shotlist_tips` | string[] | page, shot list | 4–7 practical recording tips specific to this scene. |
| `audience` | object | page, copy.md | Who the kit is for and where they are, every row with its source. Written **before** the posts. Schema below; method in `{baseDir}/references/audience-and-venues.md`. |
| `plan` | object | page, copy.md | The first experiment, the 20 by hand, the five checks, the stop rule, the seven days. Schema below. |
| `posts` | Post[] | page, copy.md | See below. |

### `audience`

```json
"audience": {
  "who":     {"text": "People who …", "source": "gdd"},
  "not_for": {"text": "…", "source": "gdd"},
  "insight": {"text": "…", "source": "creator"},
  "likes":   [{"text": "…, in their words", "source": "research", "url": "https://…"}],
  "trusts":  [{"text": "u/… runs the weekly showcase thread", "source": "research", "url": "https://…"}],
  "outside": [{"text": "…", "source": "assumed"}],
  "venues":  [{"name": "r/LiminalSpace", "kind": "subreddit", "url": "https://www.reddit.com/r/LiminalSpace/",
               "size": "~700k members", "why": "…", "rules": "no self-promotion; …", "walk_in": "…",
               "post": "reddit-01", "source": "research", "verified": "2026-10-22"}],
  "assumptions": ["…"]
}
```

- `source` is one of `gdd` (confirmed §8 lines), `brief` (`design/promo-brief.md`), `repo`, `creator` (said this session), `research` (found this session; `url` required), `assumed` (your guess; the page highlights it for correction). `[agent-decided]` and `TBD` GDD lines are `assumed`.
- `venues[].kind`: `subreddit` · `discord` · `forum` · `community` (a Decentraland Community, a newsletter, a Steam group) · `meetup` · `creator` (a small streamer or channel). `post` is the id of the post written for it, or `null` when its rules allow comments only. `rules` is what the sidebar or pinned post says, read this session.
- `assumptions`: plain sentences printed at the top of the Audience panel ("We assumed the first players come from the jam showcase, not from a horror community. Correct this before posting.").

### `plan`

```json
"plan": {
  "experiment": "…the one small cheap thing to run first, venue named…",
  "first_20":   "…how to find and message 20 of the 100 by hand…",
  "got_it":     "…what 'got it' means in this game (finished the first room)…",
  "stop_rule":  "…written before the test…",
  "days":       ["optional: seven entries overriding the default assignment"]
}
```

`build_kit.py` adds the five checks (joined · got it · enjoyed it · returned within 7 days · brought anyone) and the default seven-day assignment when `days` is absent.

Post: `{id, kind, title, text, image, ig_image?, footage?, cta?, platform?}`
- `kind`: `launch` · `soon` · `footage` · `quote` · `bts` · `reddit` · `short` (`build_kit.py` warns on anything else).
- `image` / `ig_image`: keys into `images`. `ig_image` is the square or portrait alternative shown in Instagram mode.
- `footage`: **required on `footage` posts**. It is a concrete "what to show" note (see recipe).
- `platform`: `"ig"` or `"x"` marks a post written for one platform (e.g. a long Instagram caption).
- Placeholders in `text`: `{LINK}` (filled from `link`), `{N}`, `{DATE}` (the creator fills these), `[FOOTAGE]` (where the clip goes).
- `video` (optional): `"videos/<file>.mp4"` relative to `promote/`. Normally unnecessary: `build_kit.py` finds `videos/<id>.mp4` and `videos/<id>-9x16.mp4` by the post id. Videos exist only when the creator asked for that post's video (`{baseDir}/references/video-posts.md`); the first run writes none. A `videos/<id>.rendering` marker (written while that video is being made) shows a spinner on the card.

Reddit post (`kind: "reddit"`), extra keys: `subreddit` ("r/…", must match a `venues[].name`), `post_title` (≤ 300 characters, the thing Reddit judges), `text` (the body), `flair?`, `link_in` (`"body"` · `"comment"` · `"none"`, per the venue's rules), `why_here` (one line), `rules_note` (frequency, flair, link rule, from the venue), `modelled_on` (`[{title, url, note?}]`, 2–3 posts that worked in that sub, found this session). `image` is the attached image; a `footage` note makes it a video post (the Short's or a footage post's file can be reused).

Short (`kind: "short"`), extra keys: `hook` (on-screen text for seconds 0–2), `beats` (3–6 caption lines in order), `yt_title` (≤ 100 characters), `text` (the description, with `{LINK}`), `footage` (**required**: the shot note with seconds and "vertical"), `modelled_on` (2–3 Shorts in a format this audience watches, with URLs). The video, when asked for, is `videos/<id>.mp4` at 1080×1920 (the page's phone mockup plays it).

## Scene description (`listing`)

The Foundation's marketing package asks for exactly two descriptions of the scene (see `{baseDir}/references/marketing-package.md`); the short one is the proposed `display.description` from SKILL.md step 3. `build_kit.py` puts them at the top of `copy.md` (and the README quotes the short one) and warns when `short` is missing or over 160 characters. They are not posts and do not appear on the page: the creator applies them in `scene.json` or the Creator Hub scene settings. Social handles are not collected here; the only handle the kit uses is the top-level `handle` shown on the mockups.
- **`short`**: ~140 characters, 1–3 sentences. Verb first: what you *do*, then who with or why come back. It doubles as the proposed `display.description`. Eeireport: "Walk an empty airport, search abandoned bags and satisfy a protocol-obsessed officer to reach gate 13 before the final boarding call." (133 characters; the scene's own description, "A strangely empty airport. Find gate 13 before the final boarding call.", only sets a mood.)
- **`long`**: at most two short paragraphs. Lead with the activity and the people, then recurring moments and why come back. A one-time story says so honestly. Do not invent replay hooks.
- Same sourcing rules as the posts: every claim traces to `design/`, the repo or the creator's answer.

## The five kinds (default counts)

- **launch (4)**: needs `{LINK}`. One post each for the promise, a signature character or mechanic, what the game is (length, how you play, "free, in your browser"), and one with a different angle (bring a friend, a single-line joke).
- **soon (4)**: no link. A teaser line from the game, a mood post, one `{N}` / `{DATE}` countdown template on the logo lockup, and one aimed at the genre audience.
- **footage (4–5)**: a short caption plus `[FOOTAGE]`. The `image` is the closest render, shown behind the "insert footage" slot. One footage post can be a ~30-second trailer cut with a timed shot order. Write the `footage` note so that a video could be cut from it later: a length in seconds ("6 to 8 seconds"), and "vertical reel" when a 9:16 cut makes sense, because the page's **Copy video prompt** reads both from the note.
- **quote (3)**: one verbatim in-game line per post, each with a matching quote card in `quote_cards`.
- **bts (2)**: how it was made: the jam or origin, one technical or design detail that is genuinely interesting. Hashtags like `#gamedev` may sit inline here.
- **reddit (2–4)**: one per venue whose rules allow a post, in that community's own lane (a showcase with a question, a making-of, an on-topic image with the game in the last line). Title modelled on posts that worked there. Rules, research and the no-astroturfing rule: `{baseDir}/references/audience-and-venues.md`.
- **short (2–3)**: proposals for vertical videos: hook, beats, title, description, shot note. Never rendered on the first run.

## Writing rules

- Sound like the game, not like an ad. Use the game's own voice: an intercom, a sign, a character. No "immersive experience", "epic adventure", "don't miss out".
- Short lines, white space, one idea per post. Keep X posts under 280 characters with the link counted as 23 (the page shows the count).
- Use real lines verbatim from `src/` and the design docs. Voiced lines (announcer or intercom audio) often exist only as `.ogg` files, with their wording written in the design notes. Look there too, and never transcribe audio you have not seen written down. Every factual claim must trace to `design/` (GDD or `promo-brief.md`), the repo, or the creator's answer in this session. Use `[CHECK: …]` when unsure.
- Name the game consistently (Eeireport used ALL CAPS in copy, matching the wordmark).
- No spoilers: not the ending, not the solution, not the final card.
- Inspirations and comparisons only if the owner opted in.
- Decentraland is optional in the copy. When named: "Decentraland" in full (not "DCL" outside insider channels), "Decentraland World" / "Genesis City", capitalised Wearables / Emotes / LAND / NAMEs / MANA, and never phrased as an official or partnered release. See `{baseDir}/references/brand-and-ip.md`.
- Emoji: at most one per post, and only where it adds to the line. Many posts need none.

## Footage note recipe

Where to start → what happens on screen, in order → camera (first or third person, framing) → sound cue that matters → length in seconds → where to cut → what NOT to show. Add loop / vertical-reel suitability when relevant.

## Eeireport examples (style reference)

```json
{"id": "launch-03", "kind": "launch", "title": "Launch: gate 13", "cta": true,
 "text": "Eight passengers are waiting at gate 13.\nAll of them are you.\nOne of them is exactly you.\n\nPoint them out. Three mistakes and you go back to arrivals.\n\nPlay EEIREPORT: {LINK}",
 "image": "gate13"}
{"id": "soon-04", "kind": "soon", "title": "Coming soon: still breathing",
 "text": "\"Would the passenger who is still breathing please proceed to gate thirteen.\"\n\nComing soon to Decentraland Worlds.",
 "image": "quote_breathing"}
{"id": "footage-02", "kind": "footage", "title": "Footage: the carousel",
 "text": "Nobody pressed the button.\n\n[FOOTAGE]", "image": "carousel",
 "footage": "Approach the west carousel in the baggage hall from the corridor. It starts by itself and the lone suitcase begins to circle. Hold the shot for one full lap. 8 to 12 seconds; works as a loop."}
{"id": "quote-02", "kind": "quote", "title": "Quote: luggage",
 "text": "\"Unattended luggage will be attended.\"", "image": "quote_luggage"}
{"id": "bts-02", "kind": "bts", "title": "Behind the scenes: the copies",
 "text": "The passengers at gate 13 are dressed from YOUR avatar, live, when you arrive. Each copy gets one difference drawn from a pool: white hair, a bandana, sunglasses, a beard, greenish skin, an earring, taller, shorter.\n\nIf you already wear a hat, the hat difference is skipped. Protocol is protocol.\n\n#gamedev #SDK7",
 "image": "gate13"}
```

What makes these work: the quotes are real intercom lines, some as code strings (`src/quest/*.ts`) and some only as voiced audio (`assets/Audio/ambience/announce_*.ogg`) whose wording is recorded in the design notes; the gate-13 copies are AvatarShapes, so they appear as text and footage, never as renders; the gate-13 footage note stops before the correct pick.
