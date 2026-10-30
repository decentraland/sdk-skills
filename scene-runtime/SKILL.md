---
name: scene-runtime
description: Cross-cutting runtime APIs for Decentraland SDK7 scenes. Use when the user needs async work (executeTask), HTTP (fetch/signedFetch) or WebSocket, timers, realm/scene metadata, restricted actions (teleportTo / realm change, external URLs, NFT dialog, explorer panels, clipboard), system execution order/priority, or to write scene tests. Do NOT use for UI (see build-ui), multiplayer sync (see multiplayer-sync), avatar/player data (see player-avatar), or polling-based input (see advanced-input).
---

# Scene Runtime APIs

## Async Tasks

Scenes run in a single-threaded QuickJS sandbox with no Node.js APIs (`fs`, `http`, `path`, `process`). Wrap any async work in `executeTask()` (or an async function) — bare promises are silently dropped:

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

> **Permission**: a scene needs none — scenes and portable experiences run with every permission granted. Only a **smart wearable** must declare `"USE_FETCH"` for `fetch` (and `"USE_WEBSOCKET"` for sockets) in `requiredPermissions`, or the call fails with `Fetch API: permission denied`; `signedFetch` is gated by no permission (**smart-wearables** → Permissions). `fetch` and `signedFetch` need no prior player interaction.

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
  // metadata.scene?.parcels (parcel list), metadata.display?.title (scene title)
  console.log(scene.urn, scene.baseUrl, metadata);

  // Realm info: baseUrl, realmName, isPreview, networkId (1 = mainnet, 5 = goerli), commsAdapter
  const realm = await getRealm({});
  console.log(realm.realmInfo?.realmName, realm.realmInfo?.isPreview); // realmName e.g. "peer-us-1"

  // Explorer info: agent string, platform, configurations
  const explorer = await getExplorerInformation({});
  console.log(explorer.agent, explorer.platform);
});
```

Check `realm.realmInfo?.isPreview` to detect preview mode and gate debug features.

## World Time

```typescript
import { getWorldTime } from "~system/Runtime";

executeTask(async () => {
  const { seconds } = await getWorldTime({});
  // seconds = coordinated world time (cycles 0-86400 for day/night)
});
```

## Read Deployed Files

Read files deployed with the scene at runtime — use it for data files like JSON configs or level data:

```typescript
import { readFile } from "~system/Runtime";

executeTask(async () => {
  const result = await readFile({ fileName: "data/config.json" });
  const text = new TextDecoder().decode(result.content);
  const config = JSON.parse(text);
});
```

## EngineInfo Component

Frame-level timing plus scene visibility, on `engine.RootEntity`:

```typescript
import { EngineInfo, engine } from "@dcl/sdk/ecs";

engine.addSystem(() => {
  const info = EngineInfo.getOrNull(engine.RootEntity);
  if (info) {
    console.log(info.frameNumber, info.tickNumber, info.totalRuntime);
    // info.sceneHidden: true when a fullscreen Explorer UI (map, backpack,
    // settings, loading screen, etc.) covers the scene viewport.
    if (info.sceneHidden) {
      // Pause expensive work, audio, animations — the player cannot see or
      // interact with the scene while it is hidden.
    }
  }
});
```

### EngineInfo fields

| Field | Type | Description |
|---|---|---|
| `frameNumber` | `number` | Frame counter of the engine |
| `tickNumber` | `number` | Tick counter of the scene (per ADR-148) |
| `totalRuntime` | `number` | Total runtime of this scene in seconds |
| `sceneHidden` | `boolean` | `true` when the scene is hidden behind a fullscreen Explorer UI (map, backpack, settings, camera reel, loading screen). Written at the "physics" stage alongside `frameNumber`/`tickNumber`. Use to pause gameplay, audio, animations, and expensive systems when the scene is not visible. Default `false`. |


### Detecting when the loading screen fades out

`sceneHidden` is `true` while the Explorer's loading screen covers the scene and flips to `false` the moment it fades out. **This is the only signal a scene gets for the first moment the player actually sees it.** `onSceneReady`-style timing based on `totalRuntime`, a frame counter, or a `utils.timers` delay is guesswork — the loading screen lasts as long as it lasts, and varies per player and per machine.

Use it to hold back anything the player is meant to witness: intro cinematics, welcome sounds/VO, an opening tween, a title UI, or an analytics event that shouldn't fire while the player is still staring at a loading screen.

```typescript
import { EngineInfo, engine } from "@dcl/sdk/ecs";

