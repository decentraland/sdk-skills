# Networking Patterns Reference

## WebSocket Connection Patterns

### Basic Connection

```typescript
import { executeTask } from '@dcl/sdk/ecs'

executeTask(async () => {
	const ws = new WebSocket('wss://example.com/ws')

	ws.onopen = () => {
		console.log('Connected to WebSocket')
		ws.send('Hello Server!')
	}

	ws.onmessage = (event) => {
		console.log('Received:', event.data)
	}

	ws.onerror = (error) => {
		console.error('WebSocket error:', error)
	}

	ws.onclose = () => {
		console.log('Disconnected from WebSocket')
	}
})
```

### Reconnection with Exponential Backoff

```typescript
import { executeTask, timers } from '@dcl/sdk/ecs'

executeTask(async () => {
	let ws: WebSocket | null = null
	let reconnectAttempts = 0
	const maxReconnectAttempts = 5

	function connect() {
		ws = new WebSocket('wss://example.com/ws')

		ws.onopen = () => {
			console.log('Connected')
			reconnectAttempts = 0
		}

		ws.onclose = () => {
			if (reconnectAttempts < maxReconnectAttempts) {
				reconnectAttempts++
				timers.setTimeout(connect, 1000 * reconnectAttempts) // exponential backoff
			}
		}

		ws.onerror = (error) => {
			console.error('WebSocket error:', error)
		}
	}

	connect()
})
```

### Heartbeat Pattern

Send periodic pings to keep the connection alive:

```typescript
import { timers } from '@dcl/sdk/ecs'

ws.onopen = () => {
	const heartbeat = timers.setInterval(() => {
		if (ws?.readyState === WebSocket.OPEN) {
			ws.send(JSON.stringify({ type: 'ping' }))
		} else {
			timers.clearInterval(heartbeat)
		}
	}, 30000) // every 30 seconds
}
```

### JSON Message Format Convention

Use a `type` field for structured communication:

```typescript
// Send
ws.send(JSON.stringify({ type: 'playerMove', position: { x: 8, y: 1, z: 8 } }))

// Receive and dispatch
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
```

## fetch / signedFetch Error Handling

### Robust fetch Pattern

```typescript
import { executeTask } from '@dcl/sdk/ecs'

executeTask(async () => {
	try {
		const response = await fetch('https://api.example.com/data')
		if (!response.ok) {
			console.error('HTTP error:', response.status)
			return
		}
		const data = await response.json()
		// use data
	} catch (error) {
		console.error('Network error:', error)
	}
})
```

### POST Request

```typescript
executeTask(async () => {
	try {
		const response = await fetch('https://api.example.com/submit', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ username: 'player123', score: 1500 }),
		})
		const result = await response.json()
		console.log('Submission result:', result)
	} catch (error) {
		console.log('Submission failed:', error)
	}
})
```

### signedFetch for Authenticated Requests

`signedFetch` attaches a cryptographic signature proving the player's identity. Your backend can verify this signature to authenticate requests.

```typescript
import { signedFetch } from '~system/SignedFetch'

executeTask(async () => {
	try {
		const response = await signedFetch({
			url: 'https://example.com/api/claim',
			init: {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'claimReward', amount: 100 }),
			},
		})
		if (!response.ok) {
			console.error('HTTP error:', response.status)
			return
		}
		const result = JSON.parse(response.body)
		console.log('Claim result:', result)
	} catch (error) {
		console.log('Claim failed:', error)
	}
})
```

## MessageBus Typed Payloads

Define types for message data to keep code safe:

```typescript
import { MessageBus } from '@dcl/sdk/message-bus'

type SpawnMessage = {
	position: { x: number; y: number; z: number }
	entityEnumId: number
}

type ChatMessage = {
	// No sender field: anything in the payload is written by the sending client
	text: string
	timestamp: number
}

const bus = new MessageBus()

bus.on('spawn', (message: SpawnMessage) => {
	const entity = engine.addEntity()
	Transform.create(entity, {
		position: Vector3.create(
			message.position.x,
			message.position.y,
			message.position.z
		),
	})
})

bus.on('chat', (msg: ChatMessage, sender: string) => {
	// Use the sender the callback receives, never an address inside the payload.
	// Your own emit() is delivered locally with sender 'self', not your address.
	console.log(`[${sender}]: ${msg.text}`)
})
```

