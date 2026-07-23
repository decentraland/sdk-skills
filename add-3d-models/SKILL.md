---
name: add-3d-models
description: Add 3D models (.glb/.gltf) to a Decentraland scene using GltfContainer, including 8,800+ free assets from the OpenDCL catalog. Use when the user wants to add models, import GLB files, find free 3D assets, or set up model colliders. Do NOT use for materials/textures (see advanced-rendering) or model animations (see animations-tweens).
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

Decentraland uses a **Y-up** coordinate system — test model orientation after import: a model exported Z-up (common from Blender) loads tipped over and must be re-exported with "Y Up".

## RULE: Text labels must be in open air — no occlusion by geometry

`TextShape` labels are rendered in world space and can be occluded by solid geometry. Place labels with no solid model within 2 m horizontally, ensure height clearance, use `Billboard` with `billboardMode: 2` for readable labels, and prefer open-area placement. Exception: labels mounted on a wall without Billboard.

## RULE: Use composite for initial models

**Always add models that exist at scene load to `assets/scene/main.composite`, not in TypeScript.** Only use TypeScript for models spawned dynamically at runtime. Use `visibleMeshesCollisionMask: 3, invisibleMeshesCollisionMask: 0` when the model has **no `_collider` meshes** (common case). Use `visibleMeshesCollisionMask: 0, invisibleMeshesCollisionMask: 3` when it has `_collider` meshes. Never set both to non-zero simultaneously.

To add behavior to a composite model, fetch it in `index.ts` by name or tag — do NOT re-create it.

## RULE: Swapping a model `src` requires fresh Transform — never inherit scale/position

When you change the `src` of an existing `GltfContainer` (in a composite, in code, or via builder asset replacement), the entity's existing `Transform.scale`, `Transform.position`, and often `rotation` were tuned for the **previous model's native dimensions and pivot**. They are almost never correct for the new model — applying them blindly can produce buildings that overshoot scene bounds, props at wrong heights, or models visibly shifted from where the user expected them.

Treat every model swap as fresh placement:

1. **Look up the new GLB's native bounding box** — use the bounding box script in `{baseDir}/references/model-patterns.md` (raw accessor `min`/`max` is not sufficient; node-level scale/translation must be applied).
2. **Recompute `scale`** so the world-space size (native size × scale) is sensible for the role. Do not carry over the previous entity's scale — it was calibrated against a different native size.
3. **Verify pivot location.** Many architecture/building GLBs have pivots at a corner (e.g. `(0,0,0)` at one base corner), not the center. Two models with the same `position` but different pivots will visually shift after the swap.
4. **Verify the resulting world-space bounding box stays inside scene bounds.** Each parcel is 16 × 16 m horizontally; max height is `log2(parcels+1) × 20 m` (1 parcel → 20 m, 4 parcels → 46 m, 9 parcels → 66 m — see `{baseDir}/../optimize-scene/SKILL.md`). Compute `position +/- bbox` against scene `[0, maxX] × [0, maxZ]` and `y <= maxHeight`.
5. **State the audit explicitly.** After a swap, the agent must report: native dimensions of the new GLB, chosen scale, chosen position, and the resulting world-space bounding box vs. scene bounds. Do not silently keep the prior Transform.

This applies equally to code (`GltfContainer.createOrReplace(entity, { src: '...' })` while leaving Transform untouched) and to composite edits where only the `core::GltfContainer.data["<id>"].json.src` was modified.

**Runtime swap mechanics**: to change a model in place, mutate the field directly — `GltfContainer.getMutable(entity).src = newSrc` — the engine reloads the GLB on the same entity. Other `GltfContainer` fields (e.g. `visibleMeshesCollisionMask`) can also be mutated live the same way. Reusing the Transform is only safe when the two models share the same native size and pivot; otherwise re-audit per the steps above.

## RULE: When editing an existing composite, register new entities in `inspector::Nodes`

