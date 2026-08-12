# Performance & content-budget debugging reference

Three read-only tools close a measurement loop: **what the scene contains** (`get_scene_content_stats`), **which assets that content comes from** (`get_scene_content_breakdown`), and **the frame rate a viewpoint actually produces** (`get_performance_stats`). Reach for them when the user asks whether a scene is within limits, why it runs slow, or what to optimize — not for gameplay verification (that's the main loop). All three are read-only and touch no shared profiler state.

Collection is **on demand**: each tool sets its own request flag and the scene world runs (or piggybacks) a counting pass, then the call waits for it to land. With every stats UI closed the scene does nothing until you ask, so the first call after a while pays for a pass — a counting cooldown is ~60 frames, which is up to a second and stretches to several at low FPS (10 s timeout). Nothing is cached across scenes; walking into a new scene resets the numbers.

## `get_scene_content_stats` — is the scene within budget?

No arguments. Returns the whole-scene counts — `entities`, `triangles`, `bodies` (renderers), `geometries` (unique meshes), `materials`, `textures`, `shaderVariants`, `colliders`, `videos` — with the documented per-parcel soft-limit cap alongside the four capped metrics (`entitiesCap`, `trianglesCap`, `bodiesCap`, `texturesCap`) scaled to `parcelCount`. `materials` is reported **without** a cap on purpose (see *Interpreting the counts*). `fresh: true` means a pass completed during the call; `false` means it timed out waiting and the values are from an earlier pass — treat those as stale and re-call. Start here; it tells you *which* budget is tight, then the breakdown tells you *who's* responsible.

## `get_scene_content_breakdown` — which assets to optimize

`limit?` (default 10, max 50), `sortBy?` — `triangles` (default), `materials`, `shaderVariants`, `drawCalls`, or `visibleTriangles`. Groups rendered content by **source model**: one entry per GLTF `src` plus one aggregate row for primitive meshes. Each entry carries `triangles` (+ `trianglesSharePercent` of the scene), `instances`, `renderers`, `materials`, `shaderVariants`, `drawCallsEstimate`, and a **visible subset for the current point of view** — `visibleRenderers`, `visibleTriangles` (+ `visibleTrianglesSharePercent`), `visibleDrawCallsEstimate`.

- The visible subset is **post-culling per `Renderer.isVisible`** (frustum + occlusion as the camera sees it, shadow casters included), so `sortBy=visibleTriangles` answers *"what does THIS viewpoint pay for"* rather than *"what's in the scene"*. **Position the camera first** (`move_to` / `set_camera_pose` / `look_at`) — the visible columns are only meaningful for wherever the camera currently points.
- Use it after `get_scene_content_stats` flags a metric near its cap: sort by that metric to find the top contributors, then read `instances` vs `renderers` — many instances of one source is an instancing story, one heavy source is a mesh-decimation story.

## `get_performance_stats` — the frame rate a viewpoint produces

`sampleSeconds?` (default 2, min 0.5, max 10). **The call blocks for the whole window** while it measures real frame times, so keep it short unless chasing intermittent hiccups. Returns render `averageFps` / `minFps` / `maxFps`, `averageFrameMs`, `maxFrameMs`, `hiccupFrames` (frames > 50 ms), `framesSampled`, and a `sceneTick` object (`averageFps` / `minFps` / `maxFps` / `targetFps`) or `null` when no scene is loaded or it hasn't ticked. `minFps` is the worst single frame — the number a user feels as a stutter. Render FPS is the client's; `sceneTick` is the scene's JS update rate against its target — a healthy render FPS with a `sceneTick` far under target points at scene script cost, not rendering.

## Interpreting the counts (say this to the user, don't just dump numbers)

- **Materials ≠ draw-call cost.** URP's SRP Batcher bins draws by **shader variant** (shader + enabled keywords), not by material, and keeps each material's properties in a persistent GPU buffer — many materials sharing few variants render cheaply. Judge per-frame draw-call risk by `shaderVariants`, not `materials`. A high material count with few variants is a **memory / texture** concern and a lost GPU-instancing opportunity (instancing needs identical materials), *not* a frame-time concern. Check `shaderVariants` before ever recommending material dedup as a performance fix.
- **`drawCallsEstimate` is pre-batching.** It counts material slots across renderers — an upper bound before the batcher and instancing collapse it. Use it to rank sources against each other, never as an absolute GPU cost.
- **`shaderVariants` is a lower-bound proxy.** It counts distinct variant bins, not per-frame SetPass calls; the batcher only merges *consecutive* same-variant draws, so interleaving can cause more switches than the bin count. A low count reliably proves material dedup won't buy frame time; a high one flags shader churn worth consolidating.
- **Caps are soft.** The documented per-parcel limits are warnings ("strong recommendations"), not enforced budgets — over a cap degrades performance but nothing is blocked. Correlate with measured cost before prescribing anything.

## The measurement loop

Don't prescribe an optimization from counts alone — **correlate content with measured frame rate**:

1. `get_scene_content_stats` → find the tight budget (a capped metric near or over 100%, or a high `shaderVariants`).
2. Position the camera at the viewpoint in question, then `get_performance_stats` → confirm the frame rate is actually a problem *there*. A metric over its soft cap on a scene that holds 60 fps at every real vantage is not worth churning.
3. `get_scene_content_breakdown` `sortBy=visibleTriangles` (or the tight metric) from that same viewpoint → name the sources that dominate what the camera pays for.
4. Recommend against the right lever: `visibleTriangles`-heavy → decimate/LOD or cull; high `materials` + low `shaderVariants` → texture-atlas / instance, not frame-time; high `shaderVariants` → consolidate shaders; heavy `instances` of one source → GPU instancing.

Sample from **retail camera modes** (`first_person` / `third_person`), not the free camera — that's the frame rate a player feels. As always, restore `set_camera_mode third_person` when you finish.
