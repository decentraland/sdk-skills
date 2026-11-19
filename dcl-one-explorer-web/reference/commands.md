# Command map: Unity Explorer MCP tool to dcl-one Explorer console line

The shared scene test scripts (the `sdk7-test-scenes` repository's `MCP_SHOWCASE.md` and the
scene READMEs) are written against the Unity Explorer's MCP tools. Each row gives the console
line that does the same on the dcl-one Explorer and the reply fields the script reads. Argument
details live in the running client: `/help /<command>`. A tool name maps as `x_y` to `/x_y` and
an argument `camelCase` to `--kebab-case` unless the row says otherwise.

## Seeing and state

| Unity tool | Console line | Reply fields the scripts read |
| --- | --- | --- |
| `screenshot {maxWidth, jpg, worldOnly}` | `/screenshot --max-width N --jpg --world-only` | JSON `image` (base64), `caption` (frame size, `screen`, parcel, a camera-transition wait). Without any option: raw base64 PNG at full size |
| `capture_sequence {count, intervalSec, maxWidth}` | `/capture_sequence --count N --interval-seconds S --max-width N [--jpg] [--dir path]` | `frames[]` with `path` (or `savedTo`), `tick`, `late`; never inline images. Natively files; on the web memory, read one with `/capture_frame <path>` |
| `get_player_state` | `/player_state` | `position`, `rotation`, `parcel`, `velocity`, `grounded`, `camera.mode`, camera pose, `cameraRotationEuler`, `modeChangeAllowed`, `heldBy`, `pointerLocked` |
| `get_scene_state` | `/scene_state` | `sceneId` (hash), `title`, `parcel`, `state`, `isReady`, `loadingStage`, `sdkVersion` |
| `get_scene_logs {limit, sinceSeq, severity, includeClient}` | `/scene_logs [count] [--since seq] [--severity level] [--client]` | header `latestSeq=N dropped=N source=scene`, then lines; `[client:<target>]` lines with `--client` |
| `get_reticle` | `/get_reticle` | `kind`, `crdtEntityId`, `hitPoint`, `withinRange`, `hoverText`, `cursorLocked`, `rayFromScreenCenter`, `cursor`, `screen` |
| `get_audio_state {onlyPlaying}` | `/audio_state [--only-playing]` | per emitter `crdtEntityId`, `requested`, `playing`, `state`, `volume.authored`, `volume.live`, `loop`, `spatial`, `currentTime`, `duration`, distance; a `summary`. Nearest first; the scene under the player only |
| `get_visible_entities {limit}` | `/visible_entities [--limit N] [--min-coverage F]` | `crdtEntityId`, `screenRect`, `center` (normalized), `coverage`, distances, `screen`. Frustum and bounds only, no occlusion |
| `list_scene_entities` | `/scene_entities --labels [--name text]` | `crdtEntityId` with `gltf <src>`, `mesh Box`, `text "<excerpt>"`, `hidden`, `parent <id>` |
| `get_entity_details` (a board's text) | `/inspect_component <crdtId> TextShape` (components: `/entity_components <crdtId>`) | the component's fields (`text`) |
| `get_performance_stats` | `/performance_state` | frame-rate target and override |
| `get_scene_content_stats` | `/current_scene_content` | counts |

## Controlling the player and the camera

| Unity tool | Console line | Reply fields the scripts read |
| --- | --- | --- |
| `teleport {parcel, waitForReady}` | `/teleport x y [realm] --wait [--timeout-seconds S]` | `arrived`, `sceneReady`, `sceneHash`, `settled`, `sceneState`, `ticksWaited`, `renderedFrames`, `settleMs`; `settled:false` with a `warning` naming what it waited for |
| `move_to {x, y, z, lookAt}` | `/move_to x y z [--look-at x y z]` | the settled pose; `aimErrorDegrees` with `--look-at` |
| `walk {directionX, directionY, seconds, kind, jump, ignoreInputModifiers}` | `/walk dx dy [--seconds S] [--kind walk\|jog\|run] [--jump] [--ignore-input-modifiers]` | `startPosition`, `endPosition`, `distance`, `parcel`, `seconds`, `modifierActive`, `modifier` |
| `look_at {x, y, z}` | `/look_at x y z` | `aimErrorDegrees`, `warning` (pitch clamp or third-person orbit) |
| `camera_look {deltaX, deltaY, seconds}` | `/camera_look dx dy [--seconds S]` (degrees per second) | final euler, the rate |
| `set_camera_mode {mode}` | `/set_camera_mode first_person\|third_person\|free` | mode before and after, once the transition has landed; refused naming the `CameraModeArea` or `VirtualCamera` holding the view; `drone` is not a mode here |
| `set_camera_pose {x, y, z, lookAt*, fov, timeoutSec}` | `/set_camera_pose x y z [--look-at x y z] [--fov F] [--timeout-seconds S]` | `position`, `rotationEuler`, `fov`, `mode` (`free`), `settled`, `opened`, `lookAt`, `aimErrorDegrees`; opens the free camera when needed |
| `send_chat` | `/chat nearby "<text>"` | |
| `reload_scene` | `/reload --current --wait` | `settled`, `sceneState`, `ticksWaited`, `renderedFrames`, `warning` |
| `trigger_emote` | `/emote <urn> [--loop]` | |

## The world pointer

| Unity tool | Console line | Reply fields the scripts read |
| --- | --- | --- |
| `click_entity {entityId \| x,y,z, button, eventType, timeoutSec}` | `/click_entity [<id>] [--at x y z] [--bounds] [--button pointer\|primary\|secondary] [--event click\|down\|up] [--timeout-seconds S]` | `hit` (`entity`, `container`, `scene`, `playerDistance`, `cameraDistance`), `crdtEntityId`, `hitPoint`, `distance`, `hoverText`, `blockedByUi`, `rootBroadcast`, `button`, `entries`, `events[]` (`event`, `button`, `tick`), `diagnosis`, `warning`. A miss: `{"refused", "cause": {"rootBroadcast": false}}` |
| `click_at {x, y, force}` | `/click_at x y --normalized [--button] [--force]` | `x`, `y`, `normalized`, `button`, `screen`; refused with `hit:false` and `blockedByUi` naming the scene UI element |
| `hover_entity {entityId \| x,y,z, seconds}` | `/hover_entity [<id>] [--at x y z] [--seconds S]`; `/hover_entity --clear` ends any aim | as the click, with `hoverText`; `diagnosis` `out of reach: ...` when the hover entry is past its distance |
| `press_input {action, holdSeconds, entityId \| x,y,z}` | `/press_input <action> [--hold S] [--entity id] [--at x y z]` | the click's reply plus `action`, `entityBound`, `aimed`, `holdSeconds`, `rootEvents[]`, `hint` |
| `sweep_pointer {entityId, deltaX, deltaY, seconds}` | `/sweep_pointer --entity <id> \| --at x y z --dx D --dy D --seconds S` | the hit at the press and at the release, `swept` (degrees) |

Diagnoses are resolved replies with `diagnosis` set, not failures: `blocked by entity <id>`,
`blocked by an avatar or another scene's entity`, `out of reach: ...`, `entity not live`, `input
held by the HUD`, `timed out waiting for target|hover|tick|release`.

## Scene UI

| Unity tool | Console line | Reply fields the scripts read |
| --- | --- | --- |
| `ui_list {stack: sdk}` | `/ui_list [--kind input\|dropdown\|scroll\|pointerTarget\|text] [--limit N]` | per element `crdtId`, `kind`, `screenRect` (logical pixels), `center` (normalized), `disabled`, `pointerEventTypes`, text, value or options, `coveredBy`; `screen`. The HUD (`stack: ugui`) is `/hud_list` instead |
| `ui_click {crdtId, device, force}` | `/ui_click <crdtId> [--device] [--force]` | `delivered` (`enter`, `down`, `up`: `consumed`, `not_declared`, `not_sent`, `not_drained`); refused with `blockedBy` or the disabled state |
| `ui_set_text {crdtId, text, submit, optionIndex}` | `/ui_set_text <crdtId> --text "<text>" [--submit]`; `--option-index N` or `--text <option>` for a dropdown | `delivered`; a disabled element is refused |
| `ui_scroll {crdtId, dx, dy}` | `/ui_scroll <crdtId> [--dx px] [--dy px]` | `before`, `after`, `max`, `clamped`, `info`, `delivered` |
| `ui_drag {fromX, fromY, toX, toY, durationFrames, path}` | `/ui_drag --from x y --to x y [--duration-frames N] [--path auto\|sdk\|device]` | `pointerOver` {start, end}, `delivered` {down, up}, `entered`, `left` |
| `ui_hover {crdtId, leave, force}` | `/ui_hover <crdtId> [--force]`; `/ui_hover --leave` | `left`; the next gesture's reply carries `hoverEnded` |

## Differences by design

Where a script expects Unity's behaviour, the dcl-one client answers differently on purpose; report
the difference, do not work around it:

- A world aim that reaches nothing is refused without a press; Unity posts a `PET_DOWN` to the
  scene root on a miss.
- A press on an entity that declares no entry for the button goes to the scene root with a
  `warning` in the reply.
- `camera_look` is in degrees per second, so a turn is the same at any frame rate.
- The free camera is photo mode's: `/set_camera_pose` lands the same frame (no blend), through
  walls, and `/look_at` and `/camera_look` turn it while it holds the view; its pitch clamp is
  straight up or down. The movement keys fly it from there, within 50 m of the player.
- `warning` is absent rather than `null` when there is none.
- World aims pass through scene UI (`blockedByUi` stays false); only `/click_at` is taken by it.
- A capture sequence on the web stays in the engine's memory (`/capture_frame` reads a frame).
- `/click_entity` ends a parked UI hover before it runs (`hoverEnded` in its reply).
- Commands run one at a time on one transport, so a second capture overlapping a running one
  needs a second transport to provoke.
