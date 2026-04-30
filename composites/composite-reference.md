# Composite Format Reference

This document defines the `main.composite` JSON declarative format that defines all of the entities that are loaded as the initial state of the scene.

It's best to load heavy assets through the composite, as they load faster. Assets in the composite can also be easily visually adjusted by the user through the Creator Hub.

This file must exist at `assets/scene/main.composite`.

## Structure

```json
{
  "version": 1,
  "components": [
    {
      "name": "namespace::ComponentName",
      "data": {
        "<entity-id>": {
          "json": { ... component data ... }
        }
      }
    }
  ]
}
```

## Authoring-from-scratch vs editing-an-existing-composite

The rules in this document have **two modes** that you must distinguish before touching a composite. Read this section first — applying the wrong mode causes invisible-in-editor entities or SDK build failures.

| Mode | Trigger | Inspector/auto components |
| ---- | ------- | ------------------------- |
| **Authoring from scratch** | The composite does not exist yet, or it exists but contains NO `inspector::*` / `composite::root` / `asset-packs::ActionTypes` components | These components must be **absent**. The Creator Hub will generate them on first save. |
| **Editing an existing composite** | The composite already contains `inspector::Nodes`, `inspector::SceneMetadata-v4`, `composite::root`, etc. (i.e. the user has opened and saved the scene in the Creator Hub at least once) | These components are **already present and must be kept in sync**. Do NOT delete them. When you add new entities, you MUST also register them in `inspector::Nodes` (and in `inspector::SceneMetadata-*` only if the layout/parcels change). |

**How to detect the mode:** before editing, scan the composite for any component whose name starts with `inspector::` or equals `composite::root`. If any are present, you are in **edit mode** — go to the section "Editing an existing composite (edit mode)" below.

## DO NOT Include — applies ONLY to authoring-from-scratch mode

When **authoring a new composite from scratch**, these components are auto-generated and must **NEVER** be added by hand. Including any of them in a fresh composite will break the scene in the Creator Hub and/or cause SDK build failures:

- **`inspector::Nodes`** — the Inspector creates this automatically from the Transform parent hierarchy. Including it in a fresh composite **overrides the auto-generated entity tree** — if the included Nodes data is incomplete or has empty `children` arrays, the Creator Hub entity panel will show a broken/empty tree. Also causes SDK build error: `"inspector::Nodes is not defined and there is no schema to define it"`
- **`inspector::SceneMetadata`** (any version, e.g. `inspector::SceneMetadata-v3`, `inspector::SceneMetadata-v4`) — the Inspector creates this from `scene.json`. Same build error if included. **Never use versioned names** like `-v3` when authoring from scratch; the engine uses base names only.
- **`inspector::Selection`**, **`inspector::UIState`** — editor-only, stripped during save
- **`inspector::TransformConfig`** — editor-only proportional-scaling hint, stripped during save
- **`composite::root`** — auto-generated, never include manually
- **`asset-packs::ActionTypes`** — auto-generated from the engine's action type registry

**Rule of thumb (authoring mode only):** if a component name starts with `inspector::` or `asset-packs::ActionTypes`, do NOT include it. The Creator Hub Inspector manages these components internally on first save.

> **WARNING — edit mode is different.** If the composite already contains `inspector::*` components, you are NOT authoring from scratch. Do NOT strip them, and DO update `inspector::Nodes` whenever you add a new entity. See "Editing an existing composite" below.

## Editing an existing composite (edit mode)

After the user opens and saves a scene in the Creator Hub, the composite contains baked-in inspector components. Adding new entities WITHOUT updating `inspector::Nodes` is a silent bug: the entities render correctly in the running scene but are **invisible in the Creator Hub entity tree**, so the user cannot select or edit them in the editor.

### Required updates when adding a new entity (entity ID `<id>`) in edit mode

For every new entity you add (in addition to the normal `core::Transform`, `core-schema::Name`, and feature components):

