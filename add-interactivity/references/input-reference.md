# Input System Reference

## All Input Actions

Key map for every `InputAction` (including `IA_ANY`): **advanced-input** → *All InputAction Values*.

**Notes:**

- Mouse wheel is **not available** as an input
- Always design for both desktop and mobile — mobile has no keyboard, rely on pointer and on-screen buttons
- Use `hoverText` to communicate what an interaction does before the player commits

## Distance and outline rules

Read when an interaction range or hover outline behaves differently from what you computed. Example scene: `34,20-pointer-events-distances`.

| Option | Measured from | Default |
|---|---|---|
| `maxDistance` | the avatar/player position | `10` |
| `maxCameraDistance` | the active camera origin (`@dcl/sdk` 7.28.0+; Unity and Bevy explorers both apply it) | none (unset) |
| `maxPlayerDistance` | `[DEPRECATED]` alias of `maxDistance` (same meaning) | none |

How the two live thresholds combine:

| Set | Interaction allowed when |
|---|---|
| only `maxDistance` | player distance <= `maxDistance` |
| only `maxCameraDistance` | camera distance <= `maxCameraDistance` |
| both | player distance <= `maxDistance` **OR** camera distance <= `maxCameraDistance` (OR, not AND) |
| neither | player distance <= 10 (the implicit default) |

- If both `maxDistance` and `maxPlayerDistance` are set, **the larger of the two wins** as the player threshold.
- The default third-person camera trails the avatar by ~7m, so a camera-only rule of 10m is much tighter in practice than it reads.
- Proximity events ignore `maxCameraDistance` entirely.

Measurement origins (matters when a threshold behaves ~1m off):

- Cursor player distance: avatar ROOT (feet, `Transform.get(engine.PlayerEntity).position`) to the raycast hit point on the collider surface.
- Cursor camera distance: the ray length from the camera to the hit point (`hitInfo.distance`).
- Proximity distance: from the capsule **center** (~1m above the feet), not the feet and not the hit point. Expect proximity and cursor readouts to differ by roughly that 1m even standing in the same spot.

### What the outline draws

The renderers of the entity that owns the hit collider (which must also carry `PointerEvents`) **plus all its descendants**, never its parent or siblings. Only `MeshRenderer` primitives and GLBs are outlined; `TextShape` never is (unity-explorer `InteractionHighlightSystem`). So:

- An invisible hitbox (collider + `PointerEvents`, no mesh) outlines nothing unless the visible parts are its **children**. A hitbox placed beside the model or as a child of it gives events and hover text but no outline.
- A prop made of several entities, each with its own collider and handler, outlines one part at a time. Put one collider and the `PointerEvents` on a root, with the visible parts as children, or make the prop a single GLB.

## All Pointer Event Types

```typescript
PointerEventType.PET_DOWN; // Button/key pressed
PointerEventType.PET_UP; // Button/key released
PointerEventType.PET_HOVER_ENTER; // Cursor enters entity bounds
PointerEventType.PET_HOVER_LEAVE; // Cursor leaves entity bounds
```

## Declarative Pointer Events Component

Instead of the callback system, you can use the `PointerEvents` component directly:

```typescript
import { PointerEvents, PointerEventType, InputAction } from "@dcl/sdk/ecs";

PointerEvents.create(entity, {
  pointerEvents: [
    {
      eventType: PointerEventType.PET_DOWN,
      eventInfo: {
        button: InputAction.IA_POINTER,
        hoverText: "Click me",
        showFeedback: true,
        maxDistance: 10,
      },
    },
  ],
});
```

Then read results in a system using `inputSystem.getInputCommand()`.

## Proximity Interactions

Proximity interactions detect button events when a player is near and roughly facing an entity, **without requiring them to aim their cursor at it**. Unlike pointer events (which use raycasting), proximity events check for entities within a wide triangular slice of a sphere projecting forward from the player's position.

Key distinction: avatar facing direction matters, independently of where the camera is pointing.

### onProximityDown / onProximityUp

```typescript
import { pointerEventsSystem, InputAction } from "@dcl/sdk/ecs";

pointerEventsSystem.onProximityDown(
  {
    entity: myEntity,
    opts: {
      button: InputAction.IA_PRIMARY,
      hoverText: "Press E",
      maxDistance: 5,
    },
  },
  function () {
    console.log("Player pressed button near entity");
  }
);

pointerEventsSystem.onProximityUp(
  {
    entity: myEntity,
    opts: {
      button: InputAction.IA_PRIMARY,
      hoverText: "Release E",
      maxDistance: 5,
    },
  },
  function () {
    console.log("Player released button near entity");
  }
);
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
      hoverText: "Nearby",
      maxDistance: 5,
    },
  },
  function () {
    console.log("Player entered proximity");
  }
);

pointerEventsSystem.onProximityLeave(
  {
    entity: myEntity,
    opts: {
      button: InputAction.IA_POINTER,
      hoverText: "Nearby",
      maxDistance: 5,
    },
  },
  function () {
    console.log("Player left proximity");
  }
);
```

### Options

