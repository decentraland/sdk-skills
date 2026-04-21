---
name: authoritative-server
description: Build multiplayer Decentraland scenes with a headless authoritative server. Covers isServer() branching, registerMessages() for client-server communication, validateBeforeChange() for server-only state, Storage (world and player persistence), EnvVar (environment variables), and project structure. Use when the user wants authoritative multiplayer, anti-cheat, server-side validation, persistent storage, or server messages. Do NOT use for basic CRDT multiplayer without a server (see multiplayer-sync).
---

# Authoritative Server Pattern

**IMPORTANT**: The authoritative server is feature in BETA. Always notify the user and ask them if they want to proceed in using this feature before adding it to the scene.

**IMPORTANT — deployment constraint**: The authoritative server currently only works on scenes published to **Worlds**, NOT to LAND parcels in Genesis City. If a world has multiple scenes, only one of them can have an authoritative server. Both limitations will be lifted in the future, but today you must deploy to a World.

Build multiplayer Decentraland scenes where a **headless server** controls game state, validates changes, and prevents cheating. The same codebase runs on both server and client, with the server having full authority.

Decentraland hosts and deploys the server for you automatically when you publish the scene — no extra hosting or setup.

For basic CRDT multiplayer (no server), see the `multiplayer-sync` skill instead.

## Setup

### 1. Install the auth-server SDK branch (MANDATORY)

You **must** use the `auth-server` tag — the standard `@dcl/sdk` does NOT include authoritative server APIs (`isServer`, `registerMessages`, `Storage`, `EnvVar`, etc.):

```bash
npm install @dcl/sdk@auth-server
npm install @dcl/js-runtime@auth-server
```

### 2. Configure scene.json

Optionally add `logsPermissions` to list wallet addresses that can see `console.log()` from the server. The listed users can then view server logs in production by running `npx sdk-commands sdk-server-logs`.

```json
{
	"worldConfiguration": {
		"name": "my-world-name.dcl.eth"
	},
	"logsPermissions": ["0xYourWalletAddress"]
}
```

### 3. Run the scene

Just use the normal preview — when using the auth-server branch of the SDK, the preview automatically starts a local version of the authoritative server in the background.

> **Debugging note (do NOT tell the user to run this):** Under the hood, the preview runs `npx @dcl/hammurabi-server@next`. If the auth server isn't starting, check that the hammurabi process is running and look for errors in its output.

## Server/Client Branching

Use `isServer()` to branch logic in a single codebase:

```typescript
import { isServer } from '@dcl/sdk/network'

export async function main() {
	if (isServer()) {
		// Server-only: game logic, validation, state management
		const { server } = await import('./server/server')
		server()
		return
	}

	// Client-only: UI, input, message sending
	setupClient()
	setupUi()
}
```

The server runs your scene code headlessly (no rendering). It has access to all player positions via `PlayerIdentityData` and manages all authoritative game state.

## Synced Components with Validation

Define custom components that sync from server to all clients. **Always** use `validateBeforeChange()` to prevent clients from modifying server-authoritative state.

`validateBeforeChange()` only has meaning on the server — **always guard calls with `isServer()`**. On the client the call is a no-op. If the validator returns `true`, the change is accepted and propagated; if `false`, the change is rejected and reverted for the sender.

Every incoming value includes a `senderAddress` field: the wallet address of whoever attempted the change. When the sender is the server, this equals `AUTH_SERVER_PEER_ID`.

### Validation Patterns

**Pattern 1 — Server-only writes** (strictest; use for scores, game phase, spawned entities):

```typescript
Score.validateBeforeChange((v) => v.senderAddress === AUTH_SERVER_PEER_ID)
```

**Pattern 2 — Validate the value itself** (e.g. reject impossible positions):

```typescript
if (isServer()) {
	Transform.validateBeforeChange(entity, (value) => {
		return value.position.y > 0 // reject anything at or below ground
	})
}
```

**Pattern 3 — Proximity validation** (anti-cheat: player must be near the object to interact):

