---
name: multiplayer-sync
description: Peer-to-peer multiplayer in Decentraland using CRDT networking. syncEntity (auto-synced components), parentEntity for synced hierarchies, MessageBus and binary MessageBus (fire-and-forget events), custom component definition with Schemas (Int64, Enum, EnumNumber, OneOf, Optional), and connection state. Use when the user wants multiplayer, synced entities, shared world state, broadcast events, or player-to-player communication without a server. Do NOT use for server-authoritative multiplayer, anti-cheat, or persistent storage (see authoritative-server). Do NOT use for screen UI (see build-ui).
---

# Multiplayer Synchronization in Decentraland

Decentraland runs scenes locally in a player's instance of the explorer. By default, players are able to see each other and interact directly, but each player interacts with the environment independently. Changes in the environment aren't shared between players by default.

To sync any changes in the scene state, SDK7 uses CRDT-based synchronization.

> **Runtime constraint:** Decentraland runs in a QuickJS sandbox. No Node.js APIs (`fs`, `http`, `path`, `process`). Use `fetch()` and `WebSocket` for network communication. See the **scene-runtime** skill for async patterns.

## Sync Strategy Decision Tree

Choose the right networking approach based on what you need:

| Strategy           | Use When                                                             | Persistence                                                                                                                                          | Example                                         |
| ------------------ | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `syncEntity`       | Shared state that all players see and that persists for new arrivals | Yes — state survives player join/leave, but only as long as at least one player remains in the scene. The state resets as soon as the scene is empty | Doors, switches, scoreboards, elevators         |
| `MessageBus`       | Ephemeral events that only matter in the moment                      | No — late joiners miss past messages                                                                                                                 | Chat messages, sound effects, particle triggers |
| `fetch` / REST API | Reading or writing data to an external server                        | Server-dependent                                                                                                                                     | Leaderboards, inventory, external game state    |
| `signedFetch`      | Authenticated requests that prove player identity                    | Server-dependent                                                                                                                                     | Claiming rewards, submitting verified scores    |
| `WebSocket`        | Real-time bidirectional communication with a server                  | Connection-dependent                                                                                                                                 | Live game servers, real-time chat.              |

**Decision flow:**

1. Does every player need to see the same state, including late joiners? --> `syncEntity`
2. Is it a fire-and-forget event only for players currently in the scene? --> `MessageBus`
3. Do you need the information to be persisted even after all players leave, or to run secure validations on that information? --> `fetch` or `signedFetch`
4. Do you need continuous real-time server communication? --> `WebSocket`
5. Combine approaches freely: use `syncEntity` for world state, `MessageBus` for effects, and `fetch` for persistence.

---

## syncEntity Essentials

### Import and Basic Usage

```typescript
import { engine, Transform, MeshRenderer, Material } from '@dcl/sdk/ecs'
import { syncEntity } from '@dcl/sdk/network'
import { Vector3, Color4 } from '@dcl/sdk/math'
```

Signature: `syncEntity(entity, componentIds[], syncId?)`

- `entity` — the entity to synchronize
- `componentIds[]` — array of component IDs to keep in sync (e.g., `[Transform.componentId]`)
- `syncId` — unique numeric identifier (required for predefined entities, optional for player-spawned entities)

### Enum Sync IDs (Predefined Entities)

Every predefined synced entity MUST have a unique numeric ID. Use an enum to avoid collisions:

```typescript
enum SyncIds {
	DOOR = 1,
	ELEVATOR = 2,
	SCOREBOARD = 3,
}

const door = engine.addEntity()
Transform.create(door, { position: Vector3.create(8, 1, 8) })
MeshRenderer.setBox(door)
syncEntity(
	door,
	[Transform.componentId, MeshRenderer.componentId],
	SyncIds.DOOR
)
```

Predefined entities (with a sync ID) persist after the creating player leaves. Player-created entities (no sync ID) are removed when the player disconnects.

### Auto-Generated IDs (Player-Spawned Entities)

Entities created at runtime by players do not need an explicit sync ID:

```typescript
function createProjectile() {
	const projectile = engine.addEntity()
	Transform.create(projectile, { position: Vector3.create(4, 1, 4) })
	MeshRenderer.setSphere(projectile)
	syncEntity(projectile, [Transform.componentId])
	return projectile
}
```

## Custom Synced Components

Define custom components and sync them between players:

```typescript
import { engine, Schemas } from '@dcl/sdk/ecs'
import { syncEntity } from '@dcl/sdk/network'

const ScoreBoard = engine.defineComponent('scoreBoard', {
	score: Schemas.Int,
	playerName: Schemas.String,
	lastUpdated: Schemas.Int64,
})

const board = engine.addEntity()
ScoreBoard.create(board, { score: 0, playerName: '', lastUpdated: 0 })
syncEntity(board, [ScoreBoard.componentId])

function addScore(points: number) {
	const data = ScoreBoard.getMutable(board)
	data.score += points
	data.lastUpdated = Date.now()
}
```

