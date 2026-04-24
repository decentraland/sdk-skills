---
name: authoritative-server
description: Build multiplayer Decentraland scenes with a headless authoritative server. Covers isServer() branching, registerMessages() for client-server communication, validateBeforeChange() for server-only state, Storage (world and player persistence), EnvVar (environment variables), and project structure. Use when the user wants authoritative multiplayer, anti-cheat, server-side validation, persistent storage, or server messages. Do NOT use for basic CRDT multiplayer without a server (see multiplayer-sync).
---

# Authoritative Server Pattern

**IMPORTANT**: The authoritative server is a feature in BETA. Always notify the user and ask them if they want to proceed before adding it to the scene.

**IMPORTANT — deployment constraint**: The authoritative server currently only works on scenes published to **Worlds**, NOT to LAND parcels in Genesis City. If a world has multiple scenes, only one of them can have an authoritative server.

Build multiplayer Decentraland scenes where a **headless server** controls game state, validates changes, and prevents cheating. The same codebase runs on both server and client, with the server having full authority. Decentraland hosts and deploys the server automatically. For basic CRDT multiplayer (no server), see the `multiplayer-sync` skill instead.

## Setup

You **must** use `npm install @dcl/sdk@auth-server` and `npm install @dcl/js-runtime@auth-server` — the standard `@dcl/sdk` does NOT include authoritative server APIs. Optionally add `logsPermissions` in scene.json to list wallet addresses that can see server logs. The preview automatically starts a local server in the background.

## Server/Client Branching

Use `isServer()` from `@dcl/sdk/network` to branch logic in a single codebase. Server runs headlessly (no rendering) and has access to all player positions via `PlayerIdentityData`.

## Synced Components with Validation

Define custom components that sync from server to all clients. **Always** use `validateBeforeChange()` to prevent clients from modifying server-authoritative state. Guard calls with `isServer()` — on the client the call is a no-op. Incoming values include `senderAddress` (wallet address of sender; equals `AUTH_SERVER_PEER_ID` when sent by server). Always compare addresses with `.toLowerCase()`.

### Validation Patterns

- **Pattern 1 — Server-only writes** (strictest): `Score.validateBeforeChange((v) => v.senderAddress === AUTH_SERVER_PEER_ID)`
- **Pattern 2 — Validate the value itself**: reject impossible values (e.g. `position.y > 0`)
- **Pattern 3 — Proximity validation** (anti-cheat): check player is near the object via `PlayerIdentityData` + `Transform`
- **Pattern 4 — Admin-only writes**: use `getSceneAdmins()` from `@dcl/sdk/server` to restrict to admins

Use `isPreview()` from `@dcl/sdk/network` to relax validation during local development.

**Custom components** use global validation: `GameState.validateBeforeChange((value) => ...)`. **Built-in components** (Transform, GltfContainer) use per-entity validation: `Transform.validateBeforeChange(entity, (value) => ...)`.

After creating and protecting an entity, sync it with `syncEntity(entity, [Transform.componentId, GameState.componentId])`.

## Messages

Use `registerMessages()` for client-to-server and server-to-client communication. Define message schemas with `Schemas.Map(...)` — plain JS objects will fail binary serialization.

- Client sends: `room.send('playerJoin', { displayName: 'Alice' })`
- Server sends to all: `room.send('gameEvent', { ... })`
- Server sends to one: `room.send('gameEvent', { ... }, { to: [playerAddress] })`
- Receive: `room.onMessage('playerJoin', (data, context) => { ... })` — `context.from` is the sender's wallet

Clients must wait for `isStateSyncronized()` (note SDK typo) to return `true` before sending messages.

**IMPORTANT — message size limit**: Never send messages larger than **13 KB**. The transport will silently drop any message that exceeds this limit. Split large payloads into smaller chunks if needed.

### Schema Types Reference

`Schemas.String`, `.Int`, `.Float`, `.Bool`, `.Int64` (for `Date.now()` / 13+ digit numbers), `.Vector3`, `.Quaternion`, `.Entity`, `.Array(Schemas.String)`, `.Optional(Schemas.String)`, `.Map({ name: Schemas.String, hp: Schemas.Int })`.

**Use `Schemas.Int64` for timestamps** — `Schemas.Number` corrupts large numbers (13+ digits).

## Server Reading Player Positions

Read actual server-verified positions via `engine.getEntitiesWith(PlayerIdentityData)` + `Transform.getOrNull(entity)`. Never trust client-reported positions.

## Storage

Persist data across server restarts. **Server-only** — guard with `isServer()`. Import from `@dcl/sdk/server`.

- **World Storage** (global): `Storage.world.set/get/delete(key)`
- **Player Storage** (per-player): `Storage.player.set/get/delete(address, key)`

Storage only accepts strings — use `JSON.stringify()`/`JSON.parse()` for objects. Local dev storage is at `node_modules/@dcl/sdk-commands/.runtime-data/server-storage.json`. Production storage at [decentraland.org/storage](https://decentraland.org/storage). CLI: `npx sdk-commands storage scene/player set/get/delete ...`. Storage persists across deploys (scoped to world, not hash).

## Environment Variables

Configure values without hardcoding. **Server-only**. `EnvVar.get('KEY')` from `@dcl/sdk/server`. Use `.env` file locally (add to `.gitignore`). Deploy with `npx sdk-commands storage env set KEY --value VALUE`. Production UI at [decentraland.org/storage](https://decentraland.org/storage) → Environment tab. Env vars are the right place for secrets (API keys, private keys) since server code never reaches the player.

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

Server is **only active while at least one player is in the scene**. Code must tolerate cold starts — use retry logic on initial client requests and rely on `Storage` to restore state.

## Version Control of Deploys

Client and server always move together (paired by hash). Existing players keep the old version until they rejoin. `Storage` data persists across versions.

## Testing & Debugging

- **Log prefixes**: Use `[SERVER]` and `[CLIENT]` in `console.log()`
- **Local multi-player**: Click Preview a second time in Creator Hub, or open `decentraland://realm=http://127.0.0.1:8000&local-scene=true&debug=true`
- **Production logs**: `npx sdk-commands sdk-server-logs` (optionally `--world WORLD_NAME.dcl.eth`)
- **Stale CRDT files**: Delete `main.crdt` and `main1.crdt` and restart
- **Storage inspection**: Check local JSON file or [decentraland.org/storage](https://decentraland.org/storage)
- **Timers**: `setTimeout`/`setInterval` available via polyfill. Prefer `engine.addSystem()` with dt accumulator
- **Entity sync**: Verify `syncEntity(entity, [componentIds])` with correct `.componentId` values

## Important Notes

- **SDK branch (MANDATORY)**: Requires `@dcl/sdk@auth-server`, not standard `@dcl/sdk`
- **Worlds-only**: Only works on Worlds (not Genesis City LAND)
- **No Node.js APIs**: QuickJS sandbox — no `fs`, `http`, etc. `setTimeout`/`setInterval` supported
- **Single codebase**: Both server and client run the same entry point, branched with `isServer()`
- **Server sleeps when empty**: Code defensively with retry logic and `Storage` for persistence
- For basic CRDT multiplayer without a server, see the `multiplayer-sync` skill

For full code examples (validation patterns, messages, Storage, EnvVar, performance), see `{baseDir}/references/auth-server-examples.md`. For server setup patterns, see `{baseDir}/references/server-patterns.md`.
