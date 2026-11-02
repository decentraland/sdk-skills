# Examples by pattern

Use these as optional source references at the installed module revision. Resolve them locally first
(`reference/htn` if installed), otherwise through [module-reference.md](module-reference.md).
Paths below are relative to the source scene's `src/examples/`; `test/` paths are relative to the source scene.
A creator's game need not copy the catalogue. Promote selected code into game-owned folders, preserving notices.
Each canonical header records source, licence, deviations and omitted host features.
Source-only discovery: `npm run htn:run -- --list`, then `--world <stem>/<scenario>` or `--story <stem>/<story>`.
Use installed `htn:check` for game-owned manifests instead.

## Before / after pairs

| Lesson | Before | After |
|---|---|---|
| Tiers, upkeep in `reasoning`, no copied tails (rules 1, 4, 5, 10) | `test/fixtures/reference/stalker_flat.domain` | `stalker/stalker.domain` (its `hunt` tier intentionally needs branch backtracking; see rule 3) |
| The same, small gain (rules 1, 5) | `test/fixtures/reference/guard_flat.domain` | `guard/guard.domain` + `guard/guard_kit.domain` |
| The reason as a fact (rule 6) | `canon/bridge_troll/v5_combo_bug.domain` | `canon/bridge_troll/v5_tired.domain` |
| A guard on every root branch (rule 3) | Space Station 14's unguarded roots, failing in `test/examples/canon/creatures.test.ts` | `canon/creatures/mouse.domain` |
| A tutorial, one change per step (rules 2, 7, 8, 11) | `canon/bridge_troll/`: `v1_priority` → `v2_attack_task` → `v3_rearm` → `v4_last_seen` → `v5_tired` → `v6_partial_plans` | |

## Shape and priority

| Pattern | Where |
|---|---|
| A short root over shared tiers by `:include` | `canon/creatures/{mouse,grazer,pet_follower,hostile_mob}.domain`, `canon/creatures/tiers/` |
| A guard axiom that also picks the target | `canon/creatures/tiers/feed.domain` (`feed_target`) |
| Needs as priority tiers; "obtain X" as ordered alternatives, "already done" first | `canon/villager_day/villager_day.domain` |
| Strategy by what is in hand; prerequisite tiers before the act | `canon/infiltrator/infiltrator.domain` |
| A fix-up ladder: the first obstacle fixed, one fix per plan | `canon/creatures/tiers/melee.domain` |
| Ordered methods for one task by situation (door type × carrying) | `canon/door_helper/door_helper.domain` |
| A goal loop ordered from the stage nearest the goal back to the start | `canon/crafting/ore_to_gold.domain` |

## Beliefs, sensors, host

| Pattern | Where |
|---|---|
| Upkeep in a `reasoning` method run to a fixpoint | `stalker/stalker.domain`, `guard/guard.domain` |
| A mark with a lifetime the host removes, filtering a best-first sensor list | `canon/service_bots/medic_bot.domain` (`recently_treated`) |
| Target choice in a host sensor (best-first rows), the domain only filters | `canon/sentry_turret/sentry_turret.domain`, `canon/classics/hunter.domain` (`path_step`) |
| An unknown fact read as "either", a failure that writes the learned fact | `canon/door_helper/door_helper.domain` |
| A running-plan validator (`active_plan`), one branch per action | `basics/storekeeper.domain` |

## Replanning and the horizon

| Pattern | Where |
|---|---|
| One long step ends the plan; a fact tells the halves apart | `canon/bridge_troll/v6_partial_plans.domain` (`close_in`, `enemy_in_reach`) |
| A sensed change planned past by `&task` | `canon/bridge_troll/v4_last_seen.domain` (`&regain_sight`) |
| A search loop that ends each segment at a perception; a load dropped before a move whose cost depends on it | `canon/fetcher/fetcher.domain` (`!perceive`, `&fetch`, `drop_load`) |
| A task list: the second task deferred | `canon/classics/commuter.domain` (`two_trips`) |
| A path walked one hop per plan | `canon/door_helper/door_helper.domain` |
| A wait loop by a deferred self-call | `canon/soup_kitchen/soup_kitchen.domain` (`&wait_cooking`) |
| What the plan did passed on as a parameter | `canon/infiltrator/infiltrator.domain` (the medikit), `canon/soup_kitchen/soup_kitchen.domain` |
| Re-entrant goal tasks; an already-there first method | `canon/classics/commuter.domain`, `canon/creatures/tiers/{reach,idle,follow}.domain` |
| A continue branch beside its behaviour; `!begin_plan` / `!end_plan` | `canon/sentry_turret/sentry_turret.domain`, `canon/swarm/swarm_drone.domain` |

## Reuse

| Pattern | Where |
|---|---|
| A shared include across root domains | `guard/guard_kit.domain`, `canon/swarm/swarm_shared.domain` |
| `base` / `overrides` as a template | `canon/service_bots/bot_base.domain` + `{medic,cleaner,fire,hug}_bot.domain` |
| A loop as one step, then `&self` | `canon/classics/hunter.domain`, `canon/bridge_troll/v3_rearm.domain` |
| Tail recursion over a list, with a base branch | `canon/arrest_team/arrest_team.domain` (`reserve_all`, `free_all`) |

## Groups

| Pattern | Where |
|---|---|
| A group planner hands out roles as facts; members pick how | `canon/swarm/`, `squad/yard_squad.domain` + `squad/yard_guard.domain` |
| Reservations that survive replans; a barrier step | `canon/arrest_team/arrest_team.domain` |
| A team plan over two agents; one generic action and an exchange table | `canon/soup_kitchen/soup_kitchen.domain` |
| A director over intensity and cooldowns; idle as a successful empty plan | `usecases/director.domain` |

## World consistency before planning

- `canon/soup_kitchen/soup_kitchen.invariants.domain`: one content value per holder, with no global uniqueness rule
  for food types. [World checks](https://github.com/decentraland/sdk7-test-scenes/blob/122a3ff2e87b7e89a6c6ea415eb140dd51716125/scenes/96,-11-htn-planner/docs/htn-world-invariants.md) explains CLI discovery and host-story boundaries.
  This supplements independent expected plans; it does not derive them.
