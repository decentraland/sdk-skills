---
name: composites
description: "Reference for the Decentraland `.composite` JSON format that declares the initial entities of a scene in `assets/scene/main.composite`. Use when creating or editing a main.composite file, or when other skills point to the composite reference. For scaffolding a whole scene project see create-scene."
---

# Composites

This skill carries the shared composite format reference used by other Decentraland skills (`create-scene`, `add-3d-models`, `sdk-scenes`).

The mandatory workflow below applies to EVERY composite you author or edit: compute scene bounds first (Step 0), consult the format catalog in the reference while writing entities, then run the validation gate at the end before finishing.

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

**Measure per model — don't guess or hard-code.** Extents vary wildly: running the script above on a typical tree often reveals ~11 m of reach in one horizontal direction from the origin (safe minimum origin z≥12), while a column reaches under 1 m in every direction. Always compute the box for the specific GLB you're placing.

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

## Composite format catalog (reference)

Read `{baseDir}/composite-reference.md` for the full specification of the `main.composite` JSON format: the JSON structure and `jsonSchema` rules, entity ID allocation, the per-component format catalog (`core::Transform`, `core::GltfContainer`, … `core::NftShape`), the component-grouping pattern, edit-mode rules (`inspector::Nodes`), runtime spawning, and patterns for fetching composite entities from TypeScript.

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
- [ ] If `asset-packs::Actions`, `asset-packs::Triggers`, or `asset-packs::States` exist anywhere in the composite, then `asset-packs::Counter` must exist on entity 0, with `value` = the highest `id` used inside any Actions/Triggers/States data (it is the id allocator for those ids)
- [ ] No `{self}`, `{assetPath}`, or placeholder strings — all resolved to concrete values
- [ ] Component names use base names (e.g., `asset-packs::Actions`, not `asset-packs::Actions-v1`). Never use versioned suffixes like `-v3`.
- [ ] A composite using only core components needs no extra library. If it contains `asset-packs::*` components, older SDKs require `@dcl/asset-packs` as a project dependency; current SDKs fall back to the copy bundled inside `@dcl/inspector`

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

- `Composite references undefined component "X". Ensure provider.schemas was registered pre-seal via setCompositeProvider().` (older/released SDKs word this as `"X is not defined and there is no schema to define it"`) → missing `jsonSchema` on non-core component, or `inspector::*` component that shouldn't be there
- TypeScript errors → fix generated scripts
