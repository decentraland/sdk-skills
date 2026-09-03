---
name: unity-explorer-mcp
description: Iterate on a local Decentraland SDK7 scene against a running Explorer build through its MCP automation server. Use when the user asks to see, test, verify, walk through, screenshot, or debug a scene in-world, when they name the Explorer or its MCP server, or whenever an `mcp__explorer__*` tool is available in the session.
---

# Unity Explorer MCP Scene Iteration

Drive a running Decentraland Explorer build through its MCP automation server to build and test SDK7 scenes autonomously: edit the scene, watch it hot-reload, move the camera and player, take screenshots, and verify against what the code should produce.

The connected `mcp__explorer__*` tools are self-describing — each carries its name, arguments, and output shape. Treat that as the authoritative tool catalog; the names used below (`get_scene_state`, `get_scene_logs`, `screenshot`, `teleport`, `move_to`, `walk`, `look_at`, `set_camera_pose`, `set_camera_mode`, `list_scene_entities`, `get_entity_details`, `get_player_state`, `click_entity`, `send_chat`, `trigger_emote`, `reload_scene`, `get_scene_content_stats`, `get_scene_content_breakdown`, `get_performance_stats`) are the common ones.

**Coming in through the Creator Hub MCP?** When the Creator Hub's editor MCP is connected (skill **creator-hub-mcp**; tools `mcp__creator-hub__*`), the Explorer is reached through it: `launch_preview` starts the scene preview with this MCP server on, and the runtime tools below are re-published live as `explorer_<name>` (`explorer_screenshot`, `explorer_walk`, …; `explorer_call(tool, arguments)` is the fallback while they bind). In that case skip **Setup** below entirely — no `claude mcp add`, no bind gate, no port 8123 probe — and go straight to the iteration loop with those tool names. The reference files apply unchanged.

Deeper reference, loaded only when the task reaches it:

- [`reference/camera-and-movement.md`](reference/camera-and-movement.md) — before framing screenshots, free-camera sweeps, or navigating precise lines
- [`reference/assets.md`](reference/assets.md) — before placing, downloading, converting, or exporting any 3D model
- [`reference/visuals.md`](reference/visuals.md) — before tuning emissives/bloom, UI overlays, skybox time, or judging thin geometry
- [`reference/performance-debugging.md`](reference/performance-debugging.md) — before answering whether a scene is within its content budget, why it runs slow, or what to optimize (`get_scene_content_stats`, `get_scene_content_breakdown`, `get_performance_stats`)

## Gates

Certain points in this skill are **gates**: you ask, call no tool after asking, and let the user answer. A gate opens only on their reply — never on your own judgment, never on their silence, never because a workaround is available to you. **Running as a subagent, you cannot open a gate at all** — there is no user to ask: stop and report the pending decision to your caller with your recommendation, rather than passing the gate on your own authority. Doing so violates the gate even when the workaround happens to work. The gates, in order: the **skills-install gate** and **restart gate** (below), the **intent gate** (pre-flight), the **launch/kill gate** (Setup step 1), and the **bind gate** (Setup step 2).

## Load the SDK skills (before anything, either way)

This skill only covers driving the Explorer; the SDK7 API knowledge (composite-first rule, component reference) lives in the other topic skills of the same `decentraland/sdk-skills` package this skill ships from (entry point `sdk-scenes`, plus `create-scene`, `add-3d-models`, etc.), and parts of the API (e.g. native `TriggerArea`) are newer than training data. You need them whether or not the Explorer ends up in play, so do this before the pre-flight below.

Load them: session skills first, then the filesystem — scene-local (`.claude/skills/` in the scene folder) and global (`~/.claude/skills/`). This is done when you can **name the topic skills available to you** — not when you've noticed they exist. If they cannot be loaded — e.g. only `unity-explorer-mcp` itself was installed, not the whole package — **skills-install gate**: pull in the rest of the package's topic skills from that same source? Recommend it. On yes, ask at which level — scene-local or global — and run the matching command:

```bash
npx skills add decentraland/sdk-skills --all       # scene-local (run inside the scene folder)
npx skills add decentraland/sdk-skills --all -g    # global (user-level, ~/.claude/skills)
```

A fresh install lands on disk but does not bind — skills load at session start, and only the user can restart. **Restart gate**: restart now to pick the new skills up, or continue this session without them? Recommend restarting — until it happens the install buys nothing.

Declining either gate is fine — the scene can still be implemented, just less efficiently. Until the skills actually load, the **stale memory** rule under the iteration loop governs every SDK7 API you write.