If `assets/scene/main.composite` already contains `inspector::Nodes` (the user has opened the scene in the Creator Hub at least once), every new entity you add MUST also be registered there or it will be **invisible in the Creator Hub entity tree** — the model still renders in-world, but the user cannot select/edit it from the editor. You also need a `core-schema::Name` entry and an `inspector::TransformConfig` entry for the new entity.

See the "Editing an existing composite (edit mode)" section of `{baseDir}/../composites/composite-reference.md` for the exact arrays to append to. Don't skip this when adding 3D models to an existing scene.

## RULE: Parenting a model to the player — pick by item type

When a `GltfContainer` entity needs to follow the player (held weapon, aiming reticle, cosmetic backpack, halo, torch), there are three SDK7 mechanisms and they are NOT interchangeable. **Default for aim-sensitive items: parent to `engine.CameraEntity`** — this is the most common porting mistake when coming from SDK6.

- **Aim-sensitive held item** (gun, aiming reticle, flashlight — anything the player should be able to point by looking around) → `Transform.create(entity, { parent: engine.CameraEntity, position: ..., ... })`. Follows camera yaw **+ pitch**, so the item points where the player is looking. This is the SDK7 analogue of SDK6's `Attachable.FIRST_PERSON_CAMERA`. **Recommended default for held gameplay items.**
- **Yaw-only / body-fixed item** (held shield not used for aim, static carried torch, non-aimed inventory item) → `Transform.create(entity, { parent: engine.PlayerEntity, position: ..., ... })`. Follows feet + body yaw only — no pitch, no animation. Wrong default for guns: a weapon parented to `PlayerEntity` stays flat when the player looks up to aim.
- **Cosmetic item** (hat, halo, backpack, name plate, decorative torch visible to other players) → `AvatarAttach.create(entity, { anchorPointId: AAPT_HEAD | AAPT_SPINE | AAPT_LEFT_HAND | ... })`. Follows the animated bone — the item visually moves with idle bob, walk cycle, and gestures. **Not for aim** (animation jitter makes aim-sensitive items unusable).

Using a bone anchor like `AAPT_RIGHT_HAND` for a gun **looks** correct ("put the gun in the hand") but the hand bone is animated — the gun jitters every frame and is unaimable. This is a porting trap when coming from SDK6's `Attachable.FIRST_PERSON_CAMERA` pattern; the correct SDK7 mapping is `engine.CameraEntity`, NOT `AvatarAttach` and NOT `engine.PlayerEntity` (which loses pitch).

See [[player-avatar]] (Held items vs cosmetic items) for the full comparison and a worked gun example. For SDK6 porting context, see [[migrate-sdk6-to-sdk7]].

## RULE: Always check for animations

Before finalizing any entity with `GltfContainer`, check if the GLB contains animations. **If it has animations**, always add an `Animator` component. Without it the engine silently loops the first clip forever. **If no animations**, omit `Animator`.

## RULE: Always check for built-in colliders

Check whether the GLB contains `_collider` meshes (mesh or node name includes `_collider`). Use the collider detection script in `{baseDir}/references/model-patterns.md`.

### Two correct patterns — pick one, never mix

**Model HAS `_collider` meshes**: `visibleMeshesCollisionMask: 0, invisibleMeshesCollisionMask: 3`

**Model has NO `_collider` meshes**: `visibleMeshesCollisionMask: 3, invisibleMeshesCollisionMask: 0`

Choose the mask based on role:

| Role                    | visibleMeshesCollisionMask | Why                    |
| ----------------------- | -------------------------- | ---------------------- |
| Interactive (clicks)    | `3`                        | Physics + pointer      |
| Structural / decorative | `3`                        | Block walking + clicks |
| Clickable-only, no bulk | `1`                        | Detect clicks only     |
| Purely decorative       | `0`                        | No interaction         |

**Anti-pattern — DO NOT USE**: `visibleMeshesCollisionMask: 2, invisibleMeshesCollisionMask: 3` — mixes both patterns and causes pointer detection failures.

