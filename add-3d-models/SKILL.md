---
name: add-3d-models
description: Add 3D models (.glb/.gltf) to a Decentraland scene using GltfContainer — 8,800+ free assets from the OpenDCL catalog and the Creator Hub asset packs (Genesis City, Halloween, Sci-fi, Fantasy, Smart Items — the latest additions are catalogued offline), plus authoring and editing custom models by driving Blender (headless CLI or Blender MCP). Use when the user wants to add models, import GLB files, find free 3D assets, set up model colliders, or create/edit/retexture/optimize a model in Blender — also whenever an `mcp__blender__*` tool is available and the task touches 3D models. Do NOT use for SDK materials/textures (see advanced-rendering), model animations (see animations-tweens), or avatar emotes (see avatar-animations).
---

# Adding 3D Models to Decentraland Scenes

## RULE: Check bounding boxes before placing models

**A model's `Transform.position` is its local origin, not its visual extent.** Vegetation and large structural models often extend 6-12 m beyond their origin. A tree placed at x=2 can render at x=-10 — outside scene bounds and invisible.

**Before placing any GLB model, determine its actual world-space bounding box.** Raw accessor `min`/`max` values are NOT sufficient — many models have large node-level scales baked in. You **must** account for node transforms. Use the bounding box script in `{baseDir}/references/model-patterns.md`.

**The script prints glTF axes, and Decentraland negates X:** `dclMinX = -gltfMaxX`, `dclMaxX = -gltfMinX`; Y and Z carry over. A room laid out from unconverted glTF X extents gets wall gaps and shifted doorways.

Then compute the safe placement zone **in DCL axes**: `safeMinX = -dclMinX + edgeMargin (>=1m)`, `safeMaxX = sceneMaxX - dclMaxX - edgeMargin`, and the same for Z with the script's Z values. Place the origin only within the safe zone. **When bounding box is unknown**, use a conservative **12 m buffer from all edges** for trees/large foliage, or **3 m** for small props.

## RULE: Geometry baked in world coordinates — check the bounds in DCL axes, and probe the axes first

The bounding-box rule above assumes a model built around its own origin and positioned by `Transform`. The moment you **bake world-space placement into the mesh** — merged floor/wall chunks for a whole zone, a kitbashed layout exported as one GLB, anything placed by a script in Blender rather than by an entity `Transform` — the model's placement depends on the **axis convention of the exporter**, and a wrong guess puts the geometry outside the scene while every number you can read still looks right.

