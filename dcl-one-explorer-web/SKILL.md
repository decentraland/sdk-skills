---
name: dcl-one-explorer-web
description: "Drive a running dcl-one Explorer (the Bevy-based Decentraland client, desktop or web) through its console to screenshot, walk, click and debug an SDK7 scene in-world. Use when the user wants a scene tested in dcl-one, names the Bevy Explorer or its console, or gives an automation token or port. For the Unity Explorer's MCP server use unity-explorer-mcp."
---

# dcl-one Explorer console

The dcl-one Explorer has no MCP server: its agent surface is the in-game console, which every
build answers from outside the process. The user runs the client; the scene code itself comes
from the SDK7 topic skills (`sdk-scenes` is the entry point).

## Reach the console

**Desktop or headless client** (the normal case): started with `--automation-token <token>` (or
`DCL_AUTOMATION_TOKEN`; `--automation-port`, default 15702), it serves JSON-RPC on
`http://127.0.0.1:<port>/`. [`scripts/console.sh`](scripts/console.sh) runs one line and waits for
its reply: `console.sh '/world_state'` prints the output and exits non-zero on `ok:false`;
`console.sh --image out.jpg '/screenshot --max-width 640 --jpg'` writes the frame to disk and
prints the caption. Set `DCL_AUTOMATION_TOKEN`, and `DCL_AUTOMATION_PORT` when not 15702. A
connection refused means no client runs with the loopback console: name the flag to the user and
stop there, offering the drive harness below when the dcl-one repository is present.

**Web client**: the app frame exposes `window.engine_console_command(line)`, a promise that rejects
on failure. Reach it through a browser you already drive (a DevTools session, a browser MCP tool).
Without a DevTools client `/press_key` and `/click_at` are synthetic (`"input": "synthetic"` in the
reply).

**Drive harness** (the dcl-one repository, no client running): in `apps/bevy-explorer/e2e`,
`pnpm run drive --scene <scene dir> --position x,y < commands.txt` serves a built scene on a
loopback realm, boots the web client in scene preview (so the preview-only commands are there) and
runs each stdin line, one JSON reply per line. Its README has the prerequisites; it is the only
path that needs a build.

## The catalogue is the running client

`/help` lists every command with a line each; `/help /<command>` prints its full argument help.
Read that help before the first call of a command and take argument names from it.
[`reference/commands.md`](reference/commands.md) is **the map**: each Unity Explorer MCP tool
(which the shared `sdk7-test-scenes` scripts use) to its console line, with the reply fields the
help does not show.

## The wire

- A line splits on whitespace; a double-quoted run is one argument (`/chat nearby "two words"`).
  Inside quotes `\"` and `\\` escape; a single quote is an ordinary character.
- A failed command is `ok:false` on the loopback and a rejected promise on the web; the text
  carries no marker. A command that did nothing is **refused**: JSON `{"refused": "<reason>",
  "cause": {...}}`, the cause naming what stood in the way (the covering element, the camera mode
  area, the disabled input, the **holder**). A command that did what was asked but may surprise
  you adds `warning`.
- Commands wait for their own effect, bounded by `--timeout-seconds`, and reply what they
  observed; a timeout reply says what it waited for. The reply is the answer to whether the
  command took effect.
- Positions are normalized, 0 to 1 from the top left; a command with a `--normalized` flag takes
  logical pixels until you pass it. Every reply with a screen position carries `screen`
  `{width, height, scale}`: a screenshot has `scale` times the logical pixels.
- SDK entity ids are the only id space; read them from `crdtEntityId`.
- `/screenshot` without options is raw base64 PNG at full size: pass `--max-width` and `--jpg`, and
  write it to disk with `console.sh --image`.
- A world-aimed pointer call that reaches nothing is refused without pressing
  (`rootBroadcast:false`). A press on an entity with no entry for that button goes to the scene
  root with a `warning`.

## Holders

One command holds the pointer at a time, and the camera commands (`/camera_look`, a waiting
`/move_player_to`, a `/camera_mode` into or out of `free`) share a second holder; capture shares a
third (a one-shot `/screenshot` and a `--count` sequence). A command that needs a busy holder is
refused with `cause.holder` (`pointer`, `camera`, ...) and `cause.command` naming who holds it, and the
reason says how it comes free: wait for that command's reply, `/hover_entity --clear`, or
`/ui_click --event leave`. Free it that way, then send the command again.

