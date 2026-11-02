---
name: htn-domain-authoring
description: "Write, review, restructure or debug HTN .domain behaviours for Decentraland's TypeScript HTN planner; integrate facts, executors and replanning, and test individual or cooperating NPCs. Use for the HTN module, ordered task decomposition or domain authoring. For character appearance and dialogue, use npcs."
---

# HTN domain authoring

Use the [Decentraland HTN module](https://github.com/decentraland/sdk7-test-scenes/tree/122a3ff2e87b7e89a6c6ea415eb140dd51716125/scenes/96,-11-htn-planner).
It is a total-order, SHOP-like TypeScript port of `urosidoki/htn_planner`: ordered branches,
optional branch backtracking, no simulated primitive effects. The host executes actions and replans.

First read [module-reference.md](module-reference.md): identify the installed revision, source/consumer
workspace and available tools. Keep game-owned domains, actions and cases outside the library.
Use the matching installed guides first, then public sources at the same revision. Installation is
needed only when the task needs missing module/tools; an existing domain can be reviewed without it.

## Pick the task

| Task | Read |
|---|---|
| Write a domain or add behaviour | Rules and authoring steps below |
| Review or restructure | [restructure.md](restructure.md); review stops at findings |
| Debug a wrong plan or unexpected execution | [debugging.md](debugging.md) |
| Integrate a host or a new scene | Module README/HOW-TO and NPC reference through [module-reference.md](module-reference.md), then the authoring steps |
| Contribute a source-checkout teaching example | [canonical-example.md](canonical-example.md) in addition to the authoring steps |

Read the matching [rule reference](rules.md) when a design choice or finding needs explanation.
[examples.md](examples.md) indexes source patterns; examples are optional references, not runtime dependencies.

## The rules

A **tier** is a root branch and the behaviour it selects; **upkeep** is belief bookkeeping (expiry, focus,
filters); the **horizon** is where a plan ends because the world will have changed. Apply these design defaults
to the task's purpose; validators, upkeep methods and source-faithful teaching examples have different shapes.

Shape
1. Keep the root readable. Group related behaviours into named tiers when this removes complexity; a small
   domain needs no extra wrappers or minimum branch count. Lint's size thresholds are review prompts.
2. Branch order expresses priority. An ongoing reactive root needs a fallback that lets time pass. A validator
   may deliberately return no plan; a completed goal or event-driven director may return an empty plan if its
   host does not busy-loop. Document that host contract.
3. Guard each tier by its entry conditions, bind entry facts and pass them down; use axioms for shared tests.
   Reactive tiers should select the same plan with branch backtracking off. Keep an intentional backtracking
   lesson explicit and test its intended modes instead.
4. Delegation, `!continue` and a long-running action are useful one-task branches. A short action is also valid
   when it is the whole decision. Do not add hierarchy just to change the number of tasks.

Beliefs
5. Run upkeep outside the decision list: in the host or a `reasoning` method wired through
   `GuardAgentOptions.reasoning`. Each step must make progress towards a fixpoint; the method ends with an empty
   branch. Check the host's pass budget and `reasoning_unsettled` diagnostic; declaring a method does not enable it.
6. If a priority depends on state, represent that reason as a fact the branches read.

Replanning
7. Plan to the horizon. Represent the state before and after a split; use deferred `&task` when a later decision
   needs an earlier action's result. Primitive effects are not simulated during decomposition; explicit mutating callterms can change facts.
8. Tasks that can be re-entered after partial or completed work must handle those states before fresh work.
   Use a re-entry branch where needed; stateless tasks need no synthetic "already done" state.
9. Add `!continue` or `activePlan` where an ablation shows that commitment pays for lost responsiveness.

Reuse
10. Share repeated tails as parameterised tasks, shared behaviour through `:include` or `base` / `overrides`,
    and repeated conditions through axioms. Keep independent teaching versions independent when that is their purpose.
11. Recursion needs a base case and progress; prefer tail recursion. Runtime loops usually use a deferred `&task`
    or the next replan, so they can see the changed world.

Process
12. Write strategy and vocabulary (facts with writers, primitives with executors) before syntax.
13. Lint after domain changes. Derive test expectations from the strategy before running the case; cover entry,
    near-miss and re-entry where applicable. Repeated repairs of the same problem call for diagnosis, then a
    restructure if the shape is the cause; there is no fixed repair-count limit.
14. Validate a restructure at two levels: decisions, then execution over time. Use seeded random visitors for
    supported level NPCs and host stories for paper prototypes. Keep refactoring separate from behaviour changes.
15. Preserve behaviour branch names when host code, checks or tools depend on them.
16. A new planner or host feature is opt-in, with a cost comparison and an outcome ablation. Measure total work,
    including upkeep, against the relevant baseline; do not promise universal zero allocations or faster execution.

## Steps: write a domain

1. **Vocabulary and strategy.** In the domain header, record priorities, entry conditions, horizons,
   facts with arity/writers/timing, and primitives with their executors. Read the actual host actions
   and a relevant sibling domain. Identify any required sensor, executor or replanning work.
   Done when every state change has an owner and missing integration is explicit; label paper-host substitutes.
2. **Root and behaviours.** Implement the strategy with the applicable rules above. Give each
   non-top-level method a `// Contract:` describing preconditions, intended result and re-entry assumptions.
   Keep the root's contract in the strategy header. Handle applicable partial/completed states before fresh work.
   Done when priorities, fallback/termination and contracts match the intended host behaviour.
3. **Check shape and ownership.** Review the rules and compile the domain. If source tooling is available,
   run `htn:lint` using the source route in [module-reference.md](module-reference.md). Register new host
   primitives/upkeep and enable `missing-contract` for authored domains; an include needs its consuming root checked too.
   Resolve errors and explain deliberate warning exceptions. A comment-presence check does not prove its contract.
   In a minimal consumer, report unavailable lint explicitly; a compile/build is not a lint result.
4. **Generate and connect.** For a new game-owned domain, register its source, output and `exportName` in
   `htn.config.json`, preserving existing targets. Run `npm run htn:generate` after editing a configured
   `.domain` or include and verify that the intended output was generated. Wait for READY; FAILED / STALE
   means the open preview may still run old code.
   In the source checkout, use its one-off `htn:compile` or example-generation route instead.
   Wire executors, sensors, `reasoning` and any other selected host options. Preserve the configured export name,
   generated source header and game-owned files. Done when generation and the relevant build pass and the host
   can execute the behaviour, or the omitted host integration is explicitly marked unimplemented.
5. **Independent scenarios.** Before the first execution of each case, write the complete expected status
   and plan from the strategy, with a short reason. An intentionally empty plan is explicit. Never fill
   placeholders or derive the oracle from the planner's actual output. On mismatch, diagnose against the strategy;
   change expectations only with a recorded correction to that reasoning.
   Cover each tier's entry, relevant re-entry and a near-miss where its guard fails and the next eligible
   branch wins. Explain an impossible near-miss under valid invariants. Require `no_plan` only for an entry
   point designed to reject, such as a validator; keep a reactive root's fallback intact.
   In a consumer with optional testing installed, use a game-owned `htn-tests/*.tests.ts` manifest and
   `npm run htn:check -- <manifest>`. Domain/world paths inside it resolve beside the manifest.
   See [module-reference.md](module-reference.md) for source scenarios and testing setup.
   For ownership, identities or exclusive stages, encode applicable rules in `<stem>.invariants.domain`
   and give each declared invariant a valid and a violating case. Invariants supplement independent
   expectations; they do not create them.
   Done when cases compare against independent expectations and the facts obey their writers' state contract.
6. **Execution across replans.** Cooperating agents need a story with a shared host/state; static plans
   cannot establish handoffs, reservations or progress. Set expected outcomes and progress conditions before
   the run. Derive exact traces independently or use semantic assertions. Include relevant contention,
   interruption, failed actions, cleanup and re-entry. `PaperHost.dropped` models release of reservations when
   pending cleanup steps never run. Also test the real executor/host when that integration is part of the claim.
   Record traces through installed `htn:check --session`, or source tools when available. Consumer JSON/text
   reports work without the optional viewer. Done when all participants make intended progress or deliberately
   terminate; all agents waiting without an exception is not proof of success.
7. **Client and cost.** For scene work, use the existing Preview/hot reload workflow; Creator Hub bypasses
   npm hooks, so generate explicitly before Preview/Publish and check notices before publishing.
   Use `unity-explorer-mcp` when an in-world check is needed. Report headless, build and client results separately.
   For a new planner/host feature, follow [rule 16](rules.md#16-cost-and-outcomes): record matched cost and
   outcome comparisons, configuration and limits. A domain edit alone does not require a benchmark campaign.
