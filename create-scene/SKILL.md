---
name: create-scene
description: Scaffold a new Decentraland SDK7 scene project. Creates scene.json, package.json, tsconfig.json, and src/index.ts. Covers scene.json schema (parcels, spawnPoints, permissions, featureToggles), multi-parcel layouts, and project structure. Use when the user wants to start a new scene, create a project, or set up from scratch. Do NOT use for deployment (see deploy-scene or deploy-worlds).
---

# Create a New Decentraland SDK7 Scene

> **Runtime constraint:** Decentraland runs in a QuickJS sandbox. No Node.js APIs (`fs`, `http`, `path`, `process`). Use the SDK's `executeTask()` + `fetch()` for async work. See the **scene-runtime** skill for details.

## ⚠ CRITICAL RULE — Read before generating any code

**NEVER put initial scene entities in `src/index.ts`.**

Every entity that exists when the scene loads — models, primitives, lights, text, audio — MUST be declared in `assets/scene/main.composite`.

`src/index.ts` is ONLY for:

- Adding behavior/interactivity to entities fetched from the composite
- Entities spawned dynamically at runtime (projectiles, enemies, clones, etc.)
- Systems and game logic

If you find yourself writing `engine.addEntity()` for a piece of scenery or a static prop, stop — put it in the composite instead.

When the user wants to create a new scene, follow these steps:

## 1. Ask What They Want to Build

If the user hasn't described their scene, ask them:

- What kind of scene? (gallery, game, social space, interactive art, etc.)
- How many parcels? (default: 1 parcel = 16x16m)
- Any specific features? (3D models, interactivity, UI, multiplayer)

## 2. Scaffold the Project with `/init`

**Always run `/init` first.** This uses the official `@dcl/sdk-commands init` to create scene.json, package.json, tsconfig.json, and src/index.ts with the correct, up-to-date configuration, and installs dependencies automatically.

Never manually create scene.json, package.json, or tsconfig.json — the SDK templates may change between versions and hand-written copies will diverge.

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

## 4. Customize the Generated Files

After `/init` completes, customize the generated files based on what the user wants:

### scene.json

Update the `display` fields and parcels:

- `display.title` — set to the scene name
- `display.description` — set to a short description
- `scene.parcels` — for multi-parcel scenes, list all parcels (e.g., `["0,0", "0,1", "1,0", "1,1"]` for 2x2)
- `scene.base` — set to the southwest corner parcel

### Composite vs TypeScript — where entities go

**NEVER create initial scene entities in TypeScript. They MUST go in `assets/scene/main.composite`.**

| Use `.composite` for                                                         | Use `.ts` (index.ts) for                                                                        |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| All entities present at scene load (models, lights, primitives, text, audio) | Entities spawned dynamically at runtime (e.g., projectiles, clones, NPCs that appear on demand) |
| Static and decorative objects                                                | Entities whose count or existence depends on runtime state                                      |
| Entities that need behavior added later (fetch by name/tag in code)          | Entities whose identity/structure cannot be known at author time                                |
| Anything the Creator Hub should be able to display and edit visually         | —                                                                                               |

**Rationale:** Composite assets load faster, are visually editable in the Creator Hub, and keep TypeScript code focused on logic rather than scene construction.

### assets/scene/main.composite

Create `assets/scene/main.composite` with the initial scene entities. See `{baseDir}/../composites/composite-reference.md` for the full format.

> **Editing an existing scene? Read the "Editing an existing composite (edit mode)" section of the composite reference FIRST.** If the user has opened the scene in the Creator Hub at least once, `main.composite` will contain `inspector::Nodes`, `inspector::SceneMetadata-*`, etc. Adding new entities WITHOUT registering them in `inspector::Nodes` makes them invisible in the Creator Hub entity tree (they render in-world but cannot be selected/edited in the editor). The composite reference spells out exactly which arrays to update.