**Failure mode, observed 2026-10-08 (cost ~1.5 h):** rendering is clipped at the scene boundary, so **only the portions of a mesh that fall outside the parcels disappear — the rest of the model stays visible**. That is what makes a bad axis guess so confusing: when the whole baked mesh lands outside (e.g. mirrored in X), **all** of it is clipped, with no error, even though the entity's own `Transform.position` is inside the scene. Both the Explorer and the Creator Hub editor clip it the same way, and the Creator Hub's `get_scene_metrics.entitiesOutOfBoundaries` did **not** list it — under the Bevy renderer that list is a hardcoded empty array (verified in the inspector's `BevyRenderer`), so it can never warn you; under Babylon it is bounds-based and would. The tell is a contradiction between two reads:

- `explorer_get_scene_content_stats` counts the model's triangles — so the GLB loaded fine;
- `explorer_get_scene_content_breakdown` shows the source with N `renderers` and **`visibleRenderers: 0` from every viewpoint**;
- scene logs are clean.

Size is not the cause: a single 36 × 30 m mesh wholly inside the bounds rendered normally in the same scene.

**So, before baking the real thing, export a cheap asymmetric probe and look at it.** A symmetric box tells you nothing — mirror and rotation errors are invisible on it. Use a model with one obviously distinguishable side: a short bar along +X plus a different-length bar along +Z, or any asset with one open end. Place it at a known position, then confirm in-world (**unity-explorer-mcp**): screenshot from a known camera pose, walk into it and read the blocked position from `explorer_get_player_state`, or both. Only then bake the full set. One throwaway export is far cheaper than re-baking a kit.

**Axis mapping and a `place()` helper for Blender → DCL are in `{baseDir}/references/blender-authoring.md`.**

## RULE: Account for model depth before neighboring entities

Two models don't overlap just because their origins are different. Always verify that `origin +/- extent` doesn't intersect any neighbor's bounding box. Pay special attention to deep arch/gateway models (can extend 14 m in +/-Z) and rotated models (rotating 90deg around Y swaps X and Z extents).

## RULE: Scale interiors up for the third-person camera

**This is the canonical copy of this guidance; other skills link here instead of repeating the numbers.** It is design guidance from practice (Decentraland staff feedback after walking a scene in the Explorer, 2026-10-08), not an engine constant.

Decentraland is mostly played in the default third-person camera, which sits **behind and above** the avatar. Interiors therefore feel much smaller on screen than their real-world dimensions suggest: the camera crowds the ceiling, the avatar fills the frame, and ordinary rooms read as corridors. **Do not build rooms at realistic scale.** Give the envelope roughly **1.5× to 2× real headroom**:

| Element | Real-world | Build it at |
| --- | --- | --- |
| Ceiling height | 2.5–3 m | **5–6 m** |
| Doorway / opening on a main route | ~2.1 m × 0.9 m | **~4 m tall, ≥3 m wide** |
| Corridor width | 1.2–1.8 m | **4 m+** |
| Any gap the avatar must walk through | — | **≥1.2 m clear** |
| Stairs | ~0.18 m rise × 0.28 m tread | **rise ≤ 0.25 m** (hard limit ~0.4 m), tread ≥ 0.3 m, width as a corridor |
| Ramps | — | **≤ 30°** for easy walking (hard limit 46°) |

**What these numbers are sized against** (desktop Unity Explorer: source values from `unity-explorer` `origin/dev`, limits measured by walking the avatar in a test scene, 2026-10-27; the mobile client approximates them, see **player-physics**):

- **Avatar:** the base body is **~1.90 m** to the top of the head and ~0.61 m across the shoulders (measured in `Avatar_File.blend`, both body shapes; hair and hats add height).
- **Collider:** a `CharacterController` capsule, 0.3 m radius (0.6 m wide), skin width 0.08 m (`Character/CharacterObject/CharacterObject.prefab`). Measured: a beam whose underside is **1.80 m** above the floor stops the avatar; at **1.85 m** it passes and the beam grazes the hair. So the collider reaches roughly head height; don't count on a gap between them. Anything walked under needs **≥ 2.0 m** clear (more with the oversized style above), and a low beam also pulls the camera in (below).
- **Steps:** `StepOffset` is 0.35 m (`CharacterMotion/Settings/CharacterControllerSettings.asset`, applied every frame by `ApplySlopeModifier`), but with the skin width the avatar measurably walks up a **0.40 m** ledge and is stopped by **0.45 m**. Anything higher needs a jump, so a rise above ~0.4 m becomes a jump puzzle.
- **Slopes:** `slopeLimit` is **46°**. Measured: 30°, 40° and 44° ramps are walkable, and a 48° ramp stops the avatar at its foot. Steeper surfaces count as steep slopes and the avatar slides off them (`ApplyEdgeSlip`).
- **Camera:** the third-person camera orbits **~4.5 m** from a point about **2 m above the player's feet** (middle rig of `CharacterCamera/Character Camera.prefab`, 60° FOV). Measured in open ground it sits ~4.4 m behind the player horizontally and 2.2–3.2 m above the feet, depending on pitch. Its obstacle avoidance **pulls the camera forward** whenever a wall or ceiling comes between it and the avatar. That is the cramped feeling. Measured: a wall 2.35 m behind the player pulled the camera in to 2.15 m, and under a 1.85 m beam the camera dropped to ~1.9 m height, 0.4 m behind the player. With less than ~4.5 m of room behind the player, the camera jumps in close. Rooms where players turn around therefore read best at **~9 m across or more** (twice the orbit radius). This figure is derived from the camera rig, not from a playtest.

The ceiling, doorway and corridor rows are staff design guidance, not engine limits. The stair and ramp targets are comfort margins chosen under the engine limits; only the "hard limit" values come from the engine.

- **Keep hand-scale props near human scale.** Chairs, desks, counters, railings, screens and signage stay roughly life-size, so the avatar still reads as a person in the room. Scaling the furniture with the envelope just rebuilds the cramped feeling one size larger: grow the *room*, not its contents.
- **This applies when scaling a catalog model too.** The model-swap audit below picks `scale` from native size; for architecture the target is the oversized figure, not the realistic one.
- **Plan floor area with these numbers.** Oversized rooms change how much parcel area a floorplan needs, so apply them when computing bounds (see **composites** Step 0), not after placing.
- **Judge it from the retail camera, never from a free camera or the editor viewport.** Those views flatter interiors because they can sit outside the geometry. Walk the route in `third_person` and screenshot from there (**unity-explorer-mcp**). If the camera clips the ceiling or the avatar's head crowds the top of the frame, the room is too short.
- **Walk every opening before detail work.** Export the greybox and walk the avatar through each doorway with production collider settings: opening width and height, no collider on thresholds or crosspieces, and faces readable from both sides. The transformed-bounds audit only proves the model sits inside the parcels, not that the player can get in — a 0.58 m chapel door with a colliding crosspiece passed every headless check and blocked the owner in-world (2026-10).

*Observed, same session:* a first interior shell built at near-realistic heights (4 m ceilings, 2.8 m doorways, a 2.2 m aircraft cabin, a 2.6 m jet bridge) read cramped in third person, and the creator asked for more headroom. A 0.75 m clear metal-detector arch needed near-exact alignment before the avatar would pass through it at all.

## RULE: Single-sided models — orient the rendered face toward players

Many GLB models use back-face culling. The rendered face is typically toward local **-Z**. Y rotation transforms facing: 0deg -> south, 90deg -> east, 180deg -> north, 270deg -> west. When players approach from both sides, add a second copy rotated 180deg. Prefer double-sided geometry for elements visible from all angles.

Decentraland uses a **Y-up** coordinate system — test model orientation after import: a model exported Z-up (common from Blender) loads tipped over and must be re-exported with "Y Up".

## RULE: Text labels must be in open air — no occlusion by geometry

`TextShape` labels are rendered in world space and can be occluded by solid geometry. Place labels with no solid model within 2 m horizontally, ensure height clearance, use `Billboard` with `billboardMode: 2` for readable labels, and prefer open-area placement. Exception: labels mounted on a wall without Billboard.

## RULE: Use composite for initial models

Models present at scene load go in `assets/scene/main.composite`, through the Creator Hub MCP when the scene is open there; only models spawned at runtime go in TypeScript (**sdk-scenes** → *CRITICAL RULE — Composite-first scene authoring*). To add behavior to a composite model, fetch it by name or tag (`{baseDir}/../composites/composite-reference.md` → Referencing Composite Entities from Code).

Through the MCP (**creator-hub-mcp**): `search_catalog` + `place_smart_item` for a catalog item (the catalog covers static items as well as Smart Items and downloads the files for you), or `create_entity` + `set_component` `Transform` + `set_component` `core::GltfContainer` for a GLB you placed under `assets/Models/`. The bounding-box, collider-mask, and Animator rules in this skill apply either way.

## RULE: Swapping a model `src` requires fresh Transform — never inherit scale/position

When you change the `src` of an existing `GltfContainer` (in a composite, in code, or via builder asset replacement), the entity's existing `Transform.scale`, `Transform.position`, and often `rotation` were tuned for the **previous model's native dimensions and pivot**. They are almost never correct for the new model — applying them blindly can produce buildings that overshoot scene bounds, props at wrong heights, or models visibly shifted from where the user expected them.

Treat every model swap as fresh placement:

1. **Look up the new GLB's native bounding box** — use the bounding box script in `{baseDir}/references/model-patterns.md` (raw accessor `min`/`max` is not sufficient; node-level scale/translation must be applied).
2. **Recompute `scale`** so the world-space size (native size × scale) is sensible for the role. Do not carry over the previous entity's scale — it was calibrated against a different native size.
3. **Verify pivot location.** Many architecture/building GLBs have pivots at a corner (e.g. `(0,0,0)` at one base corner), not the center. Two models with the same `position` but different pivots will visually shift after the swap.
4. **Verify the resulting world-space bounding box stays inside scene bounds.** Each parcel is 16 × 16 m horizontally; max height is **330 m** for every scene regardless of parcel count (anything above ~200 m may suffer multiplayer sync issues — see `{baseDir}/../optimize-scene/SKILL.md`). Compute `position +/- bbox` against scene `[0, maxX] × [0, maxZ]` and `y <= 330`.
5. **State the audit explicitly.** After a swap, the agent must report: native dimensions of the new GLB, chosen scale, chosen position, and the resulting world-space bounding box vs. scene bounds. Do not silently keep the prior Transform.

This applies equally to code (`GltfContainer.createOrReplace(entity, { src: '...' })` while leaving Transform untouched) and to composite edits where only the `core::GltfContainer.data["<id>"].json.src` was modified.

**Runtime swap mechanics**: to change a model in place, mutate the field directly — `GltfContainer.getMutable(entity).src = newSrc` — the engine reloads the GLB on the same entity. Other `GltfContainer` fields (e.g. `visibleMeshesCollisionMask`) can also be mutated live the same way. Reusing the Transform is only safe when the two models share the same native size and pivot; otherwise re-audit per the steps above.

## RULE: When editing an existing composite, register new entities in `inspector::Nodes`

Hand-editing a composite that already contains `inspector::Nodes` (only without the MCP, with the scene closed): every new model needs an `inspector::Nodes` entry, a `core-schema::Name` and an `inspector::TransformConfig`, or it renders in-world but is invisible in the Creator Hub entity tree. Procedure: `{baseDir}/../composites/composite-reference.md` → Editing an existing composite (edit mode).

## RULE: Parenting a model to the player — pick by item type

To make a model follow the player (held gun, reticle, torch, backpack, halo), pick the mechanism by intent: aim-sensitive held item → parent to `engine.CameraEntity`; body-fixed, yaw-only item → parent to `engine.PlayerEntity`; cosmetic item → `AvatarAttach` (bone anchors animate, so never for aim). Comparison table and a worked gun example: **player-avatar** → *Held items vs cosmetic items*.

## RULE: Always check for animations

Before finalizing any entity with `GltfContainer`, check if the GLB contains animations. **If it has animations**, decide what should play: with no `Animator` the renderer autoplays and loops the file's first clip, which code cannot stop or switch. Add an `Animator` to pick another clip, start still, or switch clips at runtime (**animations-tweens**). **If no animations**, omit `Animator`.

## RULE: Always check for built-in colliders

Check whether the GLB contains `_collider` meshes (mesh or node name includes `_collider`). Use the collider detection script in `{baseDir}/references/model-patterns.md`.

### Two standard patterns

**Model HAS `_collider` meshes**: `visibleMeshesCollisionMask: 0, invisibleMeshesCollisionMask: 3` (the protocol defaults)

**Model has NO `_collider` meshes**: `visibleMeshesCollisionMask: 3, invisibleMeshesCollisionMask: 0`

Choose the mask based on role:

| Role                    | visibleMeshesCollisionMask | Why                    |
| ----------------------- | -------------------------- | ---------------------- |
| Interactive (clicks)    | `3`                        | Physics + pointer      |
| Structural / decorative | `3`                        | Block walking + clicks |
| Clickable-only, no bulk | `1`                        | Detect clicks only     |
| Purely decorative       | `0`                        | No interaction         |

**Mixing masks works when you mean it.** The two collider sets are independent and coexist on one entity, each answering only the layers in its own mask. Pointer events land on whichever set carries `CL_POINTER` (`1`); a `CL_PHYSICS`-only (`2`) collider neither receives nor blocks clicks. `visible: 3, invisible: 2` gives clicks on the exact visible mesh while the `_collider` hull also blocks walking. `visible: 2, invisible: 3` makes clicks register only on the `_collider` shapes, so a click on visible geometry the hull does not cover does nothing — the usual cause of "some clicks miss" on a mixed setup.

## RULE: Always validate entity positions against parcel bounds

**Entities entirely outside scene parcels are not rendered** — no error shown; a model that straddles the boundary still renders the part that is inside. Each parcel is **16x16 m**. Valid range: `0 <= x <= 16 * parcelsWide`, `0 <= z <= 16 * parcelsDeep`, `y >= 0`.

**The clipping applies to the geometry, not to the entity's position.** A `Transform` sitting at a legal position does not save geometry that reaches outside the parcels — the portions outside are clipped silently, and the rest of the model stays visible. A mesh baked wholly outside therefore disappears completely. Do not rely on the Creator Hub's `entitiesOutOfBoundaries` to catch it: it is an empty stub under the Bevy renderer. See the world-coordinate rule above for the symptom and the probe workflow.

## Loading a 3D Model in TypeScript (dynamic entities only)

Use `GltfContainer.create(entity, { src: 'assets/Models/myModel.glb' })` for runtime-spawned entities. Place files in `assets/Models/`.

**Omit `Transform` fields you do not set — never pass an explicit `undefined`.** `Transform.create(e, { position, rotation: maybeUndefined })` keeps the `undefined`: the schema's `extend` spreads your object over the defaults (`...value`, `Transform.ts` in `@dcl/ecs`), so the default rotation is replaced by nothing and the next serialization reads `value.rotation.x` and throws — inside the engine update, not at the `create` call, so the stack points nowhere useful. Build the object conditionally: `...(rot ? { rotation: rot } : {})`.

### Asset folder conventions

- **Default** for models you download yourself: `assets/Models/`.
- **Legacy scenes** may already have models under `assets/scene/Models/` — that path still works; reuse it for any new models in those scenes instead of creating a parallel `assets/Models/` folder.
- **Creator Hub assets**: models imported directly through the Creator Hub UI land in `assets/Models/` (same as the standard path). Items from free DCL asset packs land in `assets/asset-packs/` and custom items in `assets/custom/`. Older scenes may also have user imports directly under `assets/scene/`. Reference these paths as-is — never move or rename them.

Always check the scene's existing folders before deciding where to put a new model.

**Dragging from the Local Assets tab onto the viewport is the user's fastest path** when the scene is open in the Creator Hub. `.glb` / `.gltf` drop as a plain model; **media files drop as catalog Smart Items instead of bare components**: `.png` / `.jpg` / `.jpeg` spawn the **Image** item with the `Material` PBR texture `src` repointed and the plane lifted `+0.5 m` so it stands on the ground, and `.mp3` / `.mp4` spawn their matching items (see **audio-video**). Offer the drag for a flat image rather than hand-assembling a plane + `Material`; full table and asset ids in **creator-hub-mcp**.

## RULE: New models — offer the catalog AND custom authoring in Blender

When the user asks to add a model, there are two sources, and the choice is theirs — ask before picking:

> "I can download the best match from the free catalogs (8,800+ OpenDCL models plus the Creator Hub asset packs), or create a custom model for you in Blender. Which do you prefer?"

- **Catalog** → the workflow in the next section (search → review → download).
- **Blender** → author the model by driving Blender; full guide (both ways to drive it, setup, modeling rules, export) in `{baseDir}/references/blender-authoring.md`, ready-made `bpy` scripts in `{baseDir}/references/blender-patterns.md`. Blender is also the path for **editing** an existing scene model — retexturing, reshaping, optimizing — not just creating new ones.

Running as a subagent, you cannot ask — report the choice to your caller with your recommendation instead of picking on your own authority.

**Animating the _avatar_ (custom emotes) uses these same two Blender paths, but the official Decentraland avatar rig and a different export recipe** — see the **avatar-animations** skill. This skill covers models and props only.

### Two ways to drive Blender

|  | Headless CLI (`blender --background --python`) | Blender MCP |
| --- | --- | --- |
| Extra installs | None — just Blender itself | Blender 5.1+, MCP add-on, `uv` + server package, client registration, session restart |
| Availability | Any session where Blender is installed | Only when `mcp__blender__*` tools are bound at session start |
| Interaction model | Batch: one script per run, state resets between runs | Live: incremental edits in a running Blender, state persists |
| Visual verification | Rendered stills written to disk (temp camera) | Screenshots of the real viewport |
| User involvement | Sees results only | Watches — and can co-edit — in the open Blender GUI |
| Best for | Conversions, decimation, batch optimization, scripted model building | Iterative modeling sessions, working on the user's open file |

### RULE: never fall back to headless silently

Whenever a task creates or edits a model in Blender and the MCP could possibly be used, pick by which of these three states the session is in:

1. **MCP connected and working** — a read-only probe (`get_objects_summary` or equivalent) answers → **use it.** No need to ask.
2. **MCP configured but not connected** — `mcp__blender__*` tools exist in the session, but the probe errors (Blender isn't running, the add-on is disabled, or its bridge server is down) → **ASK before going headless:**
   > "The Blender MCP is set up but Blender isn't running. Want to open Blender so I can work in it live — you'd see the model as it's built and could edit alongside me — or should I do this headless instead?"

   The user does not mind opening Blender, and may want to work on the model together. Only fall back to headless if the user says so, or if you genuinely cannot ask (fully non-interactive context — as a subagent, report the pending choice to your caller instead of deciding).
3. **MCP not installed at all** — no `mcp__blender__*` tools in the session → **don't ask the user to install it** (that's a big setup effort). Proceed headless, but **mention in your report** that the Blender MCP exists as an option for live, interactive model editing, and that setup steps are in `{baseDir}/references/blender-authoring.md`.

**Why:** the MCP is what makes model work collaborative — the user watching and iterating on the model in their own Blender session. A silent headless fallback takes that away without giving them the choice.

Always say which path you're on; never let the user believe the MCP did work the CLI did, or vice versa. The modeling rules (low-poly, PBR, palette textures, bare colliders, scene limits) are identical on both paths.

## Free 3D Models — two catalogs

Always check the scene's local asset folder first. Before fetching any model, confirm with the user. Search **both** catalogs with one grep — `grep -i "keyword" {baseDir}/references/asset-pack-catalog.md {baseDir}/references/model-catalog.md` — and try synonyms if nothing matches. Browse categories with `grep "^##"` on either file. Every row has a `preview:` image URL; fetch it to check the look before importing. The Creator Hub packs' names, tags and captions are generated and can be wrong — the `decorations` item **Human** (tags `man, person, figure…`, caption "Human figure in mid-action") is the word *HUMAN* in 3D letters — so for a pack item not in `asset-pack-catalog.md`, open its `thumbnail.png` in the pack before placing it (**creator-hub-mcp** → `search_catalog`).

**OpenDCL catalog (8,800+ models)** — `{baseDir}/references/model-catalog.md`. Single-file GLBs. Workflow: search → review dimensions/triangles/animations → download with curl into `assets/Models/` → reference in code → add `Animator` if the model has animations.

**Creator Hub asset packs** — `{baseDir}/references/asset-pack-catalog.md`: the 420 models + 7 Smart Items most recently added (Genesis Plaza and template-scene imports: buildings, street furniture, office/café furniture, nature, Halloween, a sci-fi lab kit, a chess set, and scripted buttons, doors, a piston platform and water). Each item is a GLB **plus external textures**, so download with the `dl-asset.mjs` helper in `{baseDir}/references/model-patterns.md` (not a bare curl) into `assets/asset-packs/<folder>/`; rows give the final `glb:` path, the `col:` flag for the collider mask, and the `id:` that `place_smart_item` takes when the scene is open in the Creator Hub (then prefer the MCP route). The packs' older items are not catalogued offline: search them live with `search_catalog` (**creator-hub-mcp**).

> **Important**: `GltfContainer` only works with **local files**. Always download first (`assets/Models/` for OpenDCL, `assets/asset-packs/<folder>/` for pack items). Never `cd` into the models directory — run curl / the helper from the project root.

## Troubleshooting

| Problem                     | Cause                          | Solution                                                     |
| --------------------------- | ------------------------------ | ------------------------------------------------------------ |
| Model not visible           | Wrong file path                | Verify path relative to project root                         |
| Model not visible           | Outside scene boundaries       | Check position is within 0-16 per parcel                     |
| Part of a model is cut off  | Those portions are outside the parcels (clipped at the boundary) | Move/scale the model so its bounds fit inside the scene |
| Model not visible           | Scale is 0 or very small       | Check `Transform.scale`                                      |
| Model loads but looks wrong | Y-up vs Z-up mismatch          | Re-export from Blender with "Y Up"                           |
| Triangles counted, 0 visible renderers from every viewpoint | Mesh baked wholly outside the parcels (entity position can still be inside) | Check the GLB's bounds in **DCL** axes; see the world-coordinate rule above |
| "FINISHED_WITH_ERROR"       | Corrupted .glb                 | Re-export as `.glb` (binary GLTF)                            |
| Clicking does nothing       | CL_POINTER not set             | Set `visibleMeshesCollisionMask: 3` if no `_collider` meshes |
| Click through walls         | CL_POINTER not on visible mesh | Set `visibleMeshesCollisionMask: 3` (or at minimum `1`)      |
| Light fixtures don't illuminate | GLB light geometry is visual only | Add a `LightSource` component to the entity (see **lighting-environment**) |

## RULE: 3D model light fixtures do not emit real light

Lamp meshes, bulb shapes, chandelier arms, and other light-fixture geometry in a GLB are **purely decorative** -- they do not cast dynamic light on surrounding objects. The Decentraland renderer treats them as normal geometry (with optional emissive material for a self-glow effect). To get actual illumination from a fixture model, add a `LightSource` component to the same entity or a child entity positioned at the light source. When the Creator Hub MCP is available, prefer `search_catalog` for a Smart Item light (e.g. Spotlight or Point Light from category `lights`) which bundles the model, `LightSource`, and toggle actions together -- see **lighting-environment** for details.

## Model Best Practices

- Keep models under 50MB per file for good loading times
- Use `.glb` format (binary GLTF) — smaller than `.gltf`
- Optimize triangle count: aim for under 1,500 triangles per model for small props
- Use texture atlases when possible to reduce draw calls
- Materials in models should use PBR for best results
- For repeated content (lamp posts, chairs, trees), point many entities at **one shared `.glb`** rather than exporting a near-identical file per copy — the engine downloads, converts, and stores a shared source's meshes and textures once, session-wide. This does not reduce draw calls or material count — both track rendered objects; see **optimize-scene** → Repeated Models for when merging meshes is the right call instead.
- ⚠️ **No Draco compression if the scene targets mobile.** The mobile app has **no runtime Draco decoder**. A Draco-compressed GLTF/GLB loads on a phone only from the scene's **optimized assets** (decompressed server-side); with no optimized assets — **any local, Creator Hub or QR mobile preview** — it **fails to load silently**: the model is simply absent, with no console error and no placeholder. So the model can be fine in a published scene and invisible in every mobile preview of it, which makes this near-undebuggable from the preview alone. Export uncompressed (`npx @gltf-transform/cli optimize in.glb out.glb --compress false`) and reduce triangles/texture size instead; quantization, texture compression and mesh decimation are unaffected. [UNVERIFIED: whether `meshopt` compression loads on mobile — the docs clear only the three forms above.] The `54,-55-Testing-3d-models` engine scene below includes a Draco variant: it is a desktop capability test, not a cross-platform recommendation.

For full code examples (loading, colliders, operations, catalog workflow), see `{baseDir}/references/model-patterns.md`. For the asset catalogs, see `{baseDir}/references/model-catalog.md` (8,800+ OpenDCL models) and `{baseDir}/references/asset-pack-catalog.md` (Creator Hub asset packs, latest additions).

## Example scenes

Engine-team test scenes exercising these APIs against the real runtime:

- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/54,-55-Testing-3d-models — many GLB variants loaded via `GltfContainer` (draco, morph targets, rigged animation, external-dep models); note it uses the `models/` folder, not `assets/Models/`.
- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/3,33-gltf-container-update — swapping a live model's `src` and mutating `visibleMeshesCollisionMask` via `GltfContainer.getMutable()` (Book↔Monster on click; ray-cast against `CL_CUSTOM1`).
- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/88,-12-asset-load — preloading GLB/audio/texture/video with the `AssetLoad` component and per-asset load-state callbacks; also lazy-spawns a model with `GltfContainer.getOrCreateMutable()` on click.
