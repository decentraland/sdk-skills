---
name: camera-control
description: "Control the camera in Decentraland scenes: read camera state, force first/third person in an area, cinematic VirtualCamera shots, walls that block the third-person camera. Use for cutscenes, forced camera modes, camera tracking, or a spectate / free-cam mode. For freezing input or cursor lock see advanced-input."
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

`engine.CameraEntity`'s Transform is read-only (to move a camera, see VirtualCamera below).

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

Force a specific camera mode when the player enters an area (e.g. force first-person in tight indoor spaces):

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

**Resize the region through `area`.** A non-zero `area` fixes the region size for the life of the component: scaling the entity or its parents does not resize it (an axis scaled to 0 still collapses it), so write `CameraModeArea.getMutable(e).area`. Full rule: **player-avatar** → Avatar Modifier Areas.

**A whole-experience restriction needs whole-experience coverage.** An area that covers only the spawn route proves nothing once the scene teleports, respawns, jumps the player to an alternate height, or hands the camera back after a cinematic. Size the area to the full horizontal *and* vertical play space (including debug jumps and death/restart positions), then test every transition in-world: spawn, teleport, death/restart, alternate height, unlock/relock and cinematic handback. When handing control back, restore the mode the scene intends (first person for a first-person scene), not a generic third person.

**Creator Hub / Inspector support:** the inspector has a `CameraModeArea` panel with a `mode` dropdown (`First Person` / `Third Person`; Cinematic is omitted — use `VirtualCamera` for that), and the asset catalog has a "Camera Modifier Area" smart item (utils category, translucent placeholder cube). Default init: `{ area: {1,1,1}, mode: CameraType.CT_FIRST_PERSON }`. The editor mirrors `area` from the entity's `Transform.scale` when you resize with the gizmo; that is an editor-time write, so at runtime `area` stands alone. After `place_smart_item`, confirm with `entity_detail` that the entity carries `core::CameraModeArea` (one placement arrived without it); if it is missing, `set_component` it, sized to the room.

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
	// fov: 45, // optional: field of view in degrees (overrides the Explorer default)
})

// Activate the virtual camera (createOrReplace on first activation:
// getMutable throws if MainCamera doesn't exist yet)
MainCamera.createOrReplace(engine.CameraEntity, { virtualCameraEntity: cinematicCam })

// Only one VirtualCamera is active at a time. To cut/transition to another,
// set virtualCameraEntity to that entity (getMutable is safe once MainCamera exists)
MainCamera.getMutable(engine.CameraEntity).virtualCameraEntity = otherCam

// Return to the player's normal camera (see "Handing control back")
MainCamera.getMutable(engine.CameraEntity).virtualCameraEntity = undefined
```

### Transition Modes

```typescript
VirtualCamera.Transition.Speed(1.0) // Speed-based smooth transition
VirtualCamera.Transition.Time(2) // Time-based transition (2 seconds)
```

Keep transition speeds between 0.5 and 3.0 for comfortable camera movement.

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

`VirtualCamera` accepts an optional `fov?: number` field (field of view in **degrees**). **Defaults to `60` when omitted.** When set, the virtual camera overrides the default FOV for as long as it is the active `MainCamera.virtualCameraEntity`.

Choosing a value:

- **Wider (higher, e.g. 90)** — shows more of the scene at once and creates a sense of speed. Good for racing and vehicle cameras.
- **Narrower (lower, e.g. 35-45)** — zooms in and flattens perspective. Good for aiming down sights and cinematic shots.
- Very wide values distort at the frame edges; keep a fixed framing camera near the default unless the distortion is the point.

You cannot move the player's real camera directly. To move a camera under scene control, drive the Transform of an active VirtualCamera entity each frame; while it is the `MainCamera.virtualCameraEntity`, the player sees through it (verified: `2,22-virtual-cameras` controllable camera). Pair with `InputModifier` (advanced-input) to disable avatar movement so WASD drives the camera instead.

### Handing control back

Returning to the first-person, third-person or drone camera ignores `defaultTransition`: it is always a fixed 0.5 s ease-in-out blend, which reads as a jump from a shot far from the player. Clearing the binding and deleting the camera entity in the wrong order also breaks the view: deleting it in the same frame makes the view **jump**, and deleting it *before* clearing `MainCamera.virtualCameraEntity` binds the engine to a dead entity and drops the view to the player's feet.

1. *(Optional, for a smooth handback)* Tween the virtual camera to the player camera's pose, read from `Transform.get(engine.CameraEntity)` **just before the tween starts** (an early pose is stale if the avatar moved during the shot). Tween the entity that carries the camera's world pose: on a parented rig, unparent the camera first or tween the rig root so the camera ends on that pose, because a tween on a child runs in its parent's local space. About 0.9 s works.
2. Set `MainCamera.virtualCameraEntity = undefined`.
3. Remove the `VirtualCamera` entity (and its rig parents) about **1 second later**, so the renderer can blend back. Skip this step for a camera you reuse.

```typescript
import { engine, MainCamera, timers } from '@dcl/sdk/ecs'

