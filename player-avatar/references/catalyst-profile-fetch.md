# Fetching Avatar Profiles from the Catalyst

For users **not currently in the scene**, `getPlayer(userId)` returns `null`. To dress an `AvatarShape` for an arbitrary wallet address (parcel owner, NFT holder, leaderboard entry, off-scene claimant, etc.), fetch the profile from the catalyst's `/lambdas/profile/` endpoint.

## Endpoint

```
GET https://peer.decentraland.org/lambdas/profile/<wallet-address>
```

- `peer.decentraland.org` is the canonical catalyst. Use it regardless of which realm or world the scene is deployed to.
- **Do NOT read `realmInfo.baseUrl`** for this — Worlds servers do not expose `/lambdas`.
- Address is case-insensitive; lower-case is conventional.

## Response shape (verified live)

```json
{
  "timestamp": 1776880856372,
  "avatars": [
    {
      "name": "NicoE",
      "userId": "0xe2b6...",
      "ethAddress": "0xe2b6...",
      "hasConnectedWeb3": true,
      "hasClaimedName": true,
      "avatar": {
        "bodyShape": "urn:decentraland:off-chain:base-avatars:BaseMale",
        "wearables": ["urn:decentraland:off-chain:base-avatars:thug_life", "..."],
        "emotes": [],
        "eyes":  { "color": { "r": 0.23, "g": 0.62, "b": 0.31, "a": 1 } },
        "hair":  { "color": { "r": 0.45, "g": 0.01, "b": 0.99, "a": 1 } },
        "skin":  { "color": { "r": 0.86, "g": 0.69, "b": 0.56, "a": 1 } },
        "snapshots": {}
      }
    }
  ]
}
```

- The wearable list lives at `json.avatars[0].avatar.wearables` — **NOT** `json[0].metadata.avatars[0].avatar.wearables` (that older shape appears in some docs and is wrong for this endpoint).
- Colors come as `{ r, g, b, a }` floats in `[0,1]`.
- For **unknown / never-seen addresses** the response is `{ "avatars": [], "timestamp": 0 }` — code MUST handle the empty array.

## Helper: `fetchAvatarFromCatalyst`

Returns fields ready to spread into `AvatarShape.create(...)`. Returns `null` on network error, non-2xx, or unknown address.

```typescript
import { Color3 } from '@dcl/sdk/math'

const CATALYST_PROFILE_BASE = 'https://peer.decentraland.org/lambdas/profile/'

export interface CatalystAvatar {
  bodyShape?: string
  wearables?: string[]
  skinColor?: Color3
  hairColor?: Color3
  eyeColor?: Color3
}

export async function fetchAvatarFromCatalyst(
  address: string
): Promise<CatalystAvatar | null> {
  try {
    const res = await fetch(`${CATALYST_PROFILE_BASE}${address}`)
    if (!res.ok) return null
    const json: any = await res.json()

    // Empty for unknown addresses: { avatars: [], timestamp: 0 }
    const avatar = json?.avatars?.[0]?.avatar
    if (!avatar) return null

    return {
      bodyShape: avatar.bodyShape,
      wearables: Array.isArray(avatar.wearables) ? avatar.wearables : [],
      skinColor: parseColor(avatar.skin?.color),
      hairColor: parseColor(avatar.hair?.color),
      eyeColor: parseColor(avatar.eyes?.color)
    }
  } catch (err) {
    console.error('[profile] Failed to fetch profile for', address, err)
    return null
  }
}

function parseColor(input: any): Color3 | undefined {
  if (!input || typeof input.r !== 'number') return undefined
  return Color3.create(input.r, input.g, input.b)
}
```

## Color shape gotcha — `Color3`, NOT `{ color: Color3 }`

The catalyst returns `eyes/hair/skin` as `{ color: { r, g, b, a } }`. The SDK's `AvatarShape` expects the **raw `Color3`** for `skinColor` / `hairColor` / `eyeColor` — do not re-wrap in `{ color: ... }`. Wrapping produces a TS2322 error.

```typescript
// CORRECT
AvatarShape.create(entity, {
  id: address,
  skinColor: appearance.skinColor, // Color3
  hairColor: appearance.hairColor,
  eyeColor:  appearance.eyeColor
})

// WRONG — TS2322
AvatarShape.create(entity, {
  id: address,
  skinColor: { color: appearance.skinColor }
})
```

## Full usage example

Spawn an entity for an off-scene user, fetch the profile, dress the `AvatarShape`. For the **local** player, prefer `getPlayer()` — it already exposes `wearables` and `emotes` synchronously.

```typescript
import { engine, Transform, AvatarShape } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'
import { getPlayer } from '@dcl/sdk/players'
import { fetchAvatarFromCatalyst } from './profile'

async function spawnRemoteAvatar(address: string, displayName: string) {
  const local = getPlayer()
  const isLocal =
    !!local && local.userId.toLowerCase() === address.toLowerCase()

  // Local player → use getPlayer (already loaded). Otherwise → catalyst.
  const appearance = isLocal ? null : await fetchAvatarFromCatalyst(address)

  const entity = engine.addEntity()
  Transform.create(entity, {
    position: Vector3.create(8, 0, 8),
    scale: Vector3.create(7, 7, 7) // giant "RESERVED BY" avatar
  })

  AvatarShape.create(entity, {
    id: address,
    name: displayName,
    bodyShape: appearance?.bodyShape,
    wearables: isLocal ? local!.wearables ?? [] : appearance?.wearables ?? [],
    emotes:    isLocal ? local!.emotes    ?? [] : [],
    skinColor: appearance?.skinColor,
    hairColor: appearance?.hairColor,
    eyeColor:  appearance?.eyeColor
  })

  return entity
}
```

If `fetchAvatarFromCatalyst` returns `null`, the `AvatarShape` falls back to its built-in defaults (an undressed base avatar) — handle this case if it matters visually.

## When to use which API

| Target user | API | Notes |
|---|---|---|
| Local player | `getPlayer()` from `@dcl/sdk/players` | Sync, already loaded, includes `wearables` and `emotes`. |
| Any other player **currently in the scene** | `getPlayer(userId)` from `@dcl/sdk/players` | Returns `null` if they leave. |
| Any address NOT in the scene (parcel owner, NFT holder, historical claimant, leaderboard) | `fetchAvatarFromCatalyst(address)` | Async HTTP. Use for off-scene users only. |

`AvatarShape.create({ id: address })` with **only** an `id` does NOT auto-fetch wearables — the avatar will render as an undressed base body. The `id` is just the avatar's identifier inside the scene; appearance fields (`wearables`, `bodyShape`, colors) must be supplied explicitly.

## Sources

- Endpoint and response shape verified live against `https://peer.decentraland.org/lambdas/profile/<address>` on 2026-04-29.
- Color3 (not `{ color: Color3 }`) for `AvatarShape.skinColor` / `hairColor` / `eyeColor` confirmed against the SDK type-checker — see `references/avatar-apis.md` in this skill for the full `AvatarShape` schema.
- Reference docs: https://docs.decentraland.org/creator/scenes-sdk7/interactivity/user-data#data-from-any-player (note: the snippet on that page shows `json[0].metadata.avatars[0].avatar.wearables`, which is the format from a **different** endpoint and does NOT match the live `/lambdas/profile/<address>` response).
