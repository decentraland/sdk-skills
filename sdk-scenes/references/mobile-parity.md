# Mobile app feature parity

What the Decentraland mobile app (Godot-based) does differently from the desktop client. Read this before designing anything a scene's progress depends on, when a scene targets mobile, or when something works on desktop and not on a phone. This is the single list; topic skills keep only their own rule and point here.

Scene budgets (triangles, lights, VFX emitters, particles, draw calls) are a separate, flat set: **optimize-scene** → *Mobile Scene Limits*. The source of truth is the Decentraland docs page *Build for mobile › Mobile client › Missing Features*; check it when a design depends on a gap closing.

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

- **Player movement.** Capsule size, step height, jump arc and gravity, run speed and air control were aligned with the desktop client in a first pass; verify on a device. Slopes, edges, walls, landing, moving platforms and glide still differ. A step, kerb or ledge height tuned until it "just barely" works on desktop may be unclimbable, or climbable when it should not be, on a phone, and the landing point after an impulse or knockback can differ. Give traversal geometry a margin, keep landing areas forgiving, and verify precision platforming on a device (**player-physics**).
- **Colliders thinner than 1 cm collide only from above.** A thin wall, invisible floor plate or paper-thin ramp is walk-through from the side. Give every collider at least 1 cm of thickness.
- **Invisible blockers and some SDK collision layers do not block the player.** Never fence a play area, kill boundary or "stay inside" rule with an invisible collider alone; back it with a `TriggerArea` + `movePlayerTo`, or with geometry the player can see.
- **Spawn, landing and jump animations and movement blending are missing.** The avatar reads stiffer; do not time a mechanic to an animation beat.
- **Emotes from other clients may not play:** scene emotes from Bevy-Web players and Unity players' emotes that arrive over LiveKit.
- **Creator Hub mobile preview:** desktop testers cannot see the mobile player's avatar.
- **Input:** touch only, with no hover states, keyboard shortcuts or right-click (**advanced-input** → *Mobile considerations*).
- **UI:** the jump / E / F / pointer buttons are drawn over the bottom-right of the interactable area, and taps there go to the client. Keep interactive UI out of that corner and hide the controls behind full-screen panels (**build-ui** → *Placement*).
- **`AudioAnalysis` reads `AudioSource` only.** On an `AudioStream` or `VideoPlayer` it stays at 0, so a stream or video visualizer goes still on a phone. Band values differ from desktop by a constant factor; tune thresholds on both (**audio-analysis**).

## Supported (no special handling)

`ParticleSystem`, `PrimaryPointerInfo`, `AssetLoad`, `LightSource` (within the mobile light budget), `Tween` including `MoveRotateScale`, `AudioEvent`, `AudioAnalysis` on `AudioSource` (see *Behaves differently*), audio volume curves and spatial attenuation, avatar masks (upper-body emotes, seen as upper-body by other mobile players), `stopEmote`, pinch-to-zoom between first and third person, and correct `hitDistance` on downward player raycasts over sloped geometry. Other players' positions (`getPlayer({ userId }).position`, `onEnterScene`, items attached to other players) are scene-relative, the same frame as the local player's.
