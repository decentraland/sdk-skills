---
name: smart-wearables
description: Build a Decentraland smart wearable, a wearable that runs SDK7 code (a portable experience) while equipped. Covers the project layout, the strict `wearable.json` schema behind the Builder's "wearable config file is invalid" error, the 3 MB uncompressed limit and what silently blows it, how the preview differs from the published wearable, what other players see (emote props and bone particles yes; scene entities, ParticleSystem and sound no), multiplayer (no MessageBus or Multiplayer Server; third-party server only), the four `requiredPermissions` gates (USE_FETCH, USE_WEBSOCKET, USE_WEB3_API, OPEN_EXTERNAL_LINK) and the equip-time prompt, wearer-only sound, preloading, and pack/upload. Use when the user wants a smart wearable or a wearable with abilities (jetpack, double jump, pet, glide), or hits Builder errors uploading `smart-wearable.zip`. Do NOT use for plain wearables without code, ordinary scenes (see create-scene), or spawning portable experiences from a scene (see scene-runtime).
---

# Smart Wearables

A smart wearable is a wearable item plus an SDK7 scene that runs as a **portable experience** for the player who has it equipped, wherever they go. The project is a normal SDK7 project with a `wearable.json`; the code, the wearable GLB(s), a thumbnail and any assets are packed into one zip and uploaded to the Builder.

Related skills — link, don't repeat:

| Need | Skill |
| --- | --- |
| Drive Blender at all (headless CLI vs Blender MCP, paths, never-fall-back rule) | **add-3d-models** → `{baseDir}/../add-3d-models/references/blender-authoring.md` |
| Model the wearable GLB itself (base meshes, limits, skinning, export, thumbnail) | **wearables** |
| Author the avatar part of an emote (rig, posing, export, masks) | **avatar-animations** |
| Add props / bone particles to that emote | **avatar-animations** → `{baseDir}/../avatar-animations/references/emote-props.md` |
| `triggerSceneEmote`, `stopEmote`, `AvatarAttach`, `AvatarLocomotionSettings` API | **player-avatar** |
| `Physics.applyImpulseToPlayer` and forces | **player-physics** |
| Held-key polling (`inputSystem.isPressed`) | **advanced-input** |
| HUD (fuel bars, cooldowns) | **build-ui** |
| `AudioSource` | **audio-video** |
| `AssetLoad` preloading | **optimize-scene** → "Asset Preloading" |
| WebSocket / `fetch` to a third-party server (the only way to share state, see Multiplayer below; declare the permission, see Permissions) | **scene-runtime** |

Worked example (jetpack: F to thrust, fuel/overheat, masked emote with flame props, wearer-only sound, preloading): `{baseDir}/references/jetpack-example.md`.

## Project layout

Scaffold with `npx @dcl/sdk-commands init --project smart-wearable` (the Creator Hub cannot create one, but can open and preview an existing one). The toolchain treats a project as a smart wearable because `wearable.json` exists.

| File | Notes |
| --- | --- |
| `wearable.json` | Builder metadata. Strict schema, see below. |
| `scene.json` | `"isPortableExperience": true`, `"main": "bin/index.js"`. `scene.parcels` is used **only** by the local preview. |
| `thumbnail.png` | 256 × 256 PNG, transparent background (Curation Committee rejects opaque backgrounds). |
| `models/male/*.glb`, `models/female/*.glb` | One GLB per body shape when the shapes differ (they do for any body-hugging wearable). One GLB for both is fine for rigid accessories. |
| `src/index.ts` | `main()` runs when the player equips the wearable. |
| `package.json` | Add `"pack": "sdk-commands pack-smart-wearable"` to `scripts` if missing. |
| `.dclignore` | Same as a scene's. Everything not ignored goes into the zip. |

## RULE: `wearable.json` must match the Builder schema exactly

The Builder validates against `WearableConfigSchema` (builder-client) with `additionalProperties: false` on the top-level object (nested objects such as `data` are not strict). Any violation gives the generic **"the wearable config file is invalid"** with no detail.

- Top-level keys allowed: `id`, `name`, `description`, `rarity`, `data`, `mapping`. **Nothing else.** Remove legacy `menuBarIcon`, `model`, `bodyShape`, `collectionAddress` if present (older docs and samples listed them).
- Required: `name`, `data`.
- `description`: **max 64 characters**. The commonest cause of the error. A longer description can be written in the Builder's item editor after upload.
- `rarity`: `unique` (1) · `mythic` (10) · `exotic` (50) · `legendary` (100) · `epic` (1000) · `rare` (5000) · `uncommon` (10000) · `common` (100000).
- `id`: a UUID. Generate a fresh one when forking a project (`crypto.randomUUID()` / `uuidgen`).
- `data` requires **all five**: `replaces`, `hides`, `tags`, `representations`, `category`. `replaces`, `hides` and `tags` may be `[]`; `representations` needs at least one entry. Optional: `removesDefaultHiding`, `blockVrmExport`.
- `representations[]`: `bodyShapes` (`urn:decentraland:off-chain:base-avatars:BaseMale` / `…:BaseFemale`), `mainFile`, `contents` (must include `mainFile`; paths relative to the project root), `overrideHides`, `overrideReplaces`. Both body shapes must be covered.
- `category`: `eyebrows`, `eyes`, `facial_hair`, `hair`, `mouth`, `upper_body`, `lower_body`, `feet`, `earring`, `eyewear`, `hat`, `helmet`, `mask`, `tiara`, `top_head`, `skin`, `hands_wear`.

