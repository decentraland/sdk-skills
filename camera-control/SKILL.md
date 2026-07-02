---
name: camera-control
description: Control camera behavior in Decentraland scenes. CameraMode detection (first/third person, onChange listener), CameraModeArea (force a mode inside a box), VirtualCamera (cinematic scripted cameras with Speed/Time transitions and lookAtEntity), MainCamera (activate/deactivate virtual cameras), and camera vs collider interactions (CL_PHYSICS + CL_POINTER). Use when the user wants camera control, cutscenes, cinematic views, forced camera modes, or camera tracking. Do NOT use for input restriction during cutscenes (see advanced-input for InputModifier) or cursor lock detection (see advanced-input for PointerLock).
---

# Camera Control in Decentraland

## Reading Camera State

Access the camera's current position and rotation via the reserved `engine.CameraEntity`:

```typescript
import { engine, Transform } from '@dcl/sdk/ecs'

function trackCamera() {
	if (!Transform.has(engine.CameraEntity)) return

	const cameraTransform = Transform.get(engine.CameraEntity)
	console.log('Camera position:', cameraTransform.position)
	console.log('Camera rotation:', cameraTransform.rotation)
}

engine.addSystem(trackCamera)
```

## Camera Mode Detection

Check whether the player is in first-person or third-person:

```typescript
import { engine, CameraMode, CameraType } from '@dcl/sdk/ecs'

function checkCameraMode() {
	if (!CameraMode.has(engine.CameraEntity)) return

	const cameraMode = CameraMode.get(engine.CameraEntity)
	if (cameraMode.mode === CameraType.CT_FIRST_PERSON) {
		console.log('First person camera')
	} else if (cameraMode.mode === CameraType.CT_THIRD_PERSON) {
		console.log('Third person camera')
	}
}

engine.addSystem(checkCameraMode)
```

### Camera Mode Values

```typescript
CameraType.CT_FIRST_PERSON // First-person view
CameraType.CT_THIRD_PERSON // Third-person view (default)
```

### React to Camera Mode Changes

Use `CameraMode.onChange` to get notified only when the player toggles between first and third person — cheaper than polling every frame:

```typescript
import { CameraMode, engine } from '@dcl/sdk/ecs'

CameraMode.onChange(engine.CameraEntity, (camera) => {
	if (!camera) return
	// camera.mode is 0 for first person, 1 for third person
	console.log('Camera mode changed:', camera.mode)
})
```

## CameraModeArea (Force Camera in a Region)

Force a specific camera mode when the player enters an area:

```typescript
import { engine, Transform, CameraModeArea, CameraType } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

const fpArea = engine.addEntity()
Transform.create(fpArea, { position: Vector3.create(8, 1.5, 8) })

CameraModeArea.create(fpArea, {
	area: Vector3.create(6, 4, 6), // 6x4x6 meter box
	mode: CameraType.CT_FIRST_PERSON, // Force first-person inside
})
```

When the player leaves the area, the camera reverts to their preferred mode.

## VirtualCamera (Cinematic Cameras)

Create scripted camera positions for cutscenes or special views:

```typescript
import { engine, Transform, VirtualCamera, MainCamera } from '@dcl/sdk/ecs'
import { Vector3, Quaternion } from '@dcl/sdk/math'

const cinematicCam = engine.addEntity()
Transform.create(cinematicCam, {
	position: Vector3.create(8, 5, 2),
	rotation: Quaternion.fromEulerDegrees(-20, 0, 0),
})

VirtualCamera.create(cinematicCam, {
	defaultTransition: {
		transitionMode: VirtualCamera.Transition.Speed(1.0),
	},
})

// Activate the virtual camera (createOrReplace on first activation:
// getMutable throws if MainCamera doesn't exist yet)
MainCamera.createOrReplace(engine.CameraEntity, { virtualCameraEntity: cinematicCam })

// Return to normal camera (component now exists, so getMutable is safe)
MainCamera.getMutable(engine.CameraEntity).virtualCameraEntity = undefined
```

### Transition Modes

```typescript
VirtualCamera.Transition.Speed(1.0) // Speed-based smooth transition
VirtualCamera.Transition.Time(2) // Time-based transition (2 seconds)
```

### Look-At Target

Make the virtual camera track an entity:

```typescript
const target = engine.addEntity()
Transform.create(target, { position: Vector3.create(8, 1, 8) })

VirtualCamera.create(cinematicCam, {
	lookAtEntity: target,
	defaultTransition: {
		transitionMode: VirtualCamera.Transition.Speed(2.0),
	},
})

// Activate
MainCamera.createOrReplace(engine.CameraEntity, { virtualCameraEntity: cinematicCam })
```

`lookAtEntity` can be `engine.PlayerEntity` to keep the camera aimed at the moving player (verified: `2,22-virtual-cameras`). To bake a fixed look direction into the camera's own rotation instead, use `Quaternion.fromLookAt(cameraPosition, targetPosition)` in the camera's `Transform`.

`VirtualCamera.create(entity)` with no config is valid (defaults) — useful for a camera whose Transform you drive manually (see the controllable-camera pattern below).

