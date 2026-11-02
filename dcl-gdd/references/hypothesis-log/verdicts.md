# Verdicts and ownership — `dcl-prototype`'s zone

Part of the [Hypothesis Log contract](../hypothesis-log.md). `dcl-gdd` reads this only to know what
it must not write.

When `dcl-prototype` closes an experiment, the **first line of `## Verdict` must be
machine-readable**:

```markdown
**Verdict:** validated — 5/6 testers completed 3 cycles unprompted · 2026-08-14 · tested on: desktop
```

(`validated`, `survived` or `failed`, one sentence of why, the date, the rung.) A `survived` verdict
must name **which claim survived** — the kill-check, never the criterion:

```markdown
**Verdict:** survived — kill-check held: <what> (owner self-test) · criterion not measured · <date> · tested on: <rung>
```

The index pulls `verdict / date` from this line; free-form detail goes below it.

A failed owner kill-check describes that check, person and build conditions, not all players
or a proven cause. Keep the broader unmeasured claim open in the linked source, or in the standalone
experiment itself, as for survived.
If a broken instrument prevents interpreting the pass, record an inconclusive attempt and keep
active/deferred; do not invent a terminal verdict. Fixing the instrument or testing a new version
does not erase earlier observations or permit moving their criterion after the fact.

## Ownership

- **`Tested on`** is created by `dcl-gdd` as `—` and **updated by `dcl-prototype`** — the
  rung is only known once testing happens.
- **The linked source rewrite**, when a source document or note exists, after a `validated`/`survived`/`failed` verdict is **performed by
  `dcl-prototype`** (it holds the evidence), reporting what changed and where. If the rewrite
  would *contradict* the design rather than refine it, raise the conflict — never rewrite silently.
  Trace the changed claim through existing dependent design sections, hypothesis files and implementation notes;
  update or reopen affected conclusions while preserving their evidence limits and history.
  After a substantial write-back offer the shared
  [focused pilot review](../stages-and-gates.md#focused-pilot-review) of the changed portion.
  Merge it with a coinciding gate or pause review; postponement never blocks progress or submission.
- **Index regeneration after a verdict write-back is `dcl-prototype`'s duty**
  ([index.md](index.md)).
- **Bare-idea entry:** when nothing is parked, `dcl-prototype` may create **one** experiment file
  per invocation, held to the four requirements in [parking.md](parking.md), and must say aloud
  that it did. `Source section` names the existing design document or note holding the claim,
  or reads `— (standalone)`. Keep the verdict in the experiment and regenerate the index;
  a missing GDD creates no backfill duty. Preserve legacy pending-backfill records as history;
  write a document later only when the owner wants one.
