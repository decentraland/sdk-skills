---
name: composites
description: "Reference for the Decentraland `.composite` JSON format that declares the initial entities of a scene in `assets/scene/main.composite`. Use when authoring a main.composite from scratch, or when editing one by hand because the Creator Hub MCP is not available (see creator-hub-mcp — the MCP is always preferred for an existing scene). For scaffolding a whole scene project see create-scene."
---

# Composites

The mandatory workflow below applies to EVERY composite you author or edit: check the Creator Hub MCP gate first, compute scene bounds (Step 0), consult the format catalog in the reference while writing entities, then run the validation gate at the end before finishing.

## Gate — use the Creator Hub MCP instead of editing the file (check FIRST)

**Hand-editing `main.composite`, `main.crdt` or `scene.json` is the fallback, not the default.** If a Creator Hub is involved, pick your row of the decision ladder in **creator-hub-mcp** → *RULE — the MCP is the way to change the scene graph* first. The file workflow below applies in full only on its "No Creator Hub in play" row (CLI-only project, CI, the app closed by choice), or after the user declines the MCP and closes the scene.

When you do work through the MCP tools, this skill still applies in two ways: the format catalog in the reference is your guide to component shapes (`set_component` takes the same JSON the composite stores), and Step 0 (bounds) still applies.

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

**How to find a model's bounding box:** run the bounding-box script in `{baseDir}/../add-3d-models/references/model-patterns.md` → *Bounding Box Calculation Script*. It applies node-level transforms (raw accessor `min`/`max` alone are not reliable: a model whose accessors say 0.6 m can carry a 24× node scale and render at 14 m), and its safe-zone formula converts the printed glTF extents to DCL axes (the engine mirrors glTF X).

**Measure per model.** Extents vary widely: a typical tree can reach ~11 m from its origin in one horizontal direction, while a column reaches under 1 m in every direction. Place a model only where its whole box, plus a margin of at least 1 m, fits inside `[0, maxX]` × `[0, maxZ]`.

**Placing architecture: budget for third-person scale, not realistic scale.** Oversized rooms change how much parcel area a floorplan needs, so size them at bounds time. The dimensions are in **add-3d-models** → "RULE: Scale interiors up for the third-person camera".

### Examples

| scene.json parcels          | parcelsWide | parcelsDeep | Valid X | Valid Z |
| --------------------------- | ----------- | ----------- | ------- | ------- |
| `["0,0"]`                   | 1           | 1           | 0 – 16  | 0 – 16  |
| `["0,0","1,0"]`             | 2           | 1           | 0 – 32  | 0 – 16  |
| `["0,0","1,0","0,1","1,1"]` | 2           | 2           | 0 – 32  | 0 – 32  |

### Never change scene.json parcel count without explicit user instruction

**If the design needs more space than the parcels allow, ask the user whether to add parcels.** Don't add them silently, and don't compress the design (stacking rooms vertically, shrinking them below third-person scale) to avoid asking. Adding parcels to `scene.json` is not always an option, it depends where the scene will be published to. If publishing to Genesis City, parcels must be **owned or rented** by the deploying wallet; if publishing to a World, it might be an option. If the user declines, **work within the existing parcel bounds and make the scene as rich as possible within them**.

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
- [ ] All positions within parcel bounds — bounds were calculated in **Step 0** from the actual `scene.json` parcel list. Every entity's X is in `[0, maxX]` and Z is in `[0, maxZ]`. Negative values and values above maxX/maxZ do not render. If the user requested a "large" scene but parcel count was not changed, all entities fit within the original bounds.
- [ ] For every `GltfContainer` entity: checked whether the GLB contains animations (clip names embedded in the file). If it does, either a `core::Animator` names the clip to play, or looping the file's first clip from load is what you want: with no Animator the renderer autoplays and loops clip 0 and code cannot control it (**animations-tweens**).
- [ ] For every `GltfContainer` entity: checked whether the GLB contains collision meshes (any mesh whose name includes the string `_collider`) and set the masks per **add-3d-models** → *Always check for built-in colliders*: with them, `visibleMeshesCollisionMask: 0`, `invisibleMeshesCollisionMask: 3` (CL_POINTER + CL_PHYSICS). Without them, either `visibleMeshesCollisionMask: 3` or a `core::MeshCollider` box/sphere covering the model's rough shape where it must be walkable, block walking, or be clickable.
- [ ] If `asset-packs::Actions`, `asset-packs::Triggers`, or `asset-packs::States` exist anywhere in the composite, then `asset-packs::Counter` must exist on entity 0, with `value` = the highest `id` used inside any Actions/Triggers/States data (it is the id allocator for those ids)
- [ ] No `{self}`, `{assetPath}`, or placeholder strings — all resolved to concrete values
- [ ] Component names use base names (e.g., `asset-packs::Actions`, not `asset-packs::Actions-v1`). Never use versioned suffixes like `-v3`.
- [ ] No extra library is needed, even for `asset-packs::*` components: the build falls back to the `@dcl/asset-packs` copy bundled inside `@dcl/inspector` when the scene does not declare it (`@dcl/sdk` 7.15.1+; on an older pin add `@dcl/asset-packs` as a project dependency)