**Switching between cameras / deactivating:** with `MainCamera` already present, mutate it via `MainCamera.getMutableOrNull(engine.CameraEntity)`; set `virtualCameraEntity` to another VirtualCamera entity to cut/transition to it, or to `undefined` to return to the player's normal camera (verified: `2,22-virtual-cameras`).

## Tracking Camera Position

Poll camera position each frame for camera-triggered events:

```typescript
import { engine, Transform } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

let lastNotifiedZone = ''

function cameraZoneSystem() {
	if (!Transform.has(engine.CameraEntity)) return

	const camPos = Transform.get(engine.CameraEntity).position
	let currentZone = ''

	if (camPos.y > 10) {
		currentZone = 'sky'
	} else if (camPos.x < 4) {
		currentZone = 'west'
	} else {
		currentZone = 'center'
	}

	if (currentZone !== lastNotifiedZone) {
		lastNotifiedZone = currentZone
		console.log('Camera entered zone:', currentZone)
	}
}

engine.addSystem(cameraZoneSystem)
```

## Camera and Colliders

When a player's camera moves in 3rd person mode, the camera might be blocked by colliders or not, depending on the collision layers assigned to the entities. To avoid the camera from going through walls, you must assign both the ColliderLayer.CL_PHYSICS and the ColliderLayer.CL_POINTER layers to the entities that you want to block the camera.

```ts
// NO CAMERA GOING THROUGH THE WALL
// default (both pointer and physics use the invisible geometry)
GltfContainer.create(myEntity, {
	src: '/models/myModel.gltf',
})

// NO CAMERA GOING THROUGH THE WALL
// Both use the same invisible geometry
GltfContainer.create(myEntity2, {
	src: '/models/myModel.gltf',
	invisibleMeshesCollisionMask:
		ColliderLayer.CL_PHYSICS | ColliderLayer.CL_POINTER,
})

// NO CAMERA GOING THROUGH THE WALL
// Both use the same visible geometry
GltfContainer.create(myEntity2, {
	src: '/models/myModel.gltf',
	visibleMeshesCollisionMask:
		ColliderLayer.CL_PHYSICS | ColliderLayer.CL_POINTER,
})

// YES CAMERA GOES THROUGH THE WALL
// physics and pointer are on different layers
GltfContainer.create(myEntity2, {
	src: '/models/myModel.gltf',
	invisibleMeshesCollisionMask: ColliderLayer.CL_PHYSICS,
	visibleMeshesCollisionMask: ColliderLayer.CL_POINTER,
})

// YES CAMERA GOES THROUGH THE WALL
// physics and pointer are on different layers
GltfContainer.create(myEntity2, {
	src: '/models/myModel.gltf',
	invisibleMeshesCollisionMask: ColliderLayer.CL_POINTER,
	visibleMeshesCollisionMask: ColliderLayer.CL_PHYSICS,
})
```

## Common Patterns

### Camera-Triggered Events

Use the camera position to trigger actions when the player looks at a specific area:

```typescript
function cameraLookTrigger() {
	const camTransform = Transform.get(engine.CameraEntity)
	const targetPos = Vector3.create(8, 2, 8)
	const distance = Vector3.distance(camTransform.position, targetPos)

	if (distance < 5) {
		// Player is close — check if camera is pointing at target
		// Use raycasting for precise look detection (see add-interactivity skill)
	}
}

engine.addSystem(cameraLookTrigger)
```

### Following an NPC

Move camera to track an NPC by updating a VirtualCamera's Transform:

```typescript
function followNpcCamera(dt: number) {
	const npcPos = Transform.get(npcEntity).position
	const camTransform = Transform.getMutable(cinematicCam)

	// Position camera behind and above the NPC
	camTransform.position = Vector3.create(
		npcPos.x - 2,
		npcPos.y + 3,
		npcPos.z - 2
	)
}

engine.addSystem(followNpcCamera)
```

> **Freezing player during cutscenes?** Combine VirtualCamera with `InputModifier` from the **advanced-input** skill to prevent player movement during cinematic sequences.

## Example scenes

- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/2,22-virtual-cameras — multiple VirtualCameras: static, `Speed`/`Time` transitions, `lookAtEntity: engine.PlayerEntity`, a Tween-driven moving camera, a WASD-controllable camera (driving the VirtualCamera Transform each frame), plus `CameraModeArea` and `AvatarModifierArea`.
- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/0,5-primary-cursor-info — activating/deactivating VirtualCameras with `MainCamera` toggled by key input, combined with InputModifier.

## Best Practices

- Only one VirtualCamera should be active at a time
- Use `CameraModeArea` to force first-person in tight indoor spaces
- Keep transition speeds between 0.5 and 3.0 for comfortable camera movement
- Read camera state via `engine.CameraEntity` — never write to `engine.CameraEntity`'s Transform directly
- For look-at detection, combine camera position with raycasting (see `add-interactivity` skill)
- You cannot move the player's real camera directly. To move a camera under scene control, drive the **Transform of an active VirtualCamera entity** each frame — while it is the `MainCamera.virtualCameraEntity`, the player sees through it (verified: `2,22-virtual-cameras` controllable camera). Pair with `InputModifier` (advanced-input) to disable avatar movement so WASD drives the camera instead.
