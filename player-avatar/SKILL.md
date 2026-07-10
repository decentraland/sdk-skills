---
name: player-avatar
description: The live player in a Decentraland scene. Read player position (Transform on engine.PlayerEntity), player profile (getPlayer, isGuest), fetch avatar appearance for ANY wallet address (catalyst /lambdas/profile endpoint, for off-scene users like parcel owners or NFT holders), trigger emotes (triggerEmote, triggerSceneEmote), read equipped wearables (AvatarEquippedData.onChange), attach objects to avatars (AvatarAttach with anchor points for cosmetics, OR parent to engine.CameraEntity for aim-sensitive held items like guns/reticles/flashlights that need to track camera pitch, OR parent to engine.PlayerEntity for yaw-only body-fixed items), hide avatars or disable passports in zones (AvatarModifierArea), adjust locomotion speed (AvatarLocomotionSettings), teleport the player (movePlayerTo), and listen for scene entry/exit (onEnterScene/onLeaveScene). Use when the user wants player position, player profile, off-scene avatar data, emotes, wearables, attaching items to players (cosmetic items vs held gameplay items), or avatar zones. Do NOT use for NPC characters (see npcs), wallet/blockchain checks (see nft-blockchain), freezing player movement (see advanced-input for InputModifier), or camera mode (see camera-control).
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
GltfContainer.create(hat, { src: 'models/hat.glb' })
Transform.create(hat, {})

// Attach to the local player's avatar
AvatarAttach.create(hat, {
	anchorPointId: AvatarAnchorPointType.AAPT_NAME_TAG,
})
```

> **Before picking `AvatarAttach`, decide whether the item is cosmetic or aim-critical.** Bone anchors inherit avatar skeleton animation (idle bob, walk cycle, gesture) — great for hats/backpacks/halos, **bad** for held weapons, aiming reticles, or anything where relative position must stay stable. See **Held items vs cosmetic items** below.

### Held items vs cosmetic items — `AvatarAttach` vs parenting to `engine.CameraEntity` / `engine.PlayerEntity`

SDK7 gives you three distinct mechanisms for "an entity that follows the player". They are not interchangeable — picking the wrong one is the single most common mistake when porting "held item" patterns from SDK6, and the most common subtle failure is parenting an aim-sensitive item (gun, reticle, flashlight) to `engine.PlayerEntity` and discovering the item does not track camera pitch when the player looks up or down.

**Default for any aim-sensitive held item: `Transform.parent = engine.CameraEntity`.** Use `engine.PlayerEntity` only when you specifically want yaw-only / no-pitch behavior (a body-fixed item the player carries but never aims with).

| Goal | Use | Tracks | Reason |
|------|-----|--------|--------|
| **Aim-sensitive held item** — gun, aiming reticle, flashlight, anything pointed by looking around. **Recommended default for held gameplay items.** | `Transform.parent = engine.CameraEntity` (plus local position offset for "in front of and below" the camera) | Camera yaw **+ pitch** | Follows the camera's full transform, so the item points where the player is looking — including up/down. This is the SDK7 analogue of SDK6's `Attachable.FIRST_PERSON_CAMERA`. Aim stable (no animation jitter). |
| **Yaw-only / body-fixed item** — a held shield the player doesn't aim, a static torch, a fixed-position carry item that should stay level regardless of where the player looks. | `Transform.parent = engine.PlayerEntity` (plus local offset for hand-height / forward distance) | Player root: feet position + body **yaw only** (no pitch) | Follows the player's root transform. Stable (no animation), but stays level when the player looks up/down — wrong default for guns/aim items, correct for items meant to ride the body orientation only. |
| **Cosmetic item** — hat, halo, backpack, name plate, glow effect, torch visible to other players riding the avatar. | `AvatarAttach` with an `anchorPointId` (e.g. `AAPT_HEAD`, `AAPT_SPINE`, `AAPT_LEFT_HAND`) | The actual animated bone | Item moves naturally with idle bob, walk cycle, and gestures — visually correct for cosmetics attached to the body. **Not for aim** — animation jitter makes aim-sensitive items unusable. |

**Why `engine.CameraEntity` is the right default for aim-sensitive items:** `engine.PlayerEntity` only tracks the player's root (foot position + body yaw). Body yaw is NOT camera pitch — when the player tilts the camera up to aim at a flying target, the player root rotation does not change, so a gun parented to `PlayerEntity` stays flat and the muzzle doesn't track the look direction. Parenting to `engine.CameraEntity` inherits both yaw and pitch, so the gun aims where the camera looks. This matches the SDK6 `Attachable.FIRST_PERSON_CAMERA` behavior creators expect when porting.

**Why bone anchors break aim:** anchor points like `AAPT_RIGHT_HAND`, `AAPT_SPINE`, `AAPT_HEAD` are positions on the animated avatar skeleton. Every frame the engine pulls the bone's current world transform — which includes the procedural idle bob and any active animation clip. An entity parented there inherits all of that motion. For a weapon, this reads as jitter and makes aiming feel uncontrollable.

#### Example — gun held in first person (aim follows camera pitch)

```typescript
import { engine, Transform, GltfContainer, CameraModeArea, CameraType } from '@dcl/sdk/ecs'
import { Vector3, Quaternion } from '@dcl/sdk/math'

