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

**Key player data by the lower-cased address.** `context.from` arrives exactly as the transport reports it, with no case normalization. Lower-case it once at the top of each handler (`const address = context.from.toLowerCase()`) and use that value for every in-memory map, `dirty` set and Storage call. A mix of raw and lower-cased keys splits one player's data across two entries.

### Persist at Checkpoints, Not on Every Change

Storage is durable persistence for data that must survive restarts/deploys, **not** a live datastore. A server should hold its working state in memory (faster and correct) and flush to Storage only at meaningful checkpoints. Over-frequent writes hit the isolate's in-flight host-call cap (see Server Resource Limits) and the excess `Storage.set` resolves to `false` — a silent, unchecked write loss.

**Anti-pattern — write per event/tick:**
```typescript
// BAD: one Storage.set per score change floods the queue
room.onMessage('claimPoint', async (data, context) => {
  if (!context) return
  const address = context.from.toLowerCase()
  scores[address] = (scores[address] ?? 0) + 1
  await Storage.player.set(address, 'score', String(scores[address])) // fires every claim
})
```

**Correct pattern — keep state in memory, persist at checkpoints / debounced:**
```typescript
// GOOD: mutate in-memory state on every event; persist only on meaningful checkpoints
const scores: Record<string, number> = {}
const dirty = new Set<string>()

room.onMessage('claimPoint', (data, context) => {
  if (!context) return
  const address = context.from.toLowerCase()
  scores[address] = (scores[address] ?? 0) + 1
  dirty.add(address)                    // mark for later flush, no Storage call here
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

### Load-or-create a player save (never overwrite on join)

Assigning default data every time a player joins wipes their save. Read first; create only on a confirmed absence. `Storage.player.get` resolves `null` only when the key does not exist and **throws** when the read fails. Catch the failure, leave the player unloaded and tell the client so it can retry the join. Defaults followed by a write would replace the real save. While the save is unloaded, every handler for that player returns early, so an uncaught throw drops their later actions silently.

```typescript
type PlayerSave = { coins: number; crops: number; grownAt: number }
// In-memory working state, keyed by lower-cased address. No prototype, so a key like
// '__proto__' or 'constructor' never finds an inherited value.
const saves: Record<string, PlayerSave> = Object.create(null)
const dirty = new Set<string>() // addresses whose save changed since the last flush

// Checkpoint flush for this example: writes the whole save under the 'save' key
async function flushSaves() {
  for (const address of dirty) {
    const ok = await Storage.player.set(address, 'save', saves[address]) // false = not persisted, retry next flush
    if (ok) dirty.delete(address)
  }
}

async function loadOrCreate(address: string): Promise<PlayerSave> {
  const key = address.toLowerCase()
  if (saves[key]) return saves[key]                       // already loaded this session
  const stored = await Storage.player.get<PlayerSave>(key, 'save') // throws on failure
  if (stored) return (saves[key] ??= stored)
  const fresh: PlayerSave = { coins: 0, crops: 0, grownAt: Date.now() }
  saves[key] ??= fresh
  dirty.add(key)                                          // persisted at the next checkpoint
  return saves[key]
}

room.onMessage('playerJoin', async (_data, context) => {
  if (!context) return
  const address = context.from.toLowerCase()
  try {
    const save = await loadOrCreate(address)
    if (settleIdle(save)) dirty.add(address) // see below
  } catch (error) {
    console.error(`[Server] could not load save for ${address}`, error)
    room.send('saveUnavailable', {}, { to: [context.from] }) // client re-sends playerJoin after a delay
  }
})
```

`??=` keeps whichever value landed first if two joins race. Same rule for scene-wide state: `Storage.get(key)` → create only on `null`.

### Validate every transfer on the server

A client message is a request, not a fact. Validate every field before using it:
- **Addresses:** a client-sent address must match `0x` plus 40 hex digits. Otherwise a value like `'__proto__'` can reach your maps and your `dirty` set. `Storage.player.*` throws a `TypeError` on anything else.
- **Amounts:** an amount must be a positive finite number (an integer, for counts), and the sender must hold enough. Otherwise `amount: -500` moves money *to* the sender. `Schemas.Int` constrains the type, not the sign.

```typescript
const ADDRESS = /^0x[0-9a-f]{40}$/

