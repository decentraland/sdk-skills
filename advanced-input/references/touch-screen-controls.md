# TouchScreenControls — button layout, icons, worked examples

Details extracted from the `advanced-input` SKILL.md. Read this file when a task needs the button ordering rules, custom button icons, or a full configuration example. The API surface (fields + helpers) stays in SKILL.md.

Available from `@dcl/ecs` **7.26.0**; not present in 7.25.0 or earlier. Component id `1218` (`PBTouchScreenControls`).

## How the button layout works

The gamepad buttons form a single **priority stack** with a fixed order:

1. `IA_JUMP`
2. `IA_POINTER`
3. `IA_PRIMARY` (E)
4. `IA_SECONDARY` (F)
5. `IA_ACTION_3` (1)
6. `IA_ACTION_4` (2)
7. `IA_ACTION_5` (3)
8. `IA_ACTION_6` (4)

The on-screen slots are fixed too. Visible buttons fill those slots from the top of the stack down, so a scene controls *which* buttons are visible and *which one leads* — never their order or their coordinates.

| Action | Result |
| --- | --- |
| Hide a button (any, including `IA_JUMP`) | Every lower-priority button moves up to fill the gap. Hide jump and `IA_POINTER` takes the central spot. |
| Change nothing | `IA_JUMP` is the large central button; the rest fill the surrounding slots in stack order. |
| Set `mainAction` | That action moves to the front of the stack and becomes the central button; the others keep their relative order. |
| Set `mainAction` on a button that is also hidden | Hiding wins — the button stays hidden. |
| Leave 5 or fewer buttons visible | All show directly (central button + up to 4 around it); no "+" overflow toggle. |
| Leave more than 5 buttons visible | The "+" takes the last slot: 4 show directly (central + 3), the rest sit behind the "+" overflow. |

This is also how to surface the `1`/`2`/`3`/`4` buttons (`IA_ACTION_3`..`IA_ACTION_6`), which otherwise sit behind the "+": hide enough higher-priority buttons to bring the visible count to five or fewer.

Source: Decentraland docs `creator/sdk7/interactivity/touch-screen-controls.md`. Not independently confirmed against the client implementation.

## Custom button icons

`icon` on a `touchInputs` entry replaces the button glyph with a scene image. It is a `TextureUnion`; use the `texture` variant with a content-mapped `src` (a file shipped in the scene):

```typescript
import { engine, TouchScreenControls, InputAction } from '@dcl/sdk/ecs'

TouchScreenControls.createOrReplace(engine.RootEntity, {
  hideJoystick: false,
  hideCrosshair: true,
  mainAction: InputAction.IA_PRIMARY,
  touchInputs: [
    {
      inputAction: InputAction.IA_PRIMARY,
      hide: false,
      icon: { tex: { $case: 'texture', texture: { src: 'images/grab.png' } } }
    }
  ]
})
```

- Only scene-content paths — not external URLs, `avatarTexture`, or `videoTexture`.
- If the path cannot be resolved, the built-in glyph is used (silent fallback).
- On `IA_JUMP` the icon replaces **all** of that button's dynamic states (jump / double-jump / glide), so one static image covers all three.

## Worked example — declutter and re-icon

Hide the joystick, tuck away the numbered buttons (dropping the visible count to 4, which removes the "+"), and give the central jump button a scene image:

```typescript
import { engine, TouchScreenControls, InputAction } from '@dcl/sdk/ecs'

export function main() {
  TouchScreenControls.createOrReplace(engine.RootEntity, {
    hideJoystick: true,
    hideCrosshair: false,
    touchInputs: [
      { inputAction: InputAction.IA_ACTION_3, hide: true },
      { inputAction: InputAction.IA_ACTION_4, hide: true },
      { inputAction: InputAction.IA_ACTION_5, hide: true },
      { inputAction: InputAction.IA_ACTION_6, hide: true },
      {
        inputAction: InputAction.IA_JUMP,
        hide: false,
        icon: { tex: { $case: 'texture', texture: { src: 'images/banana.png' } } }
      }
    ]
  })
}
```

## Worked example — full custom touch UI

Clear the native controls entirely, then draw scene UI in their place (see the `build-ui` skill). Field-tested 2026-08-15 on production mobile client `1.12.1`: joystick, crosshair, and all eight gamepad buttons hidden as documented.

```typescript
import { engine, TouchScreenControls, InputAction } from '@dcl/sdk/ecs'

TouchScreenControls.create(engine.RootEntity, {
  hideJoystick: true,
  hideCrosshair: true,
  touchInputs: [
    InputAction.IA_POINTER,
    InputAction.IA_PRIMARY, // the E button
    InputAction.IA_SECONDARY, // the F button
    InputAction.IA_JUMP,
    InputAction.IA_ACTION_3,
    InputAction.IA_ACTION_4,
    InputAction.IA_ACTION_5,
    InputAction.IA_ACTION_6
  ].map((inputAction) => ({ inputAction, hide: true }))
})
```

Equivalent with helpers (they merge into the existing value, so order does not matter):

```typescript
TouchScreenControls.hideAll()
TouchScreenControls.hideJoystick()
TouchScreenControls.hideCrosshair()
```

Hiding the joystick removes the only native way to walk on mobile — replace it, or leave the scene unwalkable on purpose (a fixed-camera minigame). Gate this behind `isMobile()` only if the scene's desktop path differs; on desktop the component is a no-op either way.

## Helper semantics (verified in `dist/components/extended/TouchScreenControls.js`, 7.26.1)

All helpers read the current `RootEntity` value, mutate a copy, and `createOrReplace` it — safe to call from anywhere, any number of times.

- `hide(actions)` merges per-action: an existing entry for that action keeps its `icon` and only flips `hide` to `true`.
- `hideAll()` is `hide(ALL_BUTTONS)` over the eight gamepad actions.
- `showAll()` sets `touchInputs` to `[]` — it does not flip `hide` to `false`. **Any custom `icon` set through `touchInputs` is discarded.** Re-apply icons after calling it.
- `showAll()` never touches `hideJoystick` / `hideCrosshair`; use `showJoystick()` / `showCrosshair()`.
- No helper clears `mainAction`; `setMainAction` only sets it. To go back to the default central button, write the component directly with `mainAction` omitted.
