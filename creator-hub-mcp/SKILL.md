---
name: creator-hub-mcp
description: "Edit the scene open in the Creator Hub live through its MCP server: entities, components, Smart Items, scene settings, preview. Use when `creator-hub` MCP tools are in the session, when a scene is or may be open in the Creator Hub (including before editing its main.composite, main.crdt or scene.json), when connecting an external agent to the Hub, or when the user mentions the Creator Hub AI assistant or its MCP server."
---

# Creator Hub MCP — live scene editing

The Creator Hub runs an MCP server inside the app (localhost, streamable HTTP, bearer token). Its tools read and mutate the scene that is **open in the editor**: changes apply to the live engine, show up in the viewport immediately, autosave to `assets/scene/main.composite`, and every one of them is a normal undo step for the user. The same server powers the Creator Hub's built-in AI assistant and can be exposed to any external MCP-capable tool.

Two ways you can be running:

| You are… | How the tools reach you |
| --- | --- |
| **Inside the Creator Hub's AI assistant** (Settings > AI > *Enable AI Assistant*; on by default) | Pre-wired. The app launches your `claude` / `codex` / `cursor-agent` / `gemini` CLI with the server registered as `creator-hub`, links these skills into the scene, and injects the same rules as this skill. Prompts can carry file attachments (as absolute paths) and `[Editor context]` asset chips: see [`reference/embedded-assistant.md`](reference/embedded-assistant.md). |
| **In another tool** (Claude Code, Cursor, Codex, Claude Desktop, …) | Connect to the running Creator Hub — see [`reference/connect.md`](reference/connect.md). The user copies a JSON snippet from Settings > AI > *Expose AI assistant MCP server*. Skills are the user's to install here — see [Where the skills come from](#where-the-skills-come-from). |

Tool names appear prefixed by the server name in some clients (`mcp__creator-hub__<tool>` in Claude Code) and bare in others (`scene_state`, `create_entity`, …). The connected tools are self-describing — treat the live catalog as authoritative over the table below.

## RULE — the MCP is the way to change the scene graph; the file is the fallback

**Change `assets/scene/main.composite`, `main.crdt` and `scene.json` through the tools whenever the Creator Hub MCP is available.** The rule, and why a hand edit to an open scene is silently lost, is **sdk-scenes** → *CRITICAL RULE — Editing an existing composite*. What the tools add on top:

- The tools do the bookkeeping the file workflow makes you do by hand: `inspector::Nodes` registration, `core-schema::Name`, `inspector::TransformConfig`, `entity-names.ts`, entity-id allocation, `jsonSchema` on non-core components.
- Every mutation is undoable by the user (Ctrl+Z / the assistant's *Undo AI changes* button). A file edit is not.

Decision ladder — pick the first row that matches:

1. **Tools present and answering** (`get_selection` or `get_scene_settings` returns — probe with an editor-routed tool, not `scene_state`, which answers `No scene is open.` from an external client even with the scene open; see Gotchas) → use them for every entity/component/settings change. Read the composite from disk only as a read-only cross-check.
2. **Tools present but failing** (`No editor window is open.`, connection refused, `401`) → the Creator Hub is closed, was restarted (URL and token rotate per launch), or no scene is open. Say so and ask the user to open the scene in the Creator Hub (or re-copy the connection snippet). Editing the file instead is the user's call, not yours.
3. **Tools absent, but the user has the Creator Hub** → tell them the MCP is the safe route and point them at [`reference/connect.md`](reference/connect.md). Hand-edit the file only if they decline, and only with the scene closed in the Creator Hub (the **composites** skill's edit-mode rules then apply in full). If the scene is (or may be) open, stop and ask the user to choose: **sdk-scenes** → Agent Behavioral Guidelines, item 5 (the three options and the wording). The code fallback is always the user's pick, never yours, not even in a non-interactive session.
4. **No Creator Hub in play** (CLI-only project, CI) → the **composites** skill's file workflow applies.

What still lives in files and is yours to edit directly: `src/**` (scene code; saving triggers a rebuild automatically), `assets/Scripts/*.tsx` (script components — write the file, then `attach_script`), and asset files you add under `assets/Models/`, `assets/Images/`, etc.

**Static geometry goes in through these tools**: walls, floors, furniture and props, primitives or GLBs, via `create_entity` + `set_component` `MeshRenderer` / `GltfContainer`, or `place_smart_item`. This is **sdk-scenes** → *CRITICAL RULE — Composite-first scene authoring* applied through the MCP.

**A save is not proof the running bundle has your change.** The preview's dev server rewrites `bin/index.js` on every save under `src/**`. A manual `sdk-commands build` while it runs writes the same file and the two race, and a save that lands mid-edit bundles half-written code (`SyntaxError`, scene unloads) — the one-write-per-change rule in **unity-explorer-mcp** applies. When something you changed does not show in-world, `grep` `bin/index.js` for a string literal from the edit before debugging the scene; if it is absent, touch the file and wait for the next `Bundle saved`.

## RULE — search the catalog before manually building any standard object

Before creating an entity and assembling its components with `create_entity` + `set_component`, **`search_catalog` first** to check whether a Smart Item already exists for the object. This applies especially to:

- **Lights** — the catalog has Spotlight and Point Light Smart Items (category `lights`) that bundle a real GLB model, a pre-configured `LightSource` component, and built-in Turn On / Turn Off / Toggle actions. A hand-made `LightSource` entity misses the visual model, inspector integration, and action wiring.
- **Interactive furniture** — doors, chairs, platforms, chests, buttons, levers, etc. Script-based items include **Floor Pressure Button** (`buttons`, pressed while anyone stands on it, shared across players by default), **Button Pedestal** (`buttons`), **Lab Vault Door** / **Lab Capsule Door** (`doors`), **Lab Stair Platform** (`platforms`, piston), **Water Plane** / **Water Cylinder** (`materials`, splash where a player enters).
- **Media** — screens, image displays, NFT frames.
- **Triggers** — trigger areas, click triggers. The `utils` category has exactly **one** entry named **"Trigger Area"** (`e9fa0eab-44de-4efe-af77-a71171a1a73f`), a script-based item: an invisible box or sphere the user places and resizes, with a control that seeds the AI-assistant composer with a prompt describing what should happen on enter/leave.

`place_smart_item` handles the boilerplate that manual `set_component` calls miss:
- Downloads the item's GLB files and resolves `asset-packs::Placeholder` with the real on-disk path (e.g. `assets/asset-packs/spotlight/spotlight.glb`).
- Sets up `asset-packs::Script`, `asset-packs::Actions`, and `inspector::Config` components so the item works in the Creator Hub UI with configurable actions and triggers.
- Registers the entity in `inspector::Nodes` automatically.

Build manually only when no catalog item fits the requirement.

**Media the user already has: tell them to drag it from the Local Assets tab onto the viewport.** That is the fastest path, and it spawns a *catalog item* pointed at their file, not a bare component — so the entity arrives with the same component set and basic-view `inspector::Config` a hand-placed item has:

| Dropped file | Item spawned | What gets repointed |
| --- | --- | --- |
| `.png` / `.jpg` / `.jpeg` | **Image** (`37460a1e-affc-4f87-b725-118cc11d86fc`) | the `Material` PBR texture `src`; the plane is also lifted `+0.5 m` so it stands on the ground instead of being half-buried |
| `.mp3` / `.ogg` / `.wav` | **Ambient Sound - Forest Birds** (`5c8b4646-6ec0-41a0-8e9b-415a58728a9e`) | `AudioSource.audioClipUrl` |
| `.mp4` | **Video Screen** (`0201653b-bd38-48af-b9ef-a902a7e8bc9c`) | `VideoPlayer.src` **and** `asset-packs::VideoScreen.defaultURL` — the admin message bus re-seeds `src` from `defaultURL` at runtime, so setting only `src` is silently reverted |

The entity is named after the file with the extension stripped, de-duplicated against existing names, and the template's own placeholder media file is skipped on import. `.glb` / `.gltf` still drop as plain models. You can reproduce this through the tools (`place_smart_item` the same asset id, then `set_component` the field above), but the drag is one gesture for the user — prefer it when they are at the keyboard.

## Tool catalog

Names as registered on the `creator-hub` server.

| Group | Tool | What it does |
| --- | --- | --- |
| Read | `get_project_info` | scene.json metadata (name, parcels, base, spawn points), SDK version, dependencies. Use it for Step 0 bounds. |
| Read | `scene_state` | Roster of authored entities: id, name, kind, world transform, component list, GLTF src, Smart-Item flag. Truncated to the first 200 entities. |
| Read | `entity_detail` | Every component value on one entity, by id or Name. Call it to learn a component's exact shape before `set_component`. |
| Read | `get_selection` | Entities currently selected in the editor. Resolve "this" / "the selected one" with it before acting. **The Scene root is never reported**: with only the root selected the result is empty, exactly as with nothing selected, so "this" may still refer to the scene as a whole. Player and Camera are reported normally. |
| Read | `get_scene_metrics` | Live budget (triangles, entities, bodies, materials, textures) vs per-scene limits, plus entities out of bounds. Zeros under Bevy — see Gotchas. |
| Read | `editor_screenshot` | Image of the editor viewport (no preview needed). |
| Mutate | `create_entity` | New entity, optional `name` and `parent` id. Returns the id. |
| Mutate | `remove_entity` | Deletes an entity and its children. |
| Mutate | `set_parent` | Reparents (world position preserved). `parent: 0` = scene root. |
| Mutate | `set_component` | Create or update a component. `component` accepts short (`Transform`) or full (`core::GltfContainer`) names; `value` is the same JSON the composite stores. On update the keys you pass are **merged**. |
| Mutate | `remove_component` | Removes a component by name. |
| Assets | `search_catalog` | Search the Creator Hub asset-packs catalog by name/category/tag; covers **static items as well as Smart Items**. Omit `query` to list everything. Categories include `buildings`, `materials` (Water Plane / Water Cylinder) and the **Avatar Animations** pack (45 `_emote.glb` clips + the 32 built-in emote names, file-only — see `place_smart_item`). Offline copies: **add-3d-models** → `references/asset-pack-catalog.md`, **avatar-animations** → `references/animation-catalog.md`. **Name, tags and caption are generated metadata, not a preview** ("man" returns **Human**, a GLB of the word *HUMAN* in 3D letters). Before placing an item you have not seen, look at its `thumbnail.png` (next to its `data.json` under `assets/asset-packs/<pkg>/` once downloaded, or in the creator-hub repo under `packages/asset-packs/packs/<pack>/assets/<item>/`) or run the bounding-box audit from **add-3d-models**. |
| Assets | `place_smart_item` | Place a catalog item by `assetId` at a world `position` (default 8,0,8). Downloads the item's files into `assets/asset-packs/<pkg>/` and spawns it with its behaviour. Most items arrive as `asset-packs::Script` code (no `Triggers`): configure them through the Script's params, and wire "When X" hooks via their optional `ActionCallback` params (**script-components**). **Rejects file-only assets** (Avatar Animations): for a built-in emote the error names the `triggerEmote({ predefinedEmote })` call to use; for a clip, ask the user to drag the card onto the viewport (adds the file, no entity) or download it per **avatar-animations** → `references/animation-catalog.md`, then play it with `triggerSceneEmote` from code. |
| Scripts | `attach_script` | Adds an `asset-packs::Script` component pointing at a file. **Write the file first** (under `assets/Scripts/`), then call this. Optional `priority`. |
| Settings | `get_scene_settings` / `set_scene_settings` | Read / change scene.json fields (name, description, categories, tags, age rating, skybox, terrain, `layout.parcels`, flags). Each passed field replaces the current one wholesale — read first. **Spawn points and the thumbnail go through `set_component` on entity `0` instead** (spawn points: next RULE; thumbnail: Gotchas). |
| Preview | `launch_preview`, `preview_status`, `stop_preview` | Start / poll / stop the scene in the Decentraland Explorer with its MCP server on. Read **Preview lifecycle** before using them. |
| Preview | `explorer_<name>` (dynamic), `explorer_call` | While a preview runs, the Explorer's runtime tools (`explorer_screenshot`, `explorer_walk`, `explorer_click_entity`, `explorer_get_scene_logs`, …) are registered live; `explorer_call(tool, arguments)` is the fallback if they haven't appeared yet. |
| Chat | `ask_user` | Blocks on a question shown in the Creator Hub chat; embedded assistant only. **Times out after 10 minutes** as a dismissal, closes the prompt in the chat, and discards any later answer. If the creator may have stepped away, put the question in your final message instead. |

## Workflow

**Read before you write.** `get_project_info` for parcels (compute bounds exactly as in the **composites** skill Step 0 — the tools let you place entities outside the scene, and `get_scene_metrics` is a weak safety net, see Gotchas). `scene_state` to see what exists and avoid duplicate names. `get_selection` whenever the user's request refers to what they have selected.

**Adding a model.**

- *Catalog item* → `search_catalog` then `place_smart_item`. Files land in `assets/asset-packs/<pkg>/` automatically.
- *Architecture* (rooms, corridors, doorways, anything the avatar walks through or into) → size the envelope for the **third-person camera** before placing; realistic dimensions read cramped in-world. The dimensions are in **add-3d-models** → "RULE: Scale interiors up for the third-person camera".
- *Model the user already has, or one you authored* → put the GLB under `assets/Models/` (see **add-3d-models** for Blender authoring and the bounding-box audit), then `create_entity` (with a `name`), `set_component` `Transform` (`{position:{x,y,z}, rotation:{x,y,z,w}, scale:{x,y,z}}`), and `set_component` `core::GltfContainer` (`{src, visibleMeshesCollisionMask, invisibleMeshesCollisionMask}` — mask rules and the animation/collider checks from **add-3d-models** apply; add `core::Animator` when the GLB has clips).
- *Lights* → `search_catalog` with category `lights`, then `place_smart_item`. Create a bare `LightSource` entity only for an invisible light or non-standard parameters — see **lighting-environment**.
- *Behaviour on it* → a Smart Item if one fits (`search_catalog` first), otherwise write a script under `assets/Scripts/` and `attach_script` (rules in **script-components**), or reference the entity by name from `src/` code (`engine.getEntityOrNullByName`).

**Component shapes.** `set_component` validates against the real schema. Before your first write of a component type, `entity_detail` on any entity that already has it — or read its entry in the **composites** format catalog. For `asset-packs::Script`, params are positional inside `layout` (see **script-components**); prefer `attach_script` and let the editor build the layout.

**After writing.** Read-after-write is safe *while the data layer is alive* — the server waits for the autosave before returning from a mutation, so a following `scene_state` is fresh. The on-disk check in the next RULE covers the case where it died. Check `get_scene_metrics` when you added geometry. `editor_screenshot` shows the result without a preview; `launch_preview` + `explorer_*` when you need the running scene (walk, click, logs, FPS). The iteration loop, camera framing, and performance references in **unity-explorer-mcp** apply to the `explorer_*` tools unchanged — skip that skill's Setup section (no `claude mcp add`, no bind gate) because the tools arrive through the `creator-hub` server. When done, leave the camera in the scene's intended retail mode (third person unless the scene forces first person) and `stop_preview` if you launched it only to check.

**If you have no runtime view, say so once and label what you cannot see.** From an external client the `explorer_*` tools never appear, and the **unity-explorer-mcp** server refusing its connection just means the Explorer is not running (that skill's Setup launches it). Offer to set it up; until a screenshot or the creator confirms a visual result, report it as unverified ("the screen plane should now sit inside the bezel — I have not seen it"), not as done. Fixes reported on the strength of the code alone have shipped floating screens, clipping doors, z-fighting walls and white materials straight to the owner.

**Leave editor-placed entities where the creator puts them.** Scene code that writes the `Transform` of an entity the editor owns, on every load, silently overrides every move the creator then makes in the Hub (a tray dragged onto a belt kept reappearing 2 m away in mid-air). Code may **read** an editor entity's `Transform`; if it needs placement of its own, give it its own entity.

**Transforms on nested entities are parent-local.** An entity the Hub nests under a group reports `Transform.position` relative to that group, not to the scene, so resolve the parent chain before using a position for a distance check or to place something beside it.

**Mistakes.** Undo is the user's — tell them what to undo, or `remove_entity` / `set_component` back to the previous value. Repair through the tools, never by editing `main.composite`.

## RULE — confirm a batch landed on disk; the data layer can die silently

The process that holds the editor's engine and writes `assets/scene/main.composite` is the **@dcl/inspector data layer** (a separate child process under the Bevy renderer, inside the inspector iframe under Babylon: [`reference/internals.md`](reference/internals.md) → Data layer process). When it dies, the MCP server stays up and **keeps answering every call as if nothing were wrong**.

**So after every batch of mutations, check the file, not the tool:** `assets/scene/main.composite`'s modification time must have advanced. An unchanged mtime across a batch means the edits exist only in a process that is gone.

```bash
stat -f '%m %N' "assets/scene/main.composite"   # macOS; coreutils: stat -c '%Y %n'
```

```powershell
(Get-Item "assets\scene\main.composite").LastWriteTime   # Windows (PowerShell)
```

If the mtime is stale: stop writing and follow [`reference/recovery.md`](reference/recovery.md) (symptoms, the log grep, and the user's close-reopen-reapply recovery). Read-backs through the tools confirm the pre-crash snapshot, not your write.

**Write spawn points with `set_component` on entity `0`, in the component's own `$case` shape.** `set_scene_settings` takes `scene.json`-shaped positions and the editor stores them unconverted, so a `spawnPoints` write through it either kills the data layer or writes `"position": {}` to `scene.json`, for point and range values alike (mechanism: [`reference/internals.md`](reference/internals.md) → Spawn points through `set_scene_settings`). Take the versioned component name from `entity_detail(0)` and pass only the `spawnPoints` key:

```json
{"spawnPoints": [{"name": "spawn", "default": true,
  "position": {"x": {"$case": "single", "value": 8}, "y": {"$case": "single", "value": 0}, "z": {"$case": "single", "value": 8}},
  "cameraTarget": {"x": 8, "y": 1, "z": 12}}]}
```

A ranged axis is `{"$case": "range", "value": [4, 12]}`. Then read `scene.json` back (it follows on the next autosave): **done when** every `spawnPoints[].position` holds numbers. If it came out as `{}`, see [`reference/recovery.md`](reference/recovery.md) → Spawn points.

## Preview lifecycle

Details, kill recipes and failure analysis: [`reference/preview.md`](reference/preview.md).

- **`stop_preview` never closes the Explorer**, and no tool does. It kills only the `sdk-commands start` dev server; the Explorer was handed to the OS through a `decentraland://` deep link and stays open.
- **`preview_status` reports the dev-server handle, not the Explorer.** It can say "not running" with the Explorer open, and `running: true` after the creator closed it (every `explorer_*` call then fails with `fetch failed`). **`pgrep` is the only reliable answer to "is the Explorer running":** `pgrep -fl '[M]acOS/Explorer'` (macOS; keep the brackets so the pattern never matches your own shell) or `Get-Process Decentraland` (Windows).
- **Before `launch_preview`, check the OS.** A second launch while an Explorer is open fails after ~45 s ("MCP server never answered") and kills the dev server it started. Prefer reusing a healthy running preview (hot reload + `explorer_reload_scene`). Close it only when it is stale or its MCP never answered, **confirm it exited**, then `launch_preview` **once**. When the user owns that Explorer window, ask before closing it.
- **`Tool call interrupted: the session ended…` on `launch_preview` / `preview_status` is the creator stopping the turn**, not a preview failure. `pgrep` the Explorer before concluding anything.
- **That Explorer window is the creator's, not a test rig.** `explorer_move_to`, `explorer_reload_scene`, camera-mode changes and asset-file churn all land in the session they are playing. Check `explorer_get_player_state` and recent `explorer_get_scene_logs` before taking the controls, prefer `explorer_set_camera_pose` over `explorer_move_to` for a look-check, and restore the camera mode you found (full rule: **unity-explorer-mcp** → The iteration loop).
- **After re-baking a GLB, export it under a new file name and repoint `GltfContainer.src`.** A GLB overwritten in place can keep rendering its old mesh in a running preview; otherwise `explorer_reload_scene`, then restart the preview if the old mesh persists.

## Where the skills come from

**Inside the Creator Hub's AI assistant the app installs them; leave them to it.** It downloads `decentraland/sdk-skills` **main** into a per-user cache and **symlinks** it into the open scene as **`.claude/skills`** and **`.agents/skills`** (added to a `.gitignore`; if the user already has a real `skills` directory, each skill is linked individually and names the user owns are skipped). A hand-placed copy shadows the managed symlink and then silently goes stale; the app is the updater.

**From an external client the skills are the user's to install.** The MCP snippet only connects the tools.

- If the Creator Hub has the scene open, the app-managed `.claude/skills` / `.agents/skills` symlinks already exist in the scene folder, so a session started **in that folder** picks them up. Use them as they are.
- Otherwise (a different working directory, the scene not open in the Creator Hub, or a client that reads skills from elsewhere), install them from the scene folder or the user's skills root:

  ```bash
  npx skills add decentraland/sdk-skills --all
  ```

  Re-run the same command to update; `npx skills update` only refreshes skills already present and misses newly added ones. See the repo [README](../README.md) for per-skill installs.

**Four skills are deliberately denylisted in the app-linked set:** `create-scene`, `deploy-scene`, `deploy-worlds`, `migrate-sdk6-to-sdk7`. The Creator Hub owns scaffolding and publishing through its own UI, and it is SDK7-only. A denylisted skill with supporting files (`create-scene`, `migrate-sdk6-to-sdk7`) ships **without its `SKILL.md`**, so its `references/` stay resolvable from other skills but the skill never triggers; one with nothing but `SKILL.md` (`deploy-scene`, `deploy-worlds`) is **skipped entirely**.

- Inside the Creator Hub's assistant, point a user who asks to scaffold or publish at the app's own flow.
- An external session in a Hub-linked folder has **no `deploy-scene` / `deploy-worlds`** either. Install them user-level, not into the symlinked folder: `npx skills add decentraland/sdk-skills --skill deploy-worlds -g`. Short path for a World: add `worldConfiguration.name` to `scene.json`, then `npx @dcl/sdk-commands deploy --target-content https://worlds-content-server.decentraland.org`; the rest is in **deploy-worlds**.
- A manual `npx skills add` install is not denylisted: all four skills are available there.

## Gotchas

Source references behind these gotchas: [`reference/internals.md`](reference/internals.md) → Gotcha sources.

- **URL and token rotate on every Creator Hub launch.** A config that worked yesterday gives `ECONNREFUSED` or `401` today; the fix is re-copying the snippet from Settings, not retrying.
- **One open project at a time.** The server operates on the scene open in the single editor window. Mutation tools answer `No editor window is open.` when the user is on the scene list.
- **Disk-read tools and `launch_preview` say `No scene is open.` from an external client** even though the scene is visibly open: the project directory is bound to `get_project_info` / `scene_state` / `entity_detail` / `launch_preview` only when the *embedded* assistant starts a turn. Everything routed through the editor (`get_selection`, `get_scene_metrics`, `get_scene_settings`, all mutations, `place_smart_item`) works regardless. So from an external client: prove access with `get_selection` / `get_scene_settings` or one harmless mutation plus the mtime check; read `scene.json` and `assets/scene/main.composite` from disk **read-only** for the roster; mutate through the tools; and for an in-world check launch the preview from the Hub's **Play** button with **Enable MCP Server** ticked and drive it per **unity-explorer-mcp** (its Setup section applies on this path).
- **Read tools trail the engine by one autosave** (~100 ms). The mutation tools already wait it out; only matters if the user is dragging things while you read.
- **`Scene RPC "<tool>" timed out (no renderer response)` is the Hub's 5 s editor-RPC timeout**, not a crash. Seen on `create_entity` while the Bevy editor was in **Play**; the calls succeeded once Play was stopped. Ask the creator to stop Play before a batch of mutations, then retry through the tools.
- **`scene_state` caps at 200 entities.** For big scenes filter by name via `entity_detail` or read the composite from disk.
- **`entity_detail(0)` on a large scene is enormous** (79 KB on a 106-parcel scene, mostly `inspector::Nodes` plus the parcel list), big enough to overflow a tool result. Redirect it to a file and `grep` out only the component you need. Because `set_component` **merges** top-level keys, write back only the key you changed.
- **The Explorer `--mcp` preview checkbox is a different server.** *Enable MCP Server* lives in the **Play Options** popover (the dropdown arrow on the editor header's **Play** button), in the flyout of the **Desktop Client** row. It launches the Explorer with its own MCP on port 8123 (**unity-explorer-mcp**) and is **only shown when the project is on `@dcl/sdk` 7.25.0 or later**. Inside the embedded assistant use `launch_preview` instead; from an external client `launch_preview` fails (see `No scene is open.` above), so there the checkbox *is* the route.
- **One Ctrl+Z = one of your operations, not one component write.** A synchronous change burst commits as a single undo transaction: placing a composite Smart Item or a scripted item with children is one entry. Describe your changes to the user in the units they will undo them in.
- **Scene audio can be muted in the editor, but only under Bevy.** The viewport toolbar's speaker toggle (*Mute scene audio*) plays every `AudioSource` / `AudioStream` at volume 0 and survives a reload; Babylon plays no scene audio at all. "I can't hear the sound you added" is not evidence the component is wrong — check the renderer and the toggle first.
- **`get_scene_metrics` reports nothing useful under the Bevy renderer.** It returns hardcoded zeros for triangles, bodies, materials and textures and an empty out-of-bounds list (`entities` is real, from the Nodes tree). All-zero content metrics mean "Bevy", not "empty scene". Under Babylon they are real, and each entity's bounding mesh is tested against the layout. For a trustworthy budget either way, `launch_preview` and use `explorer_get_scene_content_stats`.
- **Thumbnails: write a custom cover under its own name and point the scene at it with `set_component`.** The Hub overwrites `assets/Images/autogenerated-thumbnail.png` with a viewport capture whenever it auto-generates a thumbnail (when a publish starts and when it refreshes the project card), so a cover saved there is replaced right before upload. `set_scene_settings` has no `thumbnail` key (it is silently dropped). Route: `entity_detail(0)` to read the root entity's scene-metadata component, then `set_component(0, "inspector::SceneMetadata-v5", {thumbnail: "assets/Images/cover.png"})`, taking the exact versioned name from that read (a scene on an older pinned `sdk-commands` is still on `-v4`, and the wrong version adds a component nobody reads). `scene.json`'s `display.navmapThumbnail` follows on the next autosave. The editor's **Scene settings → Thumbnail** field is the equivalent UI route. Spec, safe-area crop check and size cap: **deploy-scene** → Thumbnail image.
- **The image path's casing must match the folder on disk** (`ls assets` first). The Catalyst matches `display.navmapThumbnail` case-sensitively while macOS and Windows resolve either casing, so `assets/images/…` against an `assets/Images/` folder only fails at deploy. The Hub writes to `assets/Images/` by default but keeps an existing folder that differs only in case. Write paths with the casing of the folder that exists, and keep a single folder per case-insensitive name.
- **No `node` / `npx` on PATH is not a dead end.** The Creator Hub ships a complete Node (v22, with `npm` and `npx`): macOS `/Applications/Decentraland Creator Hub.app/Contents/Resources/node-bin/bin/{node,npm,npx}`, Windows `resources\node-bin\node.exe` (plus `npm.cmd` / `npx.cmd`) in the `resources` folder next to the Creator Hub executable, Linux `resources/node-bin/bin/`. Call it by absolute path for `npx tsc --noEmit`, `npx skills add decentraland/sdk-skills --all`, `gltf-transform`, and the like.
- **`asset-packs::Placeholder` `src` needs a resolved file path, not a template variable.** The catalog stores paths as `{assetPath}/model.glb`; setting that string literally via `set_component` produces an invisible or broken gizmo. `place_smart_item` resolves it (e.g. to `assets/asset-packs/spotlight/spotlight.glb`); if you set `Placeholder` by hand, use the real on-disk path.
