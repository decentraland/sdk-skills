---
name: deploy-worlds
description: Deploy a Decentraland scene to a World (personal 3D space using a DCL NAME or ENS domain). Use when the user wants to deploy to a World or use a DCL NAME/ENS domain. Do NOT use for Genesis City LAND deployment (see deploy-scene).
---

# Deploying to Decentraland Worlds

Worlds are personal 3D spaces not tied to LAND. They have no parcel limitations and are automatically listed on the Places page.

## Requirements

To publish to a World, the user must own either:
- A **Decentraland NAME** (e.g., `my-name.dcl.eth`)
- An **ENS domain** (e.g., `my-name.eth`)

The wallet signing the deployment must own the NAME, or have been granted permission via Access Control Lists (ACL).

## Storage Budget

Scenes deployed to Worlds count against a storage budget shared across all Worlds owned by the same wallet. The budget is calculated dynamically from the wallet's holdings:

- Each **Decentraland NAME** owned grants **100 MB** (as well as a World).
- Each **LAND parcel** owned grants an additional **100 MB**.
- Every **2,000 MANA** held in the wallet grants another **100 MB**.
- **ENS-domain Worlds** have a fixed limit of **36 MB** that cannot be expanded.

The budget can be distributed across multiple Worlds however the user likes. Check usage in the **Manage** section of the Creator Hub (click **View Details** for a breakdown), or in the **Worlds** tab of the [Builder](https://decentraland.org/builder/worlds).

If the budget is exceeded (e.g. after selling/transferring assets), there is a **48-hour grace period** to free space before Worlds become inaccessible. Regain access by acquiring more MANA/NAMEs/LAND or undeploying scenes.

## 1. Configure scene.json

Add a `worldConfiguration` section to `scene.json`:

```json
{
  "worldConfiguration": {
    "name": "my-name.dcl.eth"
  }
}
```

The `name` field must match a Decentraland NAME or ENS domain owned by the deploying wallet.

### Opt out of Places listing

All Worlds are automatically listed on the [Places page](https://places.decentraland.org). To opt out:

```json
{
  "worldConfiguration": {
    "name": "my-name.dcl.eth",
    "placesConfig": {
      "optOut": true
    }
  }
}
```

### Discovery metadata

Worlds are listed on Places unless opted out, so the same metadata that drives discovery in Genesis City applies here. Before publishing, verify all four are set — fill in what you can infer from the scene, ask the user only for the rest:

- `display.title` — the World's name
- `display.description` — one or two sentences on what it is
- `tags` — root-level array, 1-3 Places-dApp categories from the predefined list: `"art"`, `"game"`, `"casino"`, `"social"`, `"music"`, `"fashion"`, `"crypto"`, `"education"`, `"shop"`, `"business"`, `"sports"`, `"parkour"`
- `display.navmapThumbnail` — `.png`, 228x160 px recommended, 196x143 minimum. For the full spec and a capture procedure, see the **deploy-scene** skill ("Thumbnail image")

## 2. Deploy

**Use the `/deploy` command** — it auto-detects the `worldConfiguration` in scene.json and deploys to the Worlds content server automatically.

Alternatively, deploy manually via CLI:

```bash
npx @dcl/sdk-commands deploy --target-content https://worlds-content-server.decentraland.org
```

This will prompt the user to sign the deployment with their wallet. Validations run automatically to allow or reject the scene.

Files matched by `.dclignore` (at the project root) are excluded from the upload — keep working files like Blender sources, concept art, and markdown docs listed there so the World stays light. See the `.dclignore` section in the **deploy-scene** skill.

### Via Creator Hub

1. Open the scene project in Creator Hub
2. Click the **Publish** button (top-right corner)
3. Select **PUBLISH TO WORLD**
4. Choose which NAME or ENS domain to publish to

## 3. Access the World

After a successful deploy, the `/deploy` command outputs a visit URL automatically. The World is also accessible at:

```
https://decentraland.zone/bevy-web?realm=NAME.dcl.eth
```

From inside Decentraland, use the chatbox command:
```
/goto NAME.dcl.eth
```

## Full scene.json Example

```json
{
  "ecs7": true,
  "runtimeVersion": "7",
  "display": {
    "title": "My World",
    "description": "A personal 3D space",
    "navmapThumbnail": "images/thumbnail.png"
  },
  "tags": ["social"],
  "scene": {
    "parcels": ["0,0"],
    "base": "0,0"
  },
  "main": "bin/index.js",
  "worldConfiguration": {
    "name": "my-name.dcl.eth"
  }
}
```

## World Configuration Options

Beyond `name` and `placesConfig`, `worldConfiguration` supports skybox and minimap customization:

```json
"worldConfiguration": {
  "name": "my-name.dcl.eth",
  "skyboxConfig": {
    "fixedTime": 43200
  },
  "placesConfig": {
    "optOut": false
  }
}
```

- `skyboxConfig.fixedTime` — verified against the engine test scenes and current docs.
- `skyboxConfig.textures`, `miniMapConfig` (`visible`/`dataImage`/`estateImage`) — [UNVERIFIED: not present in the engine test scenes or the current scene-metadata docs; confirm against js-sdk-toolchain scene schema before relying on them].

**`skyboxConfig.fixedTime` values:**

Values are seconds since midnight; a full day is `86400`.

| Value | Time of day |
|-------|------------|
| `0` | Midnight |
| `21600` | 6 AM (sunrise) |
| `43200` | Noon |
| `64800` | 6 PM (sunset) |
| `86400` | Full day (maximum) |

Any value above `86400` is interpreted as midnight. Omit `fixedTime` for a dynamic day/night cycle.

`worldConfiguration.skyboxConfig.fixedTime` is verified working in the engine test scenes, and takes precedence over a top-level `skyboxConfig.fixedTime` if both are present. See the **lighting-environment** skill for runtime control (the `SkyboxTime` component, which overrides either JSON value).

## Multi-Scene Worlds

A World can host multiple independent scenes, each at different coordinates. The World grows and shrinks dynamically as scenes are added or removed, and gaps between scenes are filled with environment.

**Enable via Creator Hub:** When publishing, toggle **Multi-Scene World (advanced)** on the first publish.

**Deploy via CLI:**
```bash
npm run deploy -- --multi-scene --target-content https://worlds-content-server.decentraland.org
```

After enabling, the World Owner can:
- Publish additional scenes to different parcels of the same World
- Add **Collaborators** with deploy rights (all parcels or specific coordinates)
- Manage layout via the **Layout** tab in World Settings (remove scenes, view the World map)
- Set a **World Spawn Position** (which parcel players enter on)

**Collaborator note:** Collaborators with "All Parcels" access can overwrite any scene in the World, including those published by the owner.

To deploy as a collaborator, use the normal `deploy` process — the publishing flow will let you select only the parcels you have access to.

## Post-Publish Conversion

Worlds go through the same asset bundle conversion as Genesis City scenes — 3D models are compressed server-side after each publish. Plan for 30-60 minutes until the new version is reliably playable. For timing details, conversion status endpoints, and the `/detectabs` chat command, see the **deploy-scene** skill ("Post-Publish: Asset Bundle Conversion"). Use **Optimize Assets** (or `--local-ab`) in preview to catch conversion issues before publishing.

## Troubleshooting

| Error | Cause | Solution |
|-------|-------|----------|
| "NAME not found" or "NAME not owned" | The wallet signing the deployment doesn't own the NAME/ENS in `worldConfiguration.name` | Verify NAME ownership at `https://builder.decentraland.org/names`. The wallet used for signing must own the exact NAME |
| ENS resolution fails | ENS domain not registered or expired | Check ENS registration at `https://app.ens.domains` |
| "Scene too large" | Scene exceeds the World storage budget (see **Storage Budget** above) | First add all working files (Blender/FBX sources, concept art, docs) to `.dclignore` at the project root so they aren't uploaded — see the `.dclignore` section in **deploy-scene**. Then reduce asset sizes. Check remaining budget in the Creator Hub **Manage** tab or the Builder **Worlds** tab |
| Deploy succeeds but world is empty | `main` field misconfigured | Ensure `main` is `"bin/index.js"` and code compiles |
| World not showing on Places | Propagation delay | Wait a few minutes after deployment. If opted out via `placesConfig.optOut`, it won't appear |

## Example scenes

- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/3,0-skybox-world-json — a World scene setting a fixed skybox time via `worldConfiguration.skyboxConfig.fixedTime`, and reading it back with `getSceneInformation`.

> **Deploying to Genesis City instead?** See the **deploy-scene** skill.

## Key Differences from Genesis City

- **No parcel limitations** — Worlds are not constrained by LAND ownership
- **NAME/ENS required** — must own a Decentraland NAME or ENS domain instead of LAND
- **Different deploy target** — uses `--target-content https://worlds-content-server.decentraland.org`
- **Auto-listed on Places** — unless opted out via `placesConfig.optOut`
