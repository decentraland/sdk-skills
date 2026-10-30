# Decentraland services and publishing — design reference

**Integrated from the source review on 2026-10-26.** Official docs
are pinned to [5a25e287](https://github.com/decentraland/docs/tree/5a25e287f0440486196afa2bb3067608249547a8);
API pages below were inspected as published on that date and have no Git revision assigned here.
These are documentation and code findings, not a client test or a complete compatibility check.
A service description establishes what is documented;
creator access, integration and the intended client's support may still need a focused check.
Apply the [reuse rule](../platform-fit.md#reuse-the-platform-answer-before-researching-it-again)
when that difference matters. Keep unresolved conflicts with the answer.

For implementation or a disputed service condition, load the relevant section of
[implementation notes](platform-implementation-notes.md); this page keeps the design consequences.
For voice, shared game state and HTN, reuse the
[capability reference](dcl-capability-links.md). For input, avatar/camera control,
media and mobile detail, use [scene capabilities](scene-capabilities.md).

## Progress between visits and scenes

**Useful answer:** returning players can have saved progress without turning every reward into
an NFT. The documented Multiplayer Server supplies persistent World and Player Storage across
restarts and redeploys. Storage is server-only and location-scoped, not a universal inventory
across unrelated scenes. Saves can fail, and old progress must remain readable after updates.
Choose meaningful checkpoints and a recovery path. The current server setup has specific SDK/runtime
requirements; see [persistence and authority](platform-implementation-notes.md#persistence-and-authority)
for setup, write handling and sources.

For a shared resource race or ranked round, a server can check who acted, the phase, proximity
and remaining resources before changing shared state. Hosting alone does not supply these rules.
The source-inspected Gem Rush example is a candidate for contested pickups, rounds and checkpoint
saves; a crash can lose a round, and separate player saves do not guarantee an all-or-nothing
result. Source inspection has not established production fairness. Use the
[implementation candidate](platform-implementation-notes.md#persistence-and-authority) when building it.

For shared progression across scenes, a common external backend is another candidate. Scenes
can call external services and authenticate a player session. A recognized player is not proof
of a valid score or achievement; game validation remains part of the design. See
[external requests](platform-implementation-notes.md#external-requests-and-authentication) for the route and sources.

Choose from the design need: what must survive leaving, who may change it, whether another
scene reads it, and whether cross-device recovery matters. Then identify storage, identity and
validation together. A saved checkpoint, live shared state and an account system solve different
problems. A common backend needs its own schema and integration; an existing platform service
can reduce work without eliminating it.

Design uses include a workshop that keeps its repairs, a personal chapter checkpoint or an
unlocked tool on return. Store the small state that represents that promise, then restore it
through the chosen server/backend. Saving a room does not require keeping its simulation running.

## External services and live data

SDK scenes can use external data for a shared challenge schedule, a changing resource price or a
community contribution total, if the chosen service exposes it. Give players a clear loading and
failure state, and decide what happens when the feed is slow or unavailable. A stale value should
not silently decide a competitive result. An authenticated request still needs game-rule checks;
service access, limits and ongoing operation depend on the integration. Implementation:
[external requests and authentication](platform-implementation-notes.md#external-requests-and-authentication).

## Public state, private information and server availability

**Hidden roles or private hands:** a server can keep the secret and send each player only what
they need. Hiding a HUD does not protect a secret already sent to every player. The documented
server routes make this a design candidate, not an audited secrecy guarantee. Check what reaches
each client before promising hidden information. Route and source:
[private information](platform-implementation-notes.md#private-information).

**Persistent progress does not require continuous simulation.** The documented server starts
when visitors arrive and sleeps after they leave. Production arrival may need a waiting activity
or clear loading state; connected players may still be waiting for game logic to become ready.
For growth or timers between visits, saving timestamps and applying elapsed progress on return
is a candidate, not proof of an always-running server. Storage, authority and availability are
separate decisions. Timing guidance and readiness handling:
[server availability](platform-implementation-notes.md#server-availability-and-deployment-versions).

**Updates can split a gathering temporarily.** Existing visitors can stay on the old version
while new arrivals enter the new one. For a scheduled tournament, plan an update window or a
clear rejoin step so the group meets in one version. Saved progress is shared across these
versions, so compatibility and overlapping changes need a plan. Implementation and source:
[deployment versions](platform-implementation-notes.md#server-availability-and-deployment-versions).

## Identity and rewards

**Useful answer:** the player arrives with platform identity and avatar data. A guest identifier
and wallet identity serve different purposes; blockchain actions require the wallet identity.
The reviewed sources do not establish today's guest recovery, migration or purchase retention
policy. Check the proposed login and claim flow before promising recovery. Source and data access:
[identity](platform-implementation-notes.md#identity-and-reward-delivery).

Use player data for a named roster, an invitation to take an empty role or a welcome reflecting
the avatar; update the roster when players arrive or leave. The role and its permissions belong
to game state, not the displayed name. Route:
[player data and events](platform-implementation-notes.md#identity-and-reward-delivery).

If a reward depends on ownership, separate temporary play identity, persistent account identity
and ownership of the item. Check the specific login/claim flow before promising recovery or
excluding guests. Ordinary game motivation can remain useful even when an NFT claim is unavailable.

Foundation Rewards Service is a documented route for delivering wearables and emotes, with
transaction handling and anti-abuse checks. Verify campaign/collection access and recipient
requirements for the proposed reward. It is not a ready-made game economy or proof that a player
completed the challenge. Route and source:
[reward delivery](platform-implementation-notes.md#identity-and-reward-delivery).

A visible completion souvenir or an emote earned during a community event can connect a game
achievement to something players show elsewhere. Configure a reward campaign and connect its
claim to the game's validated completion rule; the service handles delivery, not that rule.
Keep the playable reward useful even when a particular player cannot claim the external item.

Reward delivery needs an eligible campaign, collection, stock and delivery setup. Keep assignment,
claim and delivery outcome separate: a requested souvenir may still be pending or fail. Organizer
campaign permissions differ from a configured scene/server claim route. Check recipient and
campaign conditions before promising the item. Setup, permissions and sources:
[reward delivery](platform-implementation-notes.md#identity-and-reward-delivery).

Wearables can carry visible ownership beyond a scene; they are not the only possible form of
cross-scene progress. Keep their role in the game explicit instead of adding them for platform fit.

## Publishing, access and population

**Useful answer:** Genesis City places the scene on a shared public map; a World provides a
separate destination. LAND deployment may use ownership, rental or permission from an owner.
World deployment and private access have their own permissions. These choices affect arrival,
neighbours, control and operating commitments, not only scenery.
[Sources: Publishing Options](https://github.com/decentraland/docs/blob/5a25e287f0440486196afa2bb3067608249547a8/creator/sdk7/publishing/publishing-options.md),
[Worlds API Overview](https://docs.decentraland.org/apis/apis/worlds/overview).

A World can hold a destination game reached by a link or a private group session; a LAND scene
can use its chosen city location as part of arrival. Follow the creator's chosen setting and the
[Worlds-first design default](../platform-fit.md#worlds-first-design). Implementation is deployment
plus access configuration, not an in-game matchmaking system. An entry link does not guarantee
that a party shares the intended instance or game state; establish those rules separately.

For an invited rehearsal or closed group event, a World can use access permissions separately
from publishing and streaming permissions. The owner configures admission; arbitrary scene code
does not inherit this authority. Private entry and secret per-player information are different
requirements. Administration route: [World access](platform-implementation-notes.md#world-access-and-publishing).

Community-based admission can let an existing club enter a World. Ownership and community
membership conditions apply to configuring it; club membership and the game's team/role state
remain separate. Collaborators can also receive publishing access to particular parcels.
Admission control does not make deployed assets secret. Conditions and sources:
[World access](platform-implementation-notes.md#world-access-and-publishing).

**Population has several boundaries.** The reviewed Publishing and communication-service sources
have different capacity wording; neither establishes the target World's playable capacity.
Choose party size from the activity, then check admission, shared-state scope, server load and
client rendering separately. A group-only game can be intentional; group isolation remains a
route to investigate, while a universal ready-made party-instance API has not been established.
Use [groups and private sessions](dcl-capability-links.md#groups-and-private-sessions) for the
design route and [population evidence](platform-implementation-notes.md#population-and-presence)
for the source difference.

A World can organize a hub and several chapters. Its storage allowance depends on the ownership
route, so check the relevant quota when it affects scope. Publishing can replace existing content
or add separate locations; choose the route that preserves the intended destination and returning
players' progress. Setup and source:
[World publishing](platform-implementation-notes.md#world-access-and-publishing).

For a hub with several chapters, give each transition a clear destination and wait for it to be
ready. One World name does not supply party matchmaking or a shared save. Players may still
receive a previous working version while a new release is being prepared; an upload confirmation
alone is not a release check on the intended client. Implementation:
[multi-scene publishing and release checks](platform-implementation-notes.md#world-access-and-publishing).

Multiple scenes can be a candidate for a hub and separate activity areas. Give each transition
a clear destination and decide which progress travels with the player; shared progression still
needs the storage route above. Scene count is a content organization choice, not proof of isolated
matches or unlimited simultaneous players.

Custom hosting can serve a controlled test or a particular service setup. Follow Publishing's
custom-server route and establish how invitees enter the destination; ordinary discovery and
Foundation reward validation may differ there. For release, follow current metadata,
content-policy and publishing guidance; this reference has not audited content ratings or
moderation policy.

## Discovery and reasons to return

**Useful answer:** Events, Places and Communities provide different starting points. An event
can give players a reason and time to return; the documented RSVP flow sends an in-world alert
when it starts. Event listings and map markers are entry points, not guaranteed traffic.
[Source: Finding Events](https://github.com/decentraland/docs/blob/5a25e287f0440486196afa2bb3067608249547a8/player/decentraland-in-world/finding-events.md).

For a scheduled team challenge, the creator can submit an event with a clear activity, time and
destination; players use the event page and RSVP flow. This is an organizer/player workflow,
not a scene command that forces attendance. Connect that entry to a playable first moment and
use [acquisition](../acquisition.md) for the wider audience route.

For a weekly tournament, the Events API documents recurring listings and community links.
Organizer authorization and approval conditions apply. RSVP records intent, not verified play;
keep the event schedule separate from the game's round timer and use game participation evidence
for completion rewards. Route and sources:
[event operations](platform-implementation-notes.md#events-and-social-operations).

Places uses scene metadata for its presentation. Significant identity changes can lose accumulated
likes/favourites. **World listing has conflicting documentation:** Places FAQ ties eligibility
to NAME ownership plus LAND or rental; Publishing says Worlds are listed automatically with an
opt-out. Check the target World's current eligibility before making listing a necessary part of
an acquisition plan. Keep the conflict explicit rather than promising either universal inclusion
or exclusion. [Sources: Places FAQ](https://github.com/decentraland/docs/blob/5a25e287f0440486196afa2bb3067608249547a8/player/faqs/places.md),
[Publishing](https://github.com/decentraland/docs/blob/5a25e287f0440486196afa2bb3067608249547a8/creator/sdk7/publishing/publishing.md).
Use an eligible listing as a recognizable return destination: keep its identity and entry promise
consistent when updating scene metadata. A listing is a discovery surface, not the game's
onboarding or a measurement of conversion.

Communities, friends and private messaging can help players organize sessions. A club can
coordinate membership, posts, invitations and linked places; admission and listing visibility
are separate settings. Platform notification services are also documented, but service access,
consent and client support need checking for the proposed use. Organizer and player tools do not
automatically give scene code the same permissions. In-scene guild rules and notifications need
their own implementation. Route and sources:
[social operations](platform-implementation-notes.md#events-and-social-operations).

For a hosted tournament or live show, authorized owners/admins have documented routes for
managing scene admins, bans and stream access. Check the operator's role and the chosen place.
Private/community voice has separate authorization conditions. Use the specific
[event-operation route](platform-implementation-notes.md#events-and-social-operations) for the integration.

Keep useful leads: Marketplace Credits, profile Badges, Exploration Games, Foundation campaigns
and featuring may support rewards, onboarding or discovery. Their existence does not establish
open studio administration, available campaign places, or suitability for custom progression.
Find the relevant API and current operator requirements before depending on them. Old seasonal
numbers and promotional claims are not stable design constraints.
Treat these as conditional routes: identify who can configure the offer,
what the player receives and the route into this game before including one in the plan.
Keep their different questions separate:

- **Marketplace Credits:** a possible purchase incentive through an approved studio campaign;
  access, budget and recipient conditions apply.
- **Profile Badges:** possible platform recognition; custom game achievements need their own
  issuance agreement or saved progress.
- **Exploration Games:** a possible discovery trail with operator participation and a defined
  arrival location.
- **Foundation campaigns:** establish current participation, timing and delivery responsibility.
- **Featuring:** establish the selection route and entry destination; audience is not guaranteed.

For program-specific APIs, units and permissions, read
[conditional incentive programs](platform-implementation-notes.md#conditional-incentive-programs).

## Portable experiences and smart wearables

**Design possibility, support unresolved:** a portable companion or item-triggered side activity
could accompany a player between places. The documented route uses a separate portable or
smart-wearable project, with its own effects and communication limits. Setup:
[portable project types](platform-implementation-notes.md#portable-project-types).

**Current conflict:** Portable Experiences warns that the latest Decentraland versions do not
support them. Smart Wearables still documents SDK7 creation, preview and publication. That guide
also limits effects and communication; a wearable does not automatically give every nearby
player the same experience.
[Sources: Portable Experiences](https://github.com/decentraland/docs/blob/5a25e287f0440486196afa2bb3067608249547a8/creator/sdk7/projects/portable-experiences.md),
[Smart Wearables](https://github.com/decentraland/docs/blob/5a25e287f0440486196afa2bb3067608249547a8/creator/sdk7/projects/smart-wearables.md).

A design depending on a portable effect has an unresolved current-client dependency. Keep the
intended experience, identify the target release and check support or a proposed workaround.
The tutorial alone cannot prove it works today; the warning does not establish a permanent
ban on the idea. An effect inside the creator's own scene may be an alternative, with a different
scope that the creator should understand.

## Mobile and implementation routing

The current mobile overview links iOS and Android clients, missing features, touch input, safe
areas, device preview and performance guidance. It also separates publication from mobile
Discover and iOS curation. Choose the relevant path for the audience; desktop success does not
prove touch playability. [Source: Mobile Overview](https://github.com/decentraland/docs/blob/5a25e287f0440486196afa2bb3067608249547a8/creator/build-for-mobile/mobile-client/overview.md).
For a short touch-friendly session, choose large, readable actions and an arrival flow that works
on the intended phone. Use the scene's touch controls and adaptive UI described in
[scene capabilities](scene-capabilities.md), then preview that interaction on the target client.
Availability in a store or discovery surface and playability of the action are separate checks.

Use current per-client guidance when load time, media or crowd size affects the game. A content
budget and measured frame rate answer different questions; more parcels do not guarantee smooth
play. [Source: Performance Optimization](https://github.com/decentraland/docs/blob/5a25e287f0440486196afa2bb3067608249547a8/creator/sdk7/optimizing/performance-optimization.md).
If a crowd scene or repeated prop is central to the idea, budget and profile a representative
space before expanding its content. The optimization guide is the implementation route; a smaller
visual sample can answer a performance question without shrinking the intended game by assumption.

For implementation, load the available official SDK skill for the affected area, then its current
docs. For uncertain scene-callable actions, follow the
[runtime module and permission references](https://github.com/decentraland/docs/blob/5a25e287f0440486196afa2bb3067608249547a8/contributor/runtime/overview.md)
and target-client implementation. API naming, documentation and runtime verification are separate
evidence. Resolve the remaining dependency rather than repeating the whole platform survey.

Permission advice depends on the application type: ordinary LAND/World scenes and portable or
wearable projects have different conditions. An old permission list alone does not settle an
action's availability on the intended client. Route:
[runtime permissions](platform-implementation-notes.md#runtime-permissions).

## Priority gaps to refresh when needed

- Eligibility and available credentials for the selected service integration; notification consent/client support.
- Current World listing eligibility where the primary sources conflict.
- Guest identity recovery and the exact purchase/reward flow being proposed.
- Portable support in the target release; mobile support for the game's essential actions.
- Storage lifecycle and migration for the chosen location/backend; current quotas and policy at release.

Record the specific answer, source, date and remaining condition in the project's research.
A useful workaround remains a candidate until its own dependency is checked.
