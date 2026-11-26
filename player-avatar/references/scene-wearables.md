# Scene Wearables Reference

Companion to *Dress the Player (Scene Wearables)* in `player-avatar/SKILL.md`; read that first. Single source of truth for `AvatarShape` on player entities, wearable `.glb` files shipped in a scene, and `AvatarEquippedData.wearables`.

## Fields on a player entity

Player entities are `engine.PlayerEntity` and the entities that carry `PlayerIdentityData`. On any other entity `AvatarShape` draws an NPC with its own defaults (**npcs**); scene `.glb` paths work there too.

| Field | On a player entity |
| --- | --- |
| `wearables`, non-empty | Replaces the whole profile set. A category the list leaves out stays **empty**. The face shows the default eyes, eyebrows and mouth, not the profile's; to choose them, list catalog face items (`BASE + 'eyes_00'`, `'eyebrows_00'`, `'mouth_00'`, or the `f_eyes_00` / `f_eyebrows_00` / `f_mouth_00` set; all fit both bodies). Profile items the player forced to show in the backpack (force-render) lose it, with full replacement and add on top alike. The first 32 entries apply. |
| `wearables: []` | Keeps the profile wearables and their force-render. Same as unset. |
| `bodyShape` | Applies when set. Exactly `urn:decentraland:off-chain:base-avatars:BaseMale` or `...:BaseFemale` (case-sensitive); any other value gives the male body and a warning. |
| `skinColor`, `hairColor`, `eyeColor`, `showOnlyWearables` | Each applies when set. `showOnlyWearables: true` hides skin, hair and face. |
| `id`, `name`, `emotes`, `expressionTriggerId`, `expressionTriggerTimestamp`, `talking` | Ignored; `id` and `emotes` are still required by the type. Label roles with `AvatarNametag`, play emotes with `triggerEmote`. |

## Lifecycle

- **Current scene only:** the scene under the local player. Portable experiences, smart wearables and global portable experiences are ignored. Crossing into a neighbor that also dresses the player swaps one look for the other.
- **The `AvatarShape` stays on the entity.** A player who walks out and back, local or remote, is dressed again with no new write. A remote player who disconnects leaves their entity id; when the id is handed to someone else it comes back with a new version, so the newcomer does not inherit the old `AvatarShape`. Nothing needs deleting when a player leaves.
- **Backpack saves don't override it:** the scene's fields are reapplied to the new profile, and the scene keeps winning while it is the current scene. Newly equipped items stay off under a non-empty `wearables` (the add-on-top recipe picks them up). The backpack and passport show the real profile.
- **Cost:** an identical write does not reload the avatar. Any real change (one color too) rebuilds every item; the old look holds until all items resolve, so one slow item delays the whole outfit.
- **Restoring the profile:** `AvatarShape.deleteFrom(player)`, or writing one with no field set. The previous look holds until the profile's assets load: no bare frames.

## Recipes

### `dressPlayer` (`src/dress.ts`): write only on change, used by every recipe

```typescript
import { AvatarShape, engine, Entity, PBAvatarShape, PlayerIdentityData } from '@dcl/sdk/ecs'

const written = new Map<Entity, string>()

// Writes only when `key` differs from the last one for this player: one key per look. `undefined` restores the profile.
export function dressPlayer(player: Entity, key: string, shape: Partial<PBAvatarShape> | undefined) {
	if (written.get(player) === key) return
	written.set(player, key)
	if (shape) AvatarShape.createOrReplace(player, { id: '', emotes: [], wearables: [], ...shape })
	else AvatarShape.deleteFrom(player)
}

// Forget players who left; if one comes back, the repeated write is identical and costs nothing
engine.addSystem(() => {
	for (const player of written.keys()) if (!PlayerIdentityData.has(player)) written.delete(player)
})
```

### Full replacement: a uniform with male and female variants

The default recipe. List the whole outfit. Body-hugging items need a model per body shape; pick it by `AvatarBase.bodyShapeUrn` (the profile body; if the scene sets `bodyShape`, pick by that instead). A rigid item (the cap) fits both bodies. `short_hair` goes on every player: pick hair by body shape (`pony_tail`) or ship a `_hair.glb` if that isn't the look you want.

