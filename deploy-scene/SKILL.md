---
name: deploy-scene
description: Deploy a Decentraland scene to Genesis City (LAND-based). Use when the user wants to deploy or publish to parcels they own, reduce the deployed scene size, upload a large scene, script or cancel a deploy, or hits a DEPLOY_* error. Do NOT use for Worlds deployment (see deploy-worlds).
---

# Deploying to Genesis City

Deploy to specific parcels you own or have permission to deploy to.

Deploy with `npx @dcl/sdk-commands deploy` (or the Creator Hub's **Publish** button). It builds the scene, uploads it to IPFS and asks a wallet that owns the parcels (or has deploy permission) to sign.

## Pre-Deployment Checklist

Before deploying, verify:

1. **scene.json is valid**:

   - `ecs7: true` and `runtimeVersion: "7"`
   - Correct `parcels` matching your LAND (for Genesis City)
   - Valid `base` parcel
   - `main: "bin/index.js"`

2. **Discovery metadata is complete** — these four fields decide whether anyone finds and enters the scene, and they are frequently left at template defaults. Check each one and fill in what you can infer from the scene itself; ask the user only for what you can't:

   - `display.title` — the scene name, shown under the minimap in-world and in the map modal
   - `display.description` — one or two sentences on what the scene is
   - `tags` — root-level array, 1-3 Places-dApp categories inferred from the scene's theme. Valid values: `{baseDir}/../create-scene/references/scene-json.md` → Tags (scene categories)
   - `display.navmapThumbnail` — set, and the image passes every check in **Thumbnail image** below

3. **Code compiles**:

   ```bash
   npx tsc --noEmit
   ```

4. **Scene previews correctly**:
   Run `npx @dcl/sdk-commands start` to verify the scene works (add `--web` to preview in the Bevy Web browser client). Test with multiple browser tabs to verify multiplayer behavior.

5. **Dependencies installed**:

   ```bash
   npm install
   ```

6. **Assets are within limits** — see the **optimize-scene** skill for full limit formulas per parcel count (triangles, entities, materials, textures) and the flat 330 m height limit. Keep scene load time under 15 seconds by optimizing assets.

   Then do a **size pass on what will actually upload**, before the deploy rather than after a rejection:

   ```bash
   find assets -type f -size +1M -exec ls -lh {} +        # the heavy files
   npx @gltf-transform/cli inspect assets/Models/big.glb   # Textures table: each embedded map's resolution and bytes
   ```

   Embedded 2048 px texture maps are the usual surprise — two generated GLBs carried 17 MB of them in a 34 MB scene. Resize them to 1024 or less (`npx @gltf-transform/cli resize in.glb out.glb --width 1024 --height 1024`, or in Blender — see **optimize-scene**): the converter downscales to 1024 anyway, and the raw file still counts in full. Estimate code size from a production build, not from the project's `bin/index.js`: the preview's dev build carries an inline source map and no minification, while `deploy` rebuilds with `--production` (minified, no map), typically a fraction of the size.

7. **`.dclignore` covers all working files** — Blender/FBX sources, concept art, spreadsheets, markdown docs, etc. must not be uploaded. See the `.dclignore` section below.

## Deployment Process

### Using CLI

```bash
# Build first
npx @dcl/sdk-commands build

# Deploy (will open browser for wallet connection)
npx @dcl/sdk-commands deploy
```

Scenes of **50 MiB or more** upload in 32 MiB batches (`@dcl/sdk-commands` 7.31.0+), printing `Uploaded X MB of Y MB (batch n/N)`; smaller ones go in one request. The linker page shows the upload progress and can cancel it. Batch rules, every flag, the `/api/deploy` API for scripting, following or cancelling a deploy, and the `DEPLOY_*` error codes: `{baseDir}/references/deploy-cli.md`.

### Using Creator Hub

1. Open Creator Hub
2. Select your scene
3. Click "Publish"
4. Connect wallet
5. Confirm transaction

### The link to share after publishing

The success panel shows and copies a **web `/jump` link**, which works for players without the desktop client; its **Jump In** button opens the desktop client separately. Use the same forms in anything you write for players:

| Target | Share link |
| --- | --- |
| Genesis City scene | `https://decentraland.org/jump?position=x,y` |
| World | `https://decentraland.org/jump?realm=NAME.dcl.eth` |
| Desktop client directly | `decentraland://?position=x,y&dclenv=<env>` (or `?realm=…`) |

`/jump` is canonical — the legacy `/play/...` paths only 301-redirect to it, so do not generate them.

## scene.json for Deployment

```json
{
  "ecs7": true,
  "runtimeVersion": "7",
  "display": {
    "title": "My Awesome Scene",
    "description": "A description for the marketplace",
    "navmapThumbnail": "assets/Images/thumbnail.png"
  },
  "tags": ["art", "social"],
  "scene": {
    "parcels": ["0,0", "0,1"],
    "base": "0,0"
  },
  "main": "bin/index.js"
}
```

`tags` is root-level, not under `display`. Every field: `{baseDir}/../create-scene/references/scene-json.md`.

### Thumbnail image

`display.navmapThumbnail` is the image players see in the map modal when they select the scene's parcels, and in the confirmation screen when another scene teleports them there. Always provide one.

Spec:

- `.png` or `.jpg`, **16:9** within 1 % (the Creator Hub validates this), recommended **1920x1080 px** (1344x756 for a lighter file). Other sizes work as long as they keep 16:9 — anything else is stretched
- **Central square safe area:** parts of the platform show a square crop of the central **1080x1080 px**, cutting ≈ 0.219 of the width off each side (x 420–1500 at 1920 wide, x 280–1000 at 1280 wide). Keep text, logos and the main subject inside it
- **Under 1 MB (1,048,576 bytes)** — the Worlds content server rejects anything larger at deploy time (`Invalid thumbnail: size … exceeds maximum of 1048576 bytes (1MB)`), and a plain 1920x1080 PNG can exceed it. Nothing local warns you. For a generated cover (Blender render, image tool), export JPEG at high quality: `ffmpeg -i cover.png -q:v 2 cover.jpg` came out around 100 KB at 1344x756. Keep a PNG only if it stays under the cap
- Value is a path inside the project (e.g. `assets/Images/thumbnail.png`) or a URL to an externally hosted image — an external host must serve permissive CORS headers
- Save a custom cover under its own name (e.g. `assets/Images/cover.png`). The Creator Hub overwrites `assets/Images/autogenerated-thumbnail.png` with a viewport capture whenever it auto-generates a thumbnail, including right before a publish

**Check before pointing `navmapThumbnail` at an image**, whether you captured, rendered or composed it:

1. Byte size and dimensions: `ls -l <path>`, then `sips -g pixelWidth -g pixelHeight <path>` (macOS) or `magick identify -format "%wx%h\n" <path>`.
2. Crop the central square and look at that, not at the full frame (a title running edge to edge looks fine in the full frame):

   ```bash
   OUT="${TMPDIR:-/tmp}/thumb-square.png"
   # macOS
   H=$(sips -g pixelHeight <path> | awk '/pixelHeight/{print $2}'); sips -c $H $H <path> --out "$OUT"
   # ImageMagick (any OS)
   H=$(magick identify -format %h <path>); magick <path> -gravity center -crop ${H}x${H}+0+0 +repage "$OUT"
   ```

3. Read the square image. **Done when** every word of the text and the main subject are inside it, the ratio is 16:9 and the file is under 1 MB. Otherwise recapture or re-render.

**Capture it yourself — ask the user if instead of providing an image they prefer you to capture it** With the **unity-explorer MCP** (see the **unity-explorer-mcp** skill), run the scene in preview, move the camera to frame a shot that shows what the scene is about — composing so the essential content sits in the middle third, inside the central square — and capture a UI-less PNG with the bundled script:

```bash
# <skill-dir> is the unity-explorer-mcp skill's base directory
<skill-dir>/scripts/screenshot.sh --world-only --png -w 1920 -o assets/Images/thumbnail.png
```

Launching the client windowed at 16:9 (`npm run start -- --mcp -- --windowed-mode --resolution 1920x1080`) makes the frame 16:9 natively, so no crop is needed. Otherwise normalize it:

```bash
# ImageMagick: center-crop to 16:9 and resize, in one step
magick assets/Images/thumbnail.png -resize 1920x1080^ -gravity center -extent 1920x1080 assets/Images/thumbnail.png

# macOS, no extra tooling: -c takes HEIGHT then WIDTH, both centered
sips -g pixelWidth -g pixelHeight assets/Images/thumbnail.png   # read the source size first
sips -c 1080 1920 assets/Images/thumbnail.png --out assets/Images/thumbnail.png   # center-crop a larger frame
sips -z 1080 1920 assets/Images/thumbnail.png                              # then resample to exactly 1920x1080
```

Point `display.navmapThumbnail` at the resulting path. Only if the MCP is unavailable, ask the user for an image rather than shipping the scene without one. Make sure `.dclignore` doesn't exclude the thumbnail — it must be uploaded with the scene.

**Letter case matters.** The path in `navmapThumbnail` must match the folder on disk **exactly**: the deploy file list preserves on-disk casing and the Catalyst matches case-sensitively, while macOS and Windows resolve either casing locally — so a mismatch publishes as `Scene thumbnail '…' must be a file included in the deployment` and never shows up in testing. In a Creator Hub project the standard folder is **`assets/Images/`** (capital I), which is also where the Hub writes its own autogenerated capture. `ls assets` before writing the path, and never keep two folders differing only in case.

### Spawn Points

Spawn points: `{baseDir}/../create-scene/references/scene-json.md` → Spawn Points.

## .dclignore — Exclude Files from Upload

The `.dclignore` file, always at the **project root**, lists files and patterns that are **NOT uploaded** to the content server when deploying. Everything in the project folder that isn't matched by `.dclignore` gets uploaded, and the uploaded total counts against the per-parcel MB limits — so only files the running scene actually needs should be deployed.

Format: one glob pattern per line. The default from scene templates:

```
.*
package-lock.json
yarn-lock.json
build.json
export
tsconfig.json
tslint.json
node_modules
*.ts
*.tsx
.vscode
Dockerfile
dist
README.md
*.blend
*.fbx
*.zip
*.rar
*.md
src
```

**Keep it up to date as the project grows.** Whenever working files exist in the project — Blender or other 3D source files, draft models, concept art, PSDs, spreadsheets, markdown notes, reference photos — add them (or their extensions) to `.dclignore` so the deployed scene stays as light as possible. When creating or editing a scene, add these patterns proactively; don't wait for the deploy to fail. Common additions:

```
*.blend
*.blend1
*.fbx
*.psd
*.kra
*.xcf
*.md
*.csv
*.xlsx
drafts
concept-art
reference
```

If a deploy fails with **"Scene is too large"**, checking `.dclignore` is the first step: working files are often the bulk of the excess, and excluding them reduces upload size with zero impact on the scene.

**Keep these uploaded:** `bin/index.js`, `scene.json`, `assets/` (composites, .glb models, textures, sounds, video), the thumbnail referenced in `scene.json`, and any file path referenced in code. The default ignores `*.ts`/`src` because only the compiled `bin/index.js` runs.

## Post-Publish: Asset Bundle Conversion

After every publish, the content servers compress all `.gltf`/`.glb` models to asset bundles — a significantly lighter format. The conversion starts immediately but is queued per platform (Windows, Mac). While it runs, players are deliberately served the **last fully-working version** of the scene.

- **Typical time:** **seconds.** Longer for very large scenes or when the conversion servers are busy.
- **A conversion running more than a couple of minutes is a failure signal**, not normal queuing — check the status endpoint rather than continuing to wait.
- **The Jump In button appears as soon as the scene is playable**, once upload and conversion are done.
- **Before a live event:** publish your final version **at least one hour** in advance, to leave room for anything unexpected. Avoid republishing while waiting — each publish restarts the queue.
- **Check conversion status** in a browser:
  - `https://asset-bundle-registry.decentraland.org/entities/status/<pointer>` — replace `<pointer>` with a scene coordinate (e.g. `20,-34`) or the deployment entity ID. Shows per-platform status under `assetBundles` and LOD status under `lods`. For a World, append `?world_name=myname.dcl.eth`.
  - `https://asset-bundle-registry.decentraland.org/queues/status` — lists all scenes currently queued for conversion, per platform.
- **`/detectabs` chat command:** in-world, tints models green (converted) or red (not yet converted).
- **Reloading the scene is not enough** to pick up a new version — reload restarts the scene's code but doesn't fetch newly published content. **Any player who already loaded the scene this session keeps seeing the cached version until they fully close and re-enter Decentraland.** That includes you: after conversion completes, quit and relaunch, then re-enter via jump link or `/goto`.

You can also catch conversion issues **before** publishing by enabling local asset bundles in preview — see the **optimize-scene** skill ("Local Asset Bundle Preview").

## Troubleshooting

| Error                                                | Cause                                                                | Solution                                                                                                                                                                                                                                                                                           |
| ---------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "You don't have permission to deploy"                | Wallet doesn't own the target LAND/parcels                           | Verify LAND ownership on the marketplace, or get deployment permissions from the LAND owner                                                                                                                                                                                                        |
| "Scene is too large"                                 | Assets exceed parcel size limits                                     | First add all working files (Blender/FBX sources, concept art, docs) to `.dclignore` — see the `.dclignore` section above. Then check triangle count, file sizes, and texture counts against the limits. See **optimize-scene** skill                                                              |
| Wallet connection fails                              | Browser popup blocked or MetaMask locked                             | Allow popups, unlock MetaMask, refresh and try again                                                                                                                                                                                                                                               |
| "Invalid scene.json"                                 | Missing required fields or malformed JSON                            | Verify `ecs7: true`, `runtimeVersion: "7"`, valid `parcels` array, and `main: "bin/index.js"`                                                                                                                                                                                                      |
| Deploy succeeds but scene is empty                   | `main` field doesn't point to compiled output                        | Ensure `main` is `"bin/index.js"` and run `npx @dcl/sdk-commands build` first                                                                                                                                                                                                                      |
| Catalyst rejection                                   | Content violates Decentraland content policies                       | Review content guidelines at docs.decentraland.org                                                                                                                                                                                                                                                 |
| Scene looks broken right after deploy                | Asset bundle conversion not done yet                                 | Type `/detectabs` in chat — red-tinted models are not yet converted. Check conversion status (see above) and wait                                                                                                                                                                                  |
| Some players see old version, others see new         | Per-platform conversion finishes at different times + client caching | Check both `windows` and `mac` under `assetBundles` in the conversion status endpoint. Once both are `complete`, affected players must fully restart Decentraland                                                                                                                                  |
| Publication stuck on Converting stage                | Conversion failed, or the scene is queued behind others              | Conversion normally takes seconds, so more than a couple of minutes points at a failure rather than a queue. Check the queue status URL for your entity ID. If not queued, check conversion status — if a platform shows `failed`, republish. If it fails again, report the bug with the entity ID |
| 3D models missing, black, or untextured after deploy | Conversion still in progress, or textures exceed the conversion cap  | `/detectabs` to check; textures in 3D models are capped to **1024x1024** during conversion                                                                                                                                                              |
| Scene looks fine up close but broken from a distance | LOD generation (final publish stage) not done yet                    | Check the `lods` values in the conversion status endpoint; LODs don't block close-range testing                                                                                                                                                                                                    |
| "Scene thumbnail '…' must be a file included in the deployment" (the file plainly exists) | Letter-case mismatch between `display.navmapThumbnail` and the folder on disk (e.g. `assets/images/` vs `assets/Images/`) | `ls assets` and make the path match the folder exactly — see **Thumbnail image** → Letter case |
| "Invalid thumbnail: size … exceeds maximum of 1048576 bytes" | Thumbnail over 1 MB (a plain 1920x1080 PNG can be) | Export JPEG or shrink to 1344x756 — see **Thumbnail image** |
| `DEPLOY_PARTIAL_NOT_SUPPORTED` | The server can't take batched uploads and the content it is missing is over 200 MB | Shrink the scene (`.dclignore`, texture sizes) or deploy to a server that supports batches — `{baseDir}/references/deploy-cli.md` |
| `DEPLOY_CANCEL_OUTCOME_UNCERTAIN` | A cancel landed mid-upload and the CLI couldn't tell whether the server published it | Check the scene (conversion status URL above) before deploying again |

### Genesis City vs Worlds

|                   | Genesis City                                  | Worlds                                                            |
| ----------------- | --------------------------------------------- | ----------------------------------------------------------------- |
| **Requirement**   | Own LAND parcels                              | Own DCL NAME or ENS domain                                        |
| **Parcel limits** | Enforced (entity/triangle budgets per parcel) | Not constrained by LAND                                           |
| **Visibility**    | Shown on the Genesis City map                 | Listed on Places page (opt-out available)                         |
| **Deploy target** | Default Catalyst network                      | `--target-content https://worlds-content-server.decentraland.org` |
| **Best for**      | Permanent installations, high-traffic scenes  | Testing, personal spaces, events                                  |

To deploy to a World, use **deploy-worlds**.

## Scene Tipping

To let visitors tip the scene creator in MANA, set the root-level `creator` wallet address in `scene.json`: `{baseDir}/../create-scene/references/scene-json.md` → Fields.
