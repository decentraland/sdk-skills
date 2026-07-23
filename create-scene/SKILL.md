---
name: create-scene
description: Scaffold a new Decentraland SDK7 scene project. Use when the user wants to start a new scene or create a project. Do NOT use for deployment (see deploy-scene or deploy-worlds).
---

# Create a New Decentraland SDK7 Scene

> **Runtime constraint:** Decentraland runs in a QuickJS sandbox. No Node.js APIs (`fs`, `http`, `path`, `process`). Use the SDK's `executeTask()` + `fetch()` for async work. See the **scene-runtime** skill for details.

> **CRITICAL — read before generating any code:** All initial scene entities (everything present at scene load) go in `assets/scene/main.composite`, NEVER in `src/index.ts`. See "Composite vs TypeScript — where entities go" (Step 4) for the rule, decision table, and rationale.

When the user wants to create a new scene, follow these steps:

## 1. Ask What They Want to Build

If the user hasn't described their scene, ask them:

- What kind of scene? (gallery, game, social space, interactive art, etc.)
- How many parcels? (default: 1 parcel = 16x16m)
- Any specific features? (3D models, interactivity, UI, multiplayer)

## 2. Scaffold the Project with `/init`

**Always run `/init` first.** This uses the official `@dcl/sdk-commands init` to create scene.json, package.json, tsconfig.json, and src/index.ts with the correct, up-to-date configuration, and installs dependencies automatically.

Never manually create scene.json, package.json, or tsconfig.json — the SDK templates may change between versions and hand-written copies will diverge.

The `jsx` and `jsxImportSource` tsconfig settings are already included by `/init` — do not modify them.

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

> **Existing folders take precedence.** If the scene already has `assets/scene/Models/` (legacy layout) or assets under `assets/asset-packs/` / `assets/custom/` (added via the Creator Hub), reuse those paths instead of creating a parallel `assets/Models/`. Same rule applies for `assets/Audio/`, `assets/Images/`, and `assets/Videos/`.

**Done when:** every model the user approved exists in `assets/Models/` (or the pre-existing asset folder per the precedence rule above), each file is non-empty and begins with the `glTF` magic bytes (`head -c 4 file.glb`) — a curl that saved an HTML error page fails this check — and no downloaded file sits at the project root. If the user declined new models, this step is done with nothing downloaded.

## 4. Customize the Generated Files

After `/init` completes, customize the generated files based on what the user wants:

### scene.json

Update the `display` fields and parcels:

- `display.title` — set to the scene name
- `display.description` — set to a short description
- `scene.parcels` — for multi-parcel scenes, list all parcels (e.g., `["0,0", "0,1", "1,0", "1,1"]` for 2x2)
- `scene.base` — set to the southwest corner parcel

### Composite vs TypeScript — where entities go

**NEVER create initial scene entities in TypeScript. They MUST go in `assets/scene/main.composite`.** If you find yourself writing `engine.addEntity()` for a piece of scenery or a static prop, stop — put it in the composite instead.

| Use `.composite` for                                                         | Use `.ts` (index.ts) for                                                                        |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| All entities present at scene load (models, lights, primitives, text, audio) | Entities spawned dynamically at runtime (e.g., projectiles, clones, NPCs that appear on demand) |
| Static and decorative objects                                                | Entities whose count or existence depends on runtime state                                      |
| Entities that need behavior added later (fetch by name/tag in code)          | Entities whose identity/structure cannot be known at author time                                |
| Anything the Creator Hub should be able to display and edit visually         | —                                                                                               |

**Rationale:** Composite assets load faster, are visually editable in the Creator Hub, and keep TypeScript code focused on logic rather than scene construction.

### assets/scene/main.composite

Create `assets/scene/main.composite` with the initial scene entities. See `{baseDir}/../composites/composite-reference.md` for the full format.

> **Editing an existing scene? Read the "Editing an existing composite (edit mode)" section of the composite reference FIRST.** If the scene has been opened in the Creator Hub, `main.composite` already contains `inspector::*` components; adding new entities without registering them in `inspector::Nodes` leaves them rendering in-world but invisible and un-selectable in the Creator Hub entity tree. The reference spells out the exact procedure.

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
- Y axis is up; ground level is Y=0. Floors and walkable surfaces belong at Y ≥ 0 because players cannot descend below ground, but entities *can* be placed at negative Y — positioning objects underground is a legitimate technique for hiding them.

### src/index.ts

Use `index.ts` **only** for:

- Behavior and interactivity on composite entities (fetch them by name or tag)
- Dynamically spawned entities (e.g., enemies, projectiles, clones)
- Systems, game logic, UI

To add interactivity to a composite entity, look it up by name or tag — do NOT re-create it in code:

```typescript
import { engine, pointerEventsSystem, InputAction } from '@dcl/sdk/ecs'
import { EntityNames } from '../assets/scene/entity-names'

export function main() {
	// Fetch an entity defined in the composite — never re-create it here
	const cube = engine.getEntityOrNullByName(EntityNames.BlueCube)
	if (cube) {
		pointerEventsSystem.onPointerDown(
			{
				entity: cube,
				opts: { button: InputAction.IA_PRIMARY, hoverText: 'Click me' },
			},
			() => {
				console.log('Cube clicked!')
			}
		)
	}
}
```

