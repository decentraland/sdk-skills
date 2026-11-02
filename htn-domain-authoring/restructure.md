# Review and restructure an existing domain

A review is the audit and stops there. A restructure starts with the audit and goes on.
Use [module-reference.md](module-reference.md) to select the workspace. Source commands below run in
`scenes/96,-11-htn-planner`; a consumer instead uses its game-owned `htn:check` manifests/stories and
optional `htn:measure`. Source lint/variant tools are not installed by the minimal consumer setup.

## Audit

1. **Compile, then lint where available.** In the source checkout, lint the domain and its folder: `npm run -s htn:lint -- <folder> --json`. A folder run also finds copies
   across roots. Read each domain's metrics. Done when each finding has its rule, location and assessment;
   heuristic warnings are not automatically defects. If lint is absent, report the gap and inspect shape manually;
   a successful consumer compile/check does not count as lint.
2. **Walk the rules** in [SKILL.md](SKILL.md), using each rule's scope and [rules.md](rules.md) for evidence.
   Lint covers only part; inspect the implementation and run applicable cases:
   - guard choices with branch backtracking off (3), unless backtracking is the lesson;
   - horizons and deferred decisions (7); applicable partial-work/re-entry states (8);
   - ablations for commitment features (9);
   - independent expectations and entry/near-miss/re-entry coverage (13).
   Done when every rule has a verdict (holds / breaks / does not apply / unverified), with a reason and evidence.
   Each break needs `file:line`, its consequence and a proposed correction. Unverified is not a pass.
3. **Report** the consequential breaks first, with locations and supporting rule/evidence links. A review ends here.

## Restructure

1. **Freeze the reference.** Copy the original domain and any compiled module into `test/fixtures/reference/`
   before edits. Model: `stalker_flat.domain` and `guard_flat.domain`. Done when the snapshot compiles, nothing
   in runtime `src/` imports it, and the intended behaviour-preserving scope is recorded.
2. **Rebuild the shape** using the authoring steps of [SKILL.md](SKILL.md). Group only where useful; move upkeep
   out of decisions and wire it in the host; share repeated tails/conditions. Preserve names depended on by hosts,
   tests or tools (15). Done when available lint passes, any unavailable check is explicit, and those dependencies still resolve.
3. **Compare decisions.** Define the valid state space and expected comparison before running both domains.
   Model: `test/npc/tiered-equivalence.test.ts`; settle the reference's upkeep first, compare behaviour plans.
   Done when plans match over the stated space. A requested behaviour change needs separate expectations and an
   explicit report; calling a difference an improvement does not establish equivalence. Unexplained differences
   remain open. Do not silently expand a refactoring task into behaviour redesign.
4. **Compare execution.** For supported level NPCs, register the reference in `test/fixtures/reference/variant.ts`
   and run `node scripts/htn-variant-diff.mjs --variant <name> --levels <ids> --seeds 1-50`; use `--trace <seed>`
   for divergences. For paper prototypes without a level adapter, replay shared-host stories on both versions,
   including relevant interruptions and contention. Done when progress/outcomes meet the predeclared comparison
   and every divergence is explained; separately requested changes are verified as changes, not equivalence.
5. **Outcomes and cost.** For levels: `npm run -s htn:level -- <level> --variant all --metrics --seed 1-20
   --rounds 3 --stagger 5`. Pair runs with identical seeds, inputs and configuration; paper hosts use their stories.
   Deterministic outcomes should match for a behaviour-preserving change. Declare any accepted tolerance and its
   basis before comparison; seed variation alone does not excuse a regression. Repeat wall-clock measurements
   and report uncertainty when machine load is noisy. `npm test` runs the counter gate; explain intentional work
   changes before updating it with `npm run -s htn:bench -- --update-counters` (procedure:
   [htn-guidance.md](https://github.com/decentraland/sdk7-test-scenes/blob/122a3ff2e87b7e89a6c6ea415eb140dd51716125/scenes/96,-11-htn-planner/docs/htn-guidance.md#how-an-ai-agent-checks-a-changes-cost)).
   Done when the declared comparison passes and counter changes are explained. Include upkeep calls/time;
   current structural totals omit its internals, so decision-only counters are not total-work savings.
6. **Record** the before/after paths, covered state space, checks and any remaining limits in the change report;
   the domain header links to its reference. Done when another reader can reproduce the comparison without
   treating untested states or host features as proven.

For a consumer, retain before/after files outside runtime imports and replay the same game-owned worlds and
shared-host stories. Use the public design and measurement guides through [module-reference.md](module-reference.md)
for tool details and evidence limits; source-specific registration is only needed when changing the source demo.