engine.addSystem(function waitForSceneRevealed() {
  const info = EngineInfo.getOrNull(engine.RootEntity);
  if (!info || info.sceneHidden) return;

  engine.removeSystem(waitForSceneRevealed); // one-shot
  // the player is now looking at the scene — start the intro here
});
```

- The scene keeps ticking normally while `sceneHidden` is `true` — it is not paused, just not displayed. Don't use this flag to gate scene logic, only to time presentation.
- Always guard with `getOrNull` — the component may not exist on the very first frames.
- Remove the system (or set a `done` flag) after it fires; otherwise it re-runs every frame.

## System Execution Order & Priority

`engine.addSystem(fn, priority?, name?)` runs `fn(dt)` every frame. The `priority` parameter controls **when** in the frame it runs relative to other systems.

**HIGHER priority number = runs EARLIER in the frame** (systems sort descending), the opposite of Unity/Godot. "Make this run first" means a **large** number; a system with priority `1` runs almost last.

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

They run only while the player is inside the scene. `openExplorerUi` also needs a fresh player gesture (see its section); `openExternalUrl`, `teleportTo`, `changeRealm` and `openNftDialog` ask the player to confirm first. Player movement and emotes (`movePlayerTo`, `triggerEmote`, `triggerSceneEmote`, `stopEmote`): **player-avatar**. Import from `~system/RestrictedActions`:

```typescript
import {
  teleportTo,
  changeRealm,
  openExternalUrl,
  openNftDialog,
  copyToClipboard,
  setCommunicationsAdapter,
  openExplorerUi,
} from "~system/RestrictedActions";

// Teleport to coordinates in Genesis City
teleportTo({ worldCoordinates: { x: 50, y: 70 } });

// Teleport into another realm / World. `realm` takes a World name
// (`foo.dcl.eth`) or a realm URL; the client does a FULL RECONNECT to
// that realm, then lands on the parcel. Requires @dcl/sdk 7.28.0+.
// The player is asked to confirm first ("Are you sure you want to enter
// this World?"); the switch only happens if they accept.
teleportTo({ realm: "foo.dcl.eth", worldCoordinates: { x: 0, y: 0 } });

// Omit worldCoordinates to land on that realm's default spawn.
// This replaces changeRealm.
teleportTo({ realm: "foo.dcl.eth" });

// Open URL in browser (prompts user)
openExternalUrl({ url: "https://decentraland.org" });

// Open NFT detail dialog
openNftDialog({
  urn: "urn:decentraland:ethereum:erc721:0x06012c8cf97BEaD5deAe237070F9587f8E7A266d:558536",
});

// Copy text to clipboard
copyToClipboard({ text: "Hello from Decentraland!" });

// [DEPRECATED] changeRealm — use teleportTo({ realm }) instead.
// The player always gets a confirmation dialog. `message` is OPTIONAL:
// omit it to show the default text, include it to show custom text.
changeRealm({ realm: "https://peer.decentraland.org" }); // default prompt text
changeRealm({ realm: "other-realm.dcl.eth", message: "Join this realm?" }); // custom prompt text
```

#### `changeRealm` is `[DEPRECATED]` — prefer `teleportTo({ realm })`

`changeRealm` resolves when the request is *accepted*, not when the new realm is *live*, so `changeRealm(...)` followed by `teleportTo(coords)` lands on the parcel in the **old** realm. Use one `teleportTo({ realm, worldCoordinates })` call. `changeRealm` still works; it is the only one that sets custom prompt text (`message`). Signature: `{baseDir}/references/runtime-apis.md` → teleportTo.

### openExplorerUi -- Open Explorer Panels

Open a fullscreen explorer panel (map, backpack, settings, etc.) from scene code. The call must land in the same tick as a **player gesture**, otherwise it returns `REJECTED_NO_USER_GESTURE`.

```typescript
import { openExplorerUi } from "~system/RestrictedActions";
import { ExplorerUi } from "@dcl/sdk/ecs";

// Open the map panel
openExplorerUi({ ui: ExplorerUi.EU_MAP });
```

The call resolves to `{ openResult }`, an `OpenExplorerUiResult` (also from `~system/RestrictedActions`): `OPENED`, `WAS_ALREADY_OPEN` (the slot that panel uses is already taken; panels sharing a slot exclude each other, so another panel or section may be the one showing), `REJECTED_NOT_CURRENT_SCENE` (the player is not in this scene), `REJECTED_FEATURE_DISABLED` (the client hides or does not support that panel), `REJECTED_NO_USER_GESTURE` (not called from a player interaction), plus the default `UNSPECIFIED`. Treat only `OPENED` as success: on anything else, show the information another way or tell the player what to open.

**What counts as a gesture**: a click on a 3D entity (`pointerEventsSystem.onPointerDown` / `onPointerUp`), a click on scene UI (`onMouseDown` / `onMouseUp`), or an activation button (`E`, `F`, `1`-`4`: `IA_PRIMARY`, `IA_SECONDARY`, `IA_ACTION_3`-`IA_ACTION_6`) read with `inputSystem.isTriggered` on `PET_DOWN` / `PET_UP`. Hover, movement keys, `main()`, timers and trigger areas are not gestures. The window is about one tick, so call `openExplorerUi` **first** inside the handler: an `await` on a fetch, a timer or another restricted action before it pushes the call outside the window.

```typescript
import { openExplorerUi, OpenExplorerUiResult } from "~system/RestrictedActions";
import { ExplorerUi, InputAction, pointerEventsSystem } from "@dcl/sdk/ecs";

