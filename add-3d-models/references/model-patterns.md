# 3D Model Patterns & Code Examples

## Bounding Box Calculation Script

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

**The `World min`/`max` this prints are glTF axes, not DCL axes.** Decentraland mirrors the glTF X axis (verified in both renderers — see [`blender-authoring.md`](blender-authoring.md)), so convert before comparing against scene bounds: `dclMinX = -gltfMaxX`, `dclMaxX = -gltfMinX`; Y and Z carry over unchanged. This matters for every model that isn't symmetric in X: its extents land on the opposite side of the origin from where the glTF numbers put them. Baked-placement models get it worst, since the whole mesh can land outside the scene (axis section in [`blender-authoring.md`](blender-authoring.md)).

Safe placement zone calculation, in DCL axes:
```
safeMinX = -dclMinX + edgeMargin (>=1 m)      # dclMinX = -gltfMaxX
safeMaxX = sceneMaxX - dclMaxX - edgeMargin   # dclMaxX = -gltfMinX
safeMinZ = -minZ + edgeMargin (>=1 m)         # Z as printed
safeMaxZ = sceneMaxZ - maxZ - edgeMargin
```

## Collider Detection Script

```js
node -e "
const buf = require('fs').readFileSync('assets/Models/myModel.glb');
const jsonLen = buf.readUInt32LE(12);
const json = JSON.parse(buf.slice(20, 20+jsonLen));
const meshHas = json.meshes?.some(m => m.name && m.name.includes('_collider'));
const nodeHas = json.nodes?.some(n => n.name && n.name.includes('_collider') && n.mesh !== undefined);
const hasCollider = meshHas || nodeHas;
console.log(hasCollider ? 'HAS _collider meshes' : 'NO _collider meshes');
"
```

## Loading a 3D Model in TypeScript

```typescript
import { engine, Transform, GltfContainer } from '@dcl/sdk/ecs'
import { Vector3, Quaternion } from '@dcl/sdk/math'

const model = engine.addEntity()
Transform.create(model, {
  position: Vector3.create(8, 0, 8),
  rotation: Quaternion.fromEulerDegrees(0, 0, 0),
  scale: Vector3.create(1, 1, 1),
})
GltfContainer.create(model, {
  src: 'assets/Models/myModel.glb',
})
```

## File Organization

```
project/
├── assets/
│   └── scene/
│       └── Models/
│           ├── building.glb
│           ├── tree.glb
│           └── furniture/
│               ├── chair.glb
│               └── table.glb
├── src/
│   └── index.ts
└── scene.json
```

## Animator (for models with animations)

### TypeScript
```typescript
import { Animator } from '@dcl/sdk/ecs'

Animator.create(model, {
  states: [
    { clip: 'idle', playing: true, loop: true },
    { clip: 'walk', playing: false, loop: true },
  ],
})
```

### Composite (core::Animator)
```json
{
  "name": "core::Animator",
  "data": {
    "512": {
      "json": { "states": [{ "clip": "idle", "playing": true, "loop": true }] }
    }
  }
}
```

## Collider Patterns

### Model HAS `_collider` meshes
```typescript
GltfContainer.create(model, {
  src: 'assets/Models/building.glb',
  visibleMeshesCollisionMask: 0,
  invisibleMeshesCollisionMask: 3,
})
```

### Model has NO `_collider` meshes
```typescript
GltfContainer.create(model, {
  src: 'assets/Models/building.glb',
  visibleMeshesCollisionMask: 3,
  invisibleMeshesCollisionMask: 0,
})
```

## Common Operations

### Scaling
```typescript
Transform.create(model, {
  position: Vector3.create(8, 0, 8),
  scale: Vector3.create(2, 2, 2),
})
```

### Rotation
```typescript
Transform.create(model, {
  position: Vector3.create(8, 0, 8),
  rotation: Quaternion.fromEulerDegrees(0, 90, 0),
})
```

### Parenting
```typescript
const parent = engine.addEntity()
Transform.create(parent, { position: Vector3.create(8, 0, 8) })

const child = engine.addEntity()
Transform.create(child, {
  position: Vector3.create(0, 2, 0),
  parent: parent,
})
GltfContainer.create(child, { src: 'assets/Models/hat.glb' })
```

### Get Global (World-Space) Position and Rotation
```typescript
import { getWorldPosition, getWorldRotation } from '@dcl/sdk/ecs'

const worldPos = getWorldPosition(engine, childEntity)
const worldRot = getWorldRotation(engine, childEntity)
```

## Composite GltfContainer Example

```json
{
  "name": "core::GltfContainer",
  "data": {
    "512": {
      "json": {
        "src": "assets/asset-packs/tree_forest_01/Tree_Forest_01.glb",
        "visibleMeshesCollisionMask": 0,
        "invisibleMeshesCollisionMask": 3
      }
    }
  }
}
```

## OpenDCL Catalog Workflow

### Search
```bash
grep -i "zombie" {baseDir}/references/model-catalog.md
```

### Browse categories
```bash
grep "^##" {baseDir}/references/model-catalog.md
```

### Download and use
```bash
curl -o assets/Models/zombie-purple.glb "https://models.dclregenesislabs.xyz/blobs/bafybeiffc..."
```

```typescript
const zombie = engine.addEntity()
Transform.create(zombie, { position: Vector3.create(8, 0, 8) })
GltfContainer.create(zombie, { src: 'assets/Models/zombie-purple.glb' })
Animator.create(zombie, {
  states: [
    { clip: 'ZombieWalk', playing: true, loop: true },
    { clip: 'ZombieAttack', playing: false, loop: false }
  ]
})
```