const gun = engine.addEntity()
GltfContainer.create(gun, { src: 'assets/Models/blaster.glb' })
Transform.create(gun, {
	parent: engine.CameraEntity,           // gun follows camera (yaw + pitch) — aim tracks where you look
	position: Vector3.create(0.25, -0.2, 0.5), // right, down, forward of camera
	rotation: Quaternion.fromEulerDegrees(0, 0, 0),
	scale: Vector3.One(),
})
```

If the user does NOT want the item to track pitch (e.g. a held torch that should stay level, not point up when looking up), swap `engine.CameraEntity` for `engine.PlayerEntity`. **Do not pick `PlayerEntity` for a gun** — the result is a flat-pointing weapon that ignores look direction.

**Pair with `CameraModeArea` or a forced camera mode when equipping a held gun**, so the player is in first-person while aiming. See [[camera-control]].

#### Anti-pattern (what NOT to do for a held weapon)

```typescript
// WRONG — gun jitters with every idle/walk/gesture animation frame
AvatarAttach.create(gun, {
	anchorPointId: AvatarAnchorPointType.AAPT_RIGHT_HAND,
})
```

This **looks** like the right SDK7 way to "put a gun in the avatar's hand" because the API name reads that way — but the hand bone is animated, so the gun is unaimable in practice. Use parenting instead.

```typescript
// SUBTLY WRONG for a gun — looks correct in hip-fire, fails the moment the player aims up
Transform.create(gun, { parent: engine.PlayerEntity, position: ... })
```

`engine.PlayerEntity` inherits body yaw but NOT camera pitch. The gun stays flat when the player looks up to aim at a high target. Use `engine.CameraEntity` instead for any aim-sensitive item. `PlayerEntity` is correct only for body-fixed items that should stay level regardless of where the camera points (e.g. a carried lantern, a non-aimed shield).

#### SDK6 porting note

In SDK7 you have a choice that didn't exist in SDK6. SDK6's `Attachable.FIRST_PERSON_CAMERA` / `Attachable.AVATAR` mapped to coarse follow modes only. If you are porting a held item from an SDK6 scene that used `Attachable.FIRST_PERSON_CAMERA`, the SDK7 equivalent is **parenting to `engine.CameraEntity`** (NOT `AvatarAttach` to a hand anchor, and NOT `engine.PlayerEntity` — `PlayerEntity` loses camera pitch). See [[migrate-sdk6-to-sdk7]].

### Anchor Points

```typescript
AvatarAnchorPointType.AAPT_NAME_TAG // Above the head
AvatarAnchorPointType.AAPT_RIGHT_HAND // Right hand
AvatarAnchorPointType.AAPT_LEFT_HAND // Left hand
AvatarAnchorPointType.AAPT_POSITION // [DEPRECATED] Avatar root position — protocol recommends parenting to `engine.PlayerEntity` (body-fixed) or `engine.CameraEntity` (aim-sensitive) instead
AvatarAnchorPointType.AAPT_HEAD
AvatarAnchorPointType.AAPT_NECK
AvatarAnchorPointType.AAPT_SPINE
AvatarAnchorPointType.AAPT_SPINE1
AvatarAnchorPointType.AAPT_SPINE2
AvatarAnchorPointType.AAPT_HIP
AvatarAnchorPointType.AAPT_LEFT_SHOULDER
AvatarAnchorPointType.AAPT_LEFT_ARM
AvatarAnchorPointType.AAPT_LEFT_FOREARM
AvatarAnchorPointType.AAPT_LEFT_HAND_INDEX
AvatarAnchorPointType.AAPT_RIGHT_SHOULDER
AvatarAnchorPointType.AAPT_RIGHT_ARM
AvatarAnchorPointType.AAPT_RIGHT_FOREARM
AvatarAnchorPointType.AAPT_RIGHT_HAND_INDEX
AvatarAnchorPointType.AAPT_LEFT_UP_LEG
AvatarAnchorPointType.AAPT_LEFT_LEG
AvatarAnchorPointType.AAPT_LEFT_FOOT
AvatarAnchorPointType.AAPT_LEFT_TOE_BASE
AvatarAnchorPointType.AAPT_RIGHT_UP_LEG
AvatarAnchorPointType.AAPT_RIGHT_LEG
AvatarAnchorPointType.AAPT_RIGHT_FOOT
AvatarAnchorPointType.AAPT_RIGHT_TOE_BASE
AvatarAnchorPointType.AAPT_NAME_TAG
```

**Anchor points inherit bone animation.** Bone-targeted anchors (`AAPT_RIGHT_HAND`, `AAPT_SPINE`, `AAPT_HEAD`, etc.) follow the **animated** skeleton — idle bob, walk cycle, and gesture animations all propagate to the attached entity. This is correct for cosmetic items (hats, halos, backpacks) and **wrong** for gameplay items where aim stability matters (guns, reticles). For aim-sensitive items parent to `engine.CameraEntity` (yaw + pitch — the default for guns/reticles/flashlights); for yaw-only body-fixed items parent to `engine.PlayerEntity`. See "Held items vs cosmetic items" above.

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

To attach the **local** player's own held item, get the address from `getPlayer()` / `await getPlayer()` (`.userId`). Omitting `avatarId` attaches to the local player. For multiplayer visibility of a held/attached item, sync the anchor entity's `AvatarAttach` component (see [[multiplayer-sync]]).

## Triggering Emotes

### Default Emotes

```typescript
import { triggerEmote } from '~system/RestrictedActions'

