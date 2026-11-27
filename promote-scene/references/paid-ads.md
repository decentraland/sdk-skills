# Paid-ad mode: video and image creatives for an acquisition campaign

Organic posts (the rest of this skill) are judged on attention in a venue. A paid ad is judged on **players who reach the game and stay**: cost per engaged player plus day-1 return. Views, clicks, CTR and hook rate are diagnostics, never the verdict. That one change of goal moves every default below: what may be shown, the hook, the sizes, the test.

Sources: three Claim Bite ad productions (2026-11-26) and the campaign team's delivery spec (2026-11-27). Every audience and format default here is a **hypothesis until a campaign of ours confirms it**: no public performance data exists yet for cosy, pet or mining game ads, and desktop evidence is close to nonexistent.

## 1. Inputs, before any concept

Read first, then ask for whatever is still missing, one or two at a time:

- **The game's GDD or repo.** A GDD from **dcl-gdd** already answers two inputs: first-session content is §2 *First Minutes* (0 s to the natural stopping point) plus §4.2's *End of first session* row, and **the engaged event** is §3's *Engaged moment* row. Without them, ask: which core-loop moment counts (first ore sold, first cat adopted, first round finished), and what a brand-new player reaches in the first session. Also find the game's own audio files.
- **The footage inventory.** Run `python3 promote/tools/footage_index.py` (copied from `{baseDir}/scripts/`; pass any other folder that holds recordings) and read `promote/footage/_index/INDEX.md`: every recording with its length, shape and per-minute contact sheets with timestamps. Write in its notes column which recordings show first-session play and who played. Real playthroughs come first (footage ladder in `{baseDir}/references/video-posts.md`). Run it while no Explorer preview of the scene is up, or with `--out` outside the scene folder.
- **Market and language, platform (Meta, TikTok, Google PMax, X), mobile or desktop placement.**
- **Do the game's rewards have monetary value?** If yes, stop and ask for a legal and ad-policy review before writing anything.

**Blocker:** someone must confirm that a brand-new mobile user who installs the app and signs in actually lands in this game. Until that is confirmed, no paid result is valid: produce creatives if asked, but say so in the report.

## 2. The audience, for this game

Each game has its own audience. Derive it per game, with the same evidence discipline as `{baseDir}/references/audience-and-venues.md` (every row sourced, assumptions listed), then translate it into concept rules. Answer these:

1. **Who and where**: market, language(s), age band, gender split, the devices they play on (and what that device renders: a mid-range phone, not your desktop GPU).
2. **What they already play and share** in that market, in their words: the cue that tells them "this is for me". A cue must be specific and current, never a pasted meme.
3. **What reads as a turn-off or a scam there**: framings, symbols or claims that local players and the ad platforms distrust.
4. **The language question**: native language vs English is a variable to test, not a default.
5. **The motivation the game serves** (collecting, building, caring for something, competing, belonging): the concepts in §4 are built on these.

**Worked example (Claim Bite, campaign for Brazil, cosy players 18–25).** Take the method from it, not the audience:

- Money, earning, cash-out, slot or luck framing reads as a "games that pay" scam in that market, so nothing on screen suggests it, including in-game gambling UI, slot-machine props, a "try our luck" chat bubble, and the currency HUD ("Bite Coins" was cropped out).
- Portuguese vs English was set up as a test.
- Women were about half the audience and most play on low-end Android phones, so footage showed what a mid-range phone renders.
- The mobile call to action was "Jogue grátis no app Decentraland" ("Play free in the Decentraland app").

## 3. Truth rules (mandatory)

