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

**Important: Colliders Required** — Pointer events only work on entities with a collider using the `ColliderLayer.CL_POINTER` layer. Use `MeshCollider.setBox(entity)` for invisible colliders, or set `visibleMeshesCollisionMask: ColliderLayer.CL_POINTER` on `GltfContainer`.

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

Detect when the player enters, exits, or stays inside an area using `TriggerArea.setBox(entity)` or `TriggerArea.setSphere(entity)`. Size the area via `Transform.scale`. Register callbacks with `triggerAreaEventsSystem.onTriggerEnter()`, `.onTriggerExit()`, `.onTriggerStay()`.

By default, trigger areas react to the player layer. Use `ColliderLayer` to restrict which entities activate the area.

---

## Raycasting

Four direction modes: local direction (relative to entity rotation), global direction (world-space), global target (aim at position), target entity (aim at another entity).

**Callback-based** (recommended): `raycastSystem.registerLocalDirectionRaycast()`, `.registerGlobalDirectionRaycast()`, `.registerGlobalTargetRaycast()`, `.registerTargetEntityRaycast()`. Remove with `.removeRaycasterEntity()`.

**Component-based**: Create `Raycast` component, read `RaycastResult` in a system. Set `continuous: false` for one-shot, `true` for per-frame.

**Camera raycast**: Use `engine.CameraEntity` as the entity to detect what the player is looking at.

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

For full code examples and implementation patterns, see `{baseDir}/references/interactivity-patterns.md`. For the input action reference table and declarative PointerEvents component, see `{baseDir}/references/input-reference.md`.
