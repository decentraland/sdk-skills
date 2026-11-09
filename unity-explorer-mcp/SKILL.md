---
name: unity-explorer-mcp
description: "Set up, launch and drive a Decentraland Explorer through its MCP automation server to build and test a local SDK7 scene in-world: screenshot, walk, click and debug the running scene. Use when the user asks to see, test, verify, walk through, screenshot, or debug a scene in-world; when they name the Explorer or its MCP server; when they want the Explorer MCP installed, set up or connected; whenever an `explorer` MCP tool (`mcp__explorer__*` in Claude Code) is available; and whenever the `explorer` MCP server failed to connect or was never set up at all — ConnectionRefused, or no such server, only means the Explorer is not running yet, which is this skill's normal starting point, not a reason to skip it."
---

# Unity Explorer MCP Scene Iteration

**A failed or missing `explorer` MCP connection is the expected starting state, not a blocker.** The MCP server lives *inside* the Explorer process, so `ConnectionRefused` or no `explorer` server at all only means the Explorer is not running yet — continue into the intent gate below; Setup launches it and binds the tools. Once bound, the `mcp__explorer__*` tools are self-describing and the authoritative catalog: read names, arguments, and output shapes there rather than assuming a tool is missing, and load each tool's schema before its first call rather than guessing argument names (one session lost about 18 calls to guesses like `IA_PRIMARY` where the schema says `primary`).

**Any MCP client works** — Claude Code, Codex, Cursor, Gemini CLI, VS Code with Copilot, or another one that speaks Streamable HTTP. This skill writes tool names the way Claude Code prefixes them (`mcp__explorer__get_scene_state`); other clients show the bare name (`get_scene_state`) or their own prefix. Where a step differs per client, the Claude Code command comes first and the others follow or are linked.

**Coming in through the Creator Hub MCP** (skill **creator-hub-mcp**, tools `mcp__creator-hub__*`)? Its `launch_preview` starts the preview with this server on and re-publishes the runtime tools as `explorer_<name>`: skip **Setup** below entirely and go straight to the iteration loop with those names — but before `launch_preview`, read "Via the Creator Hub MCP" in [`reference/setup.md`](reference/setup.md) for the process check that path needs.

**Read before:**