Example — a box and a 3D model:

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
				},
				"513": {
					"json": {
						"position": { "x": 4, "y": 0, "z": 4 },
						"scale": { "x": 1, "y": 1, "z": 1 },
						"rotation": { "x": 0, "y": 0, "z": 0, "w": 1 },
						"parent": 0
					}
				}
			}
		},
		{
			"name": "core::MeshRenderer",
			"data": {
				"512": { "json": { "mesh": { "$case": "box", "box": {} } } }
			}
		},
		{
			"name": "core::GltfContainer",
			"data": {
				"513": {
					"json": {
						"src": "assets/asset-packs/tree_forest_01/Tree_Forest_01.glb",
						"visibleMeshesCollisionMask": 0,
						"invisibleMeshesCollisionMask": 3
					}
				}
			}
		},
		{
			"name": "core-schema::Name",
			"data": {
				"512": { "json": { "value": "BlueCube" } },
				"513": { "json": { "value": "Tree_1" } }
			}
		}
	]
}
```

> **IMPORTANT**: When placing a floor entity, always set the y position to 0.01 or higher so that it doesn't z-fight with the default ground. Never at a height below 0.

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
	// Fetch entity defined in the composite — never re-create it here
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

	// Fetch all entities tagged "Tree" from the composite
	const trees = engine.getEntitiesByTag('Tree')
	for (const tree of trees) {
		// apply behavior to every tree
	}
}
```

> **When to create entities in TypeScript instead:** Only if the entity is truly dynamic — spawned in response to gameplay events, instanced multiple times at runtime, or its count/identity is not known at scene-authoring time.

### scene.json Reference

All valid `scene.json` fields:

| Field                      | Required    | Description                                                           |
| -------------------------- | ----------- | --------------------------------------------------------------------- |
| `ecs7`                     | Yes         | Must be `true` for SDK7                                               |
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

### Tags

Valid values for the `tags` array:

`"art"`, `"game"`, `"casino"`, `"social"`, `"music"`, `"fashion"`, `"crypto"`, `"education"`, `"shop"`, `"business"`, `"sports"`

### Required Permissions

Add to `requiredPermissions` when your scene uses these features:

| Permission                          | When needed                             |
| ----------------------------------- | --------------------------------------- |
| `ALLOW_TO_MOVE_PLAYER_INSIDE_SCENE` | Teleporting the player within the scene |
| `ALLOW_TO_TRIGGER_AVATAR_EMOTE`     | Playing avatar emotes                   |
| `ALLOW_MEDIA_HOSTNAMES`             | Loading external video/audio streams    |
| `USE_WEB3_API`                      | Blockchain interactions                 |
| `USE_FETCH`                         | HTTP requests to external servers       |
| `USE_WEBSOCKET`                     | WebSocket connections                   |
| `OPEN_EXTERNAL_LINK`                | Opening URLs in the user's browser      |

When using `ALLOW_MEDIA_HOSTNAMES`, also whitelist the domains:

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

**Boundaries per parcel:** 16m x 16m x 20m height. A 2x2 scene spans 32m x 32m.

**Changing parcels in an existing scene:** Modifying `scene.parcels` shifts the coordinate bounds for the entire scene — entities near the current boundary may end up outside (invisible) after the change. Before editing this field, describe the proposed change and confirm with the user first. See `agent-behaviors.md` in `overview/`.

## 5. Post-Creation Steps

After customizing the files:

1. Use the `preview` tool to start the preview server (or run `npx @dcl/sdk-commands start --bevy-web` manually)
2. The scene will open in a browser at http://localhost:8000

## Cross-References

- Ready to deploy? See the **deploy-scene** skill (Genesis City) or **deploy-worlds** skill (personal Worlds)
- Need to optimize for parcel limits? See the **optimize-scene** skill
- Planning a game? See the **game-design** skill for design patterns and performance budgets
- Validate entity component combinations: see `{baseDir}/references/entity-validation-rules.md` for rules on which components require each other, mutual exclusions, and common misconfigurations

## Important Notes

- **Always validate entity positions against parcel bounds.** Each parcel is 16×16m. With the default base parcel at the lower-left corner, valid range is `0 ≤ x ≤ 16*parcelsWide` and `0 ≤ z ≤ 16*parcelsDeep`. **Any negative X or Z coordinate is outside the scene — entities there are not rendered and no error is shown.**
- Center of a single-parcel scene is (8, 0, 8) at ground level
- Y axis is up, minimum Y=0 (ground)
- The `main` field in scene.json MUST be `"bin/index.js"` — this is the compiled output path
- The `jsx` and `jsxImportSource` tsconfig settings are already included by `/init` — do not modify them
