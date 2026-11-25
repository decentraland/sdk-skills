# Scene Wearables Reference

Companion to *Dress the Player (Scene Wearables)* in `player-avatar/SKILL.md`; read that first. Single source of truth for `AvatarShape` on player entities, wearable `.glb` files shipped in a scene, and `AvatarEquippedData.wearables`.

## Fields on a player entity

Player entities are `engine.PlayerEntity` and the entities that carry `PlayerIdentityData`. On any other entity `AvatarShape` draws an NPC with its own defaults (**npcs**); scene `.glb` paths work there too.

| Field | On a player entity |
| --- | --- |
| `wearables`, non-empty | Replaces the whole profile set. A category the list leaves out stays **empty**. The profile's force-render is dropped (with full replacement and add on top alike) and cannot be restored. The first 32 entries apply. |
| `wearables: []` | Keeps the profile wearables and their force-render. Same as unset. |
| `bodyShape` | Applies when set. Exactly `urn:decentraland:off-chain:base-avatars:BaseMale` or `...:BaseFemale` (case-sensitive); any other value gives the male body and a warning. |
| `skinColor`, `hairColor`, `eyeColor`, `showOnlyWearables` | Each applies when set. `showOnlyWearables: true` hides skin, hair and face. |
| `id`, `name`, `emotes`, `expressionTriggerId`, `expressionTriggerTimestamp`, `talking` | Ignored; `id` and `emotes` are still required by the type. |
| Any other unset field | Keeps the profile value. |

## Lifecycle

- **Current scene only:** the scene under the local player. Portable experiences, smart wearables and global portable experiences are ignored. Crossing into a neighbor that also dresses the player swaps one look for the other.
- **The `AvatarShape` stays on the entity.** A player who walks out and back, local or remote, is dressed again with no new write. A remote player who disconnects leaves their entity id; when the id is handed to someone else it comes back with a new version, so the newcomer does not inherit the old `AvatarShape`. Nothing needs deleting when a player leaves.
- **Backpack saves don't override it:** the scene's fields are reapplied to the new profile, and the scene keeps winning while it is the current scene. Newly equipped items stay off under a non-empty `wearables` (the add-on-top recipe picks them up). Backpack and passport show the real profile.
- **Cost:** an identical write does not reload the avatar. Any real change (one color too) rebuilds every item; the old look holds until all items resolve, so one slow item delays the whole outfit.
- **Restoring the profile:** `AvatarShape.deleteFrom(player)`, or writing one with no field set. The previous look holds until the profile's assets load: no bare frames.

## Recipes

### `dressPlayer` (`src/dress.ts`): write only on change, used by every recipe

```typescript
import { AvatarShape, Entity, PBAvatarShape } from '@dcl/sdk/ecs'

const written = new Map<Entity, string>()

// `undefined` restores the profile look
export function dressPlayer(player: Entity, shape: Partial<PBAvatarShape> | undefined) {
	const key = JSON.stringify(shape ?? null)
	if (written.get(player) === key) return
	written.set(player, key)
	if (shape) AvatarShape.createOrReplace(player, { id: '', emotes: [], wearables: [], ...shape })
	else AvatarShape.deleteFrom(player)
}
```

### Full replacement: a uniform with male and female variants

The default recipe. List the whole outfit. Body-hugging items need a model per body shape; pick it by `AvatarBase.bodyShapeUrn` (the profile body; if the scene sets `bodyShape`, pick by that instead).

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

The scene item replaces only the profile item of its own category; profile items of other categories stay and can overlap it (profile dungarees and a scene kilt both show). `wearableUrns` is part of the written value, so a Backpack change re-dresses the player.

### Same outfit, other look

An empty `wearables` keeps the profile items and their force-render; the other fields combine with each other and with either recipe above.

```typescript
import { engine } from '@dcl/sdk/ecs'
import { Color3 } from '@dcl/sdk/math'
import { dressPlayer } from './dress'

// Alternatives: each call replaces the previous shape
export function lookAlternatives() {
	dressPlayer(engine.PlayerEntity, { skinColor: Color3.Green(), hairColor: Color3.Red(), wearables: [] })
	dressPlayer(engine.PlayerEntity, { bodyShape: 'urn:decentraland:off-chain:base-avatars:BaseFemale', wearables: [] })
	dressPlayer(engine.PlayerEntity, { showOnlyWearables: true, wearables: [] })
	dressPlayer(engine.PlayerEntity, undefined) // back to the profile look
}
```

### Everyone sees it: team uniforms with an authoritative server

