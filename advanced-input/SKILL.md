---
name: advanced-input
description: System-level input polling, player movement control, platform and language detection, and mobile on-screen controls in Decentraland. Covers inputSystem, InputModifier, PointerLock, PrimaryPointerInfo, getPlatform/getPlayerLanguage, and TouchScreenControls. Use when the user wants continuous key polling, WASD-controlled entities, to freeze the player during a cutscene, FPS-style cursor lock, multi-key combo patterns, mobile-specific behavior, localized text in the player's language, or to hide/customize the mobile joystick, crosshair, or on-screen buttons. For event-driven clicks and hover on entities see add-interactivity.
---

# Advanced Input Handling in Decentraland

## Pointer Lock State

Detect whether the cursor is captured (first-person mode) or free:

```typescript
import { engine, PointerLock } from '@dcl/sdk/ecs'

function checkPointerLock() {
  const isLocked = PointerLock.get(engine.CameraEntity).isPointerLocked

  if (isLocked) {
    // Cursor is captured — player is in first-person control
  } else {
    // Cursor is free — player can click UI elements
  }
}

engine.addSystem(checkPointerLock)
```

### Requesting / releasing pointer lock (writable)

`PointerLock.isPointerLocked` is a plain writable boolean — a scene can request or release cursor capture by mutating it, from a click handler or a system:

```typescript
PointerLock.createOrReplace(engine.CameraEntity, { isPointerLocked: false })
// request lock (e.g. from a button)
PointerLock.getMutable(engine.CameraEntity).isPointerLocked = true
// release lock
PointerLock.getMutable(engine.CameraEntity).isPointerLocked = false
```

PITFALL: `getMutable(engine.CameraEntity)` throws if `PointerLock` was never created on the camera. Call `PointerLock.createOrReplace(engine.CameraEntity, { isPointerLocked: false })` once in `main()` before mutating. Writing `true` is a _request_; the client/player may still control actual capture (e.g. Esc unlocks).

### Pointer Lock Change Detection

```typescript
PointerLock.onChange(engine.CameraEntity, (pointerLock) => {
  if (pointerLock?.isPointerLocked) {
    console.log('Cursor locked')
  } else {
    console.log('Cursor unlocked')
  }
})
```

## Cursor Position and World Ray

Get the cursor's screen position and the ray it casts into the 3D world:

```typescript
import { engine, PrimaryPointerInfo } from '@dcl/sdk/ecs'

function readPointer() {
  const pointerInfo = PrimaryPointerInfo.getOrCreateMutable(engine.RootEntity)
  console.log('Cursor position:', pointerInfo.screenCoordinates)
  console.log('Cursor delta:', pointerInfo.screenDelta)
  console.log('World ray direction:', pointerInfo.worldRayDirection)
}

engine.addSystem(readPointer)
```

### Field details

