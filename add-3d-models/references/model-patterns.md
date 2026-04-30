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

Safe placement zone calculation:
```
safeMinX = -bbox.minX + edgeMargin (>=1 m)
safeMinZ = -bbox.minZ + edgeMargin (>=1 m)
safeMaxX = sceneMaxX - bbox.maxX - edgeMargin
safeMaxZ = sceneMaxZ - bbox.maxZ - edgeMargin
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
