# Migration Example: 2048 Game (SDK6 → SDK7)

This is a worked example of porting a real SDK6 scene to SDK7. Snippets are minimal and focus on the *essential* migration patterns. Skip stylistic differences and concentrate on the API conversions.

## File structure

| SDK6 | SDK7 |
|------|------|
| `src/game.ts` (entry point, declared via `scene.json` `main: bin/game.js`) | `src/index.ts` exports `main()` which calls into `src/game.ts` |
| `src/modules/board.ts`, `gems.ts`, `openchest.ts`, `swiping.ts` (data classes + systems) | `src/components.ts` (component schemas) + `src/systems.ts` (system functions) + `src/game.ts` (entity setup) |
| `package.json` with `decentraland-ecs` | `package.json` with `@dcl/sdk` |
| `tsconfig.json` extending `decentraland-ecs/types/tsconfig.json` | Standalone `tsconfig.json` with `target: ES2020`, `module: ESNext`, `strict: true`, `jsx: react-jsx` |
| `scene.json` (no `runtimeVersion`) | `scene.json` with `"runtimeVersion": "7"` added — `main` left as `bin/game.js` |

## Components

### Plain data class → defineComponent

**SDK6 (`board.ts`)**:
```typescript
export class BoardData {
  won: boolean
  lost: boolean
  size: number = 4
  fourProbability: number = 0.1
  deltaX: number[] = [-1, 0, 1, 0]
  deltaY: number[] = [0, -1, 0, 1]
  tutorialDone: boolean = false
}
// usage:
const board = new BoardData()
board.tutorialDone = true
```

`BoardData` was a plain JS class, NOT an ECS component (no `@Component` decorator). It existed in module scope as a singleton.

**SDK7 (`components.ts`)**:
```typescript
export const BoardData = engine.defineComponent('boardData', {
  won: Schemas.Boolean,
  lost: Schemas.Boolean,
  size: Schemas.Number,
  fourProbability: Schemas.Number,
  deltaX: Schemas.Array(Schemas.Number),
  deltaY: Schemas.Array(Schemas.Number),
  tutorialDone: Schemas.Boolean
}, {
  won: false,
  lost: false,
  size: 4,
  fourProbability: 0.1,
  deltaX: [-1, 0, 1, 0],
  deltaY: [0, -1, 0, 1],
  tutorialDone: false
})
// usage:
let board: Entity  // singleton entity that carries BoardData
board = engine.addEntity()
BoardData.create(board)
const bd = BoardData.getMutable(board)
bd.tutorialDone = true
```

**Pattern**: globals-as-singletons in SDK6 become a single "singleton entity" carrying the component in SDK7. The data still lives in one place, but it's attached to an entity so systems can find it.

### @Component class with methods → defineComponent + free functions

**SDK6 (`gems.ts`)**:
```typescript
@Component('gemData')
export class GemData {
  val: number
  pos: Vector2
  nextPos: Vector2
  oldPos: Vector2
  lerp: number
  sizeLerp: number
  willDie: boolean
  willUpgrade: boolean
  constructor(val?: number, x?: number, y?: number) {
    this.val = val
    this.pos = new Vector2(x, y)
    // ...
  }
  reset(val: number, x: number, y: number) {
    this.val = val
    this.pos = new Vector2(x, y)
    // ...
  }
}
```

**SDK7 (`components.ts`)** — flatten `Vector2` to scalar pairs:
```typescript
export const GemData = engine.defineComponent('gemData', {
  val: Schemas.Number,
  posX: Schemas.Number,
  posY: Schemas.Number,
  nextPosX: Schemas.Number,
  nextPosY: Schemas.Number,
  oldPosX: Schemas.Number,
  oldPosY: Schemas.Number,
  lerp: Schemas.Number,
  sizeLerp: Schemas.Number,
  willDie: Schemas.Boolean,
  willUpgrade: Schemas.Boolean
}, {
  val: 2, posX: 0, posY: 0,
  nextPosX: 0, nextPosY: 0,
  oldPosX: 0, oldPosY: 0,
  lerp: 1, sizeLerp: 0,
  willDie: false, willUpgrade: false
})
// constructor and reset() are gone. Initial values are passed to .create():
GemData.create(ent, {
  val: 2,
  posX: x, posY: y,
  nextPosX: x, nextPosY: y,
  oldPosX: x, oldPosY: y,
  lerp: 1, sizeLerp: 0,
  willDie: false, willUpgrade: false
})
```

