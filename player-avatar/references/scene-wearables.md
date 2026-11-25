# Scene Wearables Reference

Companion to *Dress the Player (Scene Wearables)* in `player-avatar/SKILL.md`. Read that first. This file is the single source of truth for `AvatarShape` on player entities, wearable `.glb` files shipped in a scene, and `AvatarEquippedData.wearables`; other skills point here.

## SDK versions

- Dressing (`AvatarShape` on a player entity, `.glb` paths in `wearables`) works on `@dcl/sdk` 7.33.0 (`latest`).
- `AvatarEquippedData.wearables` needs an SDK newer than 7.33.0: `@dcl/sdk@next` (or `@dcl/sdk@auth-server`) until the next release. On 7.33.0 the compiler reports `Property 'wearables' does not exist on type 'PBAvatarEquippedData'. Did you mean 'wearableUrns'?`. Check the installed typings, not the version string (**sdk-scenes** → *A feature that needs a newer SDK*).
- In those SDKs `wearables` is a required field: code that creates `AvatarEquippedData` itself (mocks, tests) passes `wearables: []`.

## Fields on a player entity

Player entities are `engine.PlayerEntity` and the entities that carry `PlayerIdentityData`. On any other entity `AvatarShape` draws an NPC with its own defaults (**npcs**); scene `.glb` paths work there too.

| Field | On a player entity |
| --- | --- |
| `wearables`, non-empty | Replaces the whole profile set, profile force-render included. A category the list leaves out stays **empty**: no hair, bare legs and feet. The first 32 entries apply. |
| `wearables: []` | Keeps the profile wearables. An empty list is the same as unset. |
| `bodyShape` | Applies when set. Must be exactly `urn:decentraland:off-chain:base-avatars:BaseMale` or `...:BaseFemale` (case-sensitive); any other value gives the male body and a warning. |
| `skinColor`, `hairColor`, `eyeColor` | Each applies when set (RGB). |
| `showOnlyWearables` | `true` hides skin, hair and face. |
| `id`, `name`, `emotes`, `expressionTriggerId`, `expressionTriggerTimestamp`, `talking` | Ignored. The nametag keeps the profile name (label a role with `AvatarNametag`); play emotes with `triggerEmote` / `triggerSceneEmote`. `id` and `emotes` are still required by the type. |
| Any other unset field | Keeps the profile value. |

**Lifecycle details:**

- The scene sees a remote player (their entity has `PlayerIdentityData`) only while that player stands on its parcels, so it can dress others only there.
- The local player leaving the parcels drops the override; coming back re-applies it with no new write. The same holds for a remote player who walks out and back on the same entity.
- Backpack changes don't override it: each profile change is re-merged with the scene's fields. Newly equipped items stay off while a non-empty `wearables` is set. To lock the whole look, also set `bodyShape` and the three colors.
- Rewriting identical values does not reload the avatar; any changed value reloads all of it. The new look appears only once every item has resolved, so one slow item delays the whole outfit.
- Backpack and passport show the real profile.

## Recipes

### Write only on change: `dressPlayer`

Every recipe below uses this helper (`src/dress.ts`). It writes only when the value changes, keys the last write by player address, and forgets players who left the scene.

```typescript
import { AvatarShape, Entity, PBAvatarShape, PlayerIdentityData } from '@dcl/sdk/ecs'

const written = new Map<Entity, string>()

// `undefined` restores the profile look
export function dressPlayer(player: Entity, shape: Partial<PBAvatarShape> | undefined) {
	const identity = PlayerIdentityData.getOrNull(player)
	if (!identity) return
	// Remote player entity ids are reused, so the key includes the address
	const key = identity.address + JSON.stringify(shape ?? null)
	if (written.get(player) === key) return
	written.set(player, key)
	if (shape) AvatarShape.createOrReplace(player, { id: identity.address, emotes: [], wearables: [], ...shape })
	else AvatarShape.deleteFrom(player)
}

// Run every tick before dressing: a player who comes back is dressed again
export function forgetPlayersWhoLeft() {
	for (const player of [...written.keys()]) {
		if (PlayerIdentityData.has(player)) continue
		AvatarShape.deleteFrom(player)
		written.delete(player)
	}
}
```

