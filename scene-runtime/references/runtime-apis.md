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

The full list, which actions need a player gesture (`openExplorerUi` only) or a confirmation, and canonical examples (`teleportTo`, `openExternalUrl`, `openNftDialog`, `copyToClipboard`, `changeRealm`) are in SKILL.md → *Restricted Actions*. `movePlayerTo` and emotes live in **player-avatar**. Details below extend those.

### teleportTo — signature

```typescript
teleportTo({ worldCoordinates?: Vector2, realm?: string }): Promise<TeleportToResponse>
```

Both fields optional (`@dcl/js-runtime` 7.28.0+). `realm` = World name (`foo.dcl.eth`) or realm URL; setting it shows the player a confirmation prompt (default text, not customizable), and on acceptance forces a full reconnect, then lands on the parcel. `realm` with no `worldCoordinates` = that realm's default spawn. `changeRealm` is `[DEPRECATED]` in favor of this — see SKILL.md for the race condition it fixes.

### movePlayerTo, triggerEmote, triggerSceneEmote

Player movement and emotes, including the `_emote.glb` naming rule and the `src` path rule: **player-avatar** → *Teleporting the Player* and *Triggering Emotes*.

### setCommunicationsAdapter — custom comms

Change the scene's communication channel (imported in SKILL.md but not detailed there). Used for custom multiplayer infrastructure beyond the default CRDT sync:

```typescript
import { setCommunicationsAdapter } from '~system/RestrictedActions'
setCommunicationsAdapter({ adapter: 'wss://custom-comms.example.com/room/my-scene' })
```
