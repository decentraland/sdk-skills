---
name: migrate-sdk6-to-sdk7
description: Migrate a legacy Decentraland SDK6 scene to SDK7. Use when the user wants to port an SDK6 scene, upgrade the decentraland-ecs dependency to @dcl/sdk, or rewrite class-based scene code in the ECS style. Do NOT use for new scenes (see create-scene) or for SDK7-to-SDK7 refactors.
---

# Migrate a Decentraland SDK6 Scene to SDK7

## RULE: Verify it really is SDK6 before doing anything

Inspect these files in this order. **ALL of the SDK6 signals must be present** before treating the project as SDK6 — partial matches usually mean a half-migrated project that needs a different approach.

| Check                       | SDK6 signal                                                                                                                                    | SDK7 signal                                                                                                                                |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `package.json` dependencies | `decentraland-ecs`                                                                                                                             | `@dcl/sdk`                                                                                                                                 |
| `package.json` scripts      | `build-ecs`, `dcl start`                                                                                                                       | `sdk-commands start`, `sdk-commands build`                                                                                                 |
| `scene.json`                | No `runtimeVersion`, or `ecs7` missing                                                                                                         | `"runtimeVersion": "7"` and/or `"ecs7": true`                                                                                              |
| Source code imports         | No explicit `@dcl/sdk/ecs` import — symbols (`Entity`, `Transform`, `Vector3`, `engine`) are globals                                           | Most things imported from `@dcl/sdk/ecs` and `@dcl/sdk/math`                                                                               |
| Source code patterns        | `new Entity()`, `entity.addComponent(...)`, `@Component('name')`, `class X implements ISystem`, `OnPointerDown`, `GLTFShape`, `Input.instance` | `engine.addEntity()`, `Transform.create(entity, ...)`, `engine.defineComponent(...)`, `pointerEventsSystem.onPointerDown`, `GltfContainer` |

## RULE: Keep `scene.json`'s `main` field as it is

Keep the `main` value the SDK6 project already had (typically `"bin/game.js"`). The SDK7 default for new scenes is `bin/index.js`, but `sdk-commands build` writes the bundle to whatever path `scene.json` `main` names, so an existing `bin/game.js` keeps working. Rename it only if the user asks.

You SHOULD add `"runtimeVersion": "7"` to `scene.json` (and remove anything ECS6-specific). Full scene.json schema: `{baseDir}/../create-scene/references/scene-json.md`.

## RULE: The composite-first rule applies to migrations too

After migration, all static scenery (models, lights, primitives, text placed at scene load) belongs in `assets/scene/main.composite`, NOT in TypeScript. SDK6 scenes have no composite — every entity is created in code. **Migrating those into a composite is a separate, optional pass**; the _minimum-viable_ migration leaves them as `engine.addEntity()` in TypeScript so the scene runs first.

Order of operations:

1. Get the SDK7 TypeScript port running (entities still created in code).
2. THEN, optionally, move static entities into `assets/scene/main.composite`. Composite-first rule: **sdk-scenes** → *CRITICAL RULE — Composite-first scene authoring*; format: **composites**.

## The Conceptual Shift — read this before writing any code

SDK6 modeled entities as **objects with components attached to them**. SDK7 is a true ECS where entities are just opaque IDs and components are pure data. Symbol-level conversions are in the quick reference below.