1. **Update `inspector::Nodes`** — this is the entity-tree registry on root entity `0`. Two changes required:
   - Append `<id>` to the `children` array inside the entry whose `entity` is `0` (the RootEntity entry).
   - Append a new entry `{ "entity": <id>, "children": [] }` to the top-level `value` array. (If the new entity has children of its own, list them in `children`; otherwise use `[]`.)

2. **Add a `core-schema::Name` entry** — every new entity MUST have a name in `core-schema::Name.data["<id>"].json.value`. Without it the entity shows as anonymous in the entity tree and cannot be looked up via `engine.getEntityOrNullByName()`.

3. **Add an `inspector::TransformConfig` entry** (optional but expected) — append `"<id>": { "json": {} }` to its `data` map. This is what the Creator Hub uses to track per-entity proportional-scaling state. An empty `{}` is a valid default.

4. **Keep `entity-names.ts` in sync** — this file at `assets/scene/entity-names.ts` is auto-generated by the Creator Hub from `core-schema::Name`. If you add a new name, either (a) add a matching `EntityNames` member to the file so TypeScript references compile, or (b) leave the file alone and let the Creator Hub regenerate it on next save. Never edit the generated header.

5. **Do NOT touch** `inspector::SceneMetadata-*` (only changes when `scene.json` parcels change), `inspector::Selection` (per-user editor state), `composite::root`, or `asset-packs::ActionTypes` — these remain managed by the Creator Hub.

### Concrete shape of `inspector::Nodes`

```json
{
  "name": "inspector::Nodes",
  "jsonSchema": { /* keep as-is from the existing file */ },
  "data": {
    "0": {
      "json": {
        "value": [
          { "entity": 0, "open": true, "children": [512, 513, 531, 532, 1, 2] },
          { "entity": 512, "children": [] },
          { "entity": 513, "children": [] },
          { "entity": 531, "children": [] },
          { "entity": 532, "children": [] },
          { "entity": 1,   "children": [] },
          { "entity": 2,   "children": [] }
        ]
      }
    }
  }
}
```

Notes on the structure:

- The first entry is always entity `0` (RootEntity) and is the only one that carries `"open": true`.
- Reserved entities `1` (PlayerEntity) and `2` (CameraEntity) appear at the END of the entity-`0` `children` array AND as their own entries with empty `children`. Preserve this ordering — append your new IDs **before** the trailing `1` and `2`.
- Every entity that exists in the composite must have its own `{ "entity": <id>, "children": [...] }` entry, even if `children` is empty.
- If your new entity has `Transform.parent` set to another entity (e.g. `512`), append your entity ID to the `children` of that parent's entry instead of entity `0`'s.

### Edit-mode failure mode (the bug this section prevents)

A new entity has `core::Transform` + `core::GltfContainer` but is NOT registered in `inspector::Nodes`:

- In the running scene: renders correctly.
- In the Creator Hub entity tree: **does not appear**, so the user cannot select, rename, reposition, or delete it from the editor — they can only edit it by hand-editing the JSON.

If you only add entities to `core::Transform` etc. and skip `inspector::Nodes`, the Creator Hub treats them as "orphan" entities that exist in the ECS but not in the editor's tree.

## jsonSchema Rules

**`core::` components** — do NOT include `jsonSchema`. The SDK knows these natively.

```json
{ "name": "core::Transform", "data": { "512": { "json": { ... } } } }
```

**Non-core components** (`asset-packs::*`, `core-schema::*`) — MUST include `jsonSchema`. Without it the SDK build fails. Copy the jsonSchema from the asset's composite in the catalog.

```json
{ "name": "asset-packs::Actions", "jsonSchema": { ... }, "data": { "512": { "json": { ... } } } }
```

**How to get the jsonSchema:** When you read an asset's composite from the catalog (`node_modules/@dcl/asset-packs/catalog.json`), each non-core component already has its `jsonSchema`. Copy it as-is into the scene composite.

## Step 0 — Read scene.json and Compute Bounds (MANDATORY)

**Before writing a single entity position, read `scene.json` and calculate the scene bounds.** This must happen first — all entity positions must fit within these bounds or they will not render.

