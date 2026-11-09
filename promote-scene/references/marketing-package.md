# Decentraland Foundation marketing package checklist

Source: the Decentraland Foundation's Notion page "New Experience: Marketing Requirements", https://app.notion.com/p/decentraland/New-Experience-Marketing-Requirements-38b5f41146a580f1bd93c86f8f1ca96d (read 2026-10-19; re-checked against a copy of the page on 2026-11-09, which now calls the trailer strongly recommended). Summarised here, so the checklist works without the page. Re-read the page if the creator is submitting to the Foundation, since it may change; if it asks for a Notion login, ask the Foundation for the current link rather than guessing.

Why it matters: most people meet a game as a thumbnail in a feed, a clip on a timeline or one line of text on a card before they arrive. The package is how the creator makes that first impression on purpose. Every item answers the same test: can a stranger picture the game and know what they will do there, and does it make them want to jump in? With these assets a game can be featured and shared on Decentraland channels and by the community.

Walk this list with the creator. Mark each item **done** (with the file or field), **in the kit** (produced by this skill), **shot list** (needs in-world capture) or **missing**.

## The basics

- [ ] **Game name**: IP the creator can own, not trademarked or used by another game, explanatory but unique. You can only flag concerns. Never say a trademark or name check passed. That is the creator's job. Rules and the Content Policy points: `{baseDir}/references/brand-and-ip.md`.
- [ ] **Category and tags**: `scene.json` `tags` (valid list in **deploy-scene**).
- [ ] **Jump-in link** to the live experience (SKILL.md step 2).
- [ ] **Handles on every social** for tagging and credit → ask for them in SKILL.md step 4 and list them in the README's marketing-package section, so the creator can paste them to the Foundation. `posts.json` keeps only `handle`, the one shown on the mockups.

## Game description

- [ ] **Short description**, ~140 characters or 1–3 sentences: what the game is and what you **do** there. This is the line that earns the tap. Pattern from the Foundation's examples: lead with verbs and the activity, then who you play with and why you come back (a best time, a leaderboard, friends). A description that only sets a mood ("a strangely empty airport") misses the "what you do". → `listing.short`, and usually `display.description` too.
  The Foundation's own examples, all verb-first, all naming the people and the return hook (a best time, a leaderboard, friends, a shared moment):
  - Shroom Zoom: "Bounce, double-jump, and glide around a beautiful glowing lakeside mushroom world, collecting sprites, uncovering hidden lore, and racing to beat your best time or challenge your friends. How fast can you make it around the lake?"
  - Flag Tag: "A fast-paced multiplayer keep-away game where you chase, tag, and outplay others to hold the flag the longest, using clever movement, tools, and tactics to climb the leaderboard."
  - Monster Recon: "Outsmart rapid-fire Memory Match rounds, then dash through camp to hunt down your monsters. Build your Codex with rare, exotic, and epic finds, compare discoveries with friends, beat your best times, and battle for the top of the monster leaderboard."
  - Fast Lane: "Book your lane, bowl classic 10-pin matches, and chat between turns in a social bowling experience built for friendly competition, lively spectators, and shared moments."
  - Clean The Club: "Team up with your friends to transform a trashed nightclub before the next party begins, clearing bottles, cigarettes, and lost items from the chaos of the night before. Work fast, clean smart, and get the club looking amazing before the partygoers arrive and judge the vibe."
  Several run past 140 characters: the Foundation treats the count as a target, not a cap, and `build_kit.py` warns above 160.
- [ ] **Long description**, at most two short paragraphs: lead with the activity and the people, and mention recurring moments and what makes it worth returning to. → `listing.long`.
- [ ] **Recurring moments / schedules**: anchor events with day and time **in UTC**. → `listing.events` (omit if there are none).

## Images

All PNG or JPG. The key visual must stay readable when shrunk to a phone-sized card.

- [ ] **Scene thumbnail**, 16:9, 1920×1080 = `display.navmapThumbnail`, the Places card. Best practice: a gameplay screenshot with a clear, distinctive logo overlaid, minimal readable text, all text inside the central 1080×1080. Spec and size cap: **deploy-scene** > Thumbnail image. This skill never overwrites it. Suggest the key art (`keyart_1920x1080`) as a candidate only after checking it meets that spec.
- [ ] **One clean in-world 16:9 screenshot**: no text or overlays, just gameplay with people playing → **shot list** (avatars cannot be rendered).
- [ ] **Social square**, 1:1, 1080×1080 → in the kit (`keyart_1080x1080`).
- [ ] *Optional:* **event page banners**, max 500 KB each: horizontal 1340×670, vertical 716×1814 → `compose_social.py` with `"event_banners": true`. The Foundation does not create events for an experience. It recommends creators run their own as part of their launch.

## Recommended extras

- [ ] **2–4 gameplay stills**, 16:9, at least 1920×1080, for social, newsletter and press → **shot list**.

## Trailer (strongly recommended, under 30 s)

The Foundation calls the trailer the best way to market a game: hype it up and show it off. It is the one item outside the required set to push for.

- [ ] Horizontal 16:9, 1920×1080, under 30 s, with in-experience footage of **people in motion in the first three seconds** → **shot list** (or, on request, the kit's trailer-cut video from the creator's recordings: `{baseDir}/references/video-posts.md`; only a real recording can satisfy the first-three-seconds rule).
- [ ] Vertical cut, 9:16, 1080×1920, under 30 s → **shot list** (or `videos/<post id>-9x16.mp4` from the same request).
- [ ] On-screen text or captions, so it works with the sound off → **shot list** (kit videos always carry captions).

The screenshot and trailer items are default `shotlist_tips` in `build_kit.py`, so they always land in `footage-shotlist.md` and on the kit page.