| Concept                             | SDK6                                                                                             | SDK7                                                                                                                                                |
| ----------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entity type                         | `IEntity` / `Entity` class with methods (`addComponent`, `getComponent`, `setParent`, `alive`)   | `Entity` = opaque integer ID, NO methods                                                                                                            |
| Adding a component                  | `entity.addComponent(new Transform({...}))` — entry point is the entity                          | `Transform.create(entity, {...})` — entry point is the component type                                                                               |
| Defining a component                | `@Component('name') class GemData { val: number; constructor(...) {...} }`                       | `export const GemData = engine.defineComponent('gemData', { val: Schemas.Number }, { val: 2 })` — schema + defaults, NO methods                     |
| Component methods (`reset()`, etc.) | Allowed (class methods)                                                                          | Forbidden — components are data only. Move methods into free functions or systems                                                                   |
| Reading component data              | `entity.getComponent(GemData).val` (always mutable)                                              | `GemData.get(entity).val` (immutable, fast) OR `GemData.getMutable(entity).val = X` (only when writing)                                             |
| Modifying component data            | Mutate the returned reference                                                                    | MUST use `getMutable()` — `.get()` returns a read-only reference. Using `.get()` and mutating it silently fails                                     |
| Defining a system                   | `class MoveGems implements ISystem { update(dt) {...} }` then `engine.addSystem(new MoveGems())` | `export function moveGemsSystem(dt: number) { ... }` then `engine.addSystem(moveGemsSystem)`                                                        |
| Event callbacks on components       | `entity.addComponent(new OnPointerDown((e) => {...}))`                                           | `pointerEventsSystem.onPointerDown({entity, opts}, () => {...})` — separated from the component                                                     |

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
| `new GLTFShape('models/x.glb')` + `entity.addComponent(shape)`                      | `GltfContainer.create(entity, { src: 'assets/Models/x.glb' })`                                                                                                                                          |
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
| `entity.addComponent(new utils.Delay(ms, cb))` (from `decentraland-ecs-utils` / `@dcl-sdk/utils`) | `timers.setTimeout(cb, ms)` (`import { timers } from '@dcl/sdk/ecs'`, argument order is `(callback, ms)`)                                                                              |
| `entity.addComponent(new utils.Interval(ms, cb))`                                   | `timers.setInterval(cb, ms)` (`import { timers } from '@dcl/sdk/ecs'`)                                                                                                                           |
| Per-frame `timerSystem` accumulating `dt` to fire callbacks                                  | Delete it — use `timers.setTimeout` / `timers.setInterval` instead                                                                                                                               |

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

This list is the completion checklist for steps 5–10 — each of those steps is done only when every item in its category has been ported and its SDK6 symbols no longer appear in the source.

### 2. Replace `package.json`, `tsconfig.json`, and update `scene.json`

- Replace `decentraland-ecs` with `@dcl/sdk` (latest).
- Replace `build-ecs` / `dcl start` scripts with `sdk-commands start` / `sdk-commands build`.
- Replace the old `tsconfig.json` with the standard SDK7 one (`target: ES2020`, `module: ESNext`, `jsx: react-jsx`, `strict: true`).
- Add `"runtimeVersion": "7"` to `scene.json`. Keep `main` as it is.

**Done when:** `npm install` succeeds and `grep -n decentraland-ecs package.json` returns nothing.

### 3. Reorganize asset folders under `assets/`

SDK6 scenes commonly kept assets in **top-level folders at the project root**: `models/`, `images/`, `audio/` (or `sounds/`), `textures/`, `videos/`. SDK7 + Creator Hub expects assets under a top-level **`assets/`** folder so the visual editor can index them. Do this move as a discrete step BEFORE porting any code — that way the path rewrites in later steps can target the final locations directly.

1. **Identify** every top-level asset folder in the SDK6 project. Common SDK6 names: `models/`, `images/`, `audio/`, `sounds/`, `textures/`, `videos/`.
2. **Create** the new structure under `assets/` using the **capitalized category** convention (**add-3d-models** → Asset folder conventions):
   - `models/` → `assets/Models/`
   - `images/` → `assets/Images/`
   - `audio/` or `sounds/` → `assets/Audio/`
   - `videos/` → `assets/Videos/`
   - `textures/` → `assets/Images/` (textures are images; consolidate unless the user wants a separate folder)
