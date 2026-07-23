# Multiplayer Server Patterns Reference

## Complete Server Setup

### Project Structure

```
src/
├── index.ts              # Entry point — isServer() branching
├── client/
│   ├── setup.ts          # Client init, input handlers, message senders
│   └── ui.tsx            # React ECS UI (reads synced state, sends messages)
├── server/
│   ├── server.ts         # Server init, game loop, message handlers
│   └── gameState.ts      # Server state management
└── shared/
    ├── schemas.ts        # Custom component definitions + validateBeforeChange
    └── messages.ts       # Message definitions via registerMessages()
```

### Entry Point (index.ts)

```typescript
import { isServer } from '@dcl/sdk/network'

export async function main() {
  if (isServer()) {
    const { initServer } = await import('./server/server')
    initServer()
    return
  }

  const { initClient } = await import('./client/setup')
  const { setupUi } = await import('./client/ui')
  initClient()
  setupUi()
}
```

### Shared Schemas (shared/schemas.ts)

The component definition itself is shared (both server and client need its `componentId`/type), but `validateBeforeChange()` calls must run **only on the server**. Calling them on the client produces errors. Wrap them in `isServer()`.

```typescript
import { engine, Schemas, Entity } from '@dcl/sdk/ecs'
import { isServer } from '@dcl/sdk/network'
import { AUTH_SERVER_PEER_ID } from '@dcl/sdk/network/message-bus-sync'

// Custom synced component — definition runs on both sides
export const GameState = engine.defineComponent('game:State', {
  phase: Schemas.String,
  score: Schemas.Int,
  timeRemaining: Schemas.Int
})

// Server-only: register the validator inside an isServer() guard.
// The callback receives { entity, currentValue, newValue, senderAddress, createdBy }.
if (isServer()) {
  GameState.validateBeforeChange((value) => {
    return value.senderAddress === AUTH_SERVER_PEER_ID
  })
}

// For built-in components, use per-entity validation
type ComponentWithValidation = {
  validateBeforeChange: (entity: Entity, cb: (value: { senderAddress: string }) => boolean) => void
}

// Helper. Must only be invoked from inside isServer() — see server.ts.
export function protectServerEntity(entity: Entity, components: ComponentWithValidation[]) {
  for (const component of components) {
    component.validateBeforeChange(entity, (value) => {
      return value.senderAddress === AUTH_SERVER_PEER_ID
    })
  }
}
```

### Shared Messages (shared/messages.ts)

```typescript
import { Schemas } from '@dcl/sdk/ecs'
import { registerMessages } from '@dcl/sdk/network'

export const Messages = {
  // Client → Server
  playerReady: Schemas.Map({ displayName: Schemas.String }),
  playerAction: Schemas.Map({ action: Schemas.String, targetId: Schemas.Int }),

  // Server → Client
  gameStarted: Schemas.Map({ roundNumber: Schemas.Int }),
  playerScored: Schemas.Map({ playerName: Schemas.String, points: Schemas.Int }),
  gameEnded: Schemas.Map({ winnerId: Schemas.String })
}

export const room = registerMessages(Messages)
```

### Server Logic (server/server.ts)

```typescript
import { engine, PlayerIdentityData, Transform } from '@dcl/sdk/ecs'
import { syncEntity } from '@dcl/sdk/network'
import { room } from '../shared/messages'
import { GameState, protectServerEntity } from '../shared/schemas'

export function initServer() {
  // Create server-managed entities
  const stateEntity = engine.addEntity()
  GameState.create(stateEntity, { phase: 'lobby', score: 0, timeRemaining: 60 })
  protectServerEntity(stateEntity, [Transform])
  syncEntity(stateEntity, [GameState.componentId], 1)

  // Handle client messages
  room.onMessage('playerReady', (data, context) => {
    if (!context) return
    console.log(`[Server] ${data.displayName} ready (${context.from})`)
  })

  room.onMessage('playerAction', (data, context) => {
    if (!context) return
    // Validate action on server
    const playerPos = getPlayerPosition(context.from)
    if (isValidAction(data.action, playerPos)) {
      applyAction(data)
    }
  })

  // Game loop
  engine.addSystem(gameLoopSystem)
}
```

## Authentication Flow

The auth server automatically provides player identity via `PlayerIdentityData`:

```typescript
// Server reads actual player positions
engine.addSystem(() => {
  for (const [entity, identity] of engine.getEntitiesWith(PlayerIdentityData)) {
    const transform = Transform.getOrNull(entity)
    if (!transform) continue

    // identity.address = wallet address (verified by server)
    // transform.position = actual player position (not client-reported)
    console.log(`[Server] ${identity.address} at`, transform.position)
  }
})
```

Never trust client-reported positions. The server sees real positions via `PlayerIdentityData` + `Transform`.

## State Reconciliation

When server state diverges from client state, the server always wins:

```typescript
// Server-side: apply authoritative state
function reconcileState() {
  const state = GameState.getMutable(stateEntity)

  // Server calculates correct state
  state.timeRemaining = Math.max(0, state.timeRemaining - 1)

  if (state.timeRemaining <= 0 && state.phase === 'active') {
    state.phase = 'ended'
    room.send('gameEnded', { winnerId: findWinner() })
  }
}
```

Because `validateBeforeChange` blocks client writes, clients can only read the state and send messages. The server is the single source of truth.

## Storage Patterns

### Scene Storage (Global Data, shared across all players)

`Storage.set/get/delete` are top-level methods on `Storage` — there is no `Storage.world` namespace.

```typescript
import { Storage } from '@dcl/sdk/server'

// Save leaderboard
await Storage.set('leaderboard', JSON.stringify([
  { name: 'Alice', score: 100 },
  { name: 'Bob', score: 85 }
]))

// Load leaderboard
const data = await Storage.get<string>('leaderboard')
const leaderboard = data ? JSON.parse(data) : []

// Delete
await Storage.delete('leaderboard')
```

### Player Storage (Per-Player Data)

```typescript
import { Storage } from '@dcl/sdk/server'

// Save player progress
await Storage.player.set(playerAddress, 'progress', JSON.stringify({
  level: 5,
  coins: 250,
  achievements: ['first_kill', 'speedrun']
}))

// Load player progress
const saved = await Storage.player.get<string>(playerAddress, 'progress')
const progress = saved ? JSON.parse(saved) : { level: 1, coins: 0, achievements: [] }
```

**Note:** Storage only accepts strings. Always `JSON.stringify()` objects and `String()` numbers.

**Local dev storage location:** `node_modules/@dcl/sdk-commands/.runtime-data/server-storage.json`

### Storage is Limited — Persist at Checkpoints, Not on Every Change

The server isolate caps **in-flight host calls at 40** (`maxInflightHostCalls`, default 40, in `decentraland/hammurabi-headless`). The cap is **isolate-wide**: one counter shared by every host call the scene makes — `signedFetch`, runtime APIs, and each Storage request — not a per-Storage or storage-service queue. On breach the excess call **rejects** immediately with `Error('too many concurrent host calls')`; nothing is queued or retried. The SDK's Storage wrapper catches that rejection, logs a `console.error`, and resolves the call to **`false`** — `Storage.set` never throws, so an unchecked write fails silently and persisted state goes stale or is lost.

**The failure is detectable**: `Storage.set` / `Storage.player.set` (and the `delete` variants) return `Promise<boolean>` — `false` means the write did not persist. Check the result and retry (or keep the key marked dirty) instead of discarding it.

Storage is durable persistence for data that must survive restarts/deploys, **not** a live datastore. A server should hold its working state in memory (faster and correct) and flush to Storage only at meaningful checkpoints.

**Anti-pattern — write per event/tick:**
```typescript
// BAD: one Storage.set per score change floods the queue
room.onMessage('claimPoint', async (data, context) => {
  scores[context.from] = (scores[context.from] ?? 0) + 1
  await Storage.player.set(context.from, 'score', String(scores[context.from])) // fires every claim
})
```

**Correct pattern — keep state in memory, persist at checkpoints / debounced:**
```typescript
// GOOD: mutate in-memory state on every event; persist only on meaningful checkpoints
const scores: Record<string, number> = {}
const dirty = new Set<string>()

room.onMessage('claimPoint', (data, context) => {
  scores[context.from] = (scores[context.from] ?? 0) + 1
  dirty.add(context.from)               // mark for later flush, no Storage call here
})

// Debounced flush: run periodically (e.g. every ~30s via a dt-accumulator system),
// and always flush the relevant key at real checkpoints (game over, player leaves).
// set() resolves false when the write failed (e.g. host-call cap hit) — keep the
// key dirty so the next flush retries it instead of losing the update.
async function flush() {
  for (const address of dirty) {
    const ok = await Storage.player.set(address, 'score', String(scores[address]))
    if (ok) dirty.delete(address)
  }
}
```

Persist on: game over, player leaves, round end, or a periodic debounced save. Never persist on: every score change, every position update, every frame/tick.

### CLI: Scene Storage

```bash
npx sdk-commands storage scene set high_score --value 100
npx sdk-commands storage scene get high_score
npx sdk-commands storage scene delete high_score
npx sdk-commands storage scene clear --confirm
```

### CLI: Player Storage

```bash
npx sdk-commands storage player set level --value 10 --address 0x1234...
npx sdk-commands storage player get level --address 0x1234...
npx sdk-commands storage player delete level --address 0x1234...
npx sdk-commands storage player clear --address 0x1234... --confirm
npx sdk-commands storage player clear --confirm
```

## Server Resource Limits

