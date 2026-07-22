---
name: authoritative-server
description: Build multiplayer Decentraland scenes with a headless authoritative server. Covers isServer() branching, registerMessages() for client-server communication, validateBeforeChange() for server-only state, Storage (scene-wide and per-player persistence), EnvVar (environment variables), and project structure. Use when the user wants authoritative multiplayer, anti-cheat, server-side validation, persistent storage, or server messages. Do NOT use for basic CRDT multiplayer without a server (see multiplayer-sync).
---

# Authoritative Server Pattern

**IMPORTANT**: Always notify the user and ask them if they want to proceed before adding it to the scene. Mention that it requires installing the `@dcl/sdk@auth-server` branch instead of the standard SDK.

Build multiplayer Decentraland scenes where a **headless server** controls game state, validates changes, and prevents cheating. The same codebase runs on both server and client, with the server having full authority. Decentraland hosts and deploys the server automatically. For basic CRDT multiplayer (no server), see the `multiplayer-sync` skill instead.

## Setup

You **must** use `npm install @dcl/sdk@auth-server` and `npm install @dcl/js-runtime@auth-server` — the standard `@dcl/sdk` does NOT include authoritative server APIs. **`"authoritativeMultiplayer": true`** at the **root** of `scene.json` is what enables the headless server (without it the scene runs as ordinary serverless CRDT and `isServer()` never returns `true`), but you do **not** add it manually: the `@dcl/sdk@auth-server` sdk-commands **auto-adds it on every build and preview** (`bundle.ts` writes `authoritativeMultiplayer: true` to `scene.json` via `ensureJsonKey`, only if absent — it also auto-adds a `server-logs` script to `package.json`). The rule is simply: **do not remove it.** Optionally add `logsPermissions` (array of wallet addresses) at the **root** of `scene.json` to authorize viewing production server logs — without it, server logs are hidden in production **even from the scene owner**. The preview automatically starts a local server in the background.

## Server/Client Branching

Use `isServer()` from `@dcl/sdk/network` to branch logic in a single codebase. Server runs headlessly (no rendering) and has access to all player positions via `PlayerIdentityData`.

## Synced Components with Validation

Define custom components that sync from server to all clients. **Always** use `validateBeforeChange()` to prevent clients from modifying server-authoritative state. **Always guard `validateBeforeChange()` (and any helper that wraps it, like `protectServerEntity()`) inside an `isServer()` block** — both overloads (per-entity and global no-entity) only have meaning on the server, and calling either on a client produces errors. This applies even to global custom-component validators in shared files: define the component at module scope, but place the `validateBeforeChange()` call inside an `isServer()` guard (e.g. inside `main()` or inside an `if (isServer()) { ... }` block in `shared/schemas.ts`).

The validator callback receives `{ entity, currentValue, newValue, senderAddress, createdBy }`. Read component fields from `value.newValue.<field>` (NOT `value.<field>` — that field does not exist). `currentValue` is the pre-change value (`undefined` if component was not present). `newValue` is `undefined` when the component is being deleted. `senderAddress` is the wallet address of the sender; equals `AUTH_SERVER_PEER_ID` when sent by the server. Always compare addresses with `.toLowerCase()`.

### Validation Patterns

- **Pattern 1 — Server-only writes** (strictest): `Score.validateBeforeChange((v) => v.senderAddress === AUTH_SERVER_PEER_ID)`
- **Pattern 2 — Validate the value itself**: reject impossible values (e.g. `value.newValue.position.y > 0`)
- **Pattern 3 — Proximity validation** (anti-cheat): check player is near the object via `PlayerIdentityData` + `Transform`. Server-read player `Transform.position` is **scene-local** metres — the same frame the client sees and the same frame scene entities use — so compare it directly to entity positions with `Vector3.distance()`, no base-parcel offset math. Canonical example: the official `90,-9-authoritative-server-leaderboard` test scene (deployed at non-origin parcels) compares server-read player position directly to a scene-local target. (Some older SDK server builds returned world/parcel-absolute coordinates instead; that was a bug, since fixed — do not add `scene.base` offset corrections.)
- **Pattern 4 — Admin-only writes**: use `getSceneAdmins()` from `@dcl/asset-packs/dist/admin-toolkit-ui/ModerationControl/api` to restrict to admins. For a lightweight fixed allow-list, gate the message handler on the **server-verified** sender instead: keep a lower-cased `ADMINS: string[]` in shared config and check `ADMINS.includes(context.from.toLowerCase())` inside `room.onMessage(...)` (never trust a client-reported role). Clients may read the same list to decide whether to *show* a privileged button, but only the server's check is authoritative.