3. **Move** files into the new structure, then delete the old top-level folders, so each file exists once. Dual copies cause Creator Hub to index stale paths and roughly double scene size on deploy (both copies get bundled).
4. **Rewrite every code reference** to the moved paths. Grep the entire source tree for the old folder names and update each hit:
   - `GltfContainer.create(e, { src: 'models/chair.glb' })` → `... { src: 'assets/Models/chair.glb' }`
   - `AudioSource.create(e, { audioClipUrl: 'sounds/click.mp3' })` → `... 'assets/Audio/click.mp3'`
   - `Material.Texture.Common({ src: 'textures/logo.png' })` → `... 'assets/Images/logo.png'`
   - React-ECS `<UiEntity uiBackground={{ texture: { src: 'images/icon.png' } }} />` → `... 'assets/Images/icon.png'`
   - Any string literal mentioning the old folder name anywhere in code, JSON, or `.composite` files.
5. **Done when:** grepping the project for the old folder names returns zero remaining references, and opening the scene in Creator Hub shows the asset tree populated from `assets/`.

**Exception — reuse existing layout if present.** If the project already contains `assets/scene/Models/` (the legacy Creator Hub layout) or `assets/asset-packs/` / `assets/custom/` (Creator Hub adds these for asset-pack items and custom items), reuse those paths instead of creating a parallel `assets/Models/`. The rule is: one canonical location per asset type.

### 4. Create `src/index.ts` with an exported `main()`

SDK7 scenes start from a top-level exported `main()` function. The convention is to put most code in another file (e.g. `src/game.ts`) and have `index.ts` just call into it:

```typescript
import { initializeGame } from "./game";
export function main() {
  initializeGame();
}
```

**Done when:** `src/index.ts` exports `main()`.

### 5. Port components first

Convert each `@Component` class to `engine.defineComponent(name, schema, defaults)`; every component needs a schema (untyped SDK6 class fields cannot be inferred). Move class methods and constructor logic (`reset()`, etc.) into free functions or systems: components are pure data. **Flatten nested types** — `Schemas` does not support arbitrary classes, but does support `Schemas.Vector3`, `Schemas.Quaternion`, primitives, arrays, and nested `Schemas.Map(...)`. There is no `Schemas.Vector2`: a `Vector2` field becomes two `Schemas.Number` fields (`posX`, `posY`) or `Schemas.Map({ x: Schemas.Number, y: Schemas.Number })` — see the 2048 example in `{baseDir}/references/migration-example.md`.

**Done when:** `grep -rn "@Component(" src/` returns zero hits and every component on the step-1 audit list has a corresponding `engine.defineComponent` call.

### 6. Port systems

Each `class X implements ISystem { update(dt) {...} }` becomes a free function. Replace `engine.getComponentGroup(A, B).entities` iteration with `for (const [entity, a, b] of engine.getEntitiesWith(A, B))`. Inside the loop, use `.getMutable(entity)` only when writing.

**Done when:** `grep -rnE "implements ISystem|getComponentGroup" src/` returns zero hits and every system on the step-1 audit list is registered via `engine.addSystem`.

### 7. Port the entity/component setup (the bulk of `game.ts`)

For each `new Entity()` block, replace with `engine.addEntity()` and a series of `Component.create(entity, ...)` calls. Convert `setParent` to a `parent` field on the Transform. Primitives need `MeshRenderer` **and** `MeshCollider` for clicks or physics (an SDK6 `BoxShape` did both). Materials live on one entity each: `Material.setPbrMaterial(entity, props)`, no shared instance. Most color fields take `Color4`. Use the new `assets/Models/...`, `assets/Audio/...`, `assets/Images/...` paths established in step 3 for every `src` / `audioClipUrl` / `texture.src`.

**Done when:** `grep -rnE "new Entity\(|\.addComponent\(|\.setParent\(" src/` returns zero hits, and no `src` / `audioClipUrl` / texture path still references a pre-step-3 folder.

### 8. Port input/pointer handlers