## RULE: Always validate entity positions against parcel bounds

**Entities entirely outside scene parcels are not rendered** — no error shown; a model that straddles the boundary still renders the part that is inside. Each parcel is **16x16 m**. Valid range: `0 <= x <= 16 * parcelsWide`, `0 <= z <= 16 * parcelsDeep`, `y >= 0`.

## Loading a 3D Model in TypeScript (dynamic entities only)

Use `GltfContainer.create(entity, { src: 'assets/Models/myModel.glb' })` for runtime-spawned entities. Place files in `assets/Models/`.

### Asset folder conventions

- **Default** for models you download yourself: `assets/Models/`.
- **Legacy scenes** may already have models under `assets/scene/Models/` — that path still works; reuse it for any new models in those scenes instead of creating a parallel `assets/Models/` folder.
- **Creator Hub assets**: when the user adds models through the Creator Hub UI they land in `assets/asset-packs/` (free DCL packs) or `assets/custom/` (user-imported) or `assets/scene/` (user-imported). Reference these paths as-is — never move or rename them.

Always check the scene's existing folders before deciding where to put a new model.

## Free 3D Models — OpenDCL Catalog (8,800+ models)

Always check the scene's local asset folder first. Before fetching any model, confirm with the user.

The catalog is at `{baseDir}/references/model-catalog.md`. Search with `grep -i "keyword"`. Try synonyms if no results. Browse categories with `grep "^##"`.

**Workflow**: Search catalog → review dimensions/triangles/animations → download with curl into `assets/Models/` → reference in code → add Animator if model has animations.

> **Important**: `GltfContainer` only works with **local files**. Always download into `assets/Models/` first. Never `cd` into the models directory — run curl from the project root.

## Troubleshooting

| Problem                     | Cause                          | Solution                                                     |
| --------------------------- | ------------------------------ | ------------------------------------------------------------ |
| Model not visible           | Wrong file path                | Verify path relative to project root                         |
| Model not visible           | Outside scene boundaries       | Check position is within 0-16 per parcel                     |
| Model not visible           | Scale is 0 or very small       | Check `Transform.scale`                                      |
| Model loads but looks wrong | Y-up vs Z-up mismatch          | Re-export from Blender with "Y Up"                           |
| "FINISHED_WITH_ERROR"       | Corrupted .glb                 | Re-export as `.glb` (binary GLTF)                            |
| Clicking does nothing       | CL_POINTER not set             | Set `visibleMeshesCollisionMask: 3` if no `_collider` meshes |
| Click through walls         | CL_POINTER not on visible mesh | Set `visibleMeshesCollisionMask: 3` (or at minimum `1`)      |

## Model Best Practices

- Keep models under 50MB per file for good loading times
- Use `.glb` format (binary GLTF) — smaller than `.gltf`
- Optimize triangle count: aim for under 1,500 triangles per model for small props
- Use texture atlases when possible to reduce draw calls
- Materials in models should use PBR for best results

For full code examples (loading, colliders, operations, catalog workflow), see `{baseDir}/references/model-patterns.md`. For the asset catalog (8,800+ models), see `{baseDir}/references/model-catalog.md`.

## Example scenes

Engine-team test scenes exercising these APIs against the real runtime:

- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/54,-55-Testing-3d-models — many GLB variants loaded via `GltfContainer` (draco, morph targets, rigged animation, external-dep models); note it uses the `models/` folder, not `assets/Models/`.
- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/3,33-gltf-container-update — swapping a live model's `src` and mutating `visibleMeshesCollisionMask` via `GltfContainer.getMutable()` (Book↔Monster on click; ray-cast against `CL_CUSTOM1`).
- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/88,-12-asset-load — preloading GLB/audio/texture/video with the `AssetLoad` component and per-asset load-state callbacks; also lazy-spawns a model with `GltfContainer.getOrCreateMutable()` on click.
