# The Brief — Pre-Registering the Verdict

The brief exists so the experiment can fail. It is written **before** the build, because the criterion
is what shapes the build: what to fake, what to observe, what not to make. An exploratory build
can discover a useful question; do not retroactively call it a pre-registered test.

## Exploratory try

For an early toy or a sound/movement/look trial, agree only the playable interaction or impression to explore
and the build boundary, reusing the owner's request. No metric, numeric threshold or H-file is required.
Save the intent and build location in an existing dated note under `design/`; create one only if
needed and resume from it. No fixed headings or Hypothesis Log index is needed for this note.
Use [Build](../SKILL.md#2--build) for SDK sources and relevant playbooks, and
[minimal-build guidance](greybox-build.md) for the selected action. Record a smoke check before
offering a pass; if the owner asks to try immediately, hand it over and record smoke as skipped.
Neither requires a `## Sessions` section. Record actual human observations separately from smoke.

Build, let the owner try, then adjust what they choose. Changes to layout, light, sound, density
or an asset can be normal exploration, not a breach of a fixed brief. Keep the current intent and
build changes in the note; park the previous direction if they switch. Do not require a new
invocation or an H-file for each revision. Clarify a real ambiguity, not every already-requested edit.
A preference after several changes can guide the next version without proving which change caused
it. For a causal question, offer a narrower comparison; do not impose it on creative iteration.
Keep the question, build/change, conditions, observations and limits together in this note.
Save before a break. Do not suggest the expected feeling before they try it.

End with what they noticed and what remains unknown, not validated/survived/failed. Save taste
decisions with attribution; any GDD summary remains an observation, not proof. Apply the shared
[write-back and pilot review](../../dcl-gdd/references/hypothesis-log/verdicts.md#ownership)
to changed document claims. A later experiment earns its H-file under the parking contract,
with an agreed criterion before its test; earlier exploration stays separate evidence.
Close with the current build, what remains unknown and the owner's chosen next step: another
adjustment, a pause, or a return to design. No next H-ID or GDD handoff is compulsory. When a
handoff is useful, reuse the established chat/path; ask about the destination only if unclear.

## The pre-registered pair

The Brief pre-registers **two lines**, judged unchanged at the end:

- **`Criterion (external):`** the agreed observable criterion and its failure condition. This is
  the claim's full test. In an owner-only experiment it usually stays unmeasured — measuring it takes players the owner
  does not have — and stays open in the experiment and any linked source as `[HYPOTHESIS]`.
- **`Kill-check (owner-testable):`** the part of the claim the owner can kill alone, by feel. The
  owner's impression is evidence about this pass, not about every player's response or the cause.
  A kill-check that holds writes `survived`; one that fails can write a failure of that check only,
  under the shared verdict limits.

For Creator Success testing, use the program's separate external-player protocol when supplied;
it is not bundled here or required for a standalone experiment.

> **If you cannot describe what failure looks like, it is still an assumption, not a hypothesis.**

Take the criterion from the header block; confirm ambiguous provenance with the owner.
Keep one primary claim. Supporting observations need not become separate experiments.

When a threshold is needed, agree it before the test and anchor it to the question and conditions:
how many of which players, within what time, with what instructions. Do not invent precision.

Example for a completion claim: *"4 of 5 first-time players complete three drop cycles unprompted
inside 5 minutes."* These numbers are not defaults, and completion does not prove enjoyment.
*"Players find it engaging"* needs an observable interpretation, not an arbitrary number.

If the header cannot support a test, clarify with the owner or offer an exploratory try.
Do not rewrite their hypothesis or invent a proxy to make your experiment easier.

## Sanity checks before you build anything

1. **Can this pass's criterion be observed?** Name the instrument for a measured outcome,
   or the action and neutral prompt for an owner kill-check. Do not substitute one for the other.
2. **Would a different result change what we do?** If both outcomes lead to the same next step, this
   is not the experiment worth running today.
3. **Is this the cheapest rung that could answer it?** [the-ladder.md](the-ladder.md). Arithmetic
   beats a build; a build beats a build on mobile. A question about whether chosen people
   understand or act on the promise may need [no build](the-ladder.md#0--before-a-build-audience-check).
4. **Does the criterion actually follow from the IF/THEN?** A criterion that could pass while the
   hypothesis is false measures the wrong thing. Check units, population and time window too;
   several input variables may feed one metric. For calculation-only tests apply
   [arithmetic evidence](../../dcl-gdd/references/hypothesis-log/arithmetic.md).

## The block

```markdown
## Brief

- **Criterion (external):** <agreed observable outcome; units/threshold where applicable>. Failure: <one sentence>.
- **Kill-check (owner-testable):** <the claim the owner can kill alone, by feel — one sentence>.
- **Rung:** paper/arithmetic / audience check / desktop Explorer / mobile — because <what this method can settle>
- **Who tests:** skill via MCP (mechanical smoke only) / the creator by hand (any *feel* verdict) /
  both — *recommended: both, MCP smoke first* ([the-ladder.md](the-ladder.md))
- **Who launches:** the creator via Creator Hub / the skill via the preview server — asked, never
  assumed ([the-ladder.md](the-ladder.md))
- **Real:** <the verb under test, and the timings that matter to it>
- **Faked:** <progression, economy, art, other players, persistence — whatever is not under test>
- **Instrumented:** <how the selected check is observed; future external measures may remain unmeasured>
- **Not building:** <the tempting things explicitly out of scope>
- **Sessions:** <who tests — for an early experiment usually the owner alone — and how long each pass>
- **Task given to the tester:** "<the exact words, goal only — never the solution>"
- **Collected per session:** <the metric, plus what to watch for>
- **Briefed:** <date>
```

`Task given to the tester` is written here and read aloud unchanged later. Writing it in the moment is
how hints leak in.

## Real, faked, not built

**Real** is the verb under test and everything its feel depends on: input path, timing windows,
collision, camera, feedback on the action. If the hypothesis is about *how something feels*, the thing
it feels through cannot be a stand-in.

**Faked** is everything else, and faking is a skill worth using aggressively: progression as a printed
number, economy as arithmetic on paper, other players as a second window or a scripted entity, art as
primitives, persistence as nothing at all.

**Not building** is the section that saves the week. Write down what you are tempted by — the menu,
the score screen, the second mechanic, the nicer model — so that hour four has something to lose an
argument to.

## When the brief changes mid-experiment

The build is expected to change between passes — fix the instrument between owner passes and log
what changed; that is the method, not a violation. The criterion is different: it is fixed. If a change to the
build genuinely invalidates it — the fix altered the very thing the number measured — that is a
**return to the Brief step**: append the new pre-registration to `## Sessions`, marking from which
session it applies — the original criterion in `## Brief` stays untouched, so what was promised is
never rewritten — and count the earlier sessions separately. Recorded openly it is good science. Done
quietly it is why nobody trusts playtest numbers.
