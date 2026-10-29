---
name: player-avatar
description: The live player in a Decentraland scene. Use when the user wants to read player position or profile, fetch avatar appearance for off-scene addresses (parcel owners, NFT holders), trigger emotes, read equipped wearables, attach items to players/avatar (cosmetic vs held gameplay items), show a custom label plate above a player's or NPC's nametag (AvatarNametag), hide avatars or disable passports in zones (AvatarModifierArea), adjust locomotion speed, teleport the player (movePlayerTo), or listen for scene entry/exit. Do NOT use for NPC characters (see npcs), wallet/blockchain checks (see nft-blockchain), freezing player movement (see advanced-input for InputModifier), or camera mode (see camera-control).
---

# Player and Avatar System in Decentraland

## CRITICAL: The player Transform is READ-ONLY from scene code

`Transform` on `engine.PlayerEntity` is engine-controlled. **Mutations from scene code are silently ignored** — your code compiles, runs, no error is thrown, and nothing moves in-world. This is the most common bug when trying to lift, push, knock back, float, or teleport the player.

```typescript
// WRONG — compiles cleanly, runs, does NOTHING in-world
const t = Transform.getMutable(engine.PlayerEntity)
t.position.y += 0.1                      // ignored
t.position = Vector3.create(8, 0, 8)     // ignored
Transform.createOrReplace(engine.PlayerEntity, { ... }) // ignored
```

**Symptom to recognize:** TypeScript accepts the code, the system ticks, no console error, but the avatar never moves. If you wrote `Transform...PlayerEntity` and expected motion, this is your bug.

**Correct API by intent:**

| Goal | Use | Skill |
|------|-----|-------|
| Instant teleport / smooth slide to a point | `movePlayerTo` from `~system/RestrictedActions` | this skill, see below |
| Lift / float / launch / jump pad / knockback / push / wind / repulsion | `Physics.*` from `@dcl/sdk/ecs` | `player-physics` |
| Restrict / freeze movement | `InputModifier` on `engine.PlayerEntity` | `advanced-input` |
| Change run speed / jump height | `AvatarLocomotionSettings` on `engine.PlayerEntity` | this skill, see below |

`Transform.get(engine.PlayerEntity)` is valid for **reading** position and rotation only.

## Player Position and Movement (Reading)

Access the player's position via the reserved `engine.PlayerEntity`:

```typescript
import { engine, Transform } from '@dcl/sdk/ecs'

function trackPlayer() {
	if (!Transform.has(engine.PlayerEntity)) return

	const playerTransform = Transform.get(engine.PlayerEntity)
	console.log('Player position:', playerTransform.position)
	console.log('Player rotation:', playerTransform.rotation)
}

engine.addSystem(trackPlayer)
```

Always check `Transform.has(engine.PlayerEntity)` before reading player data — it may not be ready on the first frame.

### Player speed — average over a window, never per frame

**The player `Transform` does not advance every scene tick.** A per-frame speed computed as `Vector3.distance(pos, lastPos) / dt` therefore alternates between `0` on ticks with no update and roughly `2x` the real speed on the next one, and any "speed above X held for N seconds" test never passes. Observed in-world (SDK 7.30.1, 2026-10-12): a ~9 m/s sprint never satisfied a per-frame `speed > 7.5` held 0.5 s; the same threshold over 0.5 s windows triggered on the first try.

Accumulate instead, and reset the window when it closes:

```typescript
let winDist = 0, winTime = 0
let last = Vector3.Zero()

function speedSystem(dt: number) {
	if (!Transform.has(engine.PlayerEntity)) return
	const pos = Transform.get(engine.PlayerEntity).position
	const step = Vector3.distance(pos, last)
	last = pos
	if (step > 3) return          // teleport / respawn — discard, don't accumulate
	winDist += step
	winTime += dt
	if (winTime < 0.5) return     // window must be >= ~0.5 s to be stable
	const speed = winDist / winTime
	winDist = 0; winTime = 0
	// ... compare `speed` against your threshold here
}
```

Skip any single delta over ~3 m: that is a teleport or a respawn, not movement, and it spikes the average.

### Distance-Based Logic