### How to calculate bounds

1. Open `scene.json` and locate `scene.parcels` (array of `"x,y"` strings) and `scene.base`.
2. Parse every parcel as integers. Find the min and max X and Y across all parcels.
3. Compute:

```
parcelsWide = max(parcel_x) - min(parcel_x) + 1
parcelsDeep = max(parcel_y) - min(parcel_y) + 1

maxX = parcelsWide * 16
maxZ = parcelsDeep * 16
```

4. Valid entity positions: **X in [0, maxX], Z in [0, maxZ]**. Negative values and values above maxX/maxZ are outside the scene and will not render.

### Step 0b — Account for 3D Model Bounding Boxes (MANDATORY for GLB models)

**A model's `Transform.position` is its local origin, NOT its visual extent.** Tree and vegetation models commonly extend 6–12 m _beyond_ their origin in one or more directions. Placing a tree at x=2 can cause it to render at x=–10, which is outside the scene bounds.

**How to find a model's bounding box** — parse the GLB binary and apply node-level transforms. Raw accessor `min`/`max` values alone are **not reliable** because many GLB models have large scale factors or translations baked into the GLTF node hierarchy (e.g. a model whose accessors say 0.6 m but whose node scale is 24× giving an actual rendered size of 14 m).

```js
node -e "
const buf = require('fs').readFileSync('assets/Models/MyModel.glb');
const jsonLen = buf.readUInt32LE(12);
const json = JSON.parse(buf.slice(20, 20+jsonLen));
let minW=[Infinity,Infinity,Infinity], maxW=[-Infinity,-Infinity,-Infinity];
json.nodes?.forEach(n => {
  if (n.mesh === undefined) return;
  const s = n.scale || [1,1,1];
  const t = n.translation || [0,0,0];
  for (const prim of json.meshes[n.mesh].primitives) {
    const acc = json.accessors[prim.attributes.POSITION];
    if (!acc.min || !acc.max) continue;
    for (let i = 0; i < 3; i++) {
      const lo = acc.min[i]*s[i]+t[i], hi = acc.max[i]*s[i]+t[i];
      minW[i] = Math.min(minW[i], lo, hi);
      maxW[i] = Math.max(maxW[i], lo, hi);
    }
  }
});
const w=maxW[0]-minW[0], h=maxW[1]-minW[1], d=maxW[2]-minW[2];
console.log('Rendered size:', w.toFixed(2)+'m x', h.toFixed(2)+'m x', d.toFixed(2)+'m');
console.log('World min:', minW.map(v=>v.toFixed(2)), 'max:', maxW.map(v=>v.toFixed(2)));
"
```

**Known measured bounding boxes** (half-extents from origin):

| Model           | –X   | +X   | –Z    | +Z   | Safe minimum origin    |
| --------------- | ---- | ---- | ----- | ---- | ---------------------- |
| Tree_01_Art.glb | 8.16 | 7.78 | 11.34 | 0.76 | x≥9, z≥12              |
| Tree_02_Art.glb | 6.56 | 6.23 | 11.41 | 0.36 | x≥7, z≥12              |
| Column_Art.glb  | 0.82 | 0.82 | 0.82  | 0.82 | any x/z with 1m margin |
| Wall01_Art.glb  | 2.18 | 2.16 | 0.05  | 0.05 | x≥3, z≥1               |

**Rule:** For every GLB model, compute:

```
minSafeX = max(0, -bbox.minX) + margin      (≥1 m)
minSafeZ = max(0, -bbox.minZ) + margin      (≥1 m)
maxSafeX = maxX - (bbox.maxX + margin)
maxSafeZ = maxZ - (bbox.maxZ + margin)
```

Only place the model if its Transform position satisfies all four bounds.

For tree/vegetation models where the bounding box is unknown, assume a **12 m safe buffer** from all edges — i.e., place origins in `[12, maxX-12]` × `[12, maxZ-12]`.

### Examples