| Before you… | Read |
|---|---|
| `set_camera_mode`, `set_camera_pose` or `camera_look` | [`reference/camera-and-movement.md`](reference/camera-and-movement.md) (check `camera.modeChangeAllowed` first) |
| any click, hover, `press_input` or `ui_*` call | [`reference/interaction.md`](reference/interaction.md) (two id spaces) |
| counting, killing or relaunching Explorer processes | [`reference/recovery.md`](reference/recovery.md) (bracketed `pgrep`; the watchdog's command line also contains the Explorer path) |
| adding, removing or renaming files under `assets/`, or placing, downloading, converting or exporting a model | [`reference/assets.md`](reference/assets.md) (the watcher reloads once per file) |
| tuning emissives/bloom, UI overlays, skybox time or thin geometry | [`reference/visuals.md`](reference/visuals.md) |

## Gates

Certain points in this skill are **gates**: you ask, call no tool after asking, and let the user answer. A gate opens only on their reply — never on your own judgment, never on their silence, never because a workaround is available to you. **Running as a subagent, you cannot open a gate at all** — there is no user to ask: stop and report the pending decision to your caller with your recommendation, rather than passing the gate on your own authority. Doing so violates the gate even when the workaround happens to work. The gates, in order: the **skills-install gate** and **restart gate** (below), the **intent gate** (pre-flight), the **launch/kill gate** (Setup step 1), and the **bind gate** (Setup step 2).

## Load the SDK skills (before anything, either way)

This skill only covers driving the Explorer; the SDK7 API knowledge (composite-first rule, component reference) lives in the other topic skills of the `decentraland/sdk-skills` package this skill ships from (entry point `sdk-scenes`). You need them whether or not the Explorer ends up in play, so do this before the pre-flight below.

Load them: session skills first, then the filesystem — scene-local and global skills folders (in Claude Code, `.claude/skills/` in the scene folder and `~/.claude/skills/`; other assistants use their own folders, e.g. `.agents/skills/`). An assistant with no skills support can read each `SKILL.md` straight from disk. This is done when you can **name the topic skills available to you** — not when you've noticed they exist. If they cannot be loaded — e.g. only `unity-explorer-mcp` itself was installed, not the whole package — **skills-install gate**: pull in the rest of the package's topic skills from that same source? Recommend it. On yes, ask at which level — scene-local or global — and run the matching command:

```bash
npx skills add decentraland/sdk-skills --all       # scene-local (run inside the scene folder)
npx skills add decentraland/sdk-skills --all -g    # global (user-level)
```

A fresh install lands on disk but does not bind — skills load at session start, and only the user can restart. **Restart gate**: restart now to pick the new skills up, or continue this session without them? Recommend restarting — until it happens the assistant cannot load the new skills by name. A restart is needed for automatic discovery and native MCP binding only: an agent with filesystem access can read an installed `SKILL.md` from disk and follow it in the same session.

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

   The **Creator Hub**'s **Play** button with **Enable MCP Server** ticked in **Play Options > Desktop Client** launches this same server as the CLI does — indistinguishable from the probe, never the reason a connection fails, and a valid answer wherever a launch is needed below.

   **Server found** (tool answer or `serverInfo` result) — **launch/kill gate**: use the already-running Explorer, or start the scene from scratch with the MCP flag?
   - *Use it*: launch nothing. If port 8000 isn't serving the target scene folder (`lsof -nP -i :8000 -sTCP:LISTEN`, then check the PID's cwd), kill whatever holds it and run `npm run start -- --no-client`. Skip step 2 if the tools are already available.
   - *From scratch*: same gate, follow-up question, before touching anything — kill the previously-running scene server, or keep it and run a second stack alongside?
     - *Kill it*: kill the port-8000 dev server, have the user close the running Explorer client, then continue below. When your harness refuses to stop the Explorer, that is the user's job: ask them to quit it (Cmd+Q) and wait until the process is gone before relaunching, especially with different flags. Never start a second Explorer on the same ports to get around it — the old one keeps the MCP port and shows the old build, and you end up with two windows connected to different builds (observed 2026-11). A deliberate second stack on its own ports is the *Keep it* path.
     - *Keep it*: leave it and its Explorer untouched and start a second stack on its own ports — see "Running a second stack" in [`reference/setup.md`](reference/setup.md).

   **No server found** — serve the scene and launch the Explorer in one command from the scene folder (keep it running in the background; if something else already holds port 8000, apply the same kill-or-keep question and port overrides as above):

   ```bash
   npm install && npm run start -- --mcp --skip-auth-screen true
   ```

   This serves the scene at `http://127.0.0.1:8000`, launches the installed Decentraland client against it with the MCP server on port 8123, and hot-reloads the scene whenever a source file changes. Port overrides, the other launch flags, and the two launch errors (`--mcp` rejected as an unknown option; "Please download & install the Decentraland Desktop Client") are under "Launch flags and errors" in [`reference/setup.md`](reference/setup.md).