```typescript
import { Vector3 } from '@dcl/sdk/math'

function proximityCheck() {
	const playerPos = Transform.get(engine.PlayerEntity).position
	const npcPos = Transform.get(npcEntity).position
	const distance = Vector3.distance(playerPos, npcPos)

	if (distance < 5) {
		console.log('Player is near the NPC')
	}
}

engine.addSystem(proximityCheck)
```

### Remote players' positions are scene-relative

Another player's `Transform` (entities from `engine.getEntitiesWith(PlayerIdentityData)`), `getPlayer({ userId }).position`, `onEnterScene` and items attached to other players are **scene-relative**: the same frame as `Transform.get(engine.PlayerEntity)`, on desktop and on mobile app 1.15.0+. `getPlayer` returns the same frame.

**Mobile apps older than 1.15.0 report them in world coordinates.** Handle both the way `33,20-spectate-mode` does: subtract the base parcel × 16 **only** when a position falls outside the scene's bounds, never unconditionally. Read the base parcel from `scene.json` rather than hardcoding it.

Derive anything safety-critical from the local player's own position on each client, not from a remote one.

## Player Profile Data

Get the player's name, wallet address, and guest status:

```typescript
import { getPlayer } from '@dcl/sdk/src/players'

function main() {
	const player = getPlayer()
	if (player) {
		console.log('Name:', player.name)
		console.log('User ID:', player.userId)
		console.log('Is guest:', player.isGuest)
	}
}
```

- `userId` — the player's Ethereum wallet address (or guest ID)
- `isGuest` — `true` if the player hasn't connected a wallet

Check `isGuest` before attempting any wallet-dependent feature (guests have no on-chain identity).

## Profile Data for Off-Scene Users (Catalyst)

`getPlayer(userId)` only returns data for users **currently connected to this scene**. For any other address (parcel owner, NFT holder, leaderboard entry, off-scene claimant), fetch from the catalyst:

```
GET https://peer.decentraland.org/lambdas/profile/<wallet-address>
```

- Always use `peer.decentraland.org` — it is the canonical catalyst regardless of realm/world. Worlds servers do NOT expose `/lambdas`, so do not blindly read `realmInfo.baseUrl`.
- Response shape: `json.avatars[0].avatar.{ bodyShape, wearables, eyes:{color}, hair:{color}, skin:{color} }` (NOT the `json[0].metadata.avatars...` shape from older docs).
- Unknown address returns `{ avatars: [], timestamp: 0 }` — handle the empty array.
- Colors come as `{ r, g, b, a }` floats in `[0,1]`. Build a `Color3` and pass it directly to `AvatarShape.skinColor` / `hairColor` / `eyeColor` — these fields take a raw `Color3`, NOT `{ color: Color3 }` (wrapping causes TS2322).

`AvatarShape.create({ id: address })` with only an `id` does NOT auto-fetch wearables — the avatar renders undressed unless you supply `bodyShape`, `wearables`, and the color fields explicitly.

**Which API to use:**

- Local or in-scene player → `getPlayer(userId)` (sync, includes wearables/emotes).
- Off-scene address → `fetchAvatarFromCatalyst(address)` (async HTTP).

For the full helper (`fetchAvatarFromCatalyst`), end-to-end usage example, and gotchas, see `{baseDir}/references/catalyst-profile-fetch.md`.

## Avatar Attachments

Attach 3D objects to a player's avatar:

```typescript
import {
	engine,
	Transform,
	GltfContainer,
	AvatarAttach,
	AvatarAnchorPointType,
} from '@dcl/sdk/ecs'

const hat = engine.addEntity()
GltfContainer.create(hat, { src: 'assets/Models/hat.glb' })
Transform.create(hat, {})

// Attach to the local player's avatar
AvatarAttach.create(hat, {
	anchorPointId: AvatarAnchorPointType.AAPT_NAME_TAG,
})
```

`AvatarAttach` requires the target player to be in the same scene — attachments disappear when the player leaves.

