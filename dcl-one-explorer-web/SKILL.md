---
name: dcl-one-explorer-web
description: "Drive a running dcl-one Explorer (the Bevy-based Decentraland client, web and desktop) through its console to test, screenshot, walk, click and debug an SDK7 scene in-world, over the loopback console (an automation token and port) or the web page's console. Use when the user wants a scene seen, tested, verified, walked through or debugged in the dcl-one or dcl-one Explorer, names that Explorer or its console, gives an automation token or port, or has a dcl-one Explorer running; for the Unity Explorer's MCP server use unity-explorer-mcp instead."
---

# dcl-one Explorer console

The dcl-one Explorer (the Bevy-based client, on the web and the desktop) has no MCP server. Its agent surface is the in-game console: every build
answers console lines from outside the process, and the running client documents its own
commands. Nothing is installed or launched by this skill. You need a client that is already
running, and the SDK7 topic skills (`sdk-scenes` is the entry point) for the scene code itself.

## Reach the console

**Desktop or headless client** (the normal case): the client was started with
`--automation-token <token>` (or `DCL_AUTOMATION_TOKEN`; `--automation-port`, default 15702).
It then serves two JSON-RPC methods on `http://127.0.0.1:<port>/`, both needing the token:
`dcl/console` queues a line and answers `{"id"}`; `dcl/console_result` with that `id` answers
`{"done": false}` until the command has replied, then `{"done": true, "ok", "output"}`. Use
[`scripts/console.sh`](scripts/console.sh): `console.sh '/world_state'` prints the output and
exits non-zero on `ok:false`; `console.sh --image out.jpg '/screenshot --max-width 640 --jpg'`
writes the frame to disk instead of printing base64. Set `DCL_AUTOMATION_TOKEN` and, when not
15702, `DCL_AUTOMATION_PORT`. A connection refused means no client runs with the loopback
console: tell the user and stop, naming the flag; do not start one.

**Web client**: the page exposes `window.engine_console_command(line)` in the app frame, a
promise that rejects on failure. Reach it only through a browser you already drive (a DevTools
session, a browser MCP tool); the loopback does not exist there, and `/press_key` and `/click_at`
are synthetic without a DevTools client (`"input": "synthetic"` in the reply).

**No client at all** and the dcl-one repository is present: `pnpm run drive --scene <scene dir>
--position x,y < commands.txt` in `apps/bevy-explorer/e2e` serves a built scene on a loopback
realm, boots the web client in scene preview (so the preview-only commands are there) and
runs each stdin line, one JSON reply per line. Its README has
the prerequisites; it is the only path that needs a build.

## The catalogue is the running client

`/help` lists every command with a line each; `/help /<command>` prints its full argument help.
Read that help before the first call of a command, and take argument names from it, never from
memory. [`reference/commands.md`](reference/commands.md) is the map from the Unity Explorer MCP
tool names (which the shared `sdk7-test-scenes` scripts use) to the console lines, with the
reply fields the help does not show.

## The wire

- A line splits on whitespace; a double-quoted run is one argument (`/chat nearby "two words"`).
  Inside quotes `\"` and `\\` escape; a single quote is an ordinary character.
- A failed command is `ok:false` on the loopback and a rejected promise on the web; the text
  carries no marker. A command that did nothing fails with JSON `{"refused": "<reason>",
  "cause": {...}}`, the cause naming what stood in the way (the covering element, the camera
  mode area, the disabled input, the held press). A command that did what was asked but may
  surprise you adds `warning` to its reply.
- Commands wait for their own effect, bounded by `--timeout-seconds`, and reply what they
  observed; a timeout reply says what it waited for. Never poll or sleep to learn whether a
  command took effect.
- Coordinates: new commands take 0 to 1 from the top left; every reply with a screen position
  carries `screen` `{width, height, scale}` (logical pixels; a screenshot has `scale` times as
  many). `/click_at` takes logical pixels, or the normalized form with `--normalized`.
- Durations are `--seconds`; the pointer commands also take `--frames`. `/camera_look` turns in
  degrees per second.
- SDK entity ids are the only id space, reported as `crdtEntityId` (older replies also keep
  `entity`). Readout boards are read with `/inspect_component <crdtId> TextShape`.
- A world-aimed pointer call that reaches nothing refuses without pressing
  (`rootBroadcast:false`). A press on an entity with no entry for that button goes to the scene
  root with a `warning`.
- `/screenshot` alone is raw base64 PNG at full size: always pass `--max-width` (and `--jpg`)
  and write it to disk, never into context. A one-shot and a `--count` sequence share one
  capture gate; a second capture while one runs is refused naming the holder.

