# Renders, key art, logo and composition

All commands run from the scene root. `B=/Applications/Blender.app/Contents/MacOS/Blender` (macOS; on other OSes, find the `blender` binary as in `{baseDir}/../add-3d-models/references/blender-authoring.md`). Tested with Blender 5.1 and Pillow 12.

## Render framework (`promote/tools/render_shots.py`)

| Command | Output | Settings |
|---|---|---|
| `$B -b -P promote/tools/render_shots.py -- preview [shot …]` | `images/preview/<shot>.png` | 480 px, 12 samples (seconds per shot) |
| `$B -b -P promote/tools/render_shots.py -- final [shot …]` | `images/renders/<shot>.png` | 1600 px square, 128 samples |
| `$B -b -P promote/tools/render_shots.py -- keyart preview` | `images/preview/<KEYART_SHOT>_<w>x<h>.png` | ¼ size, 12 samples |
| `$B -b -P promote/tools/render_shots.py -- keyart` | `images/keyart/<KEYART_SHOT>_<w>x<h>.png` | `KEYART_SIZES`, 160 samples |

Measured on Apple Silicon (Metal + CPU): 2 previews in 8 s; 2 finals + 2 key-art sizes in about 4 min.

Helpers (edit only the per-scene settings and the `SHOTS` section):
- `reset(aspect=1.0, exposure=-0.7)`: factory-empty scene, Cycles with denoising, AgX "High Contrast", near-black world. Tries `prefs.compute_device_type = 'METAL'`, enables every device and silently falls back to CPU.
- `haze(density)`: world volume scatter for visible light shafts. Use 0.02 for subtle, 0.05–0.07 for thick.
- `load(path, at, rot=0, scale=1, align_long_x=False, anchor='bottom')`: imports a GLB under an empty and **normalises it by its world bounding box**, so its footprint centre sits at `at` on the floor whatever the GLB's origin is. `align_long_x` first turns long pieces (walls, benches, counters) so they run along X. Relative paths resolve under `MODELS` (`assets/Models`). Absolute paths work for asset-pack items elsewhere in `assets/`.
- `room(floor, wall, ceiling, tile=8, back_y, centre_wall, ceiling_z=6)`: 3×3 floor tiles at −tile/0/+tile, a three-piece back wall, an optional ceiling row.
- `light_area`, `light_point`, `camera(target, az, el, dist, lens, fstop)`, `text(...)` (emissive 3D text for boards and signs the scene fills at runtime), `render(name)`.
- Blender coordinates: X right, Y away from the camera at `az=0`, Z up. These are not DCL axes, which does not matter here because nothing goes back to the scene.

## Building a shot

1. **One shot per signature moment** from the design (the creature, the key checkpoint, the shop, the big set piece, one intimate detail). 4–6 by default.
2. **Build a small room from the scene's own kit pieces** (floor tiles, walls, a lit ceiling) so the render looks like the game. Props on a void look like an asset store.
3. **Centre a floor tile on the origin** (the 3×3 grid at −8/0/+8 for 8 m tiles). An even grid puts a tile seam through the middle of every shot.
4. **Doorways go in the centre wall slot** (`centre_wall=`). A doorway piece stacked in front of a plain wall shows a wall where the opening should be and hides whatever stands behind it.
5. Use one focal object, set dressing at different depths, and a camera at eye height or lower (`el` 3–15°) with DOF on (`fstop` 2–4).
6. Fill runtime-only content (departure boards, names, scores) with `text()`, using generic values only, never a real player's name.

## Lighting recipes (horror look, adapt per genre)

- **Fluorescent overhead**: `light_area((0,0,5.9), energy=300–750, size=(7,0.6))`, warm white.
- **One coloured accent**: a red or green `light_point` (energy 120–900) off to one side, or at a doorway. One accent per shot.
- **Silhouette**: a strong `light_area` *behind* a doorway, facing the camera (`rot=(radians(90),0,0)`, energy ~2000–4000, size 6×5), plus haze. A low-poly creature reads as a clean, scary shape. Lit from the front it looks like a low-poly model.
- **Cold transit**: blue points (0.35, 0.55, 1.0) down a corridor, a bright warm area light at the far end.
- **Darker look**: lower `exposure` in `reset()`. Prefer this to removing lights.