**Note** the keep-the-name pattern: the component string ID `'gemData'` is identical to the SDK6 `@Component('gemData')` name. Preserve these IDs so multiplayer-sync, composites, and any cross-scene tooling that referenced the component by name continue to work.

## Systems

### ISystem class → free function

**SDK6 (`gems.ts`)**:
```typescript
const gems = engine.getComponentGroup(Transform, GemData)

export class GrowGems implements ISystem {
  update(dt: number) {
    for (const gem of gems.entities) {
      const data = gem.getComponent(GemData)
      const transform = gem.getComponent(Transform)
      if (data.sizeLerp < 1) {
        data.sizeLerp += dt
        transform.scale.setAll(Scalar.Lerp(0.05, 0.5, data.sizeLerp))
      }
    }
  }
}
engine.addSystem(new GrowGems())
```

**SDK7 (`systems.ts`)**:
```typescript
export function growGemsSystem(dt: number) {
  for (const [entity, gemData] of engine.getEntitiesWith(GemData, Transform)) {
    if (gemData.sizeLerp < 1) {
      const mutableGemData = GemData.getMutable(entity)
      mutableGemData.sizeLerp += dt
      const mutableTransform = Transform.getMutable(entity)
      const scale = Scalar.lerp(0.05, 0.5, gemData.sizeLerp)
      mutableTransform.scale = Vector3.create(scale, scale, scale)
    }
  }
}
engine.addSystem(growGemsSystem)
```

Key changes:
- `class X implements ISystem { update(dt) }` → `function xSystem(dt)`
- `engine.getComponentGroup(A, B).entities` (iterable of entities) → `engine.getEntitiesWith(A, B)` (iterable of `[entity, a, b]` tuples)
- `gem.getComponent(GemData)` → `GemData.get(entity)` (read) / `GemData.getMutable(entity)` (write)
- `Scalar.Lerp` → `Scalar.lerp` (lowercase l)
- `transform.scale.setAll(s)` → `mutableTransform.scale = Vector3.create(s, s, s)`

### System that captured arguments → use defineComponent or module state

**SDK6**:
```typescript
class MoveGems implements ISystem {
  gemModels: GLTFShape[]
  constructor(models) { this.gemModels = models }
  update(dt) { /* uses this.gemModels */ }
}
engine.addSystem(new MoveGems(gemModels))
```

System constructor args don't carry across cleanly. Options:
1. Use module-level state (simplest):
   ```typescript
   // SDK7
   import { gemValues } from './components'
   export function moveGemsSystem(dt: number) {
     // reference gemValues / models from module scope
   }
   ```
2. Or store the data in a singleton component so systems read it from the ECS.

The 2048 SDK7 port took option 1 — `gemValues` is exported from `components.ts` and imported by `systems.ts`.

## Entity setup

### Static entity (island) — model + transform

**SDK6 (`game.ts`)**:
```typescript
const island = new Entity()
island.addComponent(new GLTFShape('models/Island.gltf'))
island.addComponent(new Transform({
  position: new Vector3(8, 0, 10.25),
  rotation: Quaternion.Euler(0, 270, 0)
}))
engine.addEntity(island)
```

**SDK7 (`game.ts`)**:
```typescript
const island = engine.addEntity()
GltfContainer.create(island, {
  src: 'models/Island.gltf',
  visibleMeshesCollisionMask: 3
})
Transform.create(island, {
  position: Vector3.create(8, 0, 10.25),
  rotation: Quaternion.fromEulerDegrees(0, 270, 0)
})
```

Key changes:
- `new Entity()` + `engine.addEntity(entity)` → single call `engine.addEntity()` that returns the ID
- `entity.addComponent(new X(...))` → `X.create(entity, {...})`
- `GLTFShape` → `GltfContainer` (renamed)
- `Quaternion.Euler` → `Quaternion.fromEulerDegrees`
- Explicit collision mask required if you want clicks/physics (SDK6 had `withCollisions: true` by default)

### Parented entity

**SDK6**:
```typescript
const map = new Entity()
map.setParent(boardWrapper)
map.addComponent(new Transform({ position: new Vector3(0, 1, 0), ... }))
map.addComponent(new GLTFShape('models/Map.gltf'))
engine.addEntity(map)
```

**SDK7**:
```typescript
const map = engine.addEntity()
Transform.create(map, {
  parent: boardWrapper,                  // ← parent is a Transform field now
  position: Vector3.create(0, 1, 0),
  rotation: Quaternion.fromEulerDegrees(0, 180, 0),
  scale: Vector3.create(2, 2, 2)
})
GltfContainer.create(map, { src: 'models/Map.gltf' })
```

