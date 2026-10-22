---
name: npcs
description: "Create NPCs (non-player characters) in Decentraland scenes. Two approaches: the NPC Toolkit library (dcl-npc-toolkit) for GLB NPCs with dialogue, movement, and state machines; and AvatarShape for avatar-look NPCs in wearables, including custom label plates above their name (AvatarNametag). Use when the user wants to add an NPC, shopkeeper, or quest giver — any non-player entity with behavior or dialogue. For live player data (position, profile, wearables) see player-avatar instead."
---

# NPCs in Decentraland

Two approaches — choose based on what the NPC needs to do:

| Approach | Use when |
|---|---|
| **NPC Toolkit** (`dcl-npc-toolkit`) | GLB model, needs dialogue, walking, state machine behavior |
| **AvatarShape** | Needs to look like a Decentraland avatar (wearables, expressions) |

---

## Approach 1 — NPC Toolkit (GLB-based)

The toolkit handles dialogue UI, movement along paths, animations, and interaction out of the box.

**Install:**
```bash
npm i dcl-npc-toolkit
```

**Basic usage:**
```typescript
import * as npc from 'dcl-npc-toolkit'
import { Vector3, Quaternion } from '@dcl/sdk/math'

const dialogs: npc.Dialog[] = [{ text: 'Hello there!', isEndOfDialog: true }]

const npcEntity = npc.create(
  { position: Vector3.create(8, 0, 8), rotation: Quaternion.fromEulerDegrees(0, 180, 0) },
  {
    type: npc.NPCType.CUSTOM,
    model: { src: 'models/guard.glb' },
    idleAnim: 'Idle',
    walkingAnim: 'Walk',
    hoverText: 'Talk',
    onlyExternalTrigger: false,
    onActivate: () => {
      // called when player activates the NPC
      npc.talk(npcEntity, dialogs)
    },
  }
)
```

For full dialogue scripting, movement paths, state machines, and all config options, see **`{baseDir}/references/npc-library.mdc`** — it covers:
- Dialogue types (talk, button choices, NPC responses)
- Walking to positions and following paths
- State management (quest giver, guard, shop patterns)
- Multiplayer considerations
- Performance optimization

### Gotchas (NPC Toolkit)

- **Button labels are visually truncated.** Dialog button labels render with `textWrap: 'nowrap'` in a fixed-width slot (default font 16, slot ~217px scaled). Anything past ~15 characters is silently clipped — no ellipsis. Use short labels like `"Yes"`, `"No thanks"`, `"Tell me more"`, `"Decline"`. Avoid full sentences and trailing punctuation (e.g. `"I'm not interested."` renders as `"I'm not interes"`). To fit longer text, drop `fontSize` (e.g. 12) or set `size` on the button. See `references/npc-library.mdc` "ButtonData fields".
- Opening dialogs on an entity not created via `npc.create` requires `addDialog(entity)` and a minimal `npcDataComponent.set(entity, ...)` — see reference for the full setup.
- Speech bubbles need `createDialogBubble(entity)` before `talkBubble`. Bubbles do not render question buttons; questions are HUD-only.

- **`createDialogWindow()` crashes the dialog UI unless you also set `npcDataComponent`.** Symptom: `"Cannot read properties of undefined (reading 'theme')"` when the window opens. Why (verified against `dcl-npc-toolkit/dist`): `createDialogWindow(portrait, sound)` only calls `addDialog(...)` (sets `npcDialogComponent`); it does NOT set `npcDataComponent`. `openDialogWindow` then sets `activeNPC`, the `npcDialogComponent` guard (`isActiveNpcSet()`) passes, and `getTheme()` reaches `npcDataComponent.get(activeNPC).theme` — undefined on a standalone window. NPCs built with `create()`/`createNPC` have `npcDataComponent` set, so they never hit this. **Fix — after `createDialogWindow`, set `npcDataComponent` with a valid theme and the minimal fields:**

  ```typescript
  import { createDialogWindow } from 'dcl-npc-toolkit'
  import { npcDataComponent } from 'dcl-npc-toolkit/dist/npc'
  import { lightTheme } from 'dcl-npc-toolkit/dist/ui'

  const window = createDialogWindow(portrait, sound)
  npcDataComponent.set(window, {
    introduced: false, inCooldown: false, coolDownDuration: 5,
    faceUser: undefined, walkingSpeed: 2, walkingAnim: undefined,
    pathData: undefined, currentPathData: [], manualStop: false,
    pathIndex: 0, state: 'standing', idleAnim: 'Idle', hasBubble: false,
    turnSpeed: 2, theme: lightTheme, bubbleXOffset: 0, bubbleYOffset: 0,
    lastPlayedAnim: 'Idle', volume: 0.5,
  })
  ```

