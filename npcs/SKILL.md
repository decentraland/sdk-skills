---
name: npcs
description: "Create NPCs in Decentraland: GLB characters with dialogue, paths and state via dcl-npc-toolkit, or avatar-look NPCs with AvatarShape (wearables, emotes, copies of the player). Use for shopkeepers, guards, quest givers, any non-player character. For the live player see player-avatar."
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
    model: { src: 'assets/Models/guard.glb' },
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

For full dialogue scripting, movement paths, state machines, and all config options, see **`{baseDir}/references/npc-library.md`** — it covers:
- Dialogue types (talk, button choices, NPC responses)
- Walking to positions and following paths
- State management (quest giver, guard, shop patterns)
- Multiplayer considerations
- Performance optimization

### Gotchas (NPC Toolkit)

- **Button labels are clipped at about 15 characters** with no ellipsis. Use short labels (`"Yes"`, `"No thanks"`, `"Tell me more"`); for longer text drop `fontSize` or set `size` on the button. Details: `{baseDir}/references/npc-library.md` → ButtonData fields.
- **Opening dialogs on an entity not created via `npc.create`** needs `addDialog(entity)` plus a minimal `npcDataComponent.set(entity, ...)`; a standalone `createDialogWindow()` needs the same or its UI crashes on `reading 'theme'`. Setup code: `{baseDir}/references/npc-library.md` → Toolkit Dialog UI vs Bubble UI.
- Speech bubbles need `createDialogBubble(entity)` before `talkBubble`. Bubbles do not render question buttons; questions are HUD-only.
- **`faceUser: true` — place fixed-world objects unparented, beside the NPC.** `faceUser` rewrites the NPC entity's `Transform.rotation` every frame (via `TrackUserFlag` + `faceUserSystem`) to look at the player. Any child placed at a local offset inherits that rotation and **orbits** the NPC as the player moves, landing in unintended places (behind a door, occluded, unclickable). Fix: spawn such objects **unparented at a computed world position** (derive a stable world spot from a non-rotating reference like a door, plus the NPC's position). The same caveat applies to any entity whose Transform you rotate every frame.

- **dcl-npc-toolkit must be statically imported from the entry point.** The toolkit calls `engine.defineComponent(...)` at module-load time. `engine.defineComponent` throws `"Engine is already sealed. No components can be added at this stage"` if it runs after the engine seals. A dynamic `await import('./client-setup')` defers that registration past the seal point. So any module that imports the toolkit must be reached via a **static** `import` from `index.ts`. In an authoritative-server scene, keep the client setup (which imports the toolkit) static and dynamically import only the server-only branch. See **authoritative-server**.

---

## Approach 2 — AvatarShape (Decentraland avatar look)

Create an NPC that looks like a Decentraland player avatar, dressed in any wearables.

```typescript
import { engine, Transform, AvatarShape } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

const npc = engine.addEntity()
Transform.create(npc, { position: Vector3.create(8, 0, 8) })

AvatarShape.create(npc, {
  id: 'guard-0001',          // unique; its last 4 characters show beside the name
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
- `id` is required and must be unique per AvatarShape entity. **The Explorer prints the last 4 characters of `id` after the name**, in faded text, the way an unclaimed player name shows its address. An NPC has no profile, so it always gets the suffix and no field turns it off: `id: 'guard-1'` with `name: 'Guard'` renders as "Guard" with a faded "rd-1" appended. Choose ids whose last four characters look intentional, such as `guard-0001` (an id shorter than 4 characters shows `0000`). The only way to lose the suffix is to drop the whole tag.
- Set `name: ''` (empty string) to suppress the name tag above the NPC's head, suffix included.
- Moving the `Transform` position causes the NPC to walk/run to the destination (it does not teleport). This mutation DOES take effect — unlike the read-only player `Transform`. You can also drive movement with `Tween` (`Tween.Mode.Move`) + `TweenSequence` for scripted paths; the avatar plays its walk animation along the tween. For an NPC that continuously chases the player (or another moving target), use `Tween.setMoveContinuous`; re-creating `setMove` tweens every frame jitters. See the **animations-tweens** skill ("PITFALL — a CONSTANTLY changing target") and the [`79,-4-tween-following-cube`](https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/79,-4-tween-following-cube) test scene.
- Use `expressionTriggerTimestamp` as a Lamport timestamp to replay the same emote: first play = 0, second play = 1, etc.
- **Clone the current player's look:** read `getPlayer()` and pass `userData.wearables` and `userData.emotes` straight into `AvatarShape.create`. `getPlayer()` may return null / empty emotes on the first frames — poll in a system until `userData.emotes.length > 0` before spawning (test scene 4,21).

### Label plate above the NPC's name (`AvatarNametag`)

`AvatarNametag` works on any entity with an `AvatarShape`, not just on players. Attach it to the same entity:

```typescript
import { AvatarNametag } from '@dcl/sdk/ecs'