Use `isPreview()` from `@dcl/asset-packs/dist/admin-toolkit-ui/fetch-utils` (sync, no args, returns `boolean`) to relax validation during local development. The deep `dist/...` import path is the only working one — the package has no top-level re-export.

**Custom components** use global validation: `GameState.validateBeforeChange((value) => ...)`. **Built-in components** (Transform, GltfContainer) use per-entity validation: `Transform.validateBeforeChange(entity, (value) => ...)`. Both forms must be wrapped in `isServer()`.

After creating and protecting an entity, sync it with `syncEntity(entity, [Transform.componentId, GameState.componentId])`. **In an authoritative-server scene, only the server should call `syncEntity()`** — wrap the call in `if (isServer())`. The server creates and shares the entity instance; all clients receive the sync. This is different from the `multiplayer-sync` pattern (serverless), where every client calls `syncEntity` on its own. Calling `syncEntity` on the client in an authoritative scene produces errors, and avoiding client-side calls also removes the need to worry about entity-id consistency across peers.

## Messages

Use `registerMessages()` for client-to-server and server-to-client communication. Define message schemas with `Schemas.Map(...)` — plain JS objects will fail binary serialization.

**Module-load timing (critical):** `registerMessages()` defines a component internally, and `engine.defineComponent()` in `shared/schemas.ts` defines components too. Both MUST run during initial module load, before the engine seals. Reach them via **static** `import` (e.g. `import './shared/messages'` at the top of `index.ts`), NOT via a dynamic `import()` inside `main()` — a dynamic import runs after the seal and throws `Engine is already sealed`. Only server-only modules (those importing `@dcl/sdk/server`) should be dynamically imported inside the `isServer()` branch, and only if they define no components at module scope — this keeps `@dcl/sdk/server` out of the client bundle path.

- Client sends: `room.send('playerJoin', { displayName: 'Alice' })`
- Server sends to all: `room.send('gameEvent', { ... })`
- Server sends to one: `room.send('gameEvent', { ... }, { to: [playerAddress] })`
- Receive: `room.onMessage('playerJoin', (data, context) => { ... })` — `context.from` is the sender's wallet

Clients must wait for `isStateSyncronized()` (note SDK typo) to return `true` before sending messages.

**IMPORTANT — message size limit**: Never send messages larger than **13 KB**. The transport will silently drop any message that exceeds this limit. Split large payloads into smaller chunks if needed.

### Schema Types Reference

`Schemas.String`, `.Int`, `.Float`, `.Boolean`, `.Int64` (for `Date.now()` / 13+ digit numbers), `.Vector3`, `.Quaternion`, `.Entity`, `.Array(Schemas.String)`, `.Optional(Schemas.String)`, `.Map({ name: Schemas.String, hp: Schemas.Int })`.

> The boolean schema is **`Schemas.Boolean`**, not `Schemas.Bool` (verified — `@dcl/ecs` `schemas/index.d.ts` exposes `Schemas.Boolean`; the internal class is named `Bool` but is not exposed under that name on the `Schemas` namespace).

**Use `Schemas.Int64` for timestamps** — `Schemas.Number` corrupts large numbers (13+ digits).

## Server Reading Player Positions

Read actual server-verified positions via `engine.getEntitiesWith(PlayerIdentityData)` + `Transform.getOrNull(entity)`. Never trust client-reported positions.

## Storage

Persist data across server restarts. **Server-only** — guard with `isServer()`. Import from `@dcl/sdk/server`.