| scene.json parcels          | parcelsWide | parcelsDeep | Valid X | Valid Z |
| --------------------------- | ----------- | ----------- | ------- | ------- |
| `["0,0"]`                   | 1           | 1           | 0 – 16  | 0 – 16  |
| `["0,0","1,0"]`             | 2           | 1           | 0 – 32  | 0 – 16  |
| `["0,0","1,0","0,1","1,1"]` | 2           | 2           | 0 – 32  | 0 – 32  |

### Never change scene.json parcel count without explicit user instruction

Adding parcels to `scene.json` is not always an option, it depends where the scene will be published to. If publishing to Genesis City, parcels must be **owned or rented** by the deploying wallet; if publishing to a World, it might be an option. If the scene is currently too small for what the user is asking for, ask the user for confirmation to change the scene layout and include more parcels. If they disagree then **work within the existing parcel bounds and make the scene as rich as possible within 16×16m**. Do not silently expand the parcel list. If more space is truly needed, ask the user first.

---

## Entity ID Allocation

| ID   | Purpose                                         |
| ---- | ----------------------------------------------- |
| 0    | RootEntity                                      |
| 1    | PlayerEntity (reserved, must appear in Nodes)   |
| 2    | CameraEntity (reserved, must appear in Nodes)   |
| 512+ | User entities (first = 512, then 513, 514, ...) |

**For existing scenes:** Read the current composite, find the highest entity ID, allocate new ones starting from `highest + 1`.

### 1. core::Transform (on every entity)

```json
{
	"name": "core::Transform",
	"data": {
		"512": {
			"json": {
				"position": { "x": 8, "y": 0, "z": 8 },
				"scale": { "x": 1, "y": 1, "z": 1 },
				"rotation": { "x": 0, "y": 0, "z": 0, "w": 1 },
				"parent": 0
			}
		}
	}
}
```

**Notes:**

- `rotation` is a quaternion (x, y, z, w). Default = `{x:0, y:0, z:0, w:1}` (no rotation)
- `parent: 0` means child of RootEntity (top-level)
- Each parcel is 16m x 16m. Scene bounds are computed in **Step 0** from `scene.json`. A 1×1 scene has maxX=16, maxZ=16; a 2×2 scene has maxX=32, maxZ=32. Always use the computed bounds, not assumed ones.

### 4. core-schema::Name (on every user entity)

**Every entity must have a descriptive name**, not just entities that will be referenced in code. Names make the scene understandable for users browsing the entity list in the Creator Hub. Use clear, human-readable names that describe what the entity is (e.g. "Oak Tree", "Street Lamp", "Welcome Sign").

```json
{
	"name": "core-schema::Name",
	"data": {
		"512": { "json": { "value": "My Entity Name" } }
	}
}
```

## Common Components

### core::GltfContainer (3D models from catalog)

```json
{
	"name": "core::GltfContainer",
	"data": {
		"512": {
			"json": {
				"src": "assets/asset-packs/arcade_machine_-_black/Arcade_Machine_Black.glb",
				"visibleMeshesCollisionMask": 0,
				"invisibleMeshesCollisionMask": 3
			}
		}
	}
}
```

**Asset path format:** `assets/asset-packs/<slugified-asset-name>/<filename>`

- Slug rule: `asset.name.trim().replaceAll(' ', '_').toLowerCase()`
- Example: "Tree Forest Pink 01" → `assets/asset-packs/tree_forest_pink_01/Tree_Forest_Pink_01.glb`

**Default collision masks:** If not provided, set `visibleMeshesCollisionMask: 0` and `invisibleMeshesCollisionMask: 3` (CL_POINTER + CL_PHYSICS).

**Swapping `src` on an existing entity:** the inherited `Transform.scale`/`position`/`rotation` were tuned for the **previous** model's native dimensions and pivot — they are almost never correct for a new GLB. Recompute scale from the new model's native bounding box, verify the pivot, and re-check scene bounds. See the "Swapping a model `src`" rule in `../add-3d-models/SKILL.md`.

### core::MeshRenderer (primitive shapes)

