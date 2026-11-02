# Mobile app feature parity

What the Decentraland mobile app (Godot-based) does differently from the desktop client. Read this before designing anything a scene's progress depends on, when a scene targets mobile, or when something works on desktop and not on a phone. This is the single list; topic skills keep only their own rule and point here.

Scene budgets (triangles, lights, VFX emitters, particles, draw calls) are a separate, flat set: **optimize-scene** → *Mobile Scene Limits*. The source of truth is the Decentraland docs page *Build for mobile › Mobile client › Missing Features*; check it when a design depends on a gap closing.

Mobile players can stay on an old app version (desktop auto-updates; mobile does not), so features below carry the app version that added them. On an older app the feature behaves as a gap: design so the scene still works without it.

## Design rule

No mechanic the player needs may depend on a gap below. A moving platform that is the only way across, a fence made of invisible colliders, or a rank shown only on a nametag plate makes the scene unfinishable or unreadable on a phone. Decorative uses may degrade, as long as the scene still reads without them.

## Not supported

| Feature | What happens on mobile | What to do |
|---|---|---|
| `TweenSequence` | Not implemented: sequenced tweens do not move at all, including the empty-`sequence` looping idiom (it is a `TweenSequence` too). This kills looping platforms, lifts and patrol paths. | Run one plain `Tween` at a time and start the next leg on `tweenSystem.tweenCompleted(entity)`. Recipe: **animations-tweens** → *Tween Sequences*. |
| `AvatarNametag` | No plate is drawn. | Never make the plate the only carrier of information: mirror rank or role in a `TextShape`, a HUD list, or a color the avatar already wears (**player-avatar** → `references/avatar-nametag.md`). |
| Draco-compressed GLB/glTF (`KHR_draco_mesh_compression`) | No runtime Draco decoder. Loads only from the scene's optimized assets (decompressed server-side). With no optimized assets (local preview, Creator Hub mobile preview, QR preview) the model fails to load with no error and no placeholder, so a published scene can look fine while every mobile preview is missing the model. | Export without Draco (**add-3d-models** → *Model Best Practices*). |
| Custom fonts (`fontSrc`) | Ignored; the `font` fallback renders on `TextShape` and UI text. | Pick a fallback that keeps the meaning (**fonts**). |
| `UiBackground` nine-slice | Tiles instead of stretching. | Check nine-sliced panels on a device. |
| Smart Items | Not officially supported. | Keep them off the path a mobile player needs. |
| Client features | Proximity voice chat and point-at-in-world are absent. | Do not design around them. |

## Behaves differently

- **Player movement.** Capsule size, step height, jump arc and gravity, run speed and air control were aligned with the desktop client in a first pass (app 1.15.0; older apps differ more); verify on a device. Slopes, edges, walls, landing, moving platforms and glide still differ. A step, kerb or ledge height tuned until it "just barely" works on desktop may be unclimbable, or climbable when it should not be, on a phone, and the landing point after an impulse or knockback can differ. Give traversal geometry a margin, keep landing areas forgiving, and verify precision platforming on a device (**player-physics**).
- **Colliders thinner than 1 cm collide only from above.** A thin wall, invisible floor plate or paper-thin ramp is walk-through from the side. Give every collider at least 1 cm of thickness.
- **Invisible blockers and some SDK collision layers do not block the player.** Never fence a play area, kill boundary or "stay inside" rule with an invisible collider alone; back it with a `TriggerArea` + `movePlayerTo`, or with geometry the player can see.
- **Spawn, landing and jump animations and movement blending are missing.** The avatar reads stiffer; do not time a mechanic to an animation beat.
- **Emotes from other clients may not play:** scene emotes from Bevy-Web players and Unity players' emotes that arrive over LiveKit.
- **Creator Hub mobile preview:** desktop testers cannot see the mobile player's avatar.
- **Input:** touch only, with no hover states, keyboard shortcuts or right-click (**advanced-input** → *Mobile considerations*).
- **UI interactable area:** reported from app 1.12.1. Older apps report no margins, so `screenInset: 'interactable'` and `InteractableArea` fall back to the whole screen (**build-ui** → `references/ui-components.md` → *InteractableArea*).
- **UI:** the jump / E / F / pointer buttons are drawn over the bottom-right of the interactable area, and taps there go to the client. Keep interactive UI out of that corner and hide the controls behind full-screen panels (**build-ui** → *Placement*).
- **`AudioAnalysis` reads `AudioSource` only** (app 1.14.0+). On an `AudioStream` or `VideoPlayer` it stays at 0, so a stream or video visualizer goes still on a phone. Band values differ from desktop by a constant factor; tune thresholds on both (**audio-analysis**).
- **UI borders:** from app 1.10.1, `borderRadius` and `borderWidth` accept pixels only; percentage values have no effect (desktop accepts both). Older apps draw square corners.
- **`InputModifier`:** works from app 0.50 (`disableDoubleJump` / `disableGliding` from 0.65), but `disableAll` leaves the touch joystick and buttons on screen; hide them with `TouchScreenControls` (**advanced-input**).

## Supported, by app version

Always: `PrimaryPointerInfo`, `AssetLoad`, plain `Tween`.

- **App 1.13.0+:** `ParticleSystem`, `LightSource` (within the mobile light budget), avatar masks (upper-body emotes). Older apps draw no particles or scene lights and play masked emotes full-body.
- **App 1.14.0+:** `AudioEvent`, `AudioAnalysis` on `AudioSource` (see *Behaves differently*), audio volume curves and spatial attenuation, pinch-to-zoom between first and third person. Older apps emit no audio events and leave analysis at 0.
- **App 1.15.0+:** `Tween` `MoveRotateScale` (older apps do not animate it); `stopEmote` (older apps cannot stop a looping scene emote, so never make it the only exit); masked emotes seen as upper-body by other mobile players; correct `hitDistance` on downward player raycasts over sloped geometry; other players' positions (`getPlayer({ userId }).position`, `onEnterScene`, items attached to other players) scene-relative, the same frame as the local player's. Older apps report those positions in world coordinates (**player-avatar** → *Remote players' positions are scene-relative*).