**The attached entity's own `Transform` position and rotation are ignored.** Every frame the Explorer sets that entity's world position and rotation to the anchor's. Only `scale` survives. It then writes the pose back into the entity's `Transform`, **relative to the local player**: `position` is the anchor's world position minus the player's (world axes, not rotated into the player's facing), and `rotation` is relative to the player's rotation. Children keep their local Transforms, so to offset an attachment put the `AvatarAttach` on an empty root and parent the visible parts to it:

```typescript
import { Vector3 } from '@dcl/sdk/math'

const anchor = engine.addEntity()
Transform.create(anchor, {})
AvatarAttach.create(anchor, { anchorPointId: AvatarAnchorPointType.AAPT_HIP })

const padlock = engine.addEntity()
GltfContainer.create(padlock, { src: 'assets/Models/padlock.glb' })
Transform.create(padlock, { parent: anchor, position: Vector3.create(0.15, -0.1, 0.12) }) // offset from the hip
```

**Measure a seat offset; don't tune it by eye.** Eyeballed seat offsets took six owner corrections in one scene (2026-10). During `sittingChair` the hip sat about 0.37 m behind the avatar root, but that value comes from one body and one emote. Measure your own: attach an empty entity to `AAPT_HIP` and play the sitting emote. Then read its `Transform` (`Transform.get` in scene code, or the Explorer MCP's `get_entity_details`, **unity-explorer-mcp**). By the write-back rule above, its `position` is the hip's offset from the player root in world axes, so turn it into the chair's frame using the player's facing. Then place the player root so the hip lands on the seat.

### Held items vs cosmetic items — `AvatarAttach` vs parenting to `engine.CameraEntity` / `engine.PlayerEntity`

Three mechanisms make an entity follow the player. Pick by intent: *aim item*, *body-fixed item* or *cosmetic*. Bone anchors carry the avatar's animation (idle bob, walk cycle, gestures), which suits cosmetics and makes anything aimed jitter. `engine.PlayerEntity` follows the root's position and body yaw only, so an item parented there stays level when the player looks up.

| Goal | Use | Tracks | Notes |
|------|-----|--------|-------|
| **Aim item** (default for held gameplay items): gun, aiming reticle, flashlight, anything pointed by looking around | `Transform.parent = engine.CameraEntity` plus a local offset in front of and below the camera | Camera yaw **+ pitch** | Points where the player looks, with no animation jitter. SDK6 `Attachable.FIRST_PERSON_CAMERA` maps here. |
| **Body-fixed item**: a non-aimed shield, a carried lantern, anything that should stay level | `Transform.parent = engine.PlayerEntity` plus a local offset | Root position + body **yaw only** | Wrong for guns: the muzzle stays flat when the player aims up. |
| **Cosmetic**: hat, halo, backpack, name plate, glow, a torch other players see riding the avatar | `AvatarAttach` with an `anchorPointId` (`AAPT_HEAD`, `AAPT_SPINE`, `AAPT_LEFT_HAND`…) | The animated bone | Moves naturally with the body; never for aim (a gun on `AAPT_RIGHT_HAND` is unaimable). |

```typescript
import { engine, Transform, GltfContainer } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

const gun = engine.addEntity()
GltfContainer.create(gun, { src: 'assets/Models/blaster.glb' })
Transform.create(gun, {
	parent: engine.CameraEntity,               // yaw + pitch: aim tracks where the player looks
	position: Vector3.create(0.25, -0.2, 0.5), // right, down, forward of the camera
})
```

When equipping a held gun, force first person with `CameraModeArea` or a camera mode (**camera-control**).

### Anchor Points

Common anchors: `AAPT_NAME_TAG` (above the head), `AAPT_HEAD`, `AAPT_NECK`, `AAPT_SPINE`, `AAPT_HIP`, `AAPT_LEFT_HAND` / `AAPT_RIGHT_HAND`. Full enum, including the deprecated `AAPT_POSITION`: `{baseDir}/references/avatar-apis.md` → All Anchor Points.

### Attach to a Specific Player

```typescript
AvatarAttach.create(hat, {
	avatarId: '0x123...abc', // Target player's wallet address
	anchorPointId: AvatarAnchorPointType.AAPT_RIGHT_HAND,
})
```