Each client shows only the `AvatarShape` it writes. The scene syncs *who wears what*, and every client dresses every player from it. Here a `Teams` component only the Multiplayer Server writes, so no client can dress someone else; this uses `@dcl/sdk@auth-server`, ask the user before switching (**authoritative-server**). The client half works with any synced state (**multiplayer-sync**). Files: the four below, `src/client/dress.ts` (the helper above), and `wearables/red_jersey/red_jersey_m_upper_body.glb` plus `_f_`, likewise for blue.

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
import { engine, Entity } from '@dcl/sdk/ecs'
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
		const state = Teams.getMutable(teamsEntity)
		state.keys = [...teams.keys()]
		state.teams = [...teams.values()]
	})
}
```

```typescript
// src/client/client.ts
import { AvatarBase, engine, Entity, PlayerIdentityData } from '@dcl/sdk/ecs'
import { room, Teams } from '../shared/teams'
import { dressPlayer } from './dress'

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

	for (const { player, address, female } of players) {
		const team = teamOf.get(address)
		dressPlayer(player, team ? { wearables: uniform(team, female) } : undefined)
	}
}
```

Late joiners get `Teams` with the synced state and dress everyone at once. A player who walks out keeps their team and is dressed again on return; a long-running server can prune addresses that have had no `PlayerIdentityData` for a while. `dressPlayer` writes only when a player's team or body changes.

## Scene `.glb` files

- [ ] `.glb` only, any case (`.GLB` works). A `.gltf` is skipped.
- [ ] The file name ends with `_<category>.glb`, one of 14 categories: `upper_body`, `lower_body`, `feet`, `hands_wear`, `hat`, `helmet`, `top_head`, `mask`, `eyewear`, `earring`, `tiara`, `hair`, `facial_hair`, `skin`. The longest match wins: `beard_facial_hair.glb` is `facial_hair`. `eyes`, `eyebrows`, `mouth` (PNG items), `body_shape` and `hands` are not categories.
- [ ] The entry is the path from the project root with `/` separators, as in the scene content: `'wearables/jersey/jersey_m_upper_body.glb'` (case-insensitive). `./`, a leading `/`, backslashes, a `?query`, trailing spaces and full URLs are skipped. `.dclignore` must not exclude the file.
- [ ] Textures are embedded in the GLB or sit in the **same folder**; subfolders and `../` are not read. Give each item its own folder.
- [ ] Ship `_m_` / `_f_` variants of body-hugging items (a naming convention; the category suffix still comes last) and let the scene pick.
- [ ] Skinned to the Decentraland avatar armature; model it with **wearables** (base meshes, rig, category limits). The Builder upload, thumbnail and hide settings do not apply.
- [ ] Materials whose name contains `skin` or `hair` (any case, anywhere: `Chair` too) are tinted with the skin or hair color, as in catalog items. Name other materials without those words.
- [ ] A deployed scene shows its items only once its asset bundles are converted; until then every `.glb` entry is skipped, with no fallback. Local preview loads them directly, so a working preview does not prove the deployed scene.
- [ ] The same file in two folders is two items; an edited file is a new item (preview hot reload picks it up).

## Which items show

- **Same category twice:** the later entry wins; the earlier renders and hides nothing. This holds on NPCs too.
- **A scene `.glb` always renders and hides nothing**, and nothing hides it: a catalog helmet does not hide scene hair, a scene hat does not hide the hair (leave hair out of the list, or ship a `_hair.glb`), a scene `upper_body` leaves the hands visible.
- **Exception, `skin`:** a scene `skin` hides the body, face, hair and the catalog items in the body categories. Scene items still show over it.
- **Catalog URNs** keep their own hides and replaces; ownership is not checked. **Skipped entries** take no slot; if every entry is skipped, the player keeps the profile look. A catalog URN that fails to load takes a slot, so a list of only broken URNs leaves no wearables. A failed item is dropped before hides are worked out.
- **Not possible:** keeping some profile categories and replacing others (`AvatarEquippedData` has no categories), hiding a profile item with a scene item of another category, changing the name, emotes or expressions. To hide the player, use `AvatarModifierArea` (`AMT_HIDE_AVATARS`).

## Read what the player wears: `AvatarEquippedData`

Read-only, written by the Explorer on every player entity. It describes the **profile** outfit: scene items never appear in it, and its flags do not change when the scene dresses the player.

- `wearableUrns`: profile item URNs, facial features included.
- `wearables`: one `{ urn, visible? }` per `wearableUrns` entry, same order, full URN. Required in the type: code that creates `AvatarEquippedData` itself (mocks, tests) passes `wearables: []`.
  - `true`: shows in the profile outfit after hides, replaces and force-render.
  - `false`: hidden, replaced by a later item of its category, or its metadata failed to load.
  - unset: the outfit is loading. All entries are unset together, then the component is written again with the flags. After 60 s without a result they stay unset until the next profile change.

```typescript
import { AvatarEquippedData, engine } from '@dcl/sdk/ecs'

AvatarEquippedData.onChange(engine.PlayerEntity, (equipped) => {
	if (!equipped) return
	if (equipped.wearables.some((w) => w.visible === undefined)) return // still loading
	const shown = equipped.wearables.filter((w) => w.visible).map((w) => w.urn)
	console.log('Profile items on show:', shown)
})
```

Handle an empty `wearables`; fall back to `wearableUrns` when the flags never arrive. To know what the scene put on a player, keep your own record (the `written` map).

## Troubleshooting

Each skipped entry logs `Scene wearable '<entry>' skipped: <reason>` on every write:

| Reason | Fix |
| --- | --- |
| `it is neither a URN nor a '.glb' path` | A `.gltf`, `.json`, bare name, `?query` or trailing space: use a catalog URN or a clean `.glb` path |
| `the file name must end with '_<category>.glb' using a supported category` | Rename to `<name>_<category>.glb` |
| `the file is not part of the scene content` | Path from the project root with `/`: no `./`, leading `/`, backslashes or URL; check `.dclignore` |
| `the scene has no asset bundle manifest` | Deployed scene not converted yet: wait for the asset bundles |
| `it is not a wearable seeded by this scene` | A `scene-wearable` URN from another scene or from logs: list the `.glb` path |
| `AvatarShape on a player has N wearables, only the first 32 apply` (own warning) | Shorten the list |

| Symptom | Cause |
| --- | --- |
| Player keeps the profile look | Every entry skipped; `wearables: []`; the scene is not the current one; for a remote player, they or the local player are off the scene's parcels; asset bundles not ready |
| A force-rendered profile item is hidden again | A non-empty `wearables` drops force-render |
| A female avatar clips through a jacket | The male model on a female body: pick the variant by body shape |
| A part turns skin or hair colored | Its material name contains `skin` or `hair`: rename the material |
| Avatar reloads over and over, log spam | A value changes every tick (animated color, list rebuilt in another order): write only on change |
| `visible` is always `undefined` | Still loading, or the 60 s wait ran out |
