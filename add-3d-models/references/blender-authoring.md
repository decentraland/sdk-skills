# Authoring and editing scene models with Blender

Drive Blender to create and edit the GLB models of a Decentraland scene: import a model from the scene's asset folders (or start from nothing), edit it, and export it back to the same path — the scene preview hot-reloads the file on save.

There are two ways to drive Blender — **headless CLI** and the **Blender MCP** (comparison table in the parent SKILL.md). Whichever path you take, say explicitly which one you're on — never let the user believe the MCP did work the CLI did, or vice versa — and **never simulate Blender edits by hand-writing GLB binary data**. Every rule in this file (low-poly, PBR, palette textures, colliders, limits, export flags) applies identically on both paths. Ready-to-run `bpy` snippets for all the patterns below live in [`blender-patterns.md`](blender-patterns.md).

Running as a subagent, don't set up the MCP or make the path choice on the user's behalf — work headless if the path was already chosen for you, otherwise report the pending decision to your caller with your recommendation.

## Path A: Headless Blender (CLI) — no installation beyond Blender

Any session where Blender is installed can do this; there is nothing to configure or register.

1. **Find the binary.** Try `blender --version`. If not on PATH: macOS keeps it at `/Applications/Blender.app/Contents/MacOS/Blender`; otherwise ask the user where Blender is installed (or to install it from [blender.org/download](https://www.blender.org/download/)).
2. **Write the script** to the scratchpad (not the scene folder), then run:

   ```bash
   blender --background --factory-startup --python edit_model.py
   ```

   `--factory-startup` skips the user's startup file and add-ons, so every run begins from the same predictable default scene (a cube, a light, a camera — delete them first, script in the patterns file). Script `print()` output and tracebacks come back on stdout/stderr — read them; a traceback means the run did nothing after that point.

3. **Each run is a fresh Blender — state does not persist between runs.** A single script must do the whole job: import → edit → audits → export. To split work across runs, save a `.blend` in the scratchpad (`bpy.ops.wm.save_as_mainfile(filepath=...)`) and reopen it with `blender --background scratch.blend --python next_step.py`. Keep working `.blend` files out of the scene folder, or add them to `.dclignore` (see **deploy-scene**).

4. **Verification without a viewport.** No screenshots here — verify with:
   - **Numeric audits first**: the triangle-count, material-audit, and bounding-box scripts in the patterns file print everything the rules below need.
   - **Rendered stills** when you need eyes on it: add a temporary camera + light, `bpy.ops.render.render(write_still=True)` to a scratchpad PNG, and Read the image. Do this **after** the export (or delete the camera/light before exporting) — lights and cameras must never end up in the GLB.
   - **The scene preview**: the exported GLB hot-reloads in the running scene — verifying in-world (e.g. via **unity-explorer-mcp** screenshots) is often the most honest check.

> If the official Blender MCP happens to be connected, it also exposes `*_for_cli` tools (`execute_blender_code_for_cli`, `get_blendfile_summary_*_for_cli`) that run code in a background Blender against a `.blend` file — a middle ground that doesn't need the GUI side running.

## Path B: Blender MCP — live editing in a running Blender

The connected `mcp__blender__*` tools are self-describing — each carries its name, arguments, and output shape; treat that as the authoritative tool catalog. Two distinct Blender MCPs are in circulation, and `execute_blender_code` exists on both — read the session's tool names to tell which is connected:

- `get_objects_summary` / `get_object_detail_summary` / `search_api_docs` → the **official Blender Lab** server ([projects.blender.org/lab/blender_mcp](https://projects.blender.org/lab/blender_mcp), Blender 5.1+, add-on id `mcp` — the one Setup below installs). It exposes inspection tools (`get_objects_summary`, `get_screenshot_of_window_as_image`, `render_viewport_to_path`), bundled documentation search (`search_api_docs`, `search_manual_docs`, `get_python_api_docs`), and the `bpy` executor `execute_blender_code` — the bulk of real work happens through `bpy`.
- `get_scene_info` / `get_viewport_screenshot` plus Polyhaven/Sketchfab/Hyper3D asset tools → the **community** server ([ahujasid/blender-mcp](https://github.com/ahujasid/blender-mcp), Blender 3.0+, add-on "Blender MCP").

Everything in this file applies to both.

### Setup (once per session)

The Blender MCP has three parts, and all three must be alive for tools to work ([source + docs](https://projects.blender.org/lab/blender_mcp)):

```
MCP client (this agent) ⇐ MCP/stdio ⇒ blender-mcp (Python process) ⇐ TCP localhost:9876 ⇒ MCP add-on inside Blender
```

> **Security note (from the official docs):** the MCP server executes generated Python in Blender with no guards. Keep edits scoped to the scene's model files, and don't touch unrelated .blend data.

1. **Probe.** If `mcp__blender__*` tools are available in the session, call a cheap read-only one (`get_objects_summary` or equivalent):
   - **Answers** → everything is running; skip to the workflow.
   - **Connection error** → the client side is configured but Blender's side is down: Blender isn't running, the add-on is missing/disabled, or its bridge server isn't started. Go to step 3.

   If no `mcp__blender__*` tools exist in the session, the MCP was never configured (or was registered after session start — registration only binds on a new session). Tell the user and recommend the headless path (Path A — no installs); continue with step 2 only if they want the MCP set up.

2. **Install and register (first time only).** Confirm each requirement with the user rather than assuming:
   - **Blender 5.1 or newer.** The MCP add-on's manifest requires `blender_version_min = 5.1.0` — it will not install on older Blender. Check with `blender --version` or ask; if too old, the user must update via [blender.org/download](https://www.blender.org/download/).
   - **The MCP add-on** (id `mcp`, by Blender Lab). From [blender.org/lab/mcp-server](https://www.blender.org/lab/mcp-server/), drag the **"Drag and Drop into Blender"** button into a Blender window — **twice**: the first drop adds the Blender Lab extension repository (`lab.blender.org`), the second installs the add-on. Alternatively download the zip and use Preferences → Get Extensions → **Install from Disk** ([manual](https://docs.blender.org/manual/en/latest/editors/preferences/extensions.html#install)).
   - **Allow Online Access** must be enabled (Preferences → System → Network) — the add-on refuses to start its bridge without it and reports *"Online access must be enabled in the system preferences"*.
   - **The MCP server package**, cloned locally (needs `git` and [`uv`](https://docs.astral.sh/uv/), Python ≥ 3.10):

     ```bash
     cd $HOME && git clone https://projects.blender.org/lab/blender_mcp.git
     ```

   - **Register with the MCP client.** For Claude Code:

     ```bash
     claude mcp add --scope user blender -- uv --directory $HOME/blender_mcp/mcp run blender-mcp
     ```

     For other clients, the equivalent config-file entry ([setup wiki](https://projects.blender.org/lab/blender_mcp/wiki/Setup); replace `$HOME` with an absolute path if the client doesn't expand variables):

     ```json
     { "mcpServers": { "blender": { "command": "uv", "args": ["--directory", "$HOME/blender_mcp/mcp", "run", "blender-mcp"] } } }
     ```

     Clients that support MCP bundles (e.g. Claude Desktop) can instead install the `.mcpb` package from the [releases page](https://projects.blender.org/lab/blender_mcp/releases).

   - **Registration is not binding.** MCP tools load at session start, so after registering, the user must restart the session/agent for `mcp__blender__*` tools to appear. Say so explicitly — and offer to proceed headless in the meantime rather than blocking on the restart.

3. **Start Blender's side.** Have the user launch Blender (5.1+). The add-on's bridge server **auto-starts by default** a few seconds after launch; if tools still can't connect, check Preferences → Add-ons → **MCP**: any startup error is shown there, and a **Start/Stop** button plus Host/Port settings (default `localhost:9876`) let them start it manually. Then re-probe (step 1).

### Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Add-on won't install / not listed in Get Extensions | Blender older than 5.1 | Update Blender ([blender.org/download](https://www.blender.org/download/)) |
| Add-on error: "Online access must be enabled…" | Blender's online access is off | Preferences → System → Network → **Allow Online Access** |
| `mcp__blender__*` tools absent from session | MCP never registered, or registered mid-session | Recommend headless (Path A), or setup step 2 + session restart |
| Tools exist but every call fails to connect | Blender closed, add-on disabled, or bridge not started | Setup step 3 — check the add-on's preferences panel for the startup error |
| `uv: command not found` when the client launches the server | `uv` not installed | Install per [docs.astral.sh/uv](https://docs.astral.sh/uv/) |
| Server can't reach Blender on a custom port | Add-on port changed but server still on 9876 | Match them: add-on prefs Host/Port vs `BLENDER_MCP_HOST`/`BLENDER_MCP_PORT` env vars on the server |
| Client config with `$HOME` fails | Client doesn't expand variables | Use the absolute path |

For anything deeper, point the user to the official docs: [blender.org/lab/mcp-server](https://www.blender.org/lab/mcp-server/) and the [project wiki](https://projects.blender.org/lab/blender_mcp/wiki/Setup).

## Workflow: round-trip through the scene folder

1. **Start clean — but never wipe the user's work.** Headless with `--factory-startup` starts from the default scene; just delete the default cube/light/camera. On the MCP, first inspect what's open (`get_objects_summary`): if it's Blender's default startup scene, delete those objects and proceed; if the user has their own file open with unsaved content, ask before touching it — work in a new empty scene/file instead of deleting their objects.
2. **Import the model from the scene's asset folder** (`assets/Models/`, or wherever the scene keeps it — check first, see the asset folder conventions in the parent SKILL.md): `bpy.ops.import_scene.gltf(filepath=...)`. Skip when authoring from scratch.
3. **Edit**, verifying as you go — viewport screenshots on the MCP (`get_screenshot_of_window_as_image` or the server's equivalent), numeric audits and rendered stills headless (Path A step 4).
4. **Run the pre-export checklist** (below), then **export back to the same path** as binary `.glb`. The dev server hot-reloads the file — no restart needed.
5. **Re-audit placement if the bounding box or pivot changed.** The entity's `Transform` was tuned for the old geometry; follow the model-swap audit in the parent SKILL.md (native bounding box → scale → pivot → world-space bounds vs. scene limits).
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
- **Count triangles before every export** (evaluated mesh, modifiers included — script in the patterns file) and report the number. Compare against the scene's remaining budget, not just the per-model guideline.

## RULE: All materials must be PBR (Principled BSDF)

The engine renders glTF **metallic-roughness PBR** materials only, and Blender's glTF exporter can only translate node setups built around a single **Principled BSDF** into that format. Anything else — Diffuse/Glossy/Mix shader graphs, procedural textures (Noise, Voronoi, gradients), texture nodes routed through color ramps — exports wrong or gets silently dropped.

- Every material: one Principled BSDF into the Material Output. Base Color, Metallic, Roughness, Normal, Emission, and Alpha translate cleanly.
- Procedural shading must be **baked to image textures** before export.
- Textures must be power-of-two and **at most 1024×1024** — the asset-bundle converter downscales anything larger, so authoring above 1024 wastes file size (see **optimize-scene**).
- Emissive surfaces: set Emission Color + Emission Strength on the Principled BSDF — this renders as expected in the engine.

## RULE: No lights or cameras in the export

The engine does not read lights or cameras from GLB files — they add file size and clutter for zero effect. Scene lighting is done through the SDK instead (see **lighting-environment**).

- Delete all light and camera objects before export (the default startup scene has one of each; a temp camera/light added for a headless verification render counts too).
- Belt-and-braces: export with `export_cameras=False` and `export_lights=False`.
- If the user asks to "light the model" in Blender, explain that lighting must be done in the SDK and point them to **lighting-environment**; Blender lights only affect Blender's own renders.

## RULE: Unify plain colors into one palette texture

Materials are one of the scarcest scene resources (**20 materials for a 1-parcel scene**, growing only logarithmically — see **optimize-scene**), and every extra material is an extra draw call. When a model (or a set of models) uses flat colors, do NOT create one material per color:

- Build a **single small palette texture** (e.g. 64×64 with a grid of color swatches), one material with that texture as Base Color, and UV-map each face to the center of its swatch. Use `Closest` interpolation so swatch edges don't bleed.
- **Share the same palette across all the scene's plain-colored models** — same texture file = one material and one texture engine-side.
- Adding a color later means filling an unused swatch, not adding a material.
- Full `bpy` scripts (build the palette image, assign faces to swatches) are in [`blender-patterns.md`](blender-patterns.md).

The same logic applies beyond plain colors: prefer one texture atlas over many small per-part textures.

## RULE: No materials on collider meshes

Collider meshes (name ending in `_collider`) are never rendered — the engine strips them to physics geometry. A material on a collider mesh still counts against the scene's material limit and bloats the file for zero visual effect.

- Clear all material slots on every `_collider` mesh before export (`obj.data.materials.clear()`).
- Keep colliders ultra-low-poly: boxes, planes, or convex hulls approximating the visible shape — never a copy of the detailed mesh.
- Name them `<meshName>_collider` and keep them in the export; the entity then needs `visibleMeshesCollisionMask: 0, invisibleMeshesCollisionMask: 3` on its `GltfContainer` (see the parent SKILL.md for the mask patterns).
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

Run through this before every export (scripts for each check in [`blender-patterns.md`](blender-patterns.md)):

1. Triangle count verified against budget.
2. All materials are Principled BSDF; procedural shading baked; textures ≤1024 power-of-two.
3. Plain colors unified into a palette texture, not per-color materials.
4. No lights, no cameras.
5. Collider meshes named `*_collider`, no material slots, low-poly.
6. Origin at **bottom-center** of the model so `Transform.position.y = 0` grounds it; rotation/scale applied (`transform_apply`).
7. Export as binary `.glb`, **+Y up** (exporter default — Decentraland is Y-up; a Z-up export loads tipped over), `export_apply=True`, `export_cameras=False`, `export_lights=False`, and `export_animation_mode='ACTIVE_ACTIONS'` if the file contains animations (the default mode leaks every action in the .blend into the GLB).

## Cross-References

- Parent **add-3d-models** SKILL.md — placing the exported GLB, collider masks, bounding-box audit after a model changes, asset folder conventions
- **optimize-scene** — full scene-limit table, texture sizing, back-face culling, `.dclignore`
- **advanced-rendering** — how the exported PBR materials surface in the SDK (`Material.setPbrMaterial`, texture modes)
- **animations-tweens** — playing the GLB's animation clips with `Animator`
- **lighting-environment** — lighting the scene through the SDK (since GLB lights are ignored)
- **unity-explorer-mcp** — verifying the edited model in-world with screenshots