`avatarId` is the target player's wallet address. To attach to every player in the scene (including remote ones), iterate `engine.getEntitiesWith(PlayerIdentityData)` and read `player.address` for each — guard with a marker component so you attach only once per player:

```typescript
import { PlayerIdentityData } from '@dcl/sdk/ecs'

engine.addSystem(() => {
	for (const [entity, player] of engine.getEntitiesWith(PlayerIdentityData)) {
		// player.address is the wallet address to pass as avatarId
	}
})
```

To attach the **local** player's own held item, get the address from `getPlayer()` / `await getPlayer()` (`.userId`). Omitting `avatarId` attaches to the local player. For multiplayer visibility of a held/attached item, sync the anchor entity's `AvatarAttach` component (**multiplayer-sync**).

## Triggering Emotes

### Default Emotes

```typescript
import { triggerEmote } from '~system/RestrictedActions'

// Play a built-in emote
triggerEmote({ predefinedEmote: 'robot' })
triggerEmote({ predefinedEmote: 'wave' })
triggerEmote({ predefinedEmote: 'clap' })
```

Other built-in names include `'dance'`, `'fistpump'` and `'raiseHand'`; every built-in emote with a preview is in `{baseDir}/../avatar-animations/references/animation-catalog.md`.

### Custom Scene Emotes

**Need a clip?** Before authoring one, check `{baseDir}/../avatar-animations/references/animation-catalog.md`: animated previews of every built-in emote, and 45 ready-made `_emote.glb` files from the Creator Hub's Avatar Animations pack (sitting on stools/puffs/bean bags, chess, fishing, carry, drink, dance…) with their download and the exact `src` path to play them.

> ⚠️ **CRITICAL FILE NAMING REQUIREMENT:** The emote `.glb` file **MUST** end with `_emote.glb` (case-insensitive). This is **not** optional and **not** just a convention — the runtime rejects files that don't match this suffix.
>
> **Why this matters:** Scenes with incorrectly named emote files often **work fine in `npm run start` preview** but **silently fail in production** once deployed. Preview is more permissive; the deployed runtime is strict. Always rename the file on disk (e.g. `SnowballThrow.glb` → `SnowballThrow_emote.glb`) before deploying.
>
> Valid: `wave_emote.glb`, `Snowball_Throw_emote.glb`, `dance_EMOTE.GLB`
> Invalid: `wave.glb`, `emote_wave.glb`, `wave_emote_v2.glb`

```typescript
import { triggerSceneEmote } from '~system/RestrictedActions'

// File MUST end with _emote.glb — rename it on disk if it doesn't
// src is the path from the PROJECT ROOT, exactly as on disk (usually under assets/)
triggerSceneEmote({
	src: 'assets/animations/Snowball_Throw_emote.glb',
	loop: false,
})
```

**Notes:**

- **`src` is the path relative to the project root, exactly as the file sits on disk** — an exact content lookup (`SceneContent.TryGetHash(src)`), with no search by file name or `_emote` suffix. A wrong path makes `triggerSceneEmote` resolve `false` with no error logged, and nothing plays. A file at `assets/animations/sit_emote.glb` needs `'assets/animations/sit_emote.glb'`; a bare `'animations/...'` only works if that folder really is at the project root. Same rule for `AvatarShape.expressionTriggerId` — see **npcs**.
- Emotes play only while the player is standing still — walking or jumping interrupts them
- If you don't want a player to interrupt an emote, use the `InputModifier` component to freeze the player for the duration of the emote
- Both `triggerEmote` and `triggerSceneEmote` require the scene to declare the `ALLOW_TO_TRIGGER_AVATAR_EMOTE` permission in `scene.json` `requiredPermissions`.
- Both accept an optional `mask` (upper-body-only animation) — see "Emote masks" below.
- To **create** the `.glb` (pose the official avatar rig in Blender, export, verify), see the **avatar-animations** skill.

### Stopping an emote

`stopEmote({})` from `~system/RestrictedActions` stops the local player's currently playing emote (built-in or scene emote). Useful to end a looping scene emote (`triggerSceneEmote({ src, loop: true })`) on demand — e.g. a "pick up / put down" toggle.