The parent relationship is established by setting `parent` in the child's Transform.

### Primitive plane with a colored material

**SDK6**:
```typescript
const buttonMaterial = new Material()
buttonMaterial.albedoColor = Color3.Blue()

const button = new Entity()
button.addComponent(new PlaneShape())
button.addComponent(buttonMaterial)
button.setParent(boardWrapper)
button.addComponent(new Transform({ position: new Vector3(0, -2.5, -0.5) }))
engine.addEntity(button)
```

**SDK7**:
```typescript
const button = engine.addEntity()
Transform.create(button, {
  parent: boardWrapper,
  position: Vector3.create(0, -2.5, -0.5)
})
MeshRenderer.setPlane(button)
Material.setPbrMaterial(button, {
  albedoColor: Color4.Blue()
})
```

- `new PlaneShape()` → `MeshRenderer.setPlane(entity)`
- `new Material()` + assignments → single `Material.setPbrMaterial(entity, {...})` call
- `Color3` → `Color4`

### TextShape

**SDK6**:
```typescript
const instructions = new Entity()
instructions.setParent(boardWrapper)
instructions.addComponent(new TextShape('Drag gems...'))
instructions.getComponent(TextShape).fontSize = 1
instructions.getComponent(TextShape).shadowColor = Color3.Gray()
instructions.getComponent(TextShape).shadowOffsetY = 1
instructions.addComponent(new Transform({
  position: new Vector3(0, 3, -1),
  scale: new Vector3(4, 4, 1)
}))
engine.addEntity(instructions)
```

**SDK7**:
```typescript
const instructions = engine.addEntity()
Transform.create(instructions, {
  parent: boardWrapper,
  position: Vector3.create(0, 3, -1),
  scale: Vector3.create(4, 4, 1)
})
TextShape.create(instructions, {
  text: 'Drag gems...',
  fontSize: 1,
  textColor: Color4.White(),
  outlineWidth: 0.1,
  outlineColor: Color4.Black()
})
```

- `shadowColor` / `shadowOffsetX/Y` from SDK6 have no direct SDK7 equivalent — use `outlineColor` + `outlineWidth` to achieve similar legibility.

## Animations

**SDK6**:
```typescript
const chestAnimator = new Animator()
chest.addComponent(chestAnimator)
const chestOpen = new AnimationState('Open')
chestOpen.looping = false
const chestClose = new AnimationState('Close')
chestClose.looping = false
chestAnimator.addClip(chestOpen)
chestAnimator.addClip(chestClose)

// Later, to play:
chestOpen.play()
// To stop:
chestOpen.stop()
```

**SDK7**:
```typescript
Animator.create(chest, {
  states: [
    { clip: 'Open',  playing: false, loop: false },
    { clip: 'Close', playing: false, loop: false }
  ]
})

// Later, to play one clip exclusively:
Animator.playSingleAnimation(chest, 'Open')
// To stop all:
Animator.stopAllAnimations(chest)
```

- `new Animator()` + `new AnimationState()` + `addClip` → one `Animator.create` with the full `states` array
- `clip.play()` → `Animator.playSingleAnimation(entity, 'clipName')`
- `clip.stop()` → `Animator.stopAllAnimations(entity)` or mutate the specific state's `playing` field via `getMutable`

See [[animations-tweens]] for the full Animator API.

## Pointer events

**SDK6** — handler attached as a component:
```typescript
chest.addComponent(new OnPointerDown(
  (e) => { openChest() },
  { button: ActionButton.POINTER, hoverText: 'Open' }
))
```

**SDK7** — handler registered via system:
```typescript
pointerEventsSystem.onPointerDown(
  {
    entity: chest,
    opts: { button: InputAction.IA_POINTER, hoverText: 'Open' }
  },
  () => { openChest() }
)
```

**Critical**: in SDK7 the entity must have a `CL_POINTER` collider. For `GltfContainer`, set `visibleMeshesCollisionMask: 1` (or `3` for click + physics). For primitives, add `MeshCollider.setBox(entity)`.

See [[add-interactivity]] for the full pointer/proximity/trigger event surface.

## Global input — swipe detection

**SDK6** — `Input.instance.subscribe`:
```typescript
const input = Input.instance
input.subscribe('BUTTON_DOWN', ActionButton.POINTER, false, (e) => {
  swipeChecker.buttonDown(e.direction)
})
input.subscribe('BUTTON_UP', ActionButton.POINTER, false, (e) => {
  const direction = swipeChecker.buttonUp(e.direction)
  shiftBlocks(direction)
})
```

