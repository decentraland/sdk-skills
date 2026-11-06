# Recovery reference

Reached when the scene, the client, or the connection has gone wrong.

## The Explorer's own log

When the Explorer shows a scene error, or the MCP is not answering, `Player.log` holds the scene's exception text and the asset-bundle lines the in-world console drops — read it before forming a theory:

- macOS: `~/Library/Logs/Decentraland/Explorer/Player.log`
- Windows: `%USERPROFILE%\AppData\LocalLow\Decentraland\Explorer\Player.log`

The chat command `/logs` opens the folder from inside the client.

## Torn bundle (an unrecoverable scene drop)

Two saves seconds apart can make the Explorer load a mid-write bundle → `SyntaxError: Invalid or unexpected token` at scene start → the scene drops out and `get_scene_state` reports `scene: null` while you are standing on the parcel. Nothing recovers it in-session: `reload_scene` errors ("no scene at the current parcel"), `/reload` hangs, the minimap RELOAD SCENE button no-ops, and moving off-parcel and back does not bring it back. Only relaunching the Explorer restores it: have the user close the client, then relaunch the stack the way it was started.

The milder version of the same cause — usage and import landing in separate saves — is a transient `SceneError: X is not defined`. Prevention is the **one write per change** rule in the iteration loop.

## Player ends up off-parcel after a hot reload

The player can land outside the scene (e.g. parcel `0,-1`); `get_scene_state` then reports a null scene and `reload_scene` fails with "no scene at the current parcel". Check `get_player_state` → `parcel`, `move_to` back inside, and the scene loads again.

## "The preview launched but its MCP server never answered" (Creator Hub `launch_preview` path)

A stale Explorer process, not a broken scene. `stop_preview` kills only the Hub's `sdk-commands` child — the Explorer app survives it, holding its MCP on the *previous* ephemeral port — and `preview_status` reports "not running" because it checks that child's process handle, not the app. The next `launch_preview` picks a new port the surviving single-instance window never binds, and the Hub times out after ~45 s.

Check the OS, not just the tool, then close the stale instance and launch **once**:

```bash
pgrep -fl '[M]acOS/Explorer'; pgrep -fl '[d]cl_watchdog'
pkill -f '[d]cl_watchdog'; pkill -f '[D]ecentraland.app/Contents/MacOS/Explorer'
for i in $(seq 1 30); do pgrep -f '[M]acOS/Explorer' >/dev/null || break; sleep 1; done   # wait up to 30 s
```

On Windows (PowerShell):

```powershell
Get-Process Decentraland, dcl_watchdog -ErrorAction SilentlyContinue
Stop-Process -Name dcl_watchdog -Force -ErrorAction SilentlyContinue
Stop-Process -Name Decentraland -Force -ErrorAction SilentlyContinue
Wait-Process -Name Decentraland -Timeout 30 -ErrorAction SilentlyContinue
```

Keep the brackets in the patterns, so they can't match the shell running the command (see **creator-hub-mcp**). Ask first when the user owns that window. Full detail in **creator-hub-mcp** → "Preview lifecycle".

## Models unoptimized or fonts on their fallback

The desktop client converts every local scene to asset bundles before it loads, so a `fontSrc` font on its fallback or models loading as raw GLTFs means the converter did not serve this scene. The **AB** panel of the Explorer's debug menu says why, and `get_scene_logs` / `Player.log` carry the same milestones. The usual cause after a force-quit: a stale `abgen` — the converter, a child process on `127.0.0.1:5147` that survives a force-quit — still holds the port, and a new launch adopts it only when it is the same Explorer build serving the same scene and already ready; anything else degrades the session to raw GLTFs and the built-in font until it is stopped. `pgrep -fl abgen`, stop the pid the panel names, then relaunch once. Stop it before a Decentraland launcher update too: a surviving `abgen` blocked one because its files were in use (observed 2026-11). Other causes: the converter not starting, a single bundle that failed and fell back to its raw GLTF (`asset bundle unavailable (…), loading the raw GLTF instead`), or a font in a format other than `.ttf`, which never converts. Detail: **optimize-scene** → *Local Asset Bundle Preview*.

## The connection dropped

The client probably crashed or was closed (`Player.log` above says why) — relaunch it the same way it was started (`npm run start -- --mcp --skip-auth-screen true`, or the manual launch line in [`setup.md`](setup.md)); the MCP endpoint URL stays the same.

## Regression rig: `149,149-synthetic-input-showcase`

`sdk7-test-scenes/scenes/149,149-synthetic-input-showcase` is a 2x2-parcel scene built to be driven by this MCP: ten stations (S1-S10) exercise the whole synthetic-input surface — `walk`, `camera_look`, `look_at`, `click_entity`, `click_at`, `hover_entity`, `press_input`, and the `ui_*` tools — each with an in-world readout, so a wrong result is visible rather than inferred. Run it to **sanity-check the MCP itself** before concluding a scene under test is broken: if a station misbehaves, the tool or the Explorer is the suspect, not your scene. Its `MCP_SHOWCASE.md` lists the known-open client issues and per-station driving notes.
