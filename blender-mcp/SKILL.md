---
name: blender-mcp
description: Edit and author 3D models for a Decentraland scene through the Blender MCP — low-poly modeling, PBR materials, palette textures, collider meshes, and GLB export back into the scene. Use whenever the user wants to edit, create, retexture, or optimize scene models with Blender, or whenever an `mcp__blender__*` tool is available and the task touches 3D models. Do NOT use for placing/positioning models in the scene (see add-3d-models) or SDK material components (see advanced-rendering).
---

# Editing Scene Models with the Blender MCP

Drive a running Blender instance through its MCP server to create and edit the GLB models of a Decentraland scene: import a model from the scene's asset folders, edit it, and export it back to the same path — the scene preview hot-reloads the file on save.

The connected `mcp__blender__*` tools are self-describing — each carries its name, arguments, and output shape. Treat that as the authoritative tool catalog. Most Blender MCP servers expose a handful of inspection tools (`get_scene_info`, `get_object_info`, `get_viewport_screenshot`) plus a Python executor (`execute_blender_code`) that runs arbitrary `bpy` code — the bulk of real work happens through `bpy`. Ready-made `bpy` snippets for the patterns below live in [`references/blender-patterns.md`](references/blender-patterns.md).

If no `mcp__blender__*` tools are available in the session, tell the user to start Blender with its MCP addon enabled and connect the server, then stop — do not simulate Blender edits by hand-writing GLB binary data.

## Workflow: round-trip through the scene folder

1. **Start clean.** Delete Blender's default startup objects (cube, light, camera) before importing anything.
2. **Import the model from the scene's asset folder** (`assets/Models/`, or wherever the scene keeps it — check first, see the asset folder conventions in **add-3d-models**): `bpy.ops.import_scene.gltf(filepath=...)`.
3. **Edit**, verifying visually with `get_viewport_screenshot` after significant steps.
4. **Run the pre-export checklist** (below), then **export back to the same path** as binary `.glb`. The dev server hot-reloads the file — no restart needed.
5. **Re-audit placement if the bounding box or pivot changed.** The entity's `Transform` was tuned for the old geometry; follow the model-swap audit in **add-3d-models** (native bounding box → scale → pivot → world-space bounds vs. scene limits).
6. **Keep working files out of the deploy.** If you save a `.blend` alongside the scene, add it to `.dclignore` (see **deploy-scene**) — source files are often the bulk of a project's size and are never needed at runtime.

## RULE: Keep models low-poly

Decentraland's triangle budget is **10,000 triangles per parcel** for the whole scene (see **optimize-scene** for all limits). Budget per model:

| Model role       | Triangles     |
| ---------------- | ------------- |
| Small props      | 100–500       |
| Medium objects   | 500–1,500     |
| Large buildings  | 1,500–5,000   |
| Hero pieces      | up to 10,000  |

- Model low-poly from the start; don't sculpt high and decimate as a routine (decimation is a rescue tool for imported models, not a workflow).
- Never leave Subdivision Surface, Multires, or dense Bevel modifiers on at export — if a modifier is doing visual work, keep its level low and remember `export_apply=True` bakes it into the exported mesh.
- Delete faces the player can never see (undersides, occluded backs of wall-mounted props); enable back-face culling instead of doubling geometry.
- **Count triangles before every export** (evaluated mesh, modifiers included — script in the references file) and report the number. Compare against the scene's remaining budget, not just the per-model guideline.

## RULE: All materials must be PBR (Principled BSDF)

The engine renders glTF **metallic-roughness PBR** materials only, and Blender's glTF exporter can only translate node setups built around a single **Principled BSDF** into that format. Anything else — Diffuse/Glossy/Mix shader graphs, procedural textures (Noise, Voronoi, gradients), texture nodes routed through color ramps — exports wrong or gets silently dropped.

- Every material: one Principled BSDF into the Material Output. Base Color, Metallic, Roughness, Normal, Emission, and Alpha translate cleanly.
- Procedural shading must be **baked to image textures** before export.
- Textures must be power-of-two and **at most 1024×1024** — the asset-bundle converter downscales anything larger, so authoring above 1024 wastes file size (see **optimize-scene**).
- Emissive surfaces: set Emission Color + Emission Strength on the Principled BSDF — this renders as expected in the engine.

## RULE: No lights or cameras in the export