| Option              | Description                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `button`            | Which button to listen for (`InputAction.IA_PRIMARY`, `IA_SECONDARY`, `IA_POINTER`, etc.)                                |
| `maxDistance`       | Max distance from the player's **avatar** to the entity (meters). Default `10`. This is the range option for both cursor and proximity events. |
| `maxPlayerDistance` | `[DEPRECATED]` alias of `maxDistance` (same meaning). If both are set, the **larger** wins.                              |
| `maxCameraDistance` | Max distance from the **active camera** origin (meters). Default: unset. Combines with `maxDistance` as an **OR**. **Ignored on the proximity path.** Requires `@dcl/sdk` 7.28.0+. |
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
      hoverText: "Open door",
      maxDistance: 5,
      priority: 2,
    },
  },
  () => {
    console.log("Door activated");
  }
);

pointerEventsSystem.onProximityDown(
  {
    entity: floorEntity,
    opts: {
      button: InputAction.IA_PRIMARY,
      hoverText: "Step here",
      maxDistance: 5,
      priority: 1,
    },
  },
  () => {
    console.log("Floor activated");
  }
);
```

### Remove Callbacks

```typescript
pointerEventsSystem.removeOnProximityDown(myEntity);
pointerEventsSystem.removeOnProximityUp(myEntity);
pointerEventsSystem.removeOnProximityEnter(myEntity);
pointerEventsSystem.removeOnProximityLeave(myEntity);
```

### System-Based Proximity (PointerEvents Component)

For the system-based approach, use `PET_PROXIMITY_ENTER` and `PET_PROXIMITY_LEAVE` in the `PointerEvents` component, and `InteractionType.PROXIMITY` for proximity button presses:

> **Warning:** `interactionType` is a field of the pointer event entry — a sibling of `eventType` and `eventInfo`, NOT a field inside `eventInfo`. Placing it inside `eventInfo` is silently ignored and the event defaults to `InteractionType.CURSOR`.
>
> For range use `maxDistance` — it is **avatar distance** (default `10`) on both the cursor and the proximity path, not a camera/ray range. `maxPlayerDistance` is a `[DEPRECATED]` alias of it. `maxCameraDistance` is camera-origin distance and is ignored on the proximity path.

```typescript
import { PointerEvents, PointerEventType, InteractionType, InputAction } from "@dcl/sdk/ecs";

PointerEvents.create(myEntity, {
  pointerEvents: [
    {
      eventType: PointerEventType.PET_PROXIMITY_ENTER,
      interactionType: InteractionType.PROXIMITY,
      eventInfo: {
        button: InputAction.IA_PRIMARY,
        hoverText: "Approach",
        maxDistance: 5,
      },
    },
    {
      eventType: PointerEventType.PET_PROXIMITY_LEAVE,
      interactionType: InteractionType.PROXIMITY,
      eventInfo: {
        button: InputAction.IA_PRIMARY,
        maxDistance: 5,
      },
    },
  ],
});
```

Then read results in a system using `inputSystem.getInputCommand()` with `InteractionType.PROXIMITY`.

### Example: Proximity Door

Full door example: `interactivity-patterns.md` → *Proximity Door Example*.

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
  queryType: RaycastQueryType.RQT_HIT_FIRST,  // first hit (NOT necessarily closest); RQT_QUERY_ALL = all; RQT_NONE = skip
  originOffset: Vector3.create(0, 0.5, 0),     // offset from entity world origin (parent chain applied)
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
      console.log("Looking at:", result.hits[0].entityId);
  }
);
```

## Avatar Modifier Areas

Modify how avatars appear or behave in a region:

```typescript
import { AvatarModifierArea, AvatarModifierType } from "@dcl/sdk/ecs";

AvatarModifierArea.create(entity, {
  area: Vector3.create(4, 3, 4),
  modifiers: [AvatarModifierType.AMT_HIDE_AVATARS],
  excludeIds: ["0x123...abc"], // Optional
});

// Available modifiers:
// AMT_HIDE_AVATARS      — Hide all avatars in the area
// AMT_DISABLE_PASSPORTS — Disable clicking on avatars to see profiles
// To disable jumping in an area, use InputModifier's `disableJump` flag
// (covered in the advanced-input skill), not an AvatarModifierType.
```

## Cursor State

Pointer lock and the cursor's position and world ray: **advanced-input** → *Pointer Lock State* and *Cursor Position and World Ray*.

## Trigger Area Callback Fields

The trigger area event callback receives a `DeepReadonlyObject<PBTriggerAreaResult>`. The naming is counterintuitive — `triggeredEntity` sounds like "the entity that did the triggering" but actually refers to the trigger area itself ("the entity whose trigger area was activated"). Use the table below to keep them straight.

**Top-level — the trigger area itself (the entity whose volume was activated):**
- `triggeredEntity` — The trigger area's own entity. Comparing this to `engine.PlayerEntity` is always true and the guard never fires — do NOT use this for the local-player check.
- `triggeredEntityPosition` — World position of the trigger area entity
- `triggeredEntityRotation` — World rotation of the trigger area entity
- `eventType` — `TAET_ENTER` (0), `TAET_STAY` (1), or `TAET_EXIT` (2)
- `timestamp` — Tick timestamp

**Nested `trigger: { ... }` — the entity that entered/exited the volume:**
- `trigger.entity` — The entity that entered the area (compare against `engine.PlayerEntity` to filter to local player)
- `trigger.layers` — The collider layers the area listens for
- `trigger.position` — World position of the entity that entered
- `trigger.rotation` — World rotation of the entity that entered
- `trigger.scale` — World scale of the entity that entered

> **Common mistake:** Filtering with `result.triggeredEntity !== engine.PlayerEntity` is always true (the trigger area entity is never the player entity) and the guard never fires. Use `result.trigger?.entity !== engine.PlayerEntity` to detect the local player.