// Play a built-in emote
triggerEmote({ predefinedEmote: 'robot' })
triggerEmote({ predefinedEmote: 'wave' })
triggerEmote({ predefinedEmote: 'clap' })
```

### Custom Scene Emotes

> ⚠️ **CRITICAL FILE NAMING REQUIREMENT:** The emote `.glb` file **MUST** end with `_emote.glb` (case-insensitive). This is **not** optional and **not** just a convention — the runtime rejects files that don't match this suffix.
>
> **Why this matters:** Scenes with incorrectly named emote files often **work fine in `npm run start` preview** but **silently fail in production** once deployed. Preview is more permissive; the deployed runtime is strict. Always rename the file on disk (e.g. `SnowballThrow.glb` → `SnowballThrow_emote.glb`) before deploying.
>
> Valid: `wave_emote.glb`, `Snowball_Throw_emote.glb`, `dance_EMOTE.GLB`
> Invalid: `wave.glb`, `emote_wave.glb`, `wave_emote_v2.glb`

```typescript
import { triggerSceneEmote } from '~system/RestrictedActions'

// File MUST end with _emote.glb — rename it on disk if it doesn't
triggerSceneEmote({
	src: 'animations/Snowball_Throw_emote.glb',
	loop: false,
})
```

**Notes:**

- Emotes play only while the player is standing still — walking or jumping interrupts them
- If you don't want a player to interrupt an emote, use the `InputModifier` component to freeze the player for the duration of the emote
- Custom emote files **must** end with the `_emote.glb` suffix (case-insensitive) — scenes that ignore this may work in preview but break once deployed
- Both `triggerEmote` and `triggerSceneEmote` require the scene to declare the `ALLOW_TO_TRIGGER_AVATAR_EMOTE` permission in `scene.json` `requiredPermissions`.
- `[UNVERIFIED — landing in an upcoming SDK release]` The protocol (verified in `restricted_actions.proto` on protocol `origin/main`) adds an optional emote **mask** that limits which bones the animation drives: `TriggerEmoteRequest.mask` and `TriggerSceneEmoteRequest.mask`, typed as the new shared enum `AvatarMask` with a single value `AM_UPPER_BODY = 0` (upper-body-only animation, e.g. play an emote while still walking). Intended usage: `triggerSceneEmote({ src: '...glb', loop: true, mask: AvatarMask.AM_UPPER_BODY })`. **Not yet exported by the released `@dcl/sdk`** — a repo-wide search of js-sdk-toolchain `origin/main` finds no `AvatarMask`/`AM_UPPER_BODY` (nor the earlier `AvatarEmoteMask`/`AEM_UPPER_BODY`) export. Do not rely on it until the SDK ships it; verify the exact enum name against the released `@dcl/sdk/ecs` at that time.

### Stopping an emote

`stopEmote({})` from `~system/RestrictedActions` stops the local player's currently playing emote (built-in or scene emote). Useful to end a looping scene emote (`triggerSceneEmote({ src, loop: true })`) on demand — e.g. a "pick up / put down" toggle.

```typescript
import { stopEmote } from '~system/RestrictedActions'
stopEmote({})
```

### [EXPERIMENTAL] Emote masks (upper-body / full-body)

`triggerSceneEmote` and `stopEmote` accept a `mask` param (`AvatarEmoteMask` from `@dcl/sdk/ecs`) to restrict a looping emote to part of the body, letting the player keep walking while the upper body animates (e.g. carrying an object).

```typescript
import { AvatarEmoteMask } from '@dcl/sdk/ecs'
triggerSceneEmote({ src: 'animations/Carry_emote.glb', loop: true, mask: AvatarEmoteMask.AEM_UPPER_BODY })
```

Values: `AvatarEmoteMask.AEM_UPPER_BODY`, `AvatarEmoteMask.AEM_FULL_BODY`.

`[EXPERIMENTAL]` — the `mask` field is **not in `protocol/main`** as of this writing. It is only available in an experimental SDK toolchain (`feat/avatar-masks-experimental`) / bleeding-edge commit builds. Do NOT rely on it in a scene targeting the released `@dcl/sdk`; verify it exists in the installed SDK before use. `[UNVERIFIED: not in released protocol — confirm before documenting as stable]`

## NPC Avatars

For creating NPCs (characters, shopkeepers, guards, etc.), see the **npcs** skill. It covers both the NPC Toolkit library (GLB-based, with dialogue and movement) and `AvatarShape`-based avatar NPCs.

## Avatar Modifier Areas

Modify how avatars appear or behave in a region.

```typescript
import {
	engine,
	Transform,
	AvatarModifierArea,
	AvatarModifierType,
} from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