```typescript
import { AvatarBase, engine } from '@dcl/sdk/ecs'
import { dressPlayer } from './dress'

const BASE = 'urn:decentraland:off-chain:base-avatars:'
// Every category the look needs: a category left out stays empty. No face items, so the default face shows.
const SHARED = [BASE + 'short_hair', BASE + 'brown_pants', BASE + 'classic_shoes', 'assets/wearables/cap/cap_hat.glb']
const UNIFORM = {
	male: [...SHARED, 'assets/wearables/jersey/jersey_m_upper_body.glb'],
	female: [...SHARED, 'assets/wearables/jersey/jersey_f_upper_body.glb'],
}

engine.addSystem(() => {
	const avatarBase = AvatarBase.getOrNull(engine.PlayerEntity)
	if (!avatarBase) return // wait for the profile's body shape
	const body = avatarBase.bodyShapeUrn.toLowerCase().endsWith(':basefemale') ? 'female' : 'male'
	dressPlayer(engine.PlayerEntity, body, { wearables: UNIFORM[body] })
})
```

### Add on top of the profile outfit

```typescript
import { AvatarEquippedData, engine } from '@dcl/sdk/ecs'
import { dressPlayer } from './dress'

const CROWN = 'assets/wearables/crown/crown_tiara.glb'

// A system, not AvatarEquippedData.onChange: an onChange registered in main() misses the starting outfit
engine.addSystem(() => {
	const equipped = AvatarEquippedData.getOrNull(engine.PlayerEntity)
	if (!equipped) return
	// The crown goes last: of two items in the same category, the later one is used
	dressPlayer(engine.PlayerEntity, equipped.wearableUrns.join(), { wearables: [...equipped.wearableUrns, CROWN] })
})
```

The crown replaces only the player's own tiara. Profile items of other categories stay and can overlap a scene item: profile dungarees and a scene kilt both show. The key is the profile list, so a backpack change re-dresses the player, and the profile face stays (its URNs are in `wearableUrns`). A body-hugging item needs `_m_` / `_f_` models picked by body shape, as in the uniform.

### Same outfit, other look

An empty `wearables` keeps the profile items and their force-render; the other fields combine with each other and with either recipe above. Pick one line; each call replaces the previous shape.

```typescript
import { engine } from '@dcl/sdk/ecs'
import { Color3 } from '@dcl/sdk/math'
import { dressPlayer } from './dress'

dressPlayer(engine.PlayerEntity, 'green', { wearables: [], skinColor: Color3.create(0.3, 0.8, 0.3), hairColor: Color3.Red() }) // colors only
dressPlayer(engine.PlayerEntity, 'female', { wearables: [], bodyShape: 'urn:decentraland:off-chain:base-avatars:BaseFemale' }) // body only
dressPlayer(engine.PlayerEntity, 'bare', { wearables: [], showOnlyWearables: true }) // hides skin, hair and face
dressPlayer(engine.PlayerEntity, 'profile', undefined) // back to the profile look
```

### Everyone sees it: team uniforms

Each client shows only the `AvatarShape` it writes, and nothing relays it. The scene syncs each player's choice itself, and every client dresses every player from the synced state:

- **Simple case (**multiplayer-sync**):** each client creates one entity for its own choice, e.g. `TeamChoice { address, team }`, and calls `syncEntity(entity, [TeamChoice.componentId])` with no sync id, so the entity goes away when that player disconnects. In the client below, `teamOf` scans `TeamChoice` entities instead of `Teams`. Any client can write any value: use it when a wrong choice costs nothing.
- **Choices must be validated** (a team cap, a paid costume): the authoritative server is the only writer, as below. It needs `@dcl/sdk@auth-server`; ask the user before switching (**authoritative-server**).

Files: the four below, `src/client/dress.ts` (the helper above), and per team `assets/wearables/red_jersey/red_jersey_m_upper_body.glb` plus `_f_`, and `assets/wearables/red_pants/red_pants_m_lower_body.glb` plus `_f_`. There are no colored base pants, so team pants ship as scene files too.

```typescript
// src/index.ts
import { isServer } from '@dcl/sdk/network'
// registerMessages() defines a component, so the shared module loads before the engine seals
import './shared/teams'

export async function main() {
	if (isServer()) (await import('./server/server')).startServer()
	else (await import('./client/client')).startClient()
}
```

