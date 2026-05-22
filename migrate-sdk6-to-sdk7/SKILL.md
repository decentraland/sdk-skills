---
name: migrate-sdk6-to-sdk7
description: Migrate a legacy Decentraland SDK6 scene to SDK7. Covers detecting SDK6 projects (decentraland-ecs dependency, scene.json without runtimeVersion, class-based @Component decorators, Entity.addComponent, ISystem classes), the conceptual ECS shift (entities as IDs, data-only components, mutable vs immutable access), and a full API mapping for entities, components, transforms, shapes, GLTF, materials, animations, pointer/input events, sounds, and UI. Use when the user wants to port an SDK6 scene, upgrade decentraland-ecs to @dcl/sdk, or rewrite class-based scene code in the ECS style. Do NOT use for new scenes (see create-scene) or for SDK7-to-SDK7 refactors.
---

# Migrate a Decentraland SDK6 Scene to SDK7

> **This is a porting skill, not a scaffolding skill.** It assumes an existing SDK6 project on disk. For a brand-new SDK7 scene, use [[create-scene]].

## RULE: Verify it really is SDK6 before doing anything

Inspect these files in this order. **ALL of the SDK6 signals must be present** before treating the project as SDK6 — partial matches usually mean a half-migrated project that needs a different approach.

| Check                       | SDK6 signal                                                                                                                                    | SDK7 signal                                                                                                                                |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `package.json` dependencies | `decentraland-ecs`                                                                                                                             | `@dcl/sdk`                                                                                                                                 |
| `package.json` scripts      | `build-ecs`, `dcl start`                                                                                                                       | `sdk-commands start`, `sdk-commands build`                                                                                                 |
| `scene.json`                | No `runtimeVersion`, or `ecs7` missing                                                                                                         | `"runtimeVersion": "7"` and/or `"ecs7": true`                                                                                              |
| Source code imports         | No explicit `@dcl/sdk/ecs` import — symbols (`Entity`, `Transform`, `Vector3`, `engine`) are globals                                           | Most things imported from `@dcl/sdk/ecs` and `@dcl/sdk/math`                                                                               |
| Source code patterns        | `new Entity()`, `entity.addComponent(...)`, `@Component('name')`, `class X implements ISystem`, `OnPointerDown`, `GLTFShape`, `Input.instance` | `engine.addEntity()`, `Transform.create(entity, ...)`, `engine.defineComponent(...)`, `pointerEventsSystem.onPointerDown`, `GltfContainer` |

## RULE: Do NOT change `scene.json`'s `main` field

The `main` field stays at `"bin/game.js"` (or whatever the SDK6 project had — typically `bin/game.js`). The SDK7 default for new scenes is `bin/index.js`, but **changing the existing value will break the build output path that other tooling expects**. Always use `bin/index.js` unless the user explicitly requests it.

You SHOULD add `"runtimeVersion": "7"` to `scene.json` (and remove anything ECS6-specific). See [[create-scene]] for the full scene.json schema.

## RULE: The composite-first rule applies to migrations too

After migration, all static scenery (models, lights, primitives, text placed at scene load) belongs in `assets/scene/main.composite`, NOT in TypeScript. SDK6 scenes have no composite — every entity is created in code. **Migrating those into a composite is a separate, optional pass**; the _minimum-viable_ migration leaves them as `engine.addEntity()` in TypeScript so the scene runs first.

Order of operations:

1. Get the SDK7 TypeScript port running (entities still created in code).
2. THEN, optionally, move static entities into `assets/scene/main.composite`. See [[create-scene]] for the composite-first rule and [[composites]] for the format.

## The Conceptual Shift — read this before writing any code

SDK6 modeled entities as **objects with components attached to them**. SDK7 is a true ECS where entities are just opaque IDs and components are pure data.

