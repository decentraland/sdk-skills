---
name: explorer-mcp
description: Iterate on Decentraland SDK7 scenes against a running Explorer build through its MCP automation server — edit scene code, hot-reload, drive the camera and player, screenshot, and verify behavior end-to-end. Use this whenever building, testing, debugging, or visually verifying a local SDK7 scene in a running Explorer, whenever an `mcp__explorer__*` tool is available, or when the user asks to see, test, walk through, or screenshot a scene in-world.
disable-model-invocation: true
---

# Explorer MCP Scene Iteration

Drive a running Decentraland Explorer build through its MCP automation server to build and test SDK7 scenes autonomously: edit the scene, watch it hot-reload, move the camera and player, take screenshots, and verify against what the code should produce.

The connected `mcp__explorer__*` tools are self-describing — each carries its name, arguments, and output shape. Treat that as the authoritative tool catalog; the names used below (`get_scene_state`, `get_scene_logs`, `screenshot`, `teleport`, `move_to`, `walk`, `look_at`, `set_camera_pose`, `set_camera_mode`, `list_scene_entities`, `get_entity_details`, `get_player_state`, `click_entity`, `send_chat`, `trigger_emote`, `reload_scene`) are the common ones grouped by purpose in this skill.

Deeper reference, loaded only when the task reaches it:

- [`reference/camera-and-movement.md`](reference/camera-and-movement.md) — before framing screenshots, free-camera sweeps, or navigating precise lines
- [`reference/assets.md`](reference/assets.md) — before placing, downloading, converting, or exporting any 3D model
- [`reference/visuals.md`](reference/visuals.md) — before tuning emissives/bloom, UI overlays, skybox time, or judging thin geometry

## Setup (once per session)

0. **Load the SDK skills.** This skill only covers driving the Explorer; the SDK7 API knowledge (composite-first rule, component reference) lives in the other topic skills of the same `decentraland/sdk-skills` package this skill ships from (entry point `sdk-scenes`, plus `create-scene`, `add-3d-models`, etc.), and parts of the API (e.g. native `TriggerArea`) are newer than training data. Try to load them: session skills first, then the filesystem — scene-local (`.claude/skills/` in the scene folder) and global (`~/.claude/skills/`). If they cannot be loaded — e.g. only `explorer-mcp` itself was installed, not the whole package — **MANDATORY — ask the user**: pull in the rest of the package's topic skills from that same source? Recommend it. If YES, ask at which level — scene-local or global — and run the matching command:

   ```bash
   npx skills add decentraland/sdk-skills --all       # scene-local (run inside the scene folder)
   npx skills add decentraland/sdk-skills --all -g    # global (user-level, ~/.claude/skills)
   ```

   Skills are loaded at session start, so a mid-session install may not surface until the session restarts. If NO, move forward without them — the scene can still be implemented, just less efficiently: verify any API you are not certain about against the official docs instead of writing it from memory.

1. **Probe for an already-running MCP server, then start the scene.** Check through the harness first: if `mcp__explorer__*` tools are available in the session, call `get_scene_state` — an answer means the server is up. Fall back to curl **only if the tools are absent**:

   ```bash
   curl -s -m 2 http://127.0.0.1:8123/unity-explorer-mcp -X POST \
     -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
     -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"probe","version":"1"}}}'
   ```

   **Server found** (tool answer or `serverInfo` result) — **MANDATORY — ask the user**: use the already-running Explorer, or start the scene from scratch with the MCP flag? Never decide silently.
   - *Use it*: launch nothing. If port 8000 isn't serving the target scene folder (`lsof -nP -i :8000 -sTCP:LISTEN`, then check the PID's cwd), kill whatever holds it and run `npm run start -- --no-client`. Skip step 3 if the tools are already available.
   - *From scratch*: **MANDATORY — follow-up question**: kill the previously-running scene server, or keep it and run a second stack alongside? Never kill it unasked.
     - *Kill it*: kill the port-8000 dev server, have the user close the running client (never kill an Editor process yourself), then continue below.
     - *Keep it*: leave it and its Explorer untouched; start a second stack on its own ports — a different dev-server port (`--port`; the launched client follows it automatically), a different MCP port (`--mcp-port`, implies `--mcp`), and `--multi-instance` so a second Explorer instance can run concurrently:

       ```bash
       npm install && npm run start -- --port 8666 --multi-instance --mcp-port 8124
       ```

       From here on use the chosen ports instead of 8000/8123 — including step 3's registration, which needs a distinct server name (e.g. `claude mcp add --transport http --scope user explorer2 http://127.0.0.1:8124/unity-explorer-mcp`; the tools then surface as `mcp__explorer2__*`).

   **No server found** — serve the scene and launch the Explorer in one command from the scene folder (keep it running in the background; if something else already holds port 8000, apply the same kill-or-keep question and port overrides as above):

   ```bash
   npm install && npm run start -- --mcp
   ```

   This serves the scene at `http://127.0.0.1:8000`, auto-launches the installed Decentraland client connected to it with the MCP server enabled (port 8123; `--mcp-port <port>` picks another and implies `--mcp` — adjust the 8123 URLs in steps 1 and 3 to match), and hot-reloads the scene whenever a source file changes. Useful extra flags: `--port <port>` (dev-server port; the launched client follows it automatically), `--position x,y` (spawn parcel), `--skip-auth-screen`, `-n` (force a new client instance), `--multi-instance` (allow concurrent Explorer instances), `--no-client` (serve only, launch nothing). Anything after a second standalone `--` is forwarded verbatim into the Explorer launch as extra parameters, e.g. `npm run start -- --mcp -- --windowed-mode --resolution 1280x720` (npm consumes the first `--`). If the command rejects `--mcp` as an unknown option, the scene's `@dcl/sdk-commands` predates the flag — update `@dcl/sdk`, or fall back to step 2. If the CLI prints "Please download & install the Decentraland Desktop Client" the dev server is fine but no client is installed — install one, or point the launch at a specific build (step 2).

   **A freshly launched Explorer needs the user to log in.** The client opens on the auth screen unless a previous session's login is still cached (`--skip-auth-screen` only skips it when a valid identity exists — a missing or expired login shows it anyway, and extra `--multi-instance` instances always ask). Tell the user to log in, then wait — step 4's polling only starts succeeding once they're through, and only then can you continue working on the scene through the MCP server.