**A parked hover holds the pointer.** `/ui_click <id> --event hover` keeps its element hovered
until `/ui_click --event leave` or the next gesture, whose reply carries `hoverEnded`. A
`/click_at` on the canvas is such a gesture; one on the HUD leaves the hover parked.

## The loop

1. **Arrive**: `/teleport <x> <y> --wait` (a realm url as the third argument when needed). Done
   when `arrived`, `sceneReady` and `settled` are true and `/scene_loading_state` answers
   `isReady:true`; keep its `sceneHash`.
2. **Baseline**: `/scene_logs 50` and keep the header's `latestSeq` as your **cursor**; later reads
   pass `--since <cursor>` so you see only new lines. `--client` adds the engine's warnings and
   errors (`[client:<target>]`), `--severity error` filters. A scene's `[INIT]` lines name the ids
   of its boards and targets.
3. **See**: give the scene about 15 s after arrival before the first screenshot that must show it
   drawn. `/scene_entities --visible` says what is in frame, `/scene_entities --labels` what each
   entity shows, `/ui_list` the scene UI with its rects.
4. **Act** with the command the map names, one at a time; a refusal naming a holder is handled as
   **Holders** says.
5. **Verify on two channels**: the command's reply (the hit's `crdtEntityId`, `events` with their
   ticks, `delivered`) and the scene's own word (a board's text through
   `/inspect_component <crdtId> TextShape`, or a log line since your cursor). A step is verified
   when both channels agree; a non-deterministic value is reported as observed.
6. **Report** what each step showed, quoting the reply fields and the log lines. A difference from
   the expected behaviour is a finding for the user; a new engine defect goes through the
   `report-sdk-issue` skill before any workaround.

## What the help does not tell you

- **Aim from first person.** In third person the camera sits about 1 m right of and 4.7 m behind
  the avatar, and low after an upward look, so near targets and the avatar itself get in the way
  of world aims and sweeps. Read `/player_state` `modeChangeAllowed` (and `heldBy`), then
  `/camera_mode first_person` before aiming at targets closer than a few metres.
- **Sweep a build from the free camera.** `/camera_mode free` with a `--position` and `--look-at`
  places photo mode's camera anywhere at once, and it stays put while the player moves: an aerial
  plan, each facade and an interior are a pose and a `/screenshot` each, no walking. It is a debug
  view: restore `/camera_mode third_person` (or the mode you found) before pointer work, before
  any screenshot that stands for what a player sees, and before you finish.
- **Scene UI ids change when a panel is drawn again.** Take the ids from a fresh `/ui_list` right
  before `/ui_click` or `/ui_write`, and again after an action that redraws the panel.
- **World aims pass through scene UI.** `/click_entity --at` and `/hover_entity --at` ignore UI
  under the cursor (`blockedByUi` stays false); `/click_at` is the call scene UI can take, refused
  with `blockedByUi` naming the element unless `--force`; `/ui_list --at x y` says what sits there.
- **`/walk` goes through the movement input**, with the walk or run key for the gait; it reports
  `distance` and whether an `InputModifier` froze movement (`modifierActive`, `modifier`;
  `--ignore-input-modifiers` bypasses it). It leaves the player transform to the engine;
  `/move_player_to` (preview builds) does what a scene's `movePlayerTo` does.
- **Euler angles are Decentraland's**: `cameraRotationEuler.x` is the pitch, looking down
  positive. `/camera_look --at` replies `aimErrorDegrees` and a `warning` when the pitch clamp or
  the third-person orbit keeps the point off.
- **`/click_entity --button` actions are lowercase** (`primary`, `jump`, `action_3`); with no
  target the press is unaimed, lands wherever the cursor is and says where it went
  (`entityBound`, `rootEvents`, `hint`).
- **Known engine gaps**: name them in the report as known and move on. A hover leave is written
  for an entity that was never entered; a controlled `UiInput` keeps the typed text after the scene
  resets its `value`; a finished `AudioSource` sends no event and keeps `playing:true` in the
  scene's view (`/media_state --audio` shows the engine's `state:"ended"` beside the scene's
  `requested`); on the web the scene's `PointerLock` drops as soon as the platform reports the
  cursor unlocked.
