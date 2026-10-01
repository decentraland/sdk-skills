# How the Creator Hub UI editor behaves

What the UI Designer writes into the scene and what its canvas shows, so hand-written code matches it. Verified against creator-hub `docs/UIDesigner.md` and the implementing commits (`35cd6fa7`, `33134497`, `30207181`, `abb88456`, `6753eda9`, `379aa27e`, `75ad6f5e`, `66758e1c`). The editor is stable and always on in Creator Hub 0.50.0+; the only gate is `@dcl/sdk` 7.26.0+ (`MIN_SDK_VERSION` in `UIDesigner/SdkUpgradeNotice`).

## Saving

Every visual edit is spliced into the `.tsx` on the spot; the badge reads **"All changes saved"** and there is no manual save. There is no separate document to keep in sync — treat the file as live while the editor is open. A 1 s disk watcher reflects external edits back onto the canvas.

## Layout model: two independent axes

| Axis | Panel control | Property written |
|---|---|---|
| Flow | **Flow** (row / column / **Free**) | `flexDirection` only. **Free means no `flexDirection` at all** — the key is absent, not set to a "free" value |
| Escape from flow | **Ignore Layout Flow** | `positionType` (`'absolute'`) |

Consequences worth writing code around:

- A newly dropped child is seeded `positionType: 'absolute'` **only if its parent is Free**, and it lands at the drop point (`position: { top, left }` from the rounded coordinates). Under a row/column parent it joins the flow instead.
- **Roots are always absolute.**
- **Switching a parent to Free pins every existing child** at its measured position, in one batched edit. Expect a diff that adds `positionType` / `position` to children you did not touch.

## Widget presets

The **Full Screen** widget inserts `uiTransform={{ flexGrow: 1, alignSelf: 'stretch' }}` with **no `width`/`height`** — deliberately not `100%` × `100%`, because `100%` reads back as a Percent unit rather than Fill, and two `100%` siblings overflow Yoga's free space. Under a Free parent it uses the absolute variant instead (`positionType: 'absolute'` with `top/right/bottom/left: 0`). If you hand-write a full-screen wrapper the editor will edit, use the same pair. (And remember the pointer rule: never put an interaction spread on a full-screen wrapper — `SKILL.md` → **Pointer blocking**.)

## Scene Inset

A root-only dropdown that wraps the top-level roots in `<ScreenInsetArea>`, `<InteractableArea>`, or nothing, in the generated `src/ui/index.tsx`. Default is `device`. This is the same setting as the renderer's `screenInset` option, applied structurally in the source — and because the generated `setUiRenderer` passes no options, the renderer's own default `'device'` inset applies underneath it (`SKILL.md` → **The aggregator**). The panel labels and the SDK values they write:

| Panel label | `screenInset` value written |
| --- | --- |
| **Device Safe Area** | `device` — only offered on the mobile platform preset |
| **Interactable Safe Area** | `interactable` — renamed from "Gameplay Safe Area" in creator-hub `fbca1dca` |
| **Full Screen** | `none` |

The **values are unchanged** — a rename of the label only. Emit `screenInset: 'interactable'` regardless of which label the user quotes at you. The property panel's own help text (still using the old label): "Full Screen uses the entire renderable screen. Gameplay Safe Area excludes game-native UI such as chat, minimap and HUD indicators. Device Safe Area (mobile only) excludes physical constraints such as the notch, Dynamic Island and system bars. Requires @dcl/react-ecs 7.26.0+ in your scene."

## Opacity, not Transparency

The style field was renamed **Opacity** and reads as a percentage, default **100%** (100% opaque, 0% transparent). Older notes calling it "Transparency" are stale — "Transparency" now survives only in the unrelated material inspector.

## Canvas affordances

Artboard framing kicks in when the root has a fixed **px** width **and** height (both in points); the snap grid is **10px** and **Shift overrides** it; tool modes are **Free / Move / Resize** (Free combines drag-move and resize handles; the rotate button exists but is disabled).

## Mode persistence

The 2D/3D mode is stored **per scene in `.editor/project.json`** as `uiDesignerOpen`, **not in the composite**. Do not look for it in `inspector::UIState` — that field was removed. `.editor/project.json` is editor state, not scene content.

## Bevy renderer

Under the Bevy renderer, opening 2D mode **freezes the scene** (and resumes on returning to 3D if it had been running). Expect no ticks while the user is laying out UI on Bevy — a driver's clock does not advance.

## The mobile preview

Switching the canvas to **mobile** frames the UI inside a **phone body with a landscape notch**, at `1600x720` — the same virtual canvas react-ecs uses on mobile, so `fitScale` is 1 and there is **no letterbox**. Desktop stays `1920x1080`. Other screens are selectable (mobile: `1600x720` DCL reference, `2340x1080` 19.5:9, `2048x1536` 4:3; desktop: `1920x1080`, `2560x1080` ultrawide, `1440x900`), and a non-default preset does letterbox.

The canvas draws two guide areas, matching the renderer `screenInset` in use, plus a toggleable set of **reference HUD controls** (joystick, jump, F/E, emote, profile, chat, compass, counter, pointer) drawn as non-interactive discs. The HUD toggle is the game-controller button in the canvas zoom pill (mobile only); it shows by default in the safe-area modes and is hidden by default in full-screen.

What this means when you author:

- **`interactable` excludes the LEFT HUD column only.** It shares its **right** edge with the device area, so the bottom-right action cluster (jump / E / F / pointer) sits *inside* the interactable area by design — an element anchored bottom-right competes with those buttons even under `screenInset: 'interactable'`. Use the HUD guides to place around them.
- **Overflow past the safe-area outline is shown, not clipped** — deliberately, because that is also what happens in-world (`ScreenInsetArea` / `InteractableArea` set no `overflow`). Content spilling past the outline is a placement warning to fix, not a rendering artifact.
- **The preview's inset numbers are a static approximation** (iPhone 14 Pro landscape: device area ~86% wide, interactable ~65% wide, 6% top/bottom margin), not live values. In-world the explorer reports the real `UiCanvasInformation.screenInsetArea` / `interactableArea` per tick. **The emitted react-ecs source is identical either way** — a wrong-looking preview is never a codegen bug, and a correct-looking one does not prove the layout on a given device.

## MobileHUD panel

Rules for agents are in `SKILL.md` → **MobileHUD**. What the panel exposes: `hideJoystick`, `hideCrosshair`, `mainAction` (default `IA_JUMP`), and per-button `{ hide, icon }` for `IA_JUMP`, `IA_POINTER`, `IA_PRIMARY` (E), `IA_SECONDARY` (F), `IA_ACTION_3`–`IA_ACTION_6` (1–4). "Hide Input Actions" is derived (every action hidden), not a stored field. Icons are **scene images only** — no external URL, avatar or video texture. There is no drag-reorder: the explorer renders buttons in a fixed priority order and only `mainAction` promotes one to the central slot.

The generated `src/mobile-hud.ts` emits **every required `PBTouchScreenControls` field, including zero values**, because `createOrReplace` takes the full protobuf message rather than a `Partial`. Omitting a default there is a `TS2741` compile error — the opposite of react-ecs authoring props, where omitting a default is correct. Resetting every field, or deleting the last GUI, removes the module *and* strips the `src/index.ts` wiring.
