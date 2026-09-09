---
name: unity-explorer-mcp
description: Set up, launch and drive a Decentraland Explorer through its MCP automation server to build and test a local SDK7 scene in-world: screenshot, walk, click and debug the running scene. Use when the user asks to see, test, verify, walk through, screenshot, or debug a scene in-world; when they name the Explorer or its MCP server; when they want the Explorer MCP installed, set up or connected; whenever an `mcp__explorer__*` tool is available; and whenever the `explorer` MCP server failed to connect or was never set up at all — ConnectionRefused, or no such server, only means the Explorer is not running yet, which is this skill's normal starting point, not a reason to skip it.
---

# Unity Explorer MCP Scene Iteration

**A failed or missing `explorer` MCP connection is the expected starting state, not a blocker.** The MCP server lives *inside* the Explorer process, so `ConnectionRefused` or no `explorer` server at all only means the Explorer is not running yet — continue into the intent gate below; Setup launches it and binds the tools. Once bound, the `mcp__explorer__*` tools are self-describing and the authoritative catalog: read names, arguments, and output shapes there rather than assuming a tool is missing.

## Gates

Certain points in this skill are **gates**: you ask, call no tool after asking, and let the user answer. A gate opens only on their reply — never on your own judgment, never on their silence, never because a workaround is available to you. **Running as a subagent, you cannot open a gate at all** — there is no user to ask: stop and report the pending decision to your caller with your recommendation, rather than passing the gate on your own authority. Doing so violates the gate even when the workaround happens to work. The gates, in order: the **skills-install gate** and **restart gate** (below), the **intent gate** (pre-flight), the **launch/kill gate** (Setup step 1), and the **bind gate** (Setup step 2).

## Load the SDK skills (before anything, either way)

This skill only covers driving the Explorer; the SDK7 API knowledge (composite-first rule, component reference) lives in the other topic skills of the `decentraland/sdk-skills` package this skill ships from (entry point `sdk-scenes`). You need them whether or not the Explorer ends up in play, so do this before the pre-flight below.

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

1. **Probe for an already-running MCP server, then start the scene.** Harness first: if `mcp__explorer__*` tools are available in the session, call `get_scene_state` — an answer means the server is up. Fall back to curl **only if the tools are absent**:

   ```bash
   curl -s -m 2 http://127.0.0.1:8123/unity-explorer-mcp -X POST \
     -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
     -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"probe","version":"1"}}}'
   ```

   The **Creator Hub**'s scene **Preview** with **"Enable MCP Server"** ticked launches this same server as the CLI does — indistinguishable from the probe, never the reason a connection fails, and a valid answer wherever a launch is needed below.

   **Server found** (tool answer or `serverInfo` result) — **launch/kill gate**: use the already-running Explorer, or start the scene from scratch with the MCP flag?
   - *Use it*: launch nothing. If port 8000 isn't serving the target scene folder (`lsof -nP -i :8000 -sTCP:LISTEN`, then check the PID's cwd), kill whatever holds it and run `npm run start -- --no-client`. Skip step 2 if the tools are already available.
   - *From scratch*: same gate, follow-up question, before touching anything — kill the previously-running scene server, or keep it and run a second stack alongside?
     - *Kill it*: kill the port-8000 dev server, have the user close the running Explorer client, then continue below.
     - *Keep it*: leave it and its Explorer untouched and start a second stack on its own ports — see "Running a second stack" in [`reference/setup.md`](reference/setup.md).

   **No server found** — serve the scene and launch the Explorer in one command from the scene folder (keep it running in the background; if something else already holds port 8000, apply the same kill-or-keep question and port overrides as above):

   ```bash
   npm install && npm run start -- --mcp --skip-auth-screen true
   ```

   This serves the scene at `http://127.0.0.1:8000`, launches the installed Decentraland client against it with the MCP server on port 8123, and hot-reloads the scene whenever a source file changes. Port overrides, the other launch flags, and the two launch errors (`--mcp` rejected as an unknown option; "Please download & install the Decentraland Desktop Client") are under "Launch flags and errors" in [`reference/setup.md`](reference/setup.md).

