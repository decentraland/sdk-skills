# Audience first: name the 100, find where they are, post there

Posting into the void is the default failure. The kit used to produce copy for "whoever follows the handle"; this step makes it produce copy for a named group, in the places that group already reads, with the evidence on the page so the creator can correct it. Sources: the Decentraland Foundation deck *Find your first 100 players* (Bay, Oct 2026) and the guerrilla-marketing notes that came with it (Uber × NFLPA via Wired, Sep 2013; Inc. on the "$0 marketing strategy"; Founders Focus and HubSpot campaign collections). The deck's own cases: Discord (talked to every newcomer in one Final Fantasy XIV server), Tinder (one campus, parties where entry was a download), Wordle (productised the emoji grid players invented), Stardew Valley (built for the Harvest Moon fans who had nothing on PC), Among Us and Vampire Survivors (small streamers first), Supercell (a stop rule before the test), Dropbox (one demo video made for one community, ads at $233–388 per $99 customer).

## The method in one table

| Move | What it means here | Where it lands in the kit |
|---|---|---|
| 1. Find your 100 | A group you could name, in a thread, server or meetup you could name. "Cozy gamers" is not an audience; "the 300 people who post their layouts in a named Discord" is. | `audience.who`, `audience.venues` |
| 2. Get to know them | What they play this week, what they screenshot or brag about, what they last complained about, in their words, and who they trust (a small streamer, a mod). | `audience.likes`, `audience.trusts` |
| 3. Design for them | Would an outsider shrug at it? Good. Give them a role (judge, vote, name, test). | `audience.insight`, the `reddit` posts' angle |
| 4. A reason to play now | A challenge, a competition around what they already care about, a collab with a small creator, something worth sharing. | `plan.experiment` |
| 5. Recruit 20 by hand | Personal messages, no spam. Then watch: joined, got it, enjoyed it, returned, brought anyone. | `plan.first_20`, `plan.measure` |
| 6. Measure, then repeat | Report behaviour, not reach: "35 new players → 12 completed the loop → 6 came back", never "we reached 20,000". Set the stop rule before the test. | `plan.stop_rule`, the page's Plan section |

Two guerrilla ideas from the notes that the venues step leans on:

