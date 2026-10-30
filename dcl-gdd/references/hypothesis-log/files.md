# Layout, IDs and statuses

Part of the [Hypothesis Log contract](../hypothesis-log.md).

## Layout on disk

```
<project folder>/design/            ← the scene repo when there is one; any folder will do
  gdd.md                                  ← working design maintained by dcl-gdd; proposal format only on that route
  gdd.html                                ← optional creative render; early concept + meaningful updates
  hypothesis-log.md                       ← generated log index — agent interface, never hand-edited, never submitted
  ideas.md                                ← append-only idea parking lot — dated, attributed, never judged on entry
  decisions.md                            ← append-only decision history: date · decision · why · owner call / agent call (incl. standing non-goals)
  references.md                           ← useful inspirations and their sources; create only when needed
  acquisition.md                          ← audience, arrival and growth groundwork; only when relevant work exists
  01-find-the-fun/
    H1-01-core-drop-fun_validated.md
    H1-02-pop-feel_active.md
    playtest-2026-08-12-notes.md          ← intermediate files park here too
  02-core-loop/
    H2-01-session-length_parked.md
  03-vertical-slice/
```

Folders organise records; they do not require design stages. Reuse existing stage folders and IDs.
For standalone tests, reuse an existing experiment folder. On empty disk, use `01-experiments/`
and `H1-*` IDs. If a new folder is needed alongside existing stages, use the next unused numeric
prefix and matching H-prefix; never duplicate a prefix or renumber existing records.
Keep this one-folder depth for the shared glob; folders carry no status suffix and may also hold
playtest notes, screenshots and raw data. Create only the files needed for the current work.

The `design/` path is the session folder's `design/` (see SKILL.md phase 0); never hardcode it.

## Working direction

Both skills read this section when orienting or resuming. General game design is the default;
Creator Success applies only when the owner's current request or saved intent selects it.
Reuse project instructions and dated decisions before asking. A template, filename or old proposal
alone does not establish the current direction. If ambiguity changes the next work, ask one short
question; otherwise continue with the known aim.

Save the working direction (`general` / `Creator Success`), aim, `doc-only` if chosen, and a link
to the active document if any in a dated `design/decisions.md` entry. Distinguish the general
default (agent call) from the owner's selection. Reuse the entry until something changes; append
changes with attribution and preserve the earlier record. No repeated purpose questionnaire.

