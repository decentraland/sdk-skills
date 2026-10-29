# Creator Hub MCP internals

Source-level mechanisms behind the rules in `SKILL.md`. Read this when a rule's behavior surprises you, when you need to report a Hub bug with specifics, or when checking whether a rule still holds against newer Creator Hub source. Paths are in the `decentraland/creator-hub` repo unless noted.

## Data layer process

The thing that holds the editor's engine and writes `assets/scene/main.composite` is the **@dcl/inspector data layer**, and under the **Bevy** renderer it runs in a **separate child process** — logged by the app as `[UtilityProcess] Running "sdk-commands start --port <n> --no-browser --no-client --data-layer"` (assembled in `main/src/modules/bevy-realm.ts`; the port is ephemeral, the binary is the *scene's* `node_modules/@dcl/sdk-commands`). Under the Babylon renderer the same data layer runs inside the inspector iframe instead. Either way the Electron main process never writes the composite — it only reads it.

## Spawn points through `set_scene_settings`

**Why `set_scene_settings` + `spawnPoints` kills the data layer or empties the position.** The tool's input schema takes `position` in the `scene.json` shape — `x: number | [min, max]` (`main/src/modules/scene-mcp.ts`) — and the inspector's handler merges the patch **verbatim** into the root entity's `inspector::SceneMetadata-v*` component (`{ ...current, ...patch }`, `packages/inspector/src/lib/rpc/scene/server.ts`), whose `position.x/y/z` are `Schemas.OneOf({ single, range })` and expect `{ $case: 'single', value: 8 }` or `{ $case: 'range', value: [a, b] }` (`lib/sdk/components/SceneMetadata.ts`). Nothing converts one shape into the other, so a plain number sits in a OneOf slot and the CRDT serializer sees no `$case`. The Hub's own inspector runs `@dcl/ecs` 7.29.0 (root `package.json`), whose OneOf serializer writes an *empty case* for a value with no `$case` (`@dcl/sdk` 7.28.0+). What happens next depends on the scene's own `node_modules/@dcl/inspector` data layer: on an `@dcl/ecs` older than 7.28.0 its OneOf **deserializer** cannot read that empty case (`specs[specKeys[0 - 1]]` is undefined) and the data layer dies — that is the `TypeError: Cannot read properties of undefined (reading 'deserialize')` in `tooling-entrypoint.js` (`Object.deserialize` → `updateFromCrdt` → `receiveMessages`), seen twice on 2026-10-08 with **point-valued** spawn points: version skew between the Hub's writer and the scene's older reader. With a matching `@dcl/ecs` the write survives but reads back as `{}`, and the data layer's `scene.json` writer (`data-layer/host/utils/component.ts`) emits `"position": {}` — seen twice on Creator Hub 0.51.0 (2026-10) while `get_scene_settings` still showed a well-formed value. Point and range values are both affected.

Recovery after closing the scene: on the next open the data layer re-seeds `SceneMetadata` from `scene.json` (`overrideWithSceneJson`, `data-layer/host/composite-provider.ts`), so a hand edit made with the scene closed wins and the composite's copy is refreshed from it.

## Preview lifecycle

`stop_preview`: Verified in `main/src/modules/explorer-gateway.ts`: it closes the MCP client/transport and `treeKill`s the `sdk-commands start --explorer-alpha --hub … --mcp --mcp-port <n>` child (logged as `[UtilityProcess] Killing process "…"`), then answers `{ok: true}`. The Explorer app is **not in that process tree** — sdk-commands launches it with `open decentraland://…`, which hands off to the OS and exits — and nothing in the Creator Hub kills it.

`preview_status`: `running` is computed from *the gateway object existing* plus `child.alive()` on that same sdk-commands handle — **not** a probe of the Explorer or its port.

The failing relaunch, verified parts first: each `launch_preview` grabs a **fresh ephemeral MCP port** (`[Gateway] launching preview … with MCP on :53880`) and passes it as `--mcp-port`, and the desktop Explorer is **single-instance**, so a second launch's deep link is handed to the window already open. The inference (not read off the Explorer source) is that the open window keeps its MCP on the *old* port and never binds the new one. Observed 2026-10-08: two launches in a row reproduced it, and the failure path also killed the dev server it had just started.

## Re-baked GLB staleness

Not the dev server's doing: `@dcl/sdk-commands` re-walks the project on every content request, serves current bytes `no-cache`, versions each file's id by `mtime`, and runs a chokidar watcher the Hub never disables — so the staleness is **downstream, in the Explorer's own asset cache**. Observed 2026-10-08: GLBs added or renamed after `launch_preview` were missing in-world until `explorer_reload_scene` (one case) or a full preview restart (another), and a GLB overwritten in place under the same name kept showing the old mesh.

## Gotcha sources

- **`No scene is open.` from an external client:** the project directory is bound by `setSceneMcpProject`, called from `main/src/modules/ai.ts` when the embedded assistant starts a turn; this has held since the server's initial release.
- **Scene RPC timeout:** `REQUEST_TIMEOUT_MS` (5 s) in `renderer/src/modules/rpc/scene/client.ts`. Seen twice on `create_entity` while the Bevy editor was in Play (2026-10-08).
- **`ask_user` timeout:** `ASK_TIMEOUT_MS = 10 * 60_000` in `packages/creator-hub/main/src/modules/scene-mcp.ts`.
- **`get_scene_metrics` under Bevy:** `packages/inspector/src/lib/renderer/bevy/BevyRenderer.ts` — `getSceneMetrics()` returns `{triangles: 0, bodies: 0, materials: 0, textures: 0}` and `getEntitiesOutsideLayout()` returns `[]`, both hardcoded ("No renderer to introspect yet — report zeros"). Under Babylon, `computeEntitiesOutsideLayout` tests each entity's bounding mesh against the layout.
- **Autogenerated thumbnail overwrite:** `getProjectThumbnailPath` / `saveThumbnail` in `packages/creator-hub/preload/src/modules/workspace.ts`.
- **`assets/Images/` casing:** `resolveImagesFolderName` keeps an existing folder that differs only in case; `set_scene_settings` has no `thumbnail` key and the MCP SDK strips unknown keys before the editor sees them; the editor binds to whichever `inspector::SceneMetadata-vN` carries data (`resolveActiveSceneComponent`).
- **Thumbnail validation:** `getThumbnailWarnings` / `validateThumbnailFile` in `packages/inspector/src/components/EntityInspector/SceneInspector/utils.ts`; the Hub's own captures are centre-cropped to 16:9 and capped at 1920 wide in `packages/creator-hub/renderer/src/modules/image.ts`. The 1 MB cap is not in creator-hub: nothing in the repo matches the message or the constant.
- **Bundled Node:** `main/src/modules/node-runtime.ts`, `scripts/download-node.js`.
