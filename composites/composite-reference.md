# Composite Format Reference

This document defines the `main.composite` JSON declarative format that defines all of the entities that are loaded as the initial state of the scene.

It's best to load heavy assets through the composite, as they load faster. Assets in the composite can also be easily visually adjusted by the user through the Creator Hub.

This file must exist at `assets/scene/main.composite`.

## main.composite vs main.crdt

Two file forms carry initial-scene entity state; do not confuse them:

- **`assets/scene/main.composite`** — the human-editable **JSON** source described in this document. Edit this.
- **`main.crdt`** (scene root) — a **binary** file the SDK build produces from the composite. It is the pre-serialized CRDT snapshot the runtime loads on the first frame (entities exist at `tickNumber === 1`, before `main()` runs). Do **not** hand-edit it — it is not JSON. If a scene ships only a `main.crdt` (no readable `main.composite`), regenerate the composite via the Creator Hub / build rather than editing the binary. Static entities loaded this way get engine IDs starting at `512` and are queryable in code by component (e.g. `engine.getEntitiesWith(GltfContainer)`) from within `main()` or a system.

The rest of this document describes the `main.composite` JSON format.

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

- **`inspector::Nodes`** — the Inspector creates this automatically from the Transform parent hierarchy. Including it in a fresh composite **overrides the auto-generated entity tree** — if the included Nodes data is incomplete or has empty `children` arrays, the Creator Hub entity panel will show a broken/empty tree. Also causes an SDK build error about an undefined component (see the Troubleshooting section for the exact wording, which differs between current and older SDK versions)
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
- Each parcel is 16m x 16m. Scene bounds are computed in **Step 0** (in the composites `SKILL.md`) from `scene.json`. A 1×1 scene has maxX=16, maxZ=16; a 2×2 scene has maxX=32, maxZ=32. Always use the computed bounds, not assumed ones.

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

**Default:** if `collisionMask` is omitted it defaults to `3` (CL_POINTER | CL_PHYSICS) — a bare `MeshCollider` is already clickable and solid. Set it explicitly only to narrow the behavior (e.g. `2` for a wall that shouldn't intercept clicks), not to enable colliders.

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

### core::AudioStream

Streams audio from a URL (e.g. an internet radio / icecast stream) rather than a local file. The stream host must be whitelisted in `scene.json` `allowedMediaHostnames` together with the `ALLOW_MEDIA_HOSTNAMES` required permission.

```json
{
	"name": "core::AudioStream",
	"data": {
		"512": {
			"json": {
				"url": "https://example.com/stream.mp3",
				"playing": true,
				"volume": 1
			}
		}
	}
}
```

Non-spatial by default. Set `"spatial": true` (optionally with `spatialMinDistance` / `spatialMaxDistance`) to position the stream in 3D at the entity.

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

All components that start with `asset-packs::` or `inspector::` are non-core. On current SDK versions the build resolves `@dcl/asset-packs` from the copy bundled inside `@dcl/inspector` when the scene doesn't declare it as a dependency, so no explicit install is required; older SDK versions require `@dcl/asset-packs` to be a project dependency. Either way, do not add any of these components unless the user wants to use the Creator Hub.

### Root Entity components

These components only exist on the RootEntity (ID 0). Whether you include `inspector::Nodes` / `inspector::SceneMetadata-*` depends on the mode — see "Authoring-from-scratch vs editing-an-existing-composite" above: omit them when authoring fresh, keep and update them in edit mode.

If `asset-packs::Actions`, `asset-packs::Triggers`, or `asset-packs::States` exist anywhere in the composite, then `asset-packs::Counter` must exist on entity 0, with `value` = the highest `id` used inside any Actions/Triggers/States data. This Counter is the id allocator: the Creator Hub assigns each new action, trigger, and state an `id` via `++counter.value`, so a `value` lower than an existing id would cause duplicate ids.

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

	// Strict variant — the <EntityNames> type parameter catches renames at
	// COMPILE time only. At runtime it never throws: called before composite
	// entities are instantiated it silently returns a null-ish Entity.
	// Only safe inside main() or later, when the entity is guaranteed to exist.
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

## Spawning a Composite at Runtime

A composite file (a self-contained `.composite`, or a Custom Item stored as `composite.json`) can be instantiated at runtime as many times as you like. Two steps: **load once** (async), then **instance** (sync, repeatable).

```ts
import { engine, Composite, getCompositeProvider, Transform } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

const src = 'assets/barrel.composite'

export async function spawnBarrel(position: Vector3) {
  // Provider is registered automatically by @dcl/sdk at module load.
  const provider = getCompositeProvider()!

  // 1. Load into memory. Async, idempotent — cached by `src`, so calling it
  //    again with the same path returns the already-loaded resource (no re-read).
  const resource = await provider.loadComposite!(src)

  // 2. Instance. Synchronous; returns the ROOT entity of the spawned tree.
  const root = Composite.instance(engine, resource, provider)

  // 3. Position it: set the root entity's Transform AFTER instancing
  //    (there is no transform option on instance()).
  Transform.createOrReplace(root, { position })
  return root
}
```

- `Composite.instance(engine, compositeData: Composite.Resource, compositeProvider, options?): Entity` — on the `Composite` namespace from `@dcl/sdk/ecs`. Creates every entity/component described by the composite and returns the **root entity** — use it to read/mutate/remove the spawned tree later. ⚠ An earlier API named `engine.addEntityFromComposite(src)` does NOT exist on current SDK main (it was replaced by `Composite.instance`) — do not use it even if older docs mention it.
- `getCompositeProvider()` returns the scene's standard provider (`@dcl/sdk` registers it via `setCompositeProvider(engine, compositeProvider)` at module load; returns `null` only if that never ran). The provider offers `loadComposite(src): Promise<Composite.Resource>` — reads + caches the file via `~system/Runtime.readFile`, accepting JSON `.composite` and binary `.composite.bin` — and `getCompositeOrNull(src)`, the synchronous cache lookup.
- `InstanceCompositeOptions`: `rootEntity?` (reuse an existing entity as the root), `entityMapping?` (`EMM_NEXT_AVAILABLE` with `getNextAvailableEntity`, or `EMM_DIRECT_MAPPING` with `getCompositeEntity`), `alreadyRequestedSrc?`. There is **no** transform option — set the root's `Transform` after instancing.
- **Nested composites:** `Composite.instance` resolves composite references held by the spawned entities through the provider's **synchronous** cache (`getCompositeOrNull`), so a nested composite only instantiates if it was already loaded — `loadComposite` every composite the spawned one references first, or keep spawned composites self-contained. Directly or indirectly recursive references throw.
- JSON `.composite` decoding requires `TextDecoder`; in runtimes without it, `loadComposite` throws with a message suggesting `.composite.bin` or importing `@dcl/sdk/ethereum-provider` (installs the polyfill).
- Scene Editor equivalent: the no-code **"Spawn Entity"** action (Source + Position). Make an item spawnable via right-click → **"Add to filesystem"**. Spawned smart items keep their own independent actions/triggers — distinct from **Clone**.

## Example scenes

- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/80,-2-main-crdt — ships a binary `main.crdt` at scene root defining static entities (1 primitive cube at entity `512` + 4 GltfContainers) present at `tickNumber === 1`. Scene code queries them by component (`engine.getEntitiesWith(MeshRenderer)` / `getEntitiesWith(GltfContainer)`) and rotates them, and a `@dcl/sdk/testing` test asserts the initial state. Demonstrates the compiled-`main.crdt` form of composite loading (see "main.composite vs main.crdt" above).