- **Promise ledger.** List every shot and every claim with where a new player meets it in the first session. A shot from late-game content carries an honest time label ("after a few days"), or goes back to the game team as design feedback. The ledger applies to the GDD too: claim only features the footage shows (Claim Bite showed the boom-town bonus; the GDD's idle miner and houses were not on screen, so they stayed out).
- **Real gameplay only.** A "not actual gameplay" disclaimer does not make a fake shot acceptable. A short stylised intro followed by real gameplay is fine.
- **Other players on screen.** When a mechanic needs more than one player to make sense (a race, a trade, a shared build), automated co-players are acceptable: avatars you drive in the real game (a second client, test accounts, scripted takes). Generated or composited people are fake gameplay. Captions never pass a staged handful off as a live crowd.
- No money or gambling framing when the market's audience reads it as a scam (§2), and anything the ad platform restricts, always.

## 4. Concepts and hooks

- **One player motivation per concept.** Show the input and its result: gameplay visible by 0.5 s, the hook paid off within 5 s.
- **Round 1 is a slate of 4–6 concepts** that differ in motivation, format and hook. Five captions on one clip are one concept, not five.
- **Prefer formats that keep player quality** over formats that only win installs. Fail and blooper reels belong to organic posting, or to a clearly labelled test.
- Organic `modelled_on` examples (posts and Shorts that did well in a venue) are **attention evidence only**: they show a format holds eyes, not that it brings players who stay.
- The end card matches the first screen a new player sees, and names the right destination for the platform (§6 rule 7).

## 5. Delivery set (campaign team spec, 2026-11-27)

Hard specs: they override the skill's organic lengths and sizes. When the buyer gives a different spec, theirs wins. Each concept ships as the full set, produced in priority order.

**Video**: MP4 (H.264), under 500 MB, **15–30 s** (15–25 s default).

| Priority | Ratio | Size (px) | Composition |
|---|---|---|---|
| 1 | 9:16 | 1080 × 1920 | `<id>-9x16` |
| 2 | 1:1 | 1080 × 1080 | `<id>-1x1` |
| 3 | 4:5 | 1080 × 1350 | `<id>-4x5` |
| 4 | 16:9 | 1920 × 1080 | `<id>`; also the desktop master |

**Images**: JPG or PNG, under 3 MB: 1:1 1200 × 1200 · 4:5 1080 × 1350 (or 960 × 1200) · 9:16 1080 × 1920 · 1.91:1 1200 × 628 (required for Google PMax) · 1:1 logo 1200 × 1200 (required for PMax; the official mark on a square canvas, never redrawn) · 4:3 thumbnail 400 × 300 under 500 KB.

- **One edit renders every video size.** Set `sizes: ["9x16", "1x1", "4x5"]` on the edit; each size is its own composition laid out natively (captions and end card positioned per ratio, not scaled). The 9:16 composition keeps text inside the platforms' safe zone (x 120–960, y 240–1260 on 1080 × 1920) by itself.
- **The 16:9 cut comes from horizontal footage**; a crop of a vertical master would throw most of it away. Desktop placements use it.
- **Capture natively vertical for paid ads** (`capture_play.py --vertical`, see `video-capture.md`). Centre-cropping 1080p 16:9 to vertical upscales about 1.8×: acceptable for a quick turnaround, soft for a paid ad.
- **Stills come from the same promise ledger**: a real first-session frame from a clean recording (not a captioned render), screened like the video. `{baseDir}/scripts/ad_stills.py` (copy to `promote/tools/` with `check_ads.py`) writes every image size from one moment: `python3 promote/tools/ad_stills.py claimbite C01 --from footage/visit.mp4@312.5 [--vertical-from footage/visit-v.mp4@40] [--focus 50,100] [--lang pt]`; it reports any size it had to upscale more than 10 %. The PMax square logo: `… ad_stills.py claimbite --logo <official mark from the brand folder>` → `claimbite_brand_logo.png`.
- **Language variants** (when §2 makes language a test): set `langs: ["pt", "en"]` on the edit and write every card, caption and end line as `{ pt: "…", en: "…" }`. Each size is then registered once per language (`C01-9x16-pt`, `C01-en`); a missing translation stops the render.
- **Variants without copy-paste**: `edits.ts` is TypeScript, so build the body once and swap the hook and end card per creative: `const body = {...}; EDITS.push({ ...body, id: "C02", cards: [hookB, ...body.cards] })`. The edit id is the creative id.
- **File naming carries the creative id, size and language** so one tracked link per creative maps one-to-one onto its files: `promote/ads/<game>_<creative>_<size>[_<lang>].<ext>` (`claimbite_C01_9x16.mp4`, `claimbite_C01_1x1_pt.jpg`; the 16:9 video is `16x9`, the stills are `1x1 4x5 9x16 191x1 4x3`, the logo `<game>_brand_logo.png`). Ads go in `promote/ads/`, not `promote/videos/` (that folder is the kit page's, and its builder expects post ids and 16:9).

```bash
cd promote/video
for r in 9x16 1x1 4x5; do npx remotion render C01-$r ../ads/claimbite_C01_$r.mp4; done
npx remotion render C01 ../ads/claimbite_C01_16x9.mp4
# with langs: ["pt", "en"]
for l in pt en; do for r in 9x16 1x1 4x5; do npx remotion render C01-$r-$l ../ads/claimbite_C01_${r}_$l.mp4; done
  npx remotion render C01-$l ../ads/claimbite_C01_16x9_$l.mp4; done
```

## 6. Production rules (from the Claim Bite runs)

1. **Frame 0 is bright gameplay with the hook already on screen.** Never fade in from black: Slack, X and the ad platforms use frame 0 as the thumbnail. An opening card (`from: 0`, `over: true`) is fully visible at frame 0; give the first shot no `dip`. Check every render: `ffprobe -v error -f lavfi -i "movie=<file>,select=eq(n\,0),signalstats" -show_entries frame_tags=lavfi.signalstats.YAVG -of csv=p=0` prints frame 0's mean luma; black is 16, so it must be well above that (a bright gameplay frame reads around 100).
2. **Screen every chosen moment for banned content before cutting**, at 1-second resolution (`fps=1` sheet of just that window), not from a sparse contact sheet. Both Claim Bite drafts landed on gambling material by accident.
3. **Crop currency and money HUDs** when the market rules them out, or flag them for a person to decide: `zoom: 1.15` with `focus` on the opposite edge pushes a top bar out of frame.
4. **Read the GDD first**; claim only what the footage proves (the promise ledger).
5. **Music from the game repo's own audio** (`assets/sounds/` or wherever the scene keeps it), game sound mixed underneath at about 25 %. Say so when the scene's live loop is not in the repo.
6. **Brand layer** for campaigns run with the Decentraland campaign team (the ad sends players to Decentraland, so its layer is Decentraland's; the game's own name and logo still lead the creative): text and graphics follow the DCL ONE design system (Figma, ask the team for the file); Inter Bold for titles and buttons, Inter Semi Bold for captions; `#FF2D55` for the call-to-action button, `#161518` for dark backgrounds, a 60 % black backdrop behind captions; the Decentraland logo from the brand Drive folder, white on dark end cards. Font sizes scale proportionally for 1080 × 1920. Known gap: an ffmpeg-only pipeline cannot draw the design system's rounded button corners; Remotion can.
7. **Call to action per platform.** Mobile ads name the app ("Play free in the Decentraland app", in the market's language). Desktop and X placements say "Play free in Decentraland" and never mention the app.
8. **Desktop audiences get the 16:9 master**, not the vertical cut.
9. **Mine existing recordings before new capture.** One recorded visit of about 13 minutes was enough for a 30-second ad.

## 7. Check before delivery

1. `python3 promote/tools/check_ads.py` must end with no FAIL and no MISSING (`--partial` only when the buyer agreed to a smaller set). It checks every file in `promote/ads/` against §5: name, exact size, MP4 / H.264, 15–30 s, file-size limits, frame 0 and stills not dark, and every size, still and the brand logo present per creative and language. Fix and re-run until it passes; the spec lives in its tables, so another buyer's spec is an edit there.
2. Then read what a script cannot judge, per size: a 1-fps sheet with text inside the safe zone, subject in frame, the hook readable on frame 0, no banned content, no slate, the end card complete.
3. Every shot is in the promise ledger and every claim traces to the GDD or the footage.

## 8. Test plan

Write it next to the organic plan (`posts.json` `plan`) when the creatives are for a campaign:

- Round 1 runs the 4–6 concept slate (§4) at equal budget, one tracked link per creative, before any concept is polished.
- The verdict per creative is cost per engaged player (the §1 event) and D1 return; CTR, views and hook rate only explain a result.
- Write the stop rule before spending, as for the organic plan.
- Nothing is valid until the landing blocker in §1 is cleared.

## Still open

- Whether new mobile users land in the game after installing and signing in (blocks valid testing).
- Brazil's ad regulator (CONAR) and crypto or reward ad policy: not researched.
- Desktop evidence is close to nonexistent.