## Intent gate (pre-flight, do this first)

This skill fires on its own — the mere presence of an `mcp__explorer__*` tool triggers it — so it is often loaded when the user never asked for it. Before probing for a server, launching the Explorer, or editing the scene, confirm they want to drive the scene through the Unity Explorer MCP server: *"Do you want to build/test this scene against a running Decentraland Explorer via the Unity Explorer MCP server? This will launch/connect to the Explorer and iterate in-world."*

- **YES** — continue to Setup below.
- **NO** — run no setup, launch, or MCP step from this skill. Work on the scene without the Explorer (edit code, lean on the topic skills you just loaded), and let the user re-invoke this skill later if they change their mind.

## Setup (once per session)

1. **Probe for an already-running MCP server, then start the scene.** Check through the harness first: if `mcp__explorer__*` tools are available in the session, call `get_scene_state` — an answer means the server is up. Fall back to curl **only if the tools are absent**:

   ```bash
   curl -s -m 2 http://127.0.0.1:8123/unity-explorer-mcp -X POST \
     -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
     -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"probe","version":"1"}}}'
   ```

   Two launch paths produce the same server, and you cannot tell them apart from the probe: `npm run start -- --mcp` from the CLI, and the **Creator Hub**'s scene **Preview** button with the **MCP** checkbox ticked (it passes `--mcp` to the same preview process). Same endpoint, same tools, same behaviour — a Creator Hub launch is never the reason a connection fails, so recognise it as a normal setup rather than an anomaly to relaunch out of.

   **Server found** (tool answer or `serverInfo` result) — **launch/kill gate**: use the already-running Explorer, or start the scene from scratch with the MCP flag?
   - *Use it*: launch nothing. If port 8000 isn't serving the target scene folder (`lsof -nP -i :8000 -sTCP:LISTEN`, then check the PID's cwd), kill whatever holds it and run `npm run start -- --no-client`. Skip step 2 if the tools are already available.
   - *From scratch*: same gate, follow-up question, before touching anything — kill the previously-running scene server, or keep it and run a second stack alongside?
     - *Kill it*: kill the port-8000 dev server, have the user close the running client (never kill an Editor process yourself), then continue below.
     - *Keep it*: leave it and its Explorer untouched and start a second stack on its own ports — see "Running a second stack" in [`reference/setup.md`](reference/setup.md).

   **No server found** — serve the scene and launch the Explorer in one command from the scene folder (keep it running in the background; if something else already holds port 8000, apply the same kill-or-keep question and port overrides as above):

   ```bash
   npm install && npm run start -- --mcp
   ```

   Alternatively the user can launch from the **Creator Hub**: enable the **"Enable MCP Server"** checkbox in the scene's preview settings (only shown when the scene's `@dcl/sdk-commands` version supports the `--mcp` flag), then hit **Preview**. Equivalent to the command above in every respect that matters here.

   This serves the scene at `http://127.0.0.1:8000`, auto-launches the installed Decentraland client connected to it with the MCP server enabled (port 8123; `--mcp-port <port>` picks another and implies `--mcp` — adjust the 8123 URLs in steps 1 and 2 to match), and hot-reloads the scene whenever a source file changes. Useful extra flags: `--port <port>` (dev-server port; the launched client follows it automatically), `--position x,y` (spawn parcel), `--skip-auth-screen`, `-n` (force a new client instance), `--multi-instance` (allow concurrent Explorer instances), `--no-client` (serve only, launch nothing). Anything after a second standalone `--` is forwarded verbatim into the Explorer launch as extra parameters, e.g. `npm run start -- --mcp -- --windowed-mode --resolution 1280x720` (npm consumes the first `--`). If the command rejects `--mcp` as an unknown option, the scene's `@dcl/sdk-commands` predates the flag — update `@dcl/sdk`, or launch a specific build by hand ("Launching a specific Explorer build manually" in [`reference/setup.md`](reference/setup.md)). If the CLI prints "Please download & install the Decentraland Desktop Client" the dev server is fine but no client is installed — install one, or point the launch at a specific build the same way.

   **A freshly launched Explorer needs the user to log in.** The client opens on the auth screen unless a previous session's login is still cached (`--skip-auth-screen` only skips it when a valid identity exists — a missing or expired login shows it anyway, and extra `--multi-instance` instances always ask). Tell the user to log in, then wait — step 3's polling only starts succeeding once they're through, and only then can you continue working on the scene through the MCP server.