- **Borrow trust, remove the barrier** (Uber started with professional drivers and NFL players' ride credits). Downloading a new platform to try one game is a big ask. A hosted game night, a tournament, a small streamer's lobby, or a role in the game ("come judge the entries") is a smaller one. Put the invitation in a trusted person's hands when you can.
- **Find them where competitors are not looking** (the financial advisor who advertised at the beach, because his investors surfed after the close). Ask what the players care about *outside* games. A liminal-horror game's people are in photo and architecture communities; a racing game's are in car communities; a social-deduction game's are in board-game groups. Those venues have far less competition for attention than r/gaming.

A small, relevant room beats 100,000 untargeted impressions. If the creator cannot name a thread, server or meetup, the kit is not ready: say so, and make naming one the first thing the plan asks them to do.

## Step: write `audience` before any post

Do this after the context gather (SKILL.md step 1) and before `posts.json`. Fill the object from the best source available and label every row with its source. The page shows the labels; rows marked `assumed` are highlighted so the creator corrects them before posting. Never present an assumption as a finding.

Sources, best first:

1. **`design/gdd.md` §8 "Audience & Comparables"**: the primary player described through experience ("for players who already enjoy …"), how the first group arrives, "deliberately not for", and the two comparables. Treat `[agent-decided]` and `TBD` lines as `assumed`, not `gdd`.
2. **`design/promo-brief.md`** (question 4, audience and comparables) → `brief`.
3. **The repo**: genre, mechanics, player count, mood, named inspirations in `design/references.md` → `repo` (these prove the game, not the people; use them to pick candidate venues).
4. **The creator, this session** → `creator`. When the GDD and brief are silent, ask the four questions from the deck, one or two at a time, each with a suggested answer: *Which subreddit, Discord or meetup are they in right now?* · *What are they playing this week?* · *What did they last complain about, in their own words?* · *Who do they trust?* Also ask what they care about outside games. Offer to proceed on assumptions if they prefer; mark those `assumed`.
5. **Research** (web search, this session) → `research`, always with a URL. Research fills the venue facts (does the sub exist, size, rules, what posts do well) and the "in their own words" rows. It never invents the audience itself.

What goes in (schema in `posts-guide.md`):

- `who`: one sentence through experience, not demographics. "People who collect photos of empty airports at 3 a.m. and argue about whether a place counts as liminal", not "18–34 horror fans".
- `not_for`: the likely visitor this is not for. Keeps the posts specific.
- `likes`: 3–6 rows, in their words where research or the creator supplied them: what they share, what they complain about, what they play this week. Quote real phrasing from the venue when you have it (with the URL).
- `trusts`: 1–3 rows: named small creators, mods, a weekly thread. Big streamers follow small ones.
- `outside`: 1–3 rows: what they care about outside games (the beach, not the financial magazine).
- `insight`: the one line everything else follows from. "They already post 'does this count?' photos; the game is a place that counts."
- `venues`: 3–6 verified places (below).
- `assumptions`: what you assumed and want corrected, in plain words. The page prints these at the top of the Audience panel.

## Step: verify every venue

A venue is a specific named place: `r/LiminalSpace`, `#showcase in the Backrooms Wiki Discord`, "the Decentraland DAO Discord's #scenes channel", "Lisbon indie games night, first Thursday". Each needs, from research this session:

- `exists`: the search found it (URL). If the search cannot reach it, mark `[CHECK: could not verify]` and say so in the report. Never list a venue from memory alone.
- `size`: members, if visible. Small is fine; relevance beats size.
- `rules`: what the sidebar or a pinned rules post says about self-promotion, links, flair, posting frequency, account age or karma gates, and whether game posts are on topic at all. Quote or paraphrase the rule with its URL and date read. Common patterns: a monthly limit per creator (r/playmygame), "no self-promotion" with a value-first exception (most hobby subs), required flair (r/indiegames, r/IndieDev), karma or account-age automod gates. If the rule says no, the venue is for **listening and becoming useful**, not posting: say so in `walk_in` and write no post for it.
- `why`: why these people, in one line that names the overlap with `audience.who`.
- `walk_in`: how to enter without dropping a link (the deck's four steps: understand what they play, talk to the moderators, build or run something only for them, give them something worth sharing). Name the mods or the weekly thread when research found them.
- `post`: the id of the `reddit` post (or other post) written for this venue, or `null` when the rules say only comments.
- `verified`: the date you read the rules.

Outside Reddit, the same fields apply to Discord servers, forums, Steam-adjacent communities, newsletters, local meetups, and the Decentraland ones (the Decentraland DAO and community Discords, the weekly community calls, the Events page). Include at least one place that is about the players' outside interest, not about games.

### Research recipe (what actually answers, measured on the Eeireport kit, 2026-10-22)

`{baseDir}/scripts/research_venues.py` wraps the two sources that work without keys; copy it to `promote/tools/` so the creator can re-run it.

| Need | What works | What does not |
|---|---|---|
| What posts do well in a sub (for `modelled_on` and `likes`) | `python3 research_venues.py reddit LiminalSpace IndieDev` → the top posts of the year from `r/<sub>/top/.rss?t=year` (title, URL). The script waits 12 s between subs; quick successive requests get an empty body. | `about.json` / `rules.json` (a block page without auth). |
| What they posted this week | `research_venues.py reddit-new <sub>` | |
| A sub's rules, flair list and member count | The live sidebar, read by the creator, or a third-party mirror found by web search (subriff.com/subreddit/<sub>, gummysearch.com/r/<sub>/, thehiveindex.com). Record the mirror URL and date, and add `[CHECK: confirm on the live sidebar]` because mirrors lag. | Web-search tools cannot read reddit.com; mirror pages of Reddit (redlib and friends) sit behind bot checks. |
| Shorts in a format this audience watches (for `modelled_on`) | `research_venues.py shorts "liminal horror game"` → title, URL and view count from the YouTube results page. Views tell you which format carries and which premise exists with 49 views. | Web search with `site:youtube.com` (ignored). |
| Discord servers | Web search for the server's discord.com/servers listing (member count, description). Channel names and rules need the creator or a mod. | |

When none of this reaches a venue, keep it with `[CHECK: could not verify]` in `rules` and `size`, write no post for it, and say so in the report. A venue the creator names from their own membership counts as `creator`, and its rules still need reading.

## Reddit posts (`kind: "reddit"`)

One post per venue whose rules allow it, written as a member of that community, not as an ad. Reddit rewards the title and the first image; the body is read second; a link in the body is downvoted in most hobby subs and allowed in the dev subs with the right flair. Rules for the copy:

- **Model the title on posts that already worked there.** Search the sub for the top posts of the last year in the post's lane (a showcase, a making-of, a "does this count", a question) and record two or three as `modelled_on` with title and URL. The patterns that recur in dev subs: "I spent N months making a [thing] where you [verb]" with a GIF; "My [genre] game about [specific thing], what do you think of the [one element]?"; a short making-of with one surprising detail. In hobby subs: a photo or clip that is on topic on its own, with the game named only in a comment or in the body's last line. Copy the shape, never the words.
- **Lead with what the sub values.** r/LiminalSpace values an image that is unsettling on its own; a dev sub values the process and a specific question; a horror sub values the moment. The game link is the last line, or a comment, or absent, according to the venue's rules (`link_in`).
- **Say who you are.** "I made this" in the title or the first line. Never pose as a player who stumbled on it, never post from a second account, never ask friends to upvote. That is vote manipulation and astroturfing: against Reddit's rules and the Decentraland Content Policy's "not false or misleading", and it gets the game banned from the sub it most needs.
- **Give them a role** where the game allows one: ask the sub to rate, name, judge, or find something. A question gets comments; comments keep the post up.
- **Respect the gates**: `rules_note` on the post repeats the frequency and flair rule so the creator does not post twice in a month, and names the flair to pick.
- Title ≤ 300 characters (Reddit's limit), usually under 100. Body in short paragraphs; verbatim in-game lines are allowed and good. Same no-spoiler and no-invented-facts rules as every other post. Inspirations stay out of the copy unless the owner opted in, **but choosing a venue by inspiration is fine**: the airport can be posted to a Backrooms community without the word "Backrooms" in the post.
- The attached image or clip: a render or the key art for an image post; a footage post's video when it exists (Reddit autoplays muted video, so captions matter).

## YouTube Shorts (`kind: "short"`)

Proposals only on the first run (no video is rendered, same as footage posts). A Short is vertical 9:16 at 1080×1920; the platform accepts up to three minutes (since October 2024), but the formats that travel are 15–45 seconds, and the first two seconds decide whether anyone stays. The same file serves Instagram Reels and TikTok.

For each Short write:

- `hook`: the on-screen text for seconds 0–2, verbatim from the game where possible ("Would the passenger who is still breathing…"). The hook is the thumbnail, the title and the reason to stay, all at once.
- `beats`: 3–6 on-screen caption lines in order, each a few words, the post's own lines. Shorts are watched muted on a phone; the captions carry it.
- `yt_title` (≤ 100 characters, the hook or a question; `#Shorts` is optional, the aspect ratio is what classifies it) and `text` (the description: one line on what the game is, the link, the handle).
- `footage`: the shot note, same recipe as footage posts, with the length in seconds and "vertical" so **Copy video prompt** reads it. Say where the subject sits in the 16:9 recording so the 9:16 crop keeps it (middle third).
- `modelled_on`: two or three Shorts that work for this audience, found by search this session, with the format named: "POV: you are the only passenger", "I made a horror game where …", a one-moment clip with a question card, a "rate my …" cut. Record title and URL. Copy the format, not the content.
- The image is the closest render or quote card; the page shows it in a phone frame with the hook over it.

Audience fit over trend: a format from r/gaming's front page is not a model for a Short aimed at people who post empty-corridor photos. Pick the format from what *they* watch (`audience.likes`, `audience.trusts`).

## The plan (`plan`)

Short, concrete, this scene only. It renders as the page's last section and in `copy.md`.

- `experiment`: the one small, cheap thing to run first (a challenge, a hosted night, a role, a post in one venue), with the venue named.
- `first_20`: how the creator finds and messages 20 of the 100 by hand (which thread, which mods, which small creators), no spam. Genuine outside players, not colleagues.
- `measure`: the five checks (joined · got it · enjoyed it · returned within 7 days · brought anyone) and what "got it" means for this game (completed the first room, finished one round).
- `stop_rule`: written before the test. "Fewer than 6 of 20 return in a week: change the pitch or the venue, do not buy ads." The deck: if 20 hand-picked players do not enjoy it, 2,000 of ads will not fix it.
- `days`: the seven-day assignment adapted to this scene (defaults in `build_kit.py`: find three places → collect evidence → name the 100 and design for them → make contact and launch one experiment → watch what players do → report and recommend repeat, change or stop).

Report behaviour, not reach, in every follow-up: new players → completed the loop → came back.

## What this step never does

- Invent a community, a rule, a member count or a "top post". Everything in `venues` and `modelled_on` carries a URL from this session's search, or a `[CHECK]`.
- Post for the creator, create accounts, or write anything meant to hide that the creator made the game.
- Replace the GDD's audience with its own. When §8 exists and is confirmed, `who` and `not_for` are quoted from it; research adds venues and words, not a new target.
- Promise results. The plan is an experiment with a stop rule, and the page says so.
