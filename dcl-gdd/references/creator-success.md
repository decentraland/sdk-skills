# Creator Success proposal route

Read this file only for the chosen Creator Success direction, after the shared
[working direction](hypothesis-log/files.md#working-direction) and [hard rules](../SKILL.md#hard-rules).
The phases, stages, progress bar and template below belong to that proposal route.
They do not govern general design work. A requested working draft may remain incomplete;
audit findings advise the owner and never become invented eligibility requirements.

Load [preflight](preflight.md) and [progress-line](progress-line.md) on entry here.
The [GDD template](../assets/gdd-template.md) supplies the proposal format; read its
[section files](../assets/gdd-template/) as needed, not the whole template on every turn.
The [filled example](../assets/gdd-example.md) is an example, not the owner's design.
Common conversation moves and records still follow SKILL.md. Here, numbered phases and
Step A–K references are local to the proposal workflow; hard-rule numbers refer to SKILL.md.

## The growing document

Use the template's structure and the interview's content; never copy the template to fill it in
place. Ordinarily, unreached fields are absent. Drafting and submission shortcuts use honest `TBD:`s.
Apply its word caps; when material does not fit, identify the unresolved choice rather than
widening the cap. Use the common authorship rules for any proposed cuts.

- Preserve exact section numbering, headings, field labels and table shapes without italic
  guidance. Numbering gaps show what is unreached. Use the game's title; mark an invented working
  title `[agent-decided]`.
- Add a section with its first answer and a field with its content or marker. Template-defined rows
  appear whole at their first answered cell, other cells empty; game-defined rows (§3 loop steps,
  §6 touch mappings) grow one at a time. Missing rows hide holes.
- On a scope change, correction or permitted deletion, trace affected claims across the GDD,
  hypothesis files and implementation notes, not just the summary. Correct or reopen dependent
  claims; preserve history rather than treating your earlier record as evidence.
  Check whether the reduced content still supports promised session length, repeat play and
  return visits; changing a number does not preserve those conclusions automatically.
  In the same write, update the dependent claims to the agreed decision or mark unresolved ones
  `TBD:` with the consequence. Keep later possibilities distinct from current commitments;
  preserve the decision history. Batch HTML updates under its render rules.
- Open with two italic lines: *Work in progress · grown from `gdd-template.md`*, then the progress
  line. Refresh at section writes; submission cleanup removes both, including on manual submission.
- When adapting or editing a part-filled template, remove only verbatim template filler and preserve
  owner edits word for word. Announce it as a note. If git does not cover the file, first archive
  the original as `design/archive/gdd (original <date>).md` and report the path.

## The progress line

Load [progress-line.md](progress-line.md) before the first showing: it defines the format,
showing moments and two marks. Reaching the **submission bar** requires offering *go full / finalize
now*; the **full document** remains the far end. Hard rule 4 governs state updates.

Before a substantial break or after a major concept/scope rewrite, apply
[focused pilot review](stages-and-gates.md#focused-pilot-review) to the changed portion.
Stage gates and submission use the same review; merge coinciding checks, never repeat unchanged material.

## The controls card

When first opening an interview, briefly introduce your role and the road ahead: hear their idea, explore
it together, then shape it into a document; they can change direction or stop with a partial draft.
Explain that this orientation is only for the first visit. Show the full card **once per document**,
then follow their requested work; invite a seed in Step A only for a new idea. Later entries
skip the introduction and card and get one reminder:
*"Say 'help' for the controls — skip, jump, park ideas, go wide, 'you decide', leave whenever you
like."* Show the full card again on "help". Adapt this wording to the owner's language;
preserve their creative control and the difference between drafting and delegating decisions:

> **Your game, your direction.** I help you explore and put it into words. You can disagree,
> change course or brainstorm freely; your instincts outrank my process. These are examples,
> not commands to memorize:
>
> - **"skip" / "later"** — any question or section. I hold your place; we return when you want.
> - **"let's do Social by Design now"** — any section, by name or number. I'll flag what it depends
>   on in one line, then follow you.
> - **"I don't know"** — a legal answer: `TBD: <how we'll find out>`, a green flag in review.
> - **"you decide"** — I propose within your constraints, mark it as mine, and you can review it later.
> - **"park this idea"** — on-topic or not, too big for v1 or not: saved in `design/ideas.md`.
> - **"let's go wide"** — brainstorm freely. I stop steering, save every idea with its section,
>   and return to the question when you're done.
> - **"let's build / test it"** — jump to prototyping when something feels testable.
> - **"draft what we have"** — stop the questions and assemble our ideas; unknowns stay open.
>   Ask me to propose missing decisions if you want that too; I mark those as mine.
> - **"more examples"** — real games, funded pitches or the filled example. **"More options"**
>   gives you alternatives to choose from.
> - **"let's play one round in chat"** — I describe the situation, you choose an action; we
>   explore the mechanic together, or work through its numbers. No switch to building needed.
> - **"where are we?"** — the progress bar.
> - **"update the presentation"** — refresh the HTML from the current GDD whenever you want.
> - **"help"** — this card again.
>
> Leave whenever you like: each answer is saved in `design/`, and we resume where we stopped.

Keep marker syntax off the card except `TBD:`. Explain each other marker once, when it first appears:
an overrulable bookmark, not a demerit; cleared or converted before a reviewer sees the document.

## Phases

### 0 — Orient and classify

Read available artifacts before asking: repo, GDD or pitch, notes, prototype and the state in
`design/` (hard rule 4). When resuming design exploration, skim `ideas.md`; offer graduation of
matured ideas and re-sort anything parked by `dcl-prototype` under the
[file contract](hypothesis-log/files.md). Verify the invocation hint against the
artifacts: lore supplies setting, not unstated mechanics. Preserve it when adapting; mechanics
can remain open.

Use `design/gdd.md` in the session folder. Create `design/` when writing needs it. Ask about
the path only if ambiguous, recommending this game's repo when one exists. Never assume a repo or
build exists. Convert template copies under **The growing document** only when adapting or editing.
An analysis-only request leaves the supplied files unchanged and needs no document housekeeping.

Use any supplied delivery frame; settle the requested round at Step K, not as a second
opening questionnaire. Use this route only for the saved Creator Success direction. For a live
game, clarify live versus next version only if it changes which material to preserve.
Use [funding and scope](funding-and-scope.md) when the owner raises funding or
affordability, or asks for an effort estimate. Do not initiate a budget interview or require a
financial fit check for submission. The requested funding round belongs at Step K.

Run [P1–P9 preflight](preflight.md) over the input; each hit prompts a move, not rejection.
For several games, decompose, pick one with the owner and park the rest before interviewing.
If they arrived to build with no artifacts, offer `dcl-prototype` using the handoff guidance
before the first interview question; in doc-only, open the interview instead.

The current request chooses the work before phase 1's table: use [review-lens.md](review-lens.md)
for a requested review; adapt or revise only when requested. For an unspecified continuation,
use the table. **Full** means every field answered, `TBD:` or deliberately deleted, with
no `[OPEN]` or `[agent-decided]` left: full → Verify, otherwise Resume; reviewer feedback → Revise.

Confirm the frame, path or document-only/build preference only when unclear and consequential.
Reuse clear choices. Step A starts a new seed, not every visit. Include the progress line when
due; findings and conversion notices are notes, not extra questions or a prerequisite interview.
Match the report to the requested depth and relevant material; a substantial document can still
need only a targeted review. Full submission preparation uses phase 3.

### 1 — Route

The table is the whole route text — nothing further to load:

| Route | Evidence on arrival | Action |
|---|---|---|
| **1A · Adapt** | Material in another format | Map and save supplied content into the proposal GDD, preserving decisions and open choices. Clarify only gaps needed for the requested adaptation. |
| **1B · Solidify** | Idea, lore, mood board or feature list | Start from the owner's seed and inspiration in Step A; offer concepts when they want help finding one, then concrete options for the emerging design. |
| **1C · Verify** | A full `design/gdd.md` | Review against the requested purpose before suggesting revisions or tests. For an unspecified continuation, rebuild the [index](hypothesis-log/index.md) and report remaining review or test work; follow [doc-only.md](doc-only.md) when selected. If review is finished and no open hypotheses remain, use the finalization closing move. |
| **1D · Revise** | Reviewer feedback | Map each probe to a review area and one or two sections. Interview only those; report which area each edit addresses. |
| **1E · Harvest** | Built scene and repo, little or no document | Fill what the repo proves before asking, then interview only the holes. Evidence limits: [section-map.md](section-map.md), **On the Harvest route**. |
| **1F · Resume** | GDD with missing fields or unresolved working choices | Follow the Resume block below. |

**1F · Resume.** Read current state (hard rule 4), show progress and ask one question:

- **continue in the recommended order** — name the next step and why;
- **close unfinished items** — list `[OPEN]`s, unconfirmed `[agent-decided]`s and `TBD:`s that may
  now have answers;
- or **name any section**.

List the unfinished items so the owner need not remember them. Never infer their intent from map
order or re-ask answered questions. Add the controls reminder and one hypothesis-status line,
not a menu: *"8 parked, riskiest: the Sunday reset hook (H1-03)"*. Hard rule 6 still applies.

### 2 — Interview

Follow [section-map.md](section-map.md)'s dependency order. Load its preamble once,
then only the current step and its knowledge reference. Announce out-of-stage steps without asking
them; honour owner-directed jumps under hard rule 8. Load [interview-moves.md](interview-moves.md)
for questions, stuck answers and failure modes.

Save decisions immediately; report resolved sections with the progress line. Park hypotheses as
they appear. Record taste decisions in the section and a dated `decisions.md` line: `owner call`
for an answered recommendation or their choice, `agent call` for an `[agent-decided]` choice.
Standing non-goals also live there. Follow the
[file contracts](hypothesis-log/files.md).

Posture, calibrated for hobbyist owners:

- Offer **Breaks at the summits** per [interview-moves.md](interview-moves.md).
- Quote the [stage's question budget](progress-line.md), never a global counter.
- **Collect before judging.** At stage 1, park falsifiable player claims as hypotheses; save other
  ideas as dated, attributed, unjudged lines in `ideas.md`. Critique belongs to audits, pressure
  tests and later stages.
- **Brainstorming is design happening.** Save every line with its section where obvious; resume
  the question with the parked list only when the owner is done. "Let's go wide" is optional:
  spontaneous brainstorming gets the same treatment.
- **Keep technical material out of the GDD.** Answer engineering questions when asked, then save
  them in `implementation-notes.md` under the contract, including its unsettled-claim fork. Write outside
  `design/` only on explicit owner request: announce the path first and log it in `decisions.md`.

A request to finish writing or stop answering takes the [delegation path](interview-moves.md#delegation-without-a-completion-treadmill):
draft honestly and stop, rather than continuing the interview or opening a sign-off queue.

Follow the concept-first route and early HTML offer in the section map; a showable concept
does not require a passed experiment. At stage boundaries run phase 4. At the submission bar offer *go full / finalize now*
([references/progress-line.md](progress-line.md)); either fork runs phase 3.

### 3 — Audit

Run this for explicit submission preparation or a requested full review. A request to finish a
working draft or stop the interview uses the delegation path, not this full audit: save the known
material, briefly name important gaps and stop. An incomplete submission still gets the checks
below; findings advise the owner and do not require resolving every gap.

Fill TL;DR (§0) last. Load [review-lens.md](review-lens.md) and run all five checks over
the whole draft: on *finalize now*, or when *go full* completes. All five are internal coverage,
not five reports to recite. Give one short recap of saved changes and material open questions,
including the return section when relevant; merge repeated findings. Expand only on request:

1. The template's own **submit self-check**, read as the acceptance lens.
2. The **pressure tests** plus the **cross-lens audit** — design theory over the whole draft.
3. [P1–P9 preflight](preflight.md) again, now over the draft.
4. The **conformance count** — mechanical, straight against the template (hard rule 3 on overflow).
5. An honest read of the **review areas** — one status each, **no total and no predicted verdict**.

At submission, load [finalization.md](finalization.md): every working marker gets a
disposition. On an already finalized document, use its closing move.

### 4 — Gate

Run **What happens at a gate** in [stages-and-gates.md](stages-and-gates.md).
Stage closure is a judgment, not a counter. Render on the early offer and meaningful updates in stages-and-gates, including cleanup;
batch index rebuilds per the [contract](hypothesis-log/index.md), never per park.

### 5 — Hand off

In doc-only, end per [doc-only.md](doc-only.md). Otherwise offer `dcl-prototype` with
a concrete playable scope or test, following [handoff](hypothesis-log/handoff.md).
For testing open claims, name the cheapest killing test, risk breaking ties: claim in plain words,
ID in brackets. That ordering does not override an owner-chosen exploratory build.

## Proposal shortcuts

Honour immediately, without arguing:

| Owner says | You |
|---|---|
| **"you decide"** | choose, mark `[agent-decided]`, move on |
| **"skip"** | mark `[OPEN: postponed]`, move on |
| **"draft what we have" / "just write it"** | draft now; the unanswered lands as `TBD:`/`[OPEN]` — hard rule 1 holds |
| **"let's go build"** | save current intent, then hand off the playable scope or test (phase 5) |
| **"more examples"** | named patterns from the section's reference or the filled example — an example, never a set to choose from ([interview-moves.md](interview-moves.md)) |
| **"let's play one round in chat" / "run it on paper"** | a word run on the current question — any time, any mode ([interview-moves.md](interview-moves.md)) |
| **"help"** | show the full controls card |

