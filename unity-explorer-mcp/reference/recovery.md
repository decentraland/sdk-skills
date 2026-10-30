# Recovery reference

Reached when the scene, the client, or the connection has gone wrong.

## Torn bundle (an unrecoverable scene drop)

Two saves seconds apart can make the Explorer load a mid-write bundle → `SyntaxError: Invalid or unexpected token` at scene start → the scene drops out and `get_scene_state` reports `scene: null` while you are standing on the parcel. Nothing recovers it in-session: `reload_scene` errors ("no scene at the current parcel"), `/reload` hangs, the minimap RELOAD SCENE button no-ops, and moving off-parcel and back does not bring it back. Only relaunching the Explorer restores it: have the user close the client, then relaunch the stack the way it was started.

The milder version of the same cause — usage and import landing in separate saves — is a transient `SceneError: X is not defined`. Prevention is the **one write per change** rule in the iteration loop.

## The scene reports `Running` but does not tick

`get_scene_state` says `Running` / `isReady: true`, yet the scene's JS is not running: `get_performance_stats` → `sceneTick: null`, `get_crdt_traffic` → "The scene did not tick during the window", the last `get_scene_logs` line is minutes old, and gesture tools time out with "did not complete within Ns (is the simulation paused?)". Nothing on the state channel shows it — only the tick-based reads do, so read one of them when a first gesture times out. `reload_scene` recovers it (seen once at the start of an Editor-hosted session; it did not recur).

## The Explorer is hosted by the Unity Editor

When the client runs in Unity Editor play mode, the MCP server belongs to the `Unity` process: `pgrep -fl '[M]acOS/Explorer'` finds nothing, `lsof -nP -iTCP:8123 -sTCP:LISTEN` names `Unity`, and none of the kill/relaunch recipes in this file apply — the user owns the Editor; ask them to stop and re-enter play mode. Device-path tools (`ui_click device:true`, `ui_hover device:true`, `ui_drag path:device`) need the Game view focused there — see [`interaction.md`](interaction.md).

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

## The connection dropped

The client probably crashed or was closed — relaunch it the same way it was started (`npm run start -- --mcp --skip-auth-screen true`, or the manual launch line in [`setup.md`](setup.md)); the MCP endpoint URL stays the same.