```typescript
if (isServer()) {
	Transform.validateBeforeChange(pickableEntity, (value) => {
		for (const [playerEntity, identity] of engine.getEntitiesWith(
			PlayerIdentityData
		)) {
			if (identity.address.toLowerCase() !== value.senderAddress.toLowerCase())
				continue
			const playerTransform = Transform.getOrNull(playerEntity)
			const objectTransform = Transform.getOrNull(pickableEntity)
			if (!playerTransform || !objectTransform) return false
			return (
				Vector3.distance(playerTransform.position, objectTransform.position) <=
				5
			)
		}
		return false // sender not among connected players
	})
}
```

Always compare addresses with `.toLowerCase()` — wallet addresses may arrive in mixed casing.

**Pattern 4 — Admin-only writes** (use for VideoPlayer, scene moderation, etc.):

```typescript
import { isServer, isPreview } from '@dcl/sdk/network'
import { getSceneAdmins } from '@dcl/sdk/server'

if (isServer()) {
	let adminAddresses = new Set<string>()

	async function updateAdminAddresses() {
		if (isPreview()) return
		const [error, response] = await getSceneAdmins()
		if (error) {
			adminAddresses = new Set()
			return
		}
		adminAddresses = new Set((response ?? []).map((a) => a.admin.toLowerCase()))
	}
	await updateAdminAddresses()

	VideoPlayer.validateBeforeChange(videoEntity, (value) => {
		if (isPreview()) return true // always allow in local preview
		return adminAddresses.has(value.senderAddress.toLowerCase())
	})
}
```

Use `isPreview()` (from `@dcl/sdk/network`) to relax validation during local development so testing stays frictionless.

### Custom Components (Global Validation)

```typescript
import { engine, Schemas } from '@dcl/sdk/ecs'
import { AUTH_SERVER_PEER_ID } from '@dcl/sdk/network/message-bus-sync'

export const GameState = engine.defineComponent('game:State', {
	phase: Schemas.String,
	score: Schemas.Number,
	timeRemaining: Schemas.Number,
})

// Restrict ALL modifications to server only
GameState.validateBeforeChange((value) => {
	return value.senderAddress === AUTH_SERVER_PEER_ID
})
```

### Built-in Components (Per-Entity Validation)

For built-in components like `Transform` and `GltfContainer`, use per-entity validation so you don't block client-side transforms on the player's own entities:

```typescript
import { Entity, Transform, GltfContainer } from '@dcl/sdk/ecs'
import { AUTH_SERVER_PEER_ID } from '@dcl/sdk/network/message-bus-sync'

type ComponentWithValidation = {
	validateBeforeChange: (
		entity: Entity,
		cb: (value: { senderAddress: string }) => boolean
	) => void
}

function protectServerEntity(
	entity: Entity,
	components: ComponentWithValidation[]
) {
	for (const component of components) {
		component.validateBeforeChange(entity, (value) => {
			return value.senderAddress === AUTH_SERVER_PEER_ID
		})
	}
}

// Usage: after creating a server-managed entity
const entity = engine.addEntity()
Transform.create(entity, { position: Vector3.create(10, 5, 10) })
GltfContainer.create(entity, { src: 'assets/model.glb' })
protectServerEntity(entity, [Transform, GltfContainer])
```

### Syncing Entities

After creating and protecting an entity, sync it to all clients:

```typescript
import { syncEntity } from '@dcl/sdk/network'

syncEntity(entity, [Transform.componentId, GameState.componentId])
```

## Messages

Use `registerMessages()` for client-to-server and server-to-client communication:

### Define Messages

```typescript
import { Schemas } from '@dcl/sdk/ecs'
import { registerMessages } from '@dcl/sdk/network'

export const Messages = {
	// Client -> Server
	playerJoin: Schemas.Map({ displayName: Schemas.String }),
	playerAction: Schemas.Map({
		actionType: Schemas.String,
		data: Schemas.Number,
	}),

	// Server -> Client
	gameEvent: Schemas.Map({
		eventType: Schemas.String,
		playerName: Schemas.String,
	}),
}

export const room = registerMessages(Messages)
```

### Send Messages

```typescript
// Client sends to server
room.send('playerJoin', { displayName: 'Alice' })

// Server sends to ALL clients
room.send('gameEvent', { eventType: 'ROUND_START', playerName: '' })

// Server sends to ONE client
room.send(
	'gameEvent',
	{ eventType: 'YOU_WIN', playerName: 'Alice' },
	{ to: [playerAddress] }
)
```

