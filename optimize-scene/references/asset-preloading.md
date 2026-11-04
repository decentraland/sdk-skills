# Asset Preloading (AssetLoad)

Use `AssetLoad` to pre-load assets into memory ahead of time so they display instantly when needed. `PBAssetLoad` has a single field: `assets: string[]` — the list of asset paths to load. Commonly created on `engine.RootEntity`, but any entity works.

```typescript
import {
	engine,
	AssetLoad,
	assetLoadLoadingStateSystem,
	LoadingState,
} from '@dcl/sdk/ecs'

// Queue assets to pre-load (any entity works — commonly a dedicated empty entity).
// At most 40 paths per entity over its lifetime (see "40 paths per entity" below);
// for a longer list, create another AssetLoad entity rather than pushing more paths here.
AssetLoad.create(entity, { assets: ['assets/Models/big.glb', 'assets/Sounds/win.mp3'] })

// React to loading state. The callback fires PER ASSET STATE CHANGE (typically
// LOADING, then FINISHED or an error), receiving { asset, currentState } — NOT one batch-level event.
assetLoadLoadingStateSystem.registerAssetLoadLoadingStateEntity(
	entity,
	(state: { asset: string; currentState: LoadingState }) => {
		if (state.currentState === LoadingState.FINISHED) {
			// state.asset finished loading and is now cached
		}
	},
)
// Stop listening: assetLoadLoadingStateSystem.removeAssetLoadLoadingStateEntity(entity)
```

`LoadingState` enum members: `LOADING`, `FINISHED`, `FINISHED_WITH_ERROR` (asset found but failed to load), `NOT_FOUND` (path does not exist), `UNKNOWN` (initial/default state). A missing/typo'd `src` resolves to `NOT_FOUND`, not a thrown error.

Caveats:

- The state callback is **per-asset**, keyed by the `asset` path string — dispatch on `state.asset` to update the right entity. There is no single "all finished" event; track completion yourself by counting per-asset `FINISHED`/error states.
- `AssetLoad` only **adds** assets to memory. Removing a path from the `assets` list does **not** free memory — there is no unload via `AssetLoad`.
- Preloading a path does **not** create/render anything — you still `getOrCreateMutable` the real component (`GltfContainer`, `AudioSource`, `VideoPlayer`, `Material` texture) on an entity to use it; the preload just makes that later use instant.

## 40 paths per entity

Keep **≤40 paths per `AssetLoad` entity**. For a longer list, split it into batches of up to 40, one entity per batch, each with its own `registerAssetLoadLoadingStateEntity` call:

```typescript
import { timers } from '@dcl/sdk/ecs'

function preloadAll(paths: string[], timeoutMs: number, onDone: () => void) {
	const pending = new Set(paths)
	let done = false
	const finish = () => { if (!done) { done = true; onDone() } }
	for (let i = 0; i < paths.length; i += 40) {
		const batch = engine.addEntity()
		AssetLoad.create(batch, { assets: paths.slice(i, i + 40) })
		assetLoadLoadingStateSystem.registerAssetLoadLoadingStateEntity(batch, ({ asset, currentState }) => {
			if (currentState === LoadingState.LOADING || currentState === LoadingState.UNKNOWN) return
			if (currentState !== LoadingState.FINISHED) console.error('preload failed', asset, currentState)
			pending.delete(asset)
			if (pending.size === 0) finish()
		})
	}
	timers.setTimeout(() => {
		if (pending.size > 0) console.error('preload timeout, unconfirmed:', Array.from(pending).join(', '))
		finish()
	}, timeoutMs)
}
```

Why: the client reports state into `AssetLoadLoadingState`, a grow-only set capped at **100 entries per entity** that evicts its oldest entries past the cap (js-sdk-toolchain `components/generated/index.gen.ts`, `maxElements: 100`; `engine/grow-only-value-set-component-definition.ts`). The client appends one entry per state change per asset, at least `LOADING` then `FINISHED`, so about 50 assets fill it. The SDK dispatcher (`systems/assetLoad.ts`) fires callbacks only when the set's `size` changes, and a full set stays at 100, so **the callback silently stops for that entity**: every later state change on it goes unreported. Observed: a 138-path preload on one entity always ran to its timeout; the same assets split into batches of ≤40 per entity all reported `FINISHED` in about 2 s. An SDK issue has been filed.

Any wait-for-all needs a **timeout that logs the paths still unconfirmed**, so a silent stall shows up as a named list instead of a hang. Preload timings measured in local preview are best case, especially on a second run with the Explorer's cache warm; a player's first visit downloads every asset from the content server, so size timeouts with generous margin.

Ground truth: `88,-12-asset-load` in sdk7-test-scenes (mp3 / texture / video / glb, plus a deliberately missing path that resolves to `NOT_FOUND`).
