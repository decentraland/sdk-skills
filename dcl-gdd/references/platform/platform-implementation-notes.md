# Platform implementation notes

Use the relevant section when implementing a service or checking a disputed condition. For the
player possibility, design use and consequences, start with
[services and publishing](dcl-platform-facts-2026-08.md). This is the technical evidence layer,
not another platform survey to load during brainstorming.

Evidence remains documentation
and source inspection, not a client test or security audit. Official docs are pinned to
[5a25e287](https://github.com/decentraland/docs/tree/5a25e287f0440486196afa2bb3067608249547a8);
published API pages were inspected on 2026-10-26 without a Git revision assigned here. Preserve
client/version qualifiers and unresolved source conflicts. Apply the
[reuse rule](../platform-fit.md#reuse-the-platform-answer-before-researching-it-again)
to separate established inputs from remaining questions or reproducible failures.

## Persistence and authority

Design context: [services and publishing](dcl-platform-facts-2026-08.md#progress-between-visits-and-scenes).

The documented Multiplayer Server supplies persistent World Storage and Player Storage,
with data surviving restarts and redeploys. Its current setup requires the SDK/runtime
`auth-server` branch and `authoritativeMultiplayer` metadata. Storage is server-only and location-scoped; Player Storage is not a
universal account inventory shared by unrelated scenes. Checkpoint writes need failure handling.
[Source: Multiplayer Server, Data Storage](https://github.com/decentraland/docs/blob/5a25e287f0440486196afa2bb3067608249547a8/creator/sdk7/networking/authoritative-servers.md).

For a shared resource race or ranked round, clients can send action requests and the server can
check phase, sender, proximity and remaining resources before changing synced state. Use
`context.from` and server-side `PlayerIdentityData`, with validators for protected components;
hosting alone does not supply these game rules. The source-inspected
[Gem Rush server](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/92,-9-authoritative-server-gem-rush/src/server/server.ts)
is a candidate for adapting rounds, a contested pickup and checkpoint saves on the `auth-server`
branch. Its rules are custom code; a crash can lose the current round, and separate player writes
are not an atomic transaction. Source inspection has not established production fairness.

Keep active state in memory and save at meaningful checkpoints. Storage writes return `false`
on failure; retain pending changes and retry. The documented server runtime shares a 40-call
in-flight budget across host APIs, so bursts of saves and external calls need scheduling.
This is a server-runtime condition, not a universal client SDK limit. Version saved objects:
old progress survives deployment and can reappear months later.

## External requests and authentication

Design context: [services and publishing](dcl-platform-facts-2026-08.md#external-services-and-live-data).

SDK code can use REST requests or WebSockets with an external backend, including one serving
several scenes. Use asynchronous requests with loading/failure handling. Signed Fetch can
authenticate the player session; the receiver validates the signature and request age.
Authentication does not validate scores or other game rules. Check the selected service's
exposed data, access, rate limits and operating requirements. Source:
[Network Connections](https://github.com/decentraland/docs/blob/5a25e287f0440486196afa2bb3067608249547a8/creator/sdk7/networking/network-connections.md).

## Server availability and deployment versions

Design context: [services and publishing](dcl-platform-facts-2026-08.md#public-state-private-information-and-server-availability).

The documented server starts
when visitors arrive and sleeps after they leave; production startup differs from instant local
preview. The guide describes roughly two minutes before shutdown and about 15 seconds for a
production cold start; these are dated guidance, not a service guarantee. A fresh server heartbeat
or ready message helps distinguish transport synchronization from initialized game logic. Provide
an arrival state, then retry initial requests. For elapsed-time progression, store timestamps
and reconcile them on return rather than assuming continuous simulation. Source:
[Multiplayer Server](https://github.com/decentraland/docs/blob/5a25e287f0440486196afa2bb3067608249547a8/creator/sdk7/networking/authoritative-servers.md).

**Updates can split a gathering temporarily.** The guide pairs each deployment hash with its
own server: existing visitors remain on the old version while new arrivals load the new one.
Persistent location storage is shared across these versions; schema compatibility
and overlapping writes still need a design. See [publishing new versions](https://github.com/decentraland/docs/blob/5a25e287f0440486196afa2bb3067608249547a8/creator/sdk7/networking/authoritative-servers.md#publishing-new-versions).

## Identity and reward delivery

Design context: [services and publishing](dcl-platform-facts-2026-08.md#identity-and-rewards).

`getPlayer()`
distinguishes a wallet address from a locally generated guest identifier; blockchain operations
need the actual public key. This does not establish today's guest-account recovery, migration
or purchase retention policy. [Source: User Data](https://github.com/decentraland/docs/blob/5a25e287f0440486196afa2bb3067608249547a8/creator/sdk7/interactivity/user-data.md).

`getPlayer()` supplies in-scene profile data; scene entry/exit
events keep the roster current. The role and its permissions still belong to game state, not to
the displayed name. Implementation: `player-avatar` and [User Data/event guidance](https://github.com/decentraland/docs/blob/5a25e287f0440486196afa2bb3067608249547a8/creator/sdk7/interactivity/user-data.md).

Foundation Rewards Service handles HTTP delivery of wearables/emotes, transactions and anti-abuse
checks, not game completion validation. [Rewards Overview](https://github.com/decentraland/docs/blob/5a25e287f0440486196afa2bb3067608249547a8/creator/rewards/overview.md).
The creator setup uses an approved mintable collection, campaign stock, minting permission and
an enabled dispenser/key; delivery also depends on funding and campaign conditions. A scene or
server can request a reward through the configured claim route. Track assignment, claim and
transaction outcome separately so the UI can show a pending souvenir without claiming it arrived.
Wallet-signed campaign management and configured dispenser requests are different permissions.
See [campaign setup](https://github.com/decentraland/docs/blob/5a25e287f0440486196afa2bb3067608249547a8/creator/rewards/getting-started.md),
[reward requests](https://docs.decentraland.org/apis/apis/rewards/rewards.md) and
[claims](https://docs.decentraland.org/apis/apis/rewards/claims.md) (API snapshot 2026-10-26).

## World access and publishing

Design context: [services and publishing](dcl-platform-facts-2026-08.md#publishing-access-and-population).

Current Publishing documents multi-scene Worlds and a storage budget based on wallet holdings;
ENS Worlds use a separate fixed budget. Refresh exact prices and quotas when they influence
scope. Deployment mode matters: the ordinary CLI World deployment can replace an existing scene,
while multi-scene deployment supports distinct locations. Plan update continuity and storage
migration when players return to a changing game.
[Source: Publishing](https://github.com/decentraland/docs/blob/5a25e287f0440486196afa2bb3067608249547a8/creator/sdk7/publishing/publishing.md).

Sources: [Worlds API](https://docs.decentraland.org/apis/apis/worlds/overview) and
[Publishing](https://github.com/decentraland/docs/blob/5a25e287f0440486196afa2bb3067608249547a8/creator/sdk7/publishing/publishing.md).

For an invited rehearsal or closed group event, the Worlds API documents access permissions
separately from deploy/stream permissions. The owner configures the World's permissions through
the documented API; most write operations require signed owner authorization. This is a creator
administration route, not permission for arbitrary scene code to change who may enter. Private
access and private per-player game information remain different requirements.

The API also documents community-based access allow-lists: a creator can use an existing club
as the admission group instead of maintaining only individual addresses. World ownership is
required to change this configuration; adding a community also requires allow-list access mode
and a signer who belongs to that community. Membership and the game's team/role state are
separate. Deployment permissions may cover specific parcels, useful when collaborators build
different activity areas. See
[Worlds Content Server permissions](https://docs.decentraland.org/apis/apis/worlds/content-server.md#add-community-to-access-allow-list)
(published API, checked 2026-10-26). Admission control does not make deployed asset files secret.

The CLI's documented multi-scene route uses `--multi-scene` and distinct coordinates. For a
hub with several chapters, keep World identity and the destination scenes clear: in a multi-scene
World, World-level metadata is managed separately in Creator Hub. Verify the actual destination
and readiness on arrival; one World name does not supply party matchmaking or a shared save.
Publishing also describes conversion to platform asset bundles: players can receive the previous
working version until conversion completes. An upload confirmation alone is not a release check
on the intended client.

## Population and presence

Design context: [groups and private sessions](dcl-capability-links-2026-08.md#groups-and-private-sessions).

**Scope/evidence:** the published
[Archipelago overview](https://docs.decentraland.org/apis/apis/archipelago-workers/overview.md)
and [Stats Service](https://docs.decentraland.org/apis/apis/archipelago-workers/stats-service.md),
inspected 2026-10-26, describe the migration to Pulse. Pulse publishes uncapped `C{n}` islands;
Gatekeeper maps each island to one LiveKit room without another split. `maxPeers = 0` means
uncapped in this topology, replacing the older value 100. This documents a service architecture,
not the tested capacity or compatibility of Unity, Godot, Bevy or a custom game server.

Uncapped comms does not establish one global game state, unlimited rendering or unlimited
authoritative-server resources. Match membership and late joins need explicit game rules;
use the linked design context to choose what the group actually needs.

**Attendance tools:** public Stats and hot-scene reads can support an organizer's activity board
or help choose a meeting place. Treat them as approximate observations: peers without heartbeats
may be missing, and `core-status.userCount` retains its last value when unhealthy. Use the game's
own validated roster for admission, scoring and completion; a comms count is not match evidence.
Publishing's separate 100-user World wording remains a source conflict to resolve for the selected
host, rather than a reason to promise either universal capacity or exclusion.

The conflicting World wording is in [Publishing Options](https://github.com/decentraland/docs/blob/5a25e287f0440486196afa2bb3067608249547a8/creator/sdk7/publishing/publishing-options.md).

## Events and social operations

Design context: [services and publishing](dcl-platform-facts-2026-08.md#discovery-and-reasons-to-return).

For a weekly tournament, the published [Events API](https://docs.decentraland.org/apis/apis/events/events.md)
documents recurrence and community links, with wallet-authorized organizer operations and
approval conditions for new listings. [RSVP/attendees](https://docs.decentraland.org/apis/apis/events/event-attendees.md)
records intent, not verified play. Keep event scheduling separate from the game's round timer
and use game participation evidence for completion rewards (API snapshot 2026-10-26).

The platform's service map documents Communities, friends and private messaging, plus in-app,
email and mobile/desktop notification infrastructure. Use these as player and organizer routes:
a club can coordinate sessions through membership, posts, invitations and linked places. Public
versus private admission and listed versus unlisted visibility are separate settings. The published
[Social authentication](https://docs.decentraland.org/apis/apis/social-service/authentication.md)
and [Communities](https://docs.decentraland.org/apis/apis/social-service/communities.md) pages
(checked 2026-10-26) require user-wallet authorization for user actions and explicitly reject
scene-based requests; administrative bearer access is a separate role. An authorized companion
tool is a possible integration route. In-scene guild rules and notifications need their own
implementation rather than inheriting platform-service permissions.
[Source: Backend Services](https://github.com/decentraland/docs/blob/5a25e287f0440486196afa2bb3067608249547a8/contributor/architecture/services.md).
For regular group sessions, a creator-managed community can coordinate the time and joining
instructions while the scene handles roles and the activity itself. Keep a manual communication
route until a suitable authorized automation is established; service names alone do not provide it.
Friends and private messages may help players arrange a party through the client. Do not assume
the game can read a friendship graph, import a party or message a player through those services.

For a hosted tournament or live show, authorized owners/admins have a more concrete integration:
Gatekeeper documents scene Signed Fetch for
[scene admins](https://docs.decentraland.org/apis/apis/comms-gatekeeper/scene-administration.md),
[bans](https://docs.decentraland.org/apis/apis/comms-gatekeeper/scene-bans.md) and
[stream access](https://docs.decentraland.org/apis/apis/comms-gatekeeper/scene-stream-access.md).
These can support event operations after ownership/admin and current place metadata checks.
Private/community voice uses a separate service authorization route; select the specific
endpoint and operator role rather than treating all social APIs as one scene interface.

## Runtime permissions

Design context: [services and publishing](dcl-platform-facts-2026-08.md#mobile-and-implementation-routing).

Keep the application type with permission advice. The
[scene metadata guide](https://github.com/decentraland/docs/blob/5a25e287f0440486196afa2bb3067608249547a8/creator/sdk7/projects/scene-metadata.md#permissions)
applies `requiredPermissions` to portable experiences and smart wearables; ordinary LAND/World
scenes are a different case. An old permission list alone does not decide whether their action
is available in the target client.

## Conditional incentive programs

Design context: [services and publishing](dcl-platform-facts-2026-08.md#discovery-and-reasons-to-return).

- **Marketplace Credits:** a purchase incentive has a concrete
  [Studio operator route](https://docs.decentraland.org/apis/apis/credits-server/studio-operators.md)
  for an assigned operator, an enabled studio budget and an eligible recipient. Seasonal goal
  credits and Studio/on-demand grants have different units and conditions; check the chosen
  branch. This supports an approved campaign, not an automatically available game currency.
- **Profile Badges:** [definitions and progress](https://docs.decentraland.org/apis/apis/badges/overview.md)
  can support recognition around platform activities. Badge processing is event-driven platform
  infrastructure; a custom scene achievement still needs its own issuance agreement or game save.
- **Exploration Games:** [games](https://docs.decentraland.org/apis/apis/exploration-games/games.md)
  and challenge creation are admin routes. For a discovery trail that leads into the game,
  establish operator participation and arrival location before depending on a custom mission.
- **Foundation campaigns:** if considering an organized acquisition event, establish current
  participation, timing and responsibility for delivery; campaign availability is not guaranteed.
- **Featuring:** if considering promoted visibility, establish the submission/selection route
  and entry destination; it cannot be a guaranteed audience source.


## Private information

Design context: [services and publishing](dcl-platform-facts-2026-08.md#public-state-private-information-and-server-availability).

**Hidden roles or private hands:** the authoritative-server route documents both broadcast
synced components and messages addressed to specific players. A design candidate is to keep
the secret on the server and send each player only the information they need. Hiding a HUD
does not make data private if the same secret is broadcast to all clients. This is an
architectural inference from the documented routes, not a security audit. Inspect recipient
handling and what reaches each client before promising secrecy. Source and implementation:
[Multiplayer Server messages](https://github.com/decentraland/docs/blob/5a25e287f0440486196afa2bb3067608249547a8/creator/sdk7/networking/authoritative-servers.md#messages).

## Portable project types

Design context: [services and publishing](dcl-platform-facts-2026-08.md#portable-experiences-and-smart-wearables).

**Design possibility, support unresolved:** a portable companion or an item-triggered side
activity could accompany a player between places. The documented implementation route is an
SDK7 portable/global scene, or a smart-wearable project with wearable metadata and scripted
behavior. It is a separate project type, not ordinary scene code made global by an attachment.

## Solo World configuration

**An isolated solo World is also documented.** For a personal puzzle or horror journey where
other avatars would disrupt the experience, the same guide's single-player section configures
`worldConfiguration.fixedAdapter` as `offline:offline` in `scene.json`. It removes the World's
Communication Service and its built-in avatar visibility, chat and scene synchronization.
An external backend/WebSocket integration remains a separate possible route for shared data.
This is a deployment option, not proof that the application works without an internet connection.

Source: [SDK7 serverless multiplayer, single-player section](https://github.com/decentraland/docs/blob/5a25e287f0440486196afa2bb3067608249547a8/creator/sdk7/networking/serverless-multiplayer.md).
The parent serverless guide was inspected 2026-10-25; the solo route was checked in the
2026-10-26 source review. Exact installed SDK/client support was not tested here.
Design context: [shared scene state](dcl-capability-links-2026-08.md#shared-scene-state).
