# Choose NPC behavior logic

Read this when selecting a controller, adding behavior variants, or separating NPC decisions from scene integration.
Use the game's actual tasks and a likely next change to explain the choice.

## Choose by the work

| Shape of the behavior | Useful starting point | What would justify another choice |
|---|---|---|
| Fixed path, click response or short scripted sequence | SDK system or NPC Toolkit callbacks | Growing transition or recovery logic needs an explicit controller. |
| Named modes with clear transitions; quest or dialogue progress | FSM; HFSM when modes share transitions or actions | Repeated multi-step methods and related choices become easier to maintain as reusable tasks. |
| Several tasks reuse methods, keep related target/item bindings, or vary by capabilities | Consider HTN alongside a reusable HFSM | Check whether decomposition actually shares useful intent, and whether tooling and integration costs fit. |
| Durable game lifecycle plus flexible task execution | Hybrid: explicit lifecycle with a task controller inside it | Keep one decision owner for each scope and define the events between them. |

Interruptions, many states or several NPCs alone do not select HTN. A well-factored HFSM can share actions
and recover from interruptions. Compare the expected extension in each design, including setup, debugging
tools, recovery and maintenance. An installed HTN module can reduce setup cost; it does not define the game.
For an actual controller comparison, evaluate gameplay results, total runtime work/CPU and effort to add the
same extension together from the first run. Use available measurements and scale new checks to the decision;
a small scoped edit needs no benchmark campaign.
Recommend a controller with the concrete benefit, its integration boundary, a test and a condition for revisiting it.

Keep quest states such as `available → accepted → completed → rewarded` in explicit game-owned state
or a transition graph. Dialogue reads that progress. HTN may choose how an NPC helps with the quest while
the lifecycle keeps reward and persistence rules.

Utility scoring is an optional ranking layer when several eligible tasks, targets or role candidates need
a graded choice. Name who computes scores, what they mean and how valid work is retained. Either an FSM
or HTN can consume the choice; adopting HTN does not supply a utility allocator.

## Check whether task composition helps

For a settlement, restocking a shop and repairing a station might both need `transport(item, destination)`.
A carrier walks with the item; a drone tows it; a mechanic can also repair. Model the relevant capabilities
and temporary readiness separately: being a mechanic does not mean having a tool or being available now.
Keep the selected item and recipient associated through the shared task. A new collection job can reuse
transport without copying every character's policy.

This is a possible game-owned design, not a required NPC framework or built-in fact schema.
If the behavior is mainly a few mode transitions, an FSM/HFSM remains a useful solution.
If shared methods, capability alternatives and bound context drive the choice, load `htn-domain-authoring`
and read [task composition](../../htn-domain-authoring/references/composition.md).
Use its module reference for the installed revision, actual primitives and supported tools.

## Give each layer an owner

| Responsibility | Owner |
|---|---|
| Quest/order progress, inventory, authority, committed role assignments and exclusive claims | Game state and host/task lifecycle |
| Observations, capability/readiness changes and decision-relevant facts | Named sensors or game systems |
| Which task/method or role to propose; priorities and continuation rules | Chosen FSM/HFSM, HTN domain or scoped selector |
| Moving, interacting and reporting actual success/failure; cancellation | Game-owned action executors |
| Mesh/wearables, clip playback, sound and visible motion | Body/visual adapters driven by executors |

Map semantic requests such as walk, carry or greet to the actual asset's clips and SDK operations. Keep playback progress when
the same loop is requested again. Respect [AvatarShape limits](avatar-shape-npcs.md) when choosing the body.
Toolkit and AvatarShape need game-owned adapters for HTN; integration is not automatic.

Give Transform movement/rotation one owner at a time; coordinate Toolkit paths, tweens and `faceUser`.
Bind a stable target identity when the intent is to follow that target, and read its current position in
the movement executor. A moving target need not become a new task each frame. Define arrival, loss of
target and blocked movement from actual observations; refreshing failure/eligibility knowledge can enable
recovery. Choose retry or another task according to the cause and when that knowledge becomes stale.

## Cooperating NPCs

For shared work, describe a role with its context: for example, `hold gate(gateId, transportTaskId)`
and `transport(caseId, destinationId, helperId)`. Name the assignment owner and how members report progress.
Filter candidates for capability, availability, relevant knowledge and current validity before any optional
ranking. Keep a useful assignment stable, and define when it becomes invalid or another assignment wins.

The host must arbitrate exclusive helpers/resources and claim them before competing work can take them.
For success, interruption, failure, lost relevance or participant removal, identify who preserves, transfers
or releases the obligation. Cleanup belongs to the owning lifecycle even if remaining plan steps are discarded;
repeated or late cleanup must not release a newer owner's claim.
For HTN implementation and shared-host stories, follow the
[host contracts](../../htn-domain-authoring/references/module-reference.md#host-contracts-to-carry-into-game-integration)
and [composition examples](../../htn-domain-authoring/references/composition.md).

Several NPC controllers can cooperate through that protocol. A shared snapshot or several HTN agents
does not provide a concurrent joint planner. Use the installed movement/pathfinding implementation;
verify feature support before proposing utility allocation, effect simulation or automatic plan repair.

## Check the choice in the game

Set expected outcomes before running a relevant scenario: normal completion, partial work after interruption,
an invalid target or failed action, and cleanup/re-entry where the task needs them. For variants, exercise a
new capability or task using the shared method. For groups, include an ineligible candidate, contention and
participant loss; verify useful progress and released obligations, not just absence of exceptions.
Check the real body/executor when claiming scene integration; headless controller tests do not prove visible motion.
Revisit the architecture when the next actual extension exposes duplicated policy, fragile recovery or measured cost.

## Sources and scope

These are applied design lenses, not promises that the SDK port includes the source games' systems.

- Tim Verweij, [A hierarchically-layered multiplayer bot system](https://www.guerrilla-games.com/media/News/Files/VUA07_Verweij_Hierarchically-Layered-MP-Bot_System.pdf), §§7.1.2, 7.4.1: state transitions can be implemented without a planner; generic tasks were a proposed extension with tradeoffs.
- Straatman et al., [Hierarchical AI for Multiplayer Bots in Killzone 3](https://www.gameaipro.com/GameAIPro/GameAIPro_Chapter29_Hierarchical_AI_for_Multiplayer_Bots_in_Killzone_3.pdf), §§29.3–29.4: assignments, individual task decisions and lower-level execution have separate duties.
- Guerrilla, [The AI of Horizon Zero Dawn](https://www.guerrilla-games.com/media/News/Files/The-AI-of-Horizon-Zero-Dawn.pdf), PDF pp22–26: roles carry context; candidate suitability and optional ranking are distinct from carrying out the role.
- For this port's execution, failure and shared-task contracts, use the matching public/local guides through [module-reference.md](../../htn-domain-authoring/references/module-reference.md); source-game architecture does not establish port features.