Validating locally with Ajv: the schema uses `$data` references in `representations`, so construct Ajv with `{ $data: true }` or it reports false negatives.

```json
{
  "id": "00000000-0000-4000-8000-000000000000",
  "name": "Example Jetpack",
  "description": "Press F to fly. Hold to climb until the fuel runs dry.",
  "rarity": "mythic",
  "data": {
    "replaces": [], "hides": [], "tags": ["jetpack", "smart"],
    "category": "upper_body",
    "representations": [
      { "bodyShapes": ["urn:decentraland:off-chain:base-avatars:BaseMale"],
        "mainFile": "models/male/suit.glb", "contents": ["models/male/suit.glb"],
        "overrideHides": [], "overrideReplaces": [] },
      { "bodyShapes": ["urn:decentraland:off-chain:base-avatars:BaseFemale"],
        "mainFile": "models/female/suit.glb", "contents": ["models/female/suit.glb"],
        "overrideHides": [], "overrideReplaces": [] }
    ]
  }
}
```

## RULE: Stay under 3 MB uncompressed — measure the files, not the zip

- The Builder rejects a smart wearable whose **unzipped** contents exceed **3 MB** (`MAX_SMART_WEARABLE_FILE_SIZE`) with a "file too big" error.
- `npm run pack` only prints a message above **2 MB** and still writes `smart-wearable.zip`. A successful pack proves nothing.
- Measure: `unzip -l smart-wearable.zip` and read the total line. Do this after every pack.
- **Creator Hub trap:** editing the project in the Creator Hub writes `assets/Images/autogenerated-thumbnail.png` (a 1920×1080 screenshot, ~4 MB) and points `scene.json` → `display.navmapThumbnail` at it. It saves it when you go **Back** from the editor and before **Publish / Deploy** (`saveThumbnail`), re-adding it whenever the field is empty or the file is missing. A 1.5 MB wearable became 4.9 MB this way. Add `assets/Images` (or the file) to `.dclignore` and set `navmapThumbnail` to `""`. The Creator Hub also adds `featureToggles`, `spawnPoints`, `skyboxConfig`, `landscapeTerrain` to `scene.json`; those are harmless.
- Also ignore source folders: `blender/`, `*.blend`, renders, the zip itself.
- Budget killers: PNG textures in GLBs (export JPEG instead, see **wearables**), uncompressed audio (use short `.mp3` loops), unused npm libraries.

## RULE: The preview is not the published wearable

`npm run start` / Creator Hub **Play** runs the code as a **regular scene on the parcels in `scene.json`**, not as a portable experience (Explorer `LoadSmartWearablePreviewSceneSystem`). Consequences:

- Everything that requires "the scene the player is in" — physics impulses, input — **stops working when the player walks off those parcels**. Published, it works everywhere. Add a few parcels to `scene.json` if you need room to test.
- The wearable model is **not** equipped on your avatar in preview: the Explorer reads your profile from the real catalyst, which never sees the preview server's wearable ID.
- To test it equipped, for real: upload to the Builder, add to a collection, click **See in Decentraland** (opens on Sepolia; equip it from the backpack). No minting or publishing needed.
- The preview is still the fast loop for gameplay tuning (impulse feel, emote pose, UI). Confirm once via See in Decentraland.

## What runs where — who sees what

The code runs **only on the wearer's client**. Design every visible effect around that:

| Effect | Wearer | Other players |
| --- | --- | --- |
| Entities, models, UI, `ParticleSystem`, `AudioSource` created by the code | ✅ | ❌ |
| The wearable model itself | ✅ | ✅ |
| Avatar emote played with `triggerSceneEmote()` / `triggerEmote()` | ✅ | ✅ |
| Props and bone-driven particles inside that emote file | ✅ | ✅ |
| Sound with a `triggerSceneEmote()` clip | ❌ | ❌ |
| Player motion from `Physics` impulses / `AvatarLocomotionSettings` | ✅ | ✅ (it's the avatar's movement) |