### Receive Messages

```typescript
// Server receives from client
room.onMessage('playerJoin', (data, context) => {
	if (!context) return
	const playerAddress = context.from // Wallet address of sender
	console.log(`[Server] Player joined: ${data.displayName} (${playerAddress})`)
})

// Client receives from server
room.onMessage('gameEvent', (data) => {
	console.log(`Event: ${data.eventType}`)
})
```

### Wait for State Sync

Before sending messages from the client, wait until state is synchronized:

```typescript
import { isStateSyncronized } from '@dcl/sdk/network'

engine.addSystem(() => {
	if (!isStateSyncronized()) return

	// Safe to send messages now
	room.send('playerJoin', { displayName: 'Player' })
})
```

### Schema Types Reference

All message payloads and custom components use `Schemas` for binary serialization:

```typescript
// Basic
Schemas.String // "hello"
Schemas.Int // 42
Schemas.Float // 3.14
Schemas.Bool // true / false
Schemas.Int64 // use for Date.now() / 13+ digit numbers — Schemas.Number corrupts these

// Vectors
Schemas.Vector3
Schemas.Quaternion

// Complex
Schemas.Entity // entity reference
Schemas.Array(Schemas.String) // typed array
Schemas.Optional(Schemas.String) // value or undefined
Schemas.Map({ name: Schemas.String, hp: Schemas.Int }) // nested object
```

**Messages MUST be defined with `Schemas.Map(...)`** — plain JS objects will fail binary serialization.

## Server Reading Player Positions

The server can read **actual** player positions — critical for anti-cheat:

```typescript
import { engine, PlayerIdentityData, Transform } from '@dcl/sdk/ecs'

engine.addSystem(() => {
	for (const [entity, identity] of engine.getEntitiesWith(PlayerIdentityData)) {
		const transform = Transform.getOrNull(entity)
		if (!transform) continue

		const address = identity.address
		const position = transform.position
		// Use actual server-verified position, not client-reported data
	}
})
```

Never trust client-reported positions. Always read `PlayerIdentityData` + `Transform` on the server.

## Storage

Persist data across server restarts. **Server-only** — guard with `isServer()`.

```typescript
import { Storage } from '@dcl/sdk/server'
```

### World Storage (Global)

Shared across all players:

```typescript
// Store
await Storage.world.set('leaderboard', JSON.stringify(leaderboardData))

// Retrieve
const data = await Storage.world.get<string>('leaderboard')
if (data) {
	const leaderboard = JSON.parse(data)
}

// Delete
await Storage.world.delete('oldKey')
```

### Player Storage (Per-Player)

Keyed by player wallet address:

```typescript
// Store
await Storage.player.set(playerAddress, 'highScore', String(score))

// Retrieve
const saved = await Storage.player.get<string>(playerAddress, 'highScore')
const highScore = saved ? parseInt(saved) : 0

// Delete
await Storage.player.delete(playerAddress, 'highScore')
```

Storage only accepts strings. Use `JSON.stringify()`/`JSON.parse()` for objects and `String()`/`parseInt()` for numbers.

Local development storage is at `node_modules/@dcl/sdk-commands/.runtime-data/server-storage.json`.

### Managing Live Storage Data