## Player-Specific Data

Use `PlayerIdentityData` to distinguish players:

```typescript
import { engine, PlayerIdentityData } from '@dcl/sdk/ecs'

engine.addSystem(() => {
	for (const [entity] of engine.getEntitiesWith(PlayerIdentityData)) {
		const data = PlayerIdentityData.get(entity)
		console.log('Player:', data.address, 'Guest:', data.isGuest)
	}
})
```

## Schema Types

Available schema types for custom components:

| Type                          | Usage                       |
| ----------------------------- | --------------------------- |
| `Schemas.Boolean`             | true/false                  |
| `Schemas.Int`                 | Integer numbers             |
| `Schemas.Float`               | Decimal numbers             |
| `Schemas.String`              | Text strings                |
| `Schemas.Int64`               | Large integers (timestamps) |
| `Schemas.Vector3`             | 3D coordinates              |
| `Schemas.Quaternion`          | Rotations                   |
| `Schemas.Color3`              | RGB colors                  |
| `Schemas.Color4`              | RGBA colors                 |
| `Schemas.Entity`              | Entity reference            |
| `Schemas.Array(innerType)`    | Array of values             |
| `Schemas.Map(valueType)`      | Key-value maps              |
| `Schemas.Optional(innerType)` | Nullable values             |
| `Schemas.Enum(enumType)`      | Enum values (string enums)  |
| `Schemas.EnumNumber(enumType, default)` | Numeric enum with default value |
| `Schemas.OneOf({ ... })`      | Discriminated union (`$case` + payload) |

Example with the less common schema types:

```typescript
enum Rarity { Common = 0, Rare = 1, Legendary = 2 }

const Loot = engine.defineComponent('game::Loot', {
	rarity: Schemas.EnumNumber<Rarity>(Rarity, Rarity.Common),
	payload: Schemas.OneOf({
		coins: Schemas.Int,
		item: Schemas.String,
	}),
	label: Schemas.Optional(Schemas.String),
})
```

## Parent-Child Sync Relationships

For synced entities with parent-child relationships, use `parentEntity()` instead of setting `Transform.parent`:

```typescript
import {
	syncEntity,
	parentEntity,
	getParent,
	getChildren,
	removeParent,
} from '@dcl/sdk/network'

const parent = engine.addEntity()
const child = engine.addEntity()

syncEntity(parent, [Transform.componentId], 1)
syncEntity(child, [Transform.componentId], 2)

// Use parentEntity() — NOT Transform.parent
parentEntity(child, parent)

const parentRef = getParent(child)
const childrenArray = Array.from(getChildren(parent))

// Remove parent relationship
removeParent(child)
```

## Connection State

Check if the player is connected to the sync room:

```typescript
import { isStateSyncronized } from '@dcl/sdk/network'

engine.addSystem(() => {
	if (!isStateSyncronized()) return // wait for sync
	// safe to read/write synced state
})
```

**Note:** The function is spelled `isStateSyncronized` (not "Synchronized") in the SDK.

---

## MessageBus

Send custom messages between players (fire-and-forget, no persistence):

```typescript
import { MessageBus } from '@dcl/sdk/message-bus'

const bus = new MessageBus()

bus.on('hit', (data: { damage: number }) => {
	console.log('Took damage:', data.damage)
})

bus.emit('hit', { damage: 10 })
```

### syncEntity vs MessageBus

- `syncEntity`: late joiners get current state, automatic conflict resolution. The state persists as long as at least one player remains in the scene
- `MessageBus`: fire-and-forget, late joiners miss past messages, good for transient effects

### Binary MessageBus (Performance Optimization)

The regular `MessageBus` JSON-encodes every payload before sending. For high-frequency messages or large payloads, there's a lower-level binary alternative that sends raw `Uint8Array` data directly — faster to process because it skips JSON serialization on both ends. This is the same transport `syncEntity` uses internally.

Use it when:

- You are emitting many messages per second (e.g., continuous movement streams, particle triggers in tight loops)
- Payload size matters (binary encoding is more compact than JSON)
- You already have binary data (e.g., pre-encoded buffers, CRDT deltas)

Stick with the regular `MessageBus` for low-frequency events where ergonomics beat performance.

```typescript
import { sendBinary } from '~system/CommunicationsController'
import { executeTask } from '@dcl/sdk/ecs'

// Send a binary message to all peers (or a specific subset via peerData)
executeTask(async () => {
	const payload = new Uint8Array([1, 2, 3, 4]) // your encoded data
	const response = await sendBinary({
		data: [payload],
		peerData: undefined, // optional: target specific peers
	})
	// response.data is a Uint8Array[] of messages received from other peers
	for (const incoming of response.data) {
		handleBinaryMessage(incoming)
	}
})
```