### Full replacement: a uniform with male and female variants

The default recipe. List the whole outfit and leave the profile items out. Body-hugging items need a model per body shape; pick it by `AvatarBase.bodyShapeUrn`, the profile body.

```typescript
import { AvatarBase, engine } from '@dcl/sdk/ecs'
import { dressPlayer } from './dress'

const BASE = 'urn:decentraland:off-chain:base-avatars:'

// Every category the look needs: a category left out stays empty
function uniform(female: boolean): string[] {
	return [
		BASE + 'short_hair',
		BASE + 'brown_pants',
		BASE + 'classic_shoes',
		female ? 'wearables/jersey/jersey_f_upper_body.glb' : 'wearables/jersey/jersey_m_upper_body.glb',
		'wearables/cap/cap_hat.glb', // a rigid item fits both bodies
	]
}

engine.addSystem(() => {
	const avatarBase = AvatarBase.getOrNull(engine.PlayerEntity)
	if (!avatarBase) return // wait for the profile's body shape
	const female = avatarBase.bodyShapeUrn.toLowerCase().endsWith(':basefemale')
	dressPlayer(engine.PlayerEntity, { wearables: uniform(female) })
})
```

When the scene also sets `bodyShape`, pick the variant by the body it sets: `AvatarBase` keeps reporting the profile body.

### Add on top of the profile outfit

```typescript
import { AvatarBase, AvatarEquippedData, engine } from '@dcl/sdk/ecs'
import { dressPlayer } from './dress'

const KILT = { male: 'wearables/kilt/kilt_m_lower_body.glb', female: 'wearables/kilt/kilt_f_lower_body.glb' }

engine.addSystem(() => {
	const equipped = AvatarEquippedData.getOrNull(engine.PlayerEntity)
	const avatarBase = AvatarBase.getOrNull(engine.PlayerEntity)
	if (!equipped || !avatarBase) return
	const female = avatarBase.bodyShapeUrn.toLowerCase().endsWith(':basefemale')
	// The scene item goes last: the later item of a category wins
	dressPlayer(engine.PlayerEntity, { wearables: [...equipped.wearableUrns, female ? KILT.female : KILT.male] })
})
```

- The scene item replaces only the profile item of its own category. Profile items of other categories stay and can overlap it (profile dungarees and a scene kilt both show).
- `wearableUrns` is part of the written value, so a Backpack change re-dresses the player.

### Same outfit, other look

An empty `wearables` keeps the profile items; the other fields combine with each other and with either recipe above.

```typescript
import { engine } from '@dcl/sdk/ecs'
import { Color3 } from '@dcl/sdk/math'
import { dressPlayer } from './dress'

const BASE = 'urn:decentraland:off-chain:base-avatars:'

// Alternatives: each call replaces the previous shape
export function lookAlternatives() {
	dressPlayer(engine.PlayerEntity, { skinColor: Color3.Green(), hairColor: Color3.Red(), wearables: [] })
	dressPlayer(engine.PlayerEntity, { bodyShape: BASE + 'BaseFemale', wearables: [] })
	dressPlayer(engine.PlayerEntity, { showOnlyWearables: true, wearables: [] })
	dressPlayer(engine.PlayerEntity, undefined) // back to the profile look
}
```

Leaving the scene restores the profile look with no write.

### Everyone sees it: team uniforms with an authoritative server

Each client shows only the `AvatarShape` it writes itself. For everyone to see the same outfits, the scene syncs *who wears what*, and every client dresses every player from it. Here the synced state is a `Teams` component that only the Multiplayer Server writes, so a client cannot dress someone else. It needs `@dcl/sdk@auth-server`: ask the user before switching (**authoritative-server**). The client half works the same with any synced state (**multiplayer-sync**).

