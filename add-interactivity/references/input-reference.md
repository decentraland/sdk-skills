# Input System Reference

## All Input Actions

| Action            | Key Binding       | Constant                   |
| ----------------- | ----------------- | -------------------------- |
| Left mouse button | Mouse click / tap | `InputAction.IA_POINTER`   |
| Primary action    | E key             | `InputAction.IA_PRIMARY`   |
| Secondary action  | F key             | `InputAction.IA_SECONDARY` |
| Action 3          | 1 key             | `InputAction.IA_ACTION_3`  |
| Action 4          | 2 key             | `InputAction.IA_ACTION_4`  |
| Action 5          | 3 key             | `InputAction.IA_ACTION_5`  |
| Action 6          | 4 key             | `InputAction.IA_ACTION_6`  |
| Jump              | Space key         | `InputAction.IA_JUMP`      |
| Forward           | W key             | `InputAction.IA_FORWARD`   |
| Backward          | S key             | `InputAction.IA_BACKWARD`  |
| Left              | A key             | `InputAction.IA_LEFT`      |
| Right             | D key             | `InputAction.IA_RIGHT`     |
| Walk              | Shift key         | `InputAction.IA_WALK`      |

**Notes:**

- Mouse wheel is **not available** as an input
- Always design for both desktop and mobile — mobile has no keyboard, rely on pointer and on-screen buttons
- Set `maxDistance` on pointer events (8-10 meters typical) to prevent interactions from across the scene
- Use `hoverText` to communicate what an interaction does before the player commits

## All Pointer Event Types

```typescript
PointerEventType.PET_DOWN // Button/key pressed
PointerEventType.PET_UP // Button/key released
PointerEventType.PET_HOVER_ENTER // Cursor enters entity bounds
PointerEventType.PET_HOVER_LEAVE // Cursor leaves entity bounds
```

## Declarative Pointer Events Component

Instead of the callback system, you can use the `PointerEvents` component directly:

```typescript
import { PointerEvents, PointerEventType, InputAction } from '@dcl/sdk/ecs'

PointerEvents.create(entity, {
	pointerEvents: [
		{
			eventType: PointerEventType.PET_DOWN,
			eventInfo: {
				button: InputAction.IA_POINTER,
				hoverText: 'Click me',
				showFeedback: true,
				maxDistance: 10,
			},
		},
	],
})
```

Then read results in a system using `inputSystem.getInputCommand()`.

## Proximity Interactions

Proximity interactions detect button events when a player is near and roughly facing an entity, **without requiring them to aim their cursor at it**. Unlike pointer events (which use raycasting), proximity events check for entities within a wide triangular slice of a sphere projecting forward from the player's position.

Key distinction: avatar facing direction matters, independently of where the camera is pointing.

### onProximityDown / onProximityUp

```typescript
import { pointerEventsSystem, InputAction } from '@dcl/sdk/ecs'

pointerEventsSystem.onProximityDown(
	{
		entity: myEntity,
		opts: {
			button: InputAction.IA_PRIMARY,
			hoverText: 'Press E',
			maxPlayerDistance: 5,
		},
	},
	function () {
		console.log('Player pressed button near entity')
	}
)

pointerEventsSystem.onProximityUp(
	{
		entity: myEntity,
		opts: {
			button: InputAction.IA_PRIMARY,
			hoverText: 'Release E',
			maxPlayerDistance: 5,
		},
	},
	function () {
		console.log('Player released button near entity')
	}
)
```

> **Note:** Only one `onProximityDown` and one `onProximityUp` can be registered per entity. Once added, they keep listening until removed. Do not call these inside a system loop — that would keep rewriting the behavior.

### onProximityEnter / onProximityLeave

Fires when the player walks into or out of an entity's proximity range. Use this to play sounds, trigger animations, or show hints when the player approaches.