View and edit production storage at **[decentraland.org/storage](https://decentraland.org/storage)** (also reachable via Creator Hub → Manage → three-dot menu on a published place → "View server data"):

- **Scene tab**: all world-level variables — edit or delete with pencil/trash icons
- **Player tab**: per-player data searchable by address or name — useful for diagnosing stuck player state and restoring them to a stable state

Storage is persisted at the location level — it is NOT wiped between scene version deploys.

You can also manage scene storage via the command line, using `npx sdk-commands storage scene`:

```bash
# Set a value
npx sdk-commands storage scene set high_score --value 100

# Get a value
npx sdk-commands storage scene get high_score

# Delete a value
npx sdk-commands storage scene delete high_score

# Delete all scene storage data
npx sdk-commands storage scene clear --confirm
```

You can also manage player storage via the command line, using `npx sdk-commands storage player`:

```bash
# Set a value for a specific player
npx sdk-commands storage player set level --value 10 --address 0x1234...

# Get a value for a specific player
npx sdk-commands storage player get level --address 0x1234...

# Delete a value for a specific player
npx sdk-commands storage player delete level --address 0x1234...

# Delete all data for a specific player
npx sdk-commands storage player clear --address 0x1234... --confirm

# Delete all player data (all players)
npx sdk-commands storage player clear --confirm
```

## Environment Variables

Configure your scene without hardcoding values. **Server-only** — guard with `isServer()`.

```typescript
import { EnvVar } from '@dcl/sdk/server'

// Read a variable with default
const maxPlayers = parseInt((await EnvVar.get('MAX_PLAYERS')) || '4')
const debugMode = ((await EnvVar.get('DEBUG')) || 'false') === 'true'
```

### Local Development

Create a `.env` file in your project root:

```
MAX_PLAYERS=8
GAME_DURATION=300
DEBUG=true
```

Add `.env` to your `.gitignore`.

### Deploy to Production

```bash
# Set a variable
npx sdk-commands storage env set MAX_PLAYERS --value 8

# Delete a variable
npx sdk-commands storage env delete OLD_VAR

# Delete all environment variables
npx sdk-commands storage env clear --confirm
```

You can target a specific environment with the `--target` flag:

```bash
# Deploy to staging
npx sdk-commands storage env set MY_KEY --value my_value --target https://storage.decentraland.zone

# Deploy to a local development server
npx sdk-commands storage env set MY_KEY --value my_value --target http://localhost:8000
```

Deployed env vars take precedence over `.env` file values.

You can also manage env vars through the web UI at **[decentraland.org/storage](https://decentraland.org/storage)** → Environment tab. Note: **you cannot read values back through the UI** (by design, to protect secrets) — you can only overwrite or delete them.

### Sensitive Data Pattern

Env vars are the right place for private keys, reward claim codes, API tokens, and similar secrets. Since they are server-only, the sensitive data never reaches the player's machine or the public scene bundle — critical because scene code is publicly downloadable.

## Recommended Project Structure

```
src/
├── index.ts              # Entry point — isServer() branching
├── client/
│   ├── setup.ts          # Client initialization, message handlers
│   └── ui.tsx            # React ECS UI reading synced state
├── server/
│   ├── server.ts         # Server init, systems, message handlers
│   └── gameState.ts      # Server state management class
└── shared/
    ├── schemas.ts        # Synced component definitions + validateBeforeChange
    └── messages.ts       # Message definitions via registerMessages()
```

Put synced components and messages in `shared/` so both server and client import the same definitions. Keep server logic (Storage, EnvVar, game systems) in `server/`. Keep UI and client input in `client/`.

## Performance Best Practices

Every component change sends the **entire** component data over the network (unlike Colyseus, which diffs). Design components around this constraint.

**Prefer atomic components over monolithic ones** — group fields that change together and at similar frequency, separate fast-changing data (timers, positions) from slow-changing data (scores, config):

```typescript
// BAD — changing the score also re-sends the positions array
const GameState = engine.defineComponent('GameState', {
	playerAScore: Schemas.Int,
	timer: Schemas.Int,
	playerPositions: Schemas.Array(Schemas.Vector3), // large, high-frequency
})

// GOOD — each update is small and independent
const PlayerScore = engine.defineComponent('PlayerScore', {
	playerA: Schemas.Int,
})
const GameTimer = engine.defineComponent('GameTimer', {
	secondsLeft: Schemas.Int,
})
```

**Throttle frequent messages** — never send on every frame:

```typescript
let acc = 0
engine.addSystem((dt) => {
	acc += dt
	if (acc > 0.1) {
		// every 100 ms
		room.send('position', transform.position)
		acc = 0
	}
})
```

For derivable state like countdown timers, broadcast the server's current state every ~30s and let each client compute passage of time locally in between.

## Server Lifecycle

The server is **only active while at least one player is in the scene**. If the scene sits empty, the server shuts down after a few minutes. When the next player arrives, the server takes a few seconds to spin up again.

Scene code must tolerate this cold start:

- Use retry/catch logic around initial server requests from the client.
- Rely on `Storage` to restore state when the server restarts — anything held only in memory is lost on shutdown.
- Don't assume `isStateSyncronized()` is instant on first join.

## Version Control of Deploys

Every published scene version gets its own hash and a paired server instance. Client and server always move together — there is no mismatched-version window.

When you deploy an update:

- **Players already in the scene** keep the old version and stay connected to the old server instance until they leave and return.
- **New arrivals** load the new version and connect to the new server instance.
- **`Storage` data persists across versions** (it's scoped to the world, not the hash), so new versions pick up where the old one left off.

Trade-off: for a brief post-deploy window, players can be split across two server instances and may not see each other in-scene until the older players rejoin.

## Testing & Debugging

- **Log prefixes**: Use `[SERVER]` and `[CLIENT]` prefixes in `console.log()` to distinguish server and client output in the terminal.
- **Local multi-player testing**: Using the Creator Hub, click the Preview button a second time, and that opens a second Decentraland explorer window. You must connect on both windows with different addresses. As an alternative, open a second window by entering this URL in a browser: `decentraland://realm=http://127.0.0.1:8000&local-scene=true&debug=true`
- **Stream production logs**: Run `npx sdk-commands sdk-server-logs` in your project folder (optionally with `--world WORLD_NAME.dcl.eth`) — signs in with a wallet listed in `logsPermissions` and streams live `console.log()` output from the deployed server (no redeploy needed to diagnose).
- **Stale CRDT files**: If you see "Outside of the bounds of written data" errors, delete `main.crdt` and `main1.crdt` files and restart.
- **Storage inspection**: Check `node_modules/@dcl/sdk-commands/.runtime-data/server-storage.json` locally, or use [decentraland.org/storage](https://decentraland.org/storage) in production.
- **Timers**: `setTimeout`/`setInterval` are available via runtime polyfill. For game logic, prefer `engine.addSystem()` with a delta-time accumulator to stay in sync with the frame loop.
- **Entity sync issues**: Verify you call `syncEntity(entity, [componentIds])` with the correct component IDs (`MyComponent.componentId`).

## Important Notes

- **Use `Schemas.Int64` for timestamps**: `Schemas.Number` corrupts large numbers (13+ digits). Always use `Schemas.Int64` for values like `Date.now()`.
- **State sync readiness**: Clients must wait for `isStateSyncronized()` (from `@dcl/sdk/network`) to return `true` before sending messages. Note the intentional SDK typo: "Syncronized" not "Synchronized".
- **Custom vs built-in validation**: Custom components use global `validateBeforeChange((value) => ...)`. Built-in components (Transform, GltfContainer) use per-entity `validateBeforeChange(entity, (value) => ...)`.
- **Single codebase**: Both server and client run the same `index.ts` entry point. Use `isServer()` to branch.
- **No Node.js APIs**: The DCL runtime uses sandboxed QuickJS — no `fs`, `http`, etc. `setTimeout`/`setInterval` are supported. Use SDK-provided APIs (Storage, EnvVar, engine systems) for server-side operations.
- **SDK branch (MANDATORY)**: The auth-server pattern requires `npm install @dcl/sdk@auth-server`, not the standard `@dcl/sdk`. Without it, `isServer()`, `registerMessages()`, `Storage`, and `EnvVar` are unavailable.
- **scene.json optional fields**: `logsPermissions: ["0xWalletAddress"]` should list wallet addresses that need to see server logs.
- **Worlds-only**: This feature only works on scenes deployed to Worlds (not Genesis City LAND). Multi-scene worlds can only have one authoritative server.
- **Server sleeps when empty**: Code defensively — initial client→server requests should have retry logic, and persistent state must live in `Storage`.
- **Deploys are paired by hash**: Client code and server code always match versions. Existing players don't see updates until they rejoin; `Storage` persists across versions.
- For basic CRDT multiplayer without a server, see the `multiplayer-sync` skill.

For complete server setup examples, authentication flow, state reconciliation, Storage patterns, and EnvVar usage, see `{baseDir}/references/server-patterns.md`.