```
src/index.ts            server / client split
src/shared/teams.ts     synced Teams component + joinTeam message
src/server/server.ts    the only writer of Teams
src/client/client.ts    dresses every player from Teams
src/client/dress.ts     dressPlayer + forgetPlayersWhoLeft (above)
wearables/red_jersey/red_jersey_m_upper_body.glb, red_jersey_f_upper_body.glb, textures
wearables/blue_jersey/...
```

```typescript
// src/index.ts
import { isServer } from '@dcl/sdk/network'
// registerMessages() defines a component, so the shared module loads before the engine seals
import './shared/teams'

export async function main() {
	if (isServer()) {
		const { startServer } = await import('./server/server')
		startServer()
		return
	}
	const { startClient } = await import('./client/client')
	startClient()
}
```

```typescript
// src/shared/teams.ts
import { engine, Schemas } from '@dcl/sdk/ecs'
import { registerMessages } from '@dcl/sdk/network'

export const TEAM_NAMES = ['red', 'blue']

// keys[i] is a lower-case player address, teams[i] its team. Only the server writes it.
export const Teams = engine.defineComponent('teams::Teams', {
	keys: Schemas.Array(Schemas.String),
	teams: Schemas.Array(Schemas.String),
})

export const room = registerMessages({ joinTeam: Schemas.Map({ team: Schemas.String }) })
```

```typescript
// src/server/server.ts
import { engine, Entity, PlayerIdentityData } from '@dcl/sdk/ecs'
import { syncEntity } from '@dcl/sdk/network'
import { AUTH_SERVER_PEER_ID } from '@dcl/sdk/network/message-bus-sync'
import { room, TEAM_NAMES, Teams } from '../shared/teams'

const teams = new Map<string, string>()
let teamsEntity: Entity

export function startServer() {
	Teams.validateBeforeChange((value) => value.senderAddress.toLowerCase() === AUTH_SERVER_PEER_ID.toLowerCase())
	teamsEntity = engine.addEntity()
	Teams.create(teamsEntity, { keys: [], teams: [] })
	syncEntity(teamsEntity, [Teams.componentId])

	room.onMessage('joinTeam', (data, context) => {
		// Allow-list with includes(): an `in` check also accepts 'constructor'
		if (!context || !TEAM_NAMES.includes(data.team)) return
		// The key is the verified sender, never an address from the payload
		teams.set(context.from.toLowerCase(), data.team)
		publish()
	})

	engine.addSystem(dropPlayersWhoLeft)
}

function publish() {
	const state = Teams.getMutable(teamsEntity)
	state.keys = [...teams.keys()]
	state.teams = [...teams.values()]
}

let elapsed = 0
function dropPlayersWhoLeft(dt: number) {
	elapsed += dt
	if (elapsed < 2) return
	elapsed = 0
	const present = new Set<string>()
	for (const [, identity] of engine.getEntitiesWith(PlayerIdentityData)) present.add(identity.address.toLowerCase())
	let changed = false
	for (const key of [...teams.keys()]) {
		if (present.has(key)) continue
		teams.delete(key)
		changed = true
	}
	if (changed) publish()
}
```