const modifierArea = engine.addEntity()
Transform.create(modifierArea, {
	position: Vector3.create(8, 1.5, 8),
	scale: Vector3.create(4, 3, 4),
})

AvatarModifierArea.create(modifierArea, {
	area: Vector3.create(4, 3, 4),
	modifiers: [AvatarModifierType.AMT_HIDE_AVATARS],
	excludeIds: ['0x123...abc'], // Optional: exclude specific players
})
```

### Available Modifiers

```typescript
AvatarModifierType.AMT_HIDE_AVATARS // Hide all avatars in the area
AvatarModifierType.AMT_DISABLE_PASSPORTS // Disable clicking on avatars to see profiles
AvatarModifierType.AMT_HIDE_NAMETAGS // Hide the name tag above avatars in the area
```

`modifiers` is an array — combine several, e.g. `[AMT_HIDE_AVATARS, AMT_DISABLE_PASSPORTS]`. The `AvatarModifierArea` component takes both an `area: Vector3` field (the region size) AND the entity's `Transform.scale`; set both to the same size. `excludeIds` is an array of wallet addresses that stay unaffected; mutate it at runtime via `AvatarModifierArea.getMutable(entity).excludeIds = [...]`.

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

Fields (all `float`, optional) with client defaults — verified against unity-explorer `origin/main` `CharacterControllerSettings.asset`: `walkSpeed` (1.5), `jogSpeed` (8, the default movement speed), `runSpeed` (10), `jumpHeight` (1), `runJumpHeight` (1.5), `doubleJumpHeight` (2), `glidingSpeed` (6), `glidingFallingSpeed` (1), `hardLandingCooldown` (0.75s). See `references/avatar-apis.md`.

## Restrict Locomotion (InputModifier)

Use `InputModifier` on `engine.PlayerEntity` to freeze or selectively restrict the player's movement — useful for cutscenes, locked interactions, or controlled game mechanics.

```typescript
import { InputModifier, engine } from '@dcl/sdk/ecs'