- **`faceUser: true` — do NOT parent a fixed-world object to a `faceUser` NPC.** Why (verified — `dcl-npc-toolkit/dist/faceUserSystem.js`): `faceUser` rewrites the NPC entity's `Transform.rotation` every frame (via `TrackUserFlag` + `faceUserSystem`) to look at the player. Any child placed at a local offset inherits that rotation and **orbits** the NPC as the player moves, landing in unintended places (behind a door, occluded, unclickable). Fix: spawn such objects **unparented at a computed world position** (derive a stable world spot from a non-rotating reference like a door, plus the NPC's position). The same caveat applies to any entity whose Transform you rotate every frame.

- **dcl-npc-toolkit must be statically imported from the entry point.** The toolkit calls `engine.defineComponent(...)` at module-load time. `engine.defineComponent` throws `"Engine is already sealed. No components can be added at this stage"` if it runs after the engine seals (verified — `@dcl/ecs/dist/engine/index.js`). A dynamic `await import('./client-setup')` defers that registration past the seal point. So any module that imports the toolkit must be reached via a **static** `import` from `index.ts` — not loaded later via `await import()`. In an authoritative-server scene, keep the client setup (which imports the toolkit) static and dynamically import only the server-only branch. See [[authoritative-server]].

---

## Approach 2 — AvatarShape (Decentraland avatar look)

Create an NPC that looks like a Decentraland player avatar, dressed in any wearables.

```typescript
import { engine, Transform, AvatarShape } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

const npc = engine.addEntity()
Transform.create(npc, { position: Vector3.create(8, 0, 8) })

AvatarShape.create(npc, {
  id: 'npc-1',               // unique identifier (required)
  name: 'Guard',             // display name shown above head
  bodyShape: 'urn:decentraland:off-chain:base-avatars:BaseMale', // or BaseFemale
  wearables: [
    'urn:decentraland:off-chain:base-avatars:eyebrows_00',
    'urn:decentraland:off-chain:base-avatars:mouth_00',
    'urn:decentraland:off-chain:base-avatars:eyes_00',
    'urn:decentraland:off-chain:base-avatars:blue_tshirt',
    'urn:decentraland:off-chain:base-avatars:brown_pants',
    'urn:decentraland:off-chain:base-avatars:classic_shoes',
    'urn:decentraland:off-chain:base-avatars:short_hair',
  ],
  hairColor: { r: 0.92, g: 0.76, b: 0.62 }, // RGB 0–1
  skinColor: { r: 0.94, g: 0.85, b: 0.6 },
})
```

**Notes:**
- Always include eyebrows, mouth, and eyes wearables — the avatar won't render face features without them.
- `id` is required and must be unique per AvatarShape entity.
- Set `name: ''` (empty string) to suppress the name tag above the NPC's head.
- Moving the `Transform` position causes the NPC to walk/run to the destination (it does not teleport). This mutation DOES take effect — unlike the read-only player `Transform`. You can also drive movement with `Tween` (`Tween.Mode.Move`) + `TweenSequence` for scripted paths; the avatar plays its walk animation along the tween. For an NPC that continuously chases the player (or another moving target), use `Tween.setMoveContinuous` — do NOT re-create `setMove` tweens every frame, which causes visible jitter. See the **animations-tweens** skill ("PITFALL — a CONSTANTLY changing target") and the [`79,-4-tween-following-cube`](https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/79,-4-tween-following-cube) test scene.
- Use `expressionTriggerTimestamp` as a Lamport timestamp to replay the same emote: first play = 0, second play = 1, etc.
- **Clone the current player's look:** read `getPlayer()` and pass `userData.wearables` and `userData.emotes` straight into `AvatarShape.create`. `getPlayer()` may return null / empty emotes on the first frames — poll in a system until `userData.emotes.length > 0` before spawning (verified pattern in test scene 4,21).