| Concept                             | SDK6                                                                                             | SDK7                                                                                                                                                |
| ----------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entity creation                     | `const e = new Entity()` then `engine.addEntity(e)`                                              | `const e = engine.addEntity()` (returns the ID)                                                                                                     |
| Entity type                         | `IEntity` / `Entity` class with methods (`addComponent`, `getComponent`, `setParent`, `alive`)   | `Entity` = opaque integer ID, NO methods                                                                                                            |
| Adding a component                  | `entity.addComponent(new Transform({...}))` — entry point is the entity                          | `Transform.create(entity, {...})` — entry point is the component type                                                                               |
| Defining a component                | `@Component('name') class GemData { val: number; constructor(...) {...} }`                       | `export const GemData = engine.defineComponent('gemData', { val: Schemas.Number }, { val: 2 })` — schema + defaults, NO methods                     |
| Component methods (`reset()`, etc.) | Allowed (class methods)                                                                          | Forbidden — components are data only. Move methods into free functions or systems                                                                   |
| Reading component data              | `entity.getComponent(GemData).val` (always mutable)                                              | `GemData.get(entity).val` (immutable, fast) OR `GemData.getMutable(entity).val = X` (only when writing)                                             |
| Modifying component data            | Mutate the returned reference                                                                    | MUST use `getMutable()` — `.get()` returns a read-only reference. Using `.get()` and mutating it silently fails                                     |
| Parenting                           | `child.setParent(parent)`                                                                        | Set `parent` field of child's Transform: `Transform.create(child, { parent: parentEntity })` or `Transform.getMutable(child).parent = parentEntity` |
| Defining a system                   | `class MoveGems implements ISystem { update(dt) {...} }` then `engine.addSystem(new MoveGems())` | `export function moveGemsSystem(dt: number) { ... }` then `engine.addSystem(moveGemsSystem)`                                                        |
| Querying entities                   | `const group = engine.getComponentGroup(Transform, GemData)` then `group.entities`               | `for (const [entity, gemData, transform] of engine.getEntitiesWith(GemData, Transform)) { ... }`                                                    |
| Removing an entity                  | `engine.removeEntity(entity)`                                                                    | `engine.removeEntity(entity)` (same API)                                                                                                            |
| Event callbacks on components       | `entity.addComponent(new OnPointerDown((e) => {...}))`                                           | `pointerEventsSystem.onPointerDown({entity, opts}, () => {...})` — separated from the component                                                     |
| Static "scene-level" objects        | `Camera.instance`, `Input.instance` (singletons)                                                 | `engine.PlayerEntity`, `engine.CameraEntity`, `engine.RootEntity` + component reads (`Transform.get(engine.PlayerEntity)`)                          |

**Mutability is a performance contract**, not just style. Always prefer `.get()` (read) over `.getMutable()` (write). Using `.getMutable()` when you only read causes a CRDT delta to be sent every frame.

## API Mapping — quick reference

See `{baseDir}/references/api-mapping.md` for the full table. The most common conversions:

| SDK6                                                                                | SDK7                                                                                                                                                                                             |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `import { ... } from 'decentraland-ecs'` (often implicit)                           | `import { engine, Transform, GltfContainer, Vector3, Quaternion, Color4 } from '@dcl/sdk/ecs'` + `'@dcl/sdk/math'`                                                                               |
| `new Entity()` + `engine.addEntity(entity)`                                         | `const entity = engine.addEntity()`                                                                                                                                                              |
| `entity.addComponent(new Transform({position, rotation, scale}))`                   | `Transform.create(entity, { position, rotation, scale })`                                                                                                                                        |
| `entity.getComponent(Transform)` (read/write)                                       | `Transform.get(entity)` (read) / `Transform.getMutable(entity)` (write)                                                                                                                          |
| `entity.getComponentOrCreate(Transform)`                                            | `Transform.getOrCreateMutable(entity)`                                                                                                                                                           |
| `entity.addComponentOrReplace(...)`                                                 | `Component.createOrReplace(entity, {...})`                                                                                                                                                       |
| `entity.hasComponent(Transform)`                                                    | `Transform.has(entity)`                                                                                                                                                                          |
| `entity.removeComponent(Transform)`                                                 | `Transform.deleteFrom(entity)`                                                                                                                                                                   |
| `child.setParent(parent)`                                                           | `Transform.getMutable(child).parent = parent` (or pass `parent` in `create`)                                                                                                                     |
| `new GLTFShape('models/x.glb')` + `entity.addComponent(shape)`                      | `GltfContainer.create(entity, { src: 'models/x.glb' })`                                                                                                                                          |
| `new BoxShape()` / `new PlaneShape()` / `new SphereShape()` / `new CylinderShape()` | `MeshRenderer.setBox(entity)` / `setPlane(entity)` / `setSphere(entity)` / `setCylinder(entity)` (add `MeshCollider.setBox(entity)` etc. for collision)                                          |
| `new Material()` + `m.albedoColor = Color3.Blue()` + `entity.addComponent(m)`       | `Material.setPbrMaterial(entity, { albedoColor: Color4.Blue() })` (note: Color4 in SDK7)                                                                                                         |
| `new BasicMaterial()` + `m.texture = new Texture(...)`                              | `Material.setBasicMaterial(entity, { texture: Material.Texture.Common({ src }) })`                                                                                                               |
| `new TextShape(text)` + `t.fontSize = 1`                                            | `TextShape.create(entity, { text, fontSize: 1 })`                                                                                                                                                |
| `new Animator()` + `new AnimationState('Clip')` + `animator.addClip(state)`         | `Animator.create(entity, { states: [{ clip: 'Clip', playing: false, loop: false }] })`; play with `Animator.playSingleAnimation(entity, 'Clip')`; stop with `Animator.stopAllAnimations(entity)` |
| `new OnPointerDown(handler, { button, hoverText })` on the entity                   | `pointerEventsSystem.onPointerDown({ entity, opts: { button: InputAction.IA_POINTER, hoverText } }, handler)`                                                                                    |
| `Input.instance.subscribe('BUTTON_DOWN', ActionButton.POINTER, false, handler)`     | `inputSystem.isTriggered(InputAction.IA_POINTER, PointerEventType.PET_DOWN)` inside a system, or `pointerEventsSystem.onPointerDown` for entity-specific                                         |
| `ActionButton.POINTER` / `.PRIMARY` / `.SECONDARY`                                  | `InputAction.IA_POINTER` / `.IA_PRIMARY` / `.IA_SECONDARY`                                                                                                                                       |
| `Camera.instance.position` / `.rotation`                                            | `Transform.get(engine.CameraEntity).position` / `.rotation`                                                                                                                                      |
| `new Vector3(x, y, z)`                                                              | `Vector3.create(x, y, z)`                                                                                                                                                                        |
| `Quaternion.Euler(x, y, z)`                                                         | `Quaternion.fromEulerDegrees(x, y, z)`                                                                                                                                                           |
| `Color3.Blue()`                                                                     | `Color4.Blue()` (most SDK7 component fields use Color4)                                                                                                                                          |
| `Vector3.Lerp(a, b, t)`                                                             | `Vector3.lerp(a, b, t)` (lowercase l)                                                                                                                                                            |
| `Scalar.Lerp(a, b, t)`                                                              | `Scalar.lerp(a, b, t)`                                                                                                                                                                           |
| `vector.setAll(0.5)`                                                                | `Vector3.create(0.5, 0.5, 0.5)` (no mutating helper — Vector3 is treated as plain data)                                                                                                          |
| `class X implements ISystem { update(dt) {...} }` + `engine.addSystem(new X())`     | `function xSystem(dt: number) { ... }` + `engine.addSystem(xSystem)`                                                                                                                             |
| `engine.getComponentGroup(A, B)` returning `.entities`                              | `engine.getEntitiesWith(A, B)` returning iterable of `[entity, a, b]` tuples                                                                                                                     |
| `log(...)`                                                                          | `console.log(...)`                                                                                                                                                                               |
| `entity.addComponent(new utils.Delay(ms, cb))` (from `decentraland-ecs-utils` / `@dcl-sdk/utils`) | `setTimeout(cb, ms)` (global — no import, argument order is `(callback, ms)`)                                                                                                          |
| `entity.addComponent(new utils.Interval(ms, cb))`                                   | `setInterval(cb, ms)` (global — no import)                                                                                                                                                       |
| Custom per-frame `timerSystem` accumulating `dt`                                    | Delete it — use the global `setTimeout` / `setInterval` instead                                                                                                                                  |

## Migration Workflow

Do this in order. Skipping steps leads to a broken scene that's hard to debug.

### 1. Audit the SDK6 project

Read every source file. Build a list of:

- Every custom `@Component` class — these become `engine.defineComponent(...)` with a flat schema. Class methods (`reset()`, etc.) must be lifted out into free functions or systems.
- Every `class X implements ISystem` — these become free functions `(dt: number) => void`.
- Every `OnPointerDown` / `OnPointerUp` / `Input.instance.subscribe` — these become `pointerEventsSystem` calls or `inputSystem.isTriggered()` in a system.
- Every `GLTFShape`, `BoxShape`, etc. — see mapping table.
- Every `Camera.instance`, `Input.instance` — these become static engine entities + component reads.
- All `setParent` calls — these become `Transform.parent` field assignments.