// Freeze all movement
InputModifier.create(engine.PlayerEntity, {
	mode: InputModifier.Mode.Standard({ disableAll: true }),
})

// Remove restrictions
InputModifier.deleteFrom(engine.PlayerEntity)
```

**Behavior when frozen:** gravity and external forces still apply, camera rotation stays available, global input events are still detectable, restrictions lift automatically when the player leaves scene bounds.

**Standard-mode flags** (all boolean, on `InputModifier.Mode.Standard({...})`): `disableAll`, `disableWalk`, `disableJog`, `disableRun`, `disableJump`, `disableEmote`. Protocol also defines `disableDoubleJump` and `disableGliding`. Note `disableJog` is separate from `disableWalk`/`disableRun` — jog is the default movement speed, so disabling only walk+run still lets the player jog.

The `mode` can be built two equivalent ways — the `InputModifier.Mode.Standard({...})` helper, or the raw discriminated union `{ $case: 'standard', standard: {...} }`.

**Tip:** Combine with `triggerSceneEmote` — freeze the player during an animation, then remove InputModifier when it ends.

For the cutscene pattern, see the **advanced-input** skill.

## Teleporting the Player

**`movePlayerTo` from `~system/RestrictedActions` is the only way to relocate the player to a position.** Setting `Transform.getMutable(engine.PlayerEntity).position` does NOT work (see the read-only warning at the top of this file). For sustained forces (lift, knockback, push, wind), use the `player-physics` skill instead — `movePlayerTo` is for explicit teleports/slides, not for forces.

`movePlayerTo` accepts:

- `newRelativePosition` — where to move the player (scene-relative `Vector3`)
- `cameraTarget` _(optional)_ — a point in space for the camera to face after moving
- `avatarTarget` _(optional)_ — a point in space for the avatar to face after moving
- `duration` _(optional)_ — transition time in seconds; if provided, movement can be awaited

**Constraints:**

- The player must already be inside the scene's bounds for this to work
- The target position must also be within the scene's bounds
- During the transition the avatar passes through colliders (verified: a `CL_PHYSICS` obstacle placed in the path is passed through)
- Requires the `ALLOW_TO_MOVE_PLAYER_INSIDE_SCENE` permission in `scene.json` `requiredPermissions`
- All fields except `newRelativePosition` are optional — `cameraTarget` and `avatarTarget` may each be omitted or used independently
- The target Y may be elevated (e.g. `y: 12`) to place the player on a raised platform, not just ground level

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

### Avatar Change Listeners

React to avatar changes in real-time:

```typescript
import {
	AvatarEmoteCommand,
	AvatarBase,
	AvatarEquippedData,
} from '@dcl/sdk/ecs'

// Detect when any player triggers an emote
AvatarEmoteCommand.onChange(engine.PlayerEntity, (cmd) => {
	if (cmd) console.log('Emote played:', cmd.emoteUrn)
})

// Detect avatar appearance changes (wearables, skin color, etc.)
AvatarBase.onChange(engine.PlayerEntity, (base) => {
	if (base) console.log('Avatar name:', base.name)
})

