---
name: add-interactivity
description: Event-driven interactivity for Decentraland entities. Covers pointerEventsSystem (onPointerDown/Up/hover on entities), proximity events (onProximityDown/Up/Enter/Leave for nearby interactions without aiming), trigger areas (enter/exit zones), raycasting, and one-shot key presses on entities. Use when the user wants clickable objects, hover highlights, proximity-based interactions, detecting when a player enters a zone, E/F key actions on an entity, or ray-hit detection. For system-level polling (held keys, WASD movement, cursor lock, InputModifier, action bar) see advanced-input. For screen-space UI buttons see build-ui.
---

# Adding Interactivity to Decentraland Scenes

## RULE: Fetch composite entities — never re-create them

If the entity to make interactive was defined in `assets/scene/main.composite`, **look it up by name or tag in `index.ts`**. Do NOT call `engine.addEntity()` + component create — that would create a duplicate.

```typescript
import { engine, pointerEventsSystem, InputAction } from "@dcl/sdk/ecs";
import { EntityNames } from "../assets/scene/entity-names";

export function main() {
  // By name (type-safe via auto-generated EntityNames enum)
  const door = engine.getEntityOrNullByName(EntityNames.Door_1);
  if (door) {
    pointerEventsSystem.onPointerDown(
      {
        entity: door,
        opts: { button: InputAction.IA_PRIMARY, hoverText: "Open" },
      },
      () => {
        /* open door */
      }
    );
  }

  // By tag (batch operations on groups of composite entities)
  const crystals = engine.getEntitiesByTag("Crystal");
  for (const crystal of crystals) {
    pointerEventsSystem.onPointerDown(
      {
        entity: crystal,
        opts: { button: InputAction.IA_PRIMARY, hoverText: "Collect" },
      },
      () => {
        /* collect crystal */
      }
    );
  }
}
```

These lookups must happen inside `main()` or functions called after `main()` — composite entities are not instantiated before that point.

---

## Decision Tree

| Need                                                  | Approach         | API                                         |
| ----------------------------------------------------- | ---------------- | ------------------------------------------- |
| Click/hover on a specific entity                      | Pointer events   | `pointerEventsSystem.onPointerDown()`       |
| Button press when player is nearby (no aiming needed) | Proximity events | `pointerEventsSystem.onProximityDown()`     |
| Detect player entering an area                        | Trigger area     | `TriggerArea` + `triggerAreaEventsSystem`   |
| Poll key state every frame                            | Global input     | `inputSystem.isTriggered()` / `isPressed()` |
| Detect objects in a direction                         | Raycasting       | `raycastSystem` or `Raycast` component      |
| Read cursor position / lock state                     | Cursor state     | `PointerLock`, `PrimaryPointerInfo`         |

---

## Pointer Events (Click / Hover)

Use `pointerEventsSystem.onPointerDown()` to add click handlers to entities. Also available: `.onPointerUp()`, `.onPointerHoverEnter()`, `.onPointerHoverLeave()`. Remove with `.removeOnPointerDown(entity)` etc.

### Feedback options: `showFeedback` gates `hoverText`

Verified via `30,20-pointer-events-feedback`:

- `showFeedback` (default `true`) — enables the hover UI. **`hoverText` only appears when `showFeedback` is true.** With `showFeedback: false`, no hover text shows regardless of `hoverText`.
- `showHighlight` (default `true`) — the entity edge/outline highlight on hover. Independent of the text; requires `showFeedback` to be on to be visible.
- With `showFeedback: true` and no/empty `hoverText`, the explorer shows its default action prompt (e.g. the button glyph) rather than nothing.

### PITFALL: never (re-)register a pointer handler from inside its own callback

Calling `onPointerDown` / `removeOnPointerDown` (or the on/remove variants for Up / Hover) for an entity **from within that entity's own pointer callback** makes the same click fire the handler multiple times (observed: 3 fires from one click, as a state machine re-registered on each fire).

**Why** (verified — `@dcl/ecs/dist/systems/events.js`): the `EventSystem` iterates a per-entity `Map` of handlers each frame. `onPointerDown` does `removeEvent(entity, EventType.Down)` then `getEvent(entity).set(EventType.Down, …)`, which re-inserts the `Down` key into that same `Map`. Re-inserting a key during the `Map`'s own `for…of` iteration causes it to be visited again in the same pass, and `inputSystem.getInputCommand(...)` still returns the same buffered down command → the callback re-fires.

**Fix — to change hover text dynamically, mutate the existing `PointerEvents` component in place instead of re-registering:**

