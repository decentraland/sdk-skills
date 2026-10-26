# Avatar APIs Reference

## AvatarShape — Full Fields

Create NPC avatars in your scene:

```typescript
import { AvatarShape } from '@dcl/sdk/ecs'

AvatarShape.create(entity, {
	id: 'npc-0001', // Unique; its last 4 characters show beside the name
	name: 'NPC Name', // Display name
	bodyShape: 'urn:decentraland:off-chain:base-avatars:BaseMale', // or BaseFemale
	wearables: [
		// Array of wearable URNs
		'urn:decentraland:off-chain:base-avatars:eyebrows_00',
		'urn:decentraland:off-chain:base-avatars:mouth_00',
		'urn:decentraland:off-chain:base-avatars:eyes_00',
		'urn:decentraland:off-chain:base-avatars:blue_tshirt',
		'urn:decentraland:off-chain:base-avatars:brown_pants',
		'urn:decentraland:off-chain:base-avatars:classic_shoes',
		'urn:decentraland:off-chain:base-avatars:short_hair',
	],
	hairColor: { r: 0.92, g: 0.76, b: 0.62 }, // RGB 0-1
	skinColor: { r: 0.94, g: 0.85, b: 0.6 }, // RGB 0-1
	eyeColor: { r: 0.2, g: 0.4, b: 0.7 }, // RGB 0-1
	expressionTriggerId: '', // built-in emote name OR a scene-emote _emote.glb path
	expressionTriggerTimestamp: 0, // Lamport timestamp; bump to replay the SAME id
	talking: false, // Mouth animation
	emotes: [], // Custom emote URNs
	showOnlyWearables: false, // Mannequin mode (show wearables without body)
})
```

`expressionTriggerId` on an AvatarShape plays either a built-in emote (`'robot'`) or a custom scene emote by `.glb` path (same `_emote.glb` files as `triggerSceneEmote`). Confirmed in test scenes 4,21 and 4,22.

The path is relative to the **project root, exactly as the file sits on disk** — `'assets/animations/sit_emote.glb'`, not `'animations/sit_emote.glb'`. A wrong path is ignored silently (no log, no error). Test scene 4,22 uses `'animations/Snowball_Throw_emote.glb'` only because that folder is at its project root. See **npcs** → "Playing expressions on an AvatarShape NPC".

### Body Shape URNs

- `urn:decentraland:off-chain:base-avatars:BaseMale`
- `urn:decentraland:off-chain:base-avatars:BaseFemale`

### Common Base Wearable URNs

