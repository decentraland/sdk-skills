---
name: optimize-scene
description: Optimize Decentraland scene performance. Scene limit formulas (triangles, entities, materials, textures, height per parcel count), object pooling, LOD patterns, texture optimization, system throttling, and asset preloading. Use when the user wants to optimize, improve performance, fix lag, reduce load time, check limits, or reduce entity/triangle count. Do NOT use for deployment (see deploy-scene).
---

# Optimizing Decentraland Scenes

## Scene Limits (Per Parcel Count)

All limits scale with parcel count `n`. Triangles, entities, and bodies scale linearly. Materials, textures, and height scale logarithmically.

| Resource           | Formula         | 1 parcel | 2 parcels | 3 parcels | 4 parcels | 6 parcels | 9 parcels | 16 parcels | 20 parcels |
| ------------------ | --------------- | -------- | --------- | --------- | --------- | --------- | --------- | ---------- | ---------- |
| **Triangles**      | n x 10,000      | 10,000   | 20,000    | 30,000    | 40,000    | 60,000    | 90,000    | 160,000    | 200,000    |
| **Entities**       | n x 200         | 200      | 400       | 600       | 800       | 1,200     | 1,800     | 3,200      | 4,000      |
| **Physics bodies** | n x 300         | 300      | 600       | 900       | 1,200     | 1,800     | 2,700     | 4,800      | 6,000      |
| **Materials**      | log2(n+1) x 20  | 20       | 31        | 40        | 46        | 56        | 66        | 81         | 87         |
| **Textures**       | log2(n+1) x 10  | 10       | 15        | 20        | 23        | 28        | 33        | 40         | 43         |
| **Height limit**   | log2(n+1) x 20m | 20m      | 31m       | 40m       | 46m       | 56m       | 66m       | 81m        | 87m        |

**File limits:** 15 MB per parcel, 300 MB max total, 200 files per parcel, 50 MB max per individual file.

Important: Except for the MB size limits, all other limits can be exceeded. It's generally not recommended to go over them because of performance impact, but if a user tests their scene and determines that it's good enough, it should be ok to publish.

## Entity Count Optimization

### Reuse Entities

Use this pattern only for cases where the scene should be spawning and removing instances dynamically.

```typescript
// BAD: Creating new entity each time
function spawnBullet() {
	const bullet = engine.addEntity() // Creates entity every call
	// ...
}

// GOOD: Object pooling
const bulletPool: Entity[] = []
function getBullet(): Entity {
	const existing = bulletPool.find((e) => !ActiveBullet.has(e))
	if (existing) return existing
	const newBullet = engine.addEntity()
	bulletPool.push(newBullet)
	return newBullet
}
```

### Remove Unused Entities

```typescript
engine.removeEntity(entity) // Frees the entity slot
```

### Use Parenting

Instead of independent transform values for each child, use entity hierarchy:

```typescript
const parent = engine.addEntity()
Transform.create(parent, { position: Vector3.create(8, 0, 8) })

// Children inherit parent transform
const child1 = engine.addEntity()
Transform.create(child1, { position: Vector3.create(0, 1, 0), parent })

const child2 = engine.addEntity()
Transform.create(child2, { position: Vector3.create(1, 1, 0), parent })
```

## Triangle Count Optimization

### Use Lower-Poly Models

- Small props: 100-500 triangles
- Medium objects: 500-1,500 triangles
- Large buildings: 1,500-5,000 triangles
- Hero pieces: Up to 10,000 triangles

### Use LOD (Level of Detail)

Show simpler models at distance:

```typescript
engine.addSystem(() => {
	// Check distance to player and swap models
	const playerPos = Transform.get(engine.PlayerEntity).position
	const objPos = Transform.get(myEntity).position
	const distance = Vector3.distance(playerPos, objPos)

	const gltf = GltfContainer.getMutable(myEntity)
	if (distance > 30) {
		gltf.src = 'models/building_lod2.glb' // Low poly
	} else if (distance > 15) {
		gltf.src = 'models/building_lod1.glb' // Medium poly
	} else {
		gltf.src = 'models/building_lod0.glb' // High poly
	}
})
```