**SDK7 option A** — entity-scoped pointer events on the playing-field mesh (used in Migrated-2048):
```typescript
let swipeStart: Vector3 | null = null
pointerEventsSystem.onPointerDown(
  { entity: map, opts: { button: InputAction.IA_POINTER } },
  (event) => { swipeStart = event.hit?.position ?? null }
)
pointerEventsSystem.onPointerUp(
  { entity: map, opts: { button: InputAction.IA_POINTER } },
  (event) => {
    if (!swipeStart) return
    const end = event.hit?.position
    if (!end) return
    // compute swipe direction from swipeStart → end
  }
)
```

**SDK7 option B** — global input polling (no entity needed):
```typescript
engine.addSystem(() => {
  if (inputSystem.isTriggered(InputAction.IA_POINTER, PointerEventType.PET_DOWN)) {
    /* button just pressed this frame */
  }
})
```

Option A is generally preferred when the swipe must happen *on* a specific object (you also get the world-space hit point for free). Option B is for global hotkeys.

## Entity pool / spawning

SDK6 used `entity.alive` to track which pool entries were free. SDK7 has no `alive` flag. Two options:

1. **Drop the pool** (used in Migrated-2048) — just `engine.addEntity()` every time. Acceptable for low-volume spawning.
2. **Implement a real pool** with a custom `Pooled` component:
   ```typescript
   const Pooled = engine.defineComponent('pooled', { inUse: Schemas.Boolean }, { inUse: false })
   // grab a free one by querying for entities where inUse === false
   ```

## scene.json adjustment

**SDK6 `scene.json`** has no `runtimeVersion` and no `ecs7` field:
```json
{
  "display": { "title": "..." },
  "scene": { "parcels": ["0,0"], "base": "0,0" },
  "main": "bin/game.js",
  ...
}
```

**SDK7 `scene.json`** adds `runtimeVersion`:
```json
{
  "runtimeVersion": "7",
  "display": { "title": "..." },
  "scene": { "parcels": ["0,0"], "base": "0,0" },
  "main": "bin/game.js",
  ...
}
```

**Keep `main` as it was** unless the user explicitly asks to change it. New SDK7 scaffolding uses `bin/index.js`, but legacy projects often build to `bin/game.js` — silently changing this breaks the scene.

## package.json adjustment

**SDK6**:
```json
{
  "scripts": {
    "start": "dcl start",
    "build": "build-ecs",
    "watch": "build-ecs --watch"
  },
  "dependencies": { "decentraland-ecs": "latest" }
}
```

**SDK7**:
```json
{
  "scripts": {
    "start": "sdk-commands start",
    "deploy": "sdk-commands deploy",
    "build": "sdk-commands build",
    "upgrade-sdk": "npm install --save-dev @dcl/sdk@latest"
  },
  "devDependencies": {
    "@dcl/js-runtime": "7.8.21",
    "@dcl/sdk": "latest"
  }
}
```

(Exact `@dcl/js-runtime` version varies — use whatever the current SDK7 template ships with. Don't hand-roll it; run `npx @dcl/sdk-commands init` in a sibling directory and copy the generated `package.json`.)

## What this example does NOT cover

- **UI migration** — 2048 has no SDK6 `UICanvas` UI. For scenes that do, expect a full rewrite using React-ECS. See [[build-ui]].
- **Multiplayer sync** — 2048 is single-player. For SDK6 `MessageBus` or community sync libraries → SDK7 `syncEntity` / `MessageBus` from `@dcl/sdk/network`. See [[multiplayer-sync]].
- **Physics** — 2048 has no physics-driven entities.
- **NFT display** — `NFTShape` → `NftShape` (lowercase 't'). See [[nft-blockchain]].
- **Smart wearables / portable experiences** — different deployment path entirely.

## Verification checklist after porting

- [ ] `npm install` succeeds with `@dcl/sdk` installed.
- [ ] `sdk-commands start` runs without TypeScript errors.
- [ ] In-world: every entity visible at the same position/rotation/scale as the SDK6 scene.
- [ ] Clickable objects respond (chest opens, etc.) — verify colliders are set.
- [ ] Animations play on the right triggers.
- [ ] No `console.error` from missing components or null entity refs.
- [ ] The `bin/` output matches what `scene.json` `main` expects (often `bin/game.js` for ported scenes).
