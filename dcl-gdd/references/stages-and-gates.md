# Stages, Gates and the Spiral

The stages, gates and automatic render offers below belong to the Creator Success proposal
route. General design uses the shared **Focused pilot review** when its triggers apply and
may use **The `.html` render** for an explicit presentation request; it does not inherit the
stage table, funding questions or scheduled offers.

## Two axes, one spiral

The proposal's two axes (creator-success.md) form a **spiral**, not a sequence and not a loop. One turn: the
document poses falsifiable IF/THEN hypotheses → the cheapest
experiment that could kill them runs → verdicts flow back into the log and rewrite the sections that
made the claims → the document leaps a gate and the prototype graduates a rung.

**Escalation discipline.** Each rung costs more than the last, so it must answer costlier questions.
Never spend a vertical slice answering a one-pager question. A hypothesis testable on paper must not
survive untested to the slice.

## The three document stages

These are proposal stages, not a required path for every game-design session.

One `design/gdd.md` grows through all three — you never start a second file. What changes is how much
of the template is real. A readable concept can be rendered before its experimental gate.

| Stage | Aligned prototype rung | Sections that must be real | The gate question |
|---|---|---|---|
| **1 · Concept one-pager** | find the fun | §1 promise · §3 with the verb and **a coherent intended loop, with unresolved beats named** (arrival and outcome included) — loop *measurements* wait for stage 2 · §2 first minutes (rough) · §7 world in 2 sentences + the visual signature · §8 comparables | Is there a game here at all — is the verb fun? |
| **2 · Pitch** | core loop playable | the loop *measurements* completed · + §4 in full · §5 social · §8 audience rows · §9 as a skeleton · §0 TL;DR (§0 minus the stage-3 fields below) | Would this hold a player past Day 1? |
| **3 · Short GDD** | vertical slice* | everything, including §6 mobile · §9 in full with the live-ops block (the template's "What keeps the experience changing after launch") · the header table and §0 (IP self-check, deployment target, requested round) | Is this fundable, and can this team build it? |

\* A vertical slice is not required before applying. Funded V0 has its own agreed slice scope;
see [funding and scope](funding-and-scope.md). `03-vertical-slice/` is created only when needed.

Sections not yet in scope for the current stage are simply **absent from the grown document** —
never filled with guesses; the template stays the reference for what is missing (the
growing-document model is defined in the skill's SKILL.md). Say out loud which stage the document
is at when you announce the classification in phase 0.

**The stage bounds the agent, not the owner** (hard rule 8): steps past the stage's set are
announced as out of scope rather than asked. In a document-only session the mode choice itself
is the standing request to keep going: once the stage's set is written and the one sanctioned
offer is declined, the interview continues into the next stage's set (see the skill's SKILL.md,
Document-only sessions). A stage is an expectation about what is worth asking yet, never a gate
held against the person writing. A **resumed** document may also have been grown at a different
stage than the one you would assign now — read the stage off what is actually written, and say so.

**At stage 1 the only retention theory required is fun itself.** The next-day (D1) sentence and return hooks
(§4) belong to stage 2. First make the intended experience clear; without a playtest, later
retention design remains a hypothesis. In doc-only, do not wait for proof to continue.
The reviewer's weighting of return theory applies to the *submitted* GDD, not to a stage-1 document in progress.

**Stage 1 cannot close on words:** its gate question — *is the verb fun?* — is answered by a
playable ([scope-and-evidence.md](scope-and-evidence.md), past tests retain their attribution and limits). Fun first, build first — a note to you, not a line to say aloud; to the owner it is
*"let's make it provable — a small greybox would give us something to link"*.

**Owner self-tests are an early experiment, not a funding gate.** A kill-check that holds writes
`survived`; it does not establish player validation or completion of funded V0. The agreed V0
slice is built and playtested with Creator Success. Do not postpone player testing to V1 by rule.

## Gates are soft

- A stage closes when **nothing worth testing remains at that level** — a judgment call, not a
  counter. Say why you think so, and let the owner overrule.
- The owner may skip forward at any time. Skipped experiments become `deferred` in the log; they do
  not vanish.
- Never block on completeness ([scope-and-evidence.md](scope-and-evidence.md)).

## What happens at a gate

These are experimental review moments, separate from having a showable written concept.
The Hypothesis Log index also rebuilds at section closes and verdict write-backs — never per park
(triggers: [**Regenerating the index**](hypothesis-log/index.md)).

1. Regenerate the Hypothesis Log index (`design/hypothesis-log.md`) by globbing.
2. Check that every `validated` / `survived` / `failed` verdict has already rewritten its source
   section.
3. Apply the HTML offer/update rules below; crossing a gate does not itself authorize a render.
4. Apply the focused pilot review below. Say what just became solid, and what is worth designing next — and offer the natural pause: a gate
   is the best stopping point in the whole interview, everything is saved, and resuming lands
   exactly here.
5. **If this game's repo exists**, report harvest coverage against the stage table above, in one line — *"concept stage closed —
   Player Promise and Core Loop are real; Why Players Come Back, Social by Design and the audience
   fields aren't written yet; about five minutes of pulling from your repo would fill some. Want
   it?"* — and offer it. The count is yours to do; declining blocks nothing.
6. Closing the **core-loop stage** has one extra last check: offer the **mobile QR pass** (~5 min —
   Creator Hub → the dropdown next to Preview → Show QR Code for Mobile). Offer and record the
   answer, never force it; document-only suppresses this offer.

### Focused pilot review

Shared across routes. Proposal stage gates and submission are additional triggers only within
that route; ordinary general design uses the meaningful-work triggers below.

After your own source checks, ask the owner to read the saved, completed or changed portion:
at each stage gate, before a substantial planned break after meaningful work, after a major
concept/scope rewrite, and at submission. Merge coinciding triggers. Not after every question,
brief pause or unchanged resume; if the owner left before the check, offer it on return.

Explain once that this beta can misstate facts and conclusions. Link specific passages and ask
up to three focused questions, using these stable lenses rather than a generic "looks good?":

1. **Your decisions and facts:** did anything you said disappear, or did I add a decision or
   unsupported fact? Include negative claims ("nothing exists/built"), build/test status and
   assertions that materials are original or cleared for use.
2. **Evidence and explanations:** did an "if", imagined episode or hypothesis become an observed
   result? Did a possible explanation become a proven cause, or acquire invented test conditions?
3. **Numbers and technical promises:** do conclusions follow from the inputs and their limits?
   Are platform capabilities, implementation effort or causes of technical errors unsupported?
   A correct caveat must also hold for the recipe or conclusion it qualifies.

Check all three lenses yourself; omit a question only if that kind of claim is absent from this
portion. Point to its actual passages and risks, not the same abstract checklist every time.
Do not ask the owner to certify unfamiliar technical or IP facts: flag uncertainty, research what
you can, and leave unsupported claims open. Their agreement is not evidence of factual truth.

Give the owner room to answer before your next interview question. They may correct, confirm or
postpone; a skip never blocks progress or submission. Record the reviewed scope and response
briefly in decisions.md, including an explicit postponement and its scope; this is pending, not
reviewed. On return, offer only that pending portion when appropriate. Silence or an unrelated
answer is not confirmation. Do not re-present
reviewed, unchanged parts. At submission include the final summary and cleanup changes.
Keep the request short by narrowing its scope, not by losing these lenses. Honest TBDs stay;
this supplements your checks and does not resolve known model errors or guarantee approval.

### The `.html` render

For general design, create a render on explicit request, using the actual source document's
structure. Use only pages supported by the chosen experience; return and social pages are
optional. Across both routes, refresh an existing HTML on request, at an agreed milestone, or
once after all source edits at the requested concluding finalization, unless the owner opts out.
An ordinary pause or edit does not trigger a refresh. Scheduled offers below belong to the proposal.

**In the proposal, offer when the concept is showable**, before initiating detailed Retention/Social, including
in doc-only. Use the existing promise, typical solo episode, loop, world/visual direction and
useful comparables; missing details stay open. This is not a completeness check or proof of fun.
On an explicit request, an earlier partial sketch is fine. Create `design/gdd.html` after consent;
declining does not delay the interview or a test.

In the proposal, after a meaningful expansion (such as Retention or Social) or a major concept
change, offer an update at that section's close. Minor source edits do not trigger HTML reads,
edits or repeated offers. Preserve the owner's update preference.
Record the offer/answer briefly in `design/decisions.md` so Resume does not repeat it; after a
decline, offer again only when the concept materially changes or another stage's written set is
ready. A request not to offer again persists. No separate tracking file is needed.

`.md` is the source of truth. `.html` is a **disposable, free-form creative render** of it —
self-contained, inline CSS, no JS frameworks, no build step, no pipeline: you simply rewrite the
file. Start from [deck-shell.html](../assets/deck-shell.html) for navigation only; replace its
sample content and style for this game. Keep only pages supported by the source. Grow it as a
small pitch deck inside this one HTML, with distinct slide-like pages:
1. **Core:** player fantasy, core mechanic (input, response and choice), the shape of play and intended
   game feel. Show a typical moment for the intended solo or group experience: why the first action
   should feel good and, when repetition matters, what keeps it interesting — mastery, variation,
   expression or another author-grounded reason. The proposal also shows its worthwhile solo
   moment. Use a lively visual sequence or diagram to make the experience imaginable, not a
   checklist of these labels. Keep the key untested question visible; intended fun is not proof.
   Interest within repeated play belongs here; reasons to return on another day belong on page 2.
2. **Retention:** add when developed — why another visit is worthwhile and what remains to test.
3. **Social:** add when developed — how other people affect the intended play. For the proposal,
   show how friends improve the already worthwhile solo experience.
Keep the core page independently readable; later systems belong on their own pages, not squeezed
into page 1. At the next agreed render, update core too if the concept changed.
On screen, show one page at a time with ← / → buttons, accessible Previous/Next page labels,
page names and a current-page indicator. Use native buttons and a responsive layout. Scrolling
within a page is fine on any screen and can serve the game's presentation; no fixed screen-height
limit. Give each text block or diagram a distinct job instead of retelling the same loop in the
intro, diagram caption and separate tables. Never shrink text or clip overflow to force a fit.
Print all pages with page breaks and without controls.
With JavaScript disabled, all content must remain readable. Verify navigation, narrow layout
and print visibility when a browser is available; otherwise disclose what was not checked. These content pages are not the three document stages. If the owner
works in another order, add only the pages with real content; never fabricate a missing section.
Keep later production detail out of this compact deck unless the owner requests it. Do not copy
every GDD table into the presentation.
Use game-specific colour, typography, spacing and inline SVG/CSS diagrams to show a typical
moment or explain the loop. Follow the author's mood and visual direction, not a universal
pitch template. Visual composition is yours; new mechanics, setting details and test results
are not. Keep text readable on mobile and print; motion is optional and must respect reduced
motion. No external service, image generation or bespoke asset is required.

HTML communicates atmosphere and intended feel; it cannot prove how playing feels. Never
delay a small playable test to polish the page.

Stamp each render with its actual source path: *"Snapshot from <source path> · v<n> · <date>; Markdown may contain newer
changes."* HTML stays a dated presentation until its next agreed update. Do not edit it merely
to mark each source change stale. Never use HTML as a factual source or call an older snapshot
current; return to the `.md` and its evidence. When an update is agreed, sync all affected content.
Preserve whether a claim is intended, untested, reported or measured. A shorter render may omit
detail, never the uncertainty that changes its meaning; a proposed test may remain inconclusive.

**For the proposal, it is never the submission** — say so the first time you produce one (*"this one is for looking at
and sharing; `design/gdd.md` is what goes in"*). Final submission sign-off uses the shared
finalization refresh rule above. If no HTML exists, offer it once. A refusal never blocks submission.

## Where the program's rounds sit

Use [funding and scope](funding-and-scope.md) for the current application, funded milestones,
amounts and payment conditions. Document stages and prototype rungs are not funding milestones.
Do not turn this skill's evidence heuristics or prototype ladder into additional eligibility rules.
