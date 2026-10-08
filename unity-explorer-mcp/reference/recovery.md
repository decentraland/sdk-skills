# Recovery reference

Reached when the scene, the client, or the connection has gone wrong.

## Torn bundle (an unrecoverable scene drop)

Two saves seconds apart can make the Explorer load a mid-write bundle → `SyntaxError: Invalid or unexpected token` at scene start → the scene drops out and `get_scene_state` reports `scene: null` while you are standing on the parcel. Nothing recovers it in-session: `reload_scene` errors ("no scene at the current parcel"), `/reload` hangs, the minimap RELOAD SCENE button no-ops, and moving off-parcel and back does not bring it back. Only relaunching the Explorer restores it: have the user close the client, then relaunch the stack the way it was started.

The milder version of the same cause — usage and import landing in separate saves — is a transient `SceneError: X is not defined`. Prevention is the **one write per change** rule in the iteration loop.

## Player ends up off-parcel after a hot reload

The player can land outside the scene (e.g. parcel `0,-1`); `get_scene_state` then reports a null scene and `reload_scene` fails with "no scene at the current parcel". Check `get_player_state` → `parcel`, `move_to` back inside, and the scene loads again.

## "The preview launched but its MCP server never answered" (Creator Hub `launch_preview` path)

A stale Explorer process, not a broken scene. `stop_preview` kills only the Hub's `sdk-commands` child — the Explorer app survives it, holding its MCP on the *previous* ephemeral port — and `preview_status` reports "not running" because it checks that child's process handle, not the app. The next `launch_preview` picks a new port the surviving single-instance window never binds, and the Hub times out after ~45 s.

Check the OS, not just the tool, then close the stale instance and launch **once**:

```bash
pgrep -fl "MacOS/Explorer"; pgrep -fl dcl_watchdog
pkill -f dcl_watchdog; pkill -f "Decentraland.app/Contents/MacOS/Explorer"
until ! pgrep -qf "MacOS/Explorer"; do sleep 1; done
```

On Windows (PowerShell):

```powershell
Get-Process Decentraland, dcl_watchdog -ErrorAction SilentlyContinue
Stop-Process -Name dcl_watchdog -Force -ErrorAction SilentlyContinue
Stop-Process -Name Decentraland -Force -ErrorAction SilentlyContinue
Wait-Process -Name Decentraland -Timeout 30 -ErrorAction SilentlyContinue
```

Ask first when the user owns that window. Full detail in **creator-hub-mcp** → "Preview lifecycle".

## The connection dropped

The client probably crashed or was closed — relaunch it the same way it was started (`npm run start -- --mcp --skip-auth-screen true`, or the manual launch line in [`setup.md`](setup.md)); the MCP endpoint URL stays the same.
