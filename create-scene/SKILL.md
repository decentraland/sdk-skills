---
name: create-scene
description: Scaffold a new Decentraland SDK7 scene project, edit an existing scene's scene.json (parcels, spawn points, permissions, tags, feature toggles, skybox time), or pick preview options (start flags, Creator Hub Play Options). For publishing see deploy-scene or deploy-worlds.
---

# Create a New Decentraland SDK7 Scene

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

If the user wants new models or sounds, search the free catalogs and suggest matches; download only after they confirm:

1. Grep `{baseDir}/../add-3d-models/references/model-catalog.md` (never read it whole; 8,800+ models with descriptions, dimensions, animations, and download URLs)
2. Read `{baseDir}/../audio-video/references/audio-catalog.md` (50 free sounds — music, ambient, SFX, game mechanics, etc.)
3. Suggest matching models and sounds to the user
4. Once confirmed, download the selected models into the scene's `assets/Models/` directory:
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

Preview flags (`--web`, `--mcp`, `--multi-instance`, `--asset-bundles`, deep-link passthrough), the Creator Hub **Play Options** equivalents and the Bevy editor renderer: `{baseDir}/references/preview-options.md`. Two clients for multiplayer testing: **multiplayer-sync** → *Multiplayer Testing*.

**Keep `.dclignore` (project root) up to date.** It lists files and extensions that are NOT uploaded on deploy. Whenever the project contains working files — Blender/FBX sources, draft models, concept art, spreadsheets, markdown notes — add them (or their extensions) to `.dclignore` proactively so the deployed scene stays light. See the `.dclignore` section in the **deploy-scene** skill.

**Done when:** the preview server responds at `http://localhost:8000` and the scene renders with no errors in the console.

## Cross-References

- Publishing: **deploy-scene** (Genesis City) or **deploy-worlds** (Worlds; a World has its own metadata separate from `scene.json`). Publish timing before live events: **deploy-scene**.
- Parcel limits and production-quality local preview (`--asset-bundles`): **optimize-scene**.
- Targeting mobile: flat mobile limits in **optimize-scene** → *Mobile Scene Limits*; feature gaps that rule out common mechanics in `{baseDir}/../sdk-scenes/references/mobile-parity.md`. Check both before writing code.
- Planning a game: **game-design**.
- Scenes edited in the Creator Hub: prefer the Script-component-first workflow (a Script component on the entity with `start()` / `update(dt)`) over free-standing systems: **script-components**.
- Component combinations that require or exclude each other: `{baseDir}/references/entity-validation-rules.md`.

## Example scenes

Engine-team test scenes illustrating `scene.json` configuration:

- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/5,90-scene-bounds-check — multi-parcel, non-rectangular parcel layout (`["5,90","5,89","6,89","6,88"]`); moves many entity types across the parcel/height boundary to show what the engine hides out of bounds.
- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/80,-4-restricted-actions — `requiredPermissions` for `movePlayerTo` + emotes.
- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/8,8-portable-experience — `featureToggles.portableExperiences: "enabled"` (see also the `disabled` and `hideUi` sibling scenes).
