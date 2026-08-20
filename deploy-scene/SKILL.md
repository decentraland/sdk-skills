---
name: deploy-scene
description: Deploy a Decentraland scene to Genesis City (LAND-based). Use when the user wants to deploy or publish to parcels they own, or reduce the deployed scene size. Do NOT use for Worlds deployment (see deploy-worlds).
---

# Deploying to Genesis City

Deploy to specific parcels you own or have permission to deploy to.

**Use the `/deploy` command** to deploy. It runs `npx @dcl/sdk-commands deploy` and handles the full process:
1. Build the scene
2. Upload assets to IPFS
3. Deploy to the specified parcels
4. Requires a wallet with LAND or deployment permissions

> **Deploying to a World instead?** See the `deploy-worlds` skill for Worlds deployment (personal spaces using DCL NAMEs or ENS domains).

## Pre-Deployment Checklist

Before deploying, verify:

1. **scene.json is valid**:
   - `ecs7: true` and `runtimeVersion: "7"`
   - Correct `parcels` matching your LAND (for Genesis City)
   - Valid `base` parcel
   - `main: "bin/index.js"`

2. **Code compiles**:
   ```bash
   npx tsc --noEmit
   ```

3. **Scene previews correctly**:
   Use the `preview` tool to verify the scene works (or `npx @dcl/sdk-commands start` manually, optionally with `--web` to preview in the Bevy Web browser client). Test with multiple browser tabs to verify multiplayer behavior.

4. **Dependencies installed**:
   ```bash
   npm install
   ```

5. **Assets are within limits** — see the **optimize-scene** skill for full limit formulas per parcel count (triangles, entities, materials, textures, height). Keep scene load time under 15 seconds by optimizing assets.

6. **`.dclignore` covers all working files** — Blender/FBX sources, concept art, spreadsheets, markdown docs, etc. must not be uploaded. See the `.dclignore` section below.

## Deployment Process

### Using CLI
```bash
# Build first
npx @dcl/sdk-commands build

# Deploy (will open browser for wallet connection)
npx @dcl/sdk-commands deploy
```

### Using Creator Hub
1. Open Creator Hub
2. Select your scene
3. Click "Publish"
4. Connect wallet
5. Confirm transaction

## scene.json for Deployment

```json
{
  "ecs7": true,
  "runtimeVersion": "7",
  "display": {
    "title": "My Awesome Scene",
    "description": "A description for the marketplace",
    "navmapThumbnail": "images/thumbnail.png"
  },
  "scene": {
    "parcels": ["0,0", "0,1"],
    "base": "0,0"
  },
  "main": "bin/index.js"
}
```

`display.navmapThumbnail` sets the image shown for the scene on the Genesis City map — always provide one, and write a clear `display.description` for discovery.

### Spawn Points

Configure where players appear when entering the scene:

```json
{
  "spawnPoints": [
    {
      "name": "spawn1",
      "default": true,
      "position": { "x": [1, 5], "y": [0, 0], "z": [2, 4] },
      "cameraTarget": { "x": 8, "y": 1, "z": 8 }
    }
  ]
}
```

Position ranges (e.g., `[1, 5]`) spawn players randomly within the range. Use `cameraTarget` to orient the player's camera on spawn.

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

**Never ignore files the scene needs at runtime:** `bin/index.js`, `scene.json`, `assets/` (composites, .glb models, textures, sounds, video), thumbnails referenced in `scene.json`, or any file path referenced in code. Note the default ignores `*.ts`/`src` — only the compiled `bin/index.js` runs, so source code is never needed in the upload.

## Post-Publish: Asset Bundle Conversion

After every publish, the content servers compress all `.gltf`/`.glb` models to asset bundles — a significantly lighter format. The conversion starts immediately but is queued per platform (Windows, Mac). While it runs, players are deliberately served the **last fully-working version** of the scene.

