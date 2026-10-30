# Parking — what earns a file, and where the rest goes

Part of the [Hypothesis Log contract](../hypothesis-log.md); hard-rule numbers refer to
`dcl-gdd`'s SKILL.md.

## Writing a hypothesis worth parking

General design uses these records too. When the owner wants to answer a specific design or
technical question, distinguish a test from an open-ended try. Reuse their stated claim and
criterion; if the criterion is still open, clarify it only when needed for the requested test.
Otherwise keep the question as `TBD:` beside the affected design and carry it into the try.
Exploration may reveal a question worth testing; register the later test before running it,
without relabelling the earlier exploration or forcing every adjustment into an experiment.

`dcl-gdd` creates the file at park time. A row is only worth a file if all four exist:

1. **A falsifiable IF/THEN.** *"IF the drop cycle is 45 s, THEN 4 of 5 first-time players complete
   three cycles without being told what to do."* If you cannot describe what failure looks like, it is
   still an assumption, not a hypothesis — keep working on it or write it as `TBD:` instead.
2. **The source**, so a verdict knows where to return: link the file and passage that holds
   the claim, including a design note when there is no GDD. Use `— (standalone)` only when
   no design source exists and the experiment itself is the claim's home.
3. **The cheapest test that could kill it.** This is the ordering key for the whole log: arithmetic
   in the doc (only when [its inputs can settle the claim](arithmetic.md)) → desktop Explorer (via Creator Hub; estimate from the actual setup and dependencies) →
   mobile. A hypothesis testable by arithmetic must never survive untested to a vertical slice —
   each rung costs more, so it must answer costlier questions. Every rung is something the studio
   can run **before or during the build**: a claim whose only killing test is a live dashboard
   after launch is not yet parked as testable — give it a pre-launch line from this ladder first,
   and let the live metric be a second line at most. In the Creator Success workflow,
   post-launch programme analytics are separate from this pre-build test.
4. **One observable criterion matching the IF/THEN.** A checkable yes/no outcome can be enough;
   a number is needed only when the claim needs it. The header calls this `Key metric`.
   Preserve the owner's criterion, units and conditions.
   Do not add a frequency, threshold or proxy to make a file possible. An undecided criterion stays
   `TBD:` in the source section; do not interrupt creative exploration just to complete this header.
   A proposed criterion needs the owner's choice before parking; never label yours as theirs.

A cheap test may examine a necessary condition of a broader claim. Name that narrower claim
and keep the broader one unproven: understanding a cue does not establish the later behaviour.
Do not turn an easy-to-measure proxy into the outcome merely to fit the test ladder.
Reuse only known build/device conditions. A proposed Explorer test does not mean the existing
mock-up runs there. A stated intention can inform a hypothesis, not settle future behavior.

Mark **mobile-sensitive** hypotheses explicitly when mobile is in the chosen scope and the claim
depends on input, performance or another device condition. The suffix still goes **terminal at the verdict** (`_validated` / `_survived` /
`_failed`) — there is no special filename state for the open mobile rung. Instead the generated
index renders *… — mobile pending* for any file with `Mobile-sensitive: yes` whose `Tested on` says
only `desktop`, for as long as that is true. The mobile check (the QR pass —
see the ladder) is offered when relevant to the chosen target, including at core-loop stage close
when using stages; never forced.

## The header block you write

`dcl-gdd` writes only the header block and leaves the rest to `dcl-prototype`:

```markdown
# H1-02 · Pop feel

- **IF/THEN:** IF <the change> THEN <the observable, falsifiable outcome>
- **Source section:** <source file and passage, or — (standalone) if none>
- **Cheapest killing test:** <test that can settle this claim; known build/device conditions>
- **Key metric:** <chosen observable criterion, units and failure condition>
- **Mobile-sensitive:** yes / no
- **Tested on:** —
- **Parked:** 2026-08-07

## Brief
<!-- owned by dcl-prototype -->

## Sessions
<!-- owned by dcl-prototype -->

## Verdict
<!-- owned by dcl-prototype -->
```

Do not pre-fill the `dcl-prototype` sections, not even with placeholders beyond these comments.
The file's name, folder and status suffix follow [files.md](files.md).

## Not everything parks as a hypothesis

A raw idea — a mechanic to try someday, a visual style to see, a mode that might be fun — goes to
**`design/ideas.md`**: an append-only bullet list, one line per idea, never judged on entry,
writable by either skill at any moment. Append-only: a line proven wrong gets a dated *superseded —
see `decisions.md` <date>* (or the H-file) line under it, never an edit or a deletion. The line
carries its provenance — date and author required, a tag only when it is obvious:

```markdown
- 2026-08-26 · <the idea, one line> · (owner|agent) [· tag: §4 / economy / look]
```

Ideas cut for scope — good, but not in this version — park here too, marked as such (`· cut from §9
scope`): a cut idea is future material or a hypothesis candidate, and losing it costs more than one
line. An idea graduates when it earns it: into a **taste decision** written into a section; into a
**look-see** build ("make it visible, the owner judges by eye" — no metric, no criterion, not an
experiment); or into an **experiment file**, once it makes a falsifiable design or technical claim.
Never edit or delete the original: append a dated line beneath it for graduation (`→ H1-04` /
`→ §7 decision`) or correction (`superseded — see decisions.md <date>` or the H-file).

**Technical material parks in `design/implementation-notes.md`** — the engineering companion the
GDD never absorbs. Two kinds of line live there, written by either skill the moment they exist: a
**settled technical decision or recipe** (how sound sync works through the SDK, trigger wiring, a
data format, an anti-cheat scheme — answered in conversation or proven by an experiment), and a
**requested implementation plan** (the owner asks to translate the GDD into buildable systems).
The GDD keeps at most the design-facing sentence; the depth lives in the notes. An *unsettled*
technical claim is not a note yet — offer the fork: park the plan there, or take it to
`dcl-prototype` now. Like this log, the file ships with the repo but is no application requirement
and no bar to quote at a creator.

**Decisions get a history too.** When the owner decides something by taste — a style kept, a
mechanic ruled out — the section holds the *current truth* and **`design/decisions.md`** holds the
one-line history: `date · decision · why · owner call / agent call`, append-only, newest first —
`owner call` when they chose, specialised, or answered your recommendation (a bare "yes"
counts), `agent call` when the line would carry `[agent-decided]`. Standing **non-goals**
("never X, because Y") live here as well — they are decisions with no expiry, and they earn their
keep at the comparables and scope steps. Verdict-driven rewrites do *not* duplicate here — their
trail is the Hypothesis Log. Routing when something surfaces mid-work, in either skill: the owner
decided it → `decisions.md` · a maybe → `ideas.md` · unsure → `ideas.md`, and `dcl-gdd`
re-sorts on its next pass.