2. **Register the MCP server, then confirm its tools are actually bound** (default port 8123). Registration and binding are two different things — you need both.

   ```bash
   claude mcp add --transport http --scope user explorer http://127.0.0.1:8123/unity-explorer-mcp
   ```

   Errors with "already exists in local config" if a previous session registered it — that's fine and expected; registration is persistent config, nothing to do.

   **This command can hang with no output in non-terminal harnesses** (observed in the Claude Code VS Code extension: >2 min, no result, no error). Run it with a short timeout — `timeout 15 claude mcp add ...` — and read a hang as *probably already registered*, not as a failure: registration persists across sessions, so a prior session's `claude mcp add` still counts. Don't retry it; confirm the endpoint with the step 1 probe instead and move on to the bind gate.

   **MANDATORY — bind gate: if you launched the Explorer yourself in this session, STOP here as soon as the readiness probe answers, and do NOT start the iteration loop over curl.** Claude Code opens its MCP connections once, at session startup, and this server lives *inside* the Explorer process — so a session that started before the Explorer was up has already failed its one connection attempt, and `mcp__explorer__*` tools will never appear on their own. Mid-session, only an explicit `/mcp` reconnect re-binds them; alternatively, starting a fresh Claude session while the Explorer keeps running binds them automatically at that session's startup. Both are user actions: there is nothing you can run instead, so ask rather than trying to engineer around it.

   Open with the situation — *"the Explorer is up, but this Claude session started before it, so the native MCP tools aren't bound"* — then offer three paths, best first, with the fallback's costs stated before they can land in it:

   - **Reconnect the `explorer` server** — fastest, and keeps this conversation. How, depends on the harness: the **terminal CLI** opens an interactive server menu on `/mcp`, with a reconnect entry to pick. The **VS Code extension** (and any embedded chat panel, e.g. the Creator Hub's) has no such menu — a bare `/mcp` there only prints a status line plus usage, so the command to give the user is `/mcp reconnect explorer` (or `/mcp reconnect all`), typed into the chat.
   - **Start a fresh session / new conversation tab**, leaving the Explorer running — the tools bind automatically at the new session's startup. In the VS Code extension and embedded panels this is just a new conversation tab, *not* restarting the app or the Explorer — say so, because users assume the expensive reading and decline. Make it the recommended path there whenever `/mcp reconnect` answers *"MCP controls aren't available right now — the terminal is still starting up or is showing another view."* — a known failure mode in that harness with no in-chat fix, and the new tab is the path verified to work.
   - **The curl fallback** — one shell command per player action, permission prompts on each new call shape, more tokens, and no screenshot images you can inspect.

   Use `AskUserQuestion` if your client has it, one option each; label the second *"Restart session / new tab (Explorer stays up)"* so it can't be misread as closing the Explorer. Otherwise put the same three in plain text and close with *"Which do you prefer?"*.

   You may only move past this step in one of these three states — no fourth reading exists, and a subagent can only ever be in the first:

   - **Tools already present** (the Explorer was running before this session started) — the gate doesn't apply; continue to step 3.
   - **The user rebound the tools** — via `/mcp` reconnect, or by opening a fresh session/tab with the Explorer left up. Verify by calling a native `mcp__explorer__*` tool, then continue to step 3. (A fresh session ends this conversation; the new one finds them bound and skips this gate.)
   - **The user has explicitly chosen the curl fallback in writing, this session, after being told its costs** — only then read [`reference/curl-fallback.md`](reference/curl-fallback.md) and drive the endpoint over HTTP. A working curl probe is not a decline, and neither is silence.

   The probe in step 1 is the only curl call you make before this gate. Getting an answer out of it proves the Explorer is up — which is the trigger to ask, not permission to continue.

   Mention the prevention once, not every session: starting the Explorer *before* Claude Code — or simply leaving it running between sessions — skips this gate entirely.

   **Not running in Claude Code?** `claude mcp add` and `/mcp` are Claude Code commands — for Cursor, Cline, or a custom SDK harness, the connection details and config shapes are in [`reference/setup.md`](reference/setup.md). The Claude Code **VS Code extension** and the Creator Hub's embedded chat *are* Claude Code: they take the commands above, with the harness differences noted in the bind gate.

3. Wait for the world to load: poll `get_scene_state` until `loadingScreenOn` is false and the scene reports `isReady: true`.

## The iteration loop

Repeat until **every requirement has proof**: a screenshot or state read demonstrating it, captured from a retail camera mode (`first_person`/`third_person`, not the free camera), with `get_scene_state` healthy and no unexplained errors in the logs.

1. **Edit** the scene TypeScript in `src/` — read the owning topic skill before writing an API you can't recall exactly (see below). The dev server hot-reloads the running Explorer within a few seconds. If you need a deterministic reset instead, call `reload_scene`.
2. **Confirm the scene is healthy**: `get_scene_state` — a `state` of `JavaScriptError` or `EcsError` means your code crashed the scene runtime.
3. **Read the runtime output**: `get_scene_logs` with `sinceSeq` set to the last sequence number you saw. Scene `console.log` output and exceptions land here.
4. **Look and verify**: position the view (`teleport`, `move_to`, `walk`, `look_at` — for precise framing or free-camera sweeps read [`reference/camera-and-movement.md`](reference/camera-and-movement.md)), then `screenshot` and inspect the image against what the scene code should produce.
5. **Exercise behavior**: `walk` into trigger areas, `click_entity` on interactables, `send_chat` for commands, `trigger_emote`, and re-screenshot to verify reactions. `list_scene_entities` + `get_entity_details` show the scene's ECS state when visuals aren't enough.
6. **Measure budget & performance** (when the question is limits, frame rate, or what to optimize): `get_scene_content_stats` for the whole-scene counts against their soft caps, `get_scene_content_breakdown` to rank the heaviest source models (position the camera first — the visible columns are per point of view), and `get_performance_stats` to sample the real frame rate at a viewpoint. Don't prescribe from counts alone — correlate content with measured FPS. Full method and the materials-vs-shaderVariants interpretation are in [`reference/performance-debugging.md`](reference/performance-debugging.md).

**Your SDK7 API memory is stale.** The SDK ships components newer than training data — native `TriggerArea` + `triggerAreaEventsSystem` (`TriggerArea.setBox(entity, ColliderLayer.CL_MAIN_PLAYER)`) among them — so failing to recall an API is no evidence it's missing, and neither is a version number you remember. When you can't recall an API exactly, or catch yourself hand-rolling a workaround (polling the player `Transform` for a trigger volume, mutating `engine.PlayerEntity` to move the player), read the topic skill that owns it *before* writing the workaround: `add-interactivity` for triggers and pointer events, `player-physics` for forces on the player, `advanced-input` for held keys, `sdk-scenes` for the component reference and the index of the rest. Reach for the official docs only where no skill covers it, and say so when you do.

**Cross-examine** every conclusion: confirm each visual claim with a state read (ECS values via `get_entity_details`, logs, `get_player_state` position), and each state claim with pixels. One channel lies routinely — colliders exist that pixels don't show, entities render invisible while their state looks healthy, animations silently don't play. The reference files call out where cross-examination is mandatory.

**MANDATORY — camera cleanup before finishing.** NEVER leave the camera in `free` mode when you stop working (end of task, handing back to the user, or pausing for their input): always restore it with `set_camera_mode third_person` as your last camera action, and confirm via `get_player_state` → `camera.mode` if anything in between could have failed.

## Screenshot frequency & cost

Every screenshot returned by the MCP `screenshot` tool lands in your context as an image (~1.2k tokens at 1280×720, scaling with pixel count). Occasional captures through the tool are fine; **frequent or burst captures must go through the bundled script instead**, which saves frames to disk (zero context cost) and prints only the caption:

Call it by absolute path — your cwd is the scene folder, not this skill's. `<skill-dir>` below is the base directory reported when this skill loads (`.claude/skills/unity-explorer-mcp/` when installed scene-local, `~/.claude/skills/unity-explorer-mcp/` when global):

```bash
<skill-dir>/scripts/screenshot.sh -o /tmp/shot.jpg        # single frame to a file
<skill-dir>/scripts/screenshot.sh -n 10 -i 0.5            # burst: 10 frames every 0.5s (time-based behavior: tweens, animations)
<skill-dir>/scripts/screenshot.sh -w 640                  # cheap sanity-check resolution (~4x fewer tokens when you Read it)
<skill-dir>/scripts/screenshot.sh --world-only --png      # UI-less lossless frame
```

Frames default to `$TMPDIR/mcp-shots`, deliberately outside the scene folder: anything left in the project gets uploaded on deploy and counts against the per-parcel MB limits. Keep `-d`/`-o` targets out of the scene too — or add the directory to `.dclignore` if the user wants the frames kept beside their scene.

Requires curl + python3; pass `-p <port>` when not on 8123. `Read` only the frames you actually need to inspect — capture many, look at few. For before/after comparisons, capture both to disk and read just those two. Use `maxWidth` 640 for quick checks and 1280 only for final verification. Captures are serialized server-side (concurrent requests are rejected), so keep burst intervals ≥ 0.2s.

## Scene health & recovery

- Sequence-poll logs (`sinceSeq`) instead of re-reading the whole buffer; errors survive in the buffer even if they scrolled by.
- `scene.json` changes (parcels, spawn points) are not hot-reloaded — restart the `npm run start` process, then `reload_scene`.
- After `teleport` or `reload_scene`, always re-check `get_scene_state` before interacting; readiness can lag a few seconds.
- One parcel is 16×16 m; parcel `(x, y)` spans world positions `(16x..16x+16, 16y..16y+16)`. `--position 0,0` spawns at parcel 0,0.
- If the connection drops, the client probably crashed or was closed — relaunch it the same way it was started (`npm run start -- --mcp`, or the manual launch line in [`reference/setup.md`](reference/setup.md)); the MCP endpoint URL stays the same.
- **Missing tools**: `mcp__explorer__*` tools absent in-session is the **bind gate** — go back to Setup step 2, ask the user to reconnect the server (`/mcp` menu in the terminal CLI, `/mcp reconnect explorer` in the VS Code extension) or open a fresh session/conversation tab with the Explorer left running, and end your turn there. The HTTP fallback is in [`reference/curl-fallback.md`](reference/curl-fallback.md), to be opened only after they have been warned of its costs and explicitly chosen it.
- After a hot reload the player can end up off-parcel (e.g. parcel `0,-1`); `get_scene_state` then reports a null scene and `reload_scene` fails with "no scene at the current parcel". Check `get_player_state` → `parcel`, `move_to` back inside, and the scene loads again.
- **One file write per change.** Each save triggers a rebuild, so a multi-part edit split across saves breaks the scene in between — mildly, when usage and import land in separate saves (a transient `SceneError: X is not defined`), or terminally: two saves seconds apart can make the Explorer load a mid-write bundle → `SyntaxError: Invalid or unexpected token` at scene start → the scene drops out and `get_scene_state` reports `scene: null` while you're standing on the parcel. From that state nothing recovers in-session: `reload_scene` errors ("no scene at the current parcel"), `/reload` hangs, the minimap RELOAD SCENE button no-ops, and moving off-parcel and back does not bring it back — only exiting/re-entering play mode (editor) or relaunching the standalone build. So batch multi-part changes into ONE write, write new modules before wiring them in, and after any save landing seconds after a previous one verify `get_scene_state` still shows a scene before saving again.
- The `teleport` tool silently no-ops in local-scene-development mode: `/goto` teleports are disallowed there (chat shows "Teleport is not allowed in local scene development mode") but the tool still answers "Arrived at (x,y)". Use `move_to` for repositioning in local-scene sessions.
- The Explorer under test may be the **Unity Editor in play mode**, not a standalone Decentraland.app — check `ps aux | grep -i unity` before considering a relaunch. Never kill the editor process; recovery from a wedged client is then a user action (exit/re-enter play mode).

## Interaction testing

- `click_entity` presses a pointer button on a scene entity (get ids from `list_scene_entities`). The target needs a `PointerEvents` component and a collider; the aim is validated by a real camera-origin raycast, so occluders return `hit:false` + `blockedBy*` (reposition and retry) and the entity's `maxDistance` (default 10 m) applies — get close first. `upRayMissed: true` means the target moved between press and release (e.g. a door starting to swing) and the release was delivered with the press-frame hit. For GLTF entities whose collider sits away from the pivot, pass an explicit `x/y/z` aim point. The player must be standing on the scene's parcel — off-parcel clicks fail with "no running current scene".
- `walk` moves relative to the camera and requires an explicit direction: pass `directionY: 1` for forward (`directionX` strafes); omitting both errors with "directionX and directionY must not both be zero".
- Collider checks beat pixels for physics (cross-examine): `look_at` straight at the target, `walk` forward, then compare `get_player_state` positions to prove passage or blockage.
- Trigger areas fire `onTriggerEnter` immediately after `reload_scene` if the player is already standing inside one — reposition the player outside all triggers before testing enter/exit sequencing (and treat post-reload trigger logs as stale state, not gameplay).

## When a capability is missing

If the loop is blocked because no connected MCP tool can do what you need (e.g. pressing a specific key, reading a value no tool exposes), stop and hand it to the user: name the concrete action you're blocked on and why the existing tools can't cover it, and let them decide how to extend the setup. The MCP server and Explorer live outside this scene's repo — extending them is the user's call, not something to work around from here.