- **Typical time:** ~15 minutes, but plan for **30-60 minutes** until the new version is reliably playable by everyone.
- **Before a live event:** publish your final version **at least 2 hours** in advance. Avoid republishing while waiting — each publish restarts the queue.
- **Check conversion status** in a browser:
  - `https://asset-bundle-registry.decentraland.org/entities/status/<pointer>` — replace `<pointer>` with a scene coordinate (e.g. `20,-34`) or the deployment entity ID. Shows per-platform status under `assetBundles` and LOD status under `lods`. For a World, append `?world_name=myname.dcl.eth`.
  - `https://asset-bundle-registry.decentraland.org/queues/status` — lists all scenes currently queued for conversion, per platform.
- **`/detectabs` chat command:** in-world, tints models green (converted) or red (not yet converted).
- **Reloading the scene is not enough** to pick up a new version — reload restarts the scene's code but doesn't fetch newly published content. After conversion completes, fully quit and relaunch Decentraland, then re-enter via jump link or `/goto`.

You can also catch conversion issues **before** publishing by enabling local asset bundles in preview — see the **optimize-scene** skill ("Local Asset Bundle Preview").

## Troubleshooting

| Error | Cause | Solution |
|-------|-------|----------|
| "You don't have permission to deploy" | Wallet doesn't own the target LAND/parcels | Verify LAND ownership on the marketplace, or get deployment permissions from the LAND owner |
| "Scene is too large" | Assets exceed parcel size limits | First add all working files (Blender/FBX sources, concept art, docs) to `.dclignore` — see the `.dclignore` section above. Then check triangle count, file sizes, and texture counts against the limits. See **optimize-scene** skill |
| Wallet connection fails | Browser popup blocked or MetaMask locked | Allow popups, unlock MetaMask, refresh and try again |
| "Invalid scene.json" | Missing required fields or malformed JSON | Verify `ecs7: true`, `runtimeVersion: "7"`, valid `parcels` array, and `main: "bin/index.js"` |
| Deploy succeeds but scene is empty | `main` field doesn't point to compiled output | Ensure `main` is `"bin/index.js"` and run `npx @dcl/sdk-commands build` first |
| Catalyst rejection | Content violates Decentraland content policies | Review content guidelines at docs.decentraland.org |
| Scene looks broken right after deploy | Asset bundle conversion not done yet | Type `/detectabs` in chat — red-tinted models are not yet converted. Check conversion status (see above) and wait |
| Some players see old version, others see new | Per-platform conversion finishes at different times + client caching | Check both `windows` and `mac` under `assetBundles` in the conversion status endpoint. Once both are `complete`, affected players must fully restart Decentraland |
| Publication stuck on Converting stage | Scene queued behind other conversions, or conversion failed | Check the queue status URL for your entity ID. If not queued, check conversion status — if a platform shows `failed`, republish. If it fails again, report the bug with the entity ID |
| 3D models missing, black, or untextured after deploy | Conversion still in progress, or textures exceed 512x512 cap | `/detectabs` to check; textures in 3D models are capped to 512x512 during conversion |
| Scene looks fine up close but broken from a distance | LOD generation (final publish stage) not done yet | Check the `lods` values in the conversion status endpoint; LODs don't block close-range testing |

### Genesis City vs Worlds

| | Genesis City | Worlds |
|-|-------------|--------|
| **Requirement** | Own LAND parcels | Own DCL NAME or ENS domain |
| **Parcel limits** | Enforced (entity/triangle budgets per parcel) | Not constrained by LAND |
| **Visibility** | Shown on the Genesis City map | Listed on Places page (opt-out available) |
| **Deploy target** | Default Catalyst network | `--target-content https://worlds-content-server.decentraland.org` |
| **Best for** | Permanent installations, high-traffic scenes | Testing, personal spaces, events |

> **Deploying to a World instead?** See the **deploy-worlds** skill.

## Scene Tipping

Let visitors send MANA tips to the scene creator. Add a `creator` field to `scene.json`:

```json
{
  "creator": "0x1234567890123456789012345678901234567890"
}
```

When set, a **piggy bank icon** appears in the top-left for visitors. Clicking it opens a MANA tip modal. If the address is linked to a Decentraland NAME, the name is shown in the modal. Creators receive an in-app notification for each tip.

Can also be configured via Creator Hub → scene Settings → Details → **Creator wallet address**.
