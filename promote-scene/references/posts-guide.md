# posts.json: schema, kinds, writing rules

`promote/posts.json` is the single source of truth for the kit. `make_logo.py`, `compose_social.py` and `build_kit.py` all read it. A complete runnable example (Eeireport, 5 posts) is `{baseDir}/scripts/posts.example.json`.

## Schema

| Key | Type | Used by | Notes |
|---|---|---|---|
| `game` | string | all | Display name. Lower-cased and slugged for logo file names (`<slug>_wordmark.png`). |
| `tagline` | string | logo, page | One line, from the GDD's promise. Upper-cased on the lockup. |
| `link` | string | page, copy.md | Jump link (see SKILL.md step 2), or `""` when unpublished. |
| `handle` | string | page mockups | `@yourhandle` until the creator gives one. |
| `listing` | `{short, long, handles, events?}` | page, copy.md | Profile / listing copy, see below. `handles`: `{"x": "@…", "instagram": "@…", …}`. `events`: optional recurring schedule, day and time in UTC. |
| `event_banners` | bool | compose | Foundation event-page banners (1340×670, 716×1814, JPEG ≤ 500 KB). Default `false`; set `true` when the creator mentions events. |
| `hashtags` | `{core: string[], extra: string[]}` | page, copy.md | core ≈ 3 tags, extra ≈ 4–6. |
| `brand` | object | logo, compose, page | `text`, `ink`, `accent` (hex); `font`, `font_small` (absolute .ttf paths); optional `wordmark` (override text), `icon_text` (1–3 chars, default the initial), `icon_top`, `icon_bottom`, `quote_tag` (small accent label on quote cards). |
| `keyart` | `{"<w>x<h>": path}` | compose | Text-free plates relative to `promote/`. Missing sizes are centre-cropped from the first entry. |
| `keyart_logo_y` | number 0.25–0.75 | compose | Vertical centre of the wordmark on key art (default 0.42). |
| `x_header_logo` | `"left"` \| `"right"` | compose | Side of the X header the wordmark goes on (default left). |
| `quote_cards` | `[{id, render, line}]` | compose | `line` uses `\n` for breaks (~28 characters per line at 1080 px). `id` becomes `images/social/<id>.png`. |
| `images` | `{key: {file, alt}}` | page, copy.md | Every image a post can reference. `file` is relative to `promote/`. `alt` is required (Copy alt text). |
| `shotlist_tips` | string[] | page, shot list | 4–7 practical recording tips specific to this scene. |
| `posts` | Post[] | page, copy.md | See below. |

Post: `{id, kind, title, text, image, ig_image?, footage?, cta?, platform?}`
- `kind`: `launch` · `soon` · `footage` · `quote` · `bts` (`build_kit.py` warns on anything else).
- `image` / `ig_image`: keys into `images`. `ig_image` is the square or portrait alternative shown in Instagram mode.
- `footage`: **required on `footage` posts**. It is a concrete "what to show" note (see recipe).
- `platform`: `"ig"` or `"x"` marks a post written for one platform (e.g. a long Instagram caption).
- Placeholders in `text`: `{LINK}` (filled from `link`), `{N}`, `{DATE}` (the creator fills these), `[FOOTAGE]` (where the clip goes).

## Profile / listing copy (`listing`)

The Foundation's marketing package asks for exactly two descriptions (see `{baseDir}/references/marketing-package.md`). `build_kit.py` puts them at the top of `copy.md` and in a "Listing copy" block on the page, with Copy buttons and a length counter on the short one. It warns when `short` is missing or over 160 characters.
- **`short`**: ~140 characters, 1–3 sentences. Verb first: what you *do*, then who with or why come back. It doubles as the proposed `display.description`. Eeireport: "Walk an empty airport, search abandoned bags and satisfy a protocol-obsessed officer to reach gate 13 before the final boarding call." (133 characters; the scene's own description, "A strangely empty airport. Find gate 13 before the final boarding call.", only sets a mood.)
- **`long`**: at most two short paragraphs. Lead with the activity and the people, then recurring moments and why come back. A one-time story says so honestly. Do not invent replay hooks.
- Same sourcing rules as the posts: every claim traces to the docs, the code or the scene.

## The five kinds (default counts)

- **launch (4)**: needs `{LINK}`. One post each for the promise, a signature character or mechanic, what the game is (length, how you play, "free, in your browser"), and one with a different angle (bring a friend, a single-line joke).
- **soon (4)**: no link. A teaser line from the game, a mood post, one `{N}` / `{DATE}` countdown template on the logo lockup, and one aimed at the genre audience.
- **footage (4–5)**: a short caption plus `[FOOTAGE]`. The `image` is the closest render, shown behind the "insert footage" slot. One footage post can be a ~30-second trailer cut with a timed shot order.
- **quote (3)**: one verbatim in-game line per post, each with a matching quote card in `quote_cards`.
- **bts (2)**: how it was made: the jam or origin, one technical or design detail that is genuinely interesting. Hashtags like `#gamedev` may sit inline here.

## Writing rules

- Sound like the game, not like an ad. Use the game's own voice: an intercom, a sign, a character. No "immersive experience", "epic adventure", "don't miss out".
- Short lines, white space, one idea per post. Keep X posts under 280 characters with the link counted as 23 (the page shows the count).
- Use real lines verbatim from `src/` and the design docs. Voiced lines (announcer or intercom audio) often exist only as `.ogg` files, with their wording written in the design notes. Look there too, and never transcribe audio you have not seen written down. Every factual claim must trace to a source. Use `[CHECK: …]` when unsure.
- Name the game consistently (Eeireport used ALL CAPS in copy, matching the wordmark).
- No spoilers: not the ending, not the solution, not the final card.
- Inspirations and comparisons only if the owner opted in.
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