**Required minimums (avatar won't render without face features):**

- `urn:decentraland:off-chain:base-avatars:eyebrows_00` through `eyebrows_07`
- `urn:decentraland:off-chain:base-avatars:mouth_00` through `mouth_04`
- `urn:decentraland:off-chain:base-avatars:eyes_00` through `eyes_11`

**Hair:**

- `short_hair`, `long_hair`, `curly_hair`, `bald`, `mohawk`, `ponytail`, `cornrows`, `cool_hair`

**Upper body:**

- `blue_tshirt`, `red_tshirt`, `green_tshirt`, `black_tshirt`, `white_shirt`, `striped_shirt`, `elegant_sweater`

**Lower body:**

- `brown_pants`, `blue_jeans`, `cargo_pants`, `shorts`, `formal_pants`

**Shoes:**

- `classic_shoes`, `sport_shoes`, `elegant_shoes`, `sneakers`

All base wearable URNs follow the pattern: `urn:decentraland:off-chain:base-avatars:<name>`

### Mannequin Mode

Display wearables without a full avatar body — useful for storefronts:

```typescript
AvatarShape.create(entity, {
	id: 'mannequin-0001',
	name: 'Display',
	wearables: ['urn:decentraland:matic:collections-v2:0x...:0'],
	showOnlyWearables: true,
})
```

## All Anchor Points

```typescript
import { AvatarAnchorPointType } from '@dcl/sdk/ecs'

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

## Built-in Emote Names

For `triggerEmote({ predefinedEmote: '...' })` and for `AvatarShape.expressionTriggerId` (NPCs and copies of the player — see **npcs**). Animated previews of all 32 names, and 45 downloadable `_emote.glb` clips beyond them: `{baseDir}/../avatar-animations/references/animation-catalog.md`.

### Embedded emotes — shipped inside the Explorer

The Explorer ships 21 embedded emotes (sitting, interactions and more; the sitting ones loop). The full list — exact ids (use the casing listed; the Explorer matches ignoring case) and loop flags — lives in one place: **`{baseDir}/../avatar-animations/references/embedded-emotes.md`**. Check it before authoring a custom emote for a pose.

**Social** — not in the embedded asset; resolved as emote urns like any other:
- `wave` — wave hello
- `fistpump` — fist pump
- `robot` — robot dance
- `raiseHand` — raise hand
- `clap` — clap hands
- `money` — money gesture
- `kiss` — blow a kiss
- `tik` — tik dance
- `hammer` — hammer dance
- `tektonik` — tektonik dance
- `dontsee` — cover eyes
- `handsair` — hands in the air
- `shrug` — shrug shoulders
- `disco` — disco dance
- `dab` — dab
- `headexplode` — head explode

## Player Event Callbacks

### Scene Entry/Exit

```typescript
import { onEnterScene, onLeaveScene } from '@dcl/sdk/src/players'

onEnterScene((player) => {
	console.log('Player entered:', player.userId)
})

onLeaveScene((userId) => {
	console.log('Player left:', userId)
})
```

### Avatar Change Listeners

```typescript
import {
	AvatarEmoteCommand,
	AvatarBase,
	AvatarEquippedData,
	EmoteState,
} from '@dcl/sdk/ecs'

// Emote lifecycle: each entry carries state ES_STARTED / ES_FINISHED / ES_INTERRUPTED.
// `state` is optional in the protocol; absent means STARTED — always apply the ?? default.
// See SKILL.md "Detecting when an emote finishes".
AvatarEmoteCommand.onChange(engine.PlayerEntity, (cmd) => {
	if (cmd) console.log('Emote:', cmd.emoteUrn, 'state:', cmd.state ?? EmoteState.ES_STARTED)
})

// Appearance changed
AvatarBase.onChange(engine.PlayerEntity, (base) => {
	if (base) console.log('Name:', base.name, 'Body:', base.bodyShapeUrn)
})

// Equipment changed
AvatarEquippedData.onChange(engine.PlayerEntity, (equipped) => {
	if (equipped) console.log('Wearables:', equipped.wearableUrns)
})
```

## AvatarModifierType — All Values

```typescript
AvatarModifierType.AMT_HIDE_AVATARS // Hide all avatars in area
AvatarModifierType.AMT_DISABLE_PASSPORTS // Disable clicking avatars for profiles
AvatarModifierType.AMT_HIDE_NAMETAGS // Hide name tags above avatars in area
```

To disable jumping in an area, use the `InputModifier` component's `disableJump` flag (covered in the advanced-input skill), not an `AvatarModifierType`.

## AvatarLocomotionSettings

```typescript
// Values shown are the CLIENT DEFAULTS — set only the fields you want to change.
AvatarLocomotionSettings.createOrReplace(engine.PlayerEntity, {
	walkSpeed: 1.5, // Control key on desktop
	jogSpeed: 8, // the default movement speed
	runSpeed: 10, // Shift key on desktop
	jumpHeight: 1,
	runJumpHeight: 1.5,
	doubleJumpHeight: 2,
	glidingSpeed: 6, // horizontal speed while gliding
	glidingFallingSpeed: 1, // MAX descent speed while gliding — caps falling only, does not limit upward motion (e.g. lift from a continuous force)
	hardLandingCooldown: 0.75, // seconds before moving again after a high fall
})
```

All fields are `float`; each is optional (omit to keep the client default). Default values (verified against unity-explorer `origin/main` `Explorer/Assets/DCL/Character/CharacterMotion/Settings/CharacterControllerSettings.asset`):

| Field                 | Default | Source field in .asset |
| --------------------- | ------- | ---------------------- |
| `walkSpeed`           | `1.5`   | `WalkSpeed`            |
| `jogSpeed`            | `8`     | `JogSpeed`             |
| `runSpeed`            | `10`    | `RunSpeed`             |
| `jumpHeight`          | `1`     | `JogJumpHeight`        |
| `runJumpHeight`       | `1.5`   | `RunJumpHeight`        |
| `doubleJumpHeight`    | `2`     | `AirJumpHeight`        |
| `glidingSpeed`        | `6`     | `GlideSpeed`           |
| `glidingFallingSpeed` | `1`     | `GlideMaxGravity`      |
| `hardLandingCooldown` | `0.75`  | `LongFallStunTime`     |
