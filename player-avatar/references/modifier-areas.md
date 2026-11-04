# Avatar Modifier Areas

Companion to **player-avatar** → *Avatar Modifier Areas*. `AvatarModifierArea` changes how avatars appear or behave inside a box region.

```typescript
import {
	engine,
	Transform,
	AvatarModifierArea,
	AvatarModifierType,
} from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

const modifierArea = engine.addEntity()
Transform.create(modifierArea, {
	position: Vector3.create(8, 1.5, 8),
	scale: Vector3.create(4, 3, 4), // mirror of `area`, for the Creator Hub
})

AvatarModifierArea.create(modifierArea, {
	area: Vector3.create(4, 3, 4),
	modifiers: [AvatarModifierType.AMT_HIDE_AVATARS],
	excludeIds: ['0x123...abc'], // Optional: exclude specific players
})
```

## Fields

- `area: Vector3` — the region size. Set it to the dimensions you mean and mirror the same numbers into `Transform.scale` (see the GOTCHA). A zero or unset `area` falls back to the scale.
- `modifiers` — an array; combine several, e.g. `[AMT_HIDE_NAMETAGS, AMT_DISABLE_PASSPORTS]`.
- `excludeIds` — wallet addresses that stay unaffected (e.g. keep the scene owner visible). Mutate at runtime via `AvatarModifierArea.getMutable(entity).excludeIds = [...]`; the change is re-applied to avatars already inside, for the modifiers still listed (see *Overlapping areas and runtime changes*).

## Available Modifiers

```typescript
AvatarModifierType.AMT_HIDE_AVATARS // Hide all avatars in the area
AvatarModifierType.AMT_DISABLE_PASSPORTS // Disable clicking on avatars to see profiles
AvatarModifierType.AMT_HIDE_NAMETAGS // Hide the name tag above avatars in the area
```

`AMT_HIDE_AVATARS` hides both avatars AND nametags, so combining it with `AMT_HIDE_NAMETAGS` is redundant. Both modifiers also hide any `AvatarNametag` plate; there is no way to hide the native tag while keeping the plate. Use `AMT_HIDE_NAMETAGS` alone to hide nametags while keeping avatars visible (stages, presentations, clean visual experiences). `AMT_HIDE_NAMETAGS` combines with `AMT_DISABLE_PASSPORTS`.

**Nametag hiding is head/torso based:** the nametag is hidden only while the player's head or torso is inside the area. If the area is too short, a player who double-jumps above it has their nametag briefly reappear. Make the area tall enough to cover the expected range of movement.

To disable jumping in an area, use `InputModifier`'s `disableJump` flag (**advanced-input**), not an `AvatarModifierType`.

## GOTCHA — overlapping areas and runtime changes

Verified in the desktop Explorer's `AvatarModifierAreaHandlerSystem` (unity-explorer `dev`, 2026-11-04) and observed in a scene 2026-11:

- **Each avatar holds one flag per effect, not a count of areas.** Every area writes the same per-avatar "hidden" and "nametag hidden" booleans, and the last write wins. An area whose `excludeIds` lists a player writes *visible* for that player when they enter it, for each effect that area itself lists (`AMT_HIDE_AVATARS` for the body, `AMT_HIDE_NAMETAGS` for the nametag), overriding a hide-all area they are also in; leaving any area writes *visible* even while the avatar is still inside another hiding area. Observed: a scene-wide area excluding the local player plus a tower area hiding everyone showed the player's own body when turning around. Give each avatar one area at a time, or overlapping areas that agree.
- **Dropping a modifier in place leaves its effect on.** On any field change the client re-applies only the modifiers now listed to the avatars inside; nothing restores an effect whose modifier was removed. `getMutable(area).modifiers = []`, or swapping `AMT_HIDE_AVATARS` for `AMT_HIDE_NAMETAGS`, leaves the avatars hidden. Adding a modifier in place does apply.
- Observed with the same in-place pattern: a nametag kept showing during a camera-locked killcam until the area was deleted and recreated.

**Pattern that works:** one scene-wide area hiding everyone. To switch mode, `engine.removeEntity` it and create the replacement in the same frame: deleting an area re-shows every avatar inside it, and the replacement applies its own modifiers as its trigger registers them. Whether that leaves avatars visible for a frame was not measured.

## GOTCHA — an explicit `area` wins over `Transform.scale` for the life of the component

You cannot resize the region by scaling. The inverse world scale is re-applied every frame: scaling the area entity (or any of its **parents**; it compensates `lossyScale`) afterwards leaves the region exactly the `area` size, and the player's experience does not change. An axis scaled to **0** still collapses the region on that axis. Consequences:

- **Do not animate or tween the scale of an area entity to grow or shrink the region**: nothing happens. Write `AvatarModifierArea.getMutable(entity).area` instead, and mirror it into `scale`.
- **Do not parent an area under a group you scale**, e.g. a prop rig that scales up on activation: the region stays put while the visuals grow, and the mismatch is invisible in-world because there is no API to read whether an avatar is hidden.
- **Keep `Transform.scale` equal to `area` anyway.** The Creator Hub draws the placeholder cube from the scale and writes the gizmo scale into `area` whenever the entity is edited, so a mismatch shows the user a misleading box and the next editor save silently resizes the region to the scale. That mirroring is an editor-time write, not a runtime binding.
- To *visualise* the region, use a **separate** box entity sized from the same numbers. A visible box on the area entity itself lies the moment either value changes.
- `TriggerArea` is the exact opposite: `PBTriggerArea` has **no size field at all** (only `mesh` and `collision_mask`), so its volume is the entity's `Transform`; scale it and the trigger follows, including later scale changes. Two sibling components, opposite sizing rules (**add-interactivity**). `CameraModeArea` follows the `AvatarModifierArea` rule (**camera-control**).

Regression coverage: [`9,99-modifier-areas`](https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/9,99-modifier-areas) (`src/areaScaleDrift.ts`) scales a 2x2x2 `CameraModeArea` entity to 2.5 and asserts the camera still releases 2 m from the centre. It scales the entity itself only; the parent case follows from the code (inverse `lossyScale`), not from a test.

## Creator Hub

An *Avatar Modifier Area* smart item (utils category, translucent placeholder cube) and an inspector panel exist: a multi-select for modifiers and a wallet-address list for `excludeIds`. The panel's dropdown offers `Hide Avatars` and `Disable Passports` only; set `AMT_HIDE_NAMETAGS` in code.
