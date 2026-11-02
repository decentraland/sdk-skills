# The Hypothesis Log — Interface Contract

This file is the **contract between `dcl-gdd` and `dcl-prototype`**. Both skills read it;
neither may diverge from it unilaterally. `dcl-prototype` references it at
`../dcl-gdd/references/hypothesis-log.md` rather than keeping a second copy.

**The log is not part of the GDD.** The template has no Hypothesis Log section: the log lives as a
separate generated file, `design/hypothesis-log.md`, whether a GDD exists or not. It is **agent
infrastructure** — the owner is never asked to fill it, read it, or submit it. For a Creator
Success submission, keep it outside the submitted GDD and clean working markers as that workflow
specifies; `TBD:` stays. The log may travel with the repo, but is never an application requirement.

## One owner per fact

The single hardest rule here. Every fact lives in exactly one place:

| Fact | Owner |
|---|---|
| Status | the **filename suffix** |
| IF/THEN, source section, cheapest killing test, verdict, dates, `tested on` | the **experiment file** |
| The assembled table | **`design/hypothesis-log.md` — generated, never hand-edited** |

The log file is a *view*, rebuilt by globbing the stage folders and reading the experiment files.
To change a status, rename the experiment file and regenerate the index — never edit its table by
hand.

---

**The rest lives one file per operation** in [hypothesis-log/](hypothesis-log/) — read the one the
moment you need it, never the set:

| File | Read it when |
|---|---|
| [parking.md](hypothesis-log/parking.md) | parking something: what earns an experiment file, what goes to `ideas.md`, `implementation-notes.md` or `decisions.md` instead, and the header block you write |
| [files.md](hypothesis-log/files.md) | placing or naming a file: the `design/` layout, IDs, slugs, the status suffixes |
| [index.md](hypothesis-log/index.md) | rebuilding `design/hypothesis-log.md`: the events that trigger it, the pass, the columns, the two invariants |
| [handoff.md](hypothesis-log/handoff.md) | jumping to `dcl-prototype`: playable scope or focused test, and destination |
| [verdicts.md](hypothesis-log/verdicts.md) | closing an experiment — `dcl-prototype`'s zone: the machine-readable verdict line and who owns which write |
