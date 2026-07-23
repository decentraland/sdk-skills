# Multiplayer Server Code Examples

## Setup

Install commands and the `authoritativeMultiplayer` auto-add behavior are documented in `{baseDir}/SKILL.md` → Setup. Canonical `scene.json` worked example:

```json
{
  "authoritativeMultiplayer": true,
  "logsPermissions": ["0xYourWalletAddress"]
}
```

- `authoritativeMultiplayer: true` (root-level) enables the headless server; it is auto-added on every build and preview — do not remove it. See `{baseDir}/SKILL.md` → Setup.
- `logsPermissions` (root-level array) is optional — only needed to read production server logs. See `{baseDir}/references/server-patterns.md` → Production Logs.
- `worldConfiguration.name` is only needed when deploying to a World — not required for Genesis City LAND. Auth server is supported on both Genesis City and Worlds (including multi-scene Worlds).

## Server/Client Branching

The entry-point skeleton (`index.ts`) is in `{baseDir}/references/server-patterns.md` → Complete Server Setup → Entry Point. Concept (branch a single codebase with `isServer()` from `@dcl/sdk/network`): `{baseDir}/SKILL.md` → Server/Client Branching.

## Validation Patterns

### Pattern 1 — Server-only writes (strictest)
```typescript
import { AUTH_SERVER_PEER_ID } from '@dcl/sdk/network/message-bus-sync'
// `Score` is a custom synced component defined in shared/schemas.ts

Score.validateBeforeChange((v) => v.senderAddress === AUTH_SERVER_PEER_ID)
```

### Pattern 2 — Validate the value itself
```typescript
import { Transform } from '@dcl/sdk/ecs'
import { isServer } from '@dcl/sdk/network'

if (isServer()) {
  Transform.validateBeforeChange(entity, (value) => {
    // value: { entity, currentValue, newValue, senderAddress, createdBy }
    // newValue is undefined when the component is being deleted
    return !!value.newValue && value.newValue.position.y > 0
  })
}
```

### Pattern 3 — Proximity validation (anti-cheat)
```typescript
import { engine, PlayerIdentityData, Transform } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'
import { isServer } from '@dcl/sdk/network'

if (isServer()) {
  Transform.validateBeforeChange(pickableEntity, (value) => {
    for (const [playerEntity, identity] of engine.getEntitiesWith(PlayerIdentityData)) {
      if (identity.address.toLowerCase() !== value.senderAddress.toLowerCase()) continue
      const playerTransform = Transform.getOrNull(playerEntity)
      const objectTransform = Transform.getOrNull(pickableEntity)
      if (!playerTransform || !objectTransform) return false
      return (
        Vector3.distance(playerTransform.position, objectTransform.position) <= 5
      )
    }
    return false
  })
}
```

### Pattern 4 — Admin-only writes
```typescript
import { isServer } from '@dcl/sdk/network'
// isPreview and getSceneAdmins are NOT exported from @dcl/sdk. The only working
// import paths are the deep dist paths below (the asset-packs package has no
// exports field and no top-level re-export).
import { isPreview } from '@dcl/asset-packs/dist/admin-toolkit-ui/fetch-utils'
import { getSceneAdmins } from '@dcl/asset-packs/dist/admin-toolkit-ui/ModerationControl/api'

if (isServer()) {
  let adminAddresses = new Set<string>()

  async function updateAdminAddresses() {
    if (isPreview()) return
    // Go-style tuple: [error, response]. Response shape:
    //   { id: string; name: string; admin: string; active: string; canBeRemoved: boolean }[]
    const [error, response] = await getSceneAdmins()
    if (error) {
      adminAddresses = new Set()
      return
    }
    adminAddresses = new Set((response ?? []).map((a) => a.admin.toLowerCase()))
  }
  await updateAdminAddresses()

  VideoPlayer.validateBeforeChange(videoEntity, (value) => {
    if (isPreview()) return true
    return adminAddresses.has(value.senderAddress.toLowerCase())
  })
}
```

`isPreview()`: sync, no args, returns `boolean`. Reads a cached realm fetch — call from server code after the SDK has started (e.g. inside `main()`/`initServer()`, not at module top level).

`getSceneAdmins()`: async, no args, returns `Promise<[error: string | null, response: SceneAdminResponse[] | null]>`. The `admin` field on each row is the lowercased wallet address (always normalize with `.toLowerCase()` anyway).

## Custom Components (Global Validation)

Defining a custom synced component at module scope and gating its writes with a global `validateBeforeChange()` inside `isServer()`: the canonical `GameState` + validator is in `{baseDir}/references/server-patterns.md` → Complete Server Setup → Shared Schemas (see also Pattern 1 above). Concept: `{baseDir}/SKILL.md` → Synced Components with Validation.

## Built-in Components (Per-Entity Validation)

The `protectServerEntity()` helper and the per-entity `validateBeforeChange(entity, cb)` pattern for built-in components (Transform, GltfContainer) are in `{baseDir}/references/server-patterns.md` → Complete Server Setup → Shared Schemas. Always call the helper inside `isServer()` — `validateBeforeChange()` only has meaning on the server.