- **To show an effect to everyone, put it in an emote as a prop.** Particles must be meshes skinned to animated prop bones — see `{baseDir}/../avatar-animations/references/emote-props.md`. `ParticleSystem` and scene entities are invisible to others.
- **One emote serves both body shapes.** If its props must line up with the wearable (flames at the nozzles), give the rigid part the **same offset in both representations**. `Avatar_Spine2` rests at the same place in `AvatarShape_A`, `AvatarShape_B` and `Avatar_File.blend` (head z 1.3516 m), so one set of prop positions then fits both bodies. Pick that offset from the clearance of whichever body sits further back (see **wearables** → rigid parts).
- **Scene emotes play no audio; only Builder-uploaded emotes do.** Why: `{baseDir}/../avatar-animations/references/emote-props.md` → "Playing it". There is currently no way to make a smart-wearable sound audible to others; report it via **report-sdk-issue** if the user needs it.
- **Wearer-only sound:** an entity with `AvatarAttach { anchorPointId: AvatarAnchorPointType.AAPT_POSITION }` (the field is required) plus a looping `AudioSource` with `playing: false`; toggle `playing`. Only the wearer hears it.
- **Abilities used while moving → mask the emote.** `triggerSceneEmote({ src, loop: true, mask: AvatarMask.AM_UPPER_BODY })` keeps playing through jumps and falls (a full-body emote is cut by locomotion), props still play, and the mask is replicated to remote players. Stop with `stopEmote({})`. Masked emotes emit no `AvatarEmoteCommand` events on the local player — track state yourself.

## Multiplayer

Smart wearables currently have **no built-in multiplayer**:

- **`MessageBus` doesn't work** in a smart wearable, and neither does `syncEntity` / CRDT sync of scene entities. Each wearer runs their own isolated copy of the code, even when two players wearing the same wearable stand side by side.
- **The Multiplayer Server (authoritative-server) doesn't work** for smart wearables either.
- **What other players do see** is the wearer's avatar: its position and movement (including what `Physics` impulses do to it) and the emotes it plays, with their props. Those are synced by the avatar system, not by the wearable's code.
- **What they don't see:** any entity the code creates, sounds, UI, and all game data (scores, health, fuel, cooldowns, inventory).

The only way to share state between players is a **third-party server** the wearable talks to over WebSocket or `fetch` (see **scene-runtime**). Use it for a shared leaderboard, a game between wearers, or showing other wearers' state. Each client then renders other players' state locally; it's still invisible to players who aren't wearing the wearable.

Don't plan a feature on `MessageBus`, `syncEntity` or the Multiplayer Server for a smart wearable. If the user asks for one, explain the limitation and offer the third-party server or an emote-based design (everyone sees emotes). Report the gap via **report-sdk-issue** if it blocks them.

## Runtime behaviour of a published smart wearable

- A portable experience is always treated as the **current scene** (Explorer calls `SetIsCurrent(true)` for PX), so `Physics.applyImpulseToPlayer`, continuous forces and `inputSystem` work anywhere the wearer goes.
- `AvatarAttach` normally requires the player to be inside the scene; for a PX that condition always holds [inferred from the above, not tested on a published wearable].
- **Host scenes win.** A scene can set `featureToggles.portableExperiences` to `"disabled"` (wearable code stops while the player is there) or `"hideUi"`. For `AvatarLocomotionSettings`, a scene's value beats the wearable's. Mention this to the user when designing movement abilities — parkour scenes are expected to block them.
- Load order varies: if the player logs in already wearing it, the wearable's code may start before other players/scenes load. Don't assume nearby players exist at `main()`.

## Permissions

A published smart wearable runs with **restricted permissions**: `LoadSmartWearableSceneSystem` builds a `RestrictedJsApiPermissionsProvider` from `requiredPermissions` in `scene.json`, while scenes and other portable experiences get every permission. An undeclared call fails and logs `<API>: permission denied` (`Fetch API`, `Web Sockets API`, `Web3 API`, `Open External URL`).

| `requiredPermissions` entry | Gates |
| --- | --- |
| `USE_FETCH` | `fetch` only. `signedFetch` is **not** gated (`SignedFetchWrap` has no permission check) |
| `USE_WEBSOCKET` | WebSocket connections |
| `USE_WEB3_API` | every Ethereum RPC through `sendAsync`, read-only calls such as `eth_call` included, and `signMessage`. `getUserAccount` is not gated |
| `OPEN_EXTERNAL_LINK` | `openExternalUrl` |

```json
"requiredPermissions": ["USE_FETCH", "USE_WEBSOCKET"]
```

