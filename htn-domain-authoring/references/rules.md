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

Separate the two search boundaries: `mode.factsAndAxioms` tries bindings across later terms of the same condition;
once that condition selects a branch, it commits. If its task subtree fails, `mode.branches` may try the next branch,
but neither flag reopens that selected guard to choose a different target. Put the relevant eligibility tests in
the guard/axiom, or have the host publish eligible ranked candidates. Test an ineligible first candidate followed
by an eligible one. A branch whose guard fails falls through in every mode; confirm flags against the installed
language guide. This differs from assuming arbitrary Prolog/SHOP backtracking.

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

Known ordered steps can stay in one plan; pass selected context as task parameters. Primitive actions do not
change facts during decomposition. End the plan or use `&task` when a later choice needs an actual execution
result or new observation. Keep before/after states distinct. Examples: bridge troll's `v6_partial_plans`,
Fetcher's `!perceive` then `&fetch`, and commuter's deferred second trip.
Mutating callterms are an explicit exception: their writes happen during search and survive failed branches.

## 8. Re-entry

A replan may revisit partly or fully completed work. Handle those states before fresh work so a toll is not
paid twice and a reservation is not taken again. Stateless tasks need no invented completion flag.
See `canon/classics/commuter.domain` and `canon/door_helper/door_helper.domain`.

## 9. Execution and replanning

The host updates executors and facts; a new root decision is a separate operation. A long-running action can
span many updates, and a known sequence can contain several actions. Choose the horizon from what is known,
not the frame rate. A one-action plan or a reactive decision each logical tick is valid when the host contract
calls for it; state what that tick means. During review, report an unknown host schedule as a limit.

Replan for relevant changed preconditions or higher-priority goals, failure or plan completion. Refresh facts
before root planning and deferred expansion. The host/executor must publish actual results before `&task` reads them,
including in the same update as primitive completion. Resolve `&task` when execution reaches it, using actual earlier
effects: successful primitive completion can advance the existing plan without a new root; failed deferred expansion needs recovery.

With `GuardAgent`, change the key returned by `syncFacts` or call `requestReplan` for game-owned triggers.
Fact writes alone do not request a replan; keep unrelated clock/position changes out of the key. An equivalent
candidate already keeps the running step and progress. A custom host must define its own adoption policy.
Arguments compare exactly: passing a changing target position can turn every candidate into a replacement.
Pass a stable target ID and let the executor read its live position when that matches the action's contract;
retain invalidation checks so keeping an identity does not keep an unusable target.

Bounded periodic monitoring is useful when events are insufficient; the host must schedule its requests.
`replanThrottle` spaces pending non-urgent triggers, not periodic checks. Failure/completion bypass that throttle,
but a shared `PlanBudget` can still defer their replans. It gates whole runs, not work already inside a run;
valid work continues while waiting. Executors or explicit validity checks must stop invalid work during a wait.

Use `!continue` with `continueTask` for domain-controlled commitment. It still decomposes a candidate.
An `activePlan` validator checks the running step every update in a separate runner, outside the planning budget;
accept only intended cases. Choose these policies for the required response and compare costs/outcomes when
claiming a benefit. See `basics/storekeeper.domain` and `canon/sentry_turret/sentry_turret.domain`.

## 10. Shared concepts

Share repeated tails through parameterized tasks, repeated conditions through axioms, and common behaviour
through `:include` or `base` / `overrides`. Keep deliberately independent teaching versions independent.
See `guard/guard_kit.domain`, used by guard and yard guard, and `canon/service_bots/bot_base.domain`.
For a new character variant, shared task or role, read [composition.md](composition.md): choose reusable intent,
capability-dependent methods and explicit context, then exercise the changed reuse point.

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

A compiling, solvable model can still express the wrong task. Derive meaningful after-execution conditions and
forbidden outcomes from the request, not from method comments or the emitted plan. A disabled/absent executor
cannot establish an outcome. Alongside positive cases, choose a counterexample that would expose a plausible
wrong model, such as moving without collecting the requested item or completing with an unpaid obligation.

Match extra cases to the claim:

- **Target choice:** competing eligible targets and an ineligible first candidate; test stated ranking/ties.
- **Order independence:** permute fact rows when their order is not intended priority. For ranked sensor rows,
  assert the host ranking instead; an arbitrary alternate winner need not be a defect.
- **Reusable/variable-size tasks:** rename IDs, change bindings or try another object count where that is promised.
  Preserve relevant world invariants and check semantic outcomes; require an exact plan only when its order matters.
- **Lifecycle:** reachable partial/completed states and meaningful impossible/irrelevant/cancelled exits, including
  obligations and affected teammates when applicable.

Use a one-fact or one-event change from a known case when it isolates a boundary. For a complex new behaviour,
validate one meaningful path before adding alternatives; retain its independent regression cases while extending.
After extending the pieces, recheck their shared assumptions and interactions. When claiming authoring reliability,
compare matched fresh attempts and retain failures as evidence.
These are targeted techniques, not a fixed matrix every small domain must fill.

Source basis: [Puerta-Merino et al., L2HP (2025), Experimental Considerations](https://arxiv.org/html/2511.18165v1#S5.SS2)
distinguishes solvability from model faithfulness. [Xu and Muñoz-Avila (2025), §6.4](https://arxiv.org/html/2511.12901v1#S6.SS4)
shows a particular learner's fixed-count limitation. These motivate our checks; their results are not guarantees
or measured failure rates for this SDK or the current authoring agent.

## 14. Restructure at two levels

Equivalent decisions on fixed worlds do not prove equivalent execution. Compare decisions first, then
outcomes under the same interruptions, contention, seeds and host schedule. Scripted visitors can miss states
that randomized visitors find. Keep refactoring distinct from requested behaviour changes.
See [restructure.md](restructure.md) for both source and consumer routes.

## 15. Stable names

Preserve branch names when tests, board labels, host code or trace consumers use them. Find those users before
renaming. The source demo reads behaviour names below the root; an extra tier can change that lookup depth.

## 16. Cost and outcomes

A new planner/host feature should be opt-in, with matched cost and outcome comparisons. When comparing architectures
or authoring approaches, define outcomes, author/adaptation effort and runtime CPU/work measures before the first
matched run and collect them together. Authoring time is not a runtime CPU measurement. Measure total work,
including upkeep, diagnostics and host scheduling where relevant. Decision counters can omit upkeep internals;
record its calls/time separately. A smaller decision tree does not itself prove faster execution.
Guard/condition reordering can change winning branches or bindings; treat that as a behaviour change unless
independent comparisons establish the intended equivalence. Query caching or spreading expensive sensor work
needs an explicit freshness/invalidation contract and a measured benefit.
Use consumer `htn:measure` only when installed, or source measurements through the module guide. Keep warm-up,
seeds, world size, Node/client versions and configuration. Repeat noisy wall-clock samples and state uncertainty.
Node planning excludes real movement, rendering, raycasts and networking; check bursts and the target client
before claiming frame budget or NPC capacity. No universal zero-allocation or speed claim follows.
