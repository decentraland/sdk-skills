# Multiplayer Server Patterns Reference

Reusable server-wiring and architectural patterns that extend the `authoritative-server` SKILL. For conceptual rules and API essentials see `{baseDir}/SKILL.md`; for standalone feature code (validation patterns, messages, storage, env vars, player positions, heartbeat, performance) see `{baseDir}/references/auth-server-examples.md`.

## Complete Server Setup

Recommended project structure: see `{baseDir}/SKILL.md` → Recommended Project Structure.

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

// Minimal structural type used by the helper below. The real callback receives
// { entity, currentValue, newValue, senderAddress, createdBy } — this helper
// only reads senderAddress so it widens to just that field.
type ComponentWithValidation = {
  validateBeforeChange: (entity: Entity, cb: (value: { senderAddress: string }) => boolean) => void
}

// Per-entity validation for built-in components (Transform, GltfContainer, …).
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

Canonical `registerMessages()` setup. Define schemas with `Schemas.Map(...)` (plain JS objects fail binary serialization). See `{baseDir}/SKILL.md` → Messages for the module-load timing rule.

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

### Server Logic (server.ts)

```typescript
import { engine, PlayerIdentityData, Transform } from '@dcl/sdk/ecs'
import { syncEntity } from '@dcl/sdk/network'
import { room } from '../shared/messages'
import { GameState, protectServerEntity } from '../shared/schemas'

export function initServer() {
  // Create server-managed entities
  const stateEntity = engine.addEntity()
  GameState.create(stateEntity, { phase: 'lobby', score: 0, timeRemaining: 60 })
  protectServerEntity(stateEntity, [Transform]) // pass several components to protect them all, e.g. [Transform, GltfContainer]
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

Basic `Storage` API usage (Scene + Player get/set/delete, boolean-checking) and the CLI commands are in `{baseDir}/references/auth-server-examples.md` → Storage. The concurrent host-call cap that makes over-frequent writes fail is documented under Server Resource Limits below. This section covers the **checkpoint persistence pattern** that follows from that cap.

### Persist at Checkpoints, Not on Every Change

Storage is durable persistence for data that must survive restarts/deploys, **not** a live datastore. A server should hold its working state in memory (faster and correct) and flush to Storage only at meaningful checkpoints. Over-frequent writes hit the isolate's in-flight host-call cap (see Server Resource Limits) and the excess `Storage.set` resolves to `false` — a silent, unchecked write loss.

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

The in-flight host-call cap is **isolate-wide**: one counter (`maxInflightHostCalls`, default 40, in `decentraland/hammurabi-headless`) shared by every host call the scene makes — `signedFetch`, runtime APIs, and each Storage request — not a per-Storage or storage-service queue. On breach the excess call **rejects** immediately with `Error('too many concurrent host calls')`; nothing is queued or retried. The SDK's Storage wrapper (`@dcl/sdk/server`) catches that rejection (internally `wrapSignedFetch` converts it into an error tuple), logs a `console.error`, and resolves the call to **`false`** — `Storage.set` / `Storage.player.set` (and the `delete` variants) never throw, so an unchecked write fails silently and persisted state goes stale or is lost. Always check the boolean.

Design implications:
- **Storage**: keep working state in memory; persist only at checkpoints (see Storage Patterns above). Never `Storage.set` per event/tick, and always check the boolean it resolves to — `false` means the write did not persist.
- **Memory**: in-memory state is the right place for working data, but it is not unbounded — 256 MB caps how much you can cache. Prune stale per-player state when players leave.
- **CPU**: never run unbounded synchronous loops on the server; a single turn exceeding 10 s kills the isolate for all players. Spread heavy work across ticks with a dt-accumulator system.
- **Messages**: throttle client→server sends; a peer exceeding 300 msgs/s has excess frames dropped (they are lost, not queued). Never send per-frame.

Source: `decentraland/hammurabi-headless` Resource / DoS limits (host calls, isolate memory, sync/async execution, inbound rate/packet, fetch, entities, comms message). The in-flight cap of 40 is `maxInflightHostCalls` (`HAMMURABI_MAX_INFLIGHT_HOST_CALLS`), enforced isolate-wide in the injected sandbox globals — it is NOT a storage-service limit; Storage requests simply count against it like every other host call.

## Production Logs

Stream live server-side `console.log()` output from the deployed server to diagnose issues without redeploying.

Configure it with `logsPermissions` — a **root-level array of wallet addresses** in `scene.json` authorized to read production server logs. **Without it, server logs are hidden in production even from the scene owner.**

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