Every field of a `MessageBus` payload is chosen by the client that sent it. Don't put a player's address in the payload and act on it (claiming a seat, releasing someone else's): a modified client can name anyone. Use the `sender` argument for display, and move anything that matters (seats, scores, ownership) to a server.

## Architecture Patterns

### Optimistic Updates

Apply changes locally immediately, then let sync propagate. With `syncEntity`, local mutations are shown instantly while the SDK handles replication:

```typescript
// Player clicks a door — update locally, sync handles the rest
Transform.getMutable(door).rotation = Quaternion.fromEulerDegrees(0, 90, 0)
```

### Authority Models

- **Decentralized (syncEntity):** Any player can mutate synced components. Good for simple shared objects.
- **Authoritative server (WebSocket):** Server validates and broadcasts state. Use for competitive games, economies, or anti-cheat.
- **Hybrid:** Use `syncEntity` for world objects, WebSocket for game logic validation.

### syncEntity identity: stable IDs vs auto IDs

How `syncEntity` assigns network identity (verified against `@dcl/sdk/network/entities.js`):

- `syncEntity(entity, componentIds)` — **auto/runtime ID.** Network identity = the creating peer's `profile.networkId` + that peer's **local engine entity number**. The engine RECYCLES local entity numbers after `removeEntity`, so this identity is per-peer and reused over time.
- `syncEntity(entity, componentIds, MY_ENUM_ID)` — **stable ID.** Pins `networkId = 0`, `entityId = MY_ENUM_ID`. Identical across all clients. Create the entity once and reuse it: the ID stays taken after `removeEntity` (gotcha below).

**Failure mode (auto ID + short-lived singleton).** A singleton synced entity that is destroyed and recreated repeatedly (e.g. once per round/phase) with an auto ID is fragile over real network comms — latency, message reordering, server cold-starts. It works flawlessly in local preview because preview uses a single in-process transport with no loss. On a remote client the short-lived runtime entity can fail to reconcile and stay absent/invisible for that client for its entire lifetime; there is no later resync that re-creates it. Long-lived persistent runtime entities tolerate this because they reconcile eventually.

Symptom signature:
- The entity's component data never appears on remote clients (anything reading it — UI, visuals — shows defaults).
- A separately-created **persistent** synced entity in the same scene syncs fine.
- Never reproduces in single-process local preview.

**Best practice.** For any singleton or small fixed set of well-known synced entities (a global game/match-state entity, a single shared cursor/placeholder, etc.), assign each a STABLE explicit sync ID via the third arg, drawn from a central reserved `enum`. Reserve auto IDs only for genuinely dynamic, many-instance, create-and-forget entities (and note even those can be fragile if short-lived + frequently recreated).

```typescript
enum SyncId {
	GAME_STATE = 1,
	SHARED_CURSOR = 2,
}

// `defaults`: the initial values of your own GameState component
function spawnGameState() {
	const e = engine.addEntity()
	GameState.create(e, defaults)
	syncEntity(e, [GameState.componentId], SyncId.GAME_STATE) // call once; never remove + recreate with this id
}
```

**Gotcha — a fixed ID cannot be reused after `removeEntity`.** `engine.removeEntity` deletes every component except the internal `NetworkEntity` (it skips `core-schema::Network-Entity`), and on the peer that removed the entity nothing clears it afterwards: the CRDT system only cleans up after DELETE_ENTITY messages received from another peer. `syncEntity` with an explicit `entityEnumId` THROWS `syncEntity failed because the id provided is already in use` while a `NetworkEntity` with that ID exists, so recreating with the same ID fails however many ticks have passed (Node test on `@dcl/ecs` and local server log, 2026-11-16/17). For a fixed-ID singleton that comes and goes (a round timer, a build ghost, a flag), create it once and reuse it: reset its components and mark it inactive (an empty owner field, parked out of view) instead of removing it.

```typescript
// Create once; "remove" = reset + mark inactive, "respawn" = reactivate.
// `SyncId` and `defaults` are the ones from the snippet above;
// `active` is a field of your own GameState schema.
const gameState = engine.addEntity()
GameState.create(gameState, defaults)
syncEntity(gameState, [GameState.componentId], SyncId.GAME_STATE)

function endRound() {
	GameState.createOrReplace(gameState, { ...defaults, active: false })
}
function startRound() {
	GameState.getMutable(gameState).active = true
}
```

### Client-side prediction for tool/editor-style input

When a client drives a synced entity through client→server messages and then waits for the round-tripped sync to render the result, the local user sees laggy/blind feedback (and nothing at all if the synced entity isn't reconciling). Standard fix — **optimistic local prediction + authoritative reconcile**:

- For the entity's OWN controlling client: render from a LOCAL prediction that mirrors the server's mutation logic exactly (seeded from the same defaults), applied immediately on input.
- For all other clients: render purely from the synced entity.

This keeps the acting player's feedback instant while the authoritative state still arrives via sync for everyone.

### Multiplayer Testing

Running two local clients (second desktop instance, or desktop + browser): **multiplayer-sync** SKILL.md → *Multiplayer Testing*.

```typescript
// Track active players
function multiplayerTestSystem() {
	const players = Array.from(engine.getEntitiesWith(PlayerIdentityData))
	console.log(`Active players: ${players.length}`)

	players.forEach(([entity, playerData]) => {
		const transform = Transform.getOrNull(entity)
		if (transform) {
			console.log(`Player ${playerData.address} at:`, transform.position)
		}
	})
}
engine.addSystem(multiplayerTestSystem)
```
