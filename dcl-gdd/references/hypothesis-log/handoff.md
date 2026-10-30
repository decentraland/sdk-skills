# Handoff: scope and vehicle

Part of the [Hypothesis Log contract](../hypothesis-log.md), shared with `dcl-prototype` — both
skills use this when moving into prototyping.

For an unfinished idea the owner wants to play with, offer a small connected toy rather than
requiring a list of separate hypotheses first. Choose a focused test when it better answers a
specific question; respect the owner's chosen scope. Keep the playable action and the feedback
needed to understand its outcome together, rather than splitting the toy into isolated mechanics.
Carry the saved [working direction](files.md#working-direction), intent, requested action, build boundary and existing record; use an H-ID and agreed criterion only for
a registered experiment. Exploration needs neither a finished GDD nor an invented metric.
Preparing a test or its handoff does not authorise building or running it. Preserve the current
action and any hold in both saved next steps and the receiving prompt; moving sessions does not
lift a hold. When the owner does request execution, carry that scope without asking again.
Carry applicable platform findings and their sources as implementation inputs, separate from
the question being tested. Follow [platform reuse](../platform-fit.md#reuse-the-platform-answer-before-researching-it-again)
when a build reveals a reproducible failure; do not ask the receiver to prove known capabilities again.
For a registered-test handoff, [rebuild the index and check source links](index.md) before sending it.

Keep the question that motivated the try attached to the affected
[working design](files.md#working-design), even if it has no agreed criterion yet. Carry that
question and the existing source link with the build boundary; leave open what the owner has
not decided. On return, use the actual trial record to update that design under the same contract.
An exploratory note complements the working design; it does not silently replace it or an
existing registered experiment. Direct entry into `dcl-prototype` can still use a standalone test.

Reuse the established session and folder. Ask about the vehicle only if unclear or changing,
with a recommendation:

1. **A separate session** (*recommended for a real build*) — the owner opens a new window in the
   same folder and pastes a bootstrap prompt that you produce. Keep it short; the files are the
   shared state, three lines suffice:

   > Working folder: `<folder>`. Use `<available prototype skill or chosen build/test workflow>` for `<interaction or H-ID>`: `<requested action and any hold>`.
   > Current record: `<existing design file>`. Keep: `<working direction, intent and agreed build boundary>`.

   Save current intent and decisions before the move; link existing records rather than duplicating them.
2. **This session** — fine for paper/arithmetic experiments, or while the session is still light.
3. **A sub-agent** — *not recommended*: playtesting is interactive, and the owner cannot feel a
   build through a sub-agent. Acceptable only for non-interactive experiments (pure arithmetic or
   paper).