## Syncing Entities

In an authoritative-server scene, **only the server calls `syncEntity()`** — see `{baseDir}/SKILL.md` → Synced Components with Validation for the rule and rationale.

```typescript
import { isServer, syncEntity } from '@dcl/sdk/network'

if (isServer()) {
  syncEntity(entity, [Transform.componentId, GameState.componentId], 1)
}
```

## Messages

For the canonical `registerMessages()` pattern see `{baseDir}/references/server-patterns.md` → Complete Server Setup → Shared Messages. The `room` object used below is defined with this example's own message set:

```typescript
export const room = registerMessages({
  playerJoin: Schemas.Map({ displayName: Schemas.String }),
  playerAction: Schemas.Map({ actionType: Schemas.String, data: Schemas.Number }),
  gameEvent: Schemas.Map({ eventType: Schemas.String, playerName: Schemas.String }),
})
```

### Send Messages
```typescript
// Client → server
room.send('playerJoin', { displayName: 'Alice' })

// Server → ALL clients
room.send('gameEvent', { eventType: 'ROUND_START', playerName: '' })

// Server → ONE client
room.send('gameEvent', { eventType: 'YOU_WIN', playerName: 'Alice' }, { to: [playerAddress] })
```

### Receive Messages
```typescript
// Server receives from client
room.onMessage('playerJoin', (data, context) => {
  if (!context) return
  const playerAddress = context.from
  console.log(`[Server] Player joined: ${data.displayName} (${playerAddress})`)
})

// Client receives from server
room.onMessage('gameEvent', (data) => {
  console.log(`Event: ${data.eventType}`)
})
```

### Wait for State Sync
```typescript
import { isStateSyncronized } from '@dcl/sdk/network'

engine.addSystem(() => {
  if (!isStateSyncronized()) return
  room.send('playerJoin', { displayName: 'Player' })
})
```

### Server Liveness Heartbeat