### 2. Replace `package.json`, `tsconfig.json`, and update `scene.json`

- Replace `decentraland-ecs` with `@dcl/sdk` (latest).
- Replace `build-ecs` / `dcl start` scripts with `sdk-commands start` / `sdk-commands build`.
- Replace the old `tsconfig.json` with the standard SDK7 one (`target: ES2020`, `module: ESNext`, `jsx: react-jsx`, `strict: true`).
- Add `"runtimeVersion": "7"` to `scene.json`. **Do NOT modify `main`** unless the user asks.

### 3. Reorganize asset folders under `assets/`

SDK6 scenes commonly kept assets in **top-level folders at the project root**: `models/`, `images/`, `audio/` (or `sounds/`), `textures/`, `videos/`. SDK7 + Creator Hub expects assets under a top-level **`assets/`** folder so the visual editor can index them. Do this move as a discrete step BEFORE porting any code — that way the path rewrites in later steps can target the final locations directly.

1. **Identify** every top-level asset folder in the SDK6 project. Common SDK6 names: `models/`, `images/`, `audio/`, `sounds/`, `textures/`, `videos/`.
2. **Create** the new structure under `assets/` using the **capitalized category** convention used elsewhere in these skills (see [[create-scene]], [[add-3d-models]], [[audio-video]]):
   - `models/` → `assets/Models/`
   - `images/` → `assets/Images/`
   - `audio/` or `sounds/` → `assets/Audio/`
   - `videos/` → `assets/Videos/`
   - `textures/` → `assets/Images/` (textures are images; consolidate unless the user wants a separate folder)
3. **Move** files into the new structure. Do NOT leave duplicate copies — delete the old top-level folders once the move is complete. Dual copies cause Creator Hub to index stale paths and inflate scene size on deploy.
4. **Rewrite every code reference** to the moved paths. Grep the entire source tree for the old folder names and update each hit:
   - `GltfContainer.create(e, { src: 'models/chair.glb' })` → `... { src: 'assets/Models/chair.glb' }`
   - `AudioSource.create(e, { audioClipUrl: 'sounds/click.mp3' })` → `... 'assets/Audio/click.mp3'`
   - `Material.Texture.Common({ src: 'textures/logo.png' })` → `... 'assets/Images/logo.png'`
   - React-ECS `<UiEntity uiBackground={{ texture: { src: 'images/icon.png' } }} />` → `... 'assets/Images/icon.png'`
   - Any string literal mentioning the old folder name anywhere in code, JSON, or `.composite` files.
5. **Verify** by grepping the project for the old folder names — there should be zero remaining references. Then check Creator Hub: open the scene, the asset tree should populate from `assets/`.

**Exception — reuse existing layout if present.** If the project already contains `assets/scene/Models/` (the legacy Creator Hub layout) or `assets/asset-packs/` / `assets/custom/` (Creator Hub adds these when the user imports assets through the UI), reuse those paths instead of creating a parallel `assets/Models/`. The rule is: one canonical location per asset type — don't fragment.

### 4. Create `src/index.ts` with an exported `main()`

SDK7 scenes start from a top-level exported `main()` function. The convention is to put most code in another file (e.g. `src/game.ts`) and have `index.ts` just call into it:

```typescript
import { initializeGame } from "./game";
export function main() {
  initializeGame();
}
```

### 5. Port components first

Convert each `@Component` class to `engine.defineComponent(name, schema, defaults)`. **Flatten nested types** — `Schemas` does not support arbitrary classes, but does support `Schemas.Vector3`, `Schemas.Quaternion`, primitives, arrays, and nested `Schemas.Map(...)`. A `Vector2` field in SDK6 typically becomes two scalar fields (`posX`, `posY`) in SDK7 — see the 2048 example in `{baseDir}/references/migration-example.md`.

### 6. Port systems

Each `class X implements ISystem { update(dt) {...} }` becomes a free function. Replace `engine.getComponentGroup(A, B).entities` iteration with `for (const [entity, a, b] of engine.getEntitiesWith(A, B))`. Inside the loop, use `.getMutable(entity)` only when writing.

### 7. Port the entity/component setup (the bulk of `game.ts`)