2. **Register the MCP server, then confirm its tools are actually bound** (Streamable HTTP at `http://127.0.0.1:8123/unity-explorer-mcp`, no auth, server name `explorer`). Registration and binding are two different things — you need both.

   **Claude Code** (terminal CLI, VS Code extension, or the Creator Hub's embedded chat):

   ```bash
   timeout 15 claude mcp add --transport http --scope user explorer http://127.0.0.1:8123/unity-explorer-mcp
   ```

   "already exists in local config" means a previous session registered it — registration is persistent config, nothing to do. In non-terminal harnesses (the VS Code extension among them) the command can hang with no output: read a hang as *probably already registered* and move on to the bind gate without retrying — the step 1 probe already confirmed the endpoint.

   **Codex, Cursor, Gemini CLI, VS Code with Copilot, or any other client**: the full connection details and the config for each are under "Registering in other clients" in [`reference/setup.md`](reference/setup.md). Check the client's config first; an `explorer` entry from an earlier session means there is nothing to add.

   **MANDATORY — bind gate: if you launched the Explorer yourself in this session, STOP here as soon as the readiness probe answers, and do NOT start the iteration loop over curl.** MCP clients (Claude Code, Codex, Cursor, Gemini CLI among them) connect to their configured servers when the session starts, and this server lives *inside* the Explorer process — so a session that started before the Explorer was up has already failed its connection attempt, and the `explorer` tools will not appear on their own. Mid-session, only a reconnect the user triggers re-binds them; alternatively, a fresh session started while the Explorer keeps running binds them at its startup. Both are user actions: there is nothing you can run instead, so ask rather than trying to engineer around it.

   Open with the situation — *"the Explorer is up, but this session started before it, so the native MCP tools aren't bound"* — then offer three paths, best first, with the fallback's costs stated before they can land in it:

   - **Reconnect the `explorer` server** — fastest, and keeps this conversation. How depends on the client:
     - **Claude Code terminal CLI**: `/mcp` opens an interactive server menu with a reconnect entry to pick.
     - **Claude desktop app**: a bare `/mcp` opens a menu with a **Reconnect** entry; `/mcp reconnect explorer` answers "command not found" there.
     - **Claude Code VS Code extension** (and any embedded chat panel, e.g. the Creator Hub's): there is no such menu — a bare `/mcp` only prints a status line plus usage, so the command to give the user is `/mcp reconnect explorer` (or `/mcp reconnect all`), typed into the chat.
     - **Other clients**: toggle the `explorer` server off and on, or use the refresh or restart control, in the client's MCP settings or server list (Cursor's MCP settings; **MCP: List Servers** in VS Code). A client with no such control (Codex CLI) only binds on a new session — offer the next path instead.
   - **Start a fresh session / new conversation tab**, leaving the Explorer running — the tools bind automatically at the new session's startup. In an IDE or embedded panel this is just a new chat or conversation tab, *not* restarting the app or the Explorer — say so, because users assume the expensive reading and decline. In the Claude Code VS Code extension, make it the recommended path whenever `/mcp reconnect` answers *"MCP controls aren't available right now — the terminal is still starting up or is showing another view."* — a failure mode in that harness with no in-chat fix, and the new tab is the path that works.
   - **The curl fallback** — one shell command per player action, permission prompts on each new call shape, more tokens, and screenshots that arrive as base64 you must decode to a file before viewing (`scripts/screenshot.sh` does it — see [`reference/curl-fallback.md`](reference/curl-fallback.md)). Slower, but every check above is still possible on this path; do not report screenshots as unavailable.

   If your client has a multiple-choice question tool (`AskUserQuestion` in Claude Code), use it, one option each; label the second *"Restart session / new tab (Explorer stays up)"* so it can't be misread as closing the Explorer. Otherwise put the same three in plain text and close with *"Which do you prefer?"*.

   You may only move past this step in one of these three states — no fourth reading exists, and a subagent can only ever be in the first:

   - **Tools already present** (the Explorer was running before this session started) — the gate doesn't apply; continue to step 3.
   - **The user rebound the tools** — via a reconnect, or by opening a fresh session/tab with the Explorer left up. Verify by calling a native `explorer` tool (`get_scene_state`), then continue to step 3. (A fresh session ends this conversation; the new one finds them bound and skips this gate.)
   - **The user has explicitly chosen the curl fallback in writing, this session, after being told its costs** — only then read [`reference/curl-fallback.md`](reference/curl-fallback.md) and drive the endpoint over HTTP. A working curl probe is not a decline, and neither is silence.

   The probe in step 1 is the only curl call you make before this gate. Getting an answer out of it proves the Explorer is up — which is the trigger to ask, not permission to continue.

   Mention the prevention once, not every session: starting the Explorer *before* the assistant session — or simply leaving it running between sessions — skips this gate entirely.

3. **Wait for the world to load**: poll `get_scene_state` until `loadingScreenOn` is false and the scene reports `isReady: true`. Give the poll a deadline of about 90 s, and parse the result as JSON: never grep the raw text for `isReady`, because the payload's spacing (`"isReady": true`) defeats a literal pattern and the poll never ends. While polling keeps failing, the client is most likely sitting on the auth screen — `--skip-auth-screen true` only skips it when a valid identity is cached from a previous session, and extra `--multi-instance` instances always ask — so tell the user to log in, wait for them, then continue.

## The iteration loop

Repeat until **every requirement has proof**: a screenshot or state read demonstrating it, captured from a retail camera mode (`first_person`/`third_person`, not the free camera), with `get_scene_state` healthy and no unexplained errors in the logs.

1. **Edit** the scene TypeScript in `src/` — read the owning topic skill before writing an API you can't recall exactly (**stale memory**, below). **One write per change**: batch multi-part changes into ONE write, write new modules before wiring them in, and confirm `get_scene_state` still shows a scene before saving again — two saves seconds apart can load a **torn bundle**, a scene drop only an Explorer relaunch recovers ([`reference/recovery.md`](reference/recovery.md)); for a multi-file patch run or a generator script, stop the dev server first. Hot reload lands within a few seconds; `reload_scene` gives a deterministic reset. The dev server's watcher is the one writer of `bin/index.js` while it runs (a hand-run `sdk-commands build` or a second `npm run start` in the same folder makes two writers of one file), and when a change seems absent in-world, `grep bin/index.js` for a string literal from your edit before debugging the scene: a build that passed is not proof the running bundle contains it.
2. **Confirm the scene is healthy**: `get_scene_state` — a `state` of `JavaScriptError` or `EcsError` means your code crashed the scene runtime.
3. **Read the runtime output**: `get_scene_logs` with `sinceSeq` set to the last sequence number you saw. Scene `console.log` output and exceptions land here, and errors survive in the buffer after they scroll by. When the Explorer shows a scene error, or the MCP is not answering, read the client's own `Player.log` before forming a theory — it carries the exception text and the asset-bundle lines the in-world console drops; paths are under "The Explorer's own log" in [`reference/recovery.md`](reference/recovery.md).
4. **Look and verify**: position the view (`teleport`, `move_to`, `walk`, `look_at`) — `look_at` sets your facing, and `walk` and `screenshot` follow the camera. Then `screenshot` and inspect the image against what the scene code should produce. Before framing shots, free-camera sweeps, or navigating precise lines, read [`reference/camera-and-movement.md`](reference/camera-and-movement.md).
5. **Exercise behavior**: walk into trigger areas, click, hover, press inputs, sweep a held pointer across the world, chat, emote, and drive the scene's own 2D UI with the `ui_*` tools — then re-screenshot to verify reactions. Every one of these has a silent failure mode: read [`reference/interaction.md`](reference/interaction.md) before the first click, hover, key press, or UI call. `list_scene_entities` + `get_entity_details` show the scene's ECS state when visuals aren't enough.
6. **Measure budget & performance** when the question is limits, frame rate, or what to optimize: `get_scene_content_stats`, `get_scene_content_breakdown`, and `get_performance_stats` close a measurement loop — correlate content with measured FPS at a real viewpoint before prescribing anything. Method and interpretation are in [`reference/performance-debugging.md`](reference/performance-debugging.md).

**The Explorer you drive may be the user's own playtest window** — always under the Creator Hub's `launch_preview`, and in any `npm run start` preview they are playing in. `move_to`, `reload_scene`, camera-mode changes, asset churn and **every source-file save** (hot reload restarts their run) land on their playtest (observed resetting one mid-wave five times). Before saving or driving the client, read `get_player_state` (position, velocity) and recent `get_scene_logs` for an active session; while one runs, wait for a break or ask first. For a look-check prefer `set_camera_pose` (free camera; the avatar stays put) over `move_to`, and afterwards restore the camera mode you **found** (`first_person` / `drone_view`), not blindly `third_person`.

**Stale memory — your SDK7 API recall is out of date.** The SDK ships components newer than your training data (native `TriggerArea` + `triggerAreaEventsSystem` among them), so failing to recall an API is no evidence it's missing, and neither is a version number you remember. When you can't recall an API exactly, or catch yourself hand-rolling a workaround (polling the player `Transform` for a trigger volume, mutating `engine.PlayerEntity` to move the player), read the topic skill that owns it *before* writing the workaround — the skill descriptions name the owner, and `sdk-scenes` indexes the rest. Reach for the official docs only where no skill covers it, and say so when you do.

**Cross-examine** every conclusion: confirm each visual claim with a state read (ECS values via `get_entity_details`, logs, `get_player_state` position), and each state claim with pixels. One channel lies routinely — colliders exist that pixels don't show, entities render invisible while their state looks healthy, animations silently don't play. **In-world text is a state read, not a picture:** a `TextShape` sign is unreadable in a downscaled capture past a few metres, and `get_entity_details` on its entity returns the exact `PBTextShape` string for a fraction of a screenshot's tokens. The reference files call out where cross-examination is mandatory.

**MANDATORY — camera cleanup before finishing.** Whenever you stop working (end of task, handing back to the user, or pausing for their input), restore the scene's intended retail mode as your last camera action — `set_camera_mode third_person` by default, `first_person` when the scene deliberately forces first person (a `CameraModeArea` or camera lock covers the play space); the camera is never left in `free` mode — and confirm via `get_player_state` → `camera.mode` if anything in between could have failed.

## Screenshot frequency & cost

Every `screenshot` tool result lands in your context as an image (~1.2k tokens at 1280×720, scaling with pixel count). Occasional captures through the tool are fine, **one `screenshot` per tool batch**: two issued together collide, and the second fails with "Another screenshot capture is already in progress; retry when it completes" — re-issue it alone. **Frequent or burst captures go through the bundled script instead**, which saves frames to disk at zero context cost and prints only the caption. Call it by absolute path — your cwd is the scene folder, not this skill's; `<skill-dir>` is the base directory reported when this skill loaded, and `-h` prints the flags.

```bash
<skill-dir>/scripts/screenshot.sh -o /tmp/shot.jpg     # single frame to a file
<skill-dir>/scripts/screenshot.sh -n 10 -i 0.5         # burst, for time-based behavior (tweens, animations)
```

Frames default to `$TMPDIR/mcp-shots`, deliberately outside the scene folder: anything left in the project is uploaded on deploy and counts against the per-parcel MB limits, so keep `-d`/`-o` targets out of the scene too (or `.dclignore` the directory). Capture many, view few: for a before/after comparison, capture both to disk and read just those two.

## Scene health

- `scene.json` changes (spawn points, display fields) are not hot-reloaded — restart the `npm run start` process, then `reload_scene`. **A change to `scene.base`, `scene.parcels` or `worldConfiguration` needs more: `reload_scene` is not enough.** The dev server builds the realm's `localSceneParcels` once at start, so restart it, then relaunch the Explorer at the new `scene.base`, never at a position from an earlier launch. Restarting `npm run start` without `--position` does both.
- After `teleport` or `reload_scene`, re-check `get_scene_state` before interacting; readiness can lag a few seconds.
- One parcel is 16×16 m; parcel `(x, y)` spans world positions `(16x..16x+16, 16y..16y+16)`. `--position x,y` spawns at parcel `x,y`; without it the launch uses `scene.base`.
- `teleport` silently no-ops in local-scene-development mode: `/goto` is disallowed there (chat shows "Teleport is not allowed in local scene development mode") but the tool still answers "Arrived at (x,y)". Use `move_to` for repositioning in local-scene sessions.
- The desktop client converts the scene's models and `.ttf` fonts to asset bundles on its own before the scene loads (no flag; `--asset-bundles` is accepted and changes nothing), so materials, textures and `fontSrc` fonts render as players will see them. **Models loading unoptimized, or a custom font on its fallback**, means the converter did not serve this scene: [`reference/recovery.md`](reference/recovery.md) → *Models unoptimized or fonts on their fallback*.
- **A tool, not the scene, is the suspect** (a result contradicts the scene's own state, or an input tool misbehaves): run the regression rig before concluding the scene is broken — [`reference/recovery.md`](reference/recovery.md) → *Regression rig*.

- **Missing tools**: `explorer` tools absent in-session is the **bind gate** — go back to Setup step 2, ask the user to reconnect the server (the per-client commands are listed there) or open a fresh session/conversation tab with the Explorer left running, and end your turn there. [`reference/curl-fallback.md`](reference/curl-fallback.md) opens only after they have been warned of its costs and explicitly chosen it.
- **Scene dropped out, player off-parcel, connection lost, or a wedged client**: [`reference/recovery.md`](reference/recovery.md).

## When no tool reads what you need

When no MCP tool reads back the thing you must prove — an avatar hidden, a modifier area applied, a collider's size — **build the check into the scene**: an assertion in scene code that reports PASS/FAIL on an in-world QA panel, so one screenshot reports the whole suite and a check that reports itself survives the session. The reusable shape is in [`reference/in-scene-checks.md`](reference/in-scene-checks.md); write the panel before you start clicking.

When no tool can *do* what the loop needs either (a client shortcut key that is not an SDK input action — `press_input` covers those), stop and hand it to the user: name the concrete action you're blocked on and why the existing tools can't cover it. The MCP server and Explorer live outside this scene's repo — extending them is the user's call.
