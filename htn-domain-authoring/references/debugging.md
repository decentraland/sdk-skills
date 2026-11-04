# Debug a domain or its host

Read [module-reference.md](module-reference.md) for the installed revision and tool routes. A creator's
`htn:check` manifest/report is usable without source `htn:run`, `htn:view` or an in-scene debugger.
Use the matching module design/NPC guides when a failure crosses domain and host code.

1. **Capture before changing.** Record observed versus expected behaviour, version, facts, running action,
   replan reason and any available trace. For live trace/history setup, follow
   [HOW-TO: inspect a decision](https://github.com/decentraland/sdk7-test-scenes/blob/122a3ff2e87b7e89a6c6ea415eb140dd51716125/scenes/96,-11-htn-planner/src/htn-planner/HOW-TO.md#4-inspect-a-decision-optionally):
   use a recorder per NPC and bounded history while debugging. Compile the domain; run source lint when available.
   A compiler failure can skip execution. Done when evidence shows the failure, rather than a design rule alone implying it.
2. **Reproduce at the right level.** For a wrong plan on known facts, create a game-owned world/scenario
   with an independent expected plan. With consumer testing installed, run
   `npm run htn:check -- htn-tests/worker.tests.ts --case '<name>' --json --session ../htn-reports`.
   `--session` resolves beside the manifest: this example writes to the project's `htn-reports/`.
   For missing replans, stale facts, cancellation or inter-agent timing, retain the earlier events and host writes
   in a shared-host story. A correct isolated plan does not clear the host. If reproduction is unavailable,
   report the limit rather than inventing a domain defect.
3. **Locate the cause.** Resolve `invalid_world` / `invariant_error` through fixture, sensor and executor
   writers before changing behaviour guards. Without declared invariants, inspect consistency explicitly.
   Trace the values and arities the chosen guard read, selected arguments, source order/backtracking mode,
   action result, candidate status/adoption, cancellation and committed state. Initial deferred tasks are lazy;
   a candidate trace and committed orders need not be the same snapshot.
   Done when evidence places the cause in the domain, host or their interface.

| Symptom | Check |
|---|---|
| Branch never fires | Fact writer/arity, then entry guard (12, 3) |
| Finished work repeats | Re-entry, executor fact writes (8) |
| Same target/action repeatedly fails | Learned failure facts and target eligibility; door-helper example |
| Cancelled shared task leaves a reservation | Owning host/executor cleanup; pending release steps may be discarded |
| Recovery skipped after replan | State-dependent priority (6) |
| Tier swallows the next | Guard and intended branch backtracking mode (3) |
| Decision reads pre-action state | Horizon and deferred task (7) |
| `depth_exceeded` | Base, progress, recursion (11) |
| Upkeep cuts actions or never runs | Host wiring, fixpoint/pass budget (5) |
| Root plans too often or useful work restarts | Update vs decision cadence, trigger keys, candidate adoption and commitment (9) |
| Empty plan replanned every tick | Completion policy or timed fallback (2) |
| Figure moves/sees in wrong coordinates | Scene-space pose, parent transforms, SDK adapter contract |
| Delayed noise updates memory incorrectly | Async event identity, observation time/order, pending query cleanup |

4. **Fix and keep the reproduction.** Set expectations from strategy before running. A domain failure gets a
   decision case; a host/interaction failure gets an execution case. Make a cause-based change and show the
   reproduction failing before it and passing after it. Do not demand an old-domain failure for a host-only bug.
   Regenerate the changed configured domain, build and repeat the relevant client check when presentation,
   sensors or real execution are involved. Done when relevant checks pass and remaining limits are explicit.

## Additional source-checkout diagnostics

Only in a full source scene, `htn:view -- t.json --text --run <agent>:<n> --world-all` extracts a recorded
world; `htn:run -- <domain> <method> --world <world>` plans it with the runner's built-in callterm set.
For game-specific callterms/context, use `htn:check` with the same manifest factory and bindings as the game;
missing bindings can produce a misleading failure. Use `--why <branch>` and an appropriate backtracking mode
to inspect priority. `--max-passes N` expands deferred tasks on the same world, without executing host effects;
use a host story for state changes between steps.
`htn:level -- <level> --session t.json` or a registered story retains execution context, and
`htn:view -- t.json --text` reads it. Confirm flags with the installed version's `--help`.
The portable consumer reports already show expected/actual plans, trace and diagnostics; `parseSession` from
`src/htn-planner/debug/session` can read their DebugSession JSON without installing the offline viewer.