For each `new Entity()` block, replace with `engine.addEntity()` and a series of `Component.create(entity, ...)` calls. Convert `setParent` to a `parent` field on the Transform. Use the new `assets/Models/...`, `assets/Audio/...`, `assets/Images/...` paths established in step 3 for every `src` / `audioClipUrl` / `texture.src`.

### 8. Port input/pointer handlers

- Per-entity click handlers (`new OnPointerDown(...)`) → `pointerEventsSystem.onPointerDown({ entity, opts }, handler)`. Add a collider if the entity doesn't already have one (`MeshCollider.setBox(entity)` or `visibleMeshesCollisionMask: 1` on `GltfContainer`). See [[add-interactivity]].
- Global key subscriptions (`Input.instance.subscribe`) → use `inputSystem.isTriggered(InputAction.IA_X, PointerEventType.PET_DOWN)` inside a system. See [[advanced-input]].

### 9. Port animations

`new Animator()` + `new AnimationState('clip')` + `animator.addClip(...)` becomes a single `Animator.create(entity, { states: [{ clip, playing, loop }] })`. Play with `Animator.playSingleAnimation(entity, 'clip')`. Stop all with `Animator.stopAllAnimations(entity)`. See [[animations-tweens]].

### 10. Port sounds

`new AudioClip(url)` + `entity.addComponent(new AudioSource(clip))` becomes `AudioSource.create(entity, { audioClipUrl: url, playing: false, ... })`. Play by toggling `AudioSource.getMutable(entity).playing = true`. See [[audio-video]].

### 11. Verify and test

- Run `npm install` to fetch the new SDK.
- Run `sdk-commands start` (or `npm start`) and check the in-world result.
- Compare positions/rotations against the SDK6 scene — the visible layout must match.

## Common Pitfalls