You are responsible for encoding/decoding the `Uint8Array` payloads yourself (e.g., with `DataView`, `TextEncoder`/`TextDecoder`, or protobuf). There's no on/emit/topic layer — `sendBinary` is a single call that both sends pending outgoing messages and returns incoming ones, so you typically drive it from a system on each tick.

---

## REST API and Signed Fetch

For communicating with your own backend (leaderboards, game state persistence, player auth), use `fetch` or `signedFetch`. All network calls must run inside `executeTask`. `signedFetch` attaches a cryptographic proof of the player's wallet identity — use it when your server needs to verify who is making the request.

See the **scene-runtime** skill for full `fetch` and `signedFetch` patterns.

---

## WebSocket Connections

For full WebSocket patterns (reconnection, heartbeat, message format), see `{baseDir}/references/networking-patterns.md`.

### Basic Connection

```typescript
executeTask(async () => {
	const ws = new WebSocket('wss://example.com/ws')

	ws.onopen = () => {
		console.log('Connected to WebSocket')
		ws.send(JSON.stringify({ type: 'join', playerId: 'player123' }))
	}

	ws.onmessage = (event) => {
		const msg = JSON.parse(event.data)
		switch (msg.type) {
			case 'gameState':
				handleGameState(msg)
				break
			case 'playerJoin':
				handlePlayerJoin(msg)
				break
			case 'playerLeave':
				handlePlayerLeave(msg)
				break
		}
	}

	ws.onerror = (error) => console.error('WebSocket error:', error)
	ws.onclose = () => console.log('Disconnected')
})
```

---

## Player Enter/Leave Events

Detect players entering or leaving the scene:

```typescript
import { onEnterScene, onLeaveScene } from '@dcl/sdk/src/players'

onEnterScene((player) => {
	console.log('Player entered:', player.userId)
})
onLeaveScene((userId) => {
	console.log('Player left:', userId)
})
```

## Multiplayer Testing

Open multiple browser windows to test multiplayer locally. Each window is a separate player.

### Offline Mode

For Decentraland Worlds that do not need multiplayer:

```json
{
	"worldConfiguration": {
		"fixedAdapter": "offline:offline"
	}
}
```

## Troubleshooting

| Problem                                                  | Cause                                                                  | Solution                                                                                                                                                                                        |
| -------------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Profile not initialized. Call syncEntity inside main()` | `syncEntity` called at module top-level (e.g. in a module initialiser) | Move all `syncEntity` calls (and entity creation that depends on them) into a function called from `main()`. Never call `syncEntity` at module load time. Same applies to `engine.addSystem()`. |
| State not syncing between players                        | Missing `syncEntity()` call                                            | Every entity you want shared must call `syncEntity(entity, [ComponentId1, ComponentId2])`                                                                                                       |
| Sync ID collision                                        | Two entities share the same numeric sync ID                            | Use an enum to assign unique IDs to every predefined synced entity                                                                                                                              |
| `Date.now()` values corrupted                            | Using `Schemas.Number` for timestamps                                  | Use `Schemas.Int64` for any number over 13 digits (like `Date.now()`)                                                                                                                           |
| State not ready on join                                  | Reading synced state before sync completes                             | Guard with `if (!isStateSyncronized()) return` in your system                                                                                                                                   |
| MessageBus messages lost                                 | Late joiner expecting past messages                                    | MessageBus is fire-and-forget. Use `syncEntity` for persistent state                                                                                                                            |

> **Need server-side validation or anti-cheat?** See the **authoritative-server** skill for the headless server pattern.

## Important Notes

- **Entities must be explicitly synced** via `syncEntity(entity, [componentIds])` — pass the `componentId` of each component to sync
- **CRDT resolution**: If two players change the same component simultaneously, last-write-wins
- **No server-side code**: Decentraland scenes run entirely client-side with CRDT sync (unless using the authoritative server)
- **Custom schemas must be deterministic**: Same component name = same schema across all clients
- **Use `Schemas.Int64` for timestamps**: `Schemas.Number` corrupts large numbers (13+ digits). Always use `Schemas.Int64` for values like `Date.now()`
- Any changes in the scene state done with `syncEntity` are not persisted. If all players leave the scene then the next player to come back will find the scene in its default state.
- `syncEntity` and the `messageBus` are not entirely reliable, if it's important that all players see the same state change in the scene, see the `authoritative-server` skill
- For server-authoritative multiplayer with validation and anti-cheat, see the `authoritative-server` skill