## The loop

1. **Arrive**: `/teleport <x> <y> --wait` (a realm url as the third argument when needed) and
   read `arrived`, `sceneReady`, `settled`; then `/scene_loading_state` for `isReady`, `state`, `sceneHash`.
2. **Baseline**: `/scene_logs 50` and keep its header's `latestSeq`; later reads pass it as
   `--since <seq>` so you see only new lines. `--client` adds the engine's warnings and errors
   (`[client:<target>]`), `--severity error` filters. A scene's `[INIT]` lines name the ids of its
   boards and targets.
3. **See**: `/screenshot --max-width 640 --jpg` to disk, about 15 s after arrival before the first
   frame that must show the scene drawn. `/scene_entities --visible` says what is in frame;
   `/scene_entities --labels` what each entity shows; `/ui_list` the scene UI with its rects.
4. **Act** with the command the map names, one at a time. One command holds the pointer at a
   time: another pointer command is refused with `cause.holder` `pointer` and `cause.command`
   naming the holder, and the reason says how it comes free (wait for its reply,
   `/hover_entity --clear`, or `/ui_click --event leave` for a parked hover): do that rather than
   retry. Camera commands share a second holder: a `/camera_look`, a
   waiting `/move_player_to` or a `/camera_mode` into or out of `free` is refused with
   `cause.holder` `camera` while another runs.
5. **Verify on two channels**: the command's reply (the hit's `crdtEntityId`, `events` with their
   ticks, `delivered`) and the scene's own word (a board through `/inspect_component`, or a log
   line since your cursor). A non-deterministic value is reported, never reconciled.
6. **Report** what each step showed, quoting the reply fields and the log lines; a difference
   from the expected behaviour is a finding for the user, and an engine defect is reported with
   the `report-sdk-issue` skill before any workaround.

## What the help does not tell you

- **Aim from first person.** In third person the camera sits about 1 m right of and 4.7 m behind
  the avatar, and low after an upward look, so near targets and the avatar itself get in the way
  of world aims and sweeps. Read `/player_state` `modeChangeAllowed` (and `heldBy`), then
  `/camera_mode first_person` before aiming at targets closer than a few metres.
- **Sweep a build from the free camera.** `/camera_mode free` with a position and `--look-at` places photo
  mode's camera anywhere at once and it stays put while the player moves, so an aerial plan,
  each facade and an interior are a pose and a `/screenshot` each, no walking. It is a debug
  view: restore `/camera_mode third_person` (or the mode you found) before pointer work and
  before any screenshot that stands for what a player sees, and never leave it in `free`.
- **Scene UI ids change when a panel is drawn again.** Take the ids from a fresh `/ui_list`
  right before `/ui_click` or `/ui_write`, and again after an
  action that redraws the panel.
- **A parked hover holds the pointer.** `/ui_click <id> --event hover` keeps its element hovered
  until `/ui_click --event leave` or the next gesture (whose reply carries `hoverEnded`). `/click_at` on the
  canvas is such a gesture; one on the HUD leaves the hover parked.
- **World aims pass through scene UI.** `/click_entity --at` and `/hover_entity --at` ignore UI
  under the cursor (`blockedByUi` stays false); `/click_at` is the call that scene UI can take,
  refused with `blockedByUi` naming the element unless `--force`; `/ui_list --at x y` says what
  sits there.
- **`/walk` goes through the movement input**, with the walk or run key for the gait; it reports
  `distance` and whether an `InputModifier` froze movement (`modifierActive`, `modifier`;
  `--ignore-input-modifiers` bypasses it). It never writes the player transform; `/move_player_to`
  (preview builds) does what a scene's `movePlayerTo` does.
- **Euler angles are Decentraland's**: `cameraRotationEuler.x` is the pitch, looking down
  positive. `/camera_look --at` replies `aimErrorDegrees` and a `warning` when the pitch clamp or the
  third-person orbit keeps the point off.
- **`/click_entity --button` actions are lowercase** (`primary`, `jump`, `action_3`); with no
  target the press is unaimed, lands wherever the cursor is and says where it went (`entityBound`, `rootEvents`, `hint`).
- **Known engine gaps** (report, do not chase): a hover leave is written for an entity that was
  never entered; a controlled `UiInput` keeps the typed text after the scene resets its `value`;
  a finished `AudioSource` sends no event and keeps `playing:true` in the scene's view
  (`/media_state --audio` shows the engine's `state:"ended"` beside the scene's `requested`); on the web
  the scene's `PointerLock` drops as soon as the platform reports the cursor unlocked.