- **Mutating a `.get()` result**: `Transform.get(entity).position.x = 5` is silently a no-op. Use `Transform.getMutable(entity).position.x = 5`.
- **Forgetting the schema**: `engine.defineComponent` REQUIRES a schema. SDK6 class fields with no type cannot be auto-inferred.
- **Component methods**: SDK6 components frequently had a `reset()` or constructor logic. These MUST be moved to free functions in SDK7 — components are pure data.
- **Vector2 fields**: `Schemas` does NOT have `Schemas.Vector2`. [UNVERIFIED — confirm by reading the Schemas object exports.] Flatten to two `Schemas.Number` fields, or use `Schemas.Map({ x: Schemas.Number, y: Schemas.Number })`.
- **`setParent` on the entity object**: Entities are integers in SDK7 — there is no method. Set the `parent` field on the child's `Transform`.
- **Color3 vs Color4**: Most SDK7 component fields take `Color4` (with alpha). Replace `Color3.X()` calls with `Color4.X()` unless the field is documented as Color3.
- **Materials are not entities or objects**: There is no `new Material()` instance you keep a reference to. `Material.setPbrMaterial(entity, props)` is the only way to set it — a material lives on one entity, not as a shared object.
- **Shape entities (BoxShape, PlaneShape, etc.) need MeshRenderer AND MeshCollider**: In SDK6 a single `BoxShape` did both render and collide (with a flag). In SDK7 these are two separate components — add both if you need clicks/physics on a primitive.
- **GLTFShape had its visible mesh clickable by default with `withCollisions: true`**: In SDK7, `GltfContainer` by default only has collisions on the invisible \_collider mesh. Some models may not be ready for that. If an entity is no longer clickable from a lack of collider, it may need explicit `visibleMeshesCollisionMask` set to a value including `CL_POINTER` (1) for clicks, or `CL_PHYSICS` (2) for player collision, or `3` for both. See [[add-3d-models]].
- **`OnPointerDown` callbacks no longer fire inside a `forEach` over a component group**: In SDK6 they were event-driven; in SDK7 you register the handler once with `pointerEventsSystem.onPointerDown(...)` — don't put that call inside a system's update loop or you'll register a new handler every frame.
- **`Input.instance.subscribe` with `BUTTON_DOWN` / `BUTTON_UP`**: there is no direct callback equivalent. Use `inputSystem.isTriggered()` inside a system for "just pressed this frame".
- **`@dcl/ecs-scene-utils` trigger areas (the "Utils library") AND hand-rolled per-frame AABB checks**: do NOT port the custom per-frame position-checking system, and do NOT recreate it from scratch in SDK7. SDK6 had no native trigger area, so the community Utils library (and many scenes' bespoke code) polled `Camera.instance.position` against a box/sphere region every frame and fired `onCameraEnter` / `onCameraExit`. SDK7 has a **native** `TriggerArea` component (`@dcl/sdk/ecs`) — replace the entire pattern with `TriggerArea.setBox(entity)` (or `.setSphere`) + `triggerAreaEventsSystem.onTriggerEnter(entity, cb)` / `.onTriggerExit` / `.onTriggerStay`. Size comes from `Transform.scale`, position from `Transform.position`, and the parent chain is respected — so triggers parented to a rotated/offset scene root Just Work without manual coordinate transforms. **Behavior parity**: the Utils library only ever fired for the local player; native `TriggerArea` defaults to `ColliderLayer.CL_PLAYER`, which fires for ANY player on that layer. The correct guard for local-player-only behavior is `if (result.trigger?.entity !== engine.PlayerEntity) return` (NOT `result.triggeredEntity` — despite the confusing name, `triggeredEntity` is the trigger area's own entity, so comparing it to the player is always true and the guard never fires). See the "Trigger areas" section of `{baseDir}/references/api-mapping.md` and [[add-interactivity]] for the full component reference.
- **`utils.Delay` / `utils.ExpireIn` from `decentraland-ecs-utils` (later `@dcl-sdk/utils`) AND hand-rolled per-frame timer systems**: do NOT port the community `Delay` component, do NOT recreate it in SDK7, and do NOT write a custom `setSceneTimeout` helper backed by a `timerSystem` that accumulates `dt`. The SDK7 QuickJS runtime exposes the **JavaScript-standard `setTimeout`, `clearTimeout`, `setInterval`, `clearInterval` as globals** (declared in `@dcl/js-runtime/index.d.ts` — no import needed). Replace `entity.addComponent(new utils.Delay(2000, cb))` with `setTimeout(cb, 2000)` and delete the "timer entity" the SDK6 scene created just to host the Delay component. **Argument order is `(callback, ms)`**, NOT `(ms, callback)` — the SDK6 `Delay(ms, cb)` order is the opposite of the JS standard, and custom helpers written with the SDK6 order are a known footgun that compounds the original mistake of writing the helper in the first place. The `timers` named export from `@dcl/sdk/ecs` (`import { timers } from '@dcl/sdk/ecs'`) is also available and functionally equivalent — prefer the globals for brevity. See [[scene-runtime]] (Timers section) for the full reference.
- **SDK6 "intercepting tool" smart-items** (keys, magnets, inventory items that act on a clicked target via `Input.instance.subscribe('BUTTON_DOWN', ActionButton.POINTER, true, …)` + entity-hierarchy walking) have no direct SDK7 equivalent. `pointerEventsSystem.onPointerDown` is per-entity only — there is no global hit-result subscriber. The migration pattern is a small registry keyed by target entity name; the target's own `pointerEventsSystem.onPointerDown` consults the registry before falling back to its default behavior. See `{baseDir}/references/api-mapping.md#click-interception-across-entities-keytool-acting-on-a-target`.
- **Don't change `scene.json` `main` field**: leave it at whatever path the SDK6 project used (typically `bin/game.js`).
- **Top-level asset folders (`models/`, `images/`, `audio/`, `sounds/`, `textures/`, `videos/`) must be moved under `assets/`**: SDK6 scenes typically place assets at the project root. SDK7 + Creator Hub expects them under a top-level `assets/` folder (the visual editor only indexes that directory). The migration agent must (1) create `assets/Models/`, `assets/Images/`, `assets/Audio/`, `assets/Videos/` (capitalized — matches the convention used in [[create-scene]], [[add-3d-models]], [[audio-video]]); (2) move each source file across; (3) grep the entire codebase for the **old** folder names and update every `GltfContainer.create({src: 'models/...'})`, `AudioSource.create({audioClipUrl: 'sounds/...'})`, `Material.Texture.Common({src: 'textures/...'})`, React-ECS `uiBackground.texture.src`, and any path string in `.composite` files; (4) delete the empty old folders — do NOT leave dual copies (deploy will bundle both, doubling scene size, and Creator Hub will index stale paths). If the scene already has `assets/scene/Models/` or `assets/asset-packs/` (Creator Hub legacy / asset-pack layouts), reuse those paths instead of creating a parallel `assets/Models/`. This is step 3 of the migration workflow above — do the reorganization before porting code so path rewrites land in one pass.
- **The compiled `bin/` output**: SDK6 produced `bin/game.js` via `build-ecs`. SDK7 produces `bin/index.js` by default with `sdk-commands build`. If `scene.json` says `bin/game.js`, you must either change the SDK7 build output path or update the `main` field — and per the rule above, the user should confirm before changing `main`. [UNVERIFIED behavior — confirm with the user how their toolchain is set up before making this change.]
- **`Vector3.GetAngleBetweenVectors`, `Vector3.Up()` etc.**: many SDK6 Vector3 helpers existed as static methods. SDK7 keeps most under `@dcl/sdk/math` but capitalization changed (e.g. `Vector3.Lerp` → `Vector3.lerp`). Grep for `Vector3.` after migration and verify each call against the math module.
- **`log()` is not exported in SDK7**: replace with `console.log()`.
- **`Attachable.FIRST_PERSON_CAMERA` / `Attachable.AVATAR` on held items (guns, aiming reticles, flashlights, fixed-position tools)**: SDK6 only offered two coarse follow modes — `Attachable.FIRST_PERSON_CAMERA` (follow the camera) and `Attachable.AVATAR` (follow the avatar root). In SDK7 you have a new choice that didn't exist before: bone-level `AvatarAttach` with `anchorPointId` (e.g. `AAPT_RIGHT_HAND`). The bone anchor **looks** like the natural SDK7 equivalent of "put it in the avatar's hand", but bone anchors inherit avatar animation (idle bob, walk cycle, gestures) — a gun attached to `AAPT_RIGHT_HAND` jitters every frame and is unaimable. The correct SDK7 mapping for held gameplay items is to **parent the entity** via `Transform.parent`, not `AvatarAttach`. **For any aim-sensitive item (gun, reticle, flashlight, anything the player should be able to point by looking around), the right SDK7 default is `Transform.parent = engine.CameraEntity`** — this mirrors SDK6's `FIRST_PERSON_CAMERA` and tracks both yaw AND pitch, so the muzzle aims where the camera looks. `Transform.parent = engine.PlayerEntity` is a different choice and a common subtle failure mode: it follows the player root (feet position + body **yaw only**, no pitch and no animation), so a gun parented to `PlayerEntity` stays flat when the player tilts the camera up to aim — the item ignores the look direction. Use `PlayerEntity` only for body-fixed items that should NOT track aim (a held shield, a static torch, a non-aimed inventory item carried at hip-level). Reserve `AvatarAttach` for **cosmetic** items where riding the animation is desired (hats, halos, backpacks, name plates). Picking by intent — `engine.CameraEntity` (aim-sensitive, the recommended default for held weapons), `engine.PlayerEntity` (yaw-only / no pitch, for body-fixed items), `AvatarAttach(boneId)` (cosmetic only, animates with the bone). See the "Held items vs cosmetic items" section of [[player-avatar]] for the comparison table and a worked gun example.
- **Billboarded models may appear facing AWAY from the camera after porting**: observed in some SDK6 → SDK7 ports — a model that displayed its front face under SDK6's `new Billboard(false, true, false)` (Y-axis billboard) shows its **back** to the camera under SDK7's `Billboard.create(e, { billboardMode: BillboardMode.BM_Y })` with the same parent/child setup. The two SDKs appear to disagree on which model face (+Z vs -Z) the billboard points at the camera. **The SDK7 `PBBillboard` interface has no `oppositeDirection` flag** — the only field is `billboardMode` (verified against `@dcl/ecs` `billboard.gen.d.ts`), so the fix is in the model's Transform, not the Billboard component. **Rotate the displayed model 180° on Y** (`Quaternion.fromEulerDegrees(0, 180, 0)`). If the entity is a parent (`Billboard`'d) + a child model, apply the 180° rotation to the **child**'s `Transform.rotation` — the parent entity's rotation is owned by the Billboard component and overwriting it on the billboarded entity has no effect. [UNVERIFIED whether this was an explicit SDK behavior change with a changelog entry, or a consequence of a separate convention change in the model importer — phrase any user-facing explanation as "the two SDKs disagree on billboard facing direction" rather than claiming a specific version introduced it.] See [[advanced-rendering]] (Billboard) for the SDK7 component reference.
- **UI pixel sizes do NOT carry over 1:1**: SDK6 UI (`UICanvas` / `UIImage` / `UIText`) was authored in raw pixels against a fixed screen size, so positions and sizes like `width = 200` or `positionX = -350` were absolute. SDK7 React-ECS UI lays out in raw screen pixels by default, but the **actual screen size depends on the user's machine** — so an SDK6 layout copied over verbatim will appear at a different relative size on every display. The fix is to set a virtual canvas on `ReactEcsRenderer.setUiRenderer`, which makes the engine treat your pixel values as coordinates inside that virtual space and scale to the real screen. Before porting UI, check the SDK6 source (the legacy ECS lives at https://github.com/decentraland/ecs) to see what pixel grid the original UI was designed against, and pass that as the virtual size:
  ```ts
  ReactEcsRenderer.setUiRenderer(uiRoot, { virtualWidth: 1920, virtualHeight: 1080 })
  ```
  `1920x1080` is a reasonable default to show, but the correct virtualWidth/virtualHeight depends on the resolution the SDK6 UI was authored against — if the SDK6 scene assumed a different reference resolution (e.g. `1280x720`), use those numbers instead so existing pixel coordinates land in the same place. See [[build-ui]] for the full React-ECS rewrite.