2. **(Alternative) Launch a specific Explorer build manually** — only when the user points you at their own build instead of the installed client. Serve with `npm run start -- --no-client` in step 1, then:

   ```bash
   # macOS
   open /path/to/Decentraland.app --args \
     --realm http://127.0.0.1:8000 --local-scene true --position 0,0 \
     --debug --skip-auth-screen --skip-version-check true \
     --mcp --windowed-mode --resolution 1280x720
   ```

   On Windows call `Decentraland.exe` with the same arguments. Add `--disable-hud --skybox-time-enabled false --landscape-terrain-enabled false` when you want deterministic screenshots without HUD noise.

3. **Connect the MCP server** (default port 8123):

   ```bash
   claude mcp add --transport http --scope user explorer http://127.0.0.1:8123/unity-explorer-mcp
   ```

   Errors with "already exists in local config" if registered by a previous session — that's fine, nothing to do. If the current session has no `mcp__explorer__*` tools, follow "Missing tools" under Scene health & recovery below — the fix is the user reconnecting via `/mcp`, not a workaround.

4. Wait for the world to load: poll `get_scene_state` until `loadingScreenOn` is false and the scene reports `isReady: true`.

## The iteration loop

Repeat until **every requirement has proof**: a screenshot or state read demonstrating it, captured from a retail camera mode (`first_person`/`third_person`, not the free camera), with `get_scene_state` healthy and no unexplained errors in the logs.

1. **Edit** the scene TypeScript in `src/` — the dev server hot-reloads the running Explorer within a few seconds. If you need a deterministic reset instead, call `reload_scene`.
2. **Confirm the scene is healthy**: `get_scene_state` — a `state` of `JavaScriptError` or `EcsError` means your code crashed the scene runtime.
3. **Read the runtime output**: `get_scene_logs` with `sinceSeq` set to the last sequence number you saw. Scene `console.log` output and exceptions land here.
4. **Look and verify**: position the view (`teleport`, `move_to`, `walk`, `look_at` — for precise framing or free-camera sweeps read [`reference/camera-and-movement.md`](reference/camera-and-movement.md)), then `screenshot` and inspect the image against what the scene code should produce.
5. **Exercise behavior**: `walk` into trigger areas, `click_entity` on interactables, `send_chat` for commands, `trigger_emote`, and re-screenshot to verify reactions. `list_scene_entities` + `get_entity_details` show the scene's ECS state when visuals aren't enough.

**Cross-examine** every conclusion: confirm each visual claim with a state read (ECS values via `get_entity_details`, logs, `get_player_state` position), and each state claim with pixels. One channel lies routinely — colliders exist that pixels don't show, entities render invisible while their state looks healthy, animations silently don't play. The reference files call out where cross-examination is mandatory.

**MANDATORY — camera cleanup before finishing.** NEVER leave the camera in `free` mode when you stop working (end of task, handing back to the user, or pausing for their input): always restore it with `set_camera_mode third_person` as your last camera action, and confirm via `get_player_state` → `camera.mode` if anything in between could have failed.

## Screenshot frequency & cost

Every screenshot returned by the MCP `screenshot` tool lands in your context as an image (~1.2k tokens at 1280×720, scaling with pixel count). Occasional captures through the tool are fine; **frequent or burst captures must go through the bundled script instead**, which saves frames to disk (zero context cost) and prints only the caption:

```bash
scripts/screenshot.sh -o shot.jpg              # single frame to a file
scripts/screenshot.sh -n 10 -i 0.5             # burst: 10 frames every 0.5s into mcp-shots/ (time-based behavior: tweens, animations)
scripts/screenshot.sh -w 640                   # cheap sanity-check resolution (~4x fewer tokens when you Read it)
scripts/screenshot.sh --world-only --png       # UI-less lossless frame
```