- `screenCoordinates` _(optional Vector2)_ — cursor position in pixels. **Origin is the top-left corner of the screen** (positive Y = down — the same space as `UiTransform`/`UiCanvasInformation`, so cursor coords drop straight into a UI `position`). When the cursor is locked, freezes at the screen center.
- `screenDelta` _(optional Vector2)_ — how many pixels the mouse moved since the last frame. Positive `x` = right, positive `y` = down (same top-left origin as `screenCoordinates`), so moving the mouse *up* reports a **negative** `y`. **Keeps reporting raw mouse movement while the cursor is locked** — unlike `screenCoordinates` and `worldRayDirection`, which freeze at screen center. This makes `screenDelta` the only way to read mouse movement during pointer lock, and the correct input for mouselook / FPS camera controls (see the **camera-control** skill's mouselook pattern). `screenDelta` is always 0 on mobile (no continuous cursor); `screenCoordinates` and `worldRayDirection` work on both platforms.
- `worldRayDirection` _(optional Vector3)_ — direction from the camera through the cursor. Freezes at center ray while locked.
- `pointerType` — `0` for none, `1` for mouse.

PITFALL: every field is optional. Use `getOrCreateMutable(engine.RootEntity)` so the component exists before first read, and null-check each field (`pointerInfo.screenCoordinates?.x ?? 0`). `worldRayDirection` feeds directly into a camera raycast direction (the "spawn at cursor" pattern in `0,5-primary-cursor-info`).

## Input Polling with inputSystem

### Per-Entity Input Commands

Check if a specific input action occurred on a specific entity:

```typescript
import { engine, inputSystem, InputAction, PointerEventType } from '@dcl/sdk/ecs'

function myInputSystem() {
  // Check for click on a specific entity
  const clickData = inputSystem.getInputCommand(
    InputAction.IA_POINTER,
    PointerEventType.PET_DOWN,
    myEntity
  )

  if (clickData) {
    console.log('Entity clicked via system:', clickData.hit.entityId)
  }
}

engine.addSystem(myInputSystem)
```

The returned command carries `hit` data (position and entity) — use `getInputCommand()` when you need to know what was clicked.

Pass `InputAction.IA_ANY` to match any action — `getInputCommand(InputAction.IA_ANY, PointerEventType.PET_DOWN)` returns a command for whatever key was pressed, and `cmd.button` tells you which one.

For the Tag-based per-entity cookbook (mark entities with a Tag, fetch them with `engine.getEntitiesByTag`, and poll each with `getInputCommand` inside a system), see `{baseDir}/references/input-patterns.md` → "Per-Entity Input Command Cookbook (Tag-based)".

### Global Input Checks

Check if a specific key was pressed, regardless of if the player's cursor was pointing at an entity or not.

**Entity-less calls answer from every entity.** Called without an entity (or with `engine.RootEntity`, which is `0` and takes the same branch), `isTriggered` / `getInputCommand` read the results of every entity that has `PointerEventsResult`, so a click on any entity counts as the "global" press. That is right for "was E pressed at all". To read only presses that hit no entity (scene-root input), read `PointerEventsResult.get(engine.RootEntity)` with a timestamp watermark: `{baseDir}/references/input-patterns.md` → *Root-Entity Input (timestamp watermark)*.

Use `isTriggered()` for one-shot actions (fire a weapon, open a door) — it returns true only on the frame the key is first pressed. Use `isPressed()` for continuous actions (movement, holding a shield) — it returns true every frame while held.

```typescript
function globalInputSystem() {
  // Was the key just pressed this frame?
  if (inputSystem.isTriggered(InputAction.IA_PRIMARY, PointerEventType.PET_DOWN)) {
    console.log('E key pressed!')
  }

  // Is the key currently held down?
  if (inputSystem.isPressed(InputAction.IA_SECONDARY)) {
    console.log('F key is held!')
  }
}

engine.addSystem(globalInputSystem)
```

Below `@dcl/sdk` 7.28.0, a key pressed over one entity in the same frame the pointer is released over another is dropped: `isPressed` and the global `isTriggered` read `false` while that entity's `isTriggered` reads `true`. Upgrade the pin rather than work around it.

## All InputAction Values

| InputAction    | Key/Button                                                       |
| -------------- | ---------------------------------------------------------------- |
| `IA_POINTER`   | Left mouse button / tap                                          |
| `IA_PRIMARY`   | E key                                                            |
| `IA_SECONDARY` | F key                                                            |
| `IA_ACTION_3`  | 1 key                                                            |
| `IA_ACTION_4`  | 2 key                                                            |
| `IA_ACTION_5`  | 3 key                                                            |
| `IA_ACTION_6`  | 4 key                                                            |
| `IA_JUMP`      | Space key                                                        |
| `IA_FORWARD`   | W key                                                            |
| `IA_BACKWARD`  | S key                                                            |
| `IA_LEFT`      | A key                                                            |
| `IA_RIGHT`     | D key                                                            |
| `IA_WALK`      | Control key                                                      |
| `IA_MODIFIER`  | Shift key (run)                                                  |
| `IA_ANY`       | Matches any input action (wildcard — use with `getInputCommand`) |

## Event Types

`PointerEventType` values (`PET_DOWN`, `PET_UP`, hover and proximity enter/leave): **add-interactivity** → *All Event Types*.

## InputModifier (Movement Restriction)

Restrict or freeze the player's movement:

```typescript
import { engine, InputModifier } from '@dcl/sdk/ecs'

// Freeze player completely
InputModifier.create(engine.PlayerEntity, {
  mode: InputModifier.Mode.Standard({ disableAll: true })
})

// Restrict specific movement (all flags optional; a false/omitted flag is ignored)
InputModifier.createOrReplace(engine.PlayerEntity, {
  mode: InputModifier.Mode.Standard({
    disableWalk: true,
    disableJog: true,
    disableRun: true,
    disableJump: true,
    disableEmote: true,
    disableDoubleJump: true,
    disableGliding: true
  })
})

// Restore normal movement
InputModifier.deleteFrom(engine.PlayerEntity)
```

**Standard flags** (all optional booleans): `disableAll`, `disableWalk`, `disableJog`, `disableRun`, `disableJump`, `disableEmote`, `disableDoubleJump`, `disableGliding`. A `false`/omitted flag is ignored (consumes no bandwidth). `InputModifier.Mode.Standard({...})` and the raw `{ $case: 'standard', standard: {...} }` form are equivalent.

`disableJog` is separate from `disableWalk` / `disableRun`: jog is the default movement speed, so disabling only walk and run still lets the player jog.

**Behavior when frozen:** gravity and external forces still apply, camera rotation stays available, global input events are still detectable, and the restrictions lift automatically when the player leaves the scene bounds. To lock input for an action, pair it with `triggerSceneEmote` or `movePlayerTo` (**player-avatar**) and remove the modifier when the action ends.

**Clients:** works on desktop and on mobile app 0.50+ (`disableDoubleJump` and `disableGliding` need mobile 0.65+; older mobile apps ignore the modifier). On mobile, `disableAll` stops the touch joystick and buttons from moving the player but leaves them on screen; hide them with `TouchScreenControls` if they should disappear.

### Cutscene Pattern

For the worked cutscene flow (freeze the player with `disableAll` during a cinematic, then restore movement with `InputModifier.deleteFrom`), see `{baseDir}/references/input-patterns.md` → "Cutscene Pattern (freeze player during a cinematic)".

## WASD Movement Pattern

For the WASD-driven custom-entity pattern (poll `IA_FORWARD`/`IA_BACKWARD`/`IA_LEFT`/`IA_RIGHT` with `isPressed` to move a `Transform`, plus the note on freezing the avatar with `InputModifier` and how polling WASD relates to player movement), see `{baseDir}/references/input-patterns.md` → "WASD Movement Pattern (drive a custom entity)".

## Combining Input Patterns

For the action-bar / number-key pattern (map `IA_ACTION_3`–`IA_ACTION_6` to ability slots via `isTriggered`), see `{baseDir}/references/input-patterns.md` → "Action Bar with Number Keys".

## Platform detection

Detect whether the scene is running on mobile to conditionally adapt controls and UI:

```typescript
import { getPlatform, isMobile } from '@dcl/sdk/platform'

// getPlatform() returns 'mobile' | 'desktop' | 'web' | null
// Returns null until the explorer reports its platform (async, shortly after scene start)
// Defer platform-dependent setup until getPlatform() is non-null:
function platformCheckSystem() {
  if (getPlatform() === null) return
  engine.removeSystem(platformCheckSystem)
  if (isMobile()) {
    // mobile-specific setup here (e.g. larger UI, touch-friendly interactions)
  }
}
engine.addSystem(platformCheckSystem)
```

Import from `@dcl/sdk/platform`.

## Player language (`getPlayerLanguage`)

**Requires `@dcl/sdk` 7.30.0+.** Check the scene's pin before using it on an older project.

Same module, `@dcl/sdk/platform`. Use it to pick localized strings for UI text, NPC dialogue, signage, and hover text.

```typescript
import { getPlayerLanguage, onPlayerLanguageChanged } from '@dcl/sdk/platform'

const STRINGS: Record<string, string> = { en: 'Press E to open', es: 'Pulsa E para abrir' }

function label() {
	const lang = getPlayerLanguage()             // 'es', 'pt-BR', …
	return STRINGS[lang] ?? STRINGS[lang.split('-')[0]] ?? STRINGS.en
}

onPlayerLanguageChanged.add(({ language }) => {
	// the player switched the client language mid-session — rebuild any cached strings
})
```

- **`getPlayerLanguage(): string`** — a BCP-47 tag (`'es'`, `'pt-BR'`). Sourced from `getExplorerInformation().configurations['locale']`, with `_` normalized to `-` (`pt_BR` → `pt-BR`) and surrounding whitespace trimmed. A value that does not match `^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$` falls back to `'en'`.
- **GOTCHA — it is synchronous and returns `'en'` until the explorer has answered.** Unlike `getPlatform()`, which returns `null` while unknown, there is no "not yet" value here: calling it in `main()` reliably gives you `'en'` on every client. Either read it inside a system after the first frames, or re-read it from `onPlayerLanguageChanged`.
- **`onPlayerLanguageChanged: Observable<{ language: string }>`** fires only on a *real* change (setting the same tag twice notifies once). Older clients never emit it.
- Returns `'en'` when the client reports no locale, when `configurations` is missing, and when the `getExplorerInformation` RPC rejects. Region subtags are passed through verbatim — match on the full tag first, then fall back to the primary subtag, then to `'en'`.
- Under the hood this adds a `localeChanged: { locale: string }` scene event to `IEvents`; **importing `@dcl/sdk/platform` subscribes to it for you**, so there is nothing to wire up.

## On-screen touch controls (`TouchScreenControls`)

Brief: configures the mobile client's **native** on-screen controls — the virtual joystick, the crosshair, and the gamepad buttons. SDK **7.26.0+**.

```typescript
import { engine, TouchScreenControls, InputAction } from '@dcl/sdk/ecs'
```

- Set it on **`engine.RootEntity`** — the client reads it nowhere else.
- Applied while the player is inside the scene; reverts to defaults on exit, so scenes that don't use it are unaffected.
- **No-op** on platforms without native on-screen controls (desktop), and no effect in VR. Safe to write unconditionally — no `isMobile()` guard needed.
- Covers **input controls only**. The client's own HUD (emote wheel, profile, chat, minimap) is not affected by this component.
- **If the scene uses the Creator Hub UI Designer, this component is the editor's.** The Creator Hub ships a **MobileHUD** entry in the UI Designer that edits `TouchScreenControls` visually and owns `src/mobile-hud.ts` (lazily written, auto-deleted when the config returns to defaults). There is one component on `engine.RootEntity` and last write wins, so a hand-written `createOrReplace` elsewhere in such a scene clobbers the panel's config or gets clobbered by it. Check for `src/mobile-hud.ts` before writing `TouchScreenControls` by hand, and see the **build-ui** skill > "MobileHUD".

`PBTouchScreenControls` fields:

| Field           | Type                                 | Default     | Description                                                                                  |
| --------------- | ------------------------------------ | ----------- | -------------------------------------------------------------------------------------------- |
| `touchInputs`   | `PBTouchScreenControls_TouchInput[]` | `[]`        | Per-button overrides. A button not listed keeps its default (shown, default glyph).          |
| `mainAction`    | `InputAction \| undefined`           | `undefined` | Which action the large central button triggers. When unset, the default (`IA_JUMP`) is kept. |
| `hideJoystick`  | `boolean`                            | `false`     | Removes the native virtual joystick.                                                         |
| `hideCrosshair` | `boolean`                            | `false`     | Hides the on-screen crosshair / reticle.                                                     |

`TouchInput` entry: `{ inputAction: InputAction, hide: boolean, icon?: TextureUnion }` — `icon` overrides the button glyph with a scene image; on `IA_JUMP` it replaces all of its dynamic states (jump / double-jump / glide).

**Only gamepad actions map to an on-screen button**: `IA_POINTER` (interaction), `IA_PRIMARY` (E), `IA_SECONDARY` (F), `IA_JUMP` (central), `IA_ACTION_3`..`IA_ACTION_6` (1/2/3/4). Any other `InputAction` — movement actions, `IA_ANY`, `IA_MODIFIER`, unknown/future values — is ignored: a `touchInputs` entry naming one has no effect, and a `mainAction` that isn't a valid gamepad action falls back to `IA_JUMP`.

Convenience helpers on the component (each writes `RootEntity` and merges with the current value, so they can be called from anywhere):

| Helper                                                     | Effect                                                             |
| ---------------------------------------------------------- | ------------------------------------------------------------------ |
| `TouchScreenControls.hide(actions: InputAction[])`         | Hide the given buttons, merged into the current config.            |
| `TouchScreenControls.hideAll()`                            | Hide all eight gamepad buttons.                                    |
| `TouchScreenControls.showAll()`                            | Clear the button hide list. Does **not** touch joystick/crosshair. |
| `TouchScreenControls.setMainAction(action: InputAction)`   | Set the large central button's action.                             |
| `TouchScreenControls.hideJoystick()` / `.showJoystick()`   | Toggle the native virtual joystick.                                |
| `TouchScreenControls.hideCrosshair()` / `.showCrosshair()` | Toggle the crosshair / reticle.                                    |

```typescript
TouchScreenControls.hideJoystick()
TouchScreenControls.setMainAction(InputAction.IA_PRIMARY)
TouchScreenControls.hide([InputAction.IA_ACTION_3, InputAction.IA_ACTION_4])
```

Gotchas:

- `showAll()` resets `touchInputs` to `[]`, which also **discards any custom `icon`** set through it. Re-apply icons afterwards.
- Hiding a button does not disable the action — `inputSystem` still reports it if it can be triggered another way. Hiding removes the _button_, not the _input_.
- Hiding the joystick leaves mobile players with no native way to walk; replace it with scene UI or make the scene intentionally stationary.
- Buttons cannot be repositioned. Their slots are fixed; a scene only chooses which are visible and which one leads.
- `createOrReplace` **replaces** the whole config (the helpers merge instead); `icon` is a nested `TextureUnion`, not a plain path.

Combine with `UiInputBinding` (the `uiInputBinding` prop on `UiEntity`, see **build-ui**) to build custom on-screen action buttons: hide the native buttons here, then bind the same `InputAction`s to your own scene UI.

For the button priority stack and the "+" overflow rules, custom icons, the raw `createOrReplace` form with per-state icon swaps, adapting the scene HUD with `isMobile()`, and full worked examples, see `{baseDir}/references/touch-screen-controls.md`.

## Mobile considerations

- **Touch only:** no hover states, keyboard shortcuts, right-click or mouse movement (`screenDelta` stays 0). Every action a player needs must be reachable from a tap, an on-screen button, or a scene UI button.
- **On-screen controls are scene-configurable** (SDK 7.26.0+) through `TouchScreenControls` above; their positions are fixed.
- **`InputModifier` on mobile:** app version floors and the `disableAll` caveat are under *InputModifier* → **Clients**.
- Mobile UI sizing, safe area and borders: **build-ui**. Every other mobile gap (`TweenSequence`, Draco GLBs, `AvatarNametag`, colliders, movement) and what each app version supports: `{baseDir}/../sdk-scenes/references/mobile-parity.md`. Flat mobile scene limits: **optimize-scene** → *Mobile Scene Limits*.

## Example scenes

Engine-team test scenes exercising these APIs (ground truth):

- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/0,1-input-modifier — InputModifier standard flags (incl. `disableWalk`/`disableJog`), `getInputCommand(IA_ANY, PET_DOWN)` to read whichever key was pressed (an entity-less call; see *Global Input Checks*).
- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/149,149-synthetic-input-showcase — 2x2-parcel rig of ten stations (S1-S10) exercising the whole synthetic-input surface under the Unity Explorer MCP: walk, camera look, click/hover, key presses, UI text entry and clicks. Source of the root-entity input pattern (references/input-patterns.md), the tall-invisible-`TriggerArea` fix, and the occupancy-recompute `InputModifier` pattern.
- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/33,20-spectate-mode — spectate/free-cam: two-entity `VirtualCamera` rig, `InputModifier disableAll` to freeze the avatar, an `onEnterScene`/`onLeaveScene` roster for cycling follow targets, and full `TouchScreenControls` + `isMobile()` mobile parity (icon swaps per state). Its README documents only the desktop bindings; the mobile handling is in the source.
- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/31,20-pointer-lock-control — writing `PointerLock.isPointerLocked` to request/release cursor capture; `PointerLock.onChange`.
- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/0,5-primary-cursor-info — reading `PrimaryPointerInfo` (screen coords/delta/worldRayDirection) each frame; feeding `worldRayDirection` into a camera raycast.
- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/2,22-virtual-cameras — WASD-driven controllable camera via `isPressed(IA_FORWARD/...)`; toggling InputModifier alongside a VirtualCamera.
- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/0,0-cube-spawner — system-based per-entity click via `getEntitiesWith(Cube, PointerEvents)` + `inputSystem.isTriggered(IA_POINTER, PET_DOWN, entity)`.
- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/32,20-virtual-camera-mouse-look — `PrimaryPointerInfo.screenDelta` driving mouselook camera while pointer locked; shows `screenDelta` continuing to report raw mouse movement during lock (while `screenCoordinates` freezes at screen center).

## References

- `{baseDir}/references/input-patterns.md` — branch-specific worked patterns: Tag-based per-entity input cookbook, root-entity input with a timestamp watermark, cutscene freeze/restore flow, WASD-driven custom entity, action-bar number-key mapping.
- `{baseDir}/references/touch-screen-controls.md` — `TouchScreenControls`: button priority stack and "+" overflow rules, custom button icons, raw form with state-driven icons, mobile HUD adaptation, declutter/full-custom-HUD examples, helper semantics.

For basic pointer events and click handlers, see the `add-interactivity` skill.