`isStateSyncronized()` only confirms the CRDT room is connected — the room can be replaying a stale snapshot while the auth server is still cold-booting (or hasn't booted at all because this client is the first to arrive). Detect actual server liveness with a heartbeat the server pulses into a synced component, and on the client track the **time *you* observed the value change**, not the value itself. That sidesteps clock skew and prevents a stale snapshot from a previous server run from reading as alive.

```typescript
// shared/schemas.ts — add a heartbeat field to a state component
export const MatchState = engine.defineComponent('myscene::MatchState', {
  // ...other fields...
  serverHeartbeatAt: Schemas.Int64  // Int64 — Date.now() is 13 digits
})
```

```typescript
// server/matchLoop.ts — pulse the heartbeat from a system
import { isServer } from '@dcl/sdk/network'

const HEARTBEAT_MS = 2000
let lastHeartbeatAt = 0
let stateEntity: Entity | null = null

export function initMatchState(): void {
  stateEntity = engine.addEntity()
  // Publish a heartbeat immediately so the first client connecting after a
  // cold start can detect liveness without waiting a full interval.
  MatchState.create(stateEntity, { /* ...fields..., */ serverHeartbeatAt: Date.now() })
  syncEntity(stateEntity, [MatchState.componentId])
}

export function matchLoopSystem(): void {
  if (!isServer() || stateEntity === null) return
  const now = Date.now()
  if (now - lastHeartbeatAt < HEARTBEAT_MS) return
  lastHeartbeatAt = now
  MatchState.getMutable(stateEntity).serverHeartbeatAt = now
}
```

```typescript
// client/serverReadiness.ts — probe liveness from the client
import { engine } from '@dcl/sdk/ecs'
import { isStateSyncronized } from '@dcl/sdk/network'
import { MatchState } from '../shared/schemas'

const HEARTBEAT_FRESHNESS_MS = 6000  // ~3× the server interval

let lastSeenValue = 0
let lastSeenAtClient = 0

export function isServerAlive(): boolean {
  if (!isStateSyncronized()) return false
  for (const [, data] of engine.getEntitiesWith(MatchState)) {
    if (data.serverHeartbeatAt !== lastSeenValue) {
      lastSeenValue = data.serverHeartbeatAt
      lastSeenAtClient = Date.now()
    }
    break
  }
  if (lastSeenAtClient === 0) return false  // never observed a tick yet
  return Date.now() - lastSeenAtClient < HEARTBEAT_FRESHNESS_MS
}
```

### Handling the Two Failure Modes at the UI Layer

Room-not-synced and server-not-alive look similar but need different UX:

- **Room not synced** (~1 s during scene load, always resolves) — buffer the action and fire it from a retry system.
- **Server not alive** (up to ~15 s on cold start, may not resolve at all if the player abandons) — surface a popup; silent buffering feels like a broken click. Auto-clear the popup when a heartbeat finally lands.

```typescript
// client/joinAction.ts
import { isServerAlive } from './serverReadiness'

let pendingAction: 'join' | 'leave' | null = null
let serverNotReadyWarning = false

export function isServerNotReadyWarningVisible() { return serverNotReadyWarning }
export function dismissServerNotReadyWarning() { serverNotReadyWarning = false }

export function sendJoin(): void {
  if (!isServerAlive()) {
    serverNotReadyWarning = true   // tell the player; don't buffer silently
    return
  }
  pendingAction = 'join'  // retry system flushes once isStateSyncronized()
}

function joinActionRetrySystem(): void {
  // Auto-clear the popup the moment the server comes back online so a
  // player who waited isn't left staring at a stale dialog.
  if (serverNotReadyWarning && isServerAlive()) serverNotReadyWarning = false
  if (pendingAction === null || !isStateSyncronized()) return
  room.send(pendingAction === 'join' ? 'requestJoin' : 'leaveGame', { /* ... */ })
  pendingAction = null
}
engine.addSystem(joinActionRetrySystem)
```

## Schema Types Reference

The full schema-type list, with the verified `Schemas.Boolean` (not `Schemas.Bool`) and `Schemas.Int64`-for-timestamps notes, is in `{baseDir}/SKILL.md` → Schema Types Reference.

## Server Reading Player Positions

```typescript
import { engine, PlayerIdentityData, Transform } from '@dcl/sdk/ecs'

engine.addSystem(() => {
  for (const [entity, identity] of engine.getEntitiesWith(PlayerIdentityData)) {
    const transform = Transform.getOrNull(entity)
    if (!transform) continue
    const address = identity.address   // wallet address, verified by the server
    const position = transform.position // actual player position (not client-reported)
  }
})
```

Never trust client-reported positions. The server sees real positions via `PlayerIdentityData` + `Transform`.

## Storage

`Storage.set/get/delete` are top-level methods on `Storage` for scene-wide (global) values — there is no `Storage.world` namespace. `Storage.player.set/get/delete` is scoped by wallet address. Storage only accepts strings — `JSON.stringify()`/`JSON.parse()` for objects, `String()`/`parseInt()` for numbers. **Server-only** — guard with `isServer()`.

`set` and `delete` resolve to a **boolean**: `false` means the operation did not persist (network error, or the isolate's 40 in-flight host-call cap — the SDK logs the error and resolves `false` instead of throwing). Always check it. For the persist-at-checkpoints pattern and the cap details, see `{baseDir}/references/server-patterns.md` → Storage Patterns and Server Resource Limits.

### Scene Storage (Global, shared across all players)
```typescript
import { Storage } from '@dcl/sdk/server'

const ok = await Storage.set('leaderboard', JSON.stringify(leaderboardData))
if (!ok) { /* write failed — retry later or surface it, do not assume it saved */ }
const data = await Storage.get<string>('leaderboard')
if (data) { const leaderboard = JSON.parse(data) }
await Storage.delete('oldKey')
```

### Player Storage (Per-Player, scoped by wallet address)
```typescript
import { Storage } from '@dcl/sdk/server'

const saved = await Storage.player.set(playerAddress, 'highScore', String(score))
if (!saved) { /* write failed — keep the value dirty and retry at the next flush */ }
const raw = await Storage.player.get<string>(playerAddress, 'highScore')
const highScore = raw ? parseInt(raw) : 0
await Storage.player.delete(playerAddress, 'highScore')
```

### CLI Storage Commands
```bash
# Scene storage
npx sdk-commands storage scene set high_score --value 100
npx sdk-commands storage scene get high_score
npx sdk-commands storage scene delete high_score
npx sdk-commands storage scene clear --confirm

# Player storage
npx sdk-commands storage player set level --value 10 --address 0x1234...
npx sdk-commands storage player get level --address 0x1234...
npx sdk-commands storage player delete level --address 0x1234...
npx sdk-commands storage player clear --address 0x1234... --confirm
npx sdk-commands storage player clear --confirm
```

## Environment Variables

For `EnvVar.get` behavior (always-string return, `''` on unset or failed fetch, `|| 'fallback'` pattern) and concepts (secrets, write-only UI, live-tunable params) see `{baseDir}/SKILL.md` → Environment Variables.

```typescript
import { EnvVar } from '@dcl/sdk/server'
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

### Deploy to Production
```bash
npx sdk-commands storage env set MAX_PLAYERS --value 8
npx sdk-commands storage env delete OLD_VAR
npx sdk-commands storage env clear --confirm

# Target specific environment
npx sdk-commands storage env set MY_KEY --value my_value --target https://storage.decentraland.zone
```

## Performance: Throttling Messages

```typescript
let acc = 0
engine.addSystem((dt) => {
  acc += dt
  if (acc > 0.1) {
    room.send('position', transform.position)
    acc = 0
  }
})
```

## Performance: Atomic Components

```typescript
// BAD — changing the score also re-sends the positions array
const GameState = engine.defineComponent('GameState', {
  playerAScore: Schemas.Int,
  timer: Schemas.Int,
  playerPositions: Schemas.Array(Schemas.Vector3),
})

// GOOD — each update is small and independent
const PlayerScore = engine.defineComponent('PlayerScore', { playerA: Schemas.Int })
const GameTimer = engine.defineComponent('GameTimer', { secondsLeft: Schemas.Int })
```
