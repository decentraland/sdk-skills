# The Greybox — A Small Playable Build

Use the simplest representation that preserves the property being explored. Primitives are the
default, but a model, light, sound, menu or saved state belongs when the question depends on it.
Reuse suitable assets and systems. Stop when the selected observation or test is possible.
For missing models or materials, consult [scene resources](scene-resources.md) as needed.
For a mood, light or sound question, choose a relevant [atmosphere trial](atmosphere-trials.md).

## Order of work

1. **Plan the observation first.** Instrument the selected measured criterion; an exploratory or
   owner-feel pass needs perceivable feedback and notes, not an invented numeric proxy.
2. **The interaction, real.** Input, timing, collision, camera and feedback; for a toy, connect
   the actions needed to play with it before tuning each part separately.
3. **Everything else, faked.** In the crudest form that lets a tester keep playing.
4. **Smoke-check the setup.** Confirm the action and observation work. For a registered test,
   check that its outcomes can be distinguished; smoke is not evidence of human enjoyment.

## Preview lifecycle

Reuse the open Explorer for the current scene. Ordinary edits should hot-reload while preview
is running; check the updated scene there instead of launching again after each build.
Hot reload can occasionally fail or leave stale behaviour. If an update visibly fails to apply
or the preview glitches, a close/reopen is reasonable; don't restart routinely or treat that
symptom alone as a scene-code failure.

Before launching, check preview status and whether Explorer is already running. A missing MCP
connection does not mean the app is closed. Normal testing uses one Explorer instance.
If a restart is needed, close the existing test instance, confirm it exited, then launch once.
Coordinate before interrupting the owner's active playtest. Multiple clients need an explicitly
arranged multiplayer setup; don't attempt a second normal launch as a connection retry.
If recovery still fails, report the observed app/connection state and use manual testing where
possible, rather than repeating launches. A successful build is not a visual check.

## Instrumentation, cheapest first

At playtest scale — an owner self-test or a handful of testers — **a human with a
stopwatch beats telemetry**. Do not build analytics for a sample this size.

- an observer with a timer and the session block open;
- on-screen debug text: the counter, the current state, elapsed time;
- console log lines with timestamps, read afterwards;
- screenshots at the moment of interest, especially for mobile legibility questions;
- a screen recording when the metric is "where did they get stuck".

Record the chosen measure or observation with its conditions after each pass. Instrument only
what this pass tests; a future external criterion may remain unmeasured in an owner-feel pass.

## Where the mechanics come from

**Never write SDK7 API from memory.** Two sources, in this order:

- **`sdk-skills`** — the official skill set, `npx skills add decentraland/sdk-skills --all` (add `-g`
  for user level). Composite-first rules and the component reference live there, and parts of the API
  are newer than any model's training data.
- **[`sdk7-test-scenes`](https://github.com/decentraland/sdk7-test-scenes)** — the greybox mechanics
  catalog. Small single-mechanic scenes named by parcel coordinate: trigger areas,
  tweens and moving platforms, proximity interactions, pointer-event feedback, modifier areas, input
  modifiers, move-player-to, particles, UI, avatar emotes, an authoritative-server leaderboard. **Grep
  the folder before writing a mechanic from scratch** — an experiment that starts from a working
  reference scene starts a day earlier.

**Neither source available and installing fails?** Say so to the owner — then work from the
official SDK7 docs, indexed in
[dcl-capability-links-2026-08.md](../../dcl-gdd/references/platform/dcl-capability-links-2026-08.md),
and mark every mechanic written that way as built from the docs, no verified reference behind it.
The fallback replaces the source, never the rule — writing from memory stays off the table.

[`sdk7-goerli-plaza`](https://github.com/decentraland/sdk7-goerli-plaza) is the quality bar *above*
greybox. It is the right reference when the prototype graduates toward a slice, and the wrong one for
an experiment — reaching for it in phase 2 is how a two-day test becomes a two-week build.

Background, when the owner is new to the SDK:
[SDK 101](https://docs.decentraland.org/creator/scenes-sdk7/getting-started/sdk-101) ·
[vibe-coding docs](https://docs.decentraland.org/creator/scenes-sdk7/getting-started/vibe-coding).

## What gets faked, concretely

Use these shortcuts only for properties outside the current question; do not fake its evidence.

| Thing | Fake |
|---|---|
| progression, unlocks | a number printed on screen, set by hand |
| economy, rewards | arithmetic in the brief; a debug button that grants |
| other players | a scripted entity, or another client in an explicitly arranged multiplayer setup |
| art, characters, environment | primitives; colour carries meaning |
| audio | one sound on the verb under test if the feel depends on it, otherwise silence |
| onboarding, menus, settings | the task read aloud to the tester |
| persistence, save state | none — restart between sessions is fine and often better |

Audio is the frequent exception worth naming: if the hypothesis is about *feel*, the feedback sound is
part of the verb, not decoration.

## Keep the build focused

For a registered experiment, build to the brief. If its scope needs to change, record why and
resolve the brief before continuing; do not silently change what the test can establish.

For exploration, follow owner-led revisions and keep the current question small enough to try.
Replacing a primitive, tuning light or expanding a route can serve that question. Unrequested
systems that do not help the current observation are drift; an authorised change is not drift
merely because it was absent from the first note. Use the [exploratory route](experiment-brief.md#exploratory-try).

## The scene is evidence

For a registered test, keep it in the scene repo, named after the experiment ID (`H1-02-pop-feel/` or a branch of the same
name), so a verdict can be re-checked and a re-test on a higher rung starts from the same build. Note
where it lives in `## Sessions`. Screenshots, recordings and raw notes go in the folder next to
the experiment file — the contract says intermediate files park there.
For exploration, reuse the scene's existing location and record the build/version and observations
in its dated note. No new branch or H-named folder is required.