```typescript
import { PointerEvents } from '@dcl/sdk/ecs'

function setHoverText(entity: Entity, hoverText: string) {
  const pe = PointerEvents.getMutableOrNull(entity)
  if (!pe) return
  for (const entry of pe.pointerEvents) {
    if (entry.eventInfo) entry.eventInfo.hoverText = hoverText
  }
}
```

Register the handler exactly once (e.g. at entity creation); never re-call it from a click/hover callback or from a per-frame system.

**Important: Colliders Required** — Pointer events only work on entities with a collider using the `ColliderLayer.CL_POINTER` layer. Use `MeshCollider.setBox(entity)` for invisible colliders, or set `visibleMeshesCollisionMask: ColliderLayer.CL_POINTER` on `GltfContainer`.

### GltfContainer clickability — which mask to use (and the skinned-mesh exception)

`GltfContainer` defaults (verified — `@dcl/ecs` `gltf_container.gen.d.ts`):

- `visibleMeshesCollisionMask` default: **`0`** (visible meshes are NOT clickable/collidable by default)
- `invisibleMeshesCollisionMask` default: **`CL_POINTER | CL_PHYSICS`** (the GLB's `*_collider` meshes get both layers)

Pick by how the model is authored:

| Model | To make it clickable |
|---|---|
| Has a `_collider` mesh | Already on `CL_POINTER` via the invisible default. To split layers, set `invisibleMeshesCollisionMask` explicitly and keep `visibleMeshesCollisionMask: 0`. |
| Static mesh, NO `_collider` | Set `visibleMeshesCollisionMask: ColliderLayer.CL_POINTER` — the visible mesh becomes the click target. |
| **Skinned / armature-rigged** (NPCs, characters, ghosts), NO `_collider` | `visibleMeshesCollisionMask` does **not** make it clickable. Add an explicit invisible child collider (below). |

**PITFALL: a skinned/rigged GLB is not made pointer-clickable by `visibleMeshesCollisionMask`.** Observed in an SDK7 scene: an NPC/ghost GLB with no `_collider` mesh and `visibleMeshesCollisionMask: ColliderLayer.CL_POINTER` did not receive pointer events. SDK6's `GLTFShape` made a visible mesh clickable regardless of rigging; in SDK7 the visible-mesh mask did not raycast the skinned/animated visible mesh for pointer events in this case. (This is observed renderer behavior — the exact rigging conditions are not documented in the protocol; verify per-model.)

**Fix — add an invisible box collider on `CL_POINTER`, parented to the entity so it tracks movement, and register the handler on the collider:**

```typescript
import { engine, MeshCollider, ColliderLayer, pointerEventsSystem, InputAction, Transform } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

// `npc` is the rigged GLB entity (with GltfContainer + Animator).
const clicker = engine.addEntity()
// scale to the avatar bounds; parent so it follows the NPC as it moves
Transform.create(clicker, { position: Vector3.create(0, 0.45, 0), scale: Vector3.create(2, 2.9, 2), parent: npc })
MeshCollider.setBox(clicker, ColliderLayer.CL_POINTER)

pointerEventsSystem.onPointerDown(
  { entity: clicker, opts: { button: InputAction.IA_PRIMARY, hoverText: 'Talk', showFeedback: true } },
  () => { /* handle click */ }
)
```

The `GltfContainer` itself can keep `visibleMeshesCollisionMask: 0`. For an AvatarShape NPC (no mesh collider at all), the same child-collider approach applies — see [[npcs]] Option A.

### All Input Actions

```typescript
InputAction.IA_POINTER; // Left mouse button
InputAction.IA_PRIMARY; // E key
InputAction.IA_SECONDARY; // F key
InputAction.IA_ACTION_3; // 1 key
InputAction.IA_ACTION_4; // 2 key
InputAction.IA_ACTION_5; // 3 key
InputAction.IA_ACTION_6; // 4 key
InputAction.IA_JUMP; // Space key
InputAction.IA_FORWARD; // W key
InputAction.IA_BACKWARD; // S key
InputAction.IA_LEFT; // A key
InputAction.IA_RIGHT; // D key
InputAction.IA_WALK; // Control key
InputAction.IA_MODIFIER; // Shift key
```

### All Event Types

```typescript
PointerEventType.PET_DOWN; // Button pressed
PointerEventType.PET_UP; // Button released
PointerEventType.PET_HOVER_ENTER; // Cursor enters entity
PointerEventType.PET_HOVER_LEAVE; // Cursor leaves entity
PointerEventType.PET_PROXIMITY_ENTER; // Player walks within entity's proximity range
PointerEventType.PET_PROXIMITY_LEAVE; // Player moves out of entity's proximity range
```

---

## Proximity Events (Nearby Interactions Without Aiming)

Proximity events let entities react to button presses when the player is nearby and roughly facing the entity, **without requiring the player to aim their cursor at it**. The interactive area is a wide triangular slice projecting forward from the avatar's position — the avatar's facing direction matters, not the camera direction.

If the player is both in proximity of an entity with a proximity interaction AND aiming at an entity with a pointer interaction, the **pointer interaction always takes priority**. Among multiple proximity entities in range, only the closest one (or highest priority) is activated.

Use `pointerEventsSystem.onProximityDown()` and `.onProximityUp()` — same signature as pointer events but with `maxPlayerDistance`. Only one per entity. Do not call within a system loop.

Use `.onProximityEnter()` and `.onProximityLeave()` for detecting when a player walks into/out of range — useful for sounds, animations, or UI hints.

Use the `priority` option (higher number wins) when multiple entities overlap. Closest entity wins ties. Remove with `.removeOnProximityDown(entity)` etc.

### Proximity Options

- `button`: Which button to listen for (same as pointer events)
- `maxDistance`: Max distance from the player's **camera** to the entity
- `maxPlayerDistance`: Max distance from the player's **avatar** to the entity (most relevant for proximity)
- `hoverText`: Text shown when player is near
- `showHighlight`: Edge highlight when in range (default: `true`)
- `showFeedback`: Hover feedback around entity center (default: `true`)
- `priority`: Resolves conflicts — higher values take precedence, closest wins on ties

For the system-based approach (combining pointer + proximity on the same entity), use `InteractionType.PROXIMITY` with the `PointerEvents` component and `inputSystem.isTriggered()`.

---

## Trigger Areas (Proximity Detection)

Native ECS component for detecting when an entity enters a region. Prefer this over hand-rolled "check player position every frame" systems and over the older `@dcl-sdk/utils` `triggers.addTrigger()` helper — they exist as fallbacks but `TriggerArea` is the standard SDK7 primitive ([ADR-258](https://github.com/decentraland/adr/blob/2b30a5e2b4f359a7c22a68fb827db282f6e5f887/content/ADR-258-trigger-areas.md)).

**The volume's size, position, and rotation come from the entity's `Transform`.** `Transform.scale` defines a unit box (or sphere radius from `scale.x`) at the entity's pose, respecting any parent chain.

**Minimal example — box that detects the local player:**
```typescript
import {
  engine,
  Transform,
  TriggerArea,
  triggerAreaEventsSystem,
  ColliderLayer
} from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

const zone = engine.addEntity()
Transform.create(zone, {
  position: Vector3.create(8, 1, 8),
  scale: Vector3.create(4, 2, 4) // 4m × 2m × 4m box
})
TriggerArea.setBox(zone, ColliderLayer.CL_PLAYER)

triggerAreaEventsSystem.onTriggerEnter(zone, (result) => {
  if (result.trigger?.entity !== engine.PlayerEntity) return // local player only
  console.log('player entered')
})
triggerAreaEventsSystem.onTriggerExit(zone, () => {
  console.log('player left')
})
```

**Sphere variant:** `TriggerArea.setSphere(entity, ColliderLayer.CL_PLAYER)` — use uniform `Transform.scale` (radius taken from `scale.x`).

**Collision mask:** Default is `CL_PLAYER`. Pass other `ColliderLayer` values (bitwise-OR them, e.g. `CL_PLAYER | CL_CUSTOM4`) to react to physics or custom layers.

**Detecting non-player entities:** a `TriggerArea` fires for any entity whose own collider is on a layer the area listens for. To make a scene entity trip an area, give it a `MeshCollider`/`GltfContainer` collider on a matching custom layer and set the area's mask to include it (verified `75,-9-trigger-areas`: a `GltfContainer` with `visibleMeshesCollisionMask: ColliderLayer.CL_CUSTOM4` trips an area created with `TriggerArea.setBox(entity, ColliderLayer.CL_PLAYER | ColliderLayer.CL_CUSTOM4)`). You can also put a `TriggerArea` on a moving/falling entity to detect when *it* enters another volume.

**Callbacks:**
- `triggerAreaEventsSystem.onTriggerEnter(entity, cb)` — fires once on entry
- `triggerAreaEventsSystem.onTriggerStay(entity, cb)` — fires every tick while inside (SDK-synthesized from the ENTER/EXIT state machine)
- `triggerAreaEventsSystem.onTriggerExit(entity, cb)` — fires once on exit
- Detach with `removeOnTriggerEnter/Stay/Exit(entity)`

**Callback shape — common gotcha:**
The callback receives a `PBTriggerAreaResult`. `result.trigger?.entity` is the entity that entered (compare with `engine.PlayerEntity` to filter to the local player). `result.triggeredEntity` is the trigger area itself — comparing it to the player is always true and the guard never fires. The naming is genuinely counterintuitive — `triggeredEntity` sounds like "the entity that did the triggering" but actually means "the entity whose trigger area was activated". See `{baseDir}/references/input-reference.md#trigger-area-callback-fields`.

**Multiplayer note:** With `CL_PLAYER`, the trigger fires for every player that enters — remote players included. Always guard physics/UI side-effects with `if (result.trigger?.entity !== engine.PlayerEntity) return`.

**Underlying components:** `TriggerArea` (config) and `TriggerAreaResult` (CRDT result). You normally don't read `TriggerAreaResult` directly — use the events system.

---

## Raycasting

Four direction modes: local direction (relative to entity rotation), global direction (world-space), global target (aim at position), target entity (aim at another entity).

**Callback-based** (recommended): `raycastSystem.registerLocalDirectionRaycast()`, `.registerGlobalDirectionRaycast()`, `.registerGlobalTargetRaycast()`, `.registerTargetEntityRaycast()`. Remove with `.removeRaycasterEntity()`.

**Component-based**: Create `Raycast` component, read `RaycastResult` in a system. Set `continuous: false` for one-shot, `true` for per-frame. Fields (verified `77,-1-raycast-unit-tests`): `direction: { $case: 'localDirection'|'globalDirection'|'globalTarget'|'targetEntity', ... }`, `originOffset`, `maxDistance`, `queryType`, `continuous`, `timestamp`. `RaycastResult` (added a frame later) contains `globalOrigin`, a normalized `direction`, `hits[]`, `timestamp`, and `tickNumber`.

**Ray origin respects the world transform:** the ray starts at the entity's world position (parent chain applied) plus `originOffset`, so a raycast entity nested under moved/scaled parents casts from its resolved world pose. `localDirection` is rotated by the entity's world rotation; `globalDirection` ignores it.

PITFALL: `RaycastQueryType.RQT_HIT_FIRST` picks the **first** hit in range, **not necessarily the closest** (verified enum doc). Use `RQT_QUERY_ALL` and sort by distance if you need the nearest. `RQT_NONE` skips the cast and returns empty hits.

**Camera raycast**: Use `engine.CameraEntity` as the entity to detect what the player is looking at. To cast along the cursor (works locked or free), use `PrimaryPointerInfo.worldRayDirection` as the direction (see advanced-input).

---

## Global Input Handling

Listen for key presses anywhere (not entity-specific) using `inputSystem.isTriggered()` (just pressed this frame) and `inputSystem.isPressed()` (currently held) inside an `engine.addSystem()`. Use `inputSystem.getInputCommand()` for entity-specific input via system.

## Cursor State

Read pointer lock with `PointerLock.get(engine.CameraEntity).isPointerLocked`. Get cursor position and world ray with `PrimaryPointerInfo.get(engine.RootEntity)`.

## Toggle Pattern

Common pattern: track state in a module-level boolean, flip it in the click handler, and update the entity accordingly.

## Best Practices

- Always set `maxDistance` on pointer events (8-16m is typical)
- Always set `hoverText` so users know what outcome their interaction will have
- Clean up handlers when entities are removed
- Use `MeshCollider` for invisible trigger surfaces
- For complex interactions, use a system with state tracking
- Set `continuous: false` on raycasts unless you need per-frame results
- Design for both desktop and mobile — mobile has no keyboard, rely on pointer and on-screen buttons

## Example scenes

Engine-team test scenes exercising these APIs (ground truth):

- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/3,2-proximity-interactions — `onProximityDown/Enter/Leave`, cursor vs proximity priority, declarative `PointerEvents` with two buttons, proximity door.
- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/30,20-pointer-events-feedback — `showFeedback`/`showHighlight`/`hoverText` combinations (hover text needs `showFeedback: true`).
- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/75,-9-trigger-areas — `TriggerArea.setBox/setSphere`, `onTriggerEnter/Stay/Exit`, `result.trigger?.entity`, custom collider-layer masks so non-player entities trip the area.
- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/0,0-cube-spawner — declarative `PointerEvents` read in a system via `inputSystem.isTriggered(IA_POINTER, PET_DOWN, entity)`.
- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/77,-1-raycast-unit-tests — component-based `Raycast`/`RaycastResult` for all four direction modes, incl. origin under a transformed parent chain.

For full code examples and implementation patterns, see `{baseDir}/references/interactivity-patterns.md`. For the input action reference table and declarative PointerEvents component, see `{baseDir}/references/input-reference.md`.
