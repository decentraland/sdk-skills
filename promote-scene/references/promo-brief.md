# Promo brief: when the scene has no design docs

Use this when the scene has no `design/gdd.md` and no `design/` notes (common for older scenes). Do not write posts from guesses. A repo shows **what was built**: the verbs, the spaces, the strings, the player count. It never shows the promise, the audience, what is worth showing or what must stay secret. Those come from the creator.

## Step 1: harvest what the repo proves (before asking anything)

Read `scene.json` (title, description, tags, parcels / World), `README`, `src/` (dialogue, UI text, announcer lines, item names, win/lose states, timers, player counts, `syncEntity` / multiplayer use), `assets/scene/main.composite` entity names, and model / audio file names. Write down, as proposals for the creator to confirm:
- what the player does (the verbs and the loop the code runs)
- solo or with others, and a rough visit length only if the code shows it (a timer, a fixed number of rounds)
- candidate signature moments (scripted events, set pieces, distinctive models)
- the ending or solution, if the code reveals one. It is a candidate secret.

Say in one line which answers came from the repo.

## Step 2a: hand off to `dcl-gdd` (if the skill is available in this session)

Recommend it in one line: *"There are no design notes yet. A five-minute interview with the GDD skill would capture the game's promise and best moments in `design/gdd.md`, and every later kit or proposal can reuse it. Shall I run it?"* On yes, invoke `dcl-gdd` on its **1E · Harvest** route with this frame, passed verbatim:

> Frame: harvest for promotion only. This is not a Creator Success proposal; this frame overrides the default proposal workflow. Capture: the one-line promise / what the player does; the first minutes; the core loop; 4–6 signature moments worth showing; audience and one or two comparables; what must stay secret (endings, solutions); title and IP note (flag only). Skip funding, retention, mobile, scope and review scoring. Fill what the repo proves first and interview only the holes. Then hand back to promote-scene.

`dcl-gdd` owns `design/gdd.md` and its authorship markers (`[agent-decided]`, `[OPEN: …]`, `TBD: …`). When it hands back, read the GDD as the step 1 source and treat `[agent-decided]` lines as unconfirmed: keep them out of posts or mark them `[CHECK: …]`. If the creator declines, use 2b.

## Step 2b: built-in lightweight brief (no `dcl-gdd`, or the creator prefers it)

Ask these questions one or two at a time. Each comes with the repo's suggested answer, so the creator mostly confirms or corrects. Use their words. Do not polish them into ad copy. Skip any question the repo or an earlier answer already settled.

1. **Promise**: in one line, what does the player do here, and what is it like? *(suggest: verbs from the code + the title's mood)*
2. **Who and how long**: solo or with friends or strangers? How long is a typical visit? Is it one-time or something you come back to?
3. **Moments**: which 4–6 moments would you show someone? *(suggest: the scripted events and set pieces found)*
4. **Audience**: who is it for? Is there one or two games, films or memes it is like? May those be named in posts?
5. **Secrets**: what must never appear in posts or clips (the ending, the solution, a twist)? *(suggest: anything the code reveals)*
6. **Name, handles, status**: any IP worry about the title? Social handles on each platform? Published, or coming soon (and when)? Any recurring events (day and time in UTC)?

This replaces the workflow's "ask once" step: do not ask about handles, publish status, secrets or inspirations again.

Save the answers to `design/promo-brief.md` (create `design/` if needed and say so). Never write `design/gdd.md` from here: that file belongs to `dcl-gdd` and its markers.

### `design/promo-brief.md` template

```markdown
# <Game> — promo brief

*Created by promote-scene on <YYYY-MM-DD> for the marketing kit. Not a GDD: `dcl-gdd` can harvest it
into `design/gdd.md` later. "Creator:" = the creator's words in this session. "Repo:" = read from the
project and confirmed by the creator. "Repo, unconfirmed:" = read from the project, not yet confirmed.*

## Promise
Creator: "<one line, verbatim>"

## Who and how long
Creator: <solo / friends / strangers; visit length; one-time or recurring>

## Signature moments
1. <moment> (Repo: <file or entity>; creator confirmed)
2. ...

## Audience and comparables
Creator: <who it is for>. Comparables: <names>, may be named in posts: <yes/no>

## Keep secret
Creator: <endings, solutions, twists>

## Name, handles, status
- Title IP: <creator's note; flagged concerns; "not checked" unless the creator checked it>
- Handles: <platform: @handle>
- Status: <published (link) / coming soon (date)>
- Recurring events (UTC): <or none>

## Harvested from the repo
- <fact> (<file>)
```

## Allowed sources for every claim

`design/` (GDD, decisions, ideas, references, the promo brief), the repo (code, scene, assets), or the creator's answer in this session. Anything else is `[CHECK: …]` or stays out of the copy.
