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

The full list, which actions need a player gesture (`openExplorerUi` and `openExplorerUiAndWait`) or a confirmation, and canonical examples (`teleportTo`, `openExternalUrl`, `openNftDialog`, `copyToClipboard`, `changeRealm`) are in SKILL.md → *Restricted Actions*. `movePlayerTo` and emotes live in **player-avatar**. Details below extend those.

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
setCommunicationsAdapter({ connectionString: 'wss://custom-comms.example.com/room/my-scene' })
```

### openExplorerUiAndWait — `until` and `collect`

```typescript
openExplorerUiAndWait<const C extends readonly AnyChannel[] = []>(request: OpenExplorerUiRequest, options?: WaitOptions<C>): Promise<WaitOutcome<C>>
openExplorerUiAndWait(ui: Exclude<ExplorerUi, ExplorerUi.EU_ITEM_PURCHASE>): Promise<WaitOutcome<[]>>   // bare-enum overload, no options

type OpenExplorerUiRequest =
  | { ui: Exclude<ExplorerUi, ExplorerUi.EU_ITEM_PURCHASE>; itemPurchase?: undefined }
  | { ui: ExplorerUi.EU_ITEM_PURCHASE; itemPurchase: { urn: string } } // credits purchase modal: Item purchase below
type StopCondition = AnyChannel | Variant
type WaitOptions<C> = {
  timeoutMs?: number
  until?: StopCondition          // stop early when an event arrives on this channel (or this $case of it)
  collect?: C                    // channels whose events are returned in outcome.events; default none
}
```

Channels are exported by `@dcl/sdk/explorer-ui`: `ExplorerUiEvents` (the `opened` / `closed` entries of `ExplorerUiEventsResult` that belong to the panel **this call opened**, correlated by `requestId`; events of other panels and of other calls are dropped, so `until` cannot watch other panels) and `ItemPurchase` (the `ExplorerItemPurchaseResult` entries of the purchase this call opened: `urn`, `timestamp`, `requestId` and `status` with `$case` `purchased` / `dismissed` / `failed`; see *Item purchase*). `variant(channel, '$case')` narrows a channel to one case. `channel(name, component)` wraps any grow-only component whose entries carry `timestamp` and `requestId` into a channel, so a result component the SDK ships no channel for is usable in `collect` / `until` without waiting for an SDK release; the name must be unique within the scene. The panel closing always ends the wait as `closed`, even when `until` is set; `until` firing first ends it as `matched`. `outcome.events` (on `closed`, `matched` and `timedOut`) holds everything collected, each as `{ channel, event }`; the matching event is included only when its channel is also listed in `collect`.

The promise rejects (so wrap the call in `try` / `catch`) when the `openExplorerUi` RPC throws, when a channel name is reused with a different component, or when an event carries no `requestId` and nothing else identifies its call (an explorer that does not echo `requestId` combined with a panel that can share the screen with another one). Every lifecycle outcome, `notOpened` included, resolves.

```typescript
import { openExplorerUiAndWait, ExplorerUi, ExplorerUiEvents, variant } from "@dcl/sdk/explorer-ui";
import { InputAction, pointerEventsSystem } from "@dcl/sdk/ecs";

pointerEventsSystem.onPointerDown(
  { entity: mapKiosk, opts: { button: InputAction.IA_POINTER, hoverText: "Open map" } },
  async () => {
    try {
      // Resolve as soon as the map this call opened reports `opened`, instead of waiting for the close
      const outcome = await openExplorerUiAndWait(
        { ui: ExplorerUi.EU_MAP },
        { collect: [ExplorerUiEvents], until: variant(ExplorerUiEvents, "opened"), timeoutMs: 10_000 },
      );
      if (outcome.$case === "matched") {
        for (const { event } of outcome.events) console.log(event.ui, event.event?.$case);
      }
    } catch (error) {
      console.error("openExplorerUiAndWait failed", error);
    }
  },
);
```

## Item purchase (`EU_ITEM_PURCHASE`)

Opens the Explorer's buy-with-credits modal for one collection item and reports how it ended. The scene sends only the URN; the Explorer resolves the item's primary listing, shows its price and charges the player.

- **URN**: an item of a Polygon collection, exactly `urn:decentraland:matic:collections-v2:<0x contract, 40 hex>:<item id>` (`amoy` on the test network). The item needs a primary listing payable with credits. Any other URN, or an item with no such listing, answers `OPENED`, shows no modal, and then reports `failed`.
- **Result codes** (`outcome.openResult` on `notOpened`): `REJECTED_FEATURE_DISABLED` when buying with credits is not enabled for this player, and always from a portable experience; `WAS_ALREADY_OPEN` while another purchase (from any scene) is resolving or on screen; `REJECTED_NOT_CURRENT_SCENE` and `REJECTED_NO_USER_GESTURE` as for panels. The purchase modal has its own slot, so it opens alongside an Explorer panel that is already up.
- **Outcome**: one `ExplorerItemPurchaseResult` entry (component 1222, grow-only on `engine.RootEntity`) is written before the `closed` event, so `openExplorerUiAndWait` ends on `closed` with it in `outcome.events` when `ItemPurchase` is in `collect`. `purchased` = paid and minted; `dismissed` = the player closed the modal; `failed` = bad URN, no listing, or an error.
- Grant the in-scene reward only on `purchased`, and treat a `timedOut` wait as unknown (the modal may still be open).

```typescript
import { InputAction, pointerEventsSystem } from '@dcl/sdk/ecs'
import { ExplorerUi, ItemPurchase, openExplorerUiAndWait, OpenExplorerUiResult } from '@dcl/sdk/explorer-ui'

pointerEventsSystem.onPointerDown(
  { entity: vendingMachine, opts: { button: InputAction.IA_POINTER, hoverText: 'Buy' } },
  () => {
    // First statement of the handler: the Explorer accepts it only on the click's tick (or the next).
    const purchase = openExplorerUiAndWait(
      { ui: ExplorerUi.EU_ITEM_PURCHASE, itemPurchase: { urn: ITEM_URN } },
      { collect: [ItemPurchase], timeoutMs: 10 * 60_000 }
    )
    purchase
      .then((outcome) => {
        if (outcome.$case === 'notOpened') return showStatus(OpenExplorerUiResult[outcome.openResult])
        if (outcome.$case === 'timedOut') return showStatus('Still open')
        const result = outcome.events.find((e) => e.channel === 'itemPurchase')
        if (result?.event.status?.$case === 'purchased') grantReward()
      })
      .catch((error) => console.error('purchase could not be tracked', error))
  }
)
```

Test scene: [`79,-5-item-purchase`](https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/79,-5-item-purchase) (a wearable machine, an emote machine and a broken-URN machine that shows the `failed` path; set the URNs and environment in `src/config.ts`, run with `--no-client` and connect with an account that can buy with credits).

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