The engine does not read lights or cameras from GLB files — they add file size and clutter for zero effect. Scene lighting is done through the SDK instead (see **lighting-environment**).

- Delete all light and camera objects before export (the default startup scene has one of each).
- Belt-and-braces: export with `export_cameras=False` and `export_lights=False`.
- If the user asks to "light the model" in Blender, explain that lighting must be done in the SDK and point them to **lighting-environment**; Blender lights only affect Blender's own viewport.

## RULE: Unify plain colors into one palette texture

Materials are one of the scarcest scene resources (**20 materials for a 1-parcel scene**, growing only logarithmically — see **optimize-scene**), and every extra material is an extra draw call. When a model (or a set of models) uses flat colors, do NOT create one material per color:

- Build a **single small palette texture** (e.g. 64×64 with a grid of color swatches), one material with that texture as Base Color, and UV-map each face to the center of its swatch. Use `Closest` interpolation so swatch edges don't bleed.
- **Share the same palette across all the scene's plain-colored models** — same texture file = one material and one texture engine-side.
- Adding a color later means filling an unused swatch, not adding a material.
- Full `bpy` scripts (build the palette image, assign faces to swatches) are in [`references/blender-patterns.md`](references/blender-patterns.md).

The same logic applies beyond plain colors: prefer one texture atlas over many small per-part textures.

## RULE: No materials on collider meshes

Collider meshes (name ending in `_collider`) are never rendered — the engine strips them to physics geometry. A material on a collider mesh still counts against the scene's material limit and bloats the file for zero visual effect.

- Clear all material slots on every `_collider` mesh before export (`obj.data.materials.clear()`).
- Keep colliders ultra-low-poly: boxes, planes, or convex hulls approximating the visible shape — never a copy of the detailed mesh.
- Name them `<meshName>_collider` and keep them in the export; the entity then needs `visibleMeshesCollisionMask: 0, invisibleMeshesCollisionMask: 3` on its `GltfContainer` (see **add-3d-models** for the mask patterns).
- Simple props often don't need a collider mesh at all — colliding on the visible mesh (`visibleMeshesCollisionMask: 3`) is fine when the visible mesh is already low-poly.

## RULE: Stay within scene limits

Before exporting, check what the model adds against the scene's budget (formulas and full table in **optimize-scene**; `n` = parcel count):

- **Triangles**: `n × 10,000` scene-wide — count the evaluated mesh before export.
- **Materials**: `log2(n+1) × 20` scene-wide — merge, use the palette pattern, reuse textures across models.
- **Textures**: `log2(n+1) × 10` scene-wide — power-of-two, ≤1024×1024.
- **File size**: 15 MB per parcel, 50 MB max per file — keep GLBs well under this; textures are usually the culprit.
- **Height**: `log2(n+1) × 20` m — a tall model can break the height limit even when its origin sits at y=0.

These are soft limits (except file size) — exceeding them hurts performance but does not block publishing. When a model pushes the scene over, say so and propose reductions rather than silently exporting.

## Pre-export checklist

Run through this before every export (scripts for each check in [`references/blender-patterns.md`](references/blender-patterns.md)):

1. Triangle count verified against budget.
2. All materials are Principled BSDF; procedural shading baked; textures ≤1024 power-of-two.
3. Plain colors unified into a palette texture, not per-color materials.
4. No lights, no cameras.
5. Collider meshes named `*_collider`, no material slots, low-poly.
6. Origin at **bottom-center** of the model so `Transform.position.y = 0` grounds it; rotation/scale applied (`transform_apply`).
7. Export as binary `.glb`, **+Y up** (exporter default — Decentraland is Y-up; a Z-up export loads tipped over), `export_apply=True`, `export_cameras=False`, `export_lights=False`, and `export_animation_mode='ACTIVE_ACTIONS'` if the file contains animations (the default mode leaks every action in the .blend into the GLB).

## Cross-References

- **add-3d-models** — placing the exported GLB, collider masks, bounding-box audit after a model changes, asset folder conventions
- **optimize-scene** — full scene-limit table, texture sizing, back-face culling, `.dclignore`
- **advanced-rendering** — how the exported PBR materials surface in the SDK (`Material.setPbrMaterial`, texture modes)
- **animations-tweens** — playing the GLB's animation clips with `Animator`
- **lighting-environment** — lighting the scene through the SDK (since GLB lights are ignored)
- **unity-explorer-mcp** — verifying the edited model in-world with screenshots
