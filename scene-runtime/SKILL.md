---
name: scene-runtime
description: Cross-cutting runtime APIs for Decentraland SDK7 scenes. Covers async work (executeTask), HTTP (fetch, signedFetch, getHeaders), WebSocket, timers (timers.setTimeout/clearTimeout/setInterval/clearInterval from @dcl/sdk/ecs — NEVER use the native JS setTimeout), realm/scene info (getRealm, getSceneInformation, getExplorerInformation), world time (getWorldTime), reading deployed files (readFile), EngineInfo frame timing, system execution order & engine.addSystem priority (higher number runs earlier; default 100000), Component.onChange listeners, removeEntityWithChildren, restricted actions (movePlayerTo, teleportTo, triggerEmote, openExternalUrl, openNftDialog, copyToClipboard, changeRealm, triggerSceneEmote), and the @dcl/sdk/testing framework (test, assertEquals, assert, assertComponentValue, deepCloseTo). Use when the user needs async, HTTP, WebSocket, timers, realm/scene metadata, restricted actions, or to write scene tests. Do NOT use for UI (see build-ui), multiplayer sync (see multiplayer-sync), avatar/player data (see player-avatar), or polling-based input (see advanced-input).
---

# Scene Runtime APIs

Cross-cutting runtime APIs available in every Decentraland SDK7 scene.

## Async Tasks

The scene runtime is single-threaded. Wrap any async work in `executeTask()`:

```typescript
import { executeTask } from "@dcl/sdk/ecs";

executeTask(async () => {
  const res = await fetch("https://api.example.com/data");
  const data = await res.json();
  console.log(data);
});
```

## HTTP: fetch & signedFetch

**Plain fetch** works for public APIs:

```typescript
const res = await fetch("https://api.example.com/data");
```

**signedFetch** proves the player's identity to your backend. Use `getHeaders()` to obtain only the signed headers (useful when a library manages its own fetch):

```typescript
import { signedFetch, getHeaders } from "~system/SignedFetch";

// Full signed request
const res = await signedFetch({
  url: "https://your-server.com/api",
  init: { method: "POST", body: JSON.stringify(payload) },
});

// Get signed headers only (for custom fetch calls)
const { headers } = await getHeaders({ url: "https://your-server.com/api" });
```

`signedFetch` returns `{ ok, status, statusText, headers, body }` where `body` is a **string** (call `JSON.parse(response.body)` yourself — there is no `.json()`). The signed identity headers are added automatically; your backend verifies them per ADR-44.

> **Permission**: the nominal permission for external HTTP is `"USE_FETCH"` (and `"USE_WEBSOCKET"` for sockets), declared in `scene.json` `requiredPermissions`. In practice plain/signed `fetch` to non-media hosts is not hard-blocked in preview/Worlds even without it (the `66,6-signed-fetch` test scene calls `signedFetch` with an empty `requiredPermissions`). Declare `USE_FETCH` anyway for correctness and forward-compat. `signedFetch` does not require prior player interaction — restricted actions do, `fetch`/`signedFetch` do not.

## WebSocket

```typescript
const ws = new WebSocket("wss://your-server.com/ws");
ws.onopen = () => ws.send("hello");
ws.onmessage = (event) => console.log(event.data);
ws.onclose = () => console.log("disconnected");
```

## Scene & Realm Information

```typescript
import { getSceneInformation, getRealm, getExplorerInformation } from "~system/Runtime";

executeTask(async () => {
  // Scene info: URN, content mappings, metadata JSON, baseUrl
  const scene = await getSceneInformation({});
  const metadata = JSON.parse(scene.metadataJson);
  console.log(scene.urn, scene.baseUrl, metadata);

  // Realm info: baseUrl, realmName, isPreview, networkId, commsAdapter
  const realm = await getRealm({});
  console.log(realm.realmInfo?.realmName, realm.realmInfo?.isPreview);

  // Explorer info: agent string, platform, configurations
  const explorer = await getExplorerInformation({});
  console.log(explorer.agent, explorer.platform);
});
```

## World Time

```typescript
import { getWorldTime } from "~system/Runtime";

executeTask(async () => {
  const { seconds } = await getWorldTime({});
  // seconds = coordinated world time (cycles 0-86400 for day/night)
});
```

## Read Deployed Files

Read files deployed with the scene at runtime:

```typescript
import { readFile } from "~system/Runtime";

executeTask(async () => {
  const result = await readFile({ fileName: "data/config.json" });
  const text = new TextDecoder().decode(result.content);
  const config = JSON.parse(text);
});
```

## EngineInfo Component

Access frame-level timing:

```typescript
import { EngineInfo } from "@dcl/sdk/ecs";

engine.addSystem(() => {
  const info = EngineInfo.getOrNull(engine.RootEntity);
  if (info) {
    console.log(info.frameNumber, info.tickNumber, info.totalRuntime);
  }
});
```

## System Execution Order & Priority