```typescript
// src/client/client.ts
import { AvatarBase, engine, Entity, PlayerIdentityData } from '@dcl/sdk/ecs'
import { room, Teams } from '../shared/teams'
import { dressPlayer, forgetPlayersWhoLeft } from './dress'

const BASE = 'urn:decentraland:off-chain:base-avatars:'

function uniform(team: string, female: boolean): string[] {
	return [
		BASE + 'short_hair',
		BASE + 'brown_pants',
		BASE + 'classic_shoes',
		`wearables/${team}_jersey/${team}_jersey_${female ? 'f' : 'm'}_upper_body.glb`,
	]
}

// Call from a button or a trigger area
export function joinTeam(team: string) {
	void room.send('joinTeam', { team })
}

export function startClient() {
	engine.addSystem(dressTeamsSystem)
}

function dressTeamsSystem() {
	forgetPlayersWhoLeft()

	const teamOf = new Map<string, string>()
	for (const [, state] of engine.getEntitiesWith(Teams)) state.keys.forEach((key, i) => teamOf.set(key, state.teams[i]))

	// Collect first: writing AvatarShape inside the getEntitiesWith loop can break the iterator
	const players: { player: Entity; address: string; female: boolean }[] = []
	for (const [player, identity] of engine.getEntitiesWith(PlayerIdentityData)) {
		const avatarBase = AvatarBase.getOrNull(player)
		if (!avatarBase) continue // dress once the body shape is known
		const female = avatarBase.bodyShapeUrn.toLowerCase().endsWith(':basefemale')
		players.push({ player, address: identity.address.toLowerCase(), female })
	}

	// AvatarShape on a player shows only on the client that writes it, so every client dresses every player
	for (const { player, address, female } of players) {
		const team = teamOf.get(address)
		dressPlayer(player, team ? { wearables: uniform(team, female) } : undefined)
	}
}
```

What each part covers:

- **Late joiners** see every uniform at once: `Teams` arrives with the synced state and their client dresses everyone.
- **A player who leaves** loses their entry on the server within 2 s, and every client deletes their `AvatarShape` (`forgetPlayersWhoLeft`). A returning player joins a team again.
- **Reused entity ids:** a new player on a recycled entity has another address, so `dressPlayer` writes again.
- **No per-tick writes:** `dressPlayer` writes only when a player's team or body changes.

## Scene `.glb` files

Checklist for a wearable the scene ships:

- [ ] `.glb` only (any case). A `.gltf` is skipped.
- [ ] The file name ends with `_<category>.glb`, one of the 14 categories: `upper_body`, `lower_body`, `feet`, `hands_wear`, `hat`, `helmet`, `top_head`, `mask`, `eyewear`, `earring`, `tiara`, `hair`, `facial_hair`, `skin`. The longest match wins: `beard_facial_hair.glb` is `facial_hair`. `eyes`, `eyebrows` and `mouth` (PNG items), `body_shape` and `hands` are not categories.
- [ ] The entry is the path from the project root, as in the scene content: `'wearables/jersey/jersey_m_upper_body.glb'` (case-insensitive), written without `./` or a leading `/`. `.dclignore` must not exclude it.
- [ ] Textures are embedded in the GLB, or sit in the **same folder** as the GLB. Subfolders and `../` are not read. Give each item its own folder.
- [ ] One model serves both bodies. Ship `_m_` / `_f_` variants of body-hugging items (a naming convention; the category suffix still comes last) and let the scene pick.
- [ ] The model is skinned to the Decentraland avatar armature. Model it with the **wearables** skill: its base meshes, rig, skinning and category limits apply. The Builder upload, thumbnail and hide settings do not: a scene item hides nothing, so a hat cannot hide the hair (leave hair out of a full replacement, or ship a `_hair.glb`).
- [ ] A deployed scene shows its items only once its asset bundles are converted: until then every `.glb` entry is skipped (`the scene has no asset bundle manifest`), with no fallback. In `npm run start` preview they load without waiting for a conversion, so a working preview does not prove the deployed scene.

The same file in two folders is two items; an edited file is a new item (preview hot reload picks it up).

## Which items show