```json
{
	"name": "core::MeshRenderer",
	"data": {
		"512": {
			"json": {
				"mesh": { "$case": "box", "box": {} }
			}
		}
	}
}
```

Mesh types: `box`, `sphere`, `cylinder`, `plane`.

Cylinder options: `{ "$case": "cylinder", "cylinder": { "radiusTop": 0.5, "radiusBottom": 0.5 } }`

### core::MeshCollider

```json
{
	"name": "core::MeshCollider",
	"data": {
		"512": {
			"json": {
				"collisionMask": 1,
				"mesh": { "$case": "box", "box": {} }
			}
		}
	}
}
```

**Collision mask values:**

- `0` = CL_NONE
- `1` = CL_POINTER (mouse/pointer raycasting)
- `2` = CL_PHYSICS (player physics, walls, floors)
- `3` = CL_POINTER + CL_PHYSICS (both)

### core::Material

**PBR material:**

```json
{
	"name": "core::Material",
	"data": {
		"512": {
			"json": {
				"material": {
					"$case": "pbr",
					"pbr": {
						"albedoColor": { "r": 1, "g": 0, "b": 0, "a": 1 },
						"metallic": 0.5,
						"roughness": 0.5,
						"texture": {
							"tex": {
								"$case": "texture",
								"texture": {
									"src": "assets/Images/image.png",
									"wrapMode": 0,
									"filterMode": 0
								}
							}
						}
					}
				}
			}
		}
	}
}
```

**Unlit material (for video screens):**

```json
{
	"material": {
		"$case": "unlit",
		"unlit": {
			"texture": {
				"tex": {
					"$case": "videoTexture",
					"videoTexture": { "videoPlayerEntity": 512 }
				}
			}
		}
	}
}
```

### core::TextShape

```json
{
	"name": "core::TextShape",
	"data": {
		"512": {
			"json": {
				"text": "Hello World",
				"fontSize": 3,
				"textColor": { "r": 1, "g": 1, "b": 1, "a": 1 }
			}
		}
	}
}
```

### core::AudioSource

```json
{
	"name": "core::AudioSource",
	"data": {
		"512": {
			"json": {
				"audioClipUrl": "assets/Audio/music.mp3",
				"playing": true,
				"volume": 1,
				"loop": true,
				"global": false
			}
		}
	}
}
```

### core::VideoPlayer

```json
{
	"name": "core::VideoPlayer",
	"data": {
		"512": {
			"json": {
				"src": "https://example.com/video.mp4",
				"playing": true,
				"volume": 1,
				"loop": true
			}
		}
	}
}
```

### core::PointerEvents

```json
{
	"name": "core::PointerEvents",
	"data": {
		"512": {
			"json": {
				"pointerEvents": [
					{
						"eventType": 1,
						"eventInfo": {
							"button": 1,
							"hoverText": "Click me",
							"maxDistance": 10,
							"showFeedback": true
						}
					}
				]
			}
		}
	}
}
```

### core::Animator

```json
{
	"name": "core::Animator",
	"data": {
		"512": {
			"json": {
				"states": [
					{ "clip": "idle", "playing": true, "loop": true },
					{ "clip": "walk", "playing": false, "loop": true }
				]
			}
		}
	}
}
```

### core::Billboard

```json
{
	"name": "core::Billboard",
	"data": {
		"512": {
			"json": {
				"billboardMode": 7
			}
		}
	}
}
```

Modes: 0=NONE, 1=X, 2=Y, 4=Z, 7=ALL (1+2+4).

### core::VisibilityComponent

```json
{
	"name": "core::VisibilityComponent",
	"data": {
		"512": {
			"json": { "visible": false }
		}
	}
}
```

### core::LightSource

```json
{
	"name": "core::LightSource",
	"data": {
		"512": {
			"json": {
				"active": true,
				"color": { "r": 1, "g": 1, "b": 1 },
				"intensity": 16000,
				"range": -1,
				"shadow": true,
				"type": { "$case": "point", "point": {} }
			}
		}
	}
}
```