2. **Register the MCP server, then confirm its tools are actually bound** (default port 8123). Registration and binding are two different things — you need both.

   ```bash
   timeout 15 claude mcp add --transport http --scope user explorer http://127.0.0.1:8123/unity-explorer-mcp
   ```

   "already exists in local config" means a previous session registered it — registration is persistent config, nothing to do. In non-terminal harnesses (the VS Code extension among them) the command can hang with no output: read a hang as *probably already registered* and move on to the bind gate without retrying — the step 1 probe already confirmed the endpoint.

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

   **Not running in Claude Code?** For Cursor, Cline, or a custom SDK harness, the connection details and config shapes are under "Registering in a client other than Claude Code" in [`reference/setup.md`](reference/setup.md). The Claude Code **VS Code extension** and the Creator Hub's embedded chat *are* Claude Code: they take the commands above, with the harness differences noted in the bind gate.

3. **Wait for the world to load**: poll `get_scene_state` until `loadingScreenOn` is false and the scene reports `isReady: true`. While polling keeps failing, the client is most likely sitting on the auth screen — `--skip-auth-screen true` only skips it when a valid identity is cached from a previous session, and extra `--multi-instance` instances always ask — so tell the user to log in, wait for them, then continue.

## The iteration loop

Repeat until **every requirement has proof**: a screenshot or state read demonstrating it, captured from a retail camera mode (`first_person`/`third_person`, not the free camera), with `get_scene_state` healthy and no unexplained errors in the logs.

1. **Edit** the scene TypeScript in `src/` — read the owning topic skill before writing an API you can't recall exactly (**stale memory**, below). **One write per change**: batch multi-part changes into ONE write, write new modules before wiring them in, and confirm `get_scene_state` still shows a scene before saving again — two saves seconds apart can load a **torn bundle**, a scene drop only the user can recover by restarting the client ([`reference/recovery.md`](reference/recovery.md)). Hot reload lands within a few seconds; `reload_scene` gives a deterministic reset. Before placing, downloading, converting, or exporting a 3D model read [`reference/assets.md`](reference/assets.md); before tuning emissives/bloom, UI overlays, skybox time, or thin geometry read [`reference/visuals.md`](reference/visuals.md).
2. **Confirm the scene is healthy**: `get_scene_state` — a `state` of `JavaScriptError` or `EcsError` means your code crashed the scene runtime.
3. **Read the runtime output**: `get_scene_logs` with `sinceSeq` set to the last sequence number you saw. Scene `console.log` output and exceptions land here, and errors survive in the buffer after they scroll by.
4. **Look and verify**: position the view (`teleport`, `move_to`, `walk`, `look_at`) — `look_at` sets your facing, and `walk` and `screenshot` follow the camera. Then `screenshot` and inspect the image against what the scene code should produce. Before framing shots, free-camera sweeps, or navigating precise lines, read [`reference/camera-and-movement.md`](reference/camera-and-movement.md).
5. **Exercise behavior**: walk into trigger areas, click, hover, press inputs, sweep a held pointer across the world, chat, emote, and drive the scene's own 2D UI with the `ui_*` tools — then re-screenshot to verify reactions. Every one of these has a silent failure mode: read [`reference/interaction.md`](reference/interaction.md) before the first click, hover, key press, or UI call. `list_scene_entities` + `get_entity_details` show the scene's ECS state when visuals aren't enough.
6. **Measure budget & performance** when the question is limits, frame rate, or what to optimize: `get_scene_content_stats`, `get_scene_content_breakdown`, and `get_performance_stats` close a measurement loop — correlate content with measured FPS at a real viewpoint before prescribing anything. Method and interpretation are in [`reference/performance-debugging.md`](reference/performance-debugging.md).