To fetch groups of entities by tag (`engine.getEntitiesByTag`) or add/remove tags at runtime, see the "Referencing Composite Entities from Code" section of `{baseDir}/../composites/composite-reference.md`.

### scene.json Reference

All valid `scene.json` fields:

| Field                      | Required    | Description                                                           |
| -------------------------- | ----------- | --------------------------------------------------------------------- |
| `ecs7`                     | Conventional | `true` in SDK7 scenes. Written by `init`; the build only validates `runtimeVersion`, but keep it for tooling compatibility |
| `runtimeVersion`           | Yes         | Must be `"7"`                                                         |
| `main`                     | Yes         | Must be `"bin/index.js"` — the compiled output path                   |
| `display.title`            | Recommended | Scene name shown in the map and Places                                |
| `display.description`      | Recommended | Short description for discovery                                       |
| `display.navmapThumbnail`  | Optional    | Image path for the Genesis City minimap                               |
| `scene.parcels`            | Yes         | Array of `"x,y"` coordinate strings                                   |
| `scene.base`               | Yes         | The origin parcel (usually southwest corner)                          |
| `spawnPoints`              | Optional    | Where players appear when entering (see below)                        |
| `requiredPermissions`      | Optional    | Array of permissions (e.g., `"ALLOW_MEDIA_HOSTNAMES"`)                |
| `allowedMediaHostnames`    | Optional    | Whitelisted domains for external media                                |
| `featureToggles`           | Optional    | Enable/disable SDK features                                           |
| `worldConfiguration`       | Optional    | For Worlds deployment (see **deploy-worlds** skill)                   |
| `landscapeTerrain`         | Optional    | Boolean, default `true`. Root-level field. **Worlds only** (single-scene Worlds; ignored in Genesis City). Set `false` to disable the auto-generated grassland/trees/sea landscape around the scene — for open-water/space settings and to free rendering budget. Also applies in local preview. In the Creator Hub, it is a toggle in the Scene Inspector settings (and a preview menu option); a scene-level `false` overrides the preview preference. |

### Tags

Valid values for the `tags` array:

`"art"`, `"game"`, `"casino"`, `"social"`, `"music"`, `"fashion"`, `"crypto"`, `"education"`, `"shop"`, `"business"`, `"sports"`, `"parkour"`

### Required Permissions

Add to `requiredPermissions` when your scene uses these features:

These are the exact 7 permission strings the runtime recognizes (the protocol enum names drop the `PI_` prefix):

| Permission                          | When needed                                          |
| ----------------------------------- | ---------------------------------------------------- |
| `ALLOW_TO_MOVE_PLAYER_INSIDE_SCENE` | `movePlayerTo` (move player within the scene)        |
| `ALLOW_TO_TRIGGER_AVATAR_EMOTE`     | `triggerEmote` and `triggerSceneEmote`               |
| `ALLOW_MEDIA_HOSTNAMES` `[LEGACY]`  | External video/audio streams — **not required** (see below) |
| `USE_WEB3_API`                      | Blockchain interactions                              |
| `USE_FETCH`                         | HTTP requests (`fetch` / `signedFetch`)              |
| `USE_WEBSOCKET`                     | WebSocket connections                                |
| `OPEN_EXTERNAL_LINK`                | `openExternalUrl` (open URLs in the browser)         |

> **Grounded caveat (from the engine test scenes):** enforcement is uneven, so declare the correct permission for *intent* rather than relying on it being blocked. The `80,-4-restricted-actions` scene declares only `ALLOW_TO_MOVE_PLAYER_INSIDE_SCENE` + `ALLOW_TO_TRIGGER_AVATAR_EMOTE`, yet successfully runs `openExternalUrl`, `openNftDialog`, `teleportTo`, and `changeRealm` without `OPEN_EXTERNAL_LINK`. The `66,6-signed-fetch` scene calls `signedFetch` with an empty `requiredPermissions`. `movePlayerTo` and emotes are the two whose permissions the engine team consistently declares. `teleportTo` (jump to other Genesis City coords) needs no permission.

`[LEGACY]` `ALLOW_MEDIA_HOSTNAMES` and `allowedMediaHostnames` are **not required** — do not add them for new scenes. The permission string still exists in `@dcl/schemas`, but no current client enforces it: unity-explorer gates the hostname check behind the `CHECK_ALLOWED_MEDIA_HOSTNAMES` compile define, which is set in no build config (`SceneData.TryGetMediaUrl` falls through to a plain URL syntax check), and bevy-explorer has no enforcement at all. Only the retired web client enforced it. Current clients play external media without it. If a legacy scene still declares it, whitelist the domains as follows:

```json
"requiredPermissions": ["ALLOW_MEDIA_HOSTNAMES"],
"allowedMediaHostnames": ["youtube.com", "www.youtube.com", "player.vimeo.com", "twitch.tv"]
```

### Feature Toggles

```json
"featureToggles": {
  "voiceChat": "enabled",
  "portableExperiences": "enabled"
}
```