### Label plate above the NPC's name (`AvatarNametag`)

`AvatarNametag` works on any entity with an `AvatarShape`, not just on players. Attach it to the same entity:

```typescript
import { AvatarNametag } from '@dcl/sdk/ecs'

AvatarNametag.create(npcEntity, { label: 'Shopkeeper' })
```

- `name: ''` on the `AvatarShape` shows **only** the plate, with no empty native name box under it — label an NPC with a title alone.
- `label` is required but may be whitespace-only. `label: '    '` draws a bare colored plate with no text (more spaces = wider plate) — e.g. a team-color badge with no title.
- `labelColor`, `backgroundColor`, `borderColor` are optional `Color3` fields that fall back to the native nametag colors.
- Not implemented on mobile — mobile players see the NPC without a plate, so keep the title visible some other way (e.g. a `TextShape`) if it matters.

Field table, edge cases, and gotchas: **player-avatar** skill ("Custom Nametag Plates") and `{baseDir}/../player-avatar/references/avatar-nametag.md`.

### Playing expressions on an AvatarShape NPC

```typescript
AvatarShape.getMutable(npc).expressionTriggerId = 'wave'
AvatarShape.getMutable(npc).expressionTriggerTimestamp = 1
```

`expressionTriggerId` accepts either a **built-in emote name** (`'robot'`, `'wave'`, ...) OR a **scene-emote `.glb` path** (e.g. `'animations/Snowball_Throw_emote.glb'`) — the same `_emote.glb`-suffixed files used with `triggerSceneEmote`. This is how you play a custom emote on an NPC (there is no `triggerSceneEmote` equivalent for AvatarShape entities). To cycle through the player's own emotes, set `expressionTriggerId = userData.emotes[i]`.

**Before authoring a custom clip for an NPC pose (sit, idle variant), check the embedded emotes first.** The Explorer ships 21 emotes that `expressionTriggerId` accepts by name; the sitting ones **loop** and hold the pose with no re-trigger (verified in-world on an `AvatarShape`, SDK 7.30.1, 2026-10-12). Full list with ids and loop flags (single source of truth): `{baseDir}/../avatar-animations/references/embedded-emotes.md`. A built-in sit often reads more naturally than a hand-authored one. Next, the Creator Hub's Avatar Animations pack has 45 downloadable `_emote.glb` clips (stools, puffs, bean bags, ledges, chess, fishing, drinking, crafting…) that `expressionTriggerId` plays by file path — catalogued with previews in `{baseDir}/../avatar-animations/references/animation-catalog.md`. Only author a custom clip (**avatar-animations**) when neither fits.

Note: replaying the **same** `expressionTriggerId` value back-to-back requires bumping `expressionTriggerTimestamp`; setting a **different** id each time replays without touching the timestamp.

**Custom clips do not loop on an `AvatarShape`.** The Explorer builds every scene-emote request for an `AvatarShape` with `loop: false` regardless of the clip's own flag (`AvatarShapeHandlerSystem`, with the comment "looping scene emotes on SDK AvatarShapes is not supported yet" — unity-explorer main 2026-10). Only the embedded looping emotes above hold a pose. Authoring an emote, looping it on the live player via `triggerSceneEmote({ loop: true })`, and triggering it on an `AvatarShape` are three different playback paths. For a sustained custom pose: author one long static clip and retrigger it shortly before it ends by bumping `expressionTriggerTimestamp`. Verify the seam in-world — the retrigger has not been checked for visible snapping.