- Per-entity click handlers (`new OnPointerDown(...)`) → `pointerEventsSystem.onPointerDown({ entity, opts }, handler)`, registered once at setup (inside a system it re-registers every frame). Add a collider if the entity doesn't already have one (`MeshCollider.setBox(entity)` or `visibleMeshesCollisionMask: 1` on `GltfContainer`: SDK7 GLBs collide only on their `_collider` meshes by default). See **add-interactivity**.
- Global key subscriptions (`Input.instance.subscribe`, including `BUTTON_DOWN` / `BUTTON_UP`) → `inputSystem.isTriggered(InputAction.IA_X, PointerEventType.PET_DOWN)` inside a system. See **advanced-input**.
- SDK6 "intercepting tool" items (a key or magnet acting on whatever is clicked) have no global hit subscriber in SDK7: `{baseDir}/references/api-mapping.md` → Click interception across entities.

**Done when:** `grep -rnE "OnPointerDown|OnPointerUp|Input\.instance|ActionButton\." src/` returns zero hits and every handler on the step-1 audit list has a `pointerEventsSystem` or `inputSystem` counterpart.

### 9. Port animations

`new Animator()` + `new AnimationState('clip')` + `animator.addClip(...)` becomes a single `Animator.create(entity, { states: [{ clip, playing, loop }] })`. Play with `Animator.playSingleAnimation(entity, 'clip')`. Stop all with `Animator.stopAllAnimations(entity)`. SDK6's `getClip(name)` created clips on first use; in SDK7 `playSingleAnimation` silently ignores a clip missing from `states[]`. A model with clips and no `Animator` autoplays a clip on its own, where SDK6 stayed in bind pose. Rules, the lazy-registering `playAnim` wrapper and per-frame helper overhead: **animations-tweens** → Which clip plays.

**Done when:** `grep -rnE "new Animator|AnimationState|addClip|getClip" src/` returns zero hits, every clip name that appears in an SDK6 `playAnimation` / `getClip` call is listed in some `states[]` array, and every animated model that should rest or play a specific clip has an `Animator`.

### 10. Port sounds

`new AudioClip(url)` + `entity.addComponent(new AudioSource(clip))` becomes `AudioSource.create(entity, { audioClipUrl: url, playing: false, ... })`. Play by toggling `AudioSource.getMutable(entity).playing = true`. See **audio-video**.

**Done when:** `grep -rnE "new AudioClip|new AudioSource\(" src/` returns zero hits.

### 11. Verify and test

Run `npm install` to fetch the new SDK, then `sdk-commands start` (or `npm start`). The migration is complete only when ALL of these hold:

1. `npm run build` exits 0.
2. A final sweep `grep -rnE "decentraland-ecs|@Component\(|implements ISystem|Input\.instance|Camera\.instance" src/` returns zero hits — per-step greps get missed when work is interrupted and resumed; this is the end-to-end check.
3. The preview loads with no errors in the console.
4. The visible layout (positions/rotations) matches the SDK6 scene.

If any check fails, return to the step that owns that symbol category; the migration is done only when all four hold.

## Common Pitfalls

Topic pitfalls live in the step that owns them (components: step 5; primitives, materials, colors: step 7; clicks and colliders: step 8; animations: step 9). Detail for each line below is in `{baseDir}/references/api-mapping.md`.

