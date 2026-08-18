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

## Spectate Mode (Observer / Director / Replay Camera)

Toggle the player from avatar movement into a free-roaming or player-following virtual camera. Reference implementation:

> **https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/33,20-spectate-mode** — the whole mode is one self-contained module, `src/spectate.ts`; copy it into your project and wire `toggleSpectate()` to any trigger (a clickable entity, a UI button, a key press).

After copying, **update `PIVOT` and `BOUNDS_MIN`/`BOUNDS_MAX`** at the top of `spectate.ts` — this is the most common integration mistake (see the bounds gotcha below).

### SDK primitives used

| What | SDK API | Why |
|---|---|---|
| Free / follow camera | `VirtualCamera` + `MainCamera` | Replaces the player's camera view |
| Disable avatar movement | `InputModifier` (`disableAll: true`) | Frees WASD to drive the camera |
| Track who is in scene | `onEnterScene` / `onLeaveScene` | Builds a roster of follow targets |
| Camera control inputs | `inputSystem.isPressed(InputAction.IA_*)` | WASD pitch/yaw, E/F zoom/raise, 1/2 cycle target |

Enable / disable pattern:

```typescript
// Activate spectate mode
MainCamera.createOrReplace(engine.CameraEntity, { virtualCameraEntity: rigCamera })
InputModifier.createOrReplace(engine.PlayerEntity, {
	mode: InputModifier.Mode.Standard({ disableAll: true }),
})
engine.addSystem(spectateInputSystem)
engine.addSystem(cameraRigSystem)

// Deactivate — IMPORTANT: clear MainCamera BEFORE removing the VirtualCamera entity
//   (engine keeps binding to a dead entity and the view falls to the player's feet)
const mainCamera = MainCamera.getMutableOrNull(engine.CameraEntity)
if (mainCamera) mainCamera.virtualCameraEntity = undefined
engine.removeEntity(rigCamera)
InputModifier.createOrReplace(engine.PlayerEntity, {
	mode: InputModifier.Mode.Standard({ disableAll: false }),
})
```

### Critical gotcha — camera bounds MUST match your scene

The engine **disables VirtualCamera entities that move outside parcel bounds**. If the camera leaves your scene footprint it stops working silently. Set `BOUNDS_MIN` / `BOUNDS_MAX` in `spectate.ts` to your actual parcel AABB; the module clamps the orbit radius to stay inside bounds every frame:

```typescript
// From spectate.ts — the reference scene is 1x1 parcel (16x16 on X/Z)
const BOUNDS_MIN = Vector3.create(0, 0, 0)
const BOUNDS_MAX = Vector3.create(16, 20, 16)
```

Height formula for N parcels per side: `~log2(N+1) × 20` metres. A 4×4 parcel scene is `Vector3.create(64, 80, 64)`.

### Camera architecture

A **two-entity rig** so yaw and pitch can be controlled independently:

```
rigRoot (root entity)       ← world position + yaw rotation
└── rigCamera (child)       ← pitch rotation + local offset (orbit distance from root)
    └── VirtualCamera
```

- `rigRoot.position` is lerped toward the pivot point (free cam) or current follow target.
- `rigRoot.rotation` holds yaw (left/right). Pitch is applied on `rigCamera`.
- Orbit distance along `rigCamera`'s local Z is kept inside the scene AABB (`maxDistanceInBounds`), with a hard clamp after the lerp so a shrinking bound can't leave the camera out of bounds for a few frames.

### Controls (while spectating)

| Key | Action |
|---|---|
| W / S | Pitch up / down |
| A / D | Yaw left / right |
| Mouse (pointer locked) | Rotate camera (yaw/pitch via `PrimaryPointerInfo.screenDelta`, see Mouselook pattern above) |
| E | Zoom in (follow) or raise camera (free) |
| F | Zoom out (follow) or lower camera (free) |
| 1 | Next follow target (cycles through scene players) |
| 2 | Previous follow target |

Pressing 1/2 when no target is set jumps to first/last player. Cycling past the last player returns to free-cam mode. While spectating, the reference scene shows a bottom HUD with the key bindings and the current follow target's display name (`getPlayer({ userId })?.name`).

### Config tunables

All constants at the top of `src/spectate.ts`:

```typescript
PIVOT                    // Free-cam starting position (scene centre, high enough for an overview)
BOUNDS_MIN / BOUNDS_MAX  // ← MUST match your scene.json parcels
BOUNDS_MARGIN            // Keep the camera this far inside the AABB
PITCH_SPEED / YAW_SPEED  // Degrees per second
PITCH_MIN / PITCH_MAX / PITCH_DEFAULT
ZOOM_SPEED               // Zoom fraction per second while following
RAISE_SPEED / MAX_Y_OFFSET  // Free-cam raise/lower speed and range
MIN_FOLLOW_DISTANCE / MAX_FOLLOW_DISTANCE  // Orbit radius range when following
LERP_FACTOR              // Camera smoothing (position lerp / rotation slerp per frame)
```

Related: player roster events (`onEnterScene`/`onLeaveScene`) are covered in **player-avatar**; InputModifier in **advanced-input**; the on-screen toggle/controls HUD in **build-ui**; observer roles in multiplayer game design (e.g. admin-gated spectate via authoritative-server) in **game-design**.
