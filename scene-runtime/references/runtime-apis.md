# Runtime APIs Reference

## executeTask Patterns

All async work must be wrapped in `executeTask()` or async functions — bare promises are silently dropped:

```typescript
import { executeTask } from '@dcl/sdk/ecs'

// Basic async operation
executeTask(async () => {
	const res = await fetch('https://api.example.com/data')
	const data = await res.json()
	console.log(data)
})

// With error handling
executeTask(async () => {
	try {
		const res = await fetch('https://api.example.com/data')
		if (!res.ok) throw new Error(`HTTP ${res.status}`)
		const data = await res.json()
		// Use data
	} catch (error) {
		console.error('Failed:', error)
	}
})

// Sequential async operations
executeTask(async () => {
	const config = await loadConfig()
	const data = await fetchData(config.apiUrl)
	initializeScene(data)
})
```

## All Restricted Actions

Import from `~system/RestrictedActions`. These require prior player interaction (e.g., a click) before they execute.

### movePlayerTo

Move the player to a position within scene bounds:

```typescript
import { movePlayerTo } from '~system/RestrictedActions'

movePlayerTo({
	newRelativePosition: { x: 8, y: 0, z: 8 }, // required
	cameraTarget: { x: 8, y: 1, z: 12 },       // optional: where the CAMERA looks
	avatarTarget: { x: 8, y: 0, z: 12 },       // optional: where the AVATAR faces
	duration: 2,                               // optional: seconds; glide instead of snap
})
```

Rotate the avatar in place by passing the current position as `newRelativePosition` and a facing point as `avatarTarget` (see the `80,-4-restricted-actions` "Rotate Avatar" buttons).

### teleportTo

Teleport to Genesis City coordinates:

```typescript
import { teleportTo } from '~system/RestrictedActions'
teleportTo({ worldCoordinates: { x: 50, y: 70 } })
```

### triggerEmote

Play a built-in avatar emote:

```typescript
import { triggerEmote } from '~system/RestrictedActions'
triggerEmote({ predefinedEmote: 'wave' })
// Available: 'wave', 'dance', 'clap', 'robot', 'fistpump', 'raiseHand', etc.
```

### triggerSceneEmote

Play a custom emote from a `.glb` file.

> ⚠️ **The file MUST end with `_emote.glb`** (case-insensitive). This is a hard runtime requirement — files without this suffix often work in `npm run start` preview but **silently fail in production** once the scene is deployed. Rename the file on disk, not just the string passed to `src`.

```typescript
import { triggerSceneEmote } from '~system/RestrictedActions'
triggerSceneEmote({ src: 'animations/custom_emote.glb', loop: false })
```

Valid filenames: `wave_emote.glb`, `Snowball_Throw_emote.glb`, `dance_EMOTE.GLB`
Invalid: `wave.glb`, `emote_wave.glb`, `wave_emote_v2.glb`

### openExternalUrl

Open a URL in the player's browser (shows confirmation prompt):

```typescript
import { openExternalUrl } from '~system/RestrictedActions'
openExternalUrl({ url: 'https://decentraland.org' })
```

### openNftDialog

Show an NFT detail dialog:

```typescript
import { openNftDialog } from '~system/RestrictedActions'
openNftDialog({
	urn: 'urn:decentraland:ethereum:erc721:0x06012c8cf97BEaD5deAe237070F9587f8E7A266d:558536',
})
```

### copyToClipboard

Copy text to the player's clipboard:

```typescript
import { copyToClipboard } from '~system/RestrictedActions'
copyToClipboard({ value: 'Hello from Decentraland!' })
```

### changeRealm

Prompt the player to switch to a different realm:

`message` is optional — omit it to switch with no prompt, include it to show a confirmation dialog.

```typescript
import { changeRealm } from '~system/RestrictedActions'
changeRealm({ realm: 'https://peer.decentraland.org' })                 // no prompt
changeRealm({ realm: 'other-realm.dcl.eth', message: 'Join this realm?' }) // prompts
```

### setCommunicationsAdapter

Change the communications adapter for the scene:

```typescript
import { setCommunicationsAdapter } from '~system/RestrictedActions'
setCommunicationsAdapter({ adapter: 'wss://custom-comms.example.com' })
```

## Realm Detection Patterns

```typescript
import { getRealm } from '~system/Runtime'

executeTask(async () => {
	const realm = await getRealm({})
	const info = realm.realmInfo

	// Check if running in preview
	if (info?.isPreview) {
		console.log('Running in preview mode')
	}

	// Get realm name and network
	console.log('Realm:', info?.realmName) // e.g., "peer-us-1"
	console.log('Network:', info?.networkId) // 1 = mainnet, 5 = goerli
	console.log('Base URL:', info?.baseUrl)
	console.log('Comms:', info?.commsAdapter)
})
```

### Common Pattern: Preview-Only Debug Features

```typescript
executeTask(async () => {
	const realm = await getRealm({})
	if (realm.realmInfo?.isPreview) {
		enableDebugPanel()
		enableFreeCam()
	}
})
```

## Scene Information

```typescript
import { getSceneInformation } from '~system/Runtime'

executeTask(async () => {
	const scene = await getSceneInformation({})
	const metadata = JSON.parse(scene.metadataJson)

	console.log('URN:', scene.urn)
	console.log('Base URL:', scene.baseUrl)
	console.log('Parcels:', metadata.scene?.parcels)
	console.log('Title:', metadata.display?.title)
})
```

## Read Deployed Files

Read data files shipped with the scene:

```typescript
import { readFile } from '~system/Runtime'

executeTask(async () => {
	const result = await readFile({ fileName: 'data/config.json' })
	const text = new TextDecoder().decode(result.content)
	const config = JSON.parse(text)
})
```

## Portable Experiences

Scenes that persist across world navigation. Import from `~system/PortableExperiences`.

```typescript
import {
	spawn,
	kill,
	exit,
	getPortableExperiencesLoaded,
} from '~system/PortableExperiences'

// Spawn by ENS (a deployed World) or by pid — NOT by "urn".
const result = await spawn({ ens: 'boedo.dcl.eth' })
// SpawnResponse: { pid, parentCid, name, ens? }

// List loaded portable experiences
const { loaded } = await getPortableExperiencesLoaded({})

// Kill by pid (from the spawn response) — NOT by urn.
if (result.pid) await kill({ pid: result.pid })

// Exit self (only if this scene IS a portable experience)
await exit({})
```

- Request/response keys are `ens` / `pid`, never `urn`.
- `kill({ pid })` returns `{ status: boolean }`.
- The host `scene.json` must set `"featureToggles": { "portableExperiences": "enabled" }` (or `"hideUi"`); `"disabled"` suppresses spawning.

### Example scenes

- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/8,8-portable-experience — `spawn`/`kill` wired to primary/secondary click; toggle `enabled`.
- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/8,9-portable-experience-disabled — `portableExperiences: "disabled"` in `scene.json`.
- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/8,7-portable-experience-hide-ui — `portableExperiences: "hideUi"` in `scene.json`.

## CommsAdapter

Custom communication channels between players:

```typescript
import { setCommunicationsAdapter } from '~system/RestrictedActions'

// Switch to a custom WebSocket-based comms adapter
setCommunicationsAdapter({
	adapter: 'wss://custom-comms-server.example.com/room/my-scene',
})
```

Used for custom multiplayer infrastructure beyond the default CRDT sync.
