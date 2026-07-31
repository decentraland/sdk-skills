# Avatar APIs Reference

## AvatarShape — Full Fields

Create NPC avatars in your scene:

```typescript
import { AvatarShape } from '@dcl/sdk/ecs'

AvatarShape.create(entity, {
	id: 'npc-unique-id', // Unique identifier (required)
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

`expressionTriggerId` on an AvatarShape plays either a built-in emote (`'robot'`) or a custom scene emote by `.glb` path (`'animations/Snowball_Throw_emote.glb'`, same `_emote.glb` files as `triggerSceneEmote`). Confirmed in test scenes 4,21 and 4,22.

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
	id: 'mannequin-1',
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

For `triggerEmote({ predefinedEmote: '...' })`:

**Interactions:**
- `buttonDown` — press button downward
- `buttonFront` — press button forward
- `getHit` — react to being hit
- `knockOut` — fall knocked out
- `lever` — pull a lever
- `openChest` — open a chest
- `openDoor` — open a door
- `punch` — punch
- `push` — push something
- `swingWeaponOneHand` — one-handed weapon swing
- `swingWeaponTwoHands` — two-handed weapon swing
- `throw` — throw an object

**Sitting:**
- `sittingChair1` — sit in chair (variant 1)
- `sittingChair2` — sit in chair (variant 2)
- `sittingGround1` — sit on ground (variant 1)
- `sittingGround2` — sit on ground (variant 2)

**Social:**
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
} from '@dcl/sdk/ecs'

// Emote played
AvatarEmoteCommand.onChange(engine.PlayerEntity, (cmd) => {
	if (cmd) console.log('Emote:', cmd.emoteUrn)
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
