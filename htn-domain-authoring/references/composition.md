# Compose tasks, capabilities and roles

Read this when adding a character variant, sharing behaviour between goals, or coordinating agents.
For the choice between SDK actions, FSM/HFSM, HTN and hybrids, use
[NPC behaviour selection](../../npcs/references/behavior-selection.md).

## Share intent, vary the method

Name the reusable result (`transport item to destination`), then choose its method from capabilities and
current context. A courier delivering an order and a worker restocking a station can call the same task.
Keep their goal priorities and completion handling in their callers. Adding `state_X` facts for every old
state does not by itself demonstrate useful composition; exercise a second caller or character variant.
A short reactive behaviour can remain short.

This original fragment chooses carry before tow when both are possible:

```lisp
// Contract: fresh transport request; item and destination identities are fixed.
// Successful executors reach the destination and release the item; failure aborts the sequence.
(:method (transport ?inp_item ?inp_to)
  (carry (and (capability carry) (portable ?inp_item))
    ((!pick_up ?inp_item) (!move_to ?inp_to) (!put_down ?inp_item ?inp_to)))
  (tow (and (capability tow) (towable ?inp_item))
    ((!attach ?inp_item) (!tow_to ?inp_item ?inp_to) (!detach ?inp_item))))
```

These primitives are game-owned executors, not built-ins. The sequence assumes successful earlier actions;
decomposition neither executes them nor proves arrival. Production callers must cover the reachable partial-work
states from rule 8. Put capability/target eligibility in the entry guard too, preferably in an axiom shared with
the selected task: see `canon/creatures/tiers/feed.domain` (`feed_target`). A failed child cannot reopen the
already selected guard to try another target (rule 3).

Choose the existing reuse mechanism that fits: a parameterized task for one result, an axiom for eligibility,
`:include` for shared behaviours, or `base` / `overrides` for a family of variants.
Read `canon/service_bots/bot_base.domain` with one bot variant, or the creatures' shared tiers;
[examples.md](examples.md) resolves their source paths.

## Keep context explicit

Pass a selected item, target, role context or known intended destination as parameters when later steps use
that same choice. Parameters carry a decision; they are not proof that an action succeeded. A later choice
that needs its actual result or a new observation belongs after `&task` or in the next plan (rule 7).
Keep shared world facts truthful throughout search.

For live targets, prefer stable identities when executors can read current position themselves.
Define target ranking and tie handling where the game owns selection; a first-match list is only a ranking
if the sensor/host maintains that order. Reordering an unordered fixture must not silently change a claimed
nearest, safest or otherwise preferred target. Test the intended selection rule rather than arbitrary identity.

## Assign roles, then execute locally

For cooperation, separate these responsibilities:

| Concern | Model / owner |
|---|---|
| Suitability | Capabilities, knowledge, availability and relevant context; facts/queries with named writers |
| Assignment | Host/coordinator selects a member and publishes role plus context, such as collector + resource ID |
| Local execution | Member's domain chooses how to fulfil the role using shared tasks and its capabilities |
| Retention and exit | Owner keeps useful assignments and communicates achieved, impossible or no-longer-needed outcomes |

Use `canon/swarm/swarm_coordinator.domain` with `swarm_drone.domain` for stable roles and handover;
use `squad/yard_squad.domain` with `yard_guard.domain` for orders consumed locally.
A role fact does not implement scoring or allocation. If ranking, quotas or fairness are needed, implement and
test that game-owned policy; this module supplies no generic utility allocator or joint concurrent planner.
For shared claims or waiting teammates, also define participant-loss/cancellation cleanup and notify affected
members through actual host facts/events. Follow the [host ownership contracts](module-reference.md#host-contracts-to-carry-into-game-integration)
and test progress/termination for every participant.

## Source ideas and limits

This is an application to the SDK module, not a port of another AI stack.
Tim Johan Verweij's [HTN Planning in Decima (2024)](https://www.guerrilla-games.com/read/htn-planning-in-decima),
slides/notes 11 and 27–31, motivates parameterized plan context and role-specific behaviour.
Milind Tambe's [Towards Flexible Teamwork (1997)](https://arxiv.org/abs/cs/9709101), STEAM team-operator
termination discussion, motivates shared exit knowledge. Its joint-intention machinery is not supplied here.