`doc-only` means writing without builds in either direction. An explicit owner request to build
authorises that request; record its scope without silently changing the wider working direction.
`dcl-gdd` maintains a working GDD in either direction; general design uses a flexible structure.
Preserve existing proposals, source material and test history when the direction changes.
Carry the target platform and still-applicable owner constraints into the current GDD and handoffs;
a change of genre or loop does not reset them. Update only what the change replaces; surface a
real conflict when it affects the next choice. Keep owner constraints distinct from technical
findings and open dependencies under [platform fit](../platform-fit.md#check-the-action).
Carry this direction and its record into handoffs, independently of the next step.

## Shared working memory

### Working design

`dcl-gdd` keeps the current design in `design/gdd.md`, starting with the first supplied idea.
Transfer the usable design from supplied notes and plans into it, preserving meaning, authorship
and open questions. Keep the originals for reference; links alone do not replace the imported design.
A few lines can be enough. No separate request to create a GDD
is needed, and completing it is never a prerequisite for play. Review-only still leaves files unchanged.

Include only what this game needs: intended experience, what the player does and what happens,
the current playable scope, and open questions that affect it. These are useful topics, not
required headings or a form to complete. Preserve existing structure. When writing or summarising,
separate what the owner supplied from what you inferred or proposed, in the saved passage itself.
Keep proposed rules visibly proposed until chosen. Link later ideas and
decision history instead of copying them into the current design.
An unresolved test question stays beside the affected design with a link to its trial or H-ID
when one exists. Use [parking](parking.md) when it becomes a concrete test, in either direction.

After a trial or on return from prototyping, read its actual record and update the affected design
with the observation, its conditions and what remains open. Preserve an existing experiment's
criterion and verdict ownership under [write-back](verdicts.md#ownership); a casual impression
does not create a verdict. The trial keeps the detailed evidence, the design keeps its implication.
If a result conflicts with an owner decision, surface that choice rather than silently replacing it.

### Record homes

Keep current design in the GDD and supporting records in their own homes; link instead of duplicating history.
Use `notes.md` only for context with no suitable home. Create files when there is something to save.

Keep the GDD compact for concept review, from brief towards a ten-pager, not a fixed page quota.
Detailed audience and acquisition work belongs in `design/acquisition.md` under
[acquisition](../acquisition.md#keep-a-separate-working-document); the GDD keeps selected design
implications, consequential open questions and a link. The research library keeps full sources.

For meaningful changes of direction, append to `decisions.md`: what changed, whose choice it was,
why (if known), and which earlier decision it replaces. Preserve the old entry; link the new one.
Do not invent a rationale or ask for one after every small tweak.

Keep a test’s question, build/change, conditions, observations and limits together in its existing
experiment record or exploratory note. An attractive outcome is not proof of its proposed cause.

At a pause or handoff, save the current focus and next step in the existing status or active note.
Distinguish an owner-chosen step, an agent suggestion and an outstanding check. On resume, use
that record with the owner’s current intent; a suggested or unchecked step is not an obligation.
Keep this concise and maintain it yourself, not as an owner questionnaire.

## Reference notes

When the owner supplies an inspiration, or research finds one useful to the current design,
save it in `design/references.md` (reuse an existing reference list). References can be images,
video, audio/music, 3D models, animations, code repositories, developer accounts or other useful material — for example, a lighting
image, a clip's pacing, a sound's texture or a described mood. Keep the title, source URL
or local path, a page/timestamp when useful, and what matters about it. Separate the owner's
interest from your suggestion; note rejected aspects so they are not offered again. A reference
does not approve a mechanic or grant rights to reuse its assets. Preserve supplied local
attachments in the project's reference folder when permitted; keep provenance and do not rely
on temporary paths alone. For online material, save links rather than downloading media by
default. Unknown provenance stays unknown. No reference questionnaire or empty file is needed.

This is a growing development library, not a pitch quota. Keep useful sources beyond the two
proposal comparables; group by purpose as it grows. For research and implementation reuse,
follow [prior art](../prior-art.md); put its design implications in the GDD and link the sources here.

## IDs and filenames

`H<stage>-<nn>-<slug>_<status>.md`

- Numbering is **per stage**, not global — a late find-the-fun experiment inserts as `H1-07` without
  renumbering anything.
- References anywhere (the log table, `design/gdd.md` prose, a handoff message) use the **stable ID**
  `H1-03`, resolved by glob. Renames never break a link.
- When a section holds more than one hypothesis, the marker itself carries the ID —
  `[HYPOTHESIS H1-03]` — so every marker resolves to exactly one row.
- **Slugs use hyphens only, never underscores** — the underscore is reserved as the status separator
  and must parse unambiguously.
- **Statuses are resting states only:**

| Status | Meaning |
|---|---|
| `parked` | written down, not started. The state `dcl-gdd` creates. |
| `active` | an experiment is in flight |
| `validated` | the registered THEN held through measurement or a sufficient calculation under [arithmetic evidence](arithmetic.md), at the rung named in `tested on`. Name the method; conditional model output is not observed behaviour. Never awarded on an owner-feel self-test. |
| `survived` | terminal for the owner self-test: the **kill-check held under an owner self-test**; the criterion was not measured. This is the owner-*feel* outcome — not a funding milestone verdict. `survived` and `failed` are claims of different sizes, not two thresholds of one scale. |
| `failed` | the registered criterion or owner kill-check did not hold under the recorded conditions. Name which; a failed owner check does not settle the wider player claim. It stays in the log. |
| `deferred` | consciously skipped. Skipped experiments do **not** vanish. |

Transient states — briefed, built, tested-but-unjudged — live *inside* the file, not in its name.

- Re-testing on a higher rung **appends to the same file**; the ID and folder never move, and
  `tested on` records the new rung.