## Creator Hub Asset-Pack Catalog Workflow

The latest Creator Hub asset-pack additions (420 models + 7 Smart Items from the Genesis Plaza and template-scene imports) are listed in `{baseDir}/references/asset-pack-catalog.md`, same row style as the OpenDCL catalog. Older pack items are not catalogued offline — search them live with `search_catalog` when the Creator Hub MCP is available.

### Search both catalogs at once
```bash
grep -i "lamp post" {baseDir}/references/asset-pack-catalog.md {baseDir}/references/model-catalog.md
grep "^##" {baseDir}/references/asset-pack-catalog.md   # packs / categories
```

### Download an item (several files: GLB + external textures)
Asset-pack GLBs reference their textures as separate files, so a single `curl` of the GLB gives an untextured model. Save this helper in the scene root (or your scratch dir) and run it from the scene root with the `id:` from the catalog row — it fetches the live catalog (`https://builder-items.decentraland.org/asset-packs/latest/catalog.json`), then every file of the item into `assets/asset-packs/<folder>/…`, the same folder the Creator Hub uses, so the scene looks identical whichever path imported it. Works for any asset id in the packs, not only the catalogued ones. Node 18+ (bundled with every SDK7 project).

```javascript
// dl-asset.mjs — download Creator Hub asset-pack items by id. Run from the scene root:
//   node dl-asset.mjs <asset-id> [<asset-id> ...]
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
const BASE = 'https://builder-items.decentraland.org'
const SKIP = new Set(['thumbnail.png', 'preview.webp'])
const { assetPacks } = await (await fetch(`${BASE}/asset-packs/latest/catalog.json`)).json()
for (const id of process.argv.slice(2)) {
  const asset = assetPacks.flatMap((p) => p.assets).find((a) => a.id === id)
  if (!asset) { console.error(`no catalog asset with id ${id}`); continue }
  const dir = `assets/asset-packs/${asset.name.trim().replaceAll(' ', '_').toLowerCase()}` // same folder the Creator Hub uses
  for (const [rel, hash] of Object.entries(asset.contents)) {
    if (SKIP.has(rel)) continue
    const res = await fetch(`${BASE}/contents/${hash}`)
    if (!res.ok) throw new Error(`${rel}: HTTP ${res.status}`)
    const out = `${dir}/${rel}`
    await mkdir(dirname(out), { recursive: true })
    await writeFile(out, Buffer.from(await res.arrayBuffer()))
    console.log(out)
  }
}
```

```bash
node dl-asset.mjs 35cbea0a-1b00-5c58-899d-34299b8da185   # Photo Building → assets/asset-packs/photo_building/photo_building/photo_building.glb
```

Then reference the `glb:` path from the catalog row, with the collider mask the row's `col:` field dictates (`col:yes` → `visibleMeshesCollisionMask: 0, invisibleMeshesCollisionMask: 3`; `col:no` → `3 / 0`), and an `Animator` when the row lists `[anim: …]`. Origins sit at the centre of the footprint at ground level unless the row carries a `bbox:` field. Delete `dl-asset.mjs` before deploying, or keep it out of the scene folder.

**Smart Items** from this catalog (`SMART ITEM` rows) are scripted (`asset-packs::Script`): with the Creator Hub MCP, `place_smart_item` the id — it downloads the files and wires the Script/Config components. Without it, the helper fetches the files (including `composite.json` and the `.ts` script) and you copy the item's `composite` from the live catalog JSON into `main.composite` as described in **composites** → "Editing an existing composite". The two water items have no real model: their GLB is an editor-only placeholder and `Water.ts` builds the surface at runtime.

## Checking Model Load State

```typescript
import { GltfContainer, GltfContainerLoadingState, LoadingState } from '@dcl/sdk/ecs'

engine.addSystem(() => {
  const state = GltfContainerLoadingState.getOrNull(modelEntity)
  if (state && state.currentState === LoadingState.FINISHED) {
    console.log('Model loaded successfully')
  } else if (state && state.currentState === LoadingState.FINISHED_WITH_ERROR) {
    console.log('Model failed to load')
  }
})
```

`LoadingState` values: `UNKNOWN`, `LOADING`, `FINISHED`, `FINISHED_WITH_ERROR`, `NOT_FOUND` (missing file — distinct from `FINISHED_WITH_ERROR`, which is a corrupt/failed asset).

## Preloading Assets (AssetLoad)

`AssetLoad` starts loading a list of assets (GLB, textures, audio, video) before they are used, so they appear instantly when first referenced. `assetLoadLoadingStateSystem` reports per-asset load state via a callback.

```typescript
import { AssetLoad, LoadingState, assetLoadLoadingStateSystem } from '@dcl/sdk/ecs'

const loader = engine.addEntity()
AssetLoad.getOrCreateMutable(loader, {
  assets: ['assets/Models/chicken.glb', 'assets/Images/Logo.png'],
})

// Optional: react to each asset's state change
assetLoadLoadingStateSystem.registerAssetLoadLoadingStateEntity(loader, (state) => {
  // state.asset is the path; state.currentState is a LoadingState
  if (state.currentState === LoadingState.FINISHED) console.log('loaded', state.asset)
})
```

- `assets` is a `string[]` of asset paths; you can push more paths onto a mutable `AssetLoad.assets` after creation to preload additional assets.
- The callback fires once per asset per state transition; `state.asset` matches the path string exactly (useful for mapping back to an entity).
- Preloading does not place anything in the world — you still create the `GltfContainer` / `Material` / `AudioSource` etc. when you actually want the asset shown.