`engine.addSystem(fn, priority?, name?)` runs `fn(dt)` every frame. The `priority` parameter controls **when** in the frame it runs relative to other systems.

**HIGHER priority number = runs EARLIER in the frame.** Systems are sorted **descending** by priority (`sort((a, b) => b.priority - a.priority)` in `@dcl/ecs`). The SDK's own JSDoc states: *"a number with the priority, big number are called before smaller ones."*

> **WARNING — counter-intuitive:** This is the OPPOSITE of Unity/Godot/many engines where a lower number runs first. In Decentraland SDK7, "make this run first" means giving it a **large** priority number, NOT `1`. A system with priority `1` runs almost LAST.

Key numbers:

- **Default priority is `100000`** (`SYSTEMS_REGULAR_PRIORITY = 100e3`). `engine.addSystem(fn)` with no priority uses this.
- `@dcl/react-ecs` registers its UI renderer system at `100000` (and a UI-scale system at `100001`). So UI runs alongside/just before default-priority systems.
- To run **before** all regular systems, pass a priority **above** `100000` (e.g. `engine.addSystem(fn, 1000000)`). To run **after** them, pass a priority **below** `100000` (e.g. `10`, or the default `0` used by scripts).

```typescript
engine.addSystem(earlySystem, 1000000);  // runs before regular systems
engine.addSystem(regularSystem);          // priority 100000 (default)
engine.addSystem(lateSystem, 10);         // runs after regular systems
```

- Physics libraries (e.g. cannon.js) stepped inside a system's `update(dt)` obey the same rule — there is no separate physics loop. Give the physics-stepping system a high priority if other systems must read post-step state the same frame.
- Systems with the **same** priority currently run in insertion order, but the engine does not guarantee a stable tie-break (noted as a TODO in the source). Do not rely on ordering between equal-priority systems.

## Restricted Actions

These require player interaction before they can execute. Import from `~system/RestrictedActions`:

```typescript
import {
  movePlayerTo,
  teleportTo,
  triggerEmote,
  changeRealm,
  openExternalUrl,
  openNftDialog,
  triggerSceneEmote,
  copyToClipboard,
  setCommunicationsAdapter,
} from "~system/RestrictedActions";

// Move player within scene bounds. Optional: cameraTarget (where the
// CAMERA looks), avatarTarget (where the AVATAR faces — for rotating in
// place), duration (seconds, for a smooth glide instead of a snap).
movePlayerTo({
  newRelativePosition: { x: 8, y: 0, z: 8 },
  cameraTarget: { x: 8, y: 1, z: 12 },
});

// Teleport to coordinates in Genesis City
teleportTo({ worldCoordinates: { x: 50, y: 70 } });

// Play a built-in emote
triggerEmote({ predefinedEmote: "wave" });

// Open URL in browser (prompts user)
openExternalUrl({ url: "https://decentraland.org" });

// Open NFT detail dialog
openNftDialog({
  urn: "urn:decentraland:ethereum:erc721:0x06012c8cf97BEaD5deAe237070F9587f8E7A266d:558536",
});

// Copy text to clipboard
copyToClipboard({ value: "Hello from Decentraland!" });

// Change realm. `message` is OPTIONAL: omit it to switch with no prompt,
// include it to show the player a confirmation dialog first.
changeRealm({ realm: "https://peer.decentraland.org" }); // no prompt
changeRealm({ realm: "other-realm.dcl.eth", message: "Join this realm?" });
```

## Timers

**Always use the engine-bound `timers` object from `@dcl/sdk/ecs`.** Do NOT use the native JS `setTimeout` / `setInterval` globals. Although the QuickJS runtime exposes JS-standard `setTimeout` / `clearTimeout` / `setInterval` / `clearInterval` as globals (declared in `@dcl/js-runtime/index.d.ts`), calling them in a Decentraland scene may appear to work but can introduce subtle problems — they are not bound to the scene's engine. Use `timers.setTimeout` instead.

```typescript
import { timers } from "@dcl/sdk/ecs";

const timeoutId = timers.setTimeout(() => console.log("delayed"), 2000);
timers.clearTimeout(timeoutId);

const intervalId = timers.setInterval(() => console.log("tick"), 1000);
timers.clearInterval(intervalId);
```

The signatures match the JS-standard timers:

```ts
timers.setTimeout(callback: () => void, ms: number): number
timers.clearTimeout(timerId: number): void
timers.setInterval(callback: () => void, ms: number): number
timers.clearInterval(timerId: number): void
```

**Argument order is `(callback, ms)`** — not `(ms, callback)`. Do NOT write a custom helper that flips them.

**Do NOT write a custom per-frame timer system** that accumulates `dt` to fire delayed callbacks. The SDK already ships `timers`. Custom systems duplicate work, drift from the engine's own scheduling, and are the wrong abstraction for one-shot delays.

For a custom engine instance, use `createTimers(engineInstance)` from `@dcl/sdk/ecs` to get a `Timers` object scoped to that engine.

