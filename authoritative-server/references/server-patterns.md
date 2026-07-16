# Authoritative Server Patterns Reference

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

## Per-Player Synced Entities

Pattern for one server-created synced entity per connected player (per-player score, hold time, wallet, etc.). Three rules, each learned from a production failure on a long-running headless server:

1. **Never derive an explicit sync id from the player's address** (e.g. `hash(address) % 100000`). An explicit sync id makes the network identity *global* — `(networkId: 0, entityId: <id>)` — with a hard collision check that throws `syncEntity failed because the id provided is already in use`. A hashed per-player id collides both across players (birthday bound: ~50% chance of a collision by ~370 distinct addresses in a 100k range) and when the *same* player reconnects before their previous entity is cleaned up. Omit the id — auto-allocation is `(networkId: <this peer>, entityId: <unique local entity>)`, unique by construction — and store the player's address in a component field (`playerId`). All lookups match on that field, never on the network id. Reserve explicit enum ids for fixed singletons (game state, flag, leaderboard).
2. **Validate cached entity handles before reuse.** Long-running servers recycle entity slots, so a `Map<address, Entity>` can end up pointing at an entity whose component is gone. Reusing it blindly makes `getMutable()` throw `[mutable] Component <name> for <id> not found` on every frame — and any round-end/cleanup logic that touches the entity goes down with it.
3. **Never adopt reserved-range entities from component scans.** Scene-created entities always have entity *number* ≥ 512 (`entity & 0xffff` — the upper bits are the version). Numbers below 512 are reserved/avatar-range slots owned by the runtime: caching one hands out a handle that goes stale when the host recycles the slot, and calling `engine.removeEntity()` on one can delete an avatar entity.

```typescript
// server/players.ts
import { engine, Entity } from '@dcl/sdk/ecs'
import { syncEntity } from '@dcl/sdk/network'
import { PlayerScore } from '../shared/schemas'  // has a `playerId: Schemas.String` field

const playerEntities = new Map<string, Entity>()
const RESERVED_ENTITY_LIMIT = 512

export function getOrCreatePlayerEntity(address: string): Entity {
  const key = address.toLowerCase()
  const cached = playerEntities.get(key)

  // Rule 2: only reuse the cached entity if it STILL carries the component.
  if (cached !== undefined && PlayerScore.getOrNull(cached) !== null) return cached
  if (cached !== undefined) {
    playerEntities.delete(key)
    try { engine.removeEntity(cached) } catch { /* already gone */ }
  }

  const entity = engine.addEntity()
  PlayerScore.create(entity, { playerId: key, score: 0 })
  // Rule 1: NO explicit sync id — auto-allocate; identity lives in `playerId`.
  syncEntity(entity, [PlayerScore.componentId])
  playerEntities.set(key, entity)
  return entity
}

// After a server restart, the CRDT snapshot may already contain per-player
// entities from the previous run. Re-adopt them by scanning for the component
// and keying on the playerId FIELD (never the network id), removing duplicates.
export function reconcilePlayerEntities(): void {
  for (const [entity, data] of engine.getEntitiesWith(PlayerScore)) {
    // Rule 3: never adopt or remove a reserved/avatar-range entity.
    if (((entity as number) & 0xffff) < RESERVED_ENTITY_LIMIT) continue
    const key = data.playerId.toLowerCase()
    const existing = playerEntities.get(key)
    if (existing === undefined) {
      playerEntities.set(key, entity)
    } else if (existing !== entity) {
      engine.removeEntity(entity)  // duplicate from a previous run
    }
  }
}
```

In per-frame systems, prefer `getMutableOrNull` + guard over `getMutable` so a transient stale handle skips one tick instead of throwing every frame:

```typescript
export function scoreSystem(dt: number): void {
  for (const key of activePlayers) {
    const entity = getOrCreatePlayerEntity(key)
    const mutable = PlayerScore.getMutableOrNull(entity)
    if (!mutable) continue  // stale this tick — getOrCreate self-heals next call
    mutable.score += computeDelta(key, dt)
  }
}
```

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