room.onMessage('giveCoins', (data, context) => {
  if (!context) return
  const fromAddress = context.from.toLowerCase()
  const toAddress = String(data.to).toLowerCase()
  if (!ADDRESS.test(toAddress) || toAddress === fromAddress) return // rejects junk keys and self-transfers
  const from = saves[fromAddress]
  const to = saves[toAddress]
  if (!from || !to) return                              // both players must be in the scene (saves loaded)
  const amount = data.amount
  if (!Number.isInteger(amount) || amount <= 0) return  // rejects NaN, Infinity, negatives, fractions
  if (from.coins < amount) return
  from.coins -= amount
  to.coins += amount
  dirty.add(fromAddress); dirty.add(toAddress)
})
```

This handler only moves coins between players whose saves are loaded, which means both are in the scene. A transfer to anyone else returns without effect. To pay an offline player, validate the address first, then `await loadOrCreate(toAddress)`. Skipping the validation would let any string create a persisted save. After the `await`, read the balances again and run the checks and the update with no further `await`. An `await` between the checks and the update lets a second message run, pass the same checks and spend the same coins again.

Apply the same checks to buys, sells, crafting and rewards: the server computes the price and the result; the client only names what it wants.

### Progress while nobody is in the scene (idle / offline)

Never keep a timer running for crops, restocks or energy refills. Nothing is guaranteed to run while the scene is empty: the players' clients are gone, and the Multiplayer Server may be stopped between visits. Store the time progress was last settled; on the next visit compute progress from elapsed time and move the timestamp forward. Use the **server's** `Date.now()` — a client clock can be set forward to skip waits, so never accept a client-sent timestamp.

```typescript
const MS_PER_CROP = 60_000
const MAX_CROPS = 50

// Returns true when the save changed, so the caller can mark it dirty
function settleIdle(save: PlayerSave, now = Date.now()): boolean {
  const elapsed = Math.max(0, now - save.grownAt)        // ignore backwards clock jumps
  const grown = Math.floor(elapsed / MS_PER_CROP)
  if (grown === 0) return false
  save.crops = Math.min(MAX_CROPS, save.crops + grown)
  // Keep the unfinished remainder; once capped, restart the clock at now.
  save.grownAt = save.crops >= MAX_CROPS ? now : save.grownAt + grown * MS_PER_CROP
  return true
}
```

Call it on join and before any action that reads or spends the progressed value (harvest, buy). When it returns `true`, mark the save dirty and persist it at the next checkpoint like any other state. Scene-wide variants (a shop restock shared by everyone) store the timestamp under a scene key instead.

### Append-only logs: write-once versioned keys in Storage

Storage holds **JSON values keyed by name** (here, CSV text), with no append and **no compare-and-set**. Read-modify-write of one key loses data: rewriting a part in place lost rows on a live World (a CSV shrank from 8183 B to 7852 B between two flushes) through any of three paths — two server instances flushing at once (an old and a new deploy overlap), a read that comes back behind the last write, or a read that misses a key that exists. The Scene Feedback module (`sdk7-test-scenes/scenes/0,-1-scene-feedback`, `src/scene-feedback/lib/server/parts.ts`) is the reference implementation; reuse its shape for any server-side event log (playtest answers, round results, telemetry).

**Rule: never rewrite a key that more than one writer, or a stale read, can touch.** Write each snapshot to a new, unique, time-sortable key, and delete only write-once keys you have read and merged.

Flush, per part:

1. **List** the part's versions by prefix (`scene-feedback-<part>-`), oldest first.
2. **Merge** their rows by row `id`, first seen wins.
3. **Append** only the batch rows whose `id` is not already there.
4. **Write a new version** `scene-feedback-<part>-<YYYYMMDD-HHMMSS UTC>-<4 random base36>.csv`. `Storage.set` returning `false` → throw (the batch stays buffered).
5. **Read it back.** Identical → delete exactly the versions read in step 1. Different → delete nothing; the next flush merges them all again.

A race or a missed read leaves an extra version, never a lost row: a row is always in at least one key, and the next flush merges the versions back into one. Versions left by a race are merged before a full part rolls over; more than **3** versions of one part is logged (new versions keep failing to read back). The head key `scene-feedback-csv-head` is only a hint for the open part — a lost update makes the next flush walk forward again.

Storage on the auth-server SDK, as this pattern uses it (verified on the `auth-server` branch of js-sdk-toolchain):

```typescript
// reads bypass the SDK's read cache; paging until the reported total
const get = <T>(key: string) => Storage.get<T>(key, { fresh: true })
async function list(prefix: string) {
  const entries: { key: string; value: unknown }[] = []
  for (;;) {
    const page = await Storage.getValues({ prefix, offset: entries.length }) // also takes limit
    entries.push(...page.data)
    if (page.data.length === 0 || entries.length >= page.pagination.total) return entries
  }
}
```

**`{ fresh: true }` is not a freshness guarantee.** It skips the SDK's own cache only. The Storage service itself served an old value of a key for an hour or more on a live World, `fresh` or not, across a server restart. Write-once keys are immune (an old read of a key written once is the same value); a key that is still rewritten is not. So a key from before the switch to versions (`scene-feedback-N.csv` here) is merged at every flush and **never deleted by the server** — an instance still on the old code may append to it, and no read proves the merge holds all its rows. The owner deletes it by hand once no server runs the old code and the newest version holds all its ids.

Readers download **every** file of a part (the old-format file plus all versions) and dedupe by `id`; duplicates across files are expected.

Test it against a fake Storage that can lag, miss a read once, get stuck on an old value, and interleave two flushes (every fake method starts with `await Promise.resolve()`); assert both that no row is **lost** and that no file **repeats** an id — a loss-only check passes a broken merge. The module's `test/flush.test.ts` (vitest) does this.

Limits and failure modes this pattern still has (all **design** constraints, not bugs):

- **A crash or redeploy loses up to a minute of acknowledged rows** (more if Storage writes are failing and the buffer keeps growing), and they are never resent — the server **acknowledges a response once it is buffered**, before the write. Never use this for anything that must not be lost (payments, prize state); checkpoint those synchronously and check the boolean.
- **Dedup on a client-generated `id`** so a retried submission is not counted twice.
- **Per-writer rate cap**: the module allows one address at most **100 rows / 10 min**; beyond that it drops. Add an equivalent cap to any append log you expose to clients — otherwise one client can fill a World's storage budget.
- **Bounded buffer**: 2000 rows. Past that the server **stops acknowledging**, and the client retries every 3 s for up to 30 s before giving up.
- **Escape on write**: flatten text to one line, and prefix a leading `= + - @` with `'` so a spreadsheet does not execute a submitted cell as a formula. Player-submitted text in a CSV is untrusted input.
- **Storage ceilings**: **512 KB per value**, **10 MB per World**, shared by every scene in that World. Parts roll over at **400 KB** (`PART_MAX_BYTES`), which is what keeps every version under the per-value ceiling; separately, one flush takes at most 200 KB of new rows (`BATCH_MAX_BYTES`) and leaves the rest for the next flush. Every extra version also counts against the 10 MB until the next flush deletes it.

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
| Fetch timeout | **15,000 ms** per attempt | fetch fails |
| Max fetch redirects | **5** hops | fetch fails on the 6th redirect |
| Max fetch response body | **10 MB** | fetch fails |
| Max open WebSockets | **32** concurrent | additional connections rejected |
| Max WebSocket message | **1 MB** (1,048,576 bytes) | oversized send rejected locally |
| Outbound `sendMessages` per tick | **512** | excess messages dropped |
| Scene→comms message | **30,000 bytes** max | (separate transport guidance: keep synced messages under 13 KB — see SKILL.md) |
| Live entities | **100,000** max | — (very unlikely to hit) |

