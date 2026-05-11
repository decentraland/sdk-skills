# Authoritative Server Code Examples

## Setup

### Install auth-server SDK branch (MANDATORY)
```bash
npm install @dcl/sdk@auth-server
npm install @dcl/js-runtime@auth-server
```

### scene.json Configuration
```json
{
  "logsPermissions": ["0xYourWalletAddress"]
}
```

`worldConfiguration.name` is only needed when deploying to a World — not required for Genesis City LAND. Auth server is supported on both Genesis City and Worlds (including multi-scene Worlds).

## Server/Client Branching

```typescript
import { isServer } from '@dcl/sdk/network'

export async function main() {
  if (isServer()) {
    const { server } = await import('./server/server')
    server()
    return
  }
  setupClient()
  setupUi()
}
```

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

The component itself is defined at module scope so both server and client can import its `componentId` / type. **But the `validateBeforeChange()` call must be wrapped in `isServer()`** — both the per-entity and the no-entity (global) overloads produce errors on the client. Put the validate call inside `main()`/`initServer()` or inside an `if (isServer()) { ... }` block in the shared file.

```typescript
import { engine, Schemas } from '@dcl/sdk/ecs'
import { isServer } from '@dcl/sdk/network'
import { AUTH_SERVER_PEER_ID } from '@dcl/sdk/network/message-bus-sync'

// Shared: component definition itself runs on both sides
export const GameState = engine.defineComponent('game:State', {
  phase: Schemas.String,
  score: Schemas.Int,
  timeRemaining: Schemas.Int,
})

// Server-only: register the validator inside an isServer() guard
if (isServer()) {
  GameState.validateBeforeChange((value) => {
    // value: { entity, currentValue, newValue, senderAddress, createdBy }
    return value.senderAddress === AUTH_SERVER_PEER_ID
  })
}
```

## Built-in Components (Per-Entity Validation)

```typescript
import { engine, Entity, Transform, GltfContainer } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'
import { isServer } from '@dcl/sdk/network'
import { AUTH_SERVER_PEER_ID } from '@dcl/sdk/network/message-bus-sync'

// Minimal structural type used by the helper below. The real callback receives
// { entity, currentValue, newValue, senderAddress, createdBy } — this helper
// only reads senderAddress so it widens to just that field.
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

// Always call protectServerEntity() inside isServer() — it wraps
// validateBeforeChange(), which only has meaning on the server.
// Calling it on a client produces errors.
if (isServer()) {
  const entity = engine.addEntity()
  Transform.create(entity, { position: Vector3.create(10, 5, 10) })
  GltfContainer.create(entity, { src: 'assets/model.glb' })
  protectServerEntity(entity, [Transform, GltfContainer])
}
```

## Syncing Entities

In an authoritative-server scene, **only the server calls `syncEntity()`** — guard with `isServer()`. The server creates the entity instance and clients get synced about it. This differs from serverless `multiplayer-sync`, where every client calls `syncEntity` on its own. Calling `syncEntity` on the client in an authoritative scene produces errors.

```typescript
import { isServer, syncEntity } from '@dcl/sdk/network'

if (isServer()) {
  syncEntity(entity, [Transform.componentId, GameState.componentId], 1)
}
```

## Messages

### Define Messages
```typescript
import { Schemas } from '@dcl/sdk/ecs'
import { registerMessages } from '@dcl/sdk/network'

export const Messages = {
  playerJoin: Schemas.Map({ displayName: Schemas.String }),
  playerAction: Schemas.Map({ actionType: Schemas.String, data: Schemas.Number }),
  gameEvent: Schemas.Map({ eventType: Schemas.String, playerName: Schemas.String }),
}

export const room = registerMessages(Messages)
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

## Schema Types Reference

```typescript
Schemas.String          // "hello"
Schemas.Int             // 42
Schemas.Float           // 3.14
Schemas.Bool            // true / false
Schemas.Int64           // Date.now() / 13+ digit numbers
Schemas.Vector3
Schemas.Quaternion
Schemas.Entity          // entity reference
Schemas.Array(Schemas.String)
Schemas.Optional(Schemas.String)
Schemas.Map({ name: Schemas.String, hp: Schemas.Int })
```

## Server Reading Player Positions

```typescript
import { engine, PlayerIdentityData, Transform } from '@dcl/sdk/ecs'

engine.addSystem(() => {
  for (const [entity, identity] of engine.getEntitiesWith(PlayerIdentityData)) {
    const transform = Transform.getOrNull(entity)
    if (!transform) continue
    const address = identity.address
    const position = transform.position
  }
})
```

## Storage

`Storage.set/get/delete` are top-level methods on `Storage` for scene-wide (global) values — there is no `Storage.world` namespace. `Storage.player.set/get/delete` is scoped by wallet address. Storage only accepts strings — `JSON.stringify()`/`JSON.parse()` for objects, `String()`/`parseInt()` for numbers. **Server-only** — guard with `isServer()`.

### Scene Storage (Global, shared across all players)
```typescript
import { Storage } from '@dcl/sdk/server'

await Storage.set('leaderboard', JSON.stringify(leaderboardData))
const data = await Storage.get<string>('leaderboard')
if (data) { const leaderboard = JSON.parse(data) }
await Storage.delete('oldKey')
```

### Player Storage (Per-Player, scoped by wallet address)
```typescript
import { Storage } from '@dcl/sdk/server'

await Storage.player.set(playerAddress, 'highScore', String(score))
const saved = await Storage.player.get<string>(playerAddress, 'highScore')
const highScore = saved ? parseInt(saved) : 0
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

`EnvVar.get(key: string): Promise<string>` — always resolves to a string. Returns `''` (empty string) when the variable isn't set or the fetch fails; never returns `undefined`. The `|| 'fallback'` pattern still works because `'' || 'x'` evaluates to `'x'`.

```typescript
import { EnvVar } from '@dcl/sdk/server'
const maxPlayers = parseInt((await EnvVar.get('MAX_PLAYERS')) || '4')
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
