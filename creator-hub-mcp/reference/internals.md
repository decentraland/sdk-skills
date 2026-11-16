# Creator Hub MCP internals

Source-level mechanisms behind the rules in `SKILL.md`. Read this when a rule's behavior surprises you, when you need to report a Hub bug with specifics, or when checking whether a rule still holds against newer Creator Hub source. Paths are in the `decentraland/creator-hub` repo unless noted.

## Data layer process

The thing that holds the editor's engine and writes `assets/scene/main.composite` is the **@dcl/inspector data layer**, and under the **Bevy** renderer it runs in a **separate child process** — logged by the app as `[UtilityProcess] Running "sdk-commands start --port <n> --no-browser --no-client --data-layer"` (assembled in `main/src/modules/bevy-realm.ts`; the port is ephemeral, the binary is the *scene's* `node_modules/@dcl/sdk-commands`). Under the Babylon renderer the same data layer runs inside the inspector iframe instead. Either way the Electron main process never writes the composite — it only reads it.

**Bevy supervision** (`main/src/modules/bevy-realm.ts` `watchExit`, `realm-status.ts`): an unexpected exit marks the scene's realm down; while it is down `scene-mcp.ts` answers every tool with `DATA_LAYER_DOWN`, and a mutation that was in flight returns `DATA_LAYER_STOPPED_DURING_OP` after its 300 ms settle. The renderer restarts the realm (`renderer/src/hooks/useBevyRealmRestart.ts`: `MAX_AUTO_RESTARTS = 3`, a run that served `HEALTHY_UPTIME_MS = 60_000` resets the count) and then shows the give-up screen. Nothing equivalent watches the Babylon in-iframe data layer.

## Outside access (external agents)