**Hiding an `AvatarShape` is not a position change.** Moving it out of sight (e.g. 60 m underground) makes it *walk* there, visibly, because the Explorer interpolates AvatarShape movement (see "Moving the NPC cancels the emote"). What worked: set `Transform.scale` to near zero (`0.001`) and restore it afterwards (in-world, Unity Explorer 0.186, 2026-10; `VisibilityComponent` on an `AvatarShape` was not tested). Primitives, GLBs, `AvatarShape`, nametags, lights and colliders each hide differently — do not assume one "hide this entity" recipe covers all of them.

**Moving the NPC cancels the emote.** Writing the `AvatarShape`'s `Transform.position`, or running a `Tween` on it, while an emote plays drops the emote and the avatar falls back to its walk cycle — the Explorer re-derives the locomotion blend from the per-frame Transform delta on every frame (`SDKAvatarShapesMotionSystem.UpdateAnimations`, verified against unity-explorer `Explorer/Assets/DCL/Character/CharacterMotion/Systems/SDKAvatarShapesMotionSystem.cs`; symptom owner-reported, behaviour observed in-world, Unity Explorer v0.186.0-alpha, SDK 7.30.1, 2026-10-10). To move an NPC **during** an emote — sink through the floor while screaming, slump sideways — bake the translation into the clip as root/hips motion inside the `_emote.glb`; the Explorer plays that back on an `AvatarShape` (in-world observation, same build/date).

**No masked emotes on NPCs.** `mask?: AvatarMask` (upper-body only) exists only on `TriggerSceneEmoteRequest`, i.e. the player's own `triggerSceneEmote`; `PBAvatarShape` has no mask field, so `expressionTriggerId` is always full-body. Verified against `@dcl/protocol` `decentraland/kernel/apis/restricted_actions.gen.d.ts` and `@dcl/ecs` `decentraland/sdk/components/avatar_shape.gen.d.ts` (7.30.1).

Owner-reported in the same session, **not verified** — confirm before designing around it: the **first** `expressionTriggerId` pointing at a scene `_emote.glb` shows a visible delay on an NPC (clip load); playing it once on an off-screen `AvatarShape` at scene start to warm the cache was tried as a workaround, with unconfirmed effect.

### Copies of the player

A lookalike of the player — a line-up of "you", a clone posing in a shop, a twin that waves back — is an `AvatarShape` fed from live `getPlayer()` data (field mapping in **player-avatar**, clone bullet above), so it wears whatever the player wears.

**An `AvatarShape` cannot be puppeted frame by frame.** Its locomotion is engine-driven (`SDKAvatarShapesMotionSystem.cs`, unity-explorer main 2026-10): each frame it walks from where it is toward the authored `Transform.position` at 4 m/s, or 10 m/s once the target is more than 1.5 m away, and it **turns to face its direction of travel** (slerp, 6.5/s); the authored rotation is only applied once it has arrived. A `Tween` on the entity's position suppresses the engine move and a `Tween` on its rotation suppresses the auto-facing, but an entity holds one `Tween`, so you cannot own both. Feeding it the player's mirrored position therefore gives a double that trails at walking pace and spins round when the player backs up — owner-reported on a mirror double, 2026-10-09 ("delay makes it feel super weird", "walking backwards makes it look the other way"), after both a per-frame `Transform` write and a continuous move tween at the mirrored velocity. For a mirror double, a shadow, a replay ghost or anything that must match the player's pose every frame, use a **rigged humanoid GLB** with an `Animator` (idle / walk clips switched from the player's speed) and write its `Transform` directly each frame. It will not wear the player's look; that is the trade. Catalog mannequins: **add-3d-models** → `references/model-catalog.md` (search `mannequin`, `character`).

**What a copy can visibly differ in** is decided by wearable *categories*, which you can read from the catalyst:

```
https://peer.decentraland.org/lambdas/collections/wearables?wearableId=<urn>&wearableId=<urn>
```