Light types: `point`, `spot`.

### core::Tween (movement/rotation animation)

```json
{
	"name": "core::Tween",
	"data": {
		"512": {
			"json": {
				"duration": 5000,
				"easingFunction": 0,
				"mode": {
					"$case": "move",
					"move": {
						"start": { "x": 0, "y": 0, "z": 0 },
						"end": { "x": 5, "y": 0, "z": 0 }
					}
				},
				"playing": true
			}
		}
	}
}
```

Modes: `move`, `rotate`, `scale`.

### core-schema::Tags

Assigns one or more tags to an entity. Tags are used to group entities for batch operations in code.

**Entity `0` (RootEntity) holds a global registry** of all tag names used in the scene. Every tag that appears on any entity must also be listed on entity `0`.

```json
{
	"name": "core-schema::Tags",
	"jsonSchema": {
		"type": "object",
		"properties": {
			"tags": {
				"type": "array",
				"items": { "type": "string", "serializationType": "utf8-string" },
				"serializationType": "array"
			}
		},
		"serializationType": "map"
	},
	"data": {
		"0": {
			"json": {
				"tags": ["Crystal", "Tree", "Alien"]
			}
		},
		"523": { "json": { "tags": ["Crystal"] } },
		"536": { "json": { "tags": ["Tree"] } },
		"539": { "json": { "tags": ["Tree", "Alien"] } }
	}
}
```

An entity can have multiple tags. The entity `0` `tags` array must be the union of all tags used across all entities.

### core::NftShape

```json
{
	"name": "core::NftShape",
	"data": {
		"512": {
			"json": {
				"urn": "urn:decentraland:ethereum:erc721:0x06012c8cf97bead5deae237070f9587f8e7a266d:558536",
				"style": 0,
				"color": { "r": 0.6, "g": 0.25, "b": 1 }
			}
		}
	}
}
```

## Component Grouping Pattern

Components share entity IDs across the `data` map. All components for entity 512 have their data under key `"512"`:

```json
{
	"version": 1,
	"components": [
		{
			"name": "core::Transform",
			"data": {
				"512": {
					"json": {
						"position": { "x": 8, "y": 0, "z": 8 },
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
			"name": "core::GltfContainer",
			"data": {
				"512": {
					"json": {
						"src": "assets/asset-packs/pack1/asset1/Model.glb",
						"visibleMeshesCollisionMask": 0,
						"invisibleMeshesCollisionMask": 3
					}
				},
				"513": {
					"json": {
						"src": "assets/asset-packs/pack2/asset2/Model.glb",
						"visibleMeshesCollisionMask": 0,
						"invisibleMeshesCollisionMask": 3
					}
				}
			}
		},
		{
			"name": "core-schema::Name",
			"data": {
				"512": { "json": { "value": "Table" } },
				"513": { "json": { "value": "Chair" } }
			}
		}
	]
}
```

## Non-core components

All components that start with `asset-packs::` or `inspector::` are non-core, and require installing the `asset-packs` library in the project. Do not add any of these unless the user wants to use the Creator Hub.

### Root Entity components

**NOTE (authoring-from-scratch mode):** Do NOT include `inspector::Nodes` or `inspector::SceneMetadata-*` in a fresh composite. The Creator Hub creates these automatically when opening the scene. Including them in a fresh file causes the SDK build to fail.

**NOTE (edit mode):** If `inspector::Nodes` and `inspector::SceneMetadata-*` are ALREADY present (the user has opened/saved the scene in the Creator Hub), keep them and update `inspector::Nodes` whenever you add a new entity — see "Editing an existing composite (edit mode)" above. Do not delete or strip them.

These components only exist on the RootEntity (ID 0).

If `asset-packs::Actions`, `asset-packs::Triggers`, or `asset-packs::States` exist anywhere in the composite, then `asset-packs::Counter` must exist on entity 0, and have `value` = highest allocated component ID

The `inspector::SceneMetadata` component in the composite must match `scene.json`:

```json
{
	"name": "inspector::SceneMetadata",
	"data": {
		"0": {
			"json": {
				"name": "Same as display.title",
				"description": "Same as display.description",
				"layout": {
					"base": { "x": 0, "y": 0 },
					"parcels": [
						{ "x": 0, "y": 0 },
						{ "x": 1, "y": 0 }
					]
				}
			}
		}
	}
}
```

**Note:** In scene.json parcels use string format `"0,0"`, in SceneMetadata they use object format `{ "x": 0, "y": 0 }`.

## Referencing Composite Entities from Code

Entities defined in the composite can be fetched in TypeScript code by name or by tag. These lookups must happen inside `main()`, in functions called after `main()`, or in systems — entities from the composite are not yet instantiated before that point.

### By Name

The Creator Hub auto-generates `assets/scene/entity-names.ts` with an `EntityNames` enum that lists every named entity. Import it to get type-safe access:

```ts
import { EntityNames } from '../assets/scene/entity-names'

export function main() {
	// Returns the entity or null — always check before use
	const door = engine.getEntityOrNullByName(EntityNames.Door_1)
	if (door) {
		pointerEventsSystem.onPointerDown(
			{
				entity: door,
				opts: { button: InputAction.IA_PRIMARY, hoverText: 'Open' },
			},
			function () {
				/* open door */
			}
		)
	}

	// Strict variant — throws at compile time if name changes, no null check needed
	const box = engine.getEntityByName<EntityNames>(EntityNames.MyBox)
	console.log(Transform.get(box).position.x)
}
```

You can also pass a plain string instead of the enum value, but the enum is preferred because it catches renames at compile time.

### By Tag

Use `engine.getEntitiesByTag()` to retrieve all entities that share a tag. Tags must be defined in the composite's `core-schema::Tags` component (see above).

```ts
import { engine } from '@dcl/sdk/ecs'

export function main() {
	const trees = engine.getEntitiesByTag('Tree')

	for (const entity of trees) {
		// apply logic to every entity tagged "Tree"
	}
}
```

Tags can also be added or removed at runtime:

```ts
import { Tags } from '@dcl/sdk/ecs'

Tags.add(entity, 'Crystal')
Tags.remove(entity, 'Crystal')
```

## Validation Checklist

**Step 1 — Detect mode.** Scan the composite for `inspector::*`, `composite::root`, or `asset-packs::ActionTypes`. If any are present, you are in **edit mode** — use the edit-mode checklist below. Otherwise use the authoring-from-scratch checklist.

### Authoring-from-scratch checklist

Before writing a fresh composite, verify:

- [ ] `version` is `1`
- [ ] NO `inspector::*` components whatsoever — no `inspector::Nodes`, `inspector::SceneMetadata` (any version), `inspector::Selection`, `inspector::TransformConfig`, `inspector::UIState`. These are all auto-generated by the Creator Hub and including them in a fresh file breaks the entity tree or causes build errors.
- [ ] NO `composite::root` or `asset-packs::ActionTypes` — auto-generated by engine
- [ ] Every user entity (512+) has `core::Transform` and `core-schema::Name`
- [ ] No duplicate entity IDs across the composite
- [ ] No duplicate entity IDs with entities created via code with an explicit ID
- [ ] `core::` components do NOT have `jsonSchema` — this is a hard requirement; including jsonSchema on a core:: component will cause the Creator Hub to fail to parse entities correctly
- [ ] Non-core components (`asset-packs::*`, `core-schema::*`) MUST have `jsonSchema` (copied from catalog)
- [ ] All `GltfContainer.src` paths use slugified name format: `assets/asset-packs/<slug>/<filename>`
- [ ] All referenced asset files were downloaded to disk (GLB, audio, images)
- [ ] Default collision masks set on GltfContainer (`visibleMeshesCollisionMask: 0`, `invisibleMeshesCollisionMask: 3`)
- [ ] All positions within parcel bounds — bounds were calculated in **Step 0** from the actual `scene.json` parcel list. Every entity's X is in `[0, maxX]` and Z is in `[0, maxZ]`. Negative values and values above maxX/maxZ do not render. If the user requested a "large" scene but parcel count was not changed, all entities fit within the original bounds.
- [ ] For every `GltfContainer` entity: checked whether the GLB contains animations (clip names embedded in the file). If it does, an `core::Animator` component is present on that entity. A model with animations but no Animator will silently loop its first clip with no way to control it.
- [ ] For every `GltfContainer` entity: checked whether the GLB contains collision meshes (any mesh whose name includes the string `_collider`). If yes, `invisibleMeshesCollisionMask` is set to `3` (CL_POINTER + CL_PHYSICS) to activate them. If no built-in colliders, evaluated whether a `core::MeshCollider` box/sphere is needed to cover the model's rough shape (for walkable surfaces, walls, or clickable objects).
- [ ] If `asset-packs::Actions`, `asset-packs::Triggers`, or `asset-packs::States` exist anywhere in the composite, then `asset-packs::Counter` must exist on entity 0, and have `value` = highest allocated component ID
- [ ] No `{self}`, `{assetPath}`, or placeholder strings — all resolved to concrete values
- [ ] Component names use base names (e.g., `asset-packs::Actions`, not `asset-packs::Actions-v1`). Never use versioned suffixes like `-v3`.
- [ ] The project must have the `@dcl/asset-packs` library as a dependency to be able to use a composite file

