# Scene capabilities — choices for play

**Sources checked: 2026-10-25; documentation and 75-scene snapshot integrated: 2026-10-26.**
Use this map to develop what players can do and notice. Read the relevant section; choose a
player action and its useful conditions before opening an implementation route. These are scoped
documentation findings, not playtest results or a complete platform inventory. Preserve each
finding's client and version scope; keep unresolved game-specific behaviour separate. Use
[platform-fit](../platform-fit.md#reuse-the-platform-answer-before-researching-it-again)
for reusing established capabilities and diagnosing reproducible failures.

For voice, shared state and HTN, use the maintained
[capability findings](dcl-capability-links.md). For publishing, identity and services, use
[platform facts](dcl-platform-facts.md). Their entries retain their own evidence dates.

Choose a game task: [view and controls](#choose-a-view-and-control-the-action),
[movement and contact](#move-players-move-objects-detect-contact),
[readable outcomes](#make-actions-and-outcomes-readable),
[carrying and characters](#carry-things-and-create-characters),
[sound and video](#use-sound-and-video), [UI journeys](#ui-journeys-typography-and-reusable-scene-routes).
For more implementation candidates, use the grouped [scene catalogue](sdk-scene-examples.md#routes-from-the-complete-75-scene-pass).

## Choose a view and control the action

**Choose the view for the game.** Players can inspect in first person, oversee an angled kitchen,
read an isometric-style tactics board, play a side-view 2.5D stage or watch as an observer.
The scene can hold first- or third-person mode in an area, or author camera position, rotation,
following and field of view. These are applications of the controls,
not built-in genre modes. A side view also needs suitable movement bounds and input design.

For a **nearly orthographic look**, try a narrow FOV with a more distant camera to retain the
framing and reduce perspective differences across a shallow play area. This is a perspective
approximation, not a verified orthographic SDK mode. Check framing and depth readability within
the scene's camera bounds; moving the camera farther away is not unlimited.

Only one virtual camera is active. A strictly vertical view makes movement direction ambiguous;
tilt it slightly. GLTF cameras do not become SDK cameras. The chosen view still needs occlusion,
control and touch checks. Source: [camera documentation](https://docs.decentraland.org/creator/scenes-sdk7/3d-content-essentials/camera).
Implementation: `camera-control` via `CameraModeArea`, `VirtualCamera` and `MainCamera`; pair
with movement/input guidance for restricted play spaces.

**Touch actions:** a player can use one nearby workstation action whose icon changes between
pick up, use and put down. Choose actions that work without hover, keyboard shortcuts or
right-click. The scene can change icons, select a main action or hide native controls, but their
positions follow the client's layout. These changes apply inside the scene and have no effect
on desktop/VR. A custom HUD is another route, with its own input and layout work. The scene
still decides which action is available. Source:
[touch controls](https://docs.decentraland.org/creator/scenes-sdk7/interactivity/touch-screen-controls).
Implementation: `advanced-input` via `TouchScreenControls`, and `build-ui` for custom controls.

**Clicks, holds and aiming:** a click can select a station; a held action can drive a repair or
charging tool. Simple events and continuous input are available routes. Decide how the action
starts, cancels and gives feedback. Mouse movement can serve desktop aiming, but needs a touch
alternative for mobile. The player/client can override pointer capture, so recovery matters.
Source: [advanced-input](https://github.com/decentraland/sdk-skills/blob/main/advanced-input/SKILL.md).
Implementation: `add-interactivity` for clicks, `advanced-input` for polling and restrictions.

## Move players, move objects, detect contact

**Slow areas, guided moments and launch pads:** the public SDK can restrict input, adjust
locomotion, move the local player to a destination or apply forces. Choose the effect that serves
the action: a slow carrying role feels different from a conveyor hazard or a launch-pad course.
These are distinct routes, with their own control and recovery needs; arbitrary character-controller
behavior is not established. Sources: [player-avatar](https://github.com/decentraland/sdk-skills/blob/main/player-avatar/SKILL.md)
and [player physics](https://docs.decentraland.org/creator/scenes-sdk7/interactivity/player-physics).
Implementation: `player-avatar`, `advanced-input`, `player-physics` according to the intended effect.

**Player physics is not item physics.** The documented impulses and continuous forces act on the
local player. Other players see movement, but this is not a shared rigid-body simulation.
Colliders block the player and provide pointer hit shapes; they do not by themselves make items
bounce or collide with each other. For thrown plates, consider an authored trajectory, custom
simulation or an inspected physics library. Ownership, collision rules and network consistency
remain game work. Source: [colliders](https://docs.decentraland.org/creator/scenes-sdk7/3d-content-essentials/colliders).
Implementation: collision/model guidance and `player-physics`; shared effects also use the
[shared-state finding](dcl-capability-links.md#shared-scene-state).

For thrown plates or bouncing props, a scene-managed simulation is a concrete candidate;
an authored throw may serve simpler rules. It still needs ownership, collision rules and a
performance check on the target client. See [item simulation evidence](sdk-scene-examples.md#item-simulation-evidence)
for the inspected Cannon example, dependencies and reuse limits.

**Generous targets and meaningful zones:** a detailed model can have a simpler interaction
shape, helping players select a station or enter a checkout, damage or delivery area. Blocking,
selection and zone detection are separate choices; appearance alone does not define them, and
animated shapes do not automatically deform their colliders. Native `TriggerArea` provides an
enter/stay/exit route for players or chosen objects. Give a thin visible floor enough detection
space to register a player. Overlapping zones and teleports can leave stale exit events, so base
persistent effects on current occupancy when that matters. The
[interaction guidance](https://github.com/decentraland/sdk-skills/blob/main/add-interactivity/SKILL.md)
and official trigger example were inspected, not tested on every client/version.
Implementation: `add-interactivity`; `add-3d-models` for model colliders.

## Make actions and outcomes readable

**Scene HUDs:** players can read orders, choose responses and track counters or feedback while
acting in the world. The interface can adapt to screen size and safe areas. This is scene UI, not browser DOM
or exclusive full-screen control: Explorer UI can appear above it, and the player can hide scene
UI. A full-screen pointer handler can also take input intended for the world. Keep the required
information in the GDD; leave widget code to `build-ui`. Validate touch targets and overlap with
client controls on the intended device. Implementation: SDK React-ECS through `build-ui`.
Source: [onscreen UI](https://docs.decentraland.org/creator/scenes-sdk7/2d-ui/onscreen-ui).

**Labels above players:** players can recognize roles, teams or public game status above the
normal player name through `AvatarNametag`. It changes the scene's presentation, not the player's account or team state.
The [public documentation](https://github.com/decentraland/docs/blob/5a25e287f0440486196afa2bb3067608249547a8/creator/sdk7/interactivity/avatars/avatar-nametags.md)
requires SDK **7.28.0+**. The official [client comparison](https://docs.decentraland.org/creator/build-for-mobile/mobile-client/missing-features)
lists it as missing on mobile v1.15.0 (October 2026). For mobile, investigate a scene UI roster
or an attached world label, including legibility. Who assigns roles and who should see each label
remain game decisions. If hiding names matters, check the target renderer: the old example and
newer documentation differ. [Nametag evidence](sdk-scene-examples.md#nametag-evidence)
retains that conflict and the example's version history.

**Night, candles and local light:** players can find relightable safe spots, follow a changing
route cue or avoid a searchlight. Scene time and `SkyboxTime` can change global lighting. They do not establish complete darkness or candle-only visibility. Point/spot
`LightSource` components illuminate the scene; a lamp embedded in a GLTF or an emissive surface
is not equivalent. An emissive cue can remain useful even when dynamic lighting is reduced.
Sources: [skybox](https://docs.decentraland.org/creator/scenes-sdk7/interactivity/skybox-control),
[lights](https://docs.decentraland.org/creator/scenes-sdk7/3d-content-essentials/lights).
Implementation: `lighting-environment`. Check the visual result on the intended graphics profile.
Detection and success rules are scene logic, separate from the light's appearance.

**Lighting depends on the target graphics profile.** Some profiles can disable lights or
shadows. Provide another readable cue when those profiles are part of the audience; otherwise
record the dependency. Published light budgets also need a focused check before promising an
exact count. [Lighting evidence](sdk-scene-examples.md#lighting-evidence) retains the different
limits and their source scopes.

**Materials and effects:** players can recognize a selected tool, a damaged machine or a changed
state through its appearance. A scene can change the whole model or named parts without
rebuilding the mesh, when the model supports the chosen override. An emissive material remains
different from a light. These public controls do not establish access to arbitrary custom shaders or renderer
post-processing. Implementation: PBR/unlit materials and `GltfNodeModifiers`; source:
[advanced-rendering](https://github.com/decentraland/sdk-skills/blob/main/advanced-rendering/SKILL.md).

**Smoke, sparks and other particle cues:** a pot boiling over, a machine starting or a recent
event can become easier to notice through native `ParticleSystem` and
[particle presets](https://github.com/decentraland/sdk-skills/blob/main/particle-system/references/particle-presets.md)
These are visual signals; collision and game outcomes need their own rules. The
[particle guidance](https://github.com/decentraland/sdk-skills/blob/main/particle-system/SKILL.md)
documents mobile support, but particles are visible only inside the scene's parcels and are
absent from its LOD silhouette. Appearance and performance need the chosen client/profile.
If an effect depends on a particle budget, check it before committing: published limits conflict.
[Particle evidence](sdk-scene-examples.md#particle-evidence) retains the example and exact uncertainty.

## Carry things and create characters

**Held items and gestures:** players can carry a visible package or tool while moving, helping
teammates recognize their task without opening a menu. `AvatarAttach` and upper-body emotes
provide an implementation route. Full-body interruption rules do not apply to every masked animation.
The visible attachment is not an inventory, ownership transfer or shared game state. The remaining
work includes grip/readability, pickup/drop states and cross-client presentation. Source:
[player-avatar](https://github.com/decentraland/sdk-skills/blob/main/player-avatar/SKILL.md).
Implementation: `player-avatar` and `avatar-animations`.
Choose an attachment that stays readable during the intended movement and gesture.

**NPCs:** players can meet a greeter, serve a customer or react to an enemy with dialogue,
movement and authored behavior. An avatar-style character or a custom model offers different
visual and animation options. The toolkit supplies building blocks; the game still defines
customer or enemy logic. Player emotes, AvatarShape expressions and GLB Animator
clips are different playback paths. The upstream NPC skill records limitations on custom looping
and upper-body masks for AvatarShape; inspect them before choosing an animation-dependent design.
Implementation: `AvatarShape`, or a GLB with the NPC Toolkit. Source: [npcs](https://github.com/decentraland/sdk-skills/blob/main/npcs/SKILL.md).
For planned behavior, follow the [HTN finding](dcl-capability-links.md#htn-bots-and-reusable-logic).

The [NPC patterns](https://github.com/decentraland/sdk-skills/blob/main/npcs/references/npc-library.mdc)
include authored waypoint movement and direct following. Those are useful for a customer route
or an enemy in an open space; they do not establish obstacle-aware pathfinding. A changing
kitchen layout needs a navigation implementation or deliberately simpler movement rules.
Inspect that missing piece when it matters rather than researching the whole NPC stack again.
Some older patterns use legacy networking; use the maintained shared-state route for new work.

## Use sound and video

**Audio cues and media surfaces:** an off-screen warning, a machine rhythm or an in-world
instruction screen can help players notice and act. Local clips, streams and video are available
routes. Spatial sound does not automatically stay inside a room; distance-based volume or
activation may be needed. Media formats, host access and loading still matter. A sequence that
depends on a finish event needs recovery when media fails.
Implementation: `AudioSource`, `AudioStream` and `VideoPlayer`; source:
[audio-video](https://github.com/decentraland/sdk-skills/blob/main/audio-video/SKILL.md).

**Audio-reactive play:** a pulse cue or reactive installation can respond to a scene track.
`AudioAnalysis` provides amplitude and frequency bands from an entity's audio component;
detecting exact beats or scoring rhythm still needs game logic and timing checks.
It does not expose the player's microphone or recognize words. The upstream
skill distinguishes progressive video from HLS analysis and warns that silence and missing
support can both produce zeros. Source and implementation:
[audio-analysis](https://github.com/decentraland/sdk-skills/blob/main/audio-analysis/SKILL.md).
If play must also work without audio, provide a readable alternative. Official [docs change b4d4c88](https://github.com/decentraland/docs/commit/b4d4c88191f3d65fc2214f586c86dfb9447ce55e)
records AudioAnalysis and AudioEvent support in mobile v1.14.0; an unqualified “desktop only”
claim is outdated. For a speaking indicator rather than audio analysis, see the separate
[voice activity finding](dcl-capability-links.md#voice-and-communication).

## UI journeys, typography and reusable scene routes

**A readable themed interface:** HUDs, choices and world signs can share a visual identity
through custom fonts (`fontSrc`). The [UI text documentation](https://github.com/decentraland/docs/blob/5a25e287f0440486196afa2bb3067608249547a8/creator/sdk7/2d-ui/ui_text.md)
requires SDK **newer than 7.30.1** and a usable fallback font. Mobile uses the fallback; Desktop
and Bevy web have different asset-loading routes. Plan glyph coverage, readable dimensions and
font redistribution rights. Supplied icon art can help a symbol read consistently across clients.
Use the [typography route](sdk-scene-examples.md#interfaces-media-and-client-journeys) for file,
bundle and layout details.

**Continue after a client panel closes:** a tutorial can invite the player to open the backpack
or map, then restore its next instruction. SDK **7.30.0+** provides `openExplorerUiAndWait()`.
Plan for refusal and timeout as well as closure; closing a panel does not establish a purchase
or equipment change. Check the intended game condition separately. See the
[client-panel route](sdk-scene-examples.md#loading-and-returning-from-client-ui) for outcomes,
source and version history.

**Portals and take-away links:** a hub can request a move to a parcel in a named realm or World;
clipboard can help a player carry a link or session code. Public clipboard is documented from
SDK **7.12.0**, realm-targeted `teleportTo` from **7.28.0**. Request, refusal and arrival are
different states. A portal does not transfer inventory or progress by itself. Permissions depend
on the type of experience; a normal LAND/World scene differs from a portable experience.
Use the [journey route](sdk-scene-examples.md#interfaces-media-and-client-journeys) for the
release sources and [permission scope](sdk-scene-examples.md#portal-permission-evidence).

## More scene building blocks

**Nearby actions and sight:** a generous nearby action can make a door, pickup or workstation
easier to use. Choose how neighboring stations compete for that action. A raycast can support
an aimed tool, line-of-sight check or obstacle probe; the game still defines vision and damage.
Implementation: [nearby actions and sight](sdk-scene-examples.md#nearby-actions-and-sight-queries).

**Moving challenges and changing stages:** authored movement can create a sliding counter,
machine cycle, timed crossing or follower. Contact, cancellation and shared ownership remain
game rules. A moving deck or lift has a concrete route: Unity client code carries the local
avatar through platform movement and rotation. Godot has a merged follow fix, but its shipping
mobile version is not established here. Local riding, shared platform motion and how teammates
see each other are separate questions; the last two are not proved by that fix. Use the
[moving-platform evidence](sdk-scene-examples.md#riding-moving-platforms) before researching again,
then check only what the chosen game still needs. World labels can keep stations readable,
and hiding a group can reveal a clue set or completed stage. Hiding does not by itself disable
collisions or actions. Implementation: [object sequences](sdk-scene-examples.md#move-objects-and-sequence-their-actions)
and [labels and groups](sdk-scene-examples.md#world-labels-and-visible-groups).

**Ready cues and optional feedback:** a loading state can explain why a room or action is not
ready; a voluntary question after a round can help locate confusion. Match readiness to the
asset/action needed, and let feedback serve the study rather than gate play.
Implementation: [loading](sdk-scene-examples.md#loading-and-returning-from-client-ui),
[feedback and progress](sdk-scene-examples.md#shared-play-progress-and-observation).

The [75-scene catalogue](sdk-scene-examples.md#routes-from-the-complete-75-scene-pass) retains
further implementation candidates and their limits. Open the relevant route when a chosen
mechanic needs implementation or a specific gap affects its design; the examples were not run here.

## Client differences and open coverage

The [mobile gap list](https://docs.decentraland.org/creator/build-for-mobile/mobile-client/missing-features)
was reviewed for v1.15.0, October 2026. It records remaining movement/collision/moving-platform
differences, missing AvatarNametag and TweenSequence, and lack of official Smart Items support.
YouTube/Google Drive video URLs are unsupported there. These conditions guide the affected
interaction; they are not genre-wide prohibitions. Omission from that page alone does not prove
feature support. Check newer releases when a listed gap matters.

Coverage still needing a focused lookup when relevant:

- Custom shaders/post-processing beyond the documented material overrides; distinguish public
  scene APIs from renderer internals.
- Target-client behavior and budgets for the selected particle or physics effect; the inspected
  API/examples do not establish performance, multiplayer authority or reuse permission.
- Obstacle-aware NPC navigation in the intended layout; authored paths and direct following are
  established routes, dynamic pathfinding remains a focused lookup.
- Detailed animation authoring and Bevy/VR parity: `avatar-animations` and target-client sources.

### Further social and asset directions

Teammates indicating a location, multilingual chat and expressive greetings can help social play.
Native player controls and scene-authored interactions have different integration routes; client
features alone do not establish SDK access to markers or chat messages. Reusable models,
animations and sounds may reduce implementation work after checking fit and rights.
Use [further implementation leads](sdk-scene-examples.md#further-implementation-leads) when one
of these directions needs a specific source or catalogue.