### Use Primitives Instead of Models

For simple shapes, `MeshRenderer` is lighter than loading a .glb:

```typescript
MeshRenderer.setBox(entity) // Very cheap
MeshRenderer.setSphere(entity) // Cheap
MeshRenderer.setPlane(entity) // Very cheap
```

## Texture Optimization

- **Dimensions must be power-of-two**: 256, 512, 1024, 2048
- **Recommended sizes**: 512x512 for most objects, 1024x1024 max for hero pieces
- Use `.png` for UI/sprites with transparency
- Use `.jpg` for photos and textures without transparency
- Prefer compressed formats (WebP) over raw PNG where possible
- Use texture atlases (combine multiple textures into one image) to reduce draw calls and material count
- Share texture references across materials — do not duplicate texture files
- Reuse materials across entities:

```typescript
// GOOD: Define material once, apply to many
Material.setPbrMaterial(entity1, {
	texture: Material.Texture.Common({ src: 'images/wall.jpg' }),
})
Material.setPbrMaterial(entity2, {
	texture: Material.Texture.Common({ src: 'images/wall.jpg' }),
})
// Same texture URL = shared in memory
```

### Texture Size Guide by Use Case

| Use Case                      | Recommended | Maximum   |
| ----------------------------- | ----------- | --------- |
| Scene objects (walls, floors) | 1024x1024   | 2048x2048 |
| Props and furniture           | 512x512     | 1024x1024 |
| UI elements / icons           | 256x256     | 512x512   |
| Skybox / environment maps     | 1024x1024   | 2048x2048 |

Textures do not need to be square — 512x1024 is valid as long as both dimensions are powers of two.

## Back-Face Culling

Back-face culling skips rendering the inside face of any polygon the player will never see from behind. It's set in your 3D modeling tool (Blender, Maya, etc.) — **not** in SDK code.

**Rule of thumb:** Enable back-face culling on all materials by default. Only disable it when a surface must be visible from both sides (e.g., a leaf plane on a tree, a thin wall).

## System Optimization

### Avoid Per-Frame Allocations

```typescript
// BAD: Creates new Vector3 every frame
engine.addSystem(() => {
	const target = Vector3.create(8, 1, 8) // Allocation!
})

// GOOD: Reuse constants
const TARGET = Vector3.create(8, 1, 8)
engine.addSystem(() => {
	// Use TARGET
})
```

### Throttle Expensive Operations

```typescript
let lastCheck = 0
engine.addSystem((dt) => {
	lastCheck += dt
	if (lastCheck < 0.5) return // Only run every 0.5 seconds
	lastCheck = 0
	// Expensive operation here
})
```

### Remove Systems When Not Needed

```typescript
const systemFn = (dt: number) => {
	/* ... */
}
engine.addSystem(systemFn)

// When no longer needed:
engine.removeSystem(systemFn)
```

## Asset Preloading (AssetLoad Component)

For large assets that would cause visible pop-in, use `AssetLoad` to pre-download before rendering:

```typescript
import {
	engine,
	AssetLoad,
	LoadingState,
	GltfContainer,
	Transform,
} from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

// Create a preload entity at scene startup
const preloadEntity = engine.addEntity()
AssetLoad.create(preloadEntity, { src: 'models/large-model.glb' })

// System to track loading progress
function assetLoadingSystem(dt: number) {
	for (const [entity] of engine.getEntitiesWith(AssetLoad)) {
		const state = AssetLoad.get(entity)
		if (state.loadingState === LoadingState.FINISHED) {
			// Asset is cached — now safe to create the visible entity
			GltfContainer.create(entity, { src: 'models/large-model.glb' })
			Transform.create(entity, { position: Vector3.create(8, 0, 8) })
			AssetLoad.deleteFrom(entity) // Remove preload component
		}
	}
}
engine.addSystem(assetLoadingSystem)
```

Use this pattern for any asset that should be ready before a game phase begins, or that may be needed any time based on player interaction. For example for the sound effect of pressing a button that is already available to the player.

## Loading Time Optimization

