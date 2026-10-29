# Decentraland participation rewards

Use when proposing or integrating an incentive for feedback. Retain the motivation,
voluntary participation, and recruitment principles in [Planning details](planning-details.md#invite-participation).
Choose a reward with value for this scene's players and an achievable delivery path; these
are design options, not evidence that rewards guarantee more or better feedback.

## Choose a concrete recipe

Describe **what the player receives → qualifying action → implementation prerequisites**.
For example, one submitted answer can unlock a reward while remaining questions and comments
stay optional. Keep every rating value eligible. Disclose visit/persistent scope, expiry,
limits, and claim conditions before participation; retain these terms with the playtest notes.

Check code and exposure paths before calling an attempt unboosted: existing purchases or
unlocks may already affect it. Mark exposure unknown when it cannot be established. Separate
this effect on the measured experience from recruitment/response bias; a small or delayed
reward alone does not establish freedom from bias or rushed answers for this audience.

| Player receives | When it fits and when to award | Implementation prerequisites |
| --- | --- | --- |
| Existing game currency, a material pack, or a retry token | Progression/crafting/arcade game; award once after the advertised qualifying feedback. | Reuse the game's balance/inventory and an actual use for the reward. Choose amount and persistence from that economy. Internal currency is distinct from MANA or platform credits. |
| One next-run coin magnet, hint, or temporary multiplier | A game already supporting that mechanic; unlock after the target feedback, then let the player activate it. | Existing buff/expiry rules, a cap, and authority for shared scores. Keep basic controls/accessibility help available to everyone. Separate boosted observations when comparing experiences. |
| A “Playtest Contributor” scene title or trophy | Social recognition or a scene without an economy; unlock once after a qualifying answer and let the player choose whether to display it. | A visit-only plate above the player's name: `AvatarNametag.createOrReplace(engine.PlayerEntity, { label })`, reapplied from `AvatarBase.onChange(engine.PlayerEntity, …)` and deleted when the avatar leaves ([player-avatar](../../player-avatar/SKILL.md) → Custom Nametag Plates). It is client-local (other players don't see it) and missing on mobile, so keep it decorative. Shared display needs synchronization, durable unlocks need persistence. Describe it as scene recognition, distinct from a platform badge/profile title. |
| Access to a custom dance button or photo-spot emote | Social/art/event scene; a qualifying answer unlocks a player-operated action in this scene. | A compatible, licensed `*_emote.glb`, scene UI/state, and target-client verification. Use [scene-emote docs][scene-emotes] and [player-avatar](../../player-avatar/SKILL.md); author a missing asset through [avatar-animations](../../avatar-animations/SKILL.md) only when scoped. Scene access does not grant an owned emote. |
| An owned wearable or emote collectible | A funded event/playtest with a suitable collection; qualifying participation grants claim eligibility, followed by the Rewards claim flow. | Follow [campaign setup][campaign] and [integration options][claims]: approved mintable collection, authorized minter, stock, funding, active campaign/dispenser, and beneficiary checks. Keep privileged credentials off the client. Distinguish claim eligibility, pending delivery, and confirmed minting. |
| A platform scene badge for contribution | When recognition fits; award verified qualifying participation through the supported badge service. | Discover current support through the [current badge API contract][badges], [award/delegation implementation][badge-awards], and [SDK example][badge-example]. Verify released APIs, target-client/service deployment, scene-owner configuration, identity/delegation and idempotency requirements. The [catalog/presence proposal][badge-catalog] alone does not establish a feedback-award API. |
| A scene-only wearable/outfit unlock | A cosmetic experience where scene-scoped appearance has value; unlock after qualifying feedback. | Discover current support through the [Explorer implementation][scene-wearables] and [SDK example][wearable-example]. Verify current API, released client compatibility, asset loading, synchronization and exit/reset behavior. Explain scene scope separately from collectible ownership. |

## Check capabilities and delivery

For platform-dependent recipes, inspect current official docs, implementation/release notes,
and support on the intended client/backend before choosing an API. Follow linked PRs to their
successors or released documentation where needed: a proposal, merged PR, or special test
build alone does not establish availability for ordinary players. Offer a newly supported
recipe when verified; otherwise use an existing alternative such as a scene-local title.
This check keeps badges, scene wearables, and emotes discoverable as capabilities evolve.

Wire only reward-eligible questions/routes, excluding debug previews. Under the current
[feedback result contract][results], single `ask()` returns one result; grouped `ask()` and
`leaveFeedback()` return arrays. For “one answer” eligibility, look for any `submitted`
result, including text-only answers; Intro acceptance, `skipped`, and `not-shown` are not
answers. For “completed form” eligibility, require a nonempty result list where **every**
result is `submitted`, per shown Group, never accumulated across Groups. Share the reward cap
across gameplay and player-opened routes. A submitted result means the client sent the answer,
not that Storage saved it.

Worked recipe: the module's [participation reward example][reward-example] awards +5 coin
score, x2 on the next 5 pickups and a `Playtest Contributor` `AvatarNametag` for a completed
form, visit-local, no stacking, every rating eligible; Intro acceptance, partial/skipped/
unshown Groups and debug previews don't qualify. Its helper is `src/feedback-reward.ts`.

A visit-only cosmetic can use local unlock state, with its reset scope disclosed. Durable,
shared, or valuable rewards need verified server-side acceptance/eligibility and an
idempotent award/claim record across retries and rejoins; the feedback API supplies no
authenticated durable payout receipt. Use the game's ledger or supported Rewards/backend
flow rather than treating the client result as authority. Validate delivery, duplicate
claims, failures, exhaustion and target-device behavior for the selected recipe.

[scene-emotes]: https://github.com/decentraland/docs/blob/main/creator/sdk7/interactivity/avatars/avatar-animations.md
[campaign]: https://docs.decentraland.org/creator/rewards/getting-started
[claims]: https://docs.decentraland.org/creator/rewards/integrations
[badges]: https://github.com/decentraland/badges/blob/main/docs/openapi.yaml
[badge-awards]: https://github.com/decentraland/badges/pull/235
[badge-example]: https://github.com/decentraland/sdk7-test-scenes/pull/107
[badge-catalog]: https://github.com/decentraland/badges/pull/244
[scene-wearables]: https://github.com/decentraland/unity-explorer/pull/10479
[wearable-example]: https://github.com/decentraland/sdk7-test-scenes/pull/113
[results]: https://github.com/decentraland/sdk7-test-scenes/blob/main/scenes/0,-1-scene-feedback/README.md#queue-and-results
[reward-example]: https://github.com/decentraland/sdk7-test-scenes/blob/main/scenes/0,-1-scene-feedback/EXAMPLES.md#6-a-scene-local-reward-for-participation
