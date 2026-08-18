---
name: spectate-mode
description: Add a spectate / free-cam mode to a Decentraland scene. Lets players toggle a free-roaming or player-following camera with WASD/E/F/1/2 controls while their avatar movement is disabled. Use when someone wants observer mode, a replay camera, a director/admin view, or any "watch players" mechanic. Builds on VirtualCamera + InputModifier + onEnterScene/onLeaveScene. Do NOT use for basic camera control (see camera-control) or general input restriction (see advanced-input).
---

# Spectate Mode

Spectate mode lets a player switch from avatar movement to a free or player-following virtual camera. The reference implementation is:

> **https://github.com/stom66/dcl-spectate-mode** — drop-in module, copy `src/spectate-mode/` into your project.

## Quickstart (copy-paste)

1. Copy `src/spectate-mode/` from the reference repo into your project.
2. Call `SpectateMode.init()` from your scene entry:

```typescript
import { SpectateMode } from './spectate-mode'

export function main() {
    SpectateMode.init()
}
```

3. In Creator Hub, tag any in-world object with `SpectateModeTrigger`. The module auto-wires pointer events to that entity — clicking it toggles spectate mode on/off.
4. **Update bounds in `config.ts`** — this is the most common integration mistake (see Critical Gotcha below).

## How it works (SDK primitives)

| What | SDK API | Why |
|---|---|---|
| Free / follow camera | `VirtualCamera` + `MainCamera` | Replaces the player's camera view |
| Disable avatar movement | `InputModifier` (`disableAll: true`) | Frees WASD to drive the camera |
| Track who is in scene | `onEnterScene` / `onLeaveScene` | Builds a roster of follow targets |
| Camera control inputs | `inputSystem.isPressed(InputAction.IA_*)` | WASD pitch/yaw, E/F zoom/raise, 1/2 cycle target |
| In-world toggle | `pointerEventsSystem.onPointerDown` + `engine.getEntitiesByTag` | Tag-based trigger binding |

Enable pattern:

```typescript
// Activate spectate mode
SM_Camera.activateCamera()
SM_PlayerInputs.activate()
InputModifier.createOrReplace(engine.PlayerEntity, {
    mode: { $case: 'standard', standard: { disableAll: true } },
})

// Deactivate — IMPORTANT: clear MainCamera BEFORE removing the VirtualCamera entity
//   (engine keeps binding to a dead entity and the view falls to the player's feet)
const mainCamera = MainCamera.getMutableOrNull(engine.CameraEntity)
if (mainCamera) mainCamera.virtualCameraEntity = undefined
engine.removeEntity(cameraEntity)
InputModifier.createOrReplace(engine.PlayerEntity, {
    mode: { $case: 'standard', standard: { disableAll: false } },
})
```

## Critical Gotcha — Camera Bounds MUST Match Your Scene

The Decentraland engine **disables VirtualCamera entities that move outside parcel bounds**. If the camera leaves your scene footprint it stops working silently. You must set `CAMERA_SCENE_BOUNDS_MIN` / `CAMERA_SCENE_BOUNDS_MAX` in `config.ts` to your actual parcel AABB.

The module clamps the orbit radius to stay inside bounds every frame:

```typescript
// From config.ts — default is a 4x4 parcel scene (64x64 on X/Z)
CAMERA_SCENE_BOUNDS_MIN: Vector3.create(0, 0, 0),
CAMERA_SCENE_BOUNDS_MAX: Vector3.create(64, 80, 64),
```

Height formula for N parcels per side: `~log2(N+1) × 20` metres. A 1×1 parcel scene is `Vector3.create(16, 20, 16)`.

## Camera architecture

The module uses a **two-entity rig** so yaw and pitch can be controlled independently:

```
r (root entity)       ← world position + yaw rotation
└── e (child entity)  ← pitch rotation + local offset (distance from root)
    └── VirtualCamera
```

- `r.position` is lerped toward the pivot point (free cam) or current follow target.
- `r.rotation` holds yaw (left/right). Pitch is applied on `e`.
- Orbit distance along `e`'s local Z is kept inside the scene AABB.

## Controls (while spectating)

| Key | Action |
|---|---|
| W / S | Pitch up / down |
| A / D | Yaw left / right |
| E | Zoom in (follow) or raise camera (free) |
| F | Zoom out (follow) or lower camera (free) |
| 1 | Next follow target (cycles through scene players) |
| 2 | Previous follow target |

Pressing 1/2 when no target is set jumps to first/last player. Cycling past the last player returns to free-cam mode.

## Module layout

```
src/spectate-mode/
  index.ts          # SpectateMode.init / toggle / enable / disable
  config.ts         # All tunables (tag name, bounds, speeds, limits)
  camera.ts         # Virtual camera, two-entity rig, follow/orbit system
  playerInputs.ts   # WASD/E/F/1/2 input processing
  playerRoster.ts   # onEnterScene/onLeaveScene player list with cycle logic
  ui/               # On-screen toggle button, controls strip, debug panel
```

## Config tunables

All in `src/spectate-mode/config.ts`:

```typescript
CREATOR_HUB_MODEL_TAG            // Tag to find in-world toggle objects ("SpectateModeTrigger")
MAX_INTERACTION_DISTANCE         // metres — pointer distance to click toggle (default 8)
CAMERA_PIVOT_POINT               // Starting position (default scene centre, 8 m up)
CAMERA_SCENE_BOUNDS_MIN/MAX      // ← MUST update for your parcels
CAMERA_PITCH_SPEED_DEG_PER_SECOND
CAMERA_YAW_SPEED_DEG_PER_SECOND
CAMERA_MIN/MAX_PLAYER_DISTANCE   // Orbit radius range when following (1–32 m)
CAMERA_ZOOM_SPEED_PER_SECOND
DEBUG_LOGGING                    // Enables on-screen pitch/yaw/zoom debug panel
```

## Related skills

| Topic | Skill |
|---|---|
| VirtualCamera basics, transitions, lookAt | **camera-control** |
| InputModifier, input restriction | **advanced-input** |
| onEnterScene / onLeaveScene, player tracking | **player-avatar** |
| On-screen UI (the toggle/controls strip) | **build-ui** |
| Multiplayer game design, observer roles | **game-design** |
