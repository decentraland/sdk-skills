---
name: create-scene
description: Scaffold a new Decentraland SDK7 scene project, or edit an existing scene's scene.json (parcels, spawn points, permissions, tags, feature toggles). Use when the user wants to start a new scene or project, or change scene settings in scene.json. For publishing see deploy-scene or deploy-worlds.
---

# Create a New Decentraland SDK7 Scene

> **Runtime constraint:** Decentraland runs in a QuickJS sandbox. No Node.js APIs (`fs`, `http`, `path`, `process`). Use the SDK's `executeTask()` + `fetch()` for async work. See the **scene-runtime** skill for details.

When the user wants to create a new scene, follow these steps:

## 1. Ask What They Want to Build

If the user hasn't described their scene, ask them:

- What kind of scene? (gallery, game, social space, interactive art, etc.)
- How many parcels? (default: 1 parcel = 16x16m)
- Any specific features? (3D models, interactivity, UI, multiplayer)

Do not plan a login, nickname prompt, chat, friends list, emote menu, avatar editor or loading screen by default: the Explorer provides all of them (**game-design** → *The platform already provides this*).

## 2. Scaffold the Project

Run `npx @dcl/sdk-commands init` in the empty project folder. It writes scene.json, package.json, tsconfig.json and src/index.ts from the current official template and installs dependencies (`--skip-install` skips that; `--yes` overrides the empty-folder check).

Generate scene.json, package.json and tsconfig.json with `init`, not by hand: the SDK templates change between versions and hand-written copies diverge. The template's tsconfig already carries the `jsx` / `jsxImportSource` settings; keep them as generated.

## 3. Find Matching 3D Assets

IMPORTANT: Only fetch models from the free catalogs below if the prompt explicitly asks to add new models. Confirm with the user always if they wish to add new models to their scene.

Before writing scene code, check the asset catalog for free models that match the user's theme:

1. Search `{baseDir}/../add-3d-models/references/model-catalog.md` (8,800+ models with descriptions, dimensions, animations, and download URLs)
2. Read `{baseDir}/../audio-video/references/audio-catalog.md` (50 free sounds — music, ambient, SFX, game mechanics, etc.)
3. Suggest matching models and sounds to the user
4. Download selected models into the scene's `assets/Models/` directory:
   ```bash
   mkdir -p assets/Models
   curl -o assets/Models/arcade_machine.glb "https://models.dclregenesislabs.xyz/blobs/bafybei..."
   ```

> **Important**: `GltfContainer` only works with local files. Never use external URLs for the model `src` field.

> **Important**: Always download into `assets/Models/`. Never write to the scene root.

> **Existing folders take precedence.** If the scene already has `assets/scene/Models/` (legacy layout) or assets under `assets/asset-packs/` (Creator Hub asset packs) / `assets/custom/` (Creator Hub custom items), reuse those paths instead of creating a parallel `assets/Models/`. Same rule applies for `assets/Audio/`, `assets/Images/`, and `assets/Videos/`.

**Done when:** every model the user approved exists in `assets/Models/` (or the pre-existing asset folder per the precedence rule above), each file is non-empty and begins with the `glTF` magic bytes (`head -c 4 file.glb`) — a curl that saved an HTML error page fails this check — and no downloaded file sits at the project root. If the user declined new models, this step is done with nothing downloaded.

## 4. Customize the Generated Files

After `init` completes, customize the generated files based on what the user wants:

### scene.json

Update the `display` fields and parcels:

- `display.title` — set to the scene name
- `display.description` — set to a short description
- `tags` — root-level array, 1-3 categories from the predefined list (`{baseDir}/references/scene-json.md` → Tags (scene categories)). **Always set this**, even if the user never mentions categories: infer them from the scene's theme and purpose (shooting gallery → `["game"]`, art installation → `["art"]`, dance club → `["music", "social"]`). These drive discovery in the Places dApp; a scene with no tags is uncategorized there
- `scene.parcels` — for multi-parcel scenes, list all parcels (e.g., `["0,0", "0,1", "1,0", "1,1"]` for 2x2)
- `scene.base` — set to the southwest corner parcel

Every other field (spawn points, permissions, feature toggles, `landscapeTerrain`, `worldConfiguration`), the category list for `tags`, parcel layouts and bounds: `{baseDir}/references/scene-json.md`.

### Composite vs TypeScript — where entities go

Every entity present at scene load goes in `assets/scene/main.composite`; `src/index.ts` holds only behavior, runtime-spawned entities, systems and UI. The rule, its decision table and rationale: **sdk-scenes** → *CRITICAL RULE — Composite-first scene authoring*.

### assets/scene/main.composite

Create `assets/scene/main.composite` with the initial scene entities. See `{baseDir}/../composites/composite-reference.md` for the full format.

> **Editing an existing scene?** Follow **sdk-scenes** → *CRITICAL RULE — Editing an existing composite* before touching the file (Creator Hub MCP first; edit-mode `inspector::Nodes` registration otherwise).

Minimal example — a single named box. Components share entity IDs across their `data` maps, so all of entity `512`'s data lives under the `"512"` key:

```json
{
	"version": 1,
	"components": [
		{
			"name": "core::Transform",
			"data": {
				"512": {
					"json": {
						"position": { "x": 8, "y": 1, "z": 8 },
						"scale": { "x": 1, "y": 1, "z": 1 },
						"rotation": { "x": 0, "y": 0, "z": 0, "w": 1 },
						"parent": 0
					}
				}
			}
		},
		{
			"name": "core::MeshRenderer",
			"data": { "512": { "json": { "mesh": { "$case": "box", "box": {} } } } }
		},
		{
			"name": "core-schema::Name",
			"data": { "512": { "json": { "value": "BlueCube" } } }
		}
	]
}
```

For multi-entity scenes, GLB models with collision masks, tags, and the full component-grouping pattern, see `{baseDir}/../composites/composite-reference.md`.

> **IMPORTANT**: When placing a floor entity, always set the y position to 0.01 or higher so that it doesn't z-fight with the default ground.

- Center of a single-parcel scene is (8, 0, 8) at ground level.
- Y axis is up; ground level is Y=0. Floors and walkable surfaces belong at Y ≥ 0 because players cannot descend below ground, but entities _can_ be placed at negative Y — positioning objects underground is a legitimate technique for hiding them.

### src/index.ts

Use `index.ts` for behavior on composite entities, dynamically spawned entities (enemies, projectiles, clones), systems, game logic and UI. Composite entities are fetched by name (`engine.getEntityOrNullByName(EntityNames.BlueCube)`) or tag inside `main()`, never re-created: `{baseDir}/../composites/composite-reference.md` → Referencing Composite Entities from Code.

**Done when:** (1) `main.composite` parses as JSON and every entity ID that appears in any component's `data` map has a `core::Transform` and a `core-schema::Name` entry; (2) every composite position lies within parcel bounds (`0 ≤ x ≤ 16·width`, `0 ≤ z ≤ 16·depth`) — an entity placed entirely outside is silently hidden, and a model straddling the boundary renders only the part inside; (3) `src/index.ts` contains no `engine.addEntity()` for load-time scenery — grep for `engine.addEntity` and confirm every hit is a runtime spawn; (4) `scene.json` has `"runtimeVersion": "7"` and `scene.base` is a member of `scene.parcels`; (5) `npm run build` exits 0.

## 5. Post-Creation Steps

After customizing the files:

1. Run `npx @dcl/sdk-commands start`. It serves the scene at http://localhost:8000 and opens it in the Desktop Explorer; add `--web` to open it in the Bevy Web browser client instead.

### Preview CLI flags

| Flag                         | Type        | Description                                                                                                                                                                                                                                                                                       |
| ---------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--web` (alias `--bevy-web`) | boolean     | Open the preview in the Bevy Web browser client at `decentraland.org/bevy-web/` instead of the Desktop Explorer. Chromium 142+ requires Local Network Access permission for the page to reach the localhost preview server -- when the browser asks to access apps on your device, click "Allow". |
| `--mcp`                      | boolean     | Enable the MCP server in the Explorer (forwarded as a deep-link parameter)                                                                                                                                                                                                                        |
| `--mcp-port`                 | number      | Port for the MCP server in the Explorer                                                                                                                                                                                                                                                           |
| `--multi-instance`           | boolean     | Allow running multiple Explorer instances simultaneously                                                                                                                                                                                                                                          |
| `--no-client`                | boolean     | Suppress auto-launch (desktop deeplink, browser, mobile QR); the file watcher still notifies a desktop Explorer if it connects on its own                                                                                                                                                         |
| `--asset-bundles`            | boolean     | Convert the scene's 3D models to optimized asset bundles locally in the Desktop Explorer, matching production rendering after asset-bundle conversion. First run may take several minutes on large scenes; converted models are cached. Forwarded into the deep link as `local-ab=true` -- `--local-ab` is the deep-link param, **not** a CLI flag. See **optimize-scene** ("Local Asset Bundle Preview").    |
| `-- <args>`                  | passthrough | Arguments after a standalone `--` are forwarded verbatim into the Explorer deep link as query params (`--key=value`, `--key value`, bare `--key` = true)                                                                                                                                          |

`--web3` and `--no-debug` (alias `-d`) are no-ops; leave them out.

**Creator Hub play settings** (equivalent to the CLI flags above). The editor header's split button is labelled **Play** (play icon + "Play"); its dropdown arrow opens the **Play Options** popover:

The popover lists two client rows, picked with a radio:

- **Desktop Client** (default) -- the Unity Desktop Explorer. Hovering this row opens a side flyout with the desktop-only toggles below.
- **Web (Bevy)** -- the Bevy web client; equivalent to `--web`. No toggles of its own.

Desktop Client flyout toggles:

- **Enable Landscape Terrains**: shows the surrounding landscape. Disabled (and forced off) when the scene's own `landscapeTerrain: false` hides it.
- **Multi-Instance Preview**: equivalent to `--multi-instance`. Lets a second Explorer window run alongside the first. Only shown when the project is on **`@dcl/sdk` 7.20.4 or later**.
- **Enable MCP Server**: launches with the MCP automation server -- equivalent to `--mcp`. Only shown when the project is on **`@dcl/sdk` 7.25.0 or later**. See the **unity-explorer-mcp** skill.
- **Compress Assets**: previews with assets compressed the way they are in production -- equivalent to `--asset-bundles`. First run may be slow; results are cached. Hidden on Linux (no Unity desktop client ships there) and for scenes whose `@dcl/sdk-commands` predates 7.26.0 (update the SDK to get it).

Below a divider, **Show QR Code for Mobile** is a button (not a checkbox) that opens the mobile preview QR.

The debug console is on by default, with no checkbox in the popover. **Skip Auth Screen** is not in the popover either; it stays on unless `--multi-instance` forces a per-window login.

**Bevy renderer in Creator Hub:** Settings > "Scene renderer" dropdown — **"Babylon (default)"** / **"Bevy (experimental)"**; the toggle reads **"Enable Bevy Scene Renderer"**. It lives in **Settings > Experimental**, which contains only this toggle (the AI Assistant has its own Settings > AI tab; the UI Editor has no setting). The Bevy editor supports gizmos, multi-select, free-fly camera, spawn point visualization, drag-drop assets, animation clip dropdown, lock/hide entities, screenshots, and hot-reload. It also loads **custom items** and shows **hover hints** (the entity's `PointerEvents` `hoverText`, e.g. "Press E") in the viewport.

Bevy editor limitations to know before recommending it:

- **The Metrics tab is disabled** ("Scene metrics are only available with the Babylon renderer"). Run the scene preview to view the metrics.
- **`editor_screenshot` (Creator Hub MCP) errors under Bevy.**
- **Opening the UI Editor's 2D mode freezes the scene** (see **build-ui**).

**Keep `.dclignore` (project root) up to date.** It lists files and extensions that are NOT uploaded on deploy. Whenever the project contains working files — Blender/FBX sources, draft models, concept art, spreadsheets, markdown notes — add them (or their extensions) to `.dclignore` proactively so the deployed scene stays light. See the `.dclignore` section in the **deploy-scene** skill.

**Done when:** the preview server responds at `http://localhost:8000` and the scene renders with no errors in the console.

