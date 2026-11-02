# Rules: reasons and examples

The numbered wording lives in [SKILL.md](../SKILL.md). These are design defaults for this planner/host,
not universal HTN laws. Validators, upkeep, event-driven directors and source-faithful lessons may need different shapes.
Use [module-reference.md](module-reference.md) to resolve public guides and the examples below at one revision.
Source example paths are relative to `src/examples/`; a consumer may have only an optional `reference/htn` snapshot.
The public design guide and example headers retain detailed sources, licences and adaptation limits.

## 1. A readable root

Group related behaviours when a long first-match list hides priorities. A small domain needs no extra tier.
Compare `stalker/stalker.domain` with source `test/fixtures/reference/stalker_flat.domain`.
`max-branches` and `flat-root` are review prompts, not proof that a root is wrong.

## 2. Priority and fallback

An ongoing tick-driven root needs a fallback that lets time pass; otherwise it can spend its update budget
replanning an empty or instant plan. Validators may reject and completed goals/directors may finish empty
when the host handles completion. `canon/bridge_troll/v1_priority.domain` is a timed-fallback example.

## 3. Guard and bind entry facts

An exact tier guard explains selection and avoids relying on failed child decomposition. Bind a selected
target/state once and pass it down: see `canon/creatures/mouse.domain` and Stalker's `hear` tier.
Stalker's `hunt` tier deliberately declines when it cannot notice a visible target; branch backtracking then
reaches the next tier. Its header and `test/npc/tiered-equivalence.test.ts` record this production policy.
Changing the mode can reveal a hidden dependency or confirm a documented one; it is not automatically a defect.

## 4. Useful one-task branches

Delegation, continuation and a long-running action are natural single-task branches. A short complete action
is valid too. Lint task counts cannot establish bad design. Group meaningful complexity rather than padding it.

## 5. Upkeep and fixpoints

Expiry, focus filtering and stale-memory cleanup belong in a host updater or an explicitly wired `reasoning`
method, not reactive priority branches that repeatedly cancel useful work. Each fixpoint pass must progress;
finish with an empty branch and test the pass budget/`reasoning_unsettled` diagnostic.
A claim/release needed by the behaviour remains an action: see `canon/door_helper/door_helper.domain`.

## 6. Reasons as facts

Represent a state-dependent priority as a fact the branches read. A replan during recovery must still see
that recovery is needed. Compare `canon/bridge_troll/v5_combo_bug.domain` with `v5_tired.domain`.
An `order-dependent` lint finding is informational until checked against intended priorities.

## 7. Horizons and deferred tasks

Primitive actions do not change facts during decomposition. End the plan at a changing boundary or use `&task`
to decide after the earlier action actually ran. Keep before/after states distinct. Examples: bridge troll's
`v6_partial_plans`, Fetcher's `!perceive` then `&fetch`, and commuter's deferred second trip.
Mutating callterms are an explicit exception: their writes happen during search and survive failed branches.

## 8. Re-entry

A replan may revisit partly or fully completed work. Handle those states before fresh work so a toll is not
paid twice and a reservation is not taken again. Stateless tasks need no invented completion flag.
See `canon/classics/commuter.domain` and `canon/door_helper/door_helper.domain`.

## 9. Commitment tradeoffs

Use the domain step `!continue` with host option `continueTask`, or an `activePlan` validator, when
retaining progress is worth reduced responsiveness.
Compare outcomes with and without the policy; avoiding retargeting can also lose catches.
`basics/storekeeper.domain` checks running actions; `canon/sentry_turret/sentry_turret.domain` shows continuation.
Validators need a branch per accepted case, not a catch-all that accepts every running action.

## 10. Shared concepts

Share repeated tails through parameterized tasks, repeated conditions through axioms, and common behaviour
through `:include` or `base` / `overrides`. Keep deliberately independent teaching versions independent.
See `guard/guard_kit.domain`, used by guard and yard guard, and `canon/service_bots/bot_base.domain`.

## 11. Progress and recursion

Recursion needs a base and progress; prefer tail recursion. A direct self-call against unchanged facts can
reach `depth_exceeded`. A runtime loop normally defers `&self` or replans after execution so it sees changes.
Deferred loops still need a host budget and actual progress; deferral alone does not prevent a busy-loop.

## 12. Strategy and vocabulary

Write intended priorities and state ownership before syntax. Read actual executors and sensors; a plausible
primitive name does not mean the host implements it. Record fact arities/writers and missing integration.
`unknown-primitive` needs a host profile, and `fact-arity-mix` needs semantic review rather than blind renaming.

## 13. Independent expectations

Derive expected plans from strategy before running cases. An output copied into its own expected plan can
pass while proving nothing. Cover entry, near-miss and re-entry; an ongoing fallback should not be broken to
manufacture `no_plan`. If repeated repairs fail, diagnose the model/interface before restructuring.
There is no universal repair-round limit. Invariants check consistent worlds, not the correctness of test oracles.

## 14. Restructure at two levels

Equivalent decisions on fixed worlds do not prove equivalent execution. Compare decisions first, then
outcomes under the same interruptions, contention, seeds and host schedule. Scripted visitors can miss states
that randomized visitors find. Keep refactoring distinct from requested behaviour changes.
See [restructure.md](restructure.md) for both source and consumer routes.

## 15. Stable names

Preserve branch names when tests, board labels, host code or trace consumers use them. Find those users before
renaming. The source demo reads behaviour names below the root; an extra tier can change that lookup depth.

## 16. Cost and outcomes

A new planner/host feature should be opt-in, with matched cost and outcome comparisons. Measure total work,
including upkeep, diagnostics and host scheduling where relevant. Decision counters can omit upkeep internals;
record its calls/time separately. A smaller decision tree does not itself prove faster execution.
Use consumer `htn:measure` only when installed, or source measurements through the module guide. Keep warm-up,
seeds, world size, Node/client versions and configuration. Repeat noisy wall-clock samples and state uncertainty.
Node planning excludes real movement, rendering, raycasts and networking; check bursts and the target client
before claiming frame budget or NPC capacity. No universal zero-allocation or speed claim follows.
