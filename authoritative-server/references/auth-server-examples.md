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
Score.validateBeforeChange((v) => v.senderAddress === AUTH_SERVER_PEER_ID)
```

### Pattern 2 — Validate the value itself
```typescript
if (isServer()) {
  Transform.validateBeforeChange(entity, (value) => {
    return value.position.y > 0
  })
}
```

### Pattern 3 — Proximity validation (anti-cheat)
```typescript
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
    if (isPreview()) return true
    return adminAddresses.has(value.senderAddress.toLowerCase())
  })
}
```

## Custom Components (Global Validation)

```typescript
import { engine, Schemas } from '@dcl/sdk/ecs'
import { AUTH_SERVER_PEER_ID } from '@dcl/sdk/network/message-bus-sync'

export const GameState = engine.defineComponent('game:State', {
  phase: Schemas.String,
  score: Schemas.Number,
  timeRemaining: Schemas.Number,
})

GameState.validateBeforeChange((value) => {
  return value.senderAddress === AUTH_SERVER_PEER_ID
})
```

## Built-in Components (Per-Entity Validation)

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

// Usage:
const entity = engine.addEntity()
Transform.create(entity, { position: Vector3.create(10, 5, 10) })
GltfContainer.create(entity, { src: 'assets/model.glb' })
protectServerEntity(entity, [Transform, GltfContainer])
```

## Syncing Entities

```typescript
import { syncEntity } from '@dcl/sdk/network'
syncEntity(entity, [Transform.componentId, GameState.componentId])
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

### World Storage (Global)
```typescript
await Storage.world.set('leaderboard', JSON.stringify(leaderboardData))
const data = await Storage.world.get<string>('leaderboard')
if (data) { const leaderboard = JSON.parse(data) }
await Storage.world.delete('oldKey')
```

### Player Storage (Per-Player)
```typescript
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