### Edit-mode checklist (composite already contains `inspector::*`)

For every NEW entity `<id>` you add, in addition to the authoring-from-scratch rules above (with the relaxation that `inspector::*` etc. are kept, not stripped):

- [ ] `<id>` has been appended to the `children` array of the entity-`0` entry inside `inspector::Nodes.data["0"].json.value`, **before** the trailing `1` and `2` reserved entries.
- [ ] A new entry `{ "entity": <id>, "children": [...] }` has been appended to the `value` array of `inspector::Nodes.data["0"].json` (use `[]` if the entity has no children of its own).
- [ ] If `<id>`'s `Transform.parent` is not `0`, then `<id>` is in the parent entity's `children` array (not the root's).
- [ ] `core-schema::Name.data["<id>"]` has a `{ "json": { "value": "..." } }` entry — names are required for the entity to appear correctly in the entity tree and to be looked up by code.
- [ ] `inspector::TransformConfig.data["<id>"]` has a `{ "json": {} }` entry (empty object is fine).
- [ ] `entity-names.ts` is either updated to include the new name (in `EntityNames`) OR left untouched so the Creator Hub regenerates it on next save. Do NOT hand-edit the auto-generated header.
- [ ] You did NOT delete or strip pre-existing `inspector::Nodes`, `inspector::SceneMetadata-*`, `inspector::Selection`, `inspector::TransformConfig`, `composite::root`, or `asset-packs::ActionTypes`. These are managed by the Creator Hub and must stay.
- [ ] `inspector::SceneMetadata-*` is unchanged unless `scene.json` parcels changed (in which case the layout block must match `scene.json`).
- [ ] Reserved entities `1` (PlayerEntity) and `2` (CameraEntity) are still present in `inspector::Nodes` — both as the last two children of entity `0` AND as their own `{ "entity": 1, "children": [] }` / `{ "entity": 2, "children": [] }` entries.

**Verification command (edit mode):** after editing, every entity ID present in `core::Transform.data` should also appear:

1. As a top-level `{ "entity": <id>, ... }` entry in `inspector::Nodes.data["0"].json.value`, AND
2. In exactly one `children` array within that same `value` list (its parent's children).

Missing entries here are the root cause of "entity renders but is invisible in the Creator Hub entity tree".

## Post-Write Validation

After writing the composite, **run the SDK build** to verify:

```bash
npx sdk-commands build
```

The build must pass with zero errors. If it fails, the composite is invalid. Common errors:

- `"X is not defined and there is no schema to define it"` → missing `jsonSchema` on non-core component, or `inspector::*` component that shouldn't be there
- TypeScript errors → fix generated scripts
