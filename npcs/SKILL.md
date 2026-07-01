---
name: npcs
description: Create NPCs (non-player characters) in Decentraland scenes. Two approaches: the NPC Toolkit library (dcl-npc-toolkit) for GLB-based NPCs with built-in dialogue, movement, and state machines; and AvatarShape for avatar-look NPCs dressed in wearables. Use when the user wants to add an NPC, character, shopkeeper, quest giver, guard, or any non-player entity with behavior or dialogue. For live player data (position, profile, wearables) see player-avatar instead.
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

For full dialogue scripting, movement paths, state machines, and all config options, see **`libraries/npc.mdc`** — it covers:
- Dialogue types (talk, button choices, NPC responses)
- Walking to positions and following paths
- State management (quest giver, guard, shop patterns)
- Multiplayer considerations
- Performance optimization

### Gotchas (NPC Toolkit)

- **Button labels are visually truncated.** Dialog button labels render with `textWrap: 'nowrap'` in a fixed-width slot (default font 16, slot ~217px scaled). Anything past ~15 characters is silently clipped — no ellipsis. Use short labels like `"Yes"`, `"No thanks"`, `"Tell me more"`, `"Decline"`. Avoid full sentences and trailing punctuation (e.g. `"I'm not interested."` renders as `"I'm not interes"`). To fit longer text, drop `fontSize` (e.g. 12) or set `size` on the button. See `references/npc-library.mdc` "ButtonData fields".
- Opening dialogs on an entity not created via `createNPC` requires `addDialog(entity)` and a minimal `npcDataComponent.set(entity, ...)` — see reference for the full setup.
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
- Moving the `Transform` position causes the NPC to walk/run to the destination (it does not teleport).
- Use `expressionTriggerTimestamp` as a Lamport timestamp to replay the same emote: first play = 0, second play = 1, etc.

### Playing expressions on an AvatarShape NPC

```typescript
AvatarShape.getMutable(npc).expressionTriggerId = 'wave'
AvatarShape.getMutable(npc).expressionTriggerTimestamp = 1
```

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

For the full `AvatarShape` field reference, body shape URNs, and common base wearable URNs, see **`{baseDir}/../../player-avatar/references/avatar-apis.md`**.

---

## Adding interactivity to AvatarShape NPCs

AvatarShape entities are **not clickable** — they have no collider, so pointer events won't register on them directly. To let players interact with an AvatarShape NPC, use one of these approaches:

### Option A — Add a MeshCollider for click interaction

Attach an invisible collider to the same entity so `pointerEventsSystem` can detect clicks (see **add-interactivity** skill):

```typescript
import { MeshCollider, pointerEventsSystem, InputAction } from '@dcl/sdk/ecs'

// invisible cylinder collider roughly matching avatar size
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
