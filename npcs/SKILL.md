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
import { createNPC, Dialog } from 'dcl-npc-toolkit'
import { Vector3, Quaternion } from '@dcl/sdk/math'

const npcEntity = createNPC(
  { position: Vector3.create(8, 0, 8), rotation: Quaternion.fromEulerDegrees(0, 180, 0) },
  'models/guard.glb',
  (entity) => {
    // called when player clicks the NPC
    startDialogue(entity)
  },
  {
    idleAnim: 'Idle',
    walkingAnim: 'Walk',
    hoverText: 'Talk',
    onlyExternalTrigger: false,
  }
)
```

For full dialogue scripting, movement paths, state machines, and all config options, see **`libraries/npc.mdc`** — it covers:
- Dialogue types (talk, button choices, NPC responses)
- Walking to positions and following paths
- State management (quest giver, guard, shop patterns)
- Multiplayer considerations
- Performance optimization

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
  show_only_wearables: true,
})
```

For the full `AvatarShape` field reference, body shape URNs, and common base wearable URNs, see **`{baseDir}/../../player-avatar/references/avatar-apis.md`**.

---

## Adding interactivity to AvatarShape NPCs

AvatarShape entities don't have built-in click handling. Add it via `pointerEventsSystem` (see **add-interactivity** skill):

```typescript
import { pointerEventsSystem, InputAction } from '@dcl/sdk/ecs'

pointerEventsSystem.onPointerDown(
  { entity: npc, opts: { button: InputAction.IA_POINTER, hoverText: 'Talk' } },
  () => {
    console.log('Player clicked NPC')
  }
)
```
