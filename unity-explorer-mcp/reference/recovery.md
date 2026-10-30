# Recovery reference

Reached when the scene, the client, or the connection has gone wrong, and whenever Explorer processes are counted, killed or relaunched.

## Torn bundle (an unrecoverable scene drop)

Two saves seconds apart can make the Explorer load a mid-write bundle → `SyntaxError: Invalid or unexpected token` at scene start → the scene drops out and `get_scene_state` reports `scene: null` while you are standing on the parcel. Nothing recovers it in-session: `reload_scene` errors ("no scene at the current parcel"), `/reload` hangs, the minimap RELOAD SCENE button no-ops, and moving off-parcel and back does not bring it back. Only relaunching the Explorer restores it: have the user close the client, then relaunch the stack the way it was started.

The milder version of the same cause — usage and import landing in separate saves — is a transient `SceneError: X is not defined`. Prevention is the **one write per change** rule in the iteration loop.

## The scene reports `Running` but does not tick

`get_scene_state` says `Running` / `isReady: true`, yet the scene's JS is not running: `get_performance_stats` → `sceneTick: null`, `get_crdt_traffic` → "The scene did not tick during the window", the last `get_scene_logs` line is minutes old, and gesture tools time out with "did not complete within Ns (is the simulation paused?)". Nothing on the state channel shows it — only the tick-based reads do, so read one of them when a first gesture times out. `reload_scene` recovers it (seen once at the start of an Editor-hosted session; it did not recur).

## Player ends up off-parcel after a hot reload

The player can land outside the scene (e.g. parcel `0,-1`); `get_scene_state` then reports a null scene and `reload_scene` fails with "no scene at the current parcel". Check `get_player_state` → `parcel`, `move_to` back inside, and the scene loads again.

## The connection dropped

The client probably crashed or was closed — relaunch it the same way it was started (`npm run start -- --mcp --skip-auth-screen true`, or the manual launch line in [`setup.md`](setup.md)); the MCP endpoint URL stays the same. Under the Creator Hub's `launch_preview`, a string of `fetch failed` results means the app is gone, not that the scene is broken — see [`creator-hub-path.md`](creator-hub-path.md).

## Counting and killing Explorer processes

**Keep the brackets in every pattern.** `pgrep -f` / `pkill -f` match against each process's full command line, and agent shell tools run commands as `bash -c "<command>"`, so a plain pattern also matches the wrapper shell: the check reports a live Explorer that isn't there, and `pkill` kills the shell running it. The watchdog's command line also contains the Explorer path. Ask first when the user owns that window, and after a kill confirm the process exited before launching **once**.

```bash
pgrep -fl '[M]acOS/Explorer'; pgrep -fl '[d]cl_watchdog'                        # is either alive?
pkill -f '[d]cl_watchdog'; pkill -f '[D]ecentraland.app/Contents/MacOS/Explorer'   # watchdog first
for i in $(seq 1 30); do pgrep -f '[M]acOS/Explorer' >/dev/null || break; sleep 1; done   # wait up to 30 s
```

On Windows (PowerShell, matching by process name so the check never matches the shell):

```powershell
Get-Process Decentraland, dcl_watchdog -ErrorAction SilentlyContinue
Stop-Process -Name dcl_watchdog -Force -ErrorAction SilentlyContinue
Stop-Process -Name Decentraland -Force -ErrorAction SilentlyContinue
Wait-Process -Name Decentraland -Timeout 30 -ErrorAction SilentlyContinue
```

**Editor-hosted Explorer**: when `pgrep` for the app finds nothing while the MCP probe answers and `lsof -nP -iTCP:8123 -sTCP:LISTEN` names `Unity`, the client runs in Unity Editor play mode. None of these recipes apply — the user owns the Editor; ask them to stop and re-enter play mode. In-session differences are under "The Explorer running inside the Unity Editor" in [`setup.md`](setup.md).

## The regression rig: `149,149-synthetic-input-showcase`

`sdk7-test-scenes/scenes/149,149-synthetic-input-showcase` is a 2x2-parcel scene built to be driven by this MCP: twelve stations (S1-S12) exercise the whole synthetic-input surface — `walk`, `camera_look`, `look_at`, `click_entity`, `click_at`, `hover_entity`, `press_input`, the `ui_*` tools, and the reads beside them (`get_reticle`, `get_visible_entities`, `get_audio_state`) — each with an in-world readout, so a wrong result is visible rather than inferred. Run it to **sanity-check the MCP itself** before concluding a scene under test is broken: if a station misbehaves, the tool or the Explorer is the suspect, not your scene. Its `MCP_SHOWCASE.md` lists the known-open client issues and per-station driving notes.
