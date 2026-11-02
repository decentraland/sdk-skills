# Regenerating the index

Part of the [Hypothesis Log contract](../hypothesis-log.md).

Regeneration is mechanical but it is a full pass — glob, read every header, rewrite — so it runs at
the events that batch naturally, never per park: at **section close**, folded into the same write
that saves the source document or note (files parked while it was open join the table
there); at applicable stage pauses; when preparing a registered-test handoff; on entry to registered testing
(rebuild before choosing what to test); and after each
`dcl-prototype` verdict write-back. Between rebuilds the experiment files may briefly lead the
table — the files are the truth, the table is the view, a status line quoted to the owner derives
from the files either way, and the invariant check below runs at every rebuild, so a stale table
never hides a hypothesis. HTML follows the chosen document workflow. Glob
`design/*/H*_*.md`, read each header block plus the verdict, sort by **cheapest killing test** (the
ladder arithmetic → desktop → mobile; tie-break by stage then number), and rewrite the table in
`design/hypothesis-log.md`:

| Columns |
|---|
| `ID` · `IF/THEN (falsifiable)` · `source section` · `cheapest killing test` · `status` · `verdict / date` · `tested on` |

Then check the two invariants and report any break:

- every `[HYPOTHESIS]` marker in an existing linked design document or note resolves to a row;
- every row's linked source records the claim or its verdict; for `— (standalone)`, the
  experiment file itself holds that record. A legacy pending-backfill entry may retain its
  recorded gap; preserving it does not require creating a document.

A `validated`, `survived` or `failed` verdict updates its **existing linked source to state what
is now known**. Standalone experiments need no document creation or backfill. For `survived` the rewrite is scoped
exactly to the kill-check — state it in the indicative mood, and leave the unmeasured criterion in
the section as `[HYPOTHESIS]` with its H-link. A failed owner kill-check follows the same scope limit;
apply [verdict limits](verdicts.md), not a failure of the wider unmeasured claim.