```typescript
pointerEventsSystem.onProximityEnter(
	{
		entity: myEntity,
		opts: {
			button: InputAction.IA_POINTER,
			hoverText: 'Nearby',
			maxPlayerDistance: 5,
		},
	},
	function () {
		console.log('Player entered proximity')
	}
)

pointerEventsSystem.onProximityLeave(
	{
		entity: myEntity,
		opts: {
			button: InputAction.IA_POINTER,
			hoverText: 'Nearby',
			maxPlayerDistance: 5,
		},
	},
	function () {
		console.log('Player left proximity')
	}
)
```

### Options

| Option              | Description                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `button`            | Which button to listen for (`InputAction.IA_PRIMARY`, `IA_SECONDARY`, `IA_POINTER`, etc.)                                |
| `maxPlayerDistance` | Max distance from the player's **avatar** to the entity (meters). This is the most relevant option for proximity events. |
| `maxDistance`       | Max distance from the player's **camera** to the entity (meters).                                                        |
| `hoverText`         | Text shown in the UI when the player is in range.                                                                        |
| `showHighlight`     | Show an edge highlight on the entity when player is in range. Default: `true`.                                           |
| `showFeedback`      | Show hover feedback around the center of the entity. Default: `true`.                                                    |
| `priority`          | Conflict resolution when multiple entities are in range. Higher values respond first.                                    |

### Priority

When multiple entities are within range and could respond to the same input, only the closest one responds by default. Use `priority` to control which takes precedence — higher values win.

Pointer interactions (cursor aimed at entity) **always take priority** over proximity interactions, regardless of priority values.

```typescript
// Door has higher priority than floor when both are in range
pointerEventsSystem.onProximityDown(
	{
		entity: doorEntity,
		opts: {
			button: InputAction.IA_PRIMARY,
			hoverText: 'Open door',
			maxPlayerDistance: 5,
			priority: 2,
		},
	},
	() => {
		console.log('Door activated')
	}
)

pointerEventsSystem.onProximityDown(
	{
		entity: floorEntity,
		opts: {
			button: InputAction.IA_PRIMARY,
			hoverText: 'Step here',
			maxPlayerDistance: 5,
			priority: 1,
		},
	},
	() => {
		console.log('Floor activated')
	}
)
```

### Remove Callbacks

```typescript
pointerEventsSystem.removeOnProximityDown(myEntity)
pointerEventsSystem.removeOnProximityUp(myEntity)
pointerEventsSystem.removeOnProximityEnter(myEntity)
pointerEventsSystem.removeOnProximityLeave(myEntity)
```

### System-Based Proximity (PointerEvents Component)

For the system-based approach, use `PET_PROXIMITY_ENTER` and `PET_PROXIMITY_LEAVE` in the `PointerEvents` component, and `InteractionType.IT_PROXIMITY` for proximity button presses:

```typescript
import { PointerEvents, PointerEventType, InputAction } from '@dcl/sdk/ecs'

PointerEvents.create(myEntity, {
	pointerEvents: [
		{
			eventType: PointerEventType.PET_PROXIMITY_ENTER,
			eventInfo: {
				button: InputAction.IA_PRIMARY,
				hoverText: 'Approach',
				maxDistance: 5,
			},
		},
		{
			eventType: PointerEventType.PET_PROXIMITY_LEAVE,
			eventInfo: {
				button: InputAction.IA_PRIMARY,
				maxDistance: 5,
			},
		},
	],
})
```

Then read results in a system using `inputSystem.getInputCommand()` with `InteractionType.IT_PROXIMITY`.

### Example: Proximity Door

Opens or closes a door when the player presses E while nearby, without needing to aim at it:

```typescript
import { engine, Transform, GltfContainer, Tween } from '@dcl/sdk/ecs'
import { Vector3, Quaternion } from '@dcl/sdk/math'
import { pointerEventsSystem, InputAction } from '@dcl/sdk/ecs'

const doorPivot = engine.addEntity()
Transform.create(doorPivot, { position: Vector3.create(3, 0, 4) })

const door = engine.addEntity()
GltfContainer.create(door, { src: 'assets/door.glb' })
Transform.create(door, {
	position: Vector3.create(-1, 0, 0),
	parent: doorPivot,
})

let isDoorOpen = false
const closedRot = Quaternion.fromEulerDegrees(0, 0, 0)
const openRot = Quaternion.fromEulerDegrees(0, 90, 0)

pointerEventsSystem.onProximityDown(
	{
		entity: door,
		opts: {
			button: InputAction.IA_PRIMARY,
			hoverText: 'Open / Close',
			maxPlayerDistance: 5,
			priority: 1,
		},
	},
	function () {
		if (isDoorOpen) {
			Tween.setRotate(doorPivot, openRot, closedRot, 700)
			isDoorOpen = false
		} else {
			Tween.setRotate(doorPivot, closedRot, openRot, 700)
			isDoorOpen = true
		}
	}
)
```

## Raycast Direction Types

```typescript
// 1. Local direction — relative to entity rotation
{ $case: 'localDirection', localDirection: Vector3.Forward() }

// 2. Global direction — world-space direction, ignores entity rotation
{ $case: 'globalDirection', globalDirection: Vector3.Down() }

// 3. Global target — aim at a specific world position
{ $case: 'globalTarget', globalTarget: Vector3.create(10, 0, 10) }

// 4. Target entity — aim at another entity dynamically
{ $case: 'targetEntity', targetEntity: entityId }
```

### Raycast Options

```typescript
{
  direction: Vector3.Forward(),
  maxDistance: 16,
  queryType: RaycastQueryType.RQT_HIT_FIRST,  // or RQT_QUERY_ALL
  originOffset: Vector3.create(0, 0.5, 0),     // offset from entity origin
  collisionMask: ColliderLayer.CL_PHYSICS | ColliderLayer.CL_CUSTOM1,
  continuous: false  // true = every frame, false = one-shot
}
```

### Camera Raycast

Cast a ray from the camera to detect what the player is looking at:

```typescript
raycastSystem.registerGlobalDirectionRaycast(
	{
		entity: engine.CameraEntity,
		opts: {
			direction: Vector3.rotate(
				Vector3.Forward(),
				Transform.get(engine.CameraEntity).rotation
			),
			maxDistance: 16,
		},
	},
	(result) => {
		if (result.hits.length > 0)
			console.log('Looking at:', result.hits[0].entityId)
	}
)
```

## Avatar Modifier Areas

Modify how avatars appear or behave in a region:

```typescript
import { AvatarModifierArea, AvatarModifierType } from '@dcl/sdk/ecs'

AvatarModifierArea.create(entity, {
	area: { box: Vector3.create(4, 3, 4) },
	modifiers: [AvatarModifierType.AMT_HIDE_AVATARS],
	excludeIds: ['0x123...abc'], // Optional
})

// Available modifiers:
// AMT_HIDE_AVATARS      — Hide all avatars in the area
// AMT_DISABLE_PASSPORTS — Disable clicking on avatars to see profiles
// AMT_DISABLE_JUMPING   — Prevent jumping in the area
```

## Cursor State

```typescript
// Check if cursor is locked (pointer lock mode)
const isLocked = PointerLock.get(engine.CameraEntity).isPointerLocked

// Get cursor position and world ray
const pointerInfo = PrimaryPointerInfo.get(engine.RootEntity)
console.log('Cursor screen position:', pointerInfo.screenCoordinates)
console.log('World ray direction:', pointerInfo.worldRayDirection)
```

## Trigger Area Callback Fields

The trigger area event callback provides:

- `triggeredEntity` — the entity that activated the area
- `eventType` — ENTER, EXIT, or STAY
- `trigger.entity` — the trigger area entity
- `trigger.layer` — the collider layer
- `trigger.position` — position of the triggered entity
- `trigger.rotation` — rotation of the triggered entity
- `trigger.scale` — scale of the triggered entity
