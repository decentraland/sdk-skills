# Runtime APIs Reference

Long-tail extensions to `scene-runtime/SKILL.md`. Core teaching (executeTask basics, the restricted-actions list + player-interaction rule, canonical action examples, realm/scene metadata, portable experiences) lives in the SKILL. This file holds only additional variants and the two restricted actions the SKILL imports but does not detail.

## executeTask Variants

Basic usage is in SKILL.md. Additional patterns:

```typescript
import { executeTask } from '@dcl/sdk/ecs'

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

## Restricted Actions — extended

The full list, the player-interaction rule, and canonical examples (`movePlayerTo`, `teleportTo`, `triggerEmote`, `openExternalUrl`, `openNftDialog`, `copyToClipboard`, `changeRealm`) are in SKILL.md. Details below extend those.

### movePlayerTo — rotate avatar in place

Params are documented in SKILL.md. To rotate the avatar without moving it, pass the current position as `newRelativePosition` and a facing point as `avatarTarget` (see the `80,-4-restricted-actions` "Rotate Avatar" buttons).

### triggerEmote — predefined emote names

`predefinedEmote` accepts: `'wave'`, `'dance'`, `'clap'`, `'robot'`, `'fistpump'`, `'raiseHand'`, etc.

### triggerSceneEmote — custom emote from .glb

Play a custom emote from a `.glb` file (imported in SKILL.md but not detailed there):

```typescript
import { triggerSceneEmote } from '~system/RestrictedActions'
triggerSceneEmote({ src: 'animations/custom_emote.glb', loop: false })
```

> ⚠️ **The file MUST end with `_emote.glb`** (case-insensitive). This is a hard runtime requirement — files without this suffix often work in `npm run start` preview but **silently fail in production** once the scene is deployed. Rename the file on disk, not just the string passed to `src`.

Valid filenames: `wave_emote.glb`, `Snowball_Throw_emote.glb`, `dance_EMOTE.GLB`
Invalid: `wave.glb`, `emote_wave.glb`, `wave_emote_v2.glb`

### setCommunicationsAdapter — custom comms

Change the scene's communication channel (imported in SKILL.md but not detailed there). Used for custom multiplayer infrastructure beyond the default CRDT sync:

```typescript
import { setCommunicationsAdapter } from '~system/RestrictedActions'
setCommunicationsAdapter({ adapter: 'wss://custom-comms.example.com/room/my-scene' })
```
