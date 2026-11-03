# Find the module, guides and tools

## Resolve the version first

The public compatibility baseline is SDK7 HTN module commit
`122a3ff2e87b7e89a6c6ea415eb140dd51716125` (upstream HTN 2.4.0, SDK 7.30.1, Node 22+ authoring).
This is a reference pin, not a requirement to downgrade another installed revision.

1. In the creator's project, find `src/htn-planner/README.md`, `HOW-TO.md`, `htn.config.json`,
   `package.json` and any `src/htn-planner/SOURCE.json`. Read recorded source URL/ref, flags and local-change
   markers. `pinned: false` or `localChanges: true` needs the actual source snapshot in addition to the ref
   for reproducibility. Manual copying may record the commit in a project note rather than creating `SOURCE.json`.
2. Use guides/examples from that installed or recorded revision. If local references were removed or were never
   installed, resolve them from the recorded `SOURCE.json.url` scene URL (use its repository/ref, and a blob URL
   for a file). For the official module, the file base is
   `https://github.com/decentraland/sdk7-test-scenes/blob/<ref>/scenes/96,-11-htn-planner/`.
   If the exact revision is unknown, say so and use the pinned public baseline below for exploration;
   verify its APIs/configuration against the installed code before editing. Do not silently assume main matches it.
3. Determine whether this is a game-owned consumer or the full source scene. Read actual npm scripts and each
   tool's `--help`; tools listed in source documentation are not all installed into a creator's game.

## Guides

These public links use the baseline pin. Prefer the matching local files or replace the commit with the recorded ref.

