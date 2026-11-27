# Command map: Unity Explorer MCP tool to dcl-one Explorer console line

The shared scene test scripts (the `sdk7-test-scenes` repository's `MCP_SHOWCASE.md` and the
scene READMEs) are written against the Unity Explorer's MCP tools. Each row gives the console
line that does the same on the dcl-one Explorer and the reply fields the script reads. The
console keeps a small set of commands, so several tools map to one command with a flag: take the
line from the row, never from the tool's name. An argument `camelCase` is `--kebab-case` unless
the row says otherwise.

## Seeing and state

| Unity tool | Console line | Reply fields the scripts read |
| --- | --- | --- |
| `screenshot {maxWidth, jpg, worldOnly}` | `/screenshot --max-width N --jpg --world-only` | JSON `image` (base64), `caption` (frame size, `screen`, parcel, a camera-transition wait) |
| `capture_sequence {count, intervalSec, maxWidth}` | `/screenshot --count N --interval-seconds S --max-width N [--jpg] [--dir path]` | `directory`, `frames[]` with `path`, `tick`, `late` (a frame the encoder fell behind on comes late, never dropped); never inline images. Natively files; on the web memory, read one with `/screenshot --frame <path>`. A reused `--dir` keeps an earlier sequence's frames: `staleFrames` and a `warning`, so read only the listed paths. A `--dir` that cannot be made is refused |
| `get_player_state` | `/player_state` | `position`, `rotation`, `parcel`, `velocity`, `grounded`, `camera.mode`, camera pose, `cameraRotationEuler`, `modeChangeAllowed`, `heldBy`, `pointerLocked`; `gestures` (what is running or held); `reticle` (next row) |
| `get_scene_state` | `/scene_loading_state` | `isReady`, `state` (`loading`, `starting`, `running`, `blocked`, `broken`, `failed`, `refused`, `none`), `blockedBy`, `sceneHash`, `playerParcel`, `outOfWorld`, `stage`; `unavailable` says why a field is null. Title, SDK version and tick: `/current_scene_state` |
| `get_scene_logs {limit, sinceSeq, severity, includeClient}` | `/scene_logs [count] [--since seq] [--severity level] [--client]` | header `latestSeq=N dropped=N source=scene`, then lines; `[client:<target>]` lines with `--client` |
| `get_reticle` | `/player_state`, its `reticle` section | `available`, `kind`, `crdtEntityId`, `hasPointerEvents`, `withinRange`, `hoverText`, `cursorLocked`, `rayFromScreenCenter`, `cursor`, `ray`, `screen`, both distances. A pure read: no hover, no press |
| `get_audio_state {onlyPlaying}` | `/media_state --audio [--only-playing]` | per emitter `crdtEntityId`, `requested`, `playing`, `state`, `volume.authored`, `volume.live`, `loop`, `spatial`, `currentTime`, `duration`, distance; a `summary`. Nearest first; the scene under the player only. Without `--audio` the reply is the stream and video list |
| `get_visible_entities {limit}` | `/scene_entities --visible [--limit N] [--min-coverage F]` | `crdtEntityId`, `screenRect`, `center` (normalized), `coverage`, distances, `screen`. Frustum and bounds only, no occlusion |
| `list_scene_entities` | `/scene_entities --labels [--name text]` | `crdtEntityId` with `gltf <src>`, `mesh Box`, `text "<excerpt>"`, `hidden`, `parent <id>` |
| `get_entity_details` (a board's text) | `/inspect_component <crdtId> TextShape` (components: `/entity_components <crdtId>`) | the component's fields (`text`) |
| `get_performance_stats` | `/performance_state` | frame-rate target and override |
| `get_scene_content_stats` | `/current_scene_content` | counts |

## Controlling the player and the camera

| Unity tool | Console line | Reply fields the scripts read |
| --- | --- | --- |
| `teleport {parcel, waitForReady}` | `/teleport x y [realm] --wait [--timeout-seconds S]` | `arrived`, `sceneReady`, `sceneHash`, `settled`, `sceneState`, `ticksWaited`, `renderedFrames`, `settleMs`; `settled:false` with a `warning` naming what it waited for. A parcel whose scene refuses the player (a scene or world ban) settles on landing with `sceneState:"refused"` and a `warning` |
| `move_to {x, y, z, lookAt}` | `/move_player_to x y z --look-at x y z [--timeout-seconds S]` (preview builds only) | the settled pose; `aimErrorDegrees`. Without a flag it replies a sentence and does not wait |
| `walk {directionX, directionY, seconds, kind, jump, ignoreInputModifiers}` | `/walk dx dy [--seconds S] [--kind walk\|jog\|run] [--jump] [--ignore-input-modifiers]` | `startPosition`, `endPosition`, `distance`, `parcel`, `seconds`, `modifierActive`, `modifier` |
| `look_at {x, y, z}` | `/camera_look --at x y z [--timeout-seconds S]` | `target`, `aimErrorDegrees`, `settled`, `warning` (pitch clamp or third-person orbit) |
| `camera_look {deltaX, deltaY, seconds}` | `/camera_look --dx D --dy D [--seconds S]` (degrees per second) | `turned`, `cameraRotationEuler`, the rate |
| `set_camera_mode {mode}` | `/camera_mode first_person\|third_person\|free` | mode before and after, once the transition has landed; refused naming the `CameraModeArea` or `VirtualCamera` holding the view; `drone` is not a mode here |
| `set_camera_pose {x, y, z, lookAt*, fov, timeoutSec}` | `/camera_mode free [--position x y z] [--look-at x y z] [--fov F] [--timeout-seconds S]` (`--fov` 10 to 120) | `position`, `rotationEuler`, `fov`, `mode` (`free`), `settled`, `opened`, `lookAt`, `aimErrorDegrees`; opens the free camera when needed. A `--position` more than 50 m from the player is refused (`cause.limit` `reach`); if the player moves off while the camera opens, it lands at the nearest point in reach with `settled:false` and a `warning` |
| `send_chat` | `/chat nearby "<text>"` | |
| `reload_scene` | `/reload --current --wait` | `settled`, `sceneState`, `ticksWaited`, `renderedFrames`, `warning` |
| `trigger_emote` | `/emote <urn> [--loop]` | |

## The world pointer

| Unity tool | Console line | Reply fields the scripts read |
| --- | --- | --- |
| `click_entity {entityId \| x,y,z, button, eventType, timeoutSec}` | `/click_entity [<id>] [--at x y z] [--bounds] [--button <action>] [--event click\|down\|up] [--hold S] [--timeout-seconds S]` | `hit` (`entity`, `container`, `scene`, `playerDistance`, `cameraDistance`), `crdtEntityId`, `hitPoint`, `distance`, `hoverText`, `blockedByUi`, `rootBroadcast`, `button`, `entries`, `events[]` (`event`, `button`, `tick`), `diagnosis`, `warning`. A miss: `{"refused", "cause": {"rootBroadcast": false}}` |
| `click_at {x, y, force}` | `/click_at x y --normalized [--button] [--force]` | `x`, `y`, `normalized`, `button`, `screen`, `hoverEnded` when it ended a parked UI hover; refused with `hit:false` and `blockedByUi` naming the scene UI element |
| `hover_entity {entityId \| x,y,z, seconds}` | `/hover_entity [<id>] [--at x y z] [--seconds S]`; `/hover_entity --clear` ends any aim | as the click, with `hoverText`; `diagnosis` `out of reach: ...` when the hover entry is past its distance |
| `press_input {action, holdSeconds, entityId \| x,y,z}` | `/click_entity [<id>] [--at x y z] --button <action> [--hold S]`; no target presses without aiming | the click's reply plus `action`, `entityBound`, `aimed`, `holdSeconds`, `rootEvents[]`, `hint` |
| `sweep_pointer {entityId, deltaX, deltaY, seconds}` | `/camera_look --entity <id> \| --at x y z --dx D --dy D --seconds S --hold pointer\|primary\|secondary` | `pressed` (its `hit`), `swept` (degrees), `released`, `aimSettled`, `aimErrorDegrees`, `warning`. It holds the pointer until it replies |

Diagnoses are resolved replies with `diagnosis` set, not failures: `blocked by entity <id>`,
`blocked by an avatar or another scene's entity`, `blocked by the player's own avatar: ...` (aim
in first person), `out of reach: ...`, `entity not live`, `input held by the HUD`,
`timed out waiting for target|hover|tick|release`.

## Scene UI

| Unity tool | Console line | Reply fields the scripts read |
| --- | --- | --- |
| `ui_list {stack: sdk}` | `/ui_list [--kind input\|dropdown\|scroll\|pointerTarget\|text] [--limit N]`; `--at x y [--normalized]` names what sits at a point | per element `crdtId`, `kind`, `screenRect` (logical pixels), `center` (normalized), `disabled`, `pointerEventTypes`, text, value or options, `coveredBy`; `screen`; with `--at`, `takenBy`. The HUD (`stack: ugui`) is `/hud_list` instead |
| `ui_click {crdtId, device, force}` | `/ui_click <crdtId> [--device] [--force]` | `delivered` (`enter`, `down`, `up`: `consumed`, `not_declared`, `not_sent`, `not_drained`), `rootEvents[]`; refused with `blockedBy` or the disabled state, and fails before pressing when the element declares no down or up handler (use `--event hover` on a hover-only element) |
| `ui_set_text {crdtId, text, submit, optionIndex}` | `/ui_write <crdtId> --text "<text>" [--submit]`; `--option-index N` or `--text <option>` for a dropdown | `delivered`; a disabled element is refused |
| `ui_scroll {crdtId, dx, dy}` | `/ui_write <crdtId> [--scroll-dx px] [--scroll-dy px]` | `before`, `after`, `max`, `clamped`, `info`, `delivered` |
| `ui_drag {fromX, fromY, toX, toY, durationFrames, path}` | `/click_at x y --normalized --drag-to x y [--duration-frames N] [--path auto\|sdk\|device]` | `pointerOver` {start, end}, `delivered` {down, up}, `entered`, `left` |
| `ui_hover {crdtId, leave, force}` | `/ui_click <crdtId> --event hover [--force]`; `/ui_click --event leave` | `hovering`, `delivered.enter`, `left`; the next gesture's reply carries `hoverEnded` |

## Differences by design

Where a script expects Unity's behaviour, the dcl-one client answers differently on purpose; report
the difference as a finding and keep the dcl-one behaviour:

- A world aim that reaches nothing is refused without a press; Unity posts a `PET_DOWN` to the
  scene root on a miss.
- The skill's wire and gotchas name more: the root fallback for a press with no entry, world aims
  through scene UI, and the parked hover that `/click_entity` or a canvas `/click_at` ends.
- `camera_look` is in degrees per second, so a turn is the same at any frame rate.
- The free camera is photo mode's: a `/camera_mode free` pose lands the same frame (no blend),
  through walls, and `/camera_look` turns it while it holds the view; its pitch clamp is
  straight up or down. The movement keys fly it from there, within 50 m of the player.
- `warning` is absent rather than `null` when there is none.
- A held pointer only paints a stroke through `/camera_look --hold`: a separate press, turn and
  release leaves the ray on its first aim.
- A capture sequence on the web stays in the engine's memory (`/screenshot --frame` reads a frame).
- Every pointer reply lists `rootEvents`: what the scene root got. `rootBroadcast` is true for
  either half of a click, so an element with a down handler only shows a lone up there.
- Commands run one at a time on one transport, so a second capture overlapping a running one
  needs a second transport to provoke.
