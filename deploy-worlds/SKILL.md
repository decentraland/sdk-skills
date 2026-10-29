---
name: deploy-worlds
description: Deploy a scene to a Decentraland World (DCL NAME or ENS domain). Use for World publishing, the World storage budget or "scene too large", multi-scene Worlds and collaborators, or a World name or description not updating on Places. For Genesis City LAND see deploy-scene.
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

**Size the upload before publishing**, not after: run the size pass in the **deploy-scene** pre-deployment checklist (heavy GLBs with embedded 2048 px texture maps are the usual surprise, and the project's `bin/index.js` is a dev build several MB larger than the minified bundle `deploy` uploads).

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

A World is listed on Places unless opted out, so before publishing run **deploy-scene**'s metadata checks (title, description, `tags`, thumbnail; pre-deployment checklist and *Thumbnail image*). Fill in what you can infer from the scene and ask the user only for the rest. Category list: `{baseDir}/../create-scene/references/scene-json.md` → Tags.

## 2. Deploy

Deploy with the CLI. `--target-content` is required: with `worldConfiguration` set and no target, `deploy` stops with `DEPLOY_MISSING_TARGET_CONTENT`.

```bash
npx @dcl/sdk-commands deploy --target-content https://worlds-content-server.decentraland.org
```

This prompts the user to sign the deployment with their wallet; validations then accept or reject the scene. Done when the deploy exits 0 and `https://decentraland.org/jump?realm=NAME.dcl.eth` shows the new version (fully restart the client first if you loaded the World this session: a scene reload keeps the cached version).

Files matched by `.dclignore` (at the project root) are excluded from the upload — keep working files like Blender sources, concept art, and markdown docs listed there so the World stays light. See the `.dclignore` section in the **deploy-scene** skill.

### Via Creator Hub

1. Open the scene project in Creator Hub
2. Click the **Publish** button (top-right corner)
3. Select **PUBLISH TO WORLD**
4. Choose which NAME or ENS domain to publish to

## 3. Access the World

A successful deploy prints `Content uploaded successfully` with a `play.decentraland.org` URL for the World.

**The link to share with players is the web `/jump` link**, which works whether or not they have the desktop client installed:

```
https://decentraland.org/jump?realm=NAME.dcl.eth
```

Generate `/jump` links, never `/play/...`. Desktop deeplinks and the Genesis City form: **deploy-scene** → *The link to share after publishing*. Browser (Bevy) client: `https://decentraland.zone/bevy-web?realm=NAME.dcl.eth`.

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
    "navmapThumbnail": "assets/Images/thumbnail.png"
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

Beyond `name` and `placesConfig`, `worldConfiguration` takes `skyboxConfig` (fixed time of day, skybox textures) and `miniMapConfig`. Fields, `fixedTime` values and precedence: `{baseDir}/../create-scene/references/scene-json.md` → *worldConfiguration* and *Skybox fixed time*. Runtime control (`SkyboxTime`): **lighting-environment**.

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

Worlds go through the same asset bundle conversion as Genesis City scenes: **deploy-scene** → *Post-Publish: Asset Bundle Conversion*.

## World metadata vs scene metadata

A World and each scene published to it carry **two separate sets** of name, description, and thumbnail. Getting this wrong is the usual cause of "I changed the description and Places still shows the old one".

| | Scene metadata | World metadata |
|---|---|---|
| Stored in | the scene project's `scene.json` | the World itself |
| Edited via | scene settings in the Scene Editor | the World's **Settings**, under the Creator Hub's **Manage** tab |
| Uploaded | with the scene, on every publish | only when you edit it there (or as described below) |
| Shown in | the scene | Decentraland Places and the in-world World information |

How they interact depends on how many scenes the World holds:

- **Empty World** — publishing the first scene **fills the World's metadata from the scene's**.
- **Single-scene World** — **every publish overwrites the World's metadata with the scene's.** So edits made in the Manage tab are silently reverted on the next publish; edit the scene's settings instead. In practice you can ignore World metadata entirely here.
- **Multi-scene World** — the two are **fully independent**. Publishing a scene never changes World metadata, and the Manage tab is the only place to edit it.

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