- `main/src/modules/mcp-discovery.ts`: `.mcp.json` ownership test (`isOwnClaudeMcpConfig`: one server, `creator-hub`, URL on `http://127.0.0.1:`), discovery file write/remove, `sceneOpened` / `sceneClosed` (bind and detach the tools), `syncExposeMcpServer`, the `mcp-server.request` watcher (`fs.watch` on userData; a request left while the Hub was closed is handled at start).
- `main/src/modules/scene-mcp.ts`: `ASSISTANT_TOKEN` (per app run) vs `externalToken` (exists only while access is on; `setExternalMcpAccess(false)` drops it and closes outside sessions); `callerFor` maps a bearer token to `assistant` / `external`; `revertTurn` returns `blocked` when `externalMutationsSinceTurn > 0`.
- `main/src/modules/project-config-files.ts`: `ensureGitignored`, `upsertMcpServer` (used by the embedded assistant's Cursor / Gemini config writers).
- UI: `renderer/src/components/Modals/AppSettings/Tabs/AiTab/component.tsx` (switch + snippet), `renderer/src/components/Snackbar/ExternalAgentAccess/` + `renderer/src/hooks/useExternalAgentAccess.ts` (the Allow / Don't allow notice), `renderer/src/hooks/useSceneMcpDiscovery.ts` (scene open/close IPC). Strings: `locales/en.json` keys `modal.app_settings.fields.mcp_server.*`, `snackbar.external_agent_access.*`, `editor.ai.revert_blocked`, `editor.ai.setup.alt_access_off`.

## Spawn points through `set_scene_settings`

The tool's input schema takes `position` in the `scene.json` shape (`x: number | [min, max]`, `main/src/modules/scene-mcp.ts`); the root entity's `inspector::SceneMetadata-v*` stores OneOf `{ $case: 'single' | 'range', value }` (`lib/sdk/components/SceneMetadata.ts`). The inspector's RPC handlers (`packages/inspector/src/lib/rpc/scene/server.ts`, `get_scene_settings` / `set_scene_settings`) convert both ways (`toSceneSpawnPoint` / `fromSceneSpawnPoint` in `data-layer/host/utils/component.ts`) and validate each axis with `isSceneSpawnAxis` before writing. A bare number in the OneOf slot (written before the conversion existed, or by a hand `set_component` without `$case`) kills a scene data layer on `@dcl/ecs` older than 7.28.0 (`TypeError: Cannot read properties of undefined (reading 'deserialize')`) and makes a newer one write `"position": {}` to `scene.json`.

Recovery after closing the scene: on the next open the data layer re-seeds `SceneMetadata` from `scene.json` (`overrideWithSceneJson`, `data-layer/host/composite-provider.ts`), so a hand edit made with the scene closed wins and the composite's copy is refreshed from it.

## Preview lifecycle

`stop_preview`: Verified in `main/src/modules/explorer-gateway.ts`: it closes the MCP client/transport and `treeKill`s the `sdk-commands start --explorer-alpha --hub … --mcp --mcp-port <n>` child (logged as `[UtilityProcess] Killing process "…"`), then answers `{ok: true}`. The Explorer app is **not in that process tree** — sdk-commands launches it with `open decentraland://…`, which hands off to the OS and exits — and nothing in the Creator Hub kills it.

`preview_status`: `running` is computed from *the gateway object existing* plus `child.alive()` on that same sdk-commands handle — **not** a probe of the Explorer or its port.

The failing relaunch, verified parts first: each `launch_preview` grabs a **fresh ephemeral MCP port** (`[Gateway] launching preview … with MCP on :53880`) and passes it as `--mcp-port`, and the desktop Explorer is **single-instance**, so a second launch's deep link is handed to the window already open. The inference (not read off the Explorer source) is that the open window keeps its MCP on the *old* port and never binds the new one. Observed 2026-10-08: two launches in a row reproduced it, and the failure path also killed the dev server it had just started.

## Re-baked GLB staleness

Not the dev server's doing: `@dcl/sdk-commands` re-walks the project on every content request, serves current bytes `no-cache`, versions each file's id by `mtime`, and runs a chokidar watcher the Hub never disables — so the staleness is **downstream, in the Explorer's own asset cache**. Observed 2026-10-08: GLBs added or renamed after `launch_preview` were missing in-world until `explorer_reload_scene` (one case) or a full preview restart (another), and a GLB overwritten in place under the same name kept showing the old mesh.

## Gotcha sources

- **`No scene is open.`:** `currentProjectDir` in `scene-mcp.ts` is set by `setSceneMcpProject`, called from `mcp-discovery.ts` `sceneOpened` (editor opens a scene) and from `ai.ts` when an embedded turn starts, and cleared by `sceneClosed`. Every tool checks it first, mutations included (`requestSceneOp`); `No editor window is open.` is only the main window missing.
- **Bevy mute:** `packages/inspector/scripts/bevy-engine-host/editor-audio.js` (master gain + forced-muted media); `BevyRenderer.ts` starts with `#muted = true`.
- **Scene RPC timeout:** `REQUEST_TIMEOUT_MS` (5 s) in `renderer/src/modules/rpc/scene/client.ts`. Seen twice on `create_entity` while the Bevy editor was in Play (2026-10-08).
- **`ask_user` timeout:** `ASK_TIMEOUT_MS = 10 * 60_000` in `packages/creator-hub/main/src/modules/scene-mcp.ts`.
- **`get_scene_metrics` under Bevy:** `packages/inspector/src/lib/renderer/bevy/BevyRenderer.ts` — `getSceneMetrics()` returns `{triangles: 0, bodies: 0, materials: 0, textures: 0}` and `getEntitiesOutsideLayout()` returns `[]`, both hardcoded ("No renderer to introspect yet — report zeros"). Under Babylon, `computeEntitiesOutsideLayout` tests each entity's bounding mesh against the layout.
- **Autogenerated thumbnail overwrite:** `getProjectThumbnailPath` / `saveThumbnail` in `packages/creator-hub/preload/src/modules/workspace.ts`.
- **`assets/Images/` casing:** `resolveImagesFolderName` keeps an existing folder that differs only in case; `set_scene_settings` has no `thumbnail` key and the MCP SDK strips unknown keys before the editor sees them; the editor binds to whichever `inspector::SceneMetadata-vN` carries data (`resolveActiveSceneComponent`).
- **Thumbnail validation:** `getThumbnailWarnings` / `validateThumbnailFile` in `packages/inspector/src/components/EntityInspector/SceneInspector/utils.ts`; the Hub's own captures are centre-cropped to 16:9 and capped at 1920 wide in `packages/creator-hub/renderer/src/modules/image.ts`. The 1 MB cap is not in creator-hub: nothing in the repo matches the message or the constant.
- **Bundled Node:** `main/src/modules/node-runtime.ts`, `scripts/download-node.js`.
- **Dev-server bundle race:** the preview's `sdk-commands start` watches `src/**` and rewrites `bin/index.js` on every save (`logic/bundle.ts` in `@dcl/sdk-commands`); a manual `sdk-commands build` writes the same file.
- **Reopening the scene kills its preview:** leaving the editor page runs `handleBack` → `killPreview` in the Hub's `EditorPage`.
- **`Tool call interrupted` on long preview calls:** the chat's stop control runs `aiStop` → `killTree` (`main/src/modules/ai.ts`) on the CLI child.
- **Catalog metadata is not a preview:** `search_catalog` for "man" returns **Human** (`decorations`, tags `man, person, figure, humanoid…`, caption "Human figure in mid-action"), whose GLB is the word *HUMAN* in 3D letters (`packages/asset-packs/packs/cyberpunk/assets/human/Word_Human.glb`). It was placed as a character in a 2026-10-12 session.