AvatarNametag.create(npcEntity, { label: 'Shopkeeper' })
```

- `name: ''` on the `AvatarShape` shows **only** the plate, with no empty native name box under it — label an NPC with a title alone.

Field table, edge cases, and gotchas: **player-avatar** skill ("Custom Nametag Plates") and `{baseDir}/../player-avatar/references/avatar-nametag.md`.

### Playing expressions on an AvatarShape NPC

```typescript
AvatarShape.getMutable(npc).expressionTriggerId = 'wave'
AvatarShape.getMutable(npc).expressionTriggerTimestamp = 1
```

`expressionTriggerId` accepts either a **built-in emote name** (`'robot'`, `'wave'`, ...) OR a **scene-emote `.glb` path** (e.g. `'animations/Snowball_Throw_emote.glb'`) — the same `_emote.glb`-suffixed files used with `triggerSceneEmote`. This is how you play a custom emote on an NPC (there is no `triggerSceneEmote` equivalent for AvatarShape entities). To cycle through the player's own emotes, set `expressionTriggerId = userData.emotes[i]`.

**Before authoring a custom clip for an NPC pose (sit, idle variant), check the embedded emotes first.** The Explorer ships 21 emotes that `expressionTriggerId` accepts by name; the sitting ones **loop** and hold the pose with no re-trigger. Full list with ids and loop flags (single source of truth): `{baseDir}/../avatar-animations/references/embedded-emotes.md`. A built-in sit often reads more naturally than a hand-authored one. Next, the Creator Hub's Avatar Animations pack has 45 downloadable `_emote.glb` clips (stools, puffs, bean bags, ledges, chess, fishing, drinking, crafting…) that `expressionTriggerId` plays by file path — catalogued with previews in `{baseDir}/../avatar-animations/references/animation-catalog.md`. Only author a custom clip (**avatar-animations**) when neither fits.

Note: replaying the **same** `expressionTriggerId` value back-to-back requires bumping `expressionTriggerTimestamp`; setting a **different** id each time replays without touching the timestamp.

**AvatarShape playback limits** (mechanisms and workarounds: `{baseDir}/references/avatar-shape-npcs.md`):

- **Custom clips do not loop** on an `AvatarShape`; only the embedded looping emotes hold a pose. For a sustained custom pose, retrigger a long clip before it ends.
- **Moving the NPC cancels its emote** (Transform write or `Tween`). Bake travel during an emote into the `_emote.glb` as root motion.
- **Hide it by scaling to `0.001`**, not by moving it away: a moved `AvatarShape` visibly walks there.
- **No masked (upper-body) emotes**: `expressionTriggerId` is always full-body.

### Copies of the player

A lookalike of the player — a line-up of "you", a clone posing in a shop, a twin that waves back — is an `AvatarShape` fed from live `getPlayer()` data (field mapping in **player-avatar**, clone bullet above), so it wears whatever the player wears.

- **An `AvatarShape` cannot be puppeted frame by frame:** the engine walks it toward the authored position and turns it to face its travel. For a mirror double, shadow or replay ghost, use a rigged humanoid GLB with an `Animator` and write its `Transform` each frame.
- **What a copy can visibly differ in** is decided by wearable categories (readable from the catalyst); scaling the copy (`1.07`, `0.93`, `1.10`) always shows.

Details for both: `{baseDir}/references/avatar-shape-npcs.md`.

### Mannequin mode (show wearables without a body)

Useful for storefronts and wearable displays:

```typescript
AvatarShape.create(mannequin, {
  id: 'mannequin-0001',
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

Trigger the interaction when the player walks near the NPC, with a native `TriggerArea` on a child entity (the area's size is its `Transform.scale`, so scaling the NPC entity itself would scale the avatar):

```typescript
import { engine, Transform, TriggerArea, triggerAreaEventsSystem } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

const zone = engine.addEntity()
Transform.create(zone, { parent: npc, scale: Vector3.create(8, 8, 8) }) // ~4 m radius
TriggerArea.setSphere(zone)

triggerAreaEventsSystem.onTriggerEnter(zone, (result) => {
  if (result.trigger?.entity !== engine.PlayerEntity) return // local player only
  // start dialogue or other interaction (fires once per entry)
})
```

Full TriggerArea reference: **add-interactivity** → Trigger Areas.

---

## Example scenes

Engine-team test scenes for the `AvatarShape` approach (exercised against the real engine):

- [4,20-avatar-shape](https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/4,20-avatar-shape) — spawn AvatarShape NPCs with base-avatar wearables and with on-chain collection wearable URNs; `name: ''` to hide the name tag.
- [4,19-avatar-shape-movement](https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/4,19-avatar-shape-movement) — moving an AvatarShape by mutating its `Transform` (walks to target) and by `Tween`/`TweenSequence`; an `AvatarAttach` box on the NPC's hand via its `id`.
- [4,21-avatar-shape-emotes](https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/4,21-avatar-shape-emotes) — clone the local player onto an NPC using `getPlayer().wearables` / `.emotes`, then cycle emotes via `expressionTriggerId`.
- [4,22-avatar-shape-scene-emotes](https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/4,22-avatar-shape-scene-emotes) — play custom scene emotes on an NPC by setting `expressionTriggerId` to an `_emote.glb` path.

These are `AvatarShape`-only scenes; they do not use `dcl-npc-toolkit`.
