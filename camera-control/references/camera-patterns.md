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