```typescript
import { stopEmote } from '~system/RestrictedActions'

stopEmote({}).then(({ success }) => {
	// `success` is a plain boolean (the RPC returns `SuccessResponse`).
})
```

If `typeof success` reads `'object'` rather than `'boolean'`, the runtime handed the scene an unresolved promise instead of the value — a client/SDK defect, not a scene bug. Verified in the `80,-6-explorer-ui-events` test scene, which exists partly to catch it.

**Mobile:** `stopEmote` needs app 1.15.0+, as does the handling of scene-started **upper-body** emotes: they pause when the player leaves the scene, resume on return, and stop on scene unload. On older mobile apps a looping scene emote cannot be stopped from the scene, so never make `stopEmote` the only way out of a mechanic; give the player an action that also restores the pose.

### Detecting when an emote finishes

Every emote lifecycle event is appended to the `AvatarEmoteCommand` grow-only set on the player entity, with a `state` field (`EmoteState` enum). Works for scene-triggered emotes (`triggerEmote`/`triggerSceneEmote`), emotes the player plays via the emote wheel, AND other players' emotes (pass their entity instead of `engine.PlayerEntity`).

```typescript
import { AvatarEmoteCommand, EmoteState } from '@dcl/sdk/ecs'

AvatarEmoteCommand.onChange(engine.PlayerEntity, (cmd) => {
	if (!cmd) return
	switch (cmd.state ?? EmoteState.ES_STARTED) {
		case EmoteState.ES_STARTED:     // emote started (also the value when `state` is absent)
			break
		case EmoteState.ES_FINISHED:    // non-looping emote played to its natural end
			break
		case EmoteState.ES_INTERRUPTED: // cut short: movement/jump, teleport, another emote, stopEmote(), or scene exit
			break
	}
})
```

- `AvatarEmoteCommand` is written by the Explorer to report playback; it is read-only for the scene, and writing it plays nothing.
- `state` is an **optional** protocol field: always default it to `ES_STARTED` (`cmd.state ?? EmoteState.ES_STARTED`) rather than assuming it is present.
- **Masked (partial-body) emotes on the local player report no lifecycle events** — known limitation. A scene that needs to know when a masked clip ends must time it itself from the clip duration.

### Emote masks (upper-body only)

Full-body emotes are interrupted when the player walks or jumps — the default locomotion animations take over. `AvatarMask.AM_UPPER_BODY` limits the animation to the waist up, leaving the legs controlled by locomotion. This means the player can keep walking, running, and jumping while the upper body plays your animation. Use cases: carrying a crate, holding a torch, juggling, cheering while running.

`triggerEmote` and `triggerSceneEmote` both accept an optional `mask` (enum `AvatarMask`, imported from `@dcl/sdk/ecs`) that limits which bones the animation drives.

```typescript
import { AvatarMask } from '@dcl/sdk/ecs'
import { triggerSceneEmote } from '~system/RestrictedActions'

triggerSceneEmote({ src: 'assets/animations/Carry_emote.glb', loop: true, mask: AvatarMask.AM_UPPER_BODY })
```

