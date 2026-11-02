# Finalization — finishing writing or preparing a submission

For general design, finish the requested writing, check changed claims against their sources,
preserve open choices and uncertainty, and link the saved document. Apply the shared
[Focused pilot review](stages-and-gates.md#focused-pilot-review) when due; the owner may postpone it.
Stop there unless they ask to continue. Finishing does not select the proposal route, require
template cleanup or IP declarations, or start a submission sign-off.

## Creator Success submission

The remaining procedure is loaded from the proposal route's phase 3 when the owner is actually
submitting, and on a finalized proposal for its closing move.

A request for a draft is not a request for submission sign-off. Do not initiate this walk merely
because the owner asked you to finish writing or stop asking questions. For explicit submission,
"leave the remaining choices open" can apply to the whole group: use honest `TBD:`s with any
existing test plan, preserve proposal history, and do not solicit approval for each gap.
Design-intent wording describes a chosen but untested idea. If the owner left the explanation
or choice undecided, keep that `TBD:` and its test plan; cleanup must not supply an answer.
An incomplete document with honest `TBD:`s can be submitted. Do not require every section to be
filled, every hypothesis tested or every audit concern resolved before helping the owner submit.
Briefly name material open questions and respect their choice; distinguish document completeness
from any actual programme condition, without inventing new eligibility requirements.

Apply and save the [IP self-check](scope-and-evidence.md#ip-and-content-declaration--now-a-header-self-check)
for the final names/materials. Separate the owner declaration from actual screening; an inherited
pass without evidence is unverified. Reuse a current answer; a rename or content change reopens only
the affected part. For round and project status, use known history under
[funding and scope](funding-and-scope.md#application-and-delivery); unknown history stays `TBD:`.

Edit the existing document, rather than regenerate it from the template. Build any missing summary
from the recorded sections: preserve reported facts and separate existence, access and test results.
A missing link does not negate a reported build. Describe a change only for the state it affects;
leave other state undecided, rather than defaulting it to absent. Cleanup is not another design pass.

At submission, walk the owner through what still has to go. In a grown document that list is short:
the status banner (italic, so the template's own deletion rule already covers it) **plus the working
markers**. The outcomes are hard rule 1's **at submission** column; this walk is how each is earned,
and **none is ever silently unbracketed**. `TBD:` may stay — the checklist counts it as a green flag.

| Marker | Disposition |
|---|---|
| `[HYPOTHESIS]` | Rewrite the claim in **design-intent voice**: *"the Sunday reset is the intended return hook"* — the document is a promise, intent is its honest register. A claimed measurement without supporting evidence becomes `TBD:`; an actual sourced result keeps its conditions and limits. Do not turn a target into an observation or erase a real observation during cleanup. The falsifiable prediction stays in the Hypothesis Log. |
| `[agent-decided]` | Needs an explicit owner yes: **grouped by section**, each shown in chat with the consequence it carries (not just a count or file link); one by one only for the ones that draw a hesitation. This yes is a sign-off on a decision already on the table, not a new decision, so a plain "yes" clears an item; unconfirmed, `TBD:` or the field goes. A blanket yes given ahead of the walk does not skip it: show the list before collecting sign-off. A clear yes to the visible group needs no item-by-item reconfirmation; new additions are not covered. |
| `[OPEN]` | The owner chooses per item: answer, `TBD:`, or the field goes. A dependency tail becomes the `TBD:` plan; postponed becomes `TBD: not discussed yet`. Delegation never unbrackets: on a *"you decide"*, pick `TBD:` or the deletion — an answer you invent yourself lands as `[agent-decided]` and joins that walk, never bare in the document. |

Signing off a decision does not turn research or your assumptions into an owner observation.
Keep factual attribution intact during cleanup; a comparable the owner has played is not
evidence that they personally reported every row you researched.

Open the agent-decided pass by saying what it is: **a sign-off that turns my choices into yours — not
a test**, and no mark against the document. If reporting counts, derive them from the actual
file before/after cleanup and name the unit (marker occurrences, lines or decisions). One line
may contain several markers; they are not interchangeable counts. Otherwise list the affected
items without a total. Never reconstruct a count from conversation memory.
Passages the owner wrote by hand may still carry template material — the intro, italics, the
Glossary, unused placeholders — so check against the template's deletion rule rather than assuming
the grown form kept everything clean. The Hypothesis Log ships with the repo, never inside
`design/gdd.md` ([hypothesis-log.md](hypothesis-log.md)).

Before reporting completion, check changed claims against their source: summaries must not lose
or contradict facts, and new negatives need an actual decision or evidence. Include affected
hypothesis files and implementation notes; a corrected GDD must not leave the old assumption
as a settled finding elsewhere. Check the named file before reporting what was saved there.
Verify the agreed round, IP status and requested constraints; keep prose English (except names/quotes).
Fix omissions or mixed-language draft prose without changing the design. Check changed status
lines against the action: editing prepares; sending needs a successful submission result.
Then give a short meaning-level recap: what changed for submission and
which material questions remain open or untested. Include consequences of cuts or changed claims,
not just counts of removed markers. Link the finished document; do not paste it or start another
approval round. If only formatting changed, say that. Never announce completion before the writes
succeed. A clean document does not mean the design has been validated or application risks resolved.
Distinguish finished writing from unresolved design, evidence and eligibility questions; an owner
may stop with an honest draft without your implying that it is ready for approval.

Before the closing recap, read the **Focused pilot review** block in
[stages-and-gates.md](stages-and-gates.md#focused-pilot-review) unless already loaded, and apply
its three lenses to specific saved passages in the GDD and audit, including relevant technical notes. Include the final summary and cleanup changes;
reuse prior reviews of unchanged parts. This is the same three-lens check, not another approval
queue. Keep it focused and allow postponement; honest `TBD:`s may remain.

At final submission sign-off, rebuild an existing HTML once after all Markdown edits, including
titles and uncertainty, unless the owner explicitly opts out. A draft or ordinary pause is not
this finalization. If no HTML exists, offer it once; do not override an earlier refusal.

**The closing move.** The owner may stop after finalization. Name any unresolved application
risks consistently with the audit, then explain where the Markdown goes if they choose to apply.
Do not predict approval or imply that cleanup resolved open questions; those questions do not
by themselves prevent submission. Preparing a file is not sending an application: say where the
owner can submit it, never that it was submitted unless an actual submission succeeded. This also
applies to status text in the files. Two constraints: the render is never the submission (**The `.html` render** in
[stages-and-gates.md](stages-and-gates.md)), and never invent an application URL.

*"The document is prepared in `design/gdd.md`; nothing has been sent. You can include it in
your scene repo and apply through the programme's form when you choose."*

Then the door: outside a document-only session, `dcl-prototype` on the parked hypotheses (phase 5) —
*"From here: test the parked claims one by one, or stop here — a finished document is a perfectly
good end."* In a document-only session, the log state and no invitation. Either way, **a finished
document is a legitimate end.**

**The rhythm survives finalization.** Whatever comes after — an implementation plan, extra
artifacts, edits — hard rule 2 still binds: one decision per message, never a wall.