## What is genuinely hard to migrate

These don't have a clean 1:1 mapping and need redesign:

- **Components with methods or constructors that do work** (e.g. `GemData.reset(val, x, y)`): split the data into the new component, move the logic into a free function that takes `(entity: Entity, val: number, ...)` and calls `Component.getMutable(entity)`.
- **Component groups that the user holds a reference to and iterates many times**: SDK7 `engine.getEntitiesWith(...)` is recomputed each call. For hot loops over the same set, cache it inside the system or accept the cost.
- **Object pools that rely on `entity.alive`**: SDK7 entities don't have an `alive` flag. Pools must track liveness with a custom component or by checking `Component.has(entity)`. The Migrated-2048 example simplified this to "always add a new entity" — that's acceptable for low-throughput cases, but a real pool needs explicit state.
- **UI built with the SDK6 `UICanvas` / `UIImage` / `UIText` / `UIClickable`**: not API-compatible with SDK7. SDK7 UI is React-ECS (JSX). See [[build-ui]] — this often requires a from-scratch rewrite. When porting, also set a virtual canvas size on `ReactEcsRenderer.setUiRenderer` so the SDK6 pixel coordinates scale predictably across screens — see the UI pixel sizing pitfall in **Common Pitfalls** above.
- **`@Component('name')` decorator metadata**: SDK7 component IDs are strings supplied to `engine.defineComponent('name', ...)`. Use the **same name** as the SDK6 decorator if other tools (composites, multiplayer sync) reference it by name. Otherwise pick a consistent naming scheme.

