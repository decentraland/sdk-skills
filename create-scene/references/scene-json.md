# scene.json reference

Every `scene.json` field, the scene categories, permissions, feature toggles, spawn points and parcel layouts. Read it when writing or editing `scene.json`. In a scene open in the Creator Hub, change these settings through the Creator Hub MCP (`set_scene_settings`, **creator-hub-mcp**), not by editing the file — except `spawnPoints` and `thumbnail`: write those with `set_component` on entity `0` (**creator-hub-mcp** → *Tool catalog*, Settings row; spawn points: *RULE — confirm a batch landed on disk*; thumbnail: *Gotchas*).

## Fields

All valid `scene.json` fields:

| Field                     | Required     | Description                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ecs7`                    | Conventional | `true` in SDK7 scenes. Written by `init`; the build only validates `runtimeVersion`, but keep it for tooling compatibility                                                                                                                                                                                                                                                                                                                               |
| `runtimeVersion`          | Yes          | Must be `"7"`                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `main`                    | Yes          | Must be `"bin/index.js"` — the compiled output path                                                                                                                                                                                                                                                                                                                                                                                                      |
| `display.title`           | Recommended  | Scene name shown in the map and Places                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `display.description`     | Recommended  | Short description for discovery                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `display.navmapThumbnail` | Recommended  | Thumbnail shown in the map modal and teleport confirmation. `.png`/`.jpg`, **16:9**, 1920x1080 px recommended; square crops show only the central 1080x1080, so keep essential content there — see the **deploy-scene** skill for the spec and a capture procedure                                                                                                                                                                                                                                                                                         |
| `tags`                    | Recommended  | Root-level `string[]`. The scene's categories in the Places dApp. Max 3, values from the predefined list (see below)                                                                                                                                                                                                                                                                                                                                     |
| `scene.parcels`           | Yes          | Array of `"x,y"` coordinate strings                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `scene.base`              | Yes          | The origin parcel (usually southwest corner)                                                                                                                                                                                                                                                                                                                                                                                                             |
| `spawnPoints`             | Optional     | Where players appear when entering (see below)                                                                                                                                                                                                                                                                                                                                                                                                           |
| `requiredPermissions`     | Optional     | Array of permissions (e.g., `"ALLOW_MEDIA_HOSTNAMES"`)                                                                                                                                                                                                                                                                                                                                                                                                   |
| `allowedMediaHostnames`   | Optional     | Whitelisted domains for external media                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `featureToggles`          | Optional     | Enable/disable SDK features                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `worldConfiguration`      | Optional     | For Worlds deployment (see **deploy-worlds** skill)                                                                                                                                                                                                                                                                                                                                                                                                      |
| `landscapeTerrain`        | Optional     | Boolean, default `true`. Root-level field. **Worlds only** (single-scene Worlds; ignored in Genesis City). Set `false` to disable the auto-generated grassland/trees/sea landscape around the scene — for open-water/space settings and to free rendering budget. Also applies in local preview. In the Creator Hub, it is a toggle in the Scene Inspector settings (and a preview menu option); a scene-level `false` overrides the preview preference. |

## Tags (scene categories)

The root-level `tags` array holds the scene's **categories**. The [Places dApp](https://places.decentraland.org) uses them to group places so players can browse by interest — untagged scenes show up in no category.

Rules:

- Max **3** categories per scene.
- Values must come from this predefined list — arbitrary strings are not categories:

`"art"`, `"game"`, `"casino"`, `"social"`, `"music"`, `"fashion"`, `"crypto"`, `"education"`, `"shop"`, `"business"`, `"sports"`, `"parkour"`

```json
"tags": ["game", "casino"]
```

## Required Permissions

Add to `requiredPermissions` when your scene uses these features:

These are the exact 7 permission strings the runtime recognizes (the protocol enum names drop the `PI_` prefix):

| Permission                          | When needed                                                 |
| ----------------------------------- | ----------------------------------------------------------- |
| `ALLOW_TO_MOVE_PLAYER_INSIDE_SCENE` | `movePlayerTo` (move player within the scene)               |
| `ALLOW_TO_TRIGGER_AVATAR_EMOTE`     | `triggerEmote` and `triggerSceneEmote`                      |
| `ALLOW_MEDIA_HOSTNAMES` `[LEGACY]`  | External video/audio streams — **not required** (see below) |
| `USE_WEB3_API`                      | Blockchain interactions                                     |
| `USE_FETCH`                         | HTTP requests (`fetch` / `signedFetch`)                     |
| `USE_WEBSOCKET`                     | WebSocket connections                                       |
| `OPEN_EXTERNAL_LINK`                | `openExternalUrl` (open URLs in the browser)                |

> **Grounded caveat (from the engine test scenes):** enforcement is uneven, so declare the correct permission for _intent_ rather than relying on it being blocked. The `80,-4-restricted-actions` scene declares only `ALLOW_TO_MOVE_PLAYER_INSIDE_SCENE` + `ALLOW_TO_TRIGGER_AVATAR_EMOTE`, yet successfully runs `openExternalUrl`, `openNftDialog`, `teleportTo`, and `changeRealm` without `OPEN_EXTERNAL_LINK`. The [`66,6-signed-fetch`](https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/66,6-signed-fetch) scene calls `signedFetch` with an empty `requiredPermissions`. `movePlayerTo` and emotes are the two whose permissions the engine team consistently declares. `teleportTo` (jump to other Genesis City coords) needs no permission — and that stays true for the newer `teleportTo({ realm })` form, which subsumes `[DEPRECATED]` `changeRealm` (see `scene-runtime`); neither has a permission of its own.

`[LEGACY]` `ALLOW_MEDIA_HOSTNAMES` and `allowedMediaHostnames` are **not required** — do not add them for new scenes. The permission string still exists in `@dcl/schemas`, but no current client enforces it: unity-explorer gates the hostname check behind the `CHECK_ALLOWED_MEDIA_HOSTNAMES` compile define, which is set in no build config (`SceneData.TryGetMediaUrl` falls through to a plain URL syntax check), and bevy-explorer has no enforcement at all. Only the retired web client enforced it. Current clients play external media without it. If a legacy scene still declares it, whitelist the domains as follows:

```json
"requiredPermissions": ["ALLOW_MEDIA_HOSTNAMES"],
"allowedMediaHostnames": ["youtube.com", "www.youtube.com", "player.vimeo.com", "twitch.tv"]
```

## Feature Toggles

```json
"featureToggles": {
  "voiceChat": "enabled",
  "portableExperiences": "enabled"
}
```

Valid values: `"enabled"`, `"disabled"`. For `portableExperiences` also: `"hideUi"`.

## Spawn Points

Configure where and how players enter the scene:

```json
{
	"spawnPoints": [
		{
			"name": "spawn1",
			"default": true,
			"position": { "x": [1, 5], "y": [0, 0], "z": [2, 4] },
			"cameraTarget": { "x": 8, "y": 1, "z": 8 }
		}
	]
}
```

- Position ranges (e.g., `[1, 5]`) spawn players randomly within the range
- `cameraTarget` orients the player's camera on spawn — point it at the scene's focal area
- Fixed spawn: use single values on **all three** axes (e.g., `"position": { "x": 8, "y": 0, "z": 8 }`)
- `position` is a whole-object union (`@dcl/schemas` `SinglePosition | MultiPosition`): all three axes are numbers, or all three are `[min, max]` arrays. A mix such as `"x": [1, 5], "y": 0` fails validation at build time, and the error does not say why.

## Multi-Parcel Layouts

| Layout         | Parcels Array                     | Use Case                                        |
| -------------- | --------------------------------- | ----------------------------------------------- |
| **Single**     | `["0,0"]`                         | Small games, galleries, single-room experiences |
| **Strip**      | `["0,0", "1,0", "2,0"]`           | Hallways, racing tracks, linear journeys        |
| **L-Shape**    | `["0,0", "1,0", "0,1"]`           | Corner buildings, split experiences             |
| **2x2 Square** | `["0,0", "1,0", "0,1", "1,1"]`    | Open plazas, arenas, medium games               |
| **3x3 Square** | 9 parcels from `"0,0"` to `"2,2"` | Large games, multi-room buildings               |

**Base parcel:** Always set `scene.base` to the southwest (lowest x,y) corner parcel.

**Boundaries:** each parcel is 16m x 16m; a 2x2 scene spans 32m x 32m. The height limit is **330 meters** for every scene, regardless of parcel count. ⚠️ Anything placed above ~200 m may suffer multiplayer sync issues — keep gameplay-relevant content below that.

- **Always validate entity positions against parcel bounds.** With the default base parcel at the lower-left corner, valid range is `0 ≤ x ≤ 16*parcelsWide` and `0 ≤ z ≤ 16*parcelsDeep`. **Any negative X or Z coordinate is outside the scene.** An entity entirely outside the bounds is not rendered and no error is shown; a model that straddles the boundary still renders the part that is inside. The bound check uses **world** positions, so a child whose parent is moved out of bounds disappears with it, and exceeding the height limit hides the entity too. Multi-parcel scenes are only rectangular if you list every parcel; an L-shaped parcel set has "holes" that are out of bounds. (See the `5,90-scene-bounds-check` example scene.)

**Changing parcels in an existing scene:** Modifying `scene.parcels` shifts the coordinate bounds for the entire scene — entities near the current boundary may end up outside (invisible) after the change. Before editing this field, describe the proposed change and confirm with the user first. See the "Agent Behavioral Guidelines" section in the `sdk-scenes` skill (`{baseDir}/../sdk-scenes/SKILL.md`).

