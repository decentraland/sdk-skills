# Ground planning in the receiving scene

Use before recommending new concrete questions or moments, including new moments raised
during refinement. Keep exact approved edits within the [integration scope](integration.md).

## Find relevant intent and implementation

Locate the receiving scene's root from the requested path, scene configuration, startup,
and package structure; it may be nested within a monorepo. Search its `design/`, documentation,
and linked GDD, decisions, flow, or mechanics notes. Read the portions relevant to this
playtest rather than loading a whole documentation folder.

Compare that intent with actual handlers, UI, simulation, state transitions, and outcomes.
Reconstruct enough of the player journey to identify answerable experiences. Relevant first
interactions, retries/failures, recovery, pit-stops/breathers, and endings are candidate
moments, not a fixed set of survey checkpoints. Establish what experience each proposed
question requires and which implemented condition demonstrates exposure.

Distinguish code-supported facts from intended behavior, inferred experience, and unknowns.
Claims about how many players reach a moment need evidence; source order or a design label
alone does not establish reach or player understanding.

## Check the moment, not just its name

A designed breather or recovery event does not by itself establish a safe modal pause.
Check other UI, ongoing simulation, threats, timers, and player state at the proposed hook.
When safety or exposure remains unknown, state the condition to verify or propose a later
safe/player-opened opportunity. Use this mapping to support a compact relevant proposal;
surface only the rationale and assumptions needed for the creator's decision.

## Keep setup feasibility separate

Distinguish verified setup requirements/blockers from compatibility hypotheses. Useful
question/timing planning can continue under stated assumptions while dependent implementation
waits for resolution. Keep technical decisions separate from the three planning paths;
investigate setup or alternative architectures only within the requested integration/debug
scope. A setup uncertainty need not turn content review into unrelated solution choices.