## Vibe Coding with AI

AI assistants (Cursor, Claude Code, etc.) can build entire scenes from plain-language prompts. Install Decentraland SDK skills first so the AI knows SDK patterns:

```bash
npx skills add decentraland/sdk-skills --all
```

To update existing skills and download any new ones added since the last install, re-run the same command. Do NOT use `npx skills update` -- it only refreshes skills already on disk, silently skipping new ones.

The Creator Hub also has a built-in **AI Assistant** (Settings > AI > _Enable AI Assistant_) that drives the user's own installed `claude`, `codex`, `cursor-agent` or `gemini` CLI with these skills pre-loaded and the editor's MCP server pre-wired, so it edits entities live in the open scene. It is **on by default**, and all four providers get the scene tools. The same MCP server can be exposed to an external tool (Claude Code, Cursor, Codex, Claude Desktop) from Settings > AI > _Expose AI assistant MCP server_. See the **creator-hub-mcp** skill.

The official quickstart teaches a **Script-component-first** workflow: attach a Script component to an entity in the Creator Hub, write a class with `constructor(src, entity)`, `start()`, and `update(dt)`, and use `this.entity` to reference the holder entity. This keeps behavior self-contained and reusable across entities. See the **script-components** skill for full details.

## Cross-References

- Ready to deploy? See the **deploy-scene** skill (Genesis City) or **deploy-worlds** skill (personal Worlds). Publishing to a World? A World has its **own** name/description/thumbnail separate from `scene.json` — in a single-scene World every publish overwrites the World's with the scene's; see **deploy-worlds** > "World metadata vs scene metadata". Publish at least **one hour** before a live event — asset bundle conversion itself usually takes seconds, but the margin covers anything unexpected
- Need to optimize for parcel limits? See the **optimize-scene** skill. Enable **Compress Assets** (Play Options > Desktop Client) or `--asset-bundles` to preview with production-quality asset bundles before publishing
- Targeting mobile? Check two things before writing code, since both shape the architecture: the flat mobile scene limits (**optimize-scene** → *Mobile Scene Limits*), and the feature gaps that rule out common mechanics such as `TweenSequence` platforms, Draco GLBs and invisible-collider fences (`{baseDir}/../sdk-scenes/references/mobile-parity.md`).
- Planning a game? See the **game-design** skill for design patterns and performance budgets
- Validate entity component combinations: see `{baseDir}/references/entity-validation-rules.md` for rules on which components require each other, mutual exclusions, and common misconfigurations

## Example scenes

Engine-team test scenes illustrating `scene.json` configuration:

- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/5,90-scene-bounds-check — multi-parcel, non-rectangular parcel layout (`["5,90","5,89","6,89","6,88"]`); moves many entity types across the parcel/height boundary to show what the engine hides out of bounds.
- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/80,-4-restricted-actions — `requiredPermissions` for `movePlayerTo` + emotes.
- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/8,8-portable-experience — `featureToggles.portableExperiences: "enabled"` (see also the `disabled` and `hideUi` sibling scenes).