- Lazy-load 3D models (load on demand, not all at scene start)
- Use compressed .glb files (Draco compression)
- Minimize total asset size
- Use CDN URLs for large shared assets when possible
- Preload critical assets with `AssetLoad`, defer non-essential ones

### Loading Areas for Large Scenes

For scenes with many 3D models (e.g. a furnished multi-room building), avoid rendering everything at once. Use trigger areas to load and unload content as the player moves through the scene:

```typescript
import { engine, Transform, GltfContainer, TriggerArea, TriggerAction } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

// Keep furniture hidden initially
let furnitureLoaded = false

// When player enters the building, spawn interior furniture
const trigger = engine.addEntity()
Transform.create(trigger, { position: Vector3.create(8, 1, 8) })
TriggerArea.create(trigger, {
  area: { box: Vector3.create(3, 3, 3) },
  onEnter: [{ type: TriggerAction.TA_CUSTOM, customId: 'load-interior' }],
  onExit: [{ type: TriggerAction.TA_CUSTOM, customId: 'unload-interior' }],
})
```

This pattern keeps the initial triangle and entity counts low and loads detail only when needed.

## Common Performance Pitfalls

| Pitfall                              | Symptom                          | Fix                                                      |
| ------------------------------------ | -------------------------------- | -------------------------------------------------------- |
| Too many unique materials            | High draw calls, low FPS         | Merge into texture atlases, reuse materials              |
| Non-power-of-two textures            | Memory bloat, visual artifacts   | Resize all textures to 256/512/1024/2048                 |
| Creating/destroying entities rapidly | Frame stutters                   | Use entity pooling                                       |
| Heavy computation every frame        | Consistent low FPS               | Add timer guards, reduce frequency                       |
| Unused colliders on decorations      | Physics body limit exceeded      | Remove MeshCollider from non-interactive objects         |
| Large uncompressed textures          | Slow loading, file size exceeded | Use WebP, reduce resolution, use atlases                 |
| Too many transparent materials       | Extra draw calls, sorting issues | Minimize transparency, use alpha cutoff instead of blend |
| Adding entities/components in a system without guards | Entity count explodes | Systems run every frame — always check before creating  |
| Unbounded entity queries             | CPU spike                        | Filter with specific components, cache results           |
| All detail loaded at all distances   | Triangle budget blown            | Implement LOD system                                     |
| No asset preloading                  | Pop-in during gameplay           | Use AssetLoad for large models and audio                 |

## Scene Statistics Monitoring

### In Preview Mode

When running the scene locally with `npm run start`:

- Press **P** to toggle the performance panel.
- Monitor: FPS, draw calls, triangles, entities, materials, textures, memory.
- Scene limits are shown alongside current usage with green/yellow/red indicators.

### What to Watch

- **FPS below 30**: Something is too expensive. Check draw calls and system execution time.
- **Triangle count approaching limit**: Enable LOD, reduce model detail, remove hidden faces.
- **Entity count climbing**: Likely a leak — entities being created but never destroyed. Implement pooling.
- **Draw calls above 300 (1 parcel)**: Too many materials. Merge, atlas, and reduce transparency.

## Recommended Optimization Tools

| Tool                        | Purpose                                                   |
| --------------------------- | --------------------------------------------------------- |
| Blender Decimate modifier   | Reduce triangle count on imported models                  |
| Blender Limited Dissolve    | Remove unnecessary vertices from flat surfaces            |
| Squoosh (squoosh.app)       | Convert images to WebP, resize to power-of-two            |
| TexturePacker               | Create texture atlases from multiple images               |
| gltf-transform CLI          | Compress GLB files with Draco, strip unused data          |
| glTF Validator              | Check for export errors before importing into DCL         |
| Creator Hub Scene Inspector | Visual tool for entity counts, triangle counts, placement |
| Preview Debug Panel (P key) | Live performance metrics during `npm run start`           |

```bash
# Optimize a GLB with Draco compression
npx @gltf-transform/cli optimize input.glb output.glb --compress draco
```

## Cross-References

- **add-3d-models** — model loading, colliders, and file organization
- **game-design** — performance budgets, design patterns, and MVP planning
- **advanced-rendering** — texture modes, material reuse, and LOD with VisibilityComponent