```typescript
// src/shared/teams.ts
import { engine, Schemas } from '@dcl/sdk/ecs'
import { registerMessages } from '@dcl/sdk/network'

export const TEAM_NAMES = ['red', 'blue']

// Fixed singletons get explicit sync ids
export enum SyncId { TEAMS = 1 }

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
import { room, SyncId, TEAM_NAMES, Teams } from '../shared/teams'

const teams = new Map<string, string>()
let teamsEntity: Entity

export function startServer() {
	Teams.validateBeforeChange((value) => value.senderAddress.toLowerCase() === AUTH_SERVER_PEER_ID.toLowerCase())
	teamsEntity = engine.addEntity()
	Teams.create(teamsEntity, { keys: [], teams: [] })
	syncEntity(teamsEntity, [Teams.componentId], SyncId.TEAMS)

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
import { AvatarBase, engine, PlayerIdentityData } from '@dcl/sdk/ecs'
import { isStateSyncronized } from '@dcl/sdk/network'
import { room, Teams } from '../shared/teams'
import { dressPlayer } from './dress'

const BASE = 'urn:decentraland:off-chain:base-avatars:'

function uniform(team: string, female: boolean): string[] {
	const body = female ? 'f' : 'm'
	return [
		BASE + (female ? 'pony_tail' : 'short_hair'),
		BASE + 'classic_shoes',
		`assets/wearables/${team}_jersey/${team}_jersey_${body}_upper_body.glb`,
		`assets/wearables/${team}_pants/${team}_pants_${body}_lower_body.glb`,
	]
}

// Call from a button or a trigger area; false until the room has synced, so keep the button disabled until then
export function joinTeam(team: string): boolean {
	if (!isStateSyncronized()) return false
	void room.send('joinTeam', { team })
	return true
}

export function startClient() {
	engine.addSystem(dressTeamsSystem)
}

function teamOf(address: string): string | undefined {
	for (const [, state] of engine.getEntitiesWith(Teams)) {
		const i = state.keys.indexOf(address)
		return i >= 0 ? state.teams[i] : undefined
	}
	return undefined
}

let sinceScan = 0 // four scans a second are plenty for a team change

function dressTeamsSystem(dt: number) {
	sinceScan += dt
	if (sinceScan < 0.25) return
	sinceScan = 0

	for (const [player, identity] of engine.getEntitiesWith(PlayerIdentityData)) {
		const avatarBase = AvatarBase.getOrNull(player)
		if (!avatarBase) continue // dress once the body shape is known
		const female = avatarBase.bodyShapeUrn.toLowerCase().endsWith(':basefemale')
		const team = teamOf(identity.address.toLowerCase())
		dressPlayer(player, `${team}:${female}`, team ? { wearables: uniform(team, female) } : undefined)
	}
}
```