- Only value: `AvatarMask.AM_UPPER_BODY` (= 0). Omitting `mask` plays the full-body animation (the default) — there is no `AM_FULL_BODY` value in the enum.
- `mask` applies to `triggerEmote` and `triggerSceneEmote` only. `stopEmote({})` takes no arguments (`StopEmoteRequest` is empty).
- **Loop + mask interaction:** `loop: false` with `mask: AM_UPPER_BODY` plays the upper-body animation exactly once, then returns the upper body to locomotion. `loop: true` with the mask repeats until `stopEmote({})` is called. The loop flag is respected regardless of the mask. Examples: sdk7-test-scenes `88,-13-avatar-masks` and `80,-1-scene-emotes`.
- **Mobile:** masked emotes work from app 1.13.0, and from 1.15.0 other mobile players see them as upper-body too. Older mobile apps play them full-body, so keep the full-body fallback acceptable. Other mobile gaps, including emotes from other clients: `{baseDir}/../sdk-scenes/references/mobile-parity.md`.
- **Masked emotes do not stack with other emotes:** starting a masked emote stops a playing full-body emote (a chair's sitting emote included) and a full-body emote cancels a masked one; the mask only layers over locomotion. For a seated player, play a full-body clip that contains the seated pose instead. Authoring details in **avatar-animations** → "Upper-body (masked) animations".

## NPC Avatars

For creating NPCs (characters, shopkeepers, guards, etc.), see the **npcs** skill. It covers both the NPC Toolkit library (GLB-based, with dialogue and movement) and `AvatarShape`-based avatar NPCs.

**A lookalike of the player** (a queue of "you", a posed clone, a mirror double): **npcs** → "Copies of the player". When feeding an `AvatarShape` from `getPlayer().avatar`, the field names differ: `eyesColor` → `eyeColor`, `bodyShapeUrn` → `bodyShape`. Avatars ignore `VisibilityComponent`.

## Custom Nametag Plates (`AvatarNametag`)

Draws a plate with scene-provided text **above** an avatar's native nametag — for a rank, role, team, or title the scene assigns ("VIP", "Team Red", "Club Owner"). It does not replace the native nametag. Requires `@dcl/sdk` **7.28.0+** (not in 7.27.0 or earlier).

```typescript
import { AvatarNametag, engine } from '@dcl/sdk/ecs'

AvatarNametag.createOrReplace(engine.PlayerEntity, { label: 'Club Owner' })
```

A plain LWW component from `@dcl/sdk/ecs` — standard `create` / `createOrReplace` / `getMutable` / `getOrNull` / `deleteFrom`, no helper functions. `label: string` is required; `labelColor`, `backgroundColor`, `borderColor` are optional `Color3` fields that fall back to the native nametag's colors (border defaults to the background, so no visible border). Full field table, `label` edge cases, component ids, and the multiplayer roster pattern: `{baseDir}/references/avatar-nametag.md`.

**Valid targets:** `engine.PlayerEntity`, any remote player entity (the ones carrying `PlayerIdentityData`), and any entity with an `AvatarShape` (NPCs — see the **npcs** skill). Writes to **any other entity are silently ignored** — no error, no plate.

### Attaching to other players

Remote players are ordinary entities, so both idioms are one-liners:

```typescript
import { onEnterScene } from '@dcl/sdk/src/players'
import { AvatarNametag } from '@dcl/sdk/ecs'

onEnterScene((player) => {
	AvatarNametag.createOrReplace(player.entity, { label: rankFor(player.userId) })
})
```

```typescript
import { engine, AvatarNametag, PlayerIdentityData } from '@dcl/sdk/ecs'

for (const [entity, identity] of engine.getEntitiesWith(PlayerIdentityData)) {
	AvatarNametag.createOrReplace(entity, { label: rankFor(identity.address) })
}
```

`AvatarNametag.deleteFrom(entity)` removes the plate immediately; the native nametag is unaffected. To revert a color to its native default, use `createOrReplace` and omit the field — it clears fields you leave out, whereas `getMutable` keeps them.

### Gotchas

- **No avatar-readiness dance.** Writing to a still-loading avatar is fine — the renderer retries internally and applies the plate when the avatar is ready. Do NOT poll, delay, or try to detect avatar readiness before writing.
- **The plate is client-local and is never relayed**, and player entity ids are recycled across disconnects — resolve the entity from the user id on *every* write (both idioms above do). For everyone to see the same tags, derive them from shared data (the roster pattern in the reference) or sync the assignment: **multiplayer-sync** → "Per-player visuals are NOT automatically shared".
- **Never call `createOrReplace` while iterating `engine.getEntitiesWith(...)`.** Replacing a component can move the entity to a different archetype and invalidate the live iterator. Collect entities into an array first, then write.
- **Don't rewrite the component every tick.** Compare against `AvatarNametag.getOrNull(entity)` before writing, or the scene emits a CRDT message per player per frame.
- **`label` is a single line.** Long labels truncate with an ellipsis; there is no wrapping. For a bare colored plate with no text, use a spaces-only label (`label: '    '`; more spaces = wider plate). Setting `labelColor` equal to `backgroundColor` does **not** hide the text — the rendered text color is not an exact match to the plate, so the word stays faintly visible.
- **Colors have no alpha.** `Color3` only; there is no opacity field.
- **Not implemented on mobile.** Mobile players see no plate at all, so never make it the only carrier of information — mirror rank/role in a `TextShape`, a HUD list, or a color the avatar already wears.
- Plates are hidden along with the native nametag inside an `AvatarModifierArea` using `AMT_HIDE_NAMETAGS` or `AMT_HIDE_AVATARS` (see below). There is no way to keep the plate while hiding the native tag.

## Avatar Modifier Areas

`AvatarModifierArea` changes avatars inside a box region: `AMT_HIDE_AVATARS` (avatars and nametags), `AMT_HIDE_NAMETAGS` (nametags only), `AMT_DISABLE_PASSPORTS` (no profile on click), with `excludeIds` wallets left unaffected. Size it with the explicit `area: Vector3`, which wins over `Transform.scale` for the life of the component (scaling the entity or a parent later changes nothing); mirror the same numbers into `scale` so the Creator Hub agrees. `TriggerArea` is the opposite: it has no size field, and its volume is the `Transform`. Code, modifier combinations, the sizing GOTCHA and Creator Hub support: `{baseDir}/references/modifier-areas.md`.

## Avatar Locomotion Settings

Adjust the player's movement speed and jump height:

```typescript
import { engine, AvatarLocomotionSettings } from '@dcl/sdk/ecs'

// Modify run speed and jump height (set only the fields you want to change)
AvatarLocomotionSettings.createOrReplace(engine.PlayerEntity, {
	runSpeed: 14, // default is 10
	jumpHeight: 3, // default is 1
})
```

Fields (all `float`, optional) with client defaults: `walkSpeed` (1.5), `jogSpeed` (8, the default movement speed), `runSpeed` (10), `jumpHeight` (1), `runJumpHeight` (1.5), `doubleJumpHeight` (2), `glidingSpeed` (6), `glidingFallingSpeed` (1), `hardLandingCooldown` (0.75s). See `references/avatar-apis.md`.

`glidingFallingSpeed` is a **max descent cap** — it limits how fast the player falls while gliding, but does not limit upward motion. While gliding, continuous scene forces are 1.5× stronger and can lift the player; see the `player-physics` skill ("Forces while gliding").

- **No negative values.** Every field is clamped to `>= 0`; a negative value becomes `0`. Setting a field to `0` has the same effect as blocking the matching key with `InputModifier` (e.g. `runSpeed: 0` ≈ `disableRun: true`).
- **Scene beats smart wearable.** If a scene and a smart wearable both set a field, the **scene's** value wins.
- **Scene bounds only.** The component affects the player solely while they are inside the scene's bounds, and only the local player — to change another avatar's locomotion, the code must run on *their* client.
- **Enforcing the defaults is a real use case:** a parkour or racing scene can write the default values explicitly so a smart wearable can't give its owner an advantage.

**Creator Hub / Inspector support:** a **"Locomotion Settings"** smart item (`utils` category, id `f0fdd9ac-5451-4d84-9964-ea437b11b211`) ships in the Smart Items pack. It is a `asset-packs::Script` item (`locomotion-settings.ts`, class `LocomotionSettings`) whose nine params are `Slider` fields seeded with the SDK defaults above, so a no-code user gets the same component without writing TypeScript. `start()` calls `AvatarLocomotionSettings.createOrReplace(engine.PlayerEntity, {...})`; it exposes two `@action`s — **Apply** (re-write the configured values) and **Restore Defaults** (`AvatarLocomotionSettings.deleteFrom(engine.PlayerEntity)`), so other smart items can trigger a speed boost and undo it. Its placeholder is an editor-only cube (`asset-packs::Placeholder`), invisible in-world. Prefer it over hand-built entities when the scene is open in the Creator Hub (see **creator-hub-mcp** `place_smart_item`).

## Restrict Locomotion (InputModifier)

To freeze or restrict the player's movement (cutscenes, locked interactions, an emote the player must not interrupt), put an `InputModifier` on `engine.PlayerEntity`: flags, behavior while frozen and the cutscene pattern are in **advanced-input** → *InputModifier (Movement Restriction)*. The teleport-lock example below shows it paired with `movePlayerTo`.

## Teleporting the Player

**`movePlayerTo` from `~system/RestrictedActions` is the only way to relocate the player to a position.** Setting `Transform.getMutable(engine.PlayerEntity).position` does NOT work (see the read-only warning at the top of this file). For sustained forces (lift, knockback, push, wind), use the `player-physics` skill instead — `movePlayerTo` is for explicit teleports/slides, not for forces.

`movePlayerTo` accepts:

- `newRelativePosition` — where to move the player (scene-relative `Vector3`)
- `cameraTarget` _(optional)_ — a point in space for the camera to face after moving
- `avatarTarget` _(optional)_ — a point in space for the avatar to face after moving
- `duration` _(optional)_ — transition time in seconds; if provided, movement can be awaited

**Constraints:**

- The player must already be inside the scene's bounds for this to work
- No player gesture needed: it can run from a timer (e.g. a respawn). Per-action gesture and confirmation rules: **scene-runtime** → *Restricted Actions*
- The target position must also be within the scene's bounds
- During the transition the avatar passes through colliders (verified: a `CL_PHYSICS` obstacle placed in the path is passed through)
- Requires the `ALLOW_TO_MOVE_PLAYER_INSIDE_SCENE` permission in `scene.json` `requiredPermissions`
- All fields except `newRelativePosition` are optional — `cameraTarget` and `avatarTarget` may each be omitted or used independently
- The target Y may be elevated (e.g. `y: 12`) to place the player on a raised platform, not just ground level
- To rotate the avatar without moving it, pass the current position as `newRelativePosition` and a facing point as `avatarTarget` (the [`80,-4-restricted-actions`](https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/80,-4-restricted-actions) "Rotate Avatar" buttons)

### Instant teleport

```typescript
import { movePlayerTo } from '~system/RestrictedActions'

void movePlayerTo({
	newRelativePosition: Vector3.create(8, 0, 8),
	cameraTarget: Vector3.create(8, 1, 12),
	avatarTarget: Vector3.create(8, 1, 12),
})
```

### Smooth transition with duration

When `duration` is set, `movePlayerTo` is awaitable. The resolved value has a `success` boolean — `false` if the player interrupted the movement with input.

```typescript
import { movePlayerTo } from '~system/RestrictedActions'

async function teleport() {
	const result = await movePlayerTo({
		newRelativePosition: Vector3.create(1, 0, 1),
		cameraTarget: Vector3.create(8, 1, 8),
		duration: 2,
	})
	if (!result.success) {
		console.log('Movement was interrupted by the player')
	}
}
```

### Prevent the player from interrupting a transition

Combine `InputModifier` with `movePlayerTo` to lock movement for the duration:

```typescript
import { movePlayerTo } from '~system/RestrictedActions'
import { InputModifier, engine } from '@dcl/sdk/ecs'

async function lockedTeleport() {
	InputModifier.create(engine.PlayerEntity, {
		mode: InputModifier.Mode.Standard({ disableAll: true }),
	})

	await movePlayerTo({
		newRelativePosition: Vector3.create(1, 0, 1),
		cameraTarget: Vector3.create(8, 1, 8),
		duration: 2,
	})

	InputModifier.deleteFrom(engine.PlayerEntity)
}
```

## Avatar Change Listeners

`AvatarBase.onChange` (appearance, name) and `AvatarEquippedData.onChange` (wearables) on `engine.PlayerEntity` or a remote player's entity: `{baseDir}/references/avatar-apis.md` → Avatar Change Listeners. Emote playback: *Detecting when an emote finishes*. Wallet checks with `getPlayer()` and `isGuest` before showing avatar items: **nft-blockchain**.

## Example scenes

Engine-team test scenes for attachments, emotes, masks, `movePlayerTo`, modifier areas, nametag plates and `InputModifier`: `{baseDir}/references/test-scenes.md`.

For component field details, see `{baseDir}/../sdk-scenes/references/components-reference.md`.
For anchor points, emote names, and event callbacks, see `{baseDir}/references/avatar-apis.md`.
For `AvatarNametag` fields, edge cases, and the multiplayer roster pattern, see `{baseDir}/references/avatar-nametag.md`.