The headless server runs each scene in a sandboxed V8 isolate with hard resource/DoS caps. Design scenes to stay well under these — several are enforced by **silently dropping** data or by **terminating the isolate** (killing the server for everyone in the scene). Numbers below are defaults; a scene cannot raise them.

Limits a scene creator can realistically hit and should design around:

| Limit | Value | Enforcement on breach |
|---|---|---|
| In-flight host calls (isolate-wide, incl. Storage) | **40** concurrent | excess call rejects (`too many concurrent host calls`); SDK resolves `Storage.set` to `false` |
| Isolate memory | **256 MB** ceiling | isolate disposed (server dies) |
| Sync execution per turn | **10,000 ms** wall-clock | overrun terminates & disposes the isolate |
| Async turn settle | **60,000 ms** | overrun terminates & disposes the isolate |
| Inbound messages per peer | **300** per **1,000 ms** window | excess data frames dropped |
| Inbound packet size | **131,072 bytes** (128 KB) per packet | oversized packet dropped entirely |
| Concurrent `signedFetch` | **32** in-flight | additional fetches queue/block |
| Fetch timeout / retries | **15,000 ms** per attempt, **2** attempts | fetch fails |
| Scene→comms message | **30,000 bytes** max | (separate transport guidance: keep synced messages under 13 KB — see SKILL.md) |
| Live entities | **100,000** max | — (very unlikely to hit) |

Design implications:
- **Storage**: keep working state in memory; persist only at checkpoints (see Storage Patterns above). Never `Storage.set` per event/tick, and always check the boolean it resolves to — `false` means the write did not persist.
- **Memory**: in-memory state is the right place for working data, but it is not unbounded — 256 MB caps how much you can cache. Prune stale per-player state when players leave.
- **CPU**: never run unbounded synchronous loops on the server; a single turn exceeding 10 s kills the isolate for all players. Spread heavy work across ticks with a dt-accumulator system.
- **Messages**: throttle client→server sends; a peer exceeding 300 msgs/s has excess frames dropped (they are lost, not queued). Never send per-frame.

Source: `decentraland/hammurabi-headless` Resource / DoS limits (host calls, isolate memory, sync/async execution, inbound rate/packet, fetch, entities, comms message). The in-flight cap of 40 is `maxInflightHostCalls` (`HAMMURABI_MAX_INFLIGHT_HOST_CALLS`), enforced isolate-wide in the injected sandbox globals — it is NOT a storage-service limit; Storage requests simply count against it like every other host call. The "silent" failure mode is produced by the SDK (`@dcl/sdk/server`): `wrapSignedFetch` converts the rejection into an error tuple and `Storage.set` resolves to `false` after a `console.error`.

## Environment Variables

`EnvVar.get(key: string): Promise<string>` — always resolves to a string, returns `''` (empty string) when the variable isn't set or the fetch fails. Never `undefined`. The `|| 'fallback'` pattern works correctly because `'' || 'x'` evaluates to `'x'`.

```typescript
import { EnvVar } from '@dcl/sdk/server'

// Read with defaults — empty string from a missing var triggers the fallback
const maxPlayers = parseInt((await EnvVar.get('MAX_PLAYERS')) || '4')
const gameDuration = parseInt((await EnvVar.get('GAME_DURATION')) || '300')
const debugMode = ((await EnvVar.get('DEBUG')) || 'false') === 'true'
```

### Local Development (.env file)

```
MAX_PLAYERS=8
GAME_DURATION=300
DEBUG=true
```

### Production Deployment

```bash
npx sdk-commands storage env set MAX_PLAYERS --value 8
npx sdk-commands storage env set GAME_DURATION --value 300
npx sdk-commands storage env delete OLD_VAR
```

## scene.json Required Fields

```json
{
  "logsPermissions": ["0xYourWalletAddress"]
}
```

- `logsPermissions` — root-level array of wallet addresses authorized to read production server logs. Without it, server logs are hidden in production **even from the scene owner**.
- `worldConfiguration.name` — only needed when deploying to a World (not required for Genesis City LAND)

## Production Logs

Stream live `console.log()` output from the deployed server to diagnose issues without redeploying.

```bash
# Genesis City LAND
npx sdk-commands sdk-server-logs

# World (manually specify when not auto-detected)
npx sdk-commands sdk-server-logs --world WORLD_NAME.dcl.eth
```

Flow:
1. Add the wallet address(es) to `logsPermissions` in `scene.json` and deploy.
2. Run the command. It prompts to sign a message with a wallet listed in `logsPermissions`.
3. After signing, server logs stream to the terminal in real time.

Gotchas:
- The signing wallet must already appear in the **deployed** `scene.json`. Updating `logsPermissions` requires a redeploy.
- `--world` is the only documented flag; use it when the command cannot infer the world name from the current project.
- Only server-side `console.log()` is streamed — client logs are not.
