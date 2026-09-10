# AvatarNametag Reference

Companion to the `AvatarNametag` section in `player-avatar/SKILL.md`. Read that first — this file
holds the full field table, the multiplayer roster pattern, and the edge-case behaviors.

## Component

```typescript
import { AvatarNametag, engine } from '@dcl/sdk/ecs'
import type { PBAvatarNametag } from '@dcl/sdk/ecs'
```

- `AvatarNametag: LastWriteWinElementSetComponentDefinition<PBAvatarNametag>` — a plain LWW component.
  No helper functions, no `createOrReplace` wrapper API beyond the standard component methods.
- Component accessor name for composites / `engine.getComponent`: `"core::AvatarNametag"`.
- Protocol `ecs_component_id`: `1221` (`proto/decentraland/sdk/components/avatar_nametag.proto`).

## Fields

| Field             | Type                  | Required | Default when omitted                                |
| ----------------- | --------------------- | -------- | --------------------------------------------------- |
| `label`           | `string`              | yes      | —                                                    |
| `labelColor`      | `Color3 \| undefined` | no       | the client's native nametag **text** color           |
| `backgroundColor` | `Color3 \| undefined` | no       | the client's native nametag **background** color     |
| `borderColor`     | `Color3 \| undefined` | no       | `backgroundColor` — i.e. the plate has no visible border |

```typescript
import { Color3 } from '@dcl/sdk/math'

AvatarNametag.createOrReplace(engine.PlayerEntity, {
	label: 'Club Owner',
	labelColor: Color3.White(),
	backgroundColor: Color3.create(0.47, 0.56, 0.96),
	borderColor: Color3.create(0.78, 0.85, 1),
})
```

Colors are `decentraland.common.Color3` (`r`/`g`/`b` floats, 0–1). There is no alpha channel and no
opacity field.

## `label` behaviors

| Input                              | Result                                                                     |
| ---------------------------------- | -------------------------------------------------------------------------- |
| Normal text                        | Single line. No wrapping.                                                    |
| Very long text                     | Truncated with an ellipsis.                                                  |
| `''` (empty)                       | The plate is drawn with no text — a bare colored pill.                       |
| `'    '` (spaces only)             | Spaces are preserved, so the bare plate is **widened** to that width.        |
| Any text, `labelColor === backgroundColor` | Plate sized exactly to the word, word invisible. Use this instead of a spaces-only label when you want a plate sized to a specific word. |

## Valid target entities

| Entity                                  | Result                     |
| --------------------------------------- | -------------------------- |
| `engine.PlayerEntity` (local player)     | plate rendered              |
| A remote player's entity (has `PlayerIdentityData`) | plate rendered   |
| An entity with `AvatarShape` (NPC)       | plate rendered              |
| Anything else                            | **write silently ignored**  |

## Multiplayer roster pattern

Assign labels deterministically from data every client shares (here: sorted wallet addresses), so
every client computes the same plates without any networking. Re-scan on a throttled system so late
joiners get tagged, and diff before writing so the component is not re-sent every pass.