- **Scene Storage** (global, shared across all players): `Storage.set/get/delete(key)` — top-level methods on `Storage`
- **Player Storage** (per-player, scoped by wallet address): `Storage.player.set/get/delete(address, key)`

Storage only accepts strings — use `JSON.stringify()`/`JSON.parse()` for objects. Local dev storage is at `node_modules/@dcl/sdk-commands/.runtime-data/server-storage.json`. Production storage at [decentraland.org/storage](https://decentraland.org/storage). CLI: `npx sdk-commands storage scene/player set/get/delete ...`. Storage persists across deploys (scoped to world, not hash).

**IMPORTANT — storage is limited, do NOT write on every change/tick**: The storage service caps **in-flight requests at 40** and is **rate-limited**. A scene that fires a `Storage.set` per score change / per event / per tick will saturate the queue and some requests are **silently dropped** — persisted state ends up stale or lost. Keep live/working state **in memory** (faster and correct for a server) and persist to Storage only at meaningful checkpoints: game over, player leaves, or a periodic debounced save. Persist only data that must survive server restarts/deploys. See `{baseDir}/references/server-patterns.md` → Storage Patterns and Server Resource Limits.

**Live storage web UI** ([decentraland.org/storage](https://decentraland.org/storage), also reachable from Creator Hub **Manage** → three dots next to a published place → **View Storage**). Three tabs — **Scene**, **Player**, **Environment**. Edits apply to the running scene **live, without republishing**:
- **Scene** tab: view/edit/delete the shared variables (leaderboard, door state). Handy for tweaking live values, e.g. resetting a leaderboard.
- **Player** tab: look up a player by wallet address or name and inspect/edit/clear their stored data. Main use is **support** — un-wedge a player stuck in a bad state (e.g. contradictory data from an older scene version) without redeploying.

## Environment Variables

Configure values without hardcoding. **Server-only**. `EnvVar.get(key: string): Promise<string>` from `@dcl/sdk/server` — always resolves to a string, returns `''` (empty string) when the variable isn't set (never `undefined`). The `|| 'fallback'` pattern still works for defaults since `'' || 'x'` evaluates to `'x'`. Use `.env` file locally (add to `.gitignore`). Deploy with `npx sdk-commands storage env set KEY --value VALUE`. Production UI at [decentraland.org/storage](https://decentraland.org/storage) → **Environment** tab (or Creator Hub → Manage → three dots → **View Storage**).
- **Right place for secrets** (private keys, reward/claim codes, API keys) — the values only ever exist on the server, never reach the client or the published scene code.
- **Write-only in the UI**: you can add, overwrite, or delete a variable, but you **cannot read the current value back** (intentional, to protect secrets).
- Also ideal for **live-tunable game parameters / feature flags** (match duration, max player count) you want to adjust on the running scene without republishing.

## Recommended Project Structure

```
src/
├── index.ts              # Entry point — isServer() branching
├── client/
│   ├── setup.ts          # Client initialization, message handlers
│   └── ui.tsx            # React ECS UI reading synced state
├── server/
│   ├── server.ts         # Server init, systems, message handlers
│   └── gameState.ts      # Server state management class
└── shared/
    ├── schemas.ts        # Synced component definitions + validateBeforeChange
    └── messages.ts       # Message definitions via registerMessages()
```

## Performance Best Practices

Every component change sends the **entire** component data. Prefer atomic components over monolithic ones — group fields that change together, separate fast-changing data from slow-changing data. Throttle frequent messages (never send every frame). For derivable state, broadcast every ~30s and compute locally between.

## Server Lifecycle

The server is **only active while at least one player is in the scene**. After the last player leaves it stays up for roughly two minutes, then shuts down. The next visit cold-starts a fresh instance, which takes **~15 seconds in production**. Local preview launches the server instantly — which is exactly why server-readiness bugs almost always escape into production unnoticed. Always test the "no players have been here for a while" path against a real deploy.

**`isStateSyncronized()` is not a server-readiness check.** It only confirms the CRDT room transport is connected. The room's CRDT snapshot can hold state persisted from a *previous* server run, so a fresh client may see "valid" state while the server is still booting — or while it never wakes up at all because this client is the only one and the platform hasn't started one yet. Messages sent in that window are silently lost and the scene wedges waiting for a server response that will never come.

The reliable pattern is a **server heartbeat**: the server writes `Date.now()` to a synced component field every ~2 s; the client tracks the **client-side time at which it observed the value last change** (not the server's timestamp) and treats the server as alive only if a tick has been observed within ~3× the interval. Tracking client-observed time, not the heartbeat value, means a stale snapshot from a long-gone server run does not read as live, and clock skew between server and client is irrelevant. Publish the first heartbeat *inside* the server's state-init function so the first client to connect doesn't have to wait a full interval.

Distinguish two failure modes at the UI layer — they look similar but behave very differently. Room-not-synced is transient (~1 s during scene load): buffer the action and auto-fire it from a retry system. Server-not-alive can last 15 s or more on a cold start and may never resolve: surface a "server waking up" popup rather than silently buffering, and auto-dismiss it the moment a heartbeat lands so a player who waited isn't left staring at a stale dialog. See `{baseDir}/references/auth-server-examples.md` → Server Liveness Heartbeat for a full implementation.

## Version Control of Deploys

Client and server always move together (paired by hash). Existing players keep the old version until they rejoin. `Storage` data persists across versions.

## Testing & Debugging

- **Log prefixes**: Use `[SERVER]` and `[CLIENT]` in `console.log()`
- **Local multi-player**: Click Preview a second time in Creator Hub, or open `decentraland://realm=http://127.0.0.1:8000&local-scene=true&debug=true`
- **Production logs**: `npx sdk-commands sdk-server-logs` (add `--world WORLD_NAME.dcl.eth` for Worlds). Prompts a wallet-signature challenge; signing wallet must be listed in `scene.json` `logsPermissions`. See `{baseDir}/references/server-patterns.md` → Production Logs.
- **Stale CRDT files**: Delete `main.crdt` and `main1.crdt` and restart
- **Storage inspection**: Check local JSON file or [decentraland.org/storage](https://decentraland.org/storage)
- **Timers**: use `timers.setTimeout` / `timers.setInterval` from `@dcl/sdk/ecs` — never the native JS globals. Prefer `engine.addSystem()` with dt accumulator for game logic
- **Entity sync**: Verify `syncEntity(entity, [componentIds])` with correct `.componentId` values

## Important Notes

- **SDK branch (MANDATORY)**: Requires `@dcl/sdk@auth-server`, not standard `@dcl/sdk`
- **No Node.js APIs**: QuickJS sandbox — no `fs`, `http`, etc. For delays, use `timers.setTimeout` / `timers.setInterval` from `@dcl/sdk/ecs` (not the native JS globals)
- **Single codebase**: Both server and client run the same entry point, branched with `isServer()`
- **Server sleeps when empty**: Code defensively with retry logic and `Storage` for persistence
- For basic CRDT multiplayer without a server, see the `multiplayer-sync` skill

## Example scenes

- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/90,-9-authoritative-server-leaderboard — full end-to-end authoritative leaderboard. Clients send a `claimPoint` action (never a score); the headless server validates proximity to a "score orb" (scene-local coordinates, compared directly), increments the score itself, persists per-player totals to `Storage`, and broadcasts a synced top-N `Leaderboard` component that all clients render. Shows: `authoritativeMultiplayer: true` in `scene.json`, `isServer()` branching, static-import of `registerMessages()`/`defineComponent()` for module-load timing, custom-component `validateBeforeChange` gated by `isServer()` (server-only writes via `AUTH_SERVER_PEER_ID`), server-only `syncEntity`, atomic components (heartbeat kept separate from the board), and the server-liveness heartbeat with client-observed-time tracking.

For full code examples (validation patterns, messages, Storage, EnvVar, performance), see `{baseDir}/references/auth-server-examples.md`. For server setup patterns, see `{baseDir}/references/server-patterns.md`.