### Edit-mode checklist (composite already contains `inspector::*`)

- [ ] **The Creator Hub MCP is NOT available.** If its tools are in the session, stop here and use them: `create_entity` / `set_component` do every item below for you (see the Gate).
- [ ] **The scene is NOT currently open in the Creator Hub — checked again before *every* write to `main.composite` or `scene.json`, not once per session**: the owner can reopen it at any time, and its autosave reverts external edits. Ask the user to close the scene before you write and to reopen it afterwards. Open, with no MCP: stop and ask (**sdk-scenes** → Agent Behavioral Guidelines, item 5, which also lists the signs that the scene is open).

For every NEW entity `<id>` you add, in addition to the authoring-from-scratch rules above (with the relaxation that `inspector::*` etc. are kept, not stripped):

- [ ] `<id>` has been appended to the **end** of the `children` array of the entity-`0` entry inside `inspector::Nodes.data["0"].json.value`.
- [ ] A new entry `{ "entity": <id>, "children": [...] }` has been appended to the `value` array of `inspector::Nodes.data["0"].json` (use `[]` if the entity has no children of its own).
- [ ] If `<id>`'s `Transform.parent` is not `0`, then `<id>` is in the parent entity's `children` array (not the root's).
- [ ] `core-schema::Name.data["<id>"]` has a `{ "json": { "value": "..." } }` entry — names are required for the entity to appear correctly in the entity tree and to be looked up by code.
- [ ] `inspector::TransformConfig.data["<id>"]` has a `{ "json": {} }` entry (empty object is fine).
- [ ] `entity-names.ts` is either updated to include the new name (in `EntityNames`) OR left untouched so the Creator Hub regenerates it on next save. Do NOT hand-edit the auto-generated header.
- [ ] You did NOT delete or strip pre-existing `inspector::Nodes`, `inspector::SceneMetadata-*`, `inspector::Selection`, `inspector::TransformConfig`, `composite::root`, or `asset-packs::ActionTypes`. These are managed by the Creator Hub and must stay.
- [ ] `inspector::SceneMetadata-*` is unchanged unless `scene.json` parcels changed (in which case the layout block must match `scene.json`).
- [ ] Reserved entities `1` (PlayerEntity) and `2` (CameraEntity) are still present in `inspector::Nodes` as their own top-level `{ "entity": 1, "children": [] }` / `{ "entity": 2, "children": [] }` entries. They are **separate tree roots** — they must NOT appear inside entity `0`'s `children` array (or any other `children` array).

**Verification command (edit mode):** after editing, every entity ID present in `core::Transform.data` should also appear:

1. As a top-level `{ "entity": <id>, ... }` entry in `inspector::Nodes.data["0"].json.value`, AND
2. In exactly one `children` array within that same `value` list (its parent's children).

Entities `0`, `1`, and `2` are the exception to rule 2 — they are tree roots and appear in no `children` array.

Missing entries here are the root cause of "entity renders but is invisible in the Creator Hub entity tree".

## Post-Write Validation

After writing the composite, **run the SDK build** to verify:

```bash
npx sdk-commands build
```

The build must pass with zero errors. If it fails, the composite is invalid. Common errors:

- `Composite references undefined component "X"…` (older SDKs: `X is not defined and there is no schema to define it`) → missing `jsonSchema` on non-core component, or `inspector::*` component that shouldn't be there
- TypeScript errors → fix generated scripts
- An error naming a file you never meant to ship (`Composite 'art/.../before.composite' can't be read`, or a schema error from a backup) → the build globs **every** `*.composite` under the project, including recovery copies. Store backups with another extension (`before-composite.json`) or outside the project, and check the `.composite:` list in the build's debug output; a deploy ignore rule does not hide a file from the build.
- A schema error on an `inspector::*` component → you wrote an inspector component the file did not already have. Add entries only to inspector components already present (e.g. `inspector::TransformConfig`), copying their exact shape.