pointerEventsSystem.onPointerDown(
  { entity: placesSign, opts: { button: InputAction.IA_POINTER, hoverText: "Places" } },
  async () => {
    const { openResult } = await openExplorerUi({ ui: ExplorerUi.EU_PLACES });
    if (openResult !== OpenExplorerUiResult.OPENED) {
      showHint("Open Places from the menu to find more scenes"); // your own UI fallback
    }
  },
);
```

`ExplorerUi` enum values (imported from `@dcl/sdk/ecs`): `EU_SETTINGS` (0), `EU_MAP` (1), `EU_BACKPACK` (2), `EU_CAMERA_REEL` (3), `EU_COMMUNITIES` (4), `EU_PLACES` (5), `EU_EVENTS` (6). The enum is shared between `openExplorerUi` and `ExplorerUiEventsResult` -- no casts needed when comparing. `EU_ITEM_PURCHASE` also exists in the SDK types but the explorer has no purchase flow and answers `REJECTED_FEATURE_DISABLED`; do not use it.

### openExplorerUiAndWait -- Wait Until the Panel Closes

`openExplorerUiAndWait` (`@dcl/sdk/explorer-ui`, SDK **7.30.0+**) opens a panel and resolves when the player closes it. Use it when the scene continues only after the player is done (sent to the backpack to equip something, to the map to pick a destination). Same gesture rule: call it first inside the handler; the `await` on its result is fine because the panel is already requested. The module re-exports `ExplorerUi`, and the bare-enum overload `openExplorerUiAndWait(ExplorerUi.EU_MAP)` is equivalent to `{ ui: ExplorerUi.EU_MAP }`.

```typescript
import { openExplorerUiAndWait, ExplorerUi } from "@dcl/sdk/explorer-ui";
import { InputAction, pointerEventsSystem } from "@dcl/sdk/ecs";

pointerEventsSystem.onPointerDown(
  { entity: wardrobe, opts: { button: InputAction.IA_POINTER, hoverText: "Change outfit" } },
  async () => {
    const outcome = await openExplorerUiAndWait({ ui: ExplorerUi.EU_BACKPACK }, { timeoutMs: 60_000 });
    if (outcome.$case === "closed") startFashionShow();
    else if (outcome.$case === "notOpened") showHint(`Backpack unavailable: ${outcome.openResult}`);
  },
);
```

`outcome.$case`: `closed` (the panel this call opened was closed, the normal end), `notOpened` (nothing opened; `outcome.openResult` is the `OpenExplorerUiResult` reason, resolves immediately), `timedOut` (`timeoutMs` elapsed with the panel still open), `matched` (an `until` condition fired first; the panel may still be open). There is no default timeout: a panel can stay open for minutes, so pass `timeoutMs` whenever the scene must move on regardless. `until` / `collect` options and event channels: `{baseDir}/references/runtime-apis.md` → openExplorerUiAndWait.

### ExplorerUiEventsResult -- Observe Panel Open/Close

Scenes can observe when explorer panels are opened or closed. `ExplorerUiEventsResult` is a grow-only value set (APPEND semantics, max 100 entries) on `engine.RootEntity`. Each entry reports which panel and whether it opened or closed.

```typescript
import { engine, ExplorerUiEventsResult, ExplorerUi } from "@dcl/sdk/ecs";