```typescript
import { engine, Entity, AvatarNametag, PlayerIdentityData } from '@dcl/sdk/ecs'
import type { PBAvatarNametag } from '@dcl/sdk/ecs'
import type { Color3 } from '@dcl/sdk/math'

const ROSTER: PBAvatarNametag[] = [
	{ label: 'Blue', labelColor: { r: 1, g: 1, b: 1 }, backgroundColor: { r: 0.47, g: 0.56, b: 0.96 } },
	{ label: 'Student', labelColor: { r: 1, g: 1, b: 1 }, backgroundColor: { r: 0.1, g: 0.2, b: 0.6 } },
	{ label: 'Janitor', labelColor: { r: 0.05, g: 0.05, b: 0.05 }, backgroundColor: { r: 0.6, g: 0.9, b: 0.6 } },
	{ label: 'Guest', labelColor: { r: 1, g: 1, b: 1 }, backgroundColor: { r: 0.35, g: 0.35, b: 0.35 } },
]

function colorsEqual(a: Color3 | undefined, b: Color3 | undefined): boolean {
	if (a === undefined || b === undefined) return a === b
	return a.r === b.r && a.g === b.g && a.b === b.b
}

function nametagsEqual(existing: PBAvatarNametag | null, desired: PBAvatarNametag): boolean {
	if (existing === null) return false
	return (
		existing.label === desired.label &&
		colorsEqual(existing.labelColor, desired.labelColor) &&
		colorsEqual(existing.backgroundColor, desired.backgroundColor) &&
		colorsEqual(existing.borderColor, desired.borderColor)
	)
}

function applyRoster(): void {
	// Collect FIRST, then mutate. Calling createOrReplace while iterating
	// engine.getEntitiesWith(...) can move the entity to a different archetype and
	// invalidate the live query iterator mid-loop.
	const players: { entity: Entity; address: string }[] = []
	for (const [entity, identity] of engine.getEntitiesWith(PlayerIdentityData)) {
		players.push({ entity, address: identity.address.toLowerCase() })
	}
	// Deterministic order => every client assigns the same labels, regardless of join order.
	players.sort((a, b) => a.address.localeCompare(b.address))

	for (const [index, { entity }] of players.entries()) {
		const desired = ROSTER[index % ROSTER.length]
		if (nametagsEqual(AvatarNametag.getOrNull(entity), desired)) continue
		AvatarNametag.createOrReplace(entity, desired)
	}
}

const INTERVAL = 1 // seconds
let elapsed = 0

engine.addSystem((dt: number) => {
	elapsed += dt
	if (elapsed < INTERVAL) return
	elapsed = 0
	applyRoster()
})
```

Notes on the pattern:

- The periodic re-scan is what handles late joiners — no `onEnterScene` needed, and no bookkeeping
  of which entity belonged to which address.
- The `nametagsEqual` diff matters: without it the scene writes a CRDT message per player per pass.
- Because the entity list is re-read every pass, recycled entity ids are never a problem. Never cache
  a player `Entity` for a later write.
- Do not store per-player state keyed by `Entity`; key it by `PlayerIdentityData.address`.

Adapted from sdk7-test-scenes [`4,24-avatar-nametag`](https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/4,24-avatar-nametag),
`src/modules/multiplayerRoster.ts`.

## Per-player plates from `onEnterScene`

Simpler alternative when the label depends only on the player, not on the roster as a whole:

```typescript
import { onEnterScene, onLeaveScene } from '@dcl/sdk/src/players'
import { AvatarNametag, engine, PlayerIdentityData } from '@dcl/sdk/ecs'

export function main() {
	onEnterScene((player) => {
		AvatarNametag.createOrReplace(player.entity, { label: rankFor(player.userId) })
	})
	// Not strictly required (the entity is torn down on leave), but explicit cleanup keeps the
	// scene honest if it also tracks per-player state.
	onLeaveScene((userId) => {
		/* drop any scene-side state keyed by userId */
	})
}
```

`player.entity` is fresh on every call, so this idiom never touches a stale entity id.

## Interaction with other components

- `AvatarModifierArea` with `AMT_HIDE_NAMETAGS` or `AMT_HIDE_AVATARS` hides the plate together with
  the native nametag. There is no way to keep the plate while hiding the native tag.
- `AvatarShape` with `name: ''` on an NPC: only the plate renders, with no empty native name box
  beneath it. Use this to label an NPC with a title alone.
- `AvatarNametag.deleteFrom(entity)` removes the plate immediately. The native nametag is untouched.

## Sources

- Protocol: `proto/decentraland/sdk/components/avatar_nametag.proto` (`ecs_component_id 1221`).
- SDK: `@dcl/sdk` 7.28.0 (released 2026-09-10). js-sdk-toolchain PR #1600 (merged 2026-09-07, commit `b8264fb`).
- Renderer: unity-explorer `5cb52d6` — "feat: sdk | scene name tag (#9829)", 2026-09-04.
- Test scene: sdk7-test-scenes [`scenes/4,24-avatar-nametag`](https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/4,24-avatar-nametag).