- **Authorization prompt.** Equipping from the backpack a wearable that declares any of the four permissions opens an authorization popup (`SmartWearableAuthorizationPopupController`). A player who logs in already wearing it is prompted only when it declares `USE_WEB3_API`; a scene change never prompts (`SmartWearableSystem.RunScenesForEquippedWearablesAsync`). Declining keeps the wearable equipped but its code does not run (the Explorer marks it in `KilledPortableExperiences`). Declare only what the code uses, so players aren't asked for more than they need to grant.
- **The preview grants everything.** `LoadSmartWearablePreviewSceneSystem` loads the preview like a normal scene, with every permission; the gates apply only to the published wearable. A gated call that works in `npm run start` can still fail once published: test it through See in Decentraland.
- `ALLOW_TO_MOVE_PLAYER_INSIDE_SCENE`, `ALLOW_TO_TRIGGER_AVATAR_EMOTE` and `ALLOW_MEDIA_HOSTNAMES` are ignored: moving the player, emotes, physics forces and external media need no permission. Remove them from older projects.
- Enforcement above is the desktop Explorer's; a code search of the mobile client (godot-explorer) found no enforcement at all. Declare what the code uses regardless.

Scene side of the same field: **create-scene** → `references/scene-json.md` → Required Permissions.

## Physics tuning numbers (for movement abilities)

Measured from unity-explorer `main`: character mass is **1**, so an impulse magnitude **is** the velocity change in m/s. External velocity decays with drag **1.5 /s** and is capped at **50 m/s**. An upward impulse zeroes the current downward (gravity) velocity first, so a mid-fall thrust doesn't have to fight the fall. A launch kick of ~6 plus ~0.8 every 0.1 s while held gives a steady ~4–5 m/s climb. API details: **player-physics**.

## Preloading

Create one `AssetLoad` entity in `main()` listing the emote `.glb` and the sound files (API: **optimize-scene**). Audio goes into the same cache `AudioSource` uses, so the first play is instant. An emote `.glb` is downloaded by the model loader, not the emote loader: preloading removes the download wait, but the emote is still set up on first `triggerSceneEmote`. Register `assetLoadLoadingStateSystem` to log `FINISHED_WITH_ERROR` / `NOT_FOUND` — that's how you catch a wrong path.

## Pack and upload

1. `npm run pack` → `smart-wearable.zip`.
2. `unzip -l smart-wearable.zip` — total under 3 MB, no source/Blender files, no autogenerated thumbnail. Make sure the user uploads **this** zip (check its path and size with them if the Builder disagrees).
3. Builder → **Collections** → a collection → **New item** → drop the zip. It's detected as a smart wearable from `wearable.json`.
4. The Builder asks for a **video showcase** (`.mp4`, ≤ 4 MB, ≤ 15 s) shown in the marketplace. Tell the user to record one before uploading.
5. In the item editor: check hides/replaces overrides, description, tags.
6. **See in Decentraland** on the collection to test on Sepolia. Then publish the collection (Curation Committee review).

## Pre-upload checklist

- [ ] `wearable.json`: only allowed top-level keys; `description` ≤ 64 chars; all five required `data` keys present; both body shapes covered; fresh UUID.
- [ ] Each GLB within category limits (**wearables**); both body shapes exported and referenced.
- [ ] `thumbnail.png` 256 px square, transparent.
- [ ] `.dclignore` covers `blender/`, `assets/Images`, `*.zip`; `navmapThumbnail` empty.
- [ ] `unzip -l` total < 3 MB.
- [ ] `requiredPermissions` lists exactly what the code uses (`fetch`, WebSocket, Web3, `openExternalUrl`); gated calls tested via See in Decentraland, not only the preview.
- [ ] Effects meant for others live in the emote as props, not in `ParticleSystem`/entities; sound is wearer-only and the user knows it.
- [ ] Tested beyond the preview parcels via See in Decentraland.

## Sources

Verified 2026-10 against `main` of: builder-client (`WearableConfigSchema`, `MAX_SMART_WEARABLE_FILE_SIZE`), builder, js-sdk-toolchain (`pack-smart-wearable`, `MAX_WEARABLE_SIZE`), unity-explorer (`LoadSmartWearablePreviewSceneSystem`, `LoadSmartWearableSceneSystem`, `RestrictedJsApiPermissionsProvider`, `SimpleFetchApiImplementation`, `SignedFetchWrap`, `RestrictedEthereumApi`, `SmartWearableAuthorizationPopupController`, `LoadSceneEmotesSystem`, `SDKExternalPhysicsSystems`, PX `SetIsCurrent`), creator-hub (autogenerated thumbnail), and a jetpack smart wearable built and uploaded end to end. Docs: [Smart wearables](https://docs.decentraland.org/creator/sdk7/projects/smart-wearables/) · [Uploading smart wearables](https://docs.decentraland.org/creator/wearables-and-emotes/manage-collections/uploading-smart-wearables/) · [Creating wearables](https://docs.decentraland.org/creator/wearables-and-emotes/wearables/creating-wearables/).