**Stale memory — your SDK7 API recall is out of date.** The SDK ships components newer than your training data (native `TriggerArea` + `triggerAreaEventsSystem` among them), so failing to recall an API is no evidence it's missing, and neither is a version number you remember. When you can't recall an API exactly, or catch yourself hand-rolling a workaround (polling the player `Transform` for a trigger volume, mutating `engine.PlayerEntity` to move the player), read the topic skill that owns it *before* writing the workaround — the skill descriptions name the owner, and `sdk-scenes` indexes the rest. Reach for the official docs only where no skill covers it, and say so when you do.

**Cross-examine** every conclusion: confirm each visual claim with a state read (ECS values via `get_entity_details`, logs, `get_player_state` position), and each state claim with pixels. One channel lies routinely — colliders exist that pixels don't show, entities render invisible while their state looks healthy, animations silently don't play. **In-world text is a state read, not a picture:** a `TextShape` sign is unreadable in a downscaled capture past a few metres, and `get_entity_details` on its entity returns the exact `PBTextShape` string for a fraction of a screenshot's tokens. The reference files call out where cross-examination is mandatory.

**MANDATORY — camera cleanup before finishing.** Whenever you stop working (end of task, handing back to the user, or pausing for their input), `set_camera_mode third_person` is your last camera action — the camera is never left in `free` mode — and confirm via `get_player_state` → `camera.mode` if anything in between could have failed.

## Screenshot frequency & cost

Every `screenshot` tool result lands in your context as an image (~1.2k tokens at 1280×720, scaling with pixel count). Occasional captures through the tool are fine; **frequent or burst captures go through the bundled script instead**, which saves frames to disk at zero context cost and prints only the caption. Call it by absolute path — your cwd is the scene folder, not this skill's; `<skill-dir>` is the base directory reported when this skill loaded, and `-h` prints the flags.

```bash
<skill-dir>/scripts/screenshot.sh -o /tmp/shot.jpg     # single frame to a file
<skill-dir>/scripts/screenshot.sh -n 10 -i 0.5         # burst, for time-based behavior (tweens, animations)
```

Frames default to `$TMPDIR/mcp-shots`, deliberately outside the scene folder: anything left in the project is uploaded on deploy and counts against the per-parcel MB limits, so keep `-d`/`-o` targets out of the scene too (or `.dclignore` the directory). Capture many, `Read` few: for a before/after comparison, capture both to disk and read just those two.

## Scene health

- `scene.json` changes (parcels, spawn points) are not hot-reloaded — restart the `npm run start` process, then `reload_scene`.
- After `teleport` or `reload_scene`, re-check `get_scene_state` before interacting; readiness can lag a few seconds.
- One parcel is 16×16 m; parcel `(x, y)` spans world positions `(16x..16x+16, 16y..16y+16)`. `--position 0,0` spawns at parcel 0,0.
- `teleport` silently no-ops in local-scene-development mode: `/goto` is disallowed there (chat shows "Teleport is not allowed in local scene development mode") but the tool still answers "Arrived at (x,y)". Use `move_to` for repositioning in local-scene sessions.

- **Missing tools**: `mcp__explorer__*` tools absent in-session is the **bind gate** — go back to Setup step 2, ask the user to reconnect the server (`/mcp` menu in the terminal CLI, `/mcp reconnect explorer` in the VS Code extension) or open a fresh session/conversation tab with the Explorer left running, and end your turn there. The HTTP fallback is in [`reference/curl-fallback.md`](reference/curl-fallback.md), to be opened only after they have been warned of its costs and explicitly chosen it.
- **Scene dropped out, player off-parcel, connection lost, or a wedged client**: [`reference/recovery.md`](reference/recovery.md).

## When a capability is missing

When no connected MCP tool can do what the loop needs (pressing a specific key, reading a value no tool exposes), stop and hand it to the user: name the concrete action you're blocked on and why the existing tools can't cover it. The MCP server and Explorer live outside this scene's repo — extending them is the user's call.