Each entry returns `data.category`, `data.hides`, `data.replaces` and `data.representations[].overrideHides` / `.overrideReplaces` (verified with curl 2026-10-12: `urn:decentraland:off-chain:base-avatars:red_bandana` → `category: "tiara"`, `replaces: ["mask","hat","helmet"]`). Use it to pick swaps that will actually show.

Owner-reported in the same session, **not source-verified** — treat as leads, confirm in-world before designing around them:

- A worn **skin** replaces the whole body, so added wearables, hair, skin colour and eye colour do not show on the copy.
- A **helmet** hides hair, headwear, earrings, eyewear and beard.
- `AvatarShape` cannot force a hidden wearable to render.

**Fallback that always shows:** vary the copy's `Transform` scale — e.g. taller `1.07`, shorter `0.93`, broader `1.10`. It is independent of wearables and reads instantly in a line-up.

### Mannequin mode (show wearables without a body)

Useful for storefronts and wearable displays:

```typescript
AvatarShape.create(mannequin, {
  id: 'mannequin-1',
  name: 'Display',
  wearables: ['urn:decentraland:matic:collections-v2:0x...:0'],
  showOnlyWearables: true,
})
```

For the full `AvatarShape` field reference, body shape URNs, and common base wearable URNs, see **`{baseDir}/../player-avatar/references/avatar-apis.md`**.

---

## Adding interactivity to AvatarShape NPCs

AvatarShape entities are **not clickable** — they have no collider, so pointer events won't register on them directly. To let players interact with an AvatarShape NPC, use one of these approaches:

### Option A — Add a MeshCollider for click interaction

Attach an invisible collider to the same entity so `pointerEventsSystem` can detect clicks (see **add-interactivity** skill):

```typescript
import { MeshCollider, pointerEventsSystem, InputAction } from '@dcl/sdk/ecs'

// invisible cylinder collider roughly matching avatar size.
// Pointer clicks require the CL_POINTER collider layer; MeshCollider defaults to
// all layers (which includes CL_POINTER), so an explicit layer is optional here.
// If you set a layer, include ColliderLayer.CL_POINTER or clicks won't register.
MeshCollider.setCylinder(npc)

pointerEventsSystem.onPointerDown(
  { entity: npc, opts: { button: InputAction.IA_POINTER, hoverText: 'Talk' } },
  () => {
    console.log('Player clicked NPC')
  }
)
```

### Option B — Proximity-based interaction

Trigger the interaction when the player walks near the NPC instead of requiring a click:

```typescript
import { engine, Transform } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

const INTERACT_DISTANCE = 4

engine.addSystem(() => {
  const playerPos = Transform.get(engine.PlayerEntity).position
  const npcPos = Transform.get(npc).position
  const dist = Vector3.distance(playerPos, npcPos)
  if (dist < INTERACT_DISTANCE) {
    // start dialogue or other interaction
  }
})
```

---

## Example scenes

Engine-team test scenes for the `AvatarShape` approach (exercised against the real engine):

- [4,20-avatar-shape](https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/4,20-avatar-shape) — spawn AvatarShape NPCs with base-avatar wearables and with on-chain collection wearable URNs; `name: ''` to hide the name tag.
- [4,19-avatar-shape-movement](https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/4,19-avatar-shape-movement) — moving an AvatarShape by mutating its `Transform` (walks to target) and by `Tween`/`TweenSequence`; an `AvatarAttach` box on the NPC's hand via its `id`.
- [4,21-avatar-shape-emotes](https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/4,21-avatar-shape-emotes) — clone the local player onto an NPC using `getPlayer().wearables` / `.emotes`, then cycle emotes via `expressionTriggerId`.
- [4,22-avatar-shape-scene-emotes](https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/4,22-avatar-shape-scene-emotes) — play custom scene emotes on an NPC by setting `expressionTriggerId` to an `_emote.glb` path.

These are `AvatarShape`-only scenes; they do not use `dcl-npc-toolkit`.
