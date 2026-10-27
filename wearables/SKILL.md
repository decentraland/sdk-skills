---
name: wearables
description: Create Decentraland wearable files — the skinned avatar clothing and accessory GLBs (and facial-feature PNGs) uploaded to the Builder. Covers starting from the official base meshes (which file is male vs female), category triangle/material/texture limits, armature and skinning rules, rigid parts, texturing that reads well on the toon-shaded avatar, the glTF export call, verifying the GLB, the 256 px thumbnail, one representation per body shape, and uploading to a Builder collection. Use when the user wants to make a wearable, model clothing/hats/helmets/accessories for avatars, fix a wearable that fails in the Builder or deforms wrong, or needs the wearable GLB for a smart wearable. Do NOT use for scene models (see add-3d-models), emotes (see avatar-animations), or the code side of a smart wearable (see smart-wearables).
---

# Wearables

A wearable is a GLB skinned to the official Decentraland avatar armature (or a 256 px PNG for eyes, eyebrows and mouth), uploaded to a collection in the Builder. This skill covers making that file. For *driving* Blender (headless CLI vs Blender MCP, binary paths, the never-fall-back-silently rule, PBR-only, no lights/cameras) see `{baseDir}/../add-3d-models/references/blender-authoring.md`; this skill only adds what is specific to wearables.

| Need | Skill |
| --- | --- |
| Wearable that also runs code (abilities, UI, emotes) | **smart-wearables** (uses this skill for the GLB) |
| Avatar animation / emote file | **avatar-animations** |
| Model placed in a scene | **add-3d-models** |
| Show a wearable on an NPC or read what a player wears | **npcs** / **player-avatar** |

## RULE: Start from the official base meshes

