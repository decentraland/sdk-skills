---
name: add-3d-models
description: Add 3D models (.glb/.gltf) to a Decentraland scene using GltfContainer. Covers loading, positioning, scaling, colliders, parenting, and browsing 8,800+ free assets from the OpenDCL model catalog. Use when the user wants to add models, import GLB files, find free 3D assets, or set up model colliders. Do NOT use for materials/textures (see advanced-rendering) or model animations (see animations-tweens).
---

# Adding 3D Models to Decentraland Scenes

## RULE: Check bounding boxes before placing models

**A model's `Transform.position` is its local origin, not its visual extent.** Vegetation and large structural models often extend 6-12 m beyond their origin. A tree placed at x=2 can render at x=-10 — outside scene bounds and invisible.

**Before placing any GLB model, determine its actual world-space bounding box.** Raw accessor `min`/`max` values are NOT sufficient — many models have large node-level scales baked in. You **must** account for node transforms. Use the bounding box script in `{baseDir}/references/model-patterns.md`.

Then compute the safe placement zone: `safeMinX = -bbox.minX + edgeMargin (>=1m)` etc. Place the origin only within the safe zone. **When bounding box is unknown**, use a conservative **12 m buffer from all edges** for trees/large foliage, or **3 m** for small props.

## RULE: Account for model depth before neighboring entities

Two models don't overlap just because their origins are different. Always verify that `origin +/- extent` doesn't intersect any neighbor's bounding box. Pay special attention to deep arch/gateway models (can extend 14 m in +/-Z) and rotated models (rotating 90deg around Y swaps X and Z extents).

## RULE: Single-sided models — orient the rendered face toward players

Many GLB models use back-face culling. The rendered face is typically toward local **-Z**. Y rotation transforms facing: 0deg -> south, 90deg -> east, 180deg -> north, 270deg -> west. When players approach from both sides, add a second copy rotated 180deg. Prefer double-sided geometry for elements visible from all angles.

## RULE: Text labels must be in open air — no occlusion by geometry

`TextShape` labels are rendered in world space and can be occluded by solid geometry. Place labels with no solid model within 2 m horizontally, ensure height clearance, use `Billboard` with `billboardMode: 2` for readable labels, and prefer open-area placement. Exception: labels mounted on a wall without Billboard.

## RULE: Use composite for initial models

**Always add models that exist at scene load to `assets/scene/main.composite`, not in TypeScript.** Only use TypeScript for models spawned dynamically at runtime. Use `visibleMeshesCollisionMask: 3, invisibleMeshesCollisionMask: 0` when the model has **no `_collider` meshes** (common case). Use `visibleMeshesCollisionMask: 0, invisibleMeshesCollisionMask: 3` when it has `_collider` meshes. Never set both to non-zero simultaneously.

To add behavior to a composite model, fetch it in `index.ts` by name or tag — do NOT re-create it.

## RULE: When editing an existing composite, register new entities in `inspector::Nodes`

If `assets/scene/main.composite` already contains `inspector::Nodes` (the user has opened the scene in the Creator Hub at least once), every new entity you add MUST also be registered there or it will be **invisible in the Creator Hub entity tree** — the model still renders in-world, but the user cannot select/edit it from the editor. You also need a `core-schema::Name` entry and an `inspector::TransformConfig` entry for the new entity.

See the "Editing an existing composite (edit mode)" section of `{baseDir}/../composites/composite-reference.md` for the exact arrays to append to. Don't skip this when adding 3D models to an existing scene.

## RULE: Always check for animations

Before finalizing any entity with `GltfContainer`, check if the GLB contains animations. **If it has animations**, always add an `Animator` component. Without it the engine silently loops the first clip forever. **If no animations**, omit `Animator`.

## RULE: Always check for built-in colliders

Check whether the GLB contains `_collider` meshes (mesh or node name includes `_collider`). Use the collider detection script in `{baseDir}/references/model-patterns.md`.

### Two correct patterns — pick one, never mix

**Model HAS `_collider` meshes**: `visibleMeshesCollisionMask: 0, invisibleMeshesCollisionMask: 3`

**Model has NO `_collider` meshes**: `visibleMeshesCollisionMask: 3, invisibleMeshesCollisionMask: 0`

Choose the mask based on role:

| Role | visibleMeshesCollisionMask | Why |
|------|---------------------------|-----|
| Interactive (clicks) | `3` | Physics + pointer |
| Structural / decorative | `3` | Block walking + clicks |
| Clickable-only, no bulk | `1` | Detect clicks only |
| Purely decorative | `0` | No interaction |

**Anti-pattern — DO NOT USE**: `visibleMeshesCollisionMask: 2, invisibleMeshesCollisionMask: 3` — mixes both patterns and causes pointer detection failures.

## RULE: Always validate entity positions against parcel bounds

**Entities outside scene parcels are not rendered** — no error shown. Each parcel is **16x16 m**. Valid range: `0 <= x <= 16 * parcelsWide`, `0 <= z <= 16 * parcelsDeep`, `y >= 0`.

## Loading a 3D Model in TypeScript (dynamic entities only)

Use `GltfContainer.create(entity, { src: 'assets/scene/Models/myModel.glb' })` for runtime-spawned entities. Place files in `assets/scene/Models/`.

## Free 3D Models — OpenDCL Catalog (8,800+ models)

Always check the scene's local asset folder first. Before fetching any model, confirm with the user.

The catalog is at `{baseDir}/references/model-catalog.md`. Search with `grep -i "keyword"`. Try synonyms if no results. Browse categories with `grep "^##"`.

**Workflow**: Search catalog → review dimensions/triangles/animations → download with curl into `assets/scene/Models/` → reference in code → add Animator if model has animations.

> **Important**: `GltfContainer` only works with **local files**. Always download into `assets/scene/Models/` first. Never `cd` into the models directory — run curl from the project root.

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| Model not visible | Wrong file path | Verify path relative to project root |
| Model not visible | Outside scene boundaries | Check position is within 0-16 per parcel |
| Model not visible | Scale is 0 or very small | Check `Transform.scale` |
| Model loads but looks wrong | Y-up vs Z-up mismatch | Re-export from Blender with "Y Up" |
| "FINISHED_WITH_ERROR" | Corrupted .glb | Re-export as `.glb` (binary GLTF) |
| Clicking does nothing | CL_POINTER not set | Set `visibleMeshesCollisionMask: 3` if no `_collider` meshes |
| Click through walls | CL_POINTER not on visible mesh | Set `visibleMeshesCollisionMask: 3` (or at minimum `1`) |

## Model Best Practices

- Keep models under 50MB per file for good loading times
- Use `.glb` format (binary GLTF) — smaller than `.gltf`
- Optimize triangle count: aim for under 1,500 triangles per model for small props
- Use texture atlases when possible to reduce draw calls
- Test model orientation — Decentraland uses Y-up coordinate system
- Materials in models should use PBR for best results

For full code examples (loading, colliders, operations, catalog workflow), see `{baseDir}/references/model-patterns.md`. For the asset catalog (8,800+ models), see `{baseDir}/references/model-catalog.md`.