- **Write through `getMutable()`.** `Transform.get(entity).position.x = 5` is silently a no-op; use `Transform.getMutable(entity).position.x = 5`.
- **Omit optional Transform fields instead of passing `undefined`.** `Transform.create(e, { position, rotation: undefined })` stores `undefined` over the default and crashes serialization with `Cannot read properties of undefined (reading 'x')`; build the object with only the fields you have — api-mapping → Transforms & math.
- **Replace Utils trigger areas and hand-rolled AABB polling with native `TriggerArea` + `triggerAreaEventsSystem`.** Guard local-player-only behaviour with `result.trigger?.entity === engine.PlayerEntity` (`triggeredEntity` is the area itself) — api-mapping → Trigger areas.
- **Replace `utils.Delay` / `Interval` / `ExpireIn` and any dt-accumulating timer system with `timers.setTimeout(cb, ms)` / `timers.setInterval` from `@dcl/sdk/ecs`** (callback first, the reverse of SDK6's `Delay(ms, cb)`) — api-mapping → Timers / delays.
- **Map held items by intent:** `Attachable.FIRST_PERSON_CAMERA` → parent to `engine.CameraEntity`; `Attachable.AVATAR` → `engine.PlayerEntity`; `AvatarAttach` only for cosmetics. Decision table: **player-avatar** → Held items vs cosmetic items.
- **Rotate ported billboarded models 180° on Y.** SDK6 pointed a billboarded model's +Z at the camera, SDK7 points −Z, and `Billboard` has no flip flag; apply the rotation to the child model when a parent carries the `Billboard` — api-mapping → Billboards.
- **Check Vector3 helper names against `@dcl/sdk/math`** after the port (`Vector3.Lerp` → `Vector3.lerp`).
- **Set a virtual canvas for ported UI:** `ReactEcsRenderer.setUiRenderer(uiRoot, { virtualWidth, virtualHeight })` with the pixel grid the SDK6 UI was authored against, because SDK6 UI pixels were absolute — api-mapping → UI sizing — virtual canvas.

## What is genuinely hard to migrate

These don't have a clean 1:1 mapping and need redesign:

- **Components with methods or constructors that do work** (e.g. `GemData.reset(val, x, y)`): split the data into the new component, move the logic into a free function that takes `(entity: Entity, val: number, ...)` and calls `Component.getMutable(entity)`.
- **Component groups that the user holds a reference to and iterates many times**: SDK7 `engine.getEntitiesWith(...)` is recomputed each call. For hot loops over the same set, cache it inside the system or accept the cost.
- **Object pools that rely on `entity.alive`**: SDK7 entities don't have an `alive` flag. Pools must track liveness with a custom component or by checking `Component.has(entity)`. The Migrated-2048 example simplified this to "always add a new entity" — that's acceptable for low-throughput cases, but a real pool needs explicit state.
- **UI built with the SDK6 `UICanvas` / `UIImage` / `UIText` / `UIClickable`**: not API-compatible with SDK7. SDK7 UI is React-ECS (JSX). See **build-ui** — this often requires a from-scratch rewrite. Set a virtual canvas size too (**Common Pitfalls**).
- **`@Component('name')` decorator metadata**: SDK7 component IDs are strings supplied to `engine.defineComponent('name', ...)`. Use the **same name** as the SDK6 decorator if other tools (composites, multiplayer sync) reference it by name. Otherwise pick a consistent naming scheme.

## Cross-References

- **create-scene** — scaffolding a fresh SDK7 project; scene.json schema in `{baseDir}/../create-scene/references/scene-json.md`
- **composites** — `.composite` file format for the optional second pass that moves static entities out of TypeScript
- **add-3d-models** — `GltfContainer`, collider masks for clickability
- **add-interactivity** — `pointerEventsSystem` (replaces SDK6 `OnPointerDown`)
- **advanced-input** — `inputSystem` polling (replaces SDK6 `Input.instance.subscribe`)
- **scene-runtime** — `timers.setTimeout` / `timers.setInterval` from `@dcl/sdk/ecs` (replaces SDK6 community `decentraland-ecs-utils` `Delay` / `Interval`), `executeTask`, `fetch`, realm/scene info
- **animations-tweens** — `Animator` and `Tween` (replaces SDK6 `Animator`/`AnimationState`)
- **audio-video** — `AudioSource` and `VideoPlayer`
- **build-ui** — React-ECS UI (replaces SDK6 `UICanvas` UI system)
- **advanced-rendering** — PBR materials, TextShape, Billboard
- **multiplayer-sync** — `syncEntity` for multiplayer (replaces SDK6 `MessageBus` / sync libraries)

## References

- `{baseDir}/references/api-mapping.md` — full table of SDK6 → SDK7 symbol conversions
- `{baseDir}/references/migration-example.md` — annotated before/after using the 2048 game scene (entity setup, components, systems, pointer events, animations)