## Cross-References

- [[create-scene]] — scene.json schema, composite-first rule, scaffolding a fresh SDK7 project
- [[composites]] — `.composite` file format for the optional second pass that moves static entities out of TypeScript
- [[add-3d-models]] — `GltfContainer`, collider masks for clickability
- [[add-interactivity]] — `pointerEventsSystem` (replaces SDK6 `OnPointerDown`)
- [[advanced-input]] — `inputSystem` polling (replaces SDK6 `Input.instance.subscribe`)
- [[scene-runtime]] — global `setTimeout` / `setInterval` (replaces SDK6 community `decentraland-ecs-utils` `Delay` / `Interval`), `executeTask`, `fetch`, realm/scene info
- [[animations-tweens]] — `Animator` and `Tween` (replaces SDK6 `Animator`/`AnimationState`)
- [[audio-video]] — `AudioSource` and `VideoPlayer`
- [[build-ui]] — React-ECS UI (replaces SDK6 `UICanvas` UI system)
- [[advanced-rendering]] — PBR materials, TextShape, Billboard
- [[multiplayer-sync]] — `syncEntity` for multiplayer (replaces SDK6 `MessageBus` / sync libraries)

## References

- `{baseDir}/references/api-mapping.md` — full table of SDK6 → SDK7 symbol conversions
- `{baseDir}/references/migration-example.md` — annotated before/after using the 2048 game scene (entity setup, components, systems, pointer events, animations)