Valid values: `"enabled"`, `"disabled"`. For `portableExperiences` also: `"hideUi"`.

### Spawn Points

Configure where and how players enter the scene:

```json
{
	"spawnPoints": [
		{
			"name": "spawn1",
			"default": true,
			"position": { "x": [1, 5], "y": [0, 0], "z": [2, 4] },
			"cameraTarget": { "x": 8, "y": 1, "z": 8 }
		}
	]
}
```

- Position ranges (e.g., `[1, 5]`) spawn players randomly within the range
- `cameraTarget` orients the player's camera on spawn — point it at the scene's focal area
- Fixed spawn: use single values instead of ranges (e.g., `"x": 8`)

### Multi-Parcel Layouts

| Layout         | Parcels Array                     | Use Case                                        |
| -------------- | --------------------------------- | ----------------------------------------------- |
| **Single**     | `["0,0"]`                         | Small games, galleries, single-room experiences |
| **Strip**      | `["0,0", "1,0", "2,0"]`           | Hallways, racing tracks, linear journeys        |
| **L-Shape**    | `["0,0", "1,0", "0,1"]`           | Corner buildings, split experiences             |
| **2x2 Square** | `["0,0", "1,0", "0,1", "1,1"]`    | Open plazas, arenas, medium games               |
| **3x3 Square** | 9 parcels from `"0,0"` to `"2,2"` | Large games, multi-room buildings               |

**Base parcel:** Always set `scene.base` to the southwest (lowest x,y) corner parcel.

**Boundaries:** each parcel is 16m x 16m; a 2x2 scene spans 32m x 32m. The height limit applies to the whole scene and grows with parcel count: `log2(n+1) × 20` meters (1 parcel = 20m, 2x2 = ~46m, 3x3 = ~66m).

- **Always validate entity positions against parcel bounds.** With the default base parcel at the lower-left corner, valid range is `0 ≤ x ≤ 16*parcelsWide` and `0 ≤ z ≤ 16*parcelsDeep`. **Any negative X or Z coordinate is outside the scene.** An entity entirely outside the bounds is not rendered and no error is shown; a model that straddles the boundary still renders the part that is inside. The bound check uses **world** positions, so a child whose parent is moved out of bounds disappears with it, and exceeding the height limit hides the entity too. Multi-parcel scenes are only rectangular if you list every parcel; an L-shaped parcel set has "holes" that are out of bounds. (See the `5,90-scene-bounds-check` example scene.)

**Changing parcels in an existing scene:** Modifying `scene.parcels` shifts the coordinate bounds for the entire scene — entities near the current boundary may end up outside (invisible) after the change. Before editing this field, describe the proposed change and confirm with the user first. See the "Agent Behavioral Guidelines" section in the `sdk-scenes` skill (`{baseDir}/../sdk-scenes/SKILL.md`).

**Done when:** (1) `main.composite` parses as JSON and every entity ID that appears in any component's `data` map has a `core::Transform` and a `core-schema::Name` entry; (2) every composite position lies within parcel bounds (`0 ≤ x ≤ 16·width`, `0 ≤ z ≤ 16·depth`) — an entity placed entirely outside is silently hidden, and a model straddling the boundary renders only the part inside; (3) `src/index.ts` contains no `engine.addEntity()` for load-time scenery — grep for `engine.addEntity` and confirm every hit is a runtime spawn; (4) `scene.json` has `"runtimeVersion": "7"` and `scene.base` is a member of `scene.parcels`; (5) `npm run build` exits 0.

## 5. Post-Creation Steps

After customizing the files:

1. Use the `preview` tool to start the preview server (or run `npx @dcl/sdk-commands start --bevy-web` manually)
2. The scene will open in a browser at http://localhost:8000

**Keep `.dclignore` (project root) up to date.** It lists files and extensions that are NOT uploaded on deploy. Whenever the project contains working files — Blender/FBX sources, draft models, concept art, spreadsheets, markdown notes — add them (or their extensions) to `.dclignore` proactively so the deployed scene stays light. See the `.dclignore` section in the **deploy-scene** skill.

**Done when:** the preview server responds at `http://localhost:8000` and the scene renders with no errors in the console.

## Cross-References

- Ready to deploy? See the **deploy-scene** skill (Genesis City) or **deploy-worlds** skill (personal Worlds)
- Need to optimize for parcel limits? See the **optimize-scene** skill
- Planning a game? See the **game-design** skill for design patterns and performance budgets
- Validate entity component combinations: see `{baseDir}/references/entity-validation-rules.md` for rules on which components require each other, mutual exclusions, and common misconfigurations

## Example scenes

Engine-team test scenes illustrating `scene.json` configuration:

- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/5,90-scene-bounds-check — multi-parcel, non-rectangular parcel layout (`["5,90","5,89","6,89","6,88"]`); moves many entity types across the parcel/height boundary to show what the engine hides out of bounds.
- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/80,-4-restricted-actions — `requiredPermissions` for `movePlayerTo` + emotes.
- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/8,8-portable-experience — `featureToggles.portableExperiences: "enabled"` (see also the `disabled` and `hideUi` sibling scenes).
