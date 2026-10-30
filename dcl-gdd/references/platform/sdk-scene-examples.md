# SDK scene examples — useful building blocks

**Code, packages and documentation reconciled: 2026-10-26.** These are design applications of examples
in the official sdk7-test-scenes repository at commit `5606ac68816094771e5e3e393d75b433213700f1`.
No scene was built or played in this audit. A test's expected result is not an observed result.
Read a relevant entry when implementing a chosen mechanic or resolving a specific feasibility gap.
For ordinary design discussion, use [scene capabilities](scene-capabilities.md); use
[platform-fit](../platform-fit.md) for reusing known answers and investigating remaining gaps.

The examples below point to APIs and patterns, not complete reusable mechanics. Our applications
are suggestions. No external code or assets are included here. Inspect their licenses before
copying them; this audit does not grant reuse permission.

Choose a game task: [nearby actions and sight](#nearby-actions-and-sight-queries),
[object sequences](#move-objects-and-sequence-their-actions), [world labels](#world-labels-and-visible-groups),
[loading and client panels](#loading-and-returning-from-client-ui),
[view, input and space](#view-input-and-spatial-rules),
[objects and characters](#objects-characters-and-expressive-feedback),
[UI, media and journeys](#interfaces-media-and-client-journeys),
[shared play and progress](#shared-play-progress-and-observation),
[assets and performance](#assets-startup-and-focused-performance-work).

## Nearby actions and sight queries

**Proximity interactions** can support a nearby workstation, door or pickup without requiring a
precise cursor hit. The [example](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/3,2-proximity-interactions/src/index.ts)
registers `onProximityDown`, `onProximityEnter` and `onProximityLeave`, with distance, priority
and feedback options; it contrasts them with pointer events and rotates a door from an action.
Implementation route: `pointerEventsSystem` in `@dcl/sdk/ecs`, with the current
`add-interactivity` guidance. Decide how overlapping stations choose an action and whether a
nearby hint remains readable with the chosen camera. The example uses both `maxDistance` and
`maxPlayerDistance`; do not assume their values or keyboard labels suit a touch interface.
Proximity interaction is not a shared occupancy lock or proof that an obstacle cannot intervene.

**Raycasts** can query colliders along a line for a candidate sight check, aimed tool or obstacle
probe. [Raycasting docs](https://docs.decentraland.org/creator/scenes-sdk7/interactivity/raycasting)
describe `raycastSystem`, direction/target options, hit results and collision masks. The
[inspected tests](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/77,-1-raycast-unit-tests/src/raycast.test.ts)
exercise four direction modes and result metadata with empty hit lists. They do not test a
complete enemy vision or damage system. Invisible/non-colliding art will not become an obstacle
to a ray by appearance alone. Choose the relevant collider layers, distance and query frequency;
continuous queries have a cost. Occlusion, field of view and damage rules remain scene logic.

## Move objects and sequence their actions

**Tweens** provide authored movement, rotation, scale and texture changes. They can support a
sliding counter, a machine cycle or a pickup response. The
[example](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/78,-4-tweens/src/index.ts)
uses `Tween`, `TweenSequence` and continuous modes, including combined move/rotate/scale.
Use the current tween component definitions for the selected SDK. A tween changes presentation
over time; item collision, ownership and gameplay state need their own rules. It does not make
a moving platform reliable on every client; see the newer
[platform-follow finding](#riding-moving-platforms). The mobile v1.15.0
[gap list](https://docs.decentraland.org/creator/build-for-mobile/mobile-client/missing-features)
lists `TweenSequence` as missing and movement/platform differences; check the target version or
use an authored sequence of supported actions. Do not infer mobile support from this package.

**Animation completion** can help a machine return to idle or chain an NPC's one-shot action
into a looping animation. The [example](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/73,-9-animation-finish/src/index.ts)
reads `Animator.get()` and watches a non-looping clip's `playing` flag change from true to
false, separately tracking a stop requested by the scene. This is a polling pattern for GLB
Animator clips, not a universal finish event for player emotes. A state change alone may mean
interruption; define cancellation and missing-asset recovery before using it to award an outcome.
Its package says `latest`, so the repository snapshot does not identify the resolved SDK.
Verify the pattern in the intended client/version when timing affects play.

## World labels and visible groups

**Billboards and TextShape** can keep a station label or an in-world status readable as the
view changes. The [label helpers](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/1,1-billboard-target-entity/src/labels.ts)
create TextShape and card hierarchies with Billboard; the
[scene](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/1,1-billboard-target-entity/src/index.ts)
compares camera-facing cards, axis limits and an explicit target entity. Use `Billboard` and
`TextShape` with the current component definitions. A facing label is not screen-space UI or an
automatic player nametag. Distance, overlap, line of sight and label visibility are still design
work; a deleted target and the chosen axes need an appropriate fallback.

**Visibility groups** can reveal a completed machine, switch a clue set or hide an inactive
stage. The [example](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/1,0-visibility-comp-propagation/src/index.ts)
changes `VisibilityComponent.visible` and `propagateToChildren` on parent/child hierarchies.
This offers a presentation route; it is not deletion, unloading, a privacy boundary or an
automatic change to the object's interaction rules. The example creates colliders separately.
Keep visible state, collisions and active actions consistent; do not assume hidden children have
stopped game logic or become inaccessible to another client.

## Loading and returning from client UI

**Asset loading states** can inform a loading cue or preparation of an upcoming room. The
[example](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/88,-12-asset-load/src/index.ts) adds audio, video, texture and GLB paths
to `AssetLoad`, observes state through `assetLoadLoadingStateSystem` and displays status changes;
it also adds an invalid path. This is a status demonstration, not a ready-made scene startup
gate. Use states to handle failure as well as readiness. Loading an asset does not prove that
every dependent entity is ready, playback has started or all players are synchronized.

**Explorer panel lifecycle.** A wardrobe or community action may open a
native client panel, then restore the scene's local instructions after the player returns.
The [request module](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/80,-6-explorer-ui-events/src/modules/openExplorerUiButtons.ts)
calls `openExplorerUi` and handles verdicts; the
[event module](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/80,-6-explorer-ui-events/src/modules/explorerUiEvents.ts)
reads `ExplorerUiEventsResult` with request IDs and timestamps. It is a candidate route for
distinguishing a request from a panel actually opening and closing. The test includes expected
refusals without a recent user gesture and repeated requests, but those were not observed here.
Its package targets a prerelease SDK range, but the newer [event documentation](https://github.com/decentraland/docs/blob/5a25e287f0440486196afa2bb3067608249547a8/creator/sdk7/interactivity/event-listeners.md)
documents public `openExplorerUiAndWait()` from `@dcl/sdk/explorer-ui` for **SDK 7.30.0+**.
Use its `closed`, `notOpened` and `timedOut` outcomes to resume local instructions or offer a
fallback. Check the actual equipment/purchase condition separately. Keep a shared round's
clock independent of one player's panel. The event stream is not acquisition analytics by itself.

For speech indicators, use the separately maintained
[voice and communication finding](dcl-capability-links.md#voice-and-communication).
For native labels over avatars, see [labels above players](scene-capabilities.md#make-actions-and-outcomes-readable).
Both have version/client scope; neither makes a multiplayer state system.

## Package scope of the inspected examples

These are `package.json` declarations, not lockfile resolutions or compatibility guarantees.
A normal version range in an example is not proof that every API in its source existed at the
range's minimum version.

| Example | Declared SDK dependency | Evidence |
| --- | --- | --- |
| Proximity interactions | `^7.24.5` | [package](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/3,2-proximity-interactions/package.json) |
| Raycast tests | `^7.24.5` | [package](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/77,-1-raycast-unit-tests/package.json) |
| Tweens | `^7.24.5` | [package](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/78,-4-tweens/package.json) |
| Animation finish | `latest` — resolved version unknown | [package](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/73,-9-animation-finish/package.json) |
| Billboard target | `^7.24.5` | [package](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/1,1-billboard-target-entity/package.json) |
| Visibility propagation | `^7.24.5` | [package](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/1,0-visibility-comp-propagation/package.json) |
| Asset loading | `^7.24.5` | [package](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/88,-12-asset-load/package.json) |
| Explorer UI events | `^7.29.1-35917671376.commit-046b268` — prerelease range | [package](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/80,-6-explorer-ui-events/package.json) |

## Routes from the complete 75-scene pass

All 75 source/configuration sets in the pinned repository were inspected in the 2026-10-26
snapshot. The catalogue below groups them by a game's need; duplicate fixtures and QA stations
inform the same route. It is an applied selection, not an import of the raw reports. Read the
relevant route and linked source before adapting code. Source expectations, author measurements
and package declarations remain distinct from an observed client result.

### View, input and spatial rules

**Authored and spectator views →** board play, an inspection lens, a side-view stage or an
observer role. Start from [virtual cameras](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/2,22-virtual-cameras/src/index.ts)
for static, moving, look-at and timed transitions; [spectate mode](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/33,20-spectate-mode/src/index.ts)
adds a yaw/pitch rig, player roster, following, zoom and touch controls. `VirtualCamera`,
`MainCamera` and `InputModifier` supply controls; rigs, bounds and cleanup are custom logic.
Spectate uses hardcoded scene coordinates and frame-dependent smoothing, so adapt these.
Neither route moves the live avatar or supplies camera collision. A low FOV can approximate
orthographic framing within a shallow play area; it is still perspective projection.

**Aim and controlled input →** held repair tools, painting, charging or a first-person inspection
station. [Primary cursor info](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/0,5-primary-cursor-info/src/index.ts)
combines pointer screen data, world ray and periodic raycasts. [Mouse-look](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/32,20-virtual-camera-mouse-look/src/index.ts)
implements clamped yaw/pitch from pointer delta; [pointer lock](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/31,20-pointer-lock-control/src/index.ts)
requests lock and observes its state. Raw locked delta needs the relevant renderer fix and a
touch alternative. The [synthetic-input showcase](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/149,149-synthetic-input-showcase/README.md)
adds useful scene patterns: occupancy-derived locks, dwell, charge/release, view-angle hysteresis
and a bounded paint-dot pool. Its Unity MCP input commands belong to an experimental test
controller, not APIs that a game script can call. Paint state remains local.

**Available actions and selection distance →** a clear workstation prompt or a nearby door.
[Pointer feedback](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/30,20-pointer-events-feedback/src/index.ts)
configures highlight, hint text and feedback independently; pair it with proximity callbacks
described above. [Distance probes](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/34,20-pointer-events-distances/src/index.ts)
separate player, camera and proximity distance. That fixture uses a prerelease; its predicted
LIVE labels are not measured input events. Check overlapping targets and camera/player separation
instead of treating a distance field or desktop key label as a universal interaction rule.

**Directed player moves and temporary restrictions →** a checkpoint reset, guided entry, a
cutscene or a slow role. [Move-to](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/10,0-move-to-test/src/index.ts)
requests local destinations; [duration moves](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/11,0-move-player-to-duration/src/index.ts)
combine a timed request, result and input lock; [input modifiers](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/0,1-input-modifier/src/index.ts)
select walk/run/jump/emote restrictions. Release a temporary lock on refusal as well as success;
the duration fixture lacks that recovery. Input locks do not cancel external forces, and moving
to a point does not provide pathfinding or guarantee a safe landing.

**Collision layers, overlap and bounds →** a player-only checkout, object delivery sensor or
aimed tool. [Collider layers](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/5,5-collider-layers/src/index.ts)
combine player/main-player/custom masks with triggers and rays. Pair with the trigger and raycast
routes above. [Bounds probes](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/5,90-scene-bounds-check/src/index.ts)
move parented and unparented models, labels, avatars and media across an irregular scene.
Use that comparison method when a play area reaches its edge. These are local filtering and
client-boundary tests, not new physics, extra parcels or proof of remote-player behavior.

### Objects, characters and expressive feedback

**Procedural toys and state changes →** a construction sandbox, a reactive floor or visual
selection. [Cube spawner](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/0,0-cube-spawner/src/index.ts)
uses custom ECS markers, primitive renderers/colliders, time-based rotation and click colours;
[cube wave](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/0,2-cube-wave-32x32/src/index.ts)
animates 961 transforms. Add limits and cleanup to spawning. The wave has no floor colliders
and is not an established player-carrying surface; neither example synchronizes its randomness.

**Moving challenges and pursuit →** lifts, a timed crossing, a moving hazard or a simple follower.
[Moving platforms](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/77,-5-tweens-moving-platforms/src/index.ts)
combine native tweens, trigger-started journeys, pickups and a separate audio entity that survives
pickup removal. [Following cube](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/79,-4-tween-following-cube/src/index.ts)
retargets finite or continuous movement and stops near the player. Add route/collision rules,
authority and cancellation as needed. Retargeting is not obstacle-aware navigation; moving
platform contact and mobile TweenSequence support need their own client check.

**Avatar-style NPCs →** a greeter, customer, patrol or character demonstrating an action.
[AvatarShape creation](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/4,20-avatar-shape/src/index.ts)
sets identity, body, colours and wearable URNs; [movement](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/4,19-avatar-shape-movement/src/index.ts)
uses transforms/tweens and a hand attachment. [Player emote choices](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/4,21-avatar-shape-emotes/src/index.ts)
and [scene GLB expressions](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/4,22-avatar-shape-scene-emotes/src/index.ts)
offer separate playback routes. Dialogue, navigation, customer rules and shared decisions remain
game work. The player-copy fixture hardcodes body/colours and needs nonempty emotes; it does not
copy every part of the live avatar. Verify content availability and rights before using assets.

**Gestures, carrying and completion →** a visible delivery role, a repair animation or a social
response. [Scene emotes](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/80,-1-scene-emotes/src/index.ts)
exercise one-shot, looping, masked and stopped playback. [Avatar masks](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/88,-13-avatar-masks/src/index.ts)
combine upper-body animation, hand-parented props and P2P `syncEntity`. The older
[attachment probe](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/100,102-avatar-attach-test/src/index.ts)
explores anchors but has remote transform/cleanup problems; use it to locate an API, not as a
finished helper. A shared prop needs ownership/conflict rules beyond local `crateHeld` state.
[Emote lifecycle](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/4,23-emote-finish/src/index.ts)
reads `AvatarEmoteCommand` STARTED/FINISHED/INTERRUPTED. Its `latest` package is unresolved;
older clients without state report only a start. Separate it from GLB Animator completion.

**Readable roles and social signals →** teams, titles, a public activity indicator or a clean
cinematic view. [Nametags](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/4,24-avatar-nametag/src/index.ts)
configure scene plates; [hide-name areas](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/10,99-avatar-modifier-hide-nametags/src/index.ts)
and [modifier areas](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/9,99-modifier-areas/src/index.ts)
explore exclusion lists, overlapping camera areas and pooled volumes. Hiding is local presentation,
not identity privacy. Current SDK 7.28+ nametag scope and the mobile gap are recorded in
[scene capabilities](scene-capabilities.md#make-actions-and-outcomes-readable); check the documented
hide behaviour where the old fixture disagrees. [Talking-state indicators](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/4,26-avatarbase-talking/src/index.ts)
attach text to detected avatars and clean up on departure. That exact prerelease exposes three
states: unknown, silent and talking; it is not microphone analysis. Use the maintained
[voice finding](dcl-capability-links.md#voice-and-communication) for support conditions.

**Materials, animated surfaces and light →** a selected tool, damaged machine, flowing conveyor
texture or rotating searchlight. [Texture movement](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/0,3-texture-movement/src/index.ts)
animates UV offset/tiling; [node modifiers](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/74,-8-gltfnodemodifier/src/index.ts)
override material, video texture and shadow casting by node path; [dynamic lights](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/0,4-dynamic-lights/src/index.ts)
vary point/spot properties and masks. Asset-specific node names and client support matter.
UV movement is not a conveyor force. Light appearance is separate from detection and damage;
the fixture's point-light branch does not establish point shadows. Pair essential light cues
with another readable signal when the target graphics profile disables them. Native particles
add bursts, trails and emitter-local/world motion; [the particle scene](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/0,7-particle-system/src/index.ts)
offers editable presets, not gameplay collision or a universal particle quota.

**Time and animation →** an evening mood, a round transition or a working machine. The four
skybox fixtures separate [scene metadata](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/2,0-skybox-scene-json/scene.json),
[World metadata](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/3,0-skybox-world-json/scene.json)
and [runtime A](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/2,1-skybox-sdk-scene-a/src/index.ts)/[runtime B](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/3,1-skybox-sdk-scene-b/src/index.ts).
Their readouts parse configuration, not actual renderer time; local choices do not synchronize a
World clock or prove metadata precedence. [Animator shark](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/73,-8-animator-tests-shark/src/index.ts)
shows named clips, weights and simultaneous playback. Clip availability depends on the GLB;
the newer [animation documentation](https://github.com/decentraland/docs/blob/5a25e287f0440486196afa2bb3067608249547a8/creator/sdk7/3d-essentials/3d-model-animations.md)
scopes automatic `playing=false` completion feedback to Desktop. Do not use the polling example
above as proof of finish detection on every client.

### Interfaces, media and client journeys

**Adaptive HUDs and forms →** orders, dialogue choices, a player roster or a feedback panel.
[Basic UI](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/80,-3-ui/src/index.ts)
and [extended controls](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/81,-3-ui-2/src/index.ts)
demonstrate input/change/submit, focus removal, dropdowns, scrolling and borders.
[Canvas size](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/76,-10-UiCanvasInformation/src/index.ts)
and [screen insets](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/81,-2-ui-screen-inset-area/src/index.ts)
provide dimensions plus device/interactable regions per renderer. Wait for canvas data, and check
keyboard, orientation and touch scrolling. A 1920×1080 virtual screen is a coordinate choice,
not mobile validation. [UI backgrounds](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/70,-9-sdk7-ui-backgrounds/src/index.ts)
cover tint, slicing and nine-slice; its avatar portrait uses an unset ID and is not evidence of
a working player portrait. [Layering probes](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/0,6-ui-zindex-and-opacity/src/index.ts)
compare sibling/renderer z-order and opacity on a CDN fix build. Current docs describe renderer
ordering, but that alone does not pin the first released SDK/client containing the fix.

**Custom typography →** a readable themed HUD or world sign. The [font fixture](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/84,-6-font-src/README.md)
tests shared consumers, invalid sources, removal and fallback with a custom serializer/client
bridge. For current implementation use the [UI text documentation](https://github.com/decentraland/docs/blob/5a25e287f0440486196afa2bb3067608249547a8/creator/sdk7/2d-ui/ui_text.md):
SDK **>7.30.1**, local TTF, fallback font, Desktop optimized bundles, direct TTF loading on Bevy
web, fallback on mobile. External font URLs and OTF/CFF are outside that route. Check glyph
coverage, explicit label dimensions and the font's redistribution license; the historical harness
does not establish present memory or loading performance.

**Reactive media and sound lifecycle →** pulse cues, a music-driven installation, repeated tool
sounds or a spoken instruction followed by an action. [Audio visualization](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/88,-10-audio-visualization/src/index.ts)
maps amplitude/eight bands from audio/video entities onto objects. Exact beat scoring and shared
timing remain custom; progressive video analysis differs from HLS, and zeros can mean unsupported
analysis. [Retrigger probes](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/89,-10-audio-source-retrigger-test/README.md)
separate SDK write dedup from renderer cursor handling: replaying the same URL needs both paths
to work. [Audio finish](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/89,-11-audio-finish/src/index.ts)
polls a true-to-false edge and records media events. Very short, missing, stopped and interrupted
clips need separate recovery; the sample has no universal FINISHED event classifier.

**Client actions, portals and portable companions →** a multi-location quest hub, optional
wearable step or a companion experience. [Restricted action buttons](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/80,-4-restricted-actions/src/index.ts)
request native actions, external links and realm changes; the [teleport hub](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/1,2-teleport-hub/src/index.ts)
adds realm/parcel combinations. Public realm-targeted teleport is documented from SDK 7.28 and
clipboard from 7.12 in [release notes](https://github.com/decentraland/docs/blob/5a25e287f0440486196afa2bb3067608249547a8/creator/sdk7/releases/releases.md).
Local type extensions in old fixtures do not define today's availability. Check refusal and
arrival; request labels and empty responses are not a successful journey. [Portable spawn/kill](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/8,8-portable-experience/src/index.ts)
tracks a returned process ID; the [hideUi](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/8,7-portable-experience-hide-ui/scene.json)
and [disabled](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/8,9-portable-experience-disabled/scene.json)
fixtures set portable-experience policy. Those flags are not general Explorer HUD control;
external ENS content, client support, repeated spawns and process cleanup need focused checks.

### Shared play, progress and observation

**Identity-aware requests and player lifecycle →** a quest backend, join/leave roster or restoring
instructions after a realm change. [Signed fetch](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/66,6-signed-fetch/src/index.ts)
sends a signed request; the backend still needs signature/auth validation and rate limits.
Its green UI does not check HTTP success. [SDK observables](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/6,66-sdk-observables/src/index.ts)
are a historical lead for profile/realm/player events, explicitly deprecated rather than a new
architecture recommendation. Choose current event APIs and clean up subscriptions. The broad
[Mannakia fixture](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/100,100-mannakia-test-scene/src/index.ts)
offers switchable probes for player data, UI, animation and message buses. It has stale helpers,
subscription cleanup gaps and a transaction-specific crypto dependency; inspect a relevant probe
without importing the whole scene. A local custom component is not automatically replicated.

**Authoritative rounds and progress →** shared pickups, a competition, a podium or a persistent
record. [Leaderboard](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/90,-9-authoritative-server-leaderboard/src/server/server.ts)
validates sender/proximity, publishes state and writes Storage; [Gem Rush](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/92,-9-authoritative-server-gem-rush/src/server/server.ts)
adds lobby/active/podium phases, first-valid-claim resource removal, local decoration and round
checkpoints. Both depend on the **auth-server branch and hosting conditions**, as does the
[server documentation](https://github.com/decentraland/docs/blob/5a25e287f0440486196afa2bb3067608249547a8/creator/sdk7/networking/authoritative-servers.md).
These are concrete routes, not complete anti-cheat or transactional persistence. Leaderboard
claims lack replay/rate protection, and its Storage writes run without serialization;
Gem Rush can lose the current round on failure, and cache misses may still read Storage during
active play. Design cold-start/reconnect feedback and idempotent saves. Heartbeat freshness is
liveness evidence, not an explanation of failure or a service availability promise.

**Voluntary playtest feedback →** ask about a specific confusing action, compare versions or
collect a comment after a round. [Scene feedback](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/0,-1-scene-feedback/README.md)
combines consent, queued question groups, client outbox, server messages and chunked CSV Storage
on the auth-server route. Use [player feedback](../player-feedback.md) for question planning and
the existing feedback-skill handoff; this fixture is an implementation lead for that route.
A saved acknowledgement confirms server memory before periodic flush,
not durable storage. Its optional score/title bonus is local and not persistent. Adapt consent,
retry, retention and storage recovery to the actual study; response count alone does not measure
enjoyment, and filling a form need not become a gate to the game.

### Assets, startup and focused performance work

**Asset variants and visual regression →** swap a machine stage, inspect a model or compare
materials under a controlled camera. [GLTF updates](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/3,33-gltf-container-update/src/index.ts)
change source and visible-mesh collision masks. [Testing gallery](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/52,-52-testing-gallery/src/index.ts)
cycles models/materials/media, and [model tests](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/54,-55-Testing-3d-models/src/index.ts)
reference morph, rigged and Draco assets. Handle asynchronous loading and errors. Presence of a
model name is not successful format support: binary assets were outside the text audit. Texture,
collider and visibility changes remain different operations.

**Startup and asset granularity →** a ready cue before a room opens, reusable props or reducing
a hitch. Combine AssetLoad above with [main CRDT checks](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/80,-2-main-crdt/src/validations.test.ts):
the latter asserts expected first-tick contents but its binary CRDT was not decoded in this
audit. [Reuse versus merge](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/94,-10-gltf-reuse-vs-merge/README.md)
compares repeated/shared files, packed objects, merged geometry and burst creation. Reuse,
download size, materials, draw calls, instantiate cost and culling are separate tradeoffs. The
author's August 2026 Unity Editor measurements are not current mobile budgets; preloading does
not remove instantiation, and merging can lose useful culling. Compare equivalent layouts on
the target client before making an optimization a design requirement.

**Bounded workload probes →** investigate a costly HUD or server task with a small reproducible
comparison. [DBMonster](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/73,-2-dbmonster/src/ui.tsx)
stresses dynamic UI layout; it is not a database or a measured capacity claim.
[Server limits lab](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/93,-9-authoritative-server-limits-lab/README.md)
separates fetch, WebSocket, comms and entity workloads in local preview. Its environment-dependent
headless defaults are not LAND, mobile or rendering quotas. Use its isolation/measurement method;
do not carry destructive stress workloads into a normal playtest. None were run in this audit.


## Focused implementation evidence

The following source details support specific implementation checks. Open only the relevant
heading when a version, client difference or disputed limit affects the selected route.

## Item simulation evidence

A concrete simulation candidate exists in the official
[trigger-area test scene](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/75,-9-trigger-areas/src/index.ts):
it creates a Cannon world, advances it with a fixed step, and copies body positions into SDK
entities. This is scene-managed item simulation, not a native shared rigid-body service. Its
package uses SDK `^7.24.5` and unpinned `cannon` dependencies. Multiplayer ownership, target-client
performance and reuse permission still need checking: no license was found in the repository
root during this pass. Use an authored throw when its simpler rules serve the game.

## Riding moving platforms

**Focused source check: 2026-10-28; no client playtest.** A moving deck, lift or rotating floor
is a supported design candidate, not an automatic multiplayer guarantee. Keep three questions
separate: carrying the local player, giving everyone the same platform motion, and displaying
other players correctly relative to that platform.

- **Local riding:** the inspected Unity desktop
  [movement code](https://github.com/decentraland/unity-explorer/blob/acef03b2bdc4a309c4ad7896c9fdb0f1f280cafc/Explorer/Assets/DCL/Character/CharacterMotion/Systems/InterpolateCharacterSystem.cs#L69-L98)
  preserves the avatar's position relative to its supporting platform as that platform moves
  and rotates. This is client-source evidence, not a test of a particular released build.
- **Mobile/Godot:** [issue 2852](https://github.com/decentraland/godot-explorer/issues/2852)
  described missing follow behavior. [PR 3056](https://github.com/decentraland/godot-explorer/pull/3056)
  merged on 2026-10-15; the merged
  [player code](https://github.com/decentraland/godot-explorer/blob/0e4cfadeffaa0cd12cfcddd5602533ddc3e11814/godot/src/logic/player/player.gd#L1229-L1279)
  applies platform translation and rotation. The mobile release containing it was not established.
  Do not repeat the old gap as an unconditional impossibility, or equate merged code with a
  shipped feature. Resolve the unestablished release availability when mobile riding matters;
  this does not reopen the known local-carry implementation.
- **SDK7 starting point:** the
  [moving-platform scene](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/77,-5-tweens-moving-platforms/src/index.ts)
  uses Tween, TweenSequence and TriggerArea for horizontal, vertical and waypoint movement.
  Its package declares SDK `^7.24.5`; this is not a resolved version or mobile support proof.
  The inspected entry file does not establish shared timing/authority or remote-avatar behavior.
  The older [community example](https://github.com/decentraland-scenes/moving-platforms/blob/4277bd79cc5b7416752a49d1946775c6126423c0/package.json)
  uses `decentraland-ecs` (SDK6), so it is not a drop-in SDK7 implementation.
- **Teammates on deck:** smooth remote positions and animations relative to a moving/rotating
  deck remain unverified by these sources. A useful later check uses two clients: stand, walk,
  turn and jump while the deck moves, then join after it has started. Observe both views and
  record client versions. Keep this separate from the local carry check; uncertainty does not
  establish that multiplayer decks are impossible.

## Nametag evidence

**Labels above players:** `AvatarNametag` adds a scene-authored label above the player's normal
nametag. It can support visible roles, team labels or a public game status; these are design
uses, not automatic team/state systems or a rename of the player's account. The official
[client comparison](https://docs.decentraland.org/creator/build-for-mobile/mobile-client/missing-features)
documents it on desktop and lists it as missing on mobile v1.15.0 (October 2026). For a mobile
target, a scene UI roster or an attached text label is an alternative to investigate, including
legibility and which players should see it. The inspected
[nametag example](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/4,24-avatar-nametag/src/index.ts)
creates labels on the player and AvatarShape NPCs. Its
[roster module](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/4,24-avatar-nametag/src/modules/multiplayerRoster.ts)
assigns labels locally to detected player entities; it does not supply an authoritative team service.
The [package](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/4,24-avatar-nametag/package.json)
uses a feature-branch SDK build `7.27.1-33889391869.commit-f984188`. That is the example's
history: the newer [AvatarNametag documentation](https://github.com/decentraland/docs/blob/5a25e287f0440486196afa2bb3067608249547a8/creator/sdk7/interactivity/avatars/avatar-nametags.md)
documents the public component for SDK **7.28.0+**. The documentation says
`AMT_HIDE_NAMETAGS` also hides custom plates; the older fixture expects different placement
when names are hidden. Check that interaction on the chosen renderer. Per-recipient visibility
and authoritative role assignment are not established by this inspection.

## Lighting evidence

**Light limits currently need scope.** General Lights docs state one light per parcel. The
[upstream lighting skill](https://github.com/decentraland/sdk-skills/blob/main/lighting-environment/SKILL.md) instead describes separate authored-content and renderer budgets.
Official mobile [docs change 8139a7f](https://github.com/decentraland/docs/commit/8139a7fb6d9c91f6ed29cd10cdc19db7ee8aaca6)
confirms soft/hard authored limits of 8/16 lights and 2/4 shadow lights, while quality profiles
activate 0–8 nearest lights and may disable shadows. These measure different things. The skill also cites desktop Unity quality assets, not independently inspected here. Preserve this conflict; inspect the relevant validator/renderer before promising an exact
budget. If the game targets profiles with lights or shadows disabled, provide another way to read
its essential cues; otherwise record that profile dependency.

## Particle evidence

**Smoke, sparks and other particle cues:** native `ParticleSystem` and the
[particle presets](https://github.com/decentraland/sdk-skills/blob/main/particle-system/references/particle-presets.md)
provide a concrete starting point. The official
[particle test scene](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/0,7-particle-system/src/index.ts)
also demonstrates the API; its package uses SDK `^7.24.5`. The
[particle skill](https://github.com/decentraland/sdk-skills/blob/main/particle-system/SKILL.md)
documents mobile support and warns that particles are visible only from inside the scene's
parcels and are not included in its LOD silhouette. Set particle size in the emitter, not `Transform.scale`.
Keep collision and gameplay outcomes separate from cosmetic particles. The same skill contains
an unresolved conflict between a general particle cap and larger mobile budgets; do not turn
either number into a universal quota. Check the relevant validator/runtime if the effect depends
on a limit. Appearance, performance and example reuse permission remain separate checks.
Use these cues to make an action readable: a pot boiling over, a machine starting or a trail
showing a recent event. A visible effect can communicate state without implementing that state.

## Portal permission evidence

[Scene metadata](https://github.com/decentraland/docs/blob/5a25e287f0440486196afa2bb3067608249547a8/creator/sdk7/projects/scene-metadata.md)
scopes `requiredPermissions` to portable experiences and smart wearables. Missing flags in a
normal LAND/World example are not an automatic design blocker. The release sources and public
clipboard/realm-targeted teleport versions are in the client-journey route above; old ambient
types in fixtures do not define today's availability.

## Movement and interaction implementation

`TouchScreenControls` configures the native joystick, crosshair and action buttons while the
player is in the scene, including visibility, icons and the main action. Button placement follows
the client's layout; this component has no effect on desktop/VR. A custom HUD is a separate route.
Source: [touch controls](https://docs.decentraland.org/creator/scenes-sdk7/interactivity/touch-screen-controls).

`InputModifier` restricts movement; `AvatarLocomotionSettings` changes movement parameters;
`movePlayerTo` requests a local destination; `Physics` applies forces. Writing the live player's
`Transform` does not move the avatar. Use the linked player-avatar, advanced-input and
player-physics guidance in [scene capabilities](scene-capabilities.md#move-players-move-objects-detect-contact).
For `TriggerArea`, volume size comes from the entity transform and collision masks choose
players or custom-layer objects. Select the local player for effects that apply only to that
player. The add-interactivity source linked there records overlapping-zone and teleport event-order
issues; derive persistent effects from current occupancy when stale exit events could clear them.

## Voice activity evidence

**Scene-readable voice activity is a separate capability.** The
[talking-state example](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/4,26-avatarbase-talking/src/index.ts)
reads `AvatarBase.talking`: `undefined` means no reported data, `false` means silent and `true`
means talking. Its [package](https://github.com/decentraland/sdk7-test-scenes/blob/5606ac68816094771e5e3e393d75b433213700f1/scenes/4,26-avatarbase-talking/package.json)
pins SDK and runtime `7.31.1-39942109730.commit-afd7f79`. It builds an attached text marker,
so a speaker indicator or turn-taking cue has a concrete implementation candidate. Verify the
chosen SDK/client release before depending on the field; this is source inspection, not a live test.
The merged [Unity implementation](https://github.com/decentraland/unity-explorer/pull/10462)
reports Nearby activity even when the listener mutes or blocks that speaker. Feature-flag-off
can leave the field unset. Activity is therefore neither proof of audibility nor evidence of
what was said; preserve the no-data state in the game's presentation.

## Further implementation leads

The 75-scene/documentation snapshot does not include the Unity client-source files or external
asset catalogues below. Use those as focused leads. Related player documentation describes the
client journey; it does not by itself establish scene APIs for observing chat or native markers:

- Native pointing markers: Unity Explorer's
  [`PointAtMarkerSystem`](https://github.com/decentraland/unity-explorer/blob/dev/Explorer/Assets/DCL/Character/CharacterMotion/Systems/PointAtMarkerSystem.cs)
  and [`RemoteHandPointAtSystem`](https://github.com/decentraland/unity-explorer/blob/dev/Explorer/Assets/DCL/Character/CharacterMotion/Systems/RemoteHandPointAtSystem.cs).
  These are historical client-source paths; a client feature would still not establish a
  scene-callable marker API. A candidate use is teammates indicating a location; an authored
  scene ping remains a different implementation. Check the mobile gap list for the target version.
- Text chat and translation: [Friends and chatting](https://docs.decentraland.org/in-world/friends-and-chatting)
  and [Unity chat documentation](https://github.com/decentraland/unity-explorer/blob/dev/docs/chat.md).
  Potential use: coordination or multilingual social play. Check player access, client scope and
  scene integration separately; this lead does not establish SDK access to chat messages.
- Emote wheel and native shortcuts:
  [shortcuts and chat commands](https://docs.decentraland.org/in-world/shortcuts-and-chat-commands),
  plus [mobile controls](https://docs.decentraland.org/mobile-app/controls). Player-operated
  controls are distinct from SDK-triggered actions. They may support a social greeting or
  expressive roleplay. For observing emote lifecycle in scene code, use the version-scoped
  [gesture route](sdk-scene-examples.md#objects-characters-and-expressive-feedback).
- Reusable assets and examples: [SDK skills](https://github.com/decentraland/sdk-skills) contains
  `add-3d-models/references/model-catalog.md`, `avatar-animations` catalogs and `audio-video`
  references; [sdk7-test-scenes](https://github.com/decentraland/sdk7-test-scenes) supplies
  focused engine examples. Inspect the relevant entry, code, assets and license before reuse.
  A catalog listing is not evidence that an example fits this game's client or behavior. For
  applied routes across all 75 inspected test scenes, use [SDK scene examples](sdk-scene-examples.md).
  Other asset-catalogue listings remain leads for reducing implementation work, not ready-made
  game systems.