## Verify before the final pass

Read every preview PNG (combine them into one contact sheet with Pillow if there are many). Check for: models on their side or backwards (fix `rot` / `align_long_x`), walls blocking the subject, the subject cut off, a seam through the middle, too dark or blown out, empty frames. Fix, preview again, then go final. Read the finals too.

## What cannot be rendered

`AvatarShape` entities (NPCs, copies of the player, the player) are assembled from wearables at runtime in the Explorer. There is no GLB. Route them to footage. Effects that exist only at runtime (`ParticleSystem`, `Tween` motion, video screens, UI) render as nothing or as a static mesh. Pick other moments for stills.

## Key art

- **Reuse first**: if the scene's thumbnail or cover (`display.navmapThumbnail`, or a cover script in `design/tools/`) is a good image **without text**, put it in `keyart` in `posts.json`. `compose_social.py` centre-crops it to each size. If the cover has its title baked in, re-render it without the title (the Eeireport kit exec'd its `design/tools/cover.py` up to the title block, then rendered several sizes), or use a shot.
- **Rendered**: set `KEYART_SHOT` to a shot framed **with empty space for the title** (raise the camera target or lower the elevation so the subject sits low in frame). Run `-- keyart preview`, read it, then `-- keyart`.
- The wordmark goes inside the central ~60 % so 16:9, 1:1, 4:5 and 9:16 crops keep it. It must not cross the subject. Move it with `keyart_logo_y` (0.25–0.75) and check the result.
- The Worlds thumbnail limits (16:9, ≤ 1,048,576 bytes) apply only to the scene thumbnail. Social images have no such cap here, so keep them as PNG. Do not touch the scene thumbnail from this skill.

## Logo (`make_logo.py`)

- Three files in `promote/logo/`: `<slug>_wordmark.png` (transparent, hard offset shadow in `ink`; also used by `compose_social.py` and the page header), `<slug>_lockup_on_black.png` (wordmark, dashed rule, tagline), `<slug>_icon_1024.png` (glowing `icon_text` in `accent` over a dark tile checker, optional `icon_top` / `icon_bottom` labels).
- Fonts: a bold condensed display face. macOS ships `/System/Library/Fonts/Supplemental/Impact.ttf` (wordmark and glyph) and `DIN Condensed Bold.ttf` (tagline and labels). Match the scene's cover font if it has one, and pull `text` / `accent` colours from the scene's palette.
- Long taglines shrink automatically to fit the lockup. A long name just makes a wider wordmark.
- Expanded kit: flat `TEXT` / `INK` / `ACCENT` wordmarks (`wordmark(fill, None)`), and a themed variant built from the game's own iconography (Eeireport added a split-flap departures-board version).

## Composition (`compose_social.py`)

- Key art: wordmark at 58 % width (landscape) or 80 % (square), with a soft dark halo behind it for legibility.
- X header 1500×500: the middle band of the landscape plate, wordmark on `x_header_logo` side.
- Quote cards 1080×1080: render, bottom gradient, small `quote_tag` label in the accent colour, the line in upper-case DIN at 92 px (~28 characters per line), and a small wordmark bottom right. The script warns when a line is too wide. Break it with `\n`.
- Event-page banners (optional, `"event_banners": true` or `--events`): 1340×670 from the landscape key art and 716×1814 from the square one, wordmark at `keyart_logo_y`. Saved as progressive JPEG, stepping quality down from 92 by 4 until each file is ≤ 500,000 bytes. The script warns if it can't get there. The tall banner is a narrow centre strip, so check the subject survives the crop.
- Read the composed images: the logo must sit off the subject, lines must not overflow, and the tag must not collide with props.
