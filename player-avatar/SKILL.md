---
name: player-avatar
description: The live player in a Decentraland scene. Read player position (Transform on engine.PlayerEntity), player profile (getPlayer, isGuest), fetch avatar appearance for ANY wallet address (catalyst /lambdas/profile endpoint, for off-scene users like parcel owners or NFT holders), trigger emotes (triggerEmote, triggerSceneEmote), read equipped wearables (AvatarEquippedData.onChange), attach objects to avatars (AvatarAttach with anchor points), hide avatars or disable passports in zones (AvatarModifierArea), adjust locomotion speed (AvatarLocomotionSettings), teleport the player (movePlayerTo), and listen for scene entry/exit (onEnterScene/onLeaveScene). Use when the user wants player position, player profile, off-scene avatar data, emotes, wearables, attaching items to players, or avatar zones. Do NOT use for NPC characters (see npcs), wallet/blockchain checks (see nft-blockchain), freezing player movement (see advanced-input for InputModifier), or camera mode (see camera-control).
---

# Player and Avatar System in Decentraland

## Player Position and Movement

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
Transform.crete(hat, {})

// Attach to the local player's avatar
AvatarAttach.create(hat, {
	anchorPointId: AvatarAnchorPointType.AAPT_NAME_TAG,
})
```

### Anchor Points

```typescript
AvatarAnchorPointType.AAPT_NAME_TAG // Above the head
AvatarAnchorPointType.AAPT_RIGHT_HAND // Right hand
AvatarAnchorPointType.AAPT_LEFT_HAND // Left hand
AvatarAnchorPointType.AAPT_POSITION // Avatar root position
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

### Attach to a Specific Player

```typescript
AvatarAttach.create(hat, {
	avatarId: '0x123...abc', // Target player's wallet address
	anchorPointId: AvatarAnchorPointType.AAPT_RIGHT_HAND,
})
```

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

```typescript
import { triggerSceneEmote } from '~system/RestrictedActions'

// Play a custom emote animation (file must end with _emote.glb)
triggerSceneEmote({
	src: 'animations/Snowball_Throw_emote.glb',
	loop: false,
})
```

**Notes:**

- Emotes play only while the player is standing still — walking or jumping interrupts them
- If you don't want a player to interrupt an emote, use the `InputModifier` component to freeze the player for the duration of the emote
- Custom emote files must have the `_emote.glb` suffix

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
	area: { box: Vector3.create(4, 3, 4) },
	modifiers: [AvatarModifierType.AMT_HIDE_AVATARS],
	excludeIds: ['0x123...abc'], // Optional: exclude specific players
})
```

### Available Modifiers

```typescript
AvatarModifierType.AMT_HIDE_AVATARS // Hide all avatars in the area
AvatarModifierType.AMT_DISABLE_PASSPORTS // Disable clicking on avatars to see profiles
```

## Avatar Locomotion Settings

Adjust the player's movement speed and jump height:

```typescript
import { engine, AvatarLocomotionSettings } from '@dcl/sdk/ecs'

// Modify run speed and jump height
AvatarLocomotionSettings.createOrReplace(engine.PlayerEntity, {
	runSpeed: 8, // default is ~6
	jumpHeight: 3, // default is ~1.5
})
```

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

**Tip:** Combine with `triggerSceneEmote` — freeze the player during an animation, then remove InputModifier when it ends.

For all available flags (`disableWalk`, `disableRun`, `disableJump`, etc.) and the cutscene pattern, see the **advanced-input** skill.

## Teleporting the Player

**You MUST use `movePlayerTo` from `~system/RestrictedActions` to move or teleport the player.** Setting `Transform.getMutable(engine.PlayerEntity).position` does NOT work — the runtime ignores direct writes to the player transform.

`movePlayerTo` accepts:

- `newRelativePosition` — where to move the player (scene-relative `Vector3`)
- `cameraTarget` _(optional)_ — a point in space for the camera to face after moving
- `avatarTarget` _(optional)_ — a point in space for the avatar to face after moving
- `duration` _(optional)_ — transition time in seconds; if provided, movement can be awaited

**Constraints:**

- The player must already be inside the scene's bounds for this to work
- The target position must also be within the scene's bounds
- During the transition the avatar passes through colliders

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
- Custom emote files must use the `_emote.glb` naming convention
- Use `AvatarModifierArea` with `AMT_HIDE_AVATARS` for private rooms or single-player puzzle areas
- Add `excludeIds` to modifier areas when you want specific players (like the scene owner) to remain visible
- **Never use `Transform.getMutable(engine.PlayerEntity)` to move the player** — it does not work. Always use `movePlayerTo` from `~system/RestrictedActions`
- `Transform.get(engine.PlayerEntity)` is valid for **reading** position only

For component field details, see `{baseDir}/../sdk-scenes/references/components-reference.md`.
For anchor points, emote names, and event callbacks, see `{baseDir}/references/avatar-apis.md`.