// Detect equipment changes
AvatarEquippedData.onChange(engine.PlayerEntity, (equipped) => {
	if (equipped) console.log('Wearables changed:', equipped.wearableUrns)
})
```

### Additional Anchor Points

Beyond the commonly used anchor points, the full list includes:

- `AvatarAnchorPointType.AAPT_POSITION` — avatar feet position
- `AvatarAnchorPointType.AAPT_NAME_TAG` — above the name tag
- `AvatarAnchorPointType.AAPT_LEFT_HAND` / `AAPT_RIGHT_HAND`
- `AvatarAnchorPointType.AAPT_HEAD` — head bone
- `AvatarAnchorPointType.AAPT_NECK` — neck bone

> **Need to check the player's wallet before showing avatar items?** See the **nft-blockchain** skill for wallet checks with `getPlayer()` and `isGuest`.

## Best Practices

- Always check `Transform.has(engine.PlayerEntity)` before reading player data — it may not be ready on the first frame
- Use `getPlayer()` to check `isGuest` before attempting wallet-dependent features
- `AvatarAttach` requires the target player to be in the same scene — attachments disappear when the player leaves
- Custom emote files **must** be named with the `_emote.glb` suffix (case-insensitive) — without it, `triggerSceneEmote` may work in `npm run start` preview but silently fail in the deployed scene. Rename the file on disk, don't just rename the reference.
- Use `AvatarModifierArea` with `AMT_HIDE_AVATARS` for private rooms or single-player puzzle areas
- Add `excludeIds` to modifier areas when you want specific players (like the scene owner) to remain visible
- **Never mutate the player's Transform** (`Transform.getMutable`, `Transform.createOrReplace`, direct `.position` / `.rotation` assignment on `engine.PlayerEntity`) — the engine silently ignores it. Code compiles and runs but the avatar does not move. Use `movePlayerTo` for teleports/slides, or `Physics.*` (skill: `player-physics`) for forces (lift, knockback, push, wind).
- `Transform.get(engine.PlayerEntity)` is valid for **reading** position and rotation only

## Example scenes

Engine-team test scenes (exercised against the real engine):

- [100,102-avatar-attach-test](https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/100,102-avatar-attach-test) — `AvatarAttach` on multiple anchor points; enumerates every player via `PlayerIdentityData` and attaches to `player.address`; a follower entity reconstructs the attached world position from `PlayerEntity` + attached Transform.
- [80,-1-scene-emotes](https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/80,-1-scene-emotes) — `triggerEmote`, `triggerSceneEmote` (with a deliberately mis-named non-`_emote.glb` file shown NOT playing), `stopEmote`, and `[EXPERIMENTAL]` `mask: AvatarEmoteMask.AEM_UPPER_BODY`.
- [11,0-move-player-to-duration](https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/11,0-move-player-to-duration) — `movePlayerTo` with `duration`, reading `result.success` via `.then()`, `InputModifier` locking input during the slide, and a `CL_PHYSICS` obstacle the avatar passes through mid-transition.
- [9,99-modifier-areas](https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/9,99-modifier-areas) — `AvatarModifierArea` (`AMT_HIDE_AVATARS`) with runtime-mutated `excludeIds`, alongside `CameraModeArea`.
- [0,1-input-modifier](https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/0,1-input-modifier) — `InputModifier` toggling every Standard flag (`disableAll/Walk/Jog/Run/Jump/Emote`), both via the helper and the raw `$case` form.
- [80,-4-restricted-actions](https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/80,-4-restricted-actions) — `movePlayerTo` (incl. elevated `y`, `avatarTarget`-only turns), `triggerEmote`, `triggerSceneEmote`, `teleportTo`, `openExternalUrl`.
- [88,-13-avatar-masks](https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/88,-13-avatar-masks) — `[EXPERIMENTAL]` emote masks: looping upper-body scene emote + `AvatarAttach` anchor to hold a synced crate, `stopEmote` to release. Uses an experimental SDK branch — treat mask APIs as unreleased.

For component field details, see `{baseDir}/../sdk-scenes/references/components-reference.md`.
For anchor points, emote names, and event callbacks, see `{baseDir}/references/avatar-apis.md`.