engine.addSystem(() => {
  const results = ExplorerUiEventsResult.get(engine.RootEntity);
  for (const entry of results.values()) {
    if (entry.ui === ExplorerUi.EU_MAP) {
      if (entry.event?.$case === "opened") {
        console.log("Map was opened");
      } else if (entry.event?.$case === "closed") {
        console.log("Map was closed");
      }
    }
  }
});
```

Each entry has: `ui` (`ExplorerUi` enum), `timestamp` (scene tick), `event` (oneof: `{ $case: 'opened' }` or `{ $case: 'closed' }`). Component id 1220.

## Timers

**Always use the engine-bound `timers` object from `@dcl/sdk/ecs`** (`timers.setTimeout`, `timers.setInterval`). QuickJS also exposes the JS-standard globals, but they are not bound to the scene's engine.

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

**Argument order is `(callback, ms)`**, as in standard JS.

**Timer error handling:** if a timer callback throws, subsequent timers still measure correctly. The SDK clears the internal timing context via `try/finally` so a thrown exception in one callback does not corrupt elapsed-time tracking for later timers.

For a custom engine instance, use `createTimers(engineInstance)` from `@dcl/sdk/ecs` to get a `Timers` object scoped to that engine.

**Callbacks vs per-frame state.** A one-shot or periodic **callback** (do X in 2 s, every 1 s) is `timers.setTimeout` / `setInterval`; `timers` is itself an engine system that accumulates `dt`, so it is already frame-synchronized. **Per-frame game state** you update or read every tick (a cooldown bar, regeneration, a countdown shown in UI) is a `dt` accumulator inside your own system:

```typescript
let cooldown = 0; // seconds left; a UI bar reads it every frame
engine.addSystem((dt: number) => {
  if (cooldown > 0) cooldown = Math.max(0, cooldown - dt);
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

## Entity Removal

### engine.removeEntity(entity): boolean

Removes all components from an entity and releases its id for reuse. Returns `boolean` (`@dcl/sdk` 7.27.0+; earlier SDKs return `void` and can purge a live remote avatar's components):
- `true` — entity accepted; components purged, id released for recycling.
- `false` — entity refused; components **untouched**, id stays reserved. This happens for entity ids in the renderer-reserved range (avatar entities, numbers 3 through `reservedStaticEntities - 1` at any version). The three named static entities (`engine.RootEntity`, `engine.PlayerEntity`, `engine.CameraEntity`) are also reserved and never released, but their components **are** still purged (the renderer accepts scene deletes on those three).

**Gotcha — avatar entity collision:** `engine.removeEntity` refuses renderer-reserved ids, so it cannot purge a live remote player's avatar entity. Never call `removeEntity` on an entity returned by iterating `PlayerIdentityData` unless you specifically intend to clear a named static entity.

### removeEntityWithChildren

Recursively remove an entity and all its children — reach for this when cleaning up complex entity hierarchies:

```typescript
import { removeEntityWithChildren } from "@dcl/sdk/ecs";

removeEntityWithChildren(engine, parentEntity);
```

**Caveat — partial completion:** `removeEntityWithChildren` can complete only partially without reporting it. If a renderer-reserved node (e.g. an avatar entity) appears anywhere in the Transform tree, that node's removal is refused by `removeEntity` while its descendants are still removed, leaving the surviving node's `Transform.parent` pointing at a removed entity. This is reachable only if a scene parents a reserved entity under a scene entity. The function returns `void` — there is no per-node result.

## Portable Experiences

Spawning, listing and killing portable experiences from a scene (`~system/PortableExperiences`, keyed by `ens` / `pid`, never `urn`), and the host scene's `featureToggles.portableExperiences`: `{baseDir}/references/runtime-apis.md` → Portable Experiences. Building one that runs while a wearable is equipped: **smart-wearables**.

## Testing Framework

Writing scene tests with `@dcl/sdk/testing` (generator tests, the four assertions, where tests run): `{baseDir}/references/testing.md`.

## Logging

Only `console.log()` and `console.error()` are declared in the runtime — `console.warn()`, `.info()`, `.debug()`, `.trace()` are NOT available.

## Example scenes

Engine-team test scenes exercising these APIs against the real runtime:

- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/66,6-signed-fetch — `signedFetch` on click; reads `response.ok`/`.status`/`.body`, inspects the auto-added signed headers.
- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/2,0-skybox-scene-json — `executeTask` + `getSceneInformation({})` reading the scene's own `scene.json` at runtime: `JSON.parse(sceneInfo.metadataJson)`, then walking `worldConfiguration.skyboxConfig` with a fallback to top-level `skyboxConfig`. The sibling https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/3,0-skybox-world-json is the same code against a `worldConfiguration` deployment.
- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/80,-4-restricted-actions — every RestrictedAction via UI buttons: `movePlayerTo` (with `cameraTarget` and `avatarTarget`), `teleportTo`, `triggerEmote`, `triggerSceneEmote`, `openExternalUrl`, `openNftDialog`, `changeRealm` (with and without `message`).
- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/8,8-portable-experience — `spawn({ ens })` / `kill({ pid })` from the spawn response; host `scene.json` has `portableExperiences: "enabled"`.
- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/8,9-portable-experience-disabled — same, but host `scene.json` sets `portableExperiences: "disabled"` (spawn suppressed).
- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/8,7-portable-experience-hide-ui — host `scene.json` sets `portableExperiences: "hideUi"` (PX run, their UI hidden).

`setCommunicationsAdapter`, `teleportTo({ realm })` details and extra `executeTask` variants (error handling, sequential): `{baseDir}/references/runtime-apis.md`.
