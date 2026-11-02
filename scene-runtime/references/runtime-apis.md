# Runtime APIs Reference

Long-tail extensions to `scene-runtime/SKILL.md`. Core teaching (executeTask basics, the restricted-actions list + player-interaction rule, canonical action examples, realm/scene metadata) lives in the SKILL. This file holds additional variants, the restricted actions the SKILL imports but does not detail, and portable experiences.

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

Both fields optional (`@dcl/js-runtime` 7.28.0+). `realm` = World name (`foo.dcl.eth`) or realm URL; setting it shows the player a confirmation prompt (default text, not customizable), and on acceptance forces a full reconnect (even to the realm the player is already in), then lands on the parcel. `realm` with no `worldCoordinates` = that realm's default spawn; no `realm` = teleport within the current realm. `changeRealm` is `[DEPRECATED]` in favor of this — see SKILL.md for the race condition it fixes.

### movePlayerTo, triggerEmote, triggerSceneEmote

Player movement and emotes, including the `_emote.glb` naming rule and the `src` path rule: **player-avatar** → *Teleporting the Player* and *Triggering Emotes*.

### setCommunicationsAdapter — custom comms

Change the scene's communication channel (imported in SKILL.md but not detailed there). Used for custom multiplayer infrastructure beyond the default CRDT sync:

```typescript
import { setCommunicationsAdapter } from '~system/RestrictedActions'
setCommunicationsAdapter({ adapter: 'wss://custom-comms.example.com/room/my-scene' })
```

## Portable Experiences

Scenes that persist across world navigation. Import from `~system/PortableExperiences`.

```typescript
import {
  spawn,
  kill,
  exit,
  getPortableExperiencesLoaded,
} from "~system/PortableExperiences";

// Spawn by ENS name (a deployed World) OR by pid. NOT by "urn".
const result = await spawn({ ens: "boedo.dcl.eth" });
// result: { pid, parentCid, name, ens }

// Kill a running one by its pid (from the spawn response). NOT by urn.
if (result.pid) await kill({ pid: result.pid });

// List currently loaded portable experiences
const { loaded } = await getPortableExperiencesLoaded({});

// Exit self (only if THIS scene IS a portable experience)
await exit({});
```

- `spawn({ ens?, pid? })` → `SpawnResponse { pid, parentCid, name, ens? }`. Field is `ens`/`pid`, **not `urn`**.
- `kill({ pid })` returns `{ status: boolean }`; `kill({ pid })` and `getPortableExperiencesLoaded({})` both key off `pid`, never `urn`.
- To build a portable experience that runs while a wearable is equipped, see the **smart-wearables** skill.
- The **host scene** must enable them in `scene.json`: `"featureToggles": { "portableExperiences": "enabled" }`. Values: `"enabled"` | `"disabled"` | `"hideUi"` (spawns PX but hides their UI). With `"disabled"`, `spawn()` is a no-op / rejected.
