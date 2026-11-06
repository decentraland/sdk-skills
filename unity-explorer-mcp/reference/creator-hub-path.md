# The Creator Hub path

Reached when the Explorer arrives through the Creator Hub's MCP (`mcp__creator-hub__*` tools; skill **creator-hub-mcp**) instead of a server registration of your own.

## Tool names, and why Setup is skipped

`launch_preview` starts the scene preview with this MCP server on, and the runtime tools are re-published live as `explorer_<name>` (`explorer_screenshot`, `explorer_walk`, …); `explorer_call(tool, arguments)` is the fallback while they bind. SKILL.md's Setup does not apply — no registration, no bind gate, no port 8123 probe — so go straight to the iteration loop with those tool names. The reference files apply unchanged.

From an *external* client connected to the Creator Hub (Claude Code terminal, Cursor) the `explorer_*` tools never appear and `launch_preview` answers `No scene is open.`: there the route is the Hub's **Play** button with **Enable MCP Server** ticked, and SKILL.md's Setup applies in full (see **creator-hub-mcp** → Gotchas).

## Before `launch_preview`: check the OS, not just the tool

`stop_preview` returns `{ok: true}` while the Explorer keeps running — it kills only the Hub's `sdk-commands` child — and `preview_status` reports that child, not the app. A surviving single-instance window never binds the next launch's port, so the Hub times out after ~45 s with "The preview launched but its MCP server never answered". Check `preview_status` *and* the process list (`pgrep -fl '[M]acOS/Explorer'` on macOS, `Get-Process Decentraland` on Windows), close a stale instance, confirm it exited, then launch **once**. Kill recipes: "Counting and killing Explorer processes" in [`recovery.md`](recovery.md). The full lifecycle — why, the inverse case where the creator closes the window while `preview_status` still says running, and the "session ended" interruption that is not a failure — is "Preview lifecycle" in **creator-hub-mcp**.

## The Explorer is the creator's own window

The instance you drive is the one they are playing in: `move_to`, `reload_scene`, camera-mode changes and asset-file churn all land on their playtest. Before driving it, read `get_player_state` (position, velocity) and recent `get_scene_logs` for signs they are mid-session; prefer `set_camera_pose` (free camera — it does not move the avatar) over `move_to` for a look-check; and afterwards restore the camera mode you **found** (`first_person` / `drone_view`), not blindly `third_person`. Ask before killing their window. Observed 2026-10-10.