Late joiners get `Teams` with the synced state and dress everyone on the next scan. A player who walks out keeps their team and is dressed again on return; a long-running server can prune addresses that have had no `PlayerIdentityData` for a while. `dressPlayer` writes only when a player's team or body changes. To keep each player's own hair and shoes, add the team items on top instead (the player's `AvatarEquippedData` is on their entity).

## Scene `.glb` files

- [ ] `.glb` only, any case (`.GLB` works). A `.gltf` is skipped.
- [ ] The file name ends with `_<category>.glb`, one of 14 categories: `upper_body`, `lower_body`, `feet`, `hands_wear`, `hat`, `helmet`, `top_head`, `mask`, `eyewear`, `earring`, `tiara`, `hair`, `facial_hair`, `skin`. The longest match wins: `beard_facial_hair.glb` is `facial_hair`. `eyes`, `eyebrows`, `mouth` (PNG items), `body_shape` and `hands` are not categories.
- [ ] The entry is the path from the project root with `/` separators, as in the scene content: `'assets/wearables/jersey/jersey_m_upper_body.glb'` (case-insensitive). `./`, a leading `/`, backslashes, a `?query`, trailing spaces and full URLs are skipped. `.dclignore` must not exclude the file.
- [ ] Textures are embedded in the GLB or sit in the **same folder**; subfolders and `../` are not read. Give each item its own folder under `assets/wearables/`.
- [ ] Ship `_m_` / `_f_` variants of body-hugging items (a naming convention; the category suffix still comes last) and let the scene pick.
- [ ] Skinned to the Decentraland avatar armature; model it with **wearables** (base meshes, rig, category limits). The Builder upload, thumbnail and hide settings do not apply.
- [ ] Materials whose name contains `skin` or `hair` (any case, anywhere: `Chair` too) are tinted with the skin or hair color, as in catalog items. Name other materials without those words.
- [ ] For color variants export a separate `.glb` per variant, textures embedded; byte-identical copies in two folders may share one look once deployed. An edited file is a new item (preview hot reload picks it up).
- [ ] A deployed scene loads its `.glb` items from its converted asset bundles. A scene loaded before the conversion finished skips every `.glb` entry, with no fallback, until the scene is loaded again after asset processing finishes. Local preview loads the files directly, so a working preview does not prove the deployed scene.

## Which items show

- **Same category twice:** the later entry wins; the earlier one neither renders nor hides anything. This holds on NPCs too.
- **A scene `.glb` hides nothing, and nothing hides it** except a later item of the same category, which replaces it: a catalog helmet does not hide scene hair, a scene hat does not hide the hair (leave hair out of the list, or ship a `_hair.glb`), a scene `upper_body` leaves the hands visible.
- **Exception, `skin`:** a scene `skin` hides the body, the face and every catalog or profile item in `hair`, `upper_body`, `lower_body`, `feet`, `hands_wear` and `facial_hair`. Scene items still show over it.
- **Catalog URNs** keep their own hides and replaces; ownership is not checked. **Skipped entries** don't count; if every entry is skipped, the player keeps the profile look. A catalog URN that fails to load still counts, so the list stays a full replacement: a list of only broken URNs leaves no wearables. A failed item is dropped before hides are worked out.
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

function logShown(equipped: ReturnType<typeof AvatarEquippedData.getOrNull> | undefined) {
	if (!equipped || equipped.wearables.some((w) => w.visible === undefined)) return // absent or still loading
	console.log('Profile items on show:', equipped.wearables.filter((w) => w.visible).map((w) => w.urn))
}

logShown(AvatarEquippedData.getOrNull(engine.PlayerEntity)) // onChange does not replay the value already there
AvatarEquippedData.onChange(engine.PlayerEntity, logShown)
```

Handle an empty `wearables`; fall back to `wearableUrns` when the flags never arrive. To know what the scene put on a player, keep your own record (the `written` map).

## Troubleshooting

Each skipped entry logs `Scene wearable '<entry>' skipped: <reason>` on every write:

| Reason | Fix |
| --- | --- |
| `it is neither a URN nor a '.glb' path` | A `.gltf`, `.json`, bare name, `?query` or trailing space: use a catalog URN or a clean `.glb` path |
| `the file name must end with '_<category>.glb' using a supported category` | Rename to `<name>_<category>.glb` |
| `the file is not part of the scene content` | Path from the project root with `/`: no `./`, leading `/`, backslashes or URL; check `.dclignore` |
| `the scene has no asset bundle manifest` | The scene loaded before its asset bundles were ready: load it again after processing finishes |
| `AvatarShape on a player has N wearables, only the first 32 apply` (own warning) | Shorten the list |

| Symptom | Cause |
| --- | --- |
| Player keeps the profile look | Every entry skipped; `wearables: []`; the scene is not the current one; for a remote player, they or the local player are off the scene's parcels; asset bundles not ready |
| The look appears only after the player changes outfit | `AvatarEquippedData.onChange` registered in `main()` misses the starting outfit: write from a system with `getOrNull` |
| A force-rendered profile item is hidden again | A non-empty `wearables` drops force-render |
| The player's own face is gone after full replacement | A non-empty list shows the default face: list catalog `eyes_*`, `eyebrows_*`, `mouth_*` items, or add on top |
| A female avatar clips through a jacket | The male model on a female body: pick the variant by body shape |
| A part turns skin or hair colored | Its material name contains `skin` or `hair`: rename the material |
| Avatar reloads over and over, log spam | A value changes every tick (animated color, list rebuilt in another order): write only on change |
