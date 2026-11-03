# Asset Preloading (AssetLoad)

Use `AssetLoad` to pre-load assets into memory ahead of time so they display instantly when needed. `PBAssetLoad` has a single field: `assets: string[]` — the list of asset paths to load. Commonly created on `engine.RootEntity`, but any entity works.

```typescript
import {
	engine,
	AssetLoad,
	assetLoadLoadingStateSystem,
	LoadingState,
} from '@dcl/sdk/ecs'

// Queue assets to pre-load (any entity works — commonly a dedicated cube/root).
// AssetLoad.getOrCreateMutable lets you also PUSH more paths later:
//   AssetLoad.getOrCreateMutable(entity, { assets: [...] }).assets.push(morePath)
AssetLoad.create(entity, { assets: ['assets/Models/big.glb', 'assets/Sounds/win.mp3'] })

// React to loading state. The callback fires PER ASSET (once per path in the
// list), receiving { asset, currentState } — NOT one batch-level event.
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

Ground truth: `88,-12-asset-load` in sdk7-test-scenes (mp3 / texture / video / glb, plus a deliberately missing path that resolves to `NOT_FOUND`).