The in-flight host-call cap is **isolate-wide**: one counter (`maxInflightHostCalls`, default 40, in `decentraland/hammurabi-headless`) shared by every host call the scene makes — `signedFetch`, runtime APIs, and each Storage request — not a per-Storage or storage-service queue. On breach the excess call **rejects** immediately with `Error('too many concurrent host calls')`; nothing is queued or retried. The SDK's Storage wrapper (`@dcl/sdk/server`) catches that rejection (internally `wrapSignedFetch` converts it into an error tuple), logs a `console.error`, and resolves the call to **`false`**: `Storage.set` / `Storage.player.set` never throw on a failed write, so an unchecked write fails silently and persisted state goes stale or is lost. Always check the boolean. The `delete` variants behave differently: a failed delete **throws**, and `false` only means the key did not exist.

Design implications:
- **Storage**: keep working state in memory; persist only at checkpoints (see Storage Patterns above). Never `Storage.set` per event/tick, and always check the boolean it resolves to — `false` means the write did not persist.
- **Memory**: in-memory state is the right place for working data, but it is not unbounded — 256 MB caps how much you can cache. Prune stale per-player state when players leave.
- **CPU**: never run unbounded synchronous loops on the server; a single turn exceeding 10 s kills the isolate for all players. Spread heavy work across ticks with a dt-accumulator system.
- **Messages**: throttle client→server sends; a peer exceeding 300 msgs/s has excess frames dropped (they are lost, not queued). Never send per-frame.

Source: `decentraland/hammurabi-headless` Resource / DoS limits (host calls, isolate memory, sync/async execution, inbound rate/packet, fetch, entities, comms message). Values cross-checked against the `93,-9-authoritative-server-limits-lab` shared config (https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/93,-9-authoritative-server-limits-lab). The in-flight cap of 40 is `maxInflightHostCalls` (`HAMMURABI_MAX_INFLIGHT_HOST_CALLS`), enforced isolate-wide in the injected sandbox globals — it is NOT a storage-service limit; Storage requests simply count against it like every other host call.

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