Never build an avatar mesh or armature by hand. The [Decentraland Tools add-on](https://github.com/decentraland/dcl-blender-toolkit) ships them in `assets/`:

| File | Contents |
| --- | --- |
| `AvatarShape_A.blend` | **Female** body: `Armature` + the 8 base meshes (head, eyebrows, eyes, mouth, upper body, lower body, hands, feet), skinned |
| `AvatarShape_B.blend` | **Male** body |
| `Avatar_File.blend` | Animation rig, for emotes (see **avatar-animations**). Not for wearables. |

The A = female / B = male mapping is not obvious from the names. Get it right or the representations end up swapped. The mapping was confirmed by rendering both files and measuring their meshes: `ShapeA_*` has narrower shoulders (0.66 vs 0.80 m), a pinched waist and wider hips (0.41 vs 0.37 m). If in doubt, render the two bodies from the front before building.

The base meshes are already weighted to the 62 avatar bones. The fastest route to a body-hugging wearable is to **start from the base mesh of its category** (the upper-body mesh has `uBody` in its object name). Reshape it or inflate it slightly along its normals, delete every other mesh, and add rigid parts.

## RULE: One representation per body shape

Body-hugging wearables need a GLB per body shape: build from `AvatarShape_B.blend` for `BaseMale` and `AvatarShape_A.blend` for `BaseFemale`. Script the build and run it once per file (`-- male` / `-- female`). A rigid accessory that fits both (glasses, a hat) can be one GLB listed for both body shapes. In the Builder, upload one representation, then add the other from the item editor (**… → Add male/female representation**). For a smart wearable, both go in `wearable.json` (see **smart-wearables**).

## Categories and limits

| Category | Triangles |
| --- | --- |
| `hat`, `helmet`, `upper_body`, `lower_body`, `feet`, `hair` | 1,500 |
| `mask`, `eyewear`, `earring`, `tiara`, `top_head`, `facial_hair` | 500 |
| `hands_wear`: accessory (watch, ring) / replacing the base hand | 1,000 / 1,500 |
| `skin` | 5,000 (5 textures) |
| `eyes`, `eyebrows`, `mouth` | PNG only, 256 × 256 with alpha (no mesh) |

- **Hiding another slot adds its budget.** An `upper_body` that hides `lower_body` (a jumpsuit) may use 3,000. A helmet that hides every head category may use 4,000.
- ≤ **2 materials** (not counting `AvatarSkin_MAT`) and ≤ **2 textures**, square, ≤ **1024 px**.
- No normal or roughness maps; the avatar uses a toon shader. Bake detail and AO into the base color. Emission goes in its own material; prefer alpha clip over alpha blend.
- `hands_wear` is for skinned hand items only. Swords, shields and the like get rejected by curation.
- Source: [Creating wearables](https://docs.decentraland.org/creator/wearables-and-emotes/wearables/creating-wearables/).

## Special materials and categories

- **Hair / facial hair** tinted by the player's hair color: paint in grayscale and include `Hair` in the material name (e.g. `M_Hair_Short`). Leave `Hair` out of materials that shouldn't tint.
- **Skin** is tinted only if the material is named exactly `AvatarSkin_MAT` (grayscale texture). A wearable that shows skin (bare arms) keeps that material on those faces.
- **Eyes / eyebrows / mouth:** 256 px transparent PNG. A grayscale mask PNG with the `_mask` suffix limits where the tint applies. Upload both files in one zip.
- **Hats:** add a short hair to the hat mesh and hide the `hair` category so long hair doesn't clip through.
- **Dangling parts** (ponytails, earrings, capes) can sway with extra bones named `*springbone*`: see [Spring bones](https://docs.decentraland.org/creator/wearables-and-emotes/wearables/spring-bones/).

## Armature and skinning rules

- Export `Armature` exactly as shipped: same names, hierarchy and transforms. No `_end` / `_neutral` leaf bones (toggle **Ignore Leaf Bones** when importing FBX). Spring bones are the only extra bones allowed.
- A valid single-mesh wearable GLB has **64 nodes**: `Armature` + 62 bones + 1 skinned mesh.
- Seams with other body parts: weight the neck-line vertices 100% to the neck bone and the waist-line vertices 100% to the hips, so separate wearables meet without gaps. Use the leg bones for the lower body / feet seam.
- **Rigid parts** (a backpack, tanks, armor plates): weight every vertex **100% to one bone** (e.g. `Avatar_Spine2` for anything on the back). Give the object the same armature parent and an `Armature` modifier, then join it into the body mesh so the wearable stays one skinned mesh.
- ≤ 4 bone influences per vertex; keep left/right weighting symmetric.

## Blender gotchas (hit in practice)

- **`bpy.ops.object.join()` drops material indices** of an object that had no material slots: the joined faces all end up on material 0 (a rigid part came out textured with the suit texture). Store a per-face int attribute (`bm.faces.layers.int.new('part')`) before joining. After assigning materials, restore `material_index` from it, then **remove the attribute** before export.
- After joining, wipe the old UV maps and create one new `UVMap`. Unwrap each material's faces separately (select by `material_index`, then `uv.smart_project(scale_to_bounds=True)`) so each fills its own texture.
- Blender resolves a **relative render output path against the `.blend` file's folder**, not the working directory. Pass absolute paths for thumbnails and renders.

## Textures that read well on the avatar

Procedural textures painted per texel with hard edges look like pixel art (stair-stepped stripes). The owner rejected that as "too 8-bit". For a "real object" look:

- Paint at 1024 px with **supersampling** (render at 2× and average), or draw stripes and panels with a soft 1–2 texel edge.
- Add seams and stitching along panel borders, light wear, and a **baked AO** pass (Cycles bake) multiplied in.
- **Fill UV gutters** (dilate island colors outward ~40 px) so mip-mapping doesn't bleed dark edges into the islands.

## Export

Select only `Armature` and the wearable mesh, then:

```python
bpy.ops.export_scene.gltf(
    filepath=path, export_format='GLB', use_selection=True,
    export_skins=True, export_animations=False, export_morph=False,
    export_materials='EXPORT',
    export_image_format='JPEG', export_jpeg_quality=88,   # PNG at 1024 px is several times larger
    export_cameras=False, export_lights=False, export_yup=True, export_apply=False,
)
```

JPEG keeps a 1,230-tri upper-body suit with two 1024 px textures at **~270–280 KB** per body shape. Use PNG only for a texture that needs alpha. The Builder's limit is **3 MB** per item.

**Verify each GLB** before uploading: parse the JSON chunk and check the node count (64 for a single-mesh wearable), the triangle count against the table above, ≤ 2 materials and ≤ 2 images at ≤ 1024 px. The Builder shows the same triangle, material and texture counts under **Properties** after upload.

## Thumbnail

256 × 256 PNG with a **transparent background**, showing the wearable only: no avatar body and no extra graphics (the Curation Committee rejects those). Render with `film_transparent = True` at a 3/4 view and hide the body meshes. Keep the editable `.blend` and build script in a `blender/` folder.

## Upload (regular wearables)

1. Builder → **Collections** → create or open a collection → **New item** → drop the GLB (or a zip with GLB + textures). The Builder detects wearable vs emote.
2. Choose the body shape, name, rarity (`unique` 1 · `mythic` 10 · `exotic` 50 · `legendary` 100 · `epic` 1,000 · `rare` 5,000 · `uncommon` 10,000 · `common` 100,000) and category; add the thumbnail.
3. In the item editor: add the other body-shape representation, set **overrides** (categories and base body parts it hides), description and tags. Overrides are defaults; players can change them in the backpack.
4. Preview it on avatars of both body shapes and play a few emotes to catch skinning problems. Then use **See in Decentraland** on the collection to try it in-world on Sepolia.
5. Publishing goes through the Curation Committee.

Docs: [Uploading wearables](https://docs.decentraland.org/creator/wearables-and-emotes/manage-collections/uploading-wearables/).
