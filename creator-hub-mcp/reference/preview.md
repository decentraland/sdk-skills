# Preview lifecycle: details and recipes

Read this when `launch_preview` fails or hangs, `preview_status` disagrees with what you see, you need to close a stale Explorer, or you pass positions to `explorer_*` tools. The rules are in `SKILL.md` → Preview lifecycle; the source-level mechanism is in [`internals.md`](internals.md) → Preview lifecycle.

## Why a second `launch_preview` fails

Each launch passes a fresh MCP port, and the single-instance desktop Explorer hands the new deep link to the window already open, which keeps its old port. After ~45 s of retries the Hub returns:

> The preview launched but its MCP server never answered. The Explorer may still be starting, or this build has no MCP support. (TypeError: fetch failed)

That failure path **also kills the dev server it just started**, leaving the Explorer orphaned on a dead realm. `preview_status` can block up to **90 s** polling an Explorer that is up but not ready, so a long hang there is not a crash.

## `launch_preview` blocks; `package.json` lifecycle scripts do not run

- `launch_preview` returns only once the scene is ready: up to 45 s for the Explorer's MCP to connect plus a 90 s ready timeout, and `preview_status` can block up to 90 s (above). A hand-rolled MCP client needs a per-call timeout well above the MCP SDK's 60 s default (creator-hub `explorer-gateway.ts`, `CONNECT_TIMEOUT_MS` / `READY_TIMEOUT_MS`; observed 2026-11-06).
- Creator Hub **Play** and `launch_preview` invoke sdk-commands directly, so `package.json` `prestart` / `prebuild` scripts do not run (they run only under `npm run start` / `npm run build`). A generated file the scene needs must be produced by another route, such as committing it or running the generator before Play.

## Runtime tool positions are world metres

Every position passed to an `explorer_*` tool (`explorer_move_to`, `explorer_teleport`, `explorer_look_at`, click aims) is in world metres: scene-local x/z plus `scene.base` × 16 (parcel mapping: **unity-explorer-mcp** → Scene health). A scene-local position sends the player off-parcel, and every runtime tool then answers "No scene world found at the current parcel" (in-world, 2026-11-06).

## `Tool call interrupted: the session ended…`

On `launch_preview` / `preview_status` this is the creator stopping the turn, not a preview failure. Both tools block for a long time; inside the embedded assistant the chat's stop control kills the CLI child meanwhile, and the tool call reports itself interrupted. Four such interruptions in one session (2026-10-08) each coincided with the creator's next message, and the preview was running the whole time. `pgrep` the Explorer and read the log before concluding anything, and keep "`launch_preview` ends the session" out of the project's notes.

## The Explorer closed while `preview_status` says `running: true`

The sdk-commands child is still alive, so the handle still says yes, while every `explorer_*` call fails with `fetch failed` (observed 2026-10-12). A string of `fetch failed` results means "the app is gone", not "the scene is broken". Confirm with `pgrep -fl '[M]acOS/Explorer'`, then `stop_preview` followed by one `launch_preview`.

## Checking and closing the Explorer

macOS:

```bash
pgrep -fl '[M]acOS/Explorer'    # the Explorer app itself
pgrep -fl '[d]cl_watchdog'      # its watchdog, from /Applications/Decentraland.app
```

Keep the brackets in these patterns. `pgrep -f` / `pkill -f` match against every process's full command line, and many agent shell tools run commands as `bash -c "<command>"`, so a plain pattern also matches the wrapper shell: the check reports a live Explorer that isn't there, and `pkill` kills the shell running it. `[d]cl_watchdog` still matches the real process, but never the command text itself.

Close a stale instance, **confirm it exited**, then `launch_preview` **once**:

```bash
pkill -f '[d]cl_watchdog'; pkill -f '[D]ecentraland.app/Contents/MacOS/Explorer'
for i in $(seq 1 30); do pgrep -f '[M]acOS/Explorer' >/dev/null || break; sleep 1; done   # wait up to 30 s
```

Windows: the Explorer is `Decentraland.exe` and the watchdog `dcl_watchdog.exe`. In PowerShell (matching by process name, so the check never matches the shell running it):

```powershell
Get-Process Decentraland, dcl_watchdog -ErrorAction SilentlyContinue        # is either alive?
Stop-Process -Name dcl_watchdog -Force -ErrorAction SilentlyContinue        # watchdog first: it reacts to a non-zero Explorer exit
Stop-Process -Name Decentraland -Force -ErrorAction SilentlyContinue
Wait-Process -Name Decentraland -Timeout 30 -ErrorAction SilentlyContinue   # confirm it exited
```

Relaunching once after a confirmed exit connected first try on both attempts in testing.

## A re-baked GLB keeps rendering its old contents

The dev server serves current bytes; the staleness is in the Explorer's own asset cache (analysis: [`internals.md`](internals.md) → Re-baked GLB staleness). GLBs added or renamed after `launch_preview` can be missing in-world until `explorer_reload_scene` or a full preview restart, and a GLB **overwritten in place under the same name** can keep showing the old mesh. `src/` hot reload is unaffected. Symptom: the mesh you just exported is absent or visibly stale while `explorer_get_scene_logs` shows no load error. Also check `.dclignore`: an ignored path is never served at all.
