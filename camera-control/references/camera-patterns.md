# Camera Control — Worked Patterns

Branch-specific, full worked patterns for camera-control. Read when a task needs a complete implementation. Basic camera reading, CameraMode detection + onChange, CameraModeArea basics, VirtualCamera basics (transitions, lookAt), MainCamera activation, collider rules, and all guardrails remain in `camera-control/SKILL.md`.

## Tracking Camera Position (camera zone system)

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

## Camera-Triggered Events

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

## Following an NPC (camera-follows-NPC)

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

Note: the guardrail explaining why this works — you cannot move the player's real camera directly, so you drive the Transform of an *active* VirtualCamera entity each frame, paired with `InputModifier` — lives in the VirtualCamera section of `camera-control/SKILL.md`.

## Mouselook Camera (FPS-Style Camera Controls)

Drive a VirtualCamera with `PrimaryPointerInfo.screenDelta` while the pointer is locked. `screenDelta` keeps reporting raw mouse pixel deltas even while the cursor is locked (unlike `screenCoordinates`, which freezes at the screen center). Not available on mobile.

**Pattern:** accumulate `screenDelta` into yaw/pitch each frame, clamp pitch to prevent camera flip, apply via `Quaternion.fromEulerDegrees`, and combine with PointerLock + InputModifier to freeze the avatar.

```typescript
import {
	engine, Entity, Transform, VirtualCamera, MainCamera,
	InputModifier, PointerLock, PrimaryPointerInfo,
	pointerEventsSystem, InputAction, inputSystem,
	PointerEventType, MeshRenderer, MeshCollider,
} from '@dcl/sdk/ecs'
import { Vector3, Quaternion } from '@dcl/sdk/math'

// Degrees of camera rotation per pixel of mouse movement.
const SENSITIVITY = 0.15

let cameraEntity: Entity
let cameraActive = false
let yaw = 0
let pitch = 0

export function main() {
	cameraEntity = engine.addEntity()
	Transform.create(cameraEntity, { position: Vector3.create(8, 3, 8) })
	VirtualCamera.create(cameraEntity, {
		defaultTransition: { transitionMode: VirtualCamera.Transition.Time(0.5) },
	})

	// Click a box to enter mouselook mode
	const box = engine.addEntity()
	Transform.create(box, { position: Vector3.create(8, 1, 4) })
	MeshRenderer.setBox(box)
	MeshCollider.setBox(box)
	pointerEventsSystem.onPointerDown(
		{ entity: box, opts: { button: InputAction.IA_POINTER, hoverText: 'Control camera' } },
		() => activateCamera(true),
	)

	engine.addSystem(mouseLookSystem)

	// Exit with secondary button (F / right-click)
	engine.addSystem(() => {
		if (!cameraActive) return
		if (inputSystem.isTriggered(InputAction.IA_SECONDARY, PointerEventType.PET_DOWN)) {
			activateCamera(false)
		}
	})
}

function activateCamera(active: boolean) {
	cameraActive = active
	MainCamera.createOrReplace(engine.CameraEntity, {
		virtualCameraEntity: active ? cameraEntity : undefined,
	})
	InputModifier.createOrReplace(engine.PlayerEntity, {
		mode: InputModifier.Mode.Standard({ disableAll: active }),
	})
	PointerLock.createOrReplace(engine.CameraEntity, { isPointerLocked: active })
}

function mouseLookSystem() {
	if (!cameraActive) return
	if (!PointerLock.getOrNull(engine.CameraEntity)?.isPointerLocked) return

	const delta = PrimaryPointerInfo.getOrNull(engine.RootEntity)?.screenDelta
	if (!delta) return

	yaw += delta.x * SENSITIVITY
	// Subtract delta.y so mouse-up tilts camera up; clamp to prevent flip
	pitch = Math.max(-85, Math.min(85, pitch - delta.y * SENSITIVITY))
	Transform.getMutable(cameraEntity).rotation = Quaternion.fromEulerDegrees(pitch, yaw, 0)
}
```

Key details (verified against `32,20-virtual-camera-mouse-look` test scene and official docs):
- `SENSITIVITY` ~0.15 deg/px is the official recommendation; adjust to taste.
- Pitch clamped to [-85, +85] degrees prevents the camera from flipping over.
- `delta.y` is subtracted from pitch so mouse-up = camera-up (positive screenDelta.y = cursor moved up = screen origin is bottom-left).
- The system checks `PointerLock.isPointerLocked` before reading delta -- when the player presses Esc to unlock, the camera stops responding.
- Always provide a clear exit (secondary button in this example). The player can also Esc to unlock, but that alone does not deactivate the VirtualCamera.
- `screenDelta` is desktop-only. On mobile, it always reports 0. Design a touch fallback if needed (see `advanced-input` skill).