**System-based timers** (recommended for game logic — synchronized with the frame loop):

```typescript
let elapsed = 0;
engine.addSystem((dt: number) => {
  elapsed += dt;
  if (elapsed >= 3) {
    elapsed = 0;
    // Do something every 3 seconds
  }
});
```

## Component.onChange() Listener

React to component changes on any entity:

```typescript
Transform.onChange(engine.PlayerEntity, (newValue) => {
  if (newValue) {
    console.log("Player moved to", newValue.position);
  }
});
```

## Utility: removeEntityWithChildren

Recursively remove an entity and all its children:

```typescript
import { removeEntityWithChildren } from "@dcl/sdk/ecs";

removeEntityWithChildren(engine, parentEntity);
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
- `kill({ pid })` and `getPortableExperiencesLoaded({})` both key off `pid`, never `urn`.
- The **host scene** must enable them in `scene.json`: `"featureToggles": { "portableExperiences": "enabled" }`. Values: `"enabled"` | `"disabled"` | `"hideUi"` (spawns PX but hides their UI). With `"disabled"`, `spawn()` is a no-op / rejected.

## Testing Framework

Scenes can ship unit tests using `@dcl/sdk/testing`. Tests are generators — yielding pauses until the next frame so you can observe engine state across ticks.

```typescript
import { test } from "@dcl/sdk/testing";
import {
  assertComponentValue,
  assertEquals,
} from "@dcl/sdk/testing/assert";
import { engine, Transform, MeshRenderer } from "@dcl/sdk/ecs";
import { Vector3, Quaternion } from "@dcl/sdk/math";

test("transform is applied after one frame", function* () {
  const entity = engine.addEntity();
  Transform.create(entity, { position: Vector3.One() });

  // Let the engine run for a frame before asserting
  yield;

  assertComponentValue(entity, Transform, {
    position: Vector3.One(),
    scale: Vector3.One(),
    rotation: Quaternion.Identity(),
    parent: 0 as any,
  });
});

test("five meshes are present", function* () {
  yield;
  assertEquals(1 + 1, 2, "basic math");
  // No count assertion exists — count via getEntitiesWith + Array.from
  assertEquals(
    Array.from(engine.getEntitiesWith(MeshRenderer)).length,
    5,
    "should have 5 meshes"
  );
});
```

**Available assertions** (`@dcl/sdk/testing/assert`) — exactly these four:

- `assertEquals(actual, expected, message?)` — deep-equals check
- `assert(condition, message?)` — truthiness check
- `assertComponentValue(entity, Component, expected)` — full component value comparison
- `deepCloseTo(actual, expected, options?)` — deep numeric comparison with tolerance (for floats)

There is NO count assertion — count entities with `assertEquals(Array.from(engine.getEntitiesWith(Comp)).length, n)`.

**Running tests**: there is no CLI test command (`npx @dcl/sdk-commands test` does not exist). Tests execute only when the hosting runtime exposes the `~system/Testing` module — CI test runners or test-enabled explorers. In a normal preview the test runner is a no-op that just logs, and it's guarded behind DEBUG in production builds. Tests run inside the same QuickJS runtime as the scene, so the same restrictions apply (no Node.js APIs, use SDK timers, etc.).

## Best Practices

- Always wrap async code in `executeTask()` or async functions — bare promises will be silently dropped
- Use `signedFetch` (not plain `fetch`) when your backend needs to verify the player's identity
- Check `realm.realmInfo?.isPreview` to detect preview mode and enable debug features
- Use `readFile()` for data files (JSON configs, level data) deployed alongside the scene
- `removeEntityWithChildren()` is essential when cleaning up complex entity hierarchies
- Logging: only `console.log()` and `console.error()` are declared in the runtime — `console.warn()`, `.info()`, `.debug()`, `.trace()` are NOT available

## Example scenes

Engine-team test scenes exercising these APIs against the real runtime:

- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/66,6-signed-fetch — `signedFetch` on click; reads `response.ok`/`.status`/`.body`, inspects the auto-added signed headers.
- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/80,-4-restricted-actions — every RestrictedAction via UI buttons: `movePlayerTo` (with `cameraTarget` and `avatarTarget`), `teleportTo`, `triggerEmote`, `triggerSceneEmote`, `openExternalUrl`, `openNftDialog`, `changeRealm` (with and without `message`).
- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/8,8-portable-experience — `spawn({ ens })` / `kill({ pid })` from the spawn response; host `scene.json` has `portableExperiences: "enabled"`.
- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/8,9-portable-experience-disabled — same, but host `scene.json` sets `portableExperiences: "disabled"` (spawn suppressed).
- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/8,7-portable-experience-hide-ui — host `scene.json` sets `portableExperiences: "hideUi"` (PX run, their UI hidden).

For complete executeTask patterns, all RestrictedActions, realm detection, and portable experiences, see `{baseDir}/references/runtime-apis.md`.