- **Same category twice:** the later entry wins; the earlier one renders nothing and hides nothing. This holds on every avatar, NPCs included.
- **A scene `.glb` always renders and hides nothing**, and no other item hides it. A catalog helmet that hides `hair` does not hide scene hair. A scene `upper_body` leaves the hands visible.
- **Exception, `skin`:** a scene `skin` hides the body, face, hair and the catalog items in the body categories. Scene items still show over it.
- **Catalog URNs** keep their own hides and replaces. Ownership is not checked: any catalog URN can be listed.
- **Skipped entries** (see *Troubleshooting*) take no slot. If every entry is skipped, the list counts as empty and the player keeps the profile look. A catalog URN that fails to load does take a slot, so a list of only broken URNs leaves the player with no wearables.
- An item that fails to load is dropped, and hiding is worked out without it.
- **Not possible:** keeping some profile categories and replacing others (the player's own hair with the scene's clothes; `AvatarEquippedData` has no categories), hiding a profile item with a scene item of another category, changing the name, emotes or expressions. To hide the player entirely, use `AvatarModifierArea` (`AMT_HIDE_AVATARS`).
- `AvatarShape` on a player does nothing in a portable experience or a smart wearable.

## Read what the player wears: `AvatarEquippedData`

Read-only, written by the Explorer on `engine.PlayerEntity` and every remote player entity. It describes the **profile** outfit, never the scene's override: scene items never appear in it, and its flags do not change when the scene dresses the player.

- `wearableUrns`: profile item URNs, facial features included.
- `wearables`: one `{ urn, visible? }` per `wearableUrns` entry, same order, full URN. SDK newer than 7.33.0.
  - `visible: true`: the item shows in the profile outfit after hides, replaces and force render.
  - `visible: false`: hidden by another item, replaced by a later item of its category, or its metadata failed to load.
  - `visible` unset: the outfit is still loading. All entries are unset together, then the component is written again with the flags. After 60 s without a result they stay unset until the next profile change.

```typescript
import { AvatarEquippedData, engine } from '@dcl/sdk/ecs'

AvatarEquippedData.onChange(engine.PlayerEntity, (equipped) => {
	if (!equipped) return
	if (equipped.wearables.some((w) => w.visible === undefined)) return // still loading: all flags are unset together
	const shown = equipped.wearables.filter((w) => w.visible).map((w) => w.urn)
	console.log('Profile items on show:', shown)
})
```

Handle `undefined` and an empty `wearables`; fall back to `wearableUrns` when the flags never arrive. To know what the scene put on a player, keep your own record (the `written` map above).

## Troubleshooting

The Explorer logs each skipped entry as a warning, `Scene wearable '<entry>' skipped: <reason>`:

| Reason | Fix |
| --- | --- |
| `it is neither a URN nor a '.glb' path` | Use a catalog URN or a `.glb` path (a `.gltf`, `.json` or a bare name is skipped) |
| `the file name must end with '_<category>.glb' using a supported category` | Rename to `<name>_<category>.glb` with one of the 14 categories |
| `the file is not part of the scene content` | Fix the path (from the project root, no `./`), check `.dclignore` |
| `the scene has no asset bundle manifest` | Deployed scene not converted yet: wait for the asset bundles |
| `it is not a wearable seeded by this scene` | A `scene-wearable` URN from another scene or from logs: list the `.glb` path instead |

`AvatarShape on a player has N wearables, only the first 32 apply` means the list is too long.

| Symptom | Cause |
| --- | --- |
| Player keeps the profile look | Every entry was skipped; `wearables: []`; the player is off the scene's parcels; a deployed scene's asset bundles are not ready |
| Player is bald or barefoot | A non-empty list replaces everything: list hair and shoes too |
| Other players don't see it | Each client writes its own; dress every player on every client (*Everyone sees it*) |
| Profile item overlaps the scene item | Different categories: use full replacement, or an item of the same category |
| A female avatar clips through a jacket | The male model on a female body: pick the variant by body shape |
| Name or emote does not change | Ignored on player entities |
| Avatar reloads over and over | A value changes every tick (an animated color, a list built in a different order): write only on change |
| A returning player stays in the profile look | The scene still remembers its last write to that entity: run `forgetPlayersWhoLeft` |
| `visible` is always `undefined` | Still loading, or the 60 s wait ran out |