| Need | Source-scene path / public fallback |
|---|---|
| Install, generation, notices, ownership, update | [src/htn-planner/README.md](https://github.com/decentraland/sdk7-test-scenes/blob/122a3ff2e87b7e89a6c6ea415eb140dd51716125/scenes/96,-11-htn-planner/src/htn-planner/README.md) |
| Capsule/custom body, facts/actions, startup preparation | [src/htn-planner/HOW-TO.md](https://github.com/decentraland/sdk7-test-scenes/blob/122a3ff2e87b7e89a6c6ea415eb140dd51716125/scenes/96,-11-htn-planner/src/htn-planner/HOW-TO.md) |
| Language/decomposition semantics | [src/htn-planner/htn/README.md](https://github.com/decentraland/sdk7-test-scenes/blob/122a3ff2e87b7e89a6c6ea415eb140dd51716125/scenes/96,-11-htn-planner/src/htn-planner/htn/README.md) |
| Perception, hearing, executor/replan/body/spawn contracts | [src/htn-planner/npc/README.md](https://github.com/decentraland/sdk7-test-scenes/blob/122a3ff2e87b7e89a6c6ea415eb140dd51716125/scenes/96,-11-htn-planner/src/htn-planner/npc/README.md) |
| Domain design and source CLI recipes | [docs/htn-guidance.md](https://github.com/decentraland/sdk7-test-scenes/blob/122a3ff2e87b7e89a6c6ea415eb140dd51716125/scenes/96,-11-htn-planner/docs/htn-guidance.md) |
| Lint rules and domain profiles | [docs/htn-lint.md](https://github.com/decentraland/sdk7-test-scenes/blob/122a3ff2e87b7e89a6c6ea415eb140dd51716125/scenes/96,-11-htn-planner/docs/htn-lint.md) |
| World invariants | [docs/htn-world-invariants.md](https://github.com/decentraland/sdk7-test-scenes/blob/122a3ff2e87b7e89a6c6ea415eb140dd51716125/scenes/96,-11-htn-planner/docs/htn-world-invariants.md) |
| Game-owned scenarios and shared-host stories | [docs/consumer-testing.md](https://github.com/decentraland/sdk7-test-scenes/blob/122a3ff2e87b7e89a6c6ea415eb140dd51716125/scenes/96,-11-htn-planner/docs/consumer-testing.md) |
| Game-owned planning measurements | [docs/consumer-benchmark.md](https://github.com/decentraland/sdk7-test-scenes/blob/122a3ff2e87b7e89a6c6ea415eb140dd51716125/scenes/96,-11-htn-planner/docs/consumer-benchmark.md) |
| Source host/action measurements (`htn:perf`, fixed workloads) | [docs/performance-measurements.md](https://github.com/decentraland/sdk7-test-scenes/blob/122a3ff2e87b7e89a6c6ea415eb140dd51716125/scenes/96,-11-htn-planner/docs/performance-measurements.md) |
| Source examples, provenance and teaching limits | [docs/htn-examples-catalog.md](https://github.com/decentraland/sdk7-test-scenes/blob/122a3ff2e87b7e89a6c6ea415eb140dd51716125/scenes/96,-11-htn-planner/docs/htn-examples-catalog.md) |

## Installation and workspace boundaries

Follow the module README's whole-folder copy setup in an existing SDK7 scene, or its optional installer
from a downloaded source scene. Preserve entrypoint, assets, settings, valid scripts and project instructions.
The library/compiler folders are module-owned; domains, executors and test cases belong to the game.
Keep the library/compiler revision together, preserve both MIT notices and record the source pin.

The optional installer flags are separate: `--starter` supplies a game-owned guard, `--reference` supplies
removable source examples/assets, `--testing` installs consumer checks, and `--benchmark` installs measurements.
Use only what the task needs. `--update` refreshes module files but does not prune removed upstream files;
review ownership and obsolete paths using the module's update guide. Do not overwrite a customized domain.

| Workspace | Commands and limits |
|---|---|
| Configured creator game | `htn:generate` is the normal edit/compile step; `htn:notices` maintains deployment notices. `htn:watch` is optional. Read its `htn.config.json` targets and export names. |
| Consumer with `--testing` | `htn:check -- htn-tests/worker.tests.ts` checks game-owned manifests. Optional `--session` writes portable DebugSession JSON. The installed guide is `docs/consumer-testing.md`. |
| Consumer with `--benchmark` | `htn:measure -- <manifest> --quick` measures planning; full host/action work needs its own check. Start with the guide, not a long run. |
| Full HTN source checkout, cwd `scenes/96,-11-htn-planner` | `htn:compile`, `htn:run`, `htn:lint`, `htn:view`, `htn:level`, `htn:bench`, `htn:perf`, `htn:ci` and variant tools are source workflows. Its package does not define consumer `htn:generate`. Keep source baselines and teaching registrations here. |

If optional tools are absent, use an explicit source checkout for them or follow the documented optional install.
Do not invent npm scripts or report a source check as run in the consumer. Keep test/measurement reports and
reference sources outside runtime imports and `.dclignore` them; code imports and raw publication exclusions
are separate boundaries. Include only assets the game actually uses, plus required notices.

World invariants are optional Node-side test checks on setup and stable story boundaries. They do not
automatically validate the running game or replace sensor/executor consistency checks.

## Host contracts to carry into game integration

- The game owns fact writers, primitive executors, side-effect cleanup and multiplayer authority. Conditions and
  callterms are normally read-only; their mutations during planning survive failed search, and exceptions escape.
- Cancellation can discard all remaining steps. Release game-owned reservations through the owning executor/host,
  not solely a pending `!release` step. Test failed/cancelled paths and re-entry with the actual state writers.
- A shared planning snapshot does not reserve resources: executors/hosts must claim exclusive resources atomically.
  When contention wastes work, define and test fair arbitration or backoff, including recovery and eventual progress.
- `continueTask` and `activePlan` are opt-in host policies, not language-level plan repair. Inspect candidate
  status and committed state separately. Initial deferred steps remain lazy; do not simulate effects to validate them.
- A `GuardSquad` spawn batch validates and stages new guards before publishing them. Factories own allocations
  until they return; custom callbacks' external side effects cannot be rolled back. During update, callback/body
  exceptions are fail-fast; earlier guards' changes are not rolled back. Use the NPC guide for recovery/ownership.
- Scene-space body conversion supports uniform positive ancestor scales, not arbitrary shear. Dispose bodies
  before removing their visual hierarchy. For async hearing, the same event object is polled to one completion/drop;
  pending work is bounded and cleanup is explicit. Follow the installed NPC reference rather than recreating these policies.