Paths are relative to this skill's directory; requires curl + python3; pass `-p <port>` when not on 8123. Then `Read` only the frames you actually need to inspect — capture many, look at few. For before/after comparisons, capture both to disk and read just those two. Use `maxWidth` 640 for quick checks and 1280 only for final verification. Captures are serialized server-side (concurrent requests are rejected), so keep burst intervals ≥ 0.2s.

## Scene health & recovery

- Sequence-poll logs (`sinceSeq`) instead of re-reading the whole buffer; errors survive in the buffer even if they scrolled by.
- `scene.json` changes (parcels, spawn points) are not hot-reloaded — restart the `npm run start` process, then `reload_scene`.
- After `teleport` or `reload_scene`, always re-check `get_scene_state` before interacting; readiness can lag a few seconds.
- One parcel is 16×16 m; parcel `(x, y)` spans world positions `(16x..16x+16, 16y..16y+16)`. `--position 0,0` spawns at parcel 0,0.
- If the connection drops, the client probably crashed or was closed — relaunch it the same way it was started (`npm run start -- --mcp`, or the manual launch line); the MCP endpoint URL stays the same.
- **Missing tools**: `mcp__explorer__*` tools absent in-session are recoverable (typically the Explorer wasn't running when the session started, so the registered server failed its startup connection). Ask the user to run `/mcp` and reconnect the `explorer` server — an interactive command only the user can run; a successful reconnect binds all the server's tools into the running session. A plain `claude mcp add` mid-session does NOT surface tools by itself. Last resort: drive the endpoint directly with curl JSON-RPC (`POST /unity-explorer-mcp`, methods `initialize` then `tools/call`; responses may be SSE-framed, tool payloads are JSON in `result.content[0].text`, screenshots are base64 in image content blocks).
- After a hot reload the player can end up off-parcel (e.g. parcel `0,-1`); `get_scene_state` then reports a null scene and `reload_scene` fails with "no scene at the current parcel". Check `get_player_state` → `parcel`, `move_to` back inside, and the scene loads again.
- Each file save triggers a rebuild: editing usage and import in separate saves produces a transient `SceneError: X is not defined` between them. Write new modules before wiring them in, and prefer a single whole-file write for multi-part edits to one file.
- **Rapid successive saves can HARD-WEDGE the client.** Two saves seconds apart can make the Explorer load a mid-write bundle → `SyntaxError: Invalid or unexpected token` at scene start → the scene drops out and `get_scene_state` reports `scene: null` while you're standing on the parcel. From that state nothing recovers in-session: `reload_scene` errors ("no scene at the current parcel"), `/reload` hangs, the minimap RELOAD SCENE button no-ops, and moving off-parcel and back does not bring it back. Only exiting/re-entering play mode (editor) or relaunching the standalone build recovers. Prevention: batch multi-edit changes into ONE file write, and after any save landing seconds after a previous one, verify `get_scene_state` still shows a scene before saving again.
- The `teleport` tool silently no-ops in local-scene-development mode: `/goto` teleports are disallowed there (chat shows "Teleport is not allowed in local scene development mode") but the tool still answers "Arrived at (x,y)". Use `move_to` for repositioning in local-scene sessions.
- The Explorer under test may be the **Unity Editor in play mode**, not a standalone Decentraland.app — check `ps aux | grep -i unity` before considering a relaunch. Never kill the editor process; recovery from a wedged client is then a user action (exit/re-enter play mode).

## Interaction testing

- `click_entity` presses a pointer button on a scene entity (get ids from `list_scene_entities`). The target needs a `PointerEvents` component and a collider; the aim is validated by a real camera-origin raycast, so occluders return `hit:false` + `blockedBy*` (reposition and retry) and the entity's `maxDistance` (default 10 m) applies — get close first. `upRayMissed: true` means the target moved between press and release (e.g. a door starting to swing) and the release was delivered with the press-frame hit. For GLTF entities whose collider sits away from the pivot, pass an explicit `x/y/z` aim point. The player must be standing on the scene's parcel — off-parcel clicks fail with "no running current scene".
- `walk` moves relative to the camera and requires an explicit direction: pass `directionY: 1` for forward (`directionX` strafes); omitting both errors with "directionX and directionY must not both be zero".
- Collider checks beat pixels for physics (cross-examine): `look_at` straight at the target, `walk` forward, then compare `get_player_state` positions to prove passage or blockage.
- Trigger areas fire `onTriggerEnter` immediately after `reload_scene` if the player is already standing inside one — reposition the player outside all triggers before testing enter/exit sequencing (and treat post-reload trigger logs as stale state, not gameplay).

## When a capability is missing

If the loop is blocked because no connected MCP tool can do what you need (e.g. pressing a specific key, reading a value no tool exposes), do NOT try to modify the Explorer client or work around it by driving the UI in unsupported ways. The MCP server and Explorer are outside this scene's repo and not yours to change here. Stop and tell the user what you need — the concrete action you're blocked on and why the existing tools can't cover it — and let them decide how to extend the setup.
