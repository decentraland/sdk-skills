# Decentraland capabilities — reusable findings and routes

This is the design-facing entry to the platform knowledge bundle. Read the section needed for
the proposed action, not every file. Each answer keeps its evidence scope and remaining work.
The historical filename does not set the freshness of all entries. Follow
[platform-fit](../platform-fit.md#reuse-the-platform-answer-before-researching-it-again) for reuse,
targeted checks and delegation; a broken link or missing entry is not evidence of absence.

| Design need | Start here |
| --- | --- |
| First-person, fixed or nearly orthographic views, 2.5D play, touch, interaction, player/object physics | [Scene actions and design candidates](scene-capabilities.md) |
| Player labels, lighting, skybox, materials, particles, UI, animation, NPC presentation, sound/video/music analysis | [Scene presentation and client limits](scene-capabilities.md) |
| Turn a spatial interaction, animated response or UI idea into a concrete SDK implementation candidate | [Source-inspected scene examples and adaptation routes](sdk-scene-examples.md) |
| Player conversation, scene-readable voice activity, shared state, planning a bot's actions | The scoped findings below |
| Saves, external data/APIs, private information, server availability, identity, rewards, publishing, discovery and return channels | [Platform services](dcl-platform-facts-2026-08.md) |
| Keeping a party together, separate matches, private sessions and crowd size | [Groups and private sessions](#groups-and-private-sessions) |
| Riding a moving deck or lift, mobile follow support, other players on the platform | [Moving-platform findings and remaining checks](sdk-scene-examples.md#riding-moving-platforms) |
| Hub and chapter Worlds, private club access, collaboration on separate areas | [Publishing and access](dcl-platform-facts-2026-08.md#publishing-access-and-population) |
| Scheduled sessions, Communities, cosmetic souvenirs and approved incentive programs | [Discovery](dcl-platform-facts-2026-08.md#discovery-and-reasons-to-return) and [rewards](dcl-platform-facts-2026-08.md#identity-and-rewards) |
| Concrete implementation or a topic not covered | [Existing SDK knowledge](../platform-fit.md#use-existing-sdk-knowledge): official SDK skills and examples, then the specific unresolved source |

**Evidence:** voice, shared-state and HTN findings began on 2026-10-25; voice activity,
serverless/single-player routes and Pulse/service integration were checked on 2026-10-26. Scene and service entries
have their own dates, versions and open questions. These are documentation/code findings,
not a live test of the creator's game or a complete compatibility certification. Keep useful
implementations distinct from SDK built-ins, client features and tested game behavior.

## Voice and communication

Players in the documented desktop Unity client can use client voice for talking while playing. Design the scene's
orders, cues and alternatives around that existing feature; implementing voice transport is not
a prerequisite for ordinary player conversation. It does not establish a game-controlled team
channel, guaranteed audibility or mic use by everyone. A no-mic route may use authored cues.

**Client condition:** the [Unity voice documentation](https://github.com/decentraland/unity-explorer/blob/333aa8826979186f1380058cc75f74b9630e4879/docs/livekit-networking.md#voice-chat)
supports that route. The [mobile gap list](https://github.com/decentraland/docs/blob/5a25e287f0440486196afa2bb3067608249547a8/creator/build-for-mobile/mobile-client/missing-features.md)
lists proximity voice as unavailable on mobile v1.15.0 (October 2026). Keep the intended
conversation, and choose cues or a separate communication route when that client matters.

**Reacting to speech activity** can support a speaker marker or a turn-taking cue. There is an
inspected implementation candidate, with SDK/client conditions in [voice activity evidence](sdk-scene-examples.md#voice-activity-evidence).
An activity signal does not prove that another player can hear the speaker or reveal their words;
missing data must remain distinct from silence. Volume-based hazards or spoken commands require
a separate implementation check. Private team voice also needs its own supported route:
the [private-call service](https://docs.decentraland.org/apis/apis/comms-gatekeeper/private-voice-chat)
is not freely controlled by scene code. Preserve these ideas as candidates rather than promising
them from ordinary voice chat or declaring them impossible.

## Shared scene state

Players can share orders, ingredients or a common objective. The game must decide which actions
change that shared situation, what happens when two players act at once, and how someone joins
or leaves. Seeing each other's avatars alone does not establish shared game rules.

**Implementation route:** official
[SDK7 serverless multiplayer](https://github.com/decentraland/docs/blob/5a25e287f0440486196afa2bb3067608249547a8/creator/sdk7/networking/serverless-multiplayer.md)
documentation, inspected 2026-10-25; exact installed SDK version is not established by this page.
Avatars seeing each other does not synchronize the environment. `syncEntity` shares selected
components, including custom game-state components. Serverless synchronization needs no separate
game server, but does not persist state after everyone leaves. The page deprecates MessageBus
and prefers synchronized entities for most uses.

The docs also describe waiting for synchronization before interaction. Allow a joining player
to catch up before they take an important action. A co-op concept need not rediscover whether
shared state is possible; investigate the rules and experience this particular game needs.

**Boundary:** this does not promise latency, fairness, anti-cheat, persistence or a complete
multiplayer game. [Authoritative servers](https://github.com/decentraland/docs/blob/5a25e287f0440486196afa2bb3067608249547a8/creator/sdk7/networking/authoritative-servers.md)
are a different setup; check the installed package/version and deployment needs if authority is
load-bearing. Choose a route from the game's requirements, not from the word "multiplayer" alone.

**An isolated solo World is also documented.** For a personal puzzle or horror journey where
other avatars would disrupt the experience, the single-player configuration removes built-in
avatar visibility, chat and scene synchronization. It can serve a personal experience rather
than a shared gathering. See [solo World configuration](platform-implementation-notes.md#solo-world-configuration)
for the setting and source.
An external backend/WebSocket integration remains a separate possible route for shared data.
This is a deployment option, not proof that the application works without an internet connection.

## Groups and private sessions

A festival with a common objective, several teams playing separate rounds, and a private
four-person adventure make different promises. Start with the intended experience; resolve
only the separation it needs, rather than asking the creator to design a networking system.

| Player promise | Design consequence and route |
| --- | --- |
| Find people to play with | Decide whether players arrive as a group, join an open lobby or need automatic matching. A link or event can bring people to a destination; it does not by itself form a party. Automatic matching needs an identified implementation. |
| Each group has its own match | A game can assign groups and keep their orders, score and round rules separate through custom game state and validation. This is an implementation candidate, not an automatic result of several avatars being present. Decide what late arrival, leaving and rejoining mean. |
| Other groups cannot see or hear this match | Separate game state does not establish separate avatar presence or voice. Identify a supported session/deployment/communication route and check it before promising a private instance. Hiding a model or HUD is not proof of privacy. |
| Only invited people can enter | World access settings provide a documented creator-administered route for a closed destination. Check whose access is restricted and how invitees enter. One closed World does not by itself create a fresh private copy for every group. See [publishing and access](dcl-platform-facts-2026-08.md#publishing-access-and-population). |

The inspected sources do not establish a ready-made party-instance solution covering all four
promises. This is a specific knowledge gap, not a ban on isolated group games. Keep the concept
and investigate the missing part or a workaround; a change in who can see, hear or join the
group is a design trade-off to discuss with the owner.

**Crowd size:** choose the intended group size from the activity. Check that those players can
meet, receive the right game state and perform the core action on the target client. Existing
sources describe different population boundaries and do not establish one universal game limit
or unlimited performance. For an actual capacity dependency, read the scoped
[population and presence evidence](platform-implementation-notes.md#population-and-presence).

**Visible attendance:** an activity board can help players choose a gathering, but public
population estimates are not proof that a person joined or completed a match. Use the game's
own participation record for outcomes; the same evidence section explains the data limits.

## HTN bots and reusable logic

Planned NPC behaviour can support a guard, stalker or bot teammate. A reusable HTN implementation
offers a starting point for choosing actions from sensed conditions; the game's roles, actions
and quality of cooperation still need design and integration.

**Implementation evidence:** [sdk7-test-scenes PR #116](https://github.com/decentraland/sdk7-test-scenes/pull/116)
was open on 2026-10-25, inspected head **3c15eb2144a22093fe0bb7145de13cc415614cd8**. This is an
experimental reusable implementation, not an SDK7 built-in or proof of a published package.
Its [module README](https://github.com/decentraland/sdk7-test-scenes/blob/3c15eb2144a22093fe0bb7145de13cc415614cd8/scenes/96,-11-htn-planner/src/htn-planner/README.md)
documents copying the planning/NPC module and authoring tools into an existing scene. Preserve
the included license notices; inspect code/assets separately before the actual transfer.

**Reuse:** use this as a concrete candidate when proposing planned NPC behavior or bot teammates,
instead of starting a general search for whether DCL can run HTN. The
[NPC guide](https://github.com/decentraland/sdk7-test-scenes/blob/3c15eb2144a22093fe0bb7145de13cc415614cd8/scenes/96,-11-htn-planner/src/htn-planner/npc/README.md)
separates behavior domains, sensed facts, action executors and replanning. Guard/stalker examples
provide starting logic; they do not supply a cook's understanding of orders or teammate intent.

**Boundary:** a usable teammate still needs this game's domain, actions, perception, integration
and quality checks. Do not call HTN a ready-made NPC, free solo mode, or a tested replacement for
a person. A different behavior or client can justify inspecting relevant implementation files
or profiling a representative workload; that is an adaptation gap, not a repeat platform survey.