function endShot() {
	const cam = MainCamera.getMutableOrNull(engine.CameraEntity)
	if (cam) cam.virtualCameraEntity = undefined // step 2
	timers.setTimeout(() => {
		// step 3: delete the rig only after the blend back
		if (rigCamera) engine.removeEntity(rigCamera)
		if (rigRoot) engine.removeEntity(rigRoot)
	}, 1000)
}
```

**Write only `undefined` or an entity that has a `VirtualCamera` into `virtualCameraEntity`; never `0`.** The engine releases the player camera only when the field is *absent*: `undefined` is omitted from the message, and `MainCameraSystem` then clears the binding. A *present* value whose entity carries no `VirtualCamera` (`0` is `engine.RootEntity`) makes the engine retry every frame and keep the **currently active** virtual camera: if a rig was active, the view stays stuck on it even after input is restored (if none was active, nothing changes). This bites save/restore code: the field is `optional`, so a fresh `MainCamera` reads `undefined` — you only ever get `0` from a saved value scene code wrote, typically a `?? 0` / `|| 0` fallback — and writing that `0` back later sticks the camera. Treat both `undefined` and `0` as "no previous camera":

```typescript
function restoreCamera(previous: Entity | undefined) {
	const cam = MainCamera.getMutableOrNull(engine.CameraEntity)
	if (!cam) return
	if (previous && VirtualCamera.has(previous)) cam.virtualCameraEntity = previous
	else cam.virtualCameraEntity = undefined // or MainCamera.deleteFrom(engine.CameraEntity) if the scene never bound one
}
```

Then verify the handback in-world (`get_player_state` → `camera.mode` back to a retail mode), including the interrupted and respawn paths — a headless test cannot see a stuck view.

## Tracking Camera Position

Poll camera position each frame by reading `Transform.get(engine.CameraEntity).position` inside a system. For a full worked zone-tracking system (`cameraZoneSystem`), see `{baseDir}/references/camera-patterns.md` → "Tracking Camera Position (camera zone system)".

## Camera and Colliders

A mesh blocks the third-person camera only when the same geometry carries both `CL_PHYSICS` and `CL_POINTER`. The default `GltfContainer` masks do (both layers on the invisible collider geometry); splitting physics and pointer across the visible and invisible meshes lets the camera pass through.

```ts
// Blocks the camera: both layers on the same (visible) geometry
GltfContainer.create(wall, {
	src: 'assets/Models/wall.glb',
	visibleMeshesCollisionMask: ColliderLayer.CL_PHYSICS | ColliderLayer.CL_POINTER,
})
```

Mask patterns and collider checks: **add-3d-models** → RULE: Always check for built-in colliders.

## Common Patterns

For full worked patterns, see `{baseDir}/references/camera-patterns.md`:

- **Camera-Triggered Events** — use camera position/proximity to trigger actions when the player looks at an area.
- **Following an NPC (camera-follows-NPC)** — track an NPC by driving a VirtualCamera's Transform each frame (guardrail on why this works lives in the VirtualCamera section above).
- **Mouselook Camera (FPS-style)** — `PrimaryPointerInfo.screenDelta` drives a VirtualCamera's yaw/pitch; desktop only. Sign convention: **advanced-input** → Cursor Position and World Ray. See `{baseDir}/references/camera-patterns.md` → "Mouselook Camera".
- **Spectate Mode (observer / director / replay camera)** — toggle the player from avatar movement into a free-roaming or player-following camera: two-entity yaw/pitch rig, WASD/E/F/1/2 controls, `onEnterScene`/`onLeaveScene` player roster, InputModifier freeze, and parcel-bounds clamping (the engine disables VirtualCameras outside parcel bounds). To restrict who can enter spectate mode, gate it with a server-verified admin check (**authoritative-server**). See `{baseDir}/references/camera-patterns.md` → "Spectate Mode".

## Example scenes

- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/2,22-virtual-cameras — multiple VirtualCameras: static, `Speed`/`Time` transitions, `lookAtEntity: engine.PlayerEntity`, a Tween-driven moving camera, a WASD-controllable camera (driving the VirtualCamera Transform each frame), plus `CameraModeArea` and `AvatarModifierArea`.
- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/0,5-primary-cursor-info — activating/deactivating VirtualCameras with `MainCamera` toggled by key input, combined with InputModifier.
- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/32,20-virtual-camera-mouse-look — mouselook camera: `PrimaryPointerInfo.screenDelta` driving VirtualCamera yaw/pitch while pointer is locked, with `InputModifier` disableAll and PointerLock control. Reference implementation for the mouselook pattern.
- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/33,20-spectate-mode — spectate mode: free-roaming / player-following camera in one self-contained module (`src/spectate.ts`): two-entity yaw/pitch rig, player roster, WASD/E/F/1/2 controls, parcel-bounds clamping, the delayed-teardown sequence in Handing control back, and full `TouchScreenControls` mobile parity (its README documents only the desktop bindings — the mobile handling is in the source). Reference implementation for the spectate pattern.
- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/9,99-modifier-areas — `CameraModeArea` forcing `CameraType.CT_FIRST_PERSON` inside a rotated 4x4x4 volume, rendered as a translucent box so the trigger volume is visible. A click handler moves the area's `Transform` to show the area follows the entity; a commented-out branch shows mutating `mode` in place via `CameraModeArea.getMutable()`. Sits alongside an `AvatarModifierArea` in the same scene.
