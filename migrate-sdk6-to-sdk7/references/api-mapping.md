# SDK6 → SDK7 API Mapping

Comprehensive table of every common SDK6 API and its SDK7 equivalent. Use this as a search reference during migration.

## Imports

In SDK6, most symbols (`Entity`, `Transform`, `Vector3`, `engine`, `log`, `Color3`, etc.) were available as globals from `decentraland-ecs`. In SDK7, **every symbol must be explicitly imported**.

```typescript
// SDK7 — typical migration import block
import {
  engine,
  Entity,
  Transform,
  GltfContainer,
  MeshRenderer,
  MeshCollider,
  Material,
  TextShape,
  Animator,
  AudioSource,
  Billboard,
  VisibilityComponent,
  pointerEventsSystem,
  inputSystem,
  InputAction,
  PointerEventType,
  Schemas
} from '@dcl/sdk/ecs'
import { Vector3, Quaternion, Color3, Color4, Scalar } from '@dcl/sdk/math'
```

## Asset paths (folder reorganization)

SDK6 scenes typically keep assets at the project root (`models/`, `images/`, `audio/`, `sounds/`, `textures/`, `videos/`). SDK7 + Creator Hub expects assets under a top-level `assets/` folder. Move them BEFORE porting code, then rewrite every reference in one pass.

| SDK6 (project-root)         | SDK7 (under `assets/`)                                             |
|-----------------------------|--------------------------------------------------------------------|
| `models/foo.glb`            | `assets/Models/foo.glb`                                            |
| `images/icon.png`           | `assets/Images/icon.png`                                           |
| `textures/logo.png`         | `assets/Images/logo.png` (textures are images; consolidate)        |
| `audio/click.mp3` / `sounds/click.mp3` | `assets/Audio/click.mp3`                                |
| `videos/intro.mp4`          | `assets/Videos/intro.mp4`                                          |

Code-reference rewrites that must follow the move:

| SDK6 reference                                                  | SDK7 reference                                                                |
|-----------------------------------------------------------------|-------------------------------------------------------------------------------|
| `new GLTFShape('models/foo.glb')`                               | `GltfContainer.create(e, { src: 'assets/Models/foo.glb' })`                   |
| `new AudioClip('sounds/click.mp3')`                             | `AudioSource.create(e, { audioClipUrl: 'assets/Audio/click.mp3', ... })`      |
| `new Texture('textures/logo.png')`                              | `Material.Texture.Common({ src: 'assets/Images/logo.png' })`                  |
| `new UIImage(parent, new Texture('images/icon.png'))`           | React-ECS: `uiBackground={{ texture: { src: 'assets/Images/icon.png' } }}`    |
| Any path literal in `.composite` files                          | Update to the new `assets/...` path                                           |

**Rules**:
- Use **capitalized** category folders (`Models`, `Images`, `Audio`, `Videos`) — matches the convention used by [[create-scene]], [[add-3d-models]], and [[audio-video]] for fresh SDK7 work.
- **Reuse existing layout if present.** If the project already has `assets/scene/Models/` (Creator Hub legacy layout) or `assets/asset-packs/` / `assets/custom/` (Creator Hub UI imports), keep using those exact paths — don't create a parallel `assets/Models/`.
- **Never leave dual copies.** Delete the old top-level folders once the move is done. Dual copies bloat deploy size and cause Creator Hub to index stale paths.
- **Grep before declaring done.** Search the entire repo (including `.composite`, `.json`, `.ts`, `.tsx` files) for each old folder name (`models/`, `sounds/`, etc.) — there should be zero remaining references.

## Entities

| SDK6 | SDK7 |
|------|------|
| `const e = new Entity()` | `const e = engine.addEntity()` |
| `engine.addEntity(e)` | (already returned from `engine.addEntity()`) |
| `engine.removeEntity(e)` | `engine.removeEntity(e)` (unchanged) |
| `e.alive` | No equivalent — track liveness with `Component.has(entity)` or a custom flag |
| `e.uuid` | Entity itself is an integer ID — use it directly |
| `e.setParent(parent)` | `Transform.getMutable(e).parent = parent` (or pass `parent` in `Transform.create`) |
| `Entity` (type) | `Entity` (type, but now an integer, not a class) |
| `IEntity` (type) | `Entity` |

## Components — general access

| SDK6 | SDK7 |
|------|------|
| `e.addComponent(new C(...))` | `C.create(e, {...})` |
| `e.addComponentOrReplace(new C(...))` | `C.createOrReplace(e, {...})` |
| `e.getComponent(C)` (for reading) | `C.get(e)` — returns READ-ONLY reference |
| `e.getComponent(C)` (for writing) | `C.getMutable(e)` — returns mutable reference |
| `e.getComponentOrCreate(C)` | `C.getOrCreateMutable(e)` |
| `e.getComponentOrNull(C)` | `C.getOrNull(e)` |
| `e.hasComponent(C)` | `C.has(e)` |
| `e.removeComponent(C)` | `C.deleteFrom(e)` |

**Mutability discipline:** `.get()` returns an immutable view (cheap, no network sync). `.getMutable()` marks the component dirty and triggers a CRDT delta. Use `.get()` whenever you only read.

## Defining custom components

```typescript
// SDK6
@Component('gemData')
export class GemData {
  val: number
  pos: Vector2
  constructor(val?: number, x?: number, y?: number) {
    this.val = val
    this.pos = new Vector2(x, y)
  }
  reset(val: number, x: number, y: number) { /* ... */ }
}

// SDK7
export const GemData = engine.defineComponent('gemData', {
  val: Schemas.Number,
  posX: Schemas.Number,
  posY: Schemas.Number
}, {
  val: 2,
  posX: 0,
  posY: 0
})
// reset() becomes a free function:
export function resetGem(entity: Entity, val: number, x: number, y: number) {
  const d = GemData.getMutable(entity)
  d.val = val
  d.posX = x
  d.posY = y
}
```

**Schemas available** (from `@dcl/sdk/ecs`):
- Primitives: `Schemas.Boolean`, `.String`, `.Number`, `.Int`, `.Float`, `.Int64`, `.Byte`
- Math: `Schemas.Vector3`, `.Quaternion`, `.Color3`, `.Color4`
- Containers: `Schemas.Array(s)`, `.Map({...})`, `.Optional(s)`, `.OneOf({...})`
- Enums: `Schemas.EnumString(enumObj, defaultValue)` / `Schemas.EnumNumber(enumObj, defaultValue)` — the default (second arg) is required. There is no bare `Schemas.Enum`.

[UNVERIFIED] `Schemas.Vector2` — confirm by checking the `@dcl/sdk/ecs` Schemas export before using. The safe pattern is to flatten Vector2 fields into two `Schemas.Number` fields (e.g. `posX`, `posY`).

## Systems

| SDK6 | SDK7 |
|------|------|
| `class MoveGems implements ISystem { update(dt) {...} }` | `function moveGemsSystem(dt: number) { ... }` |
| `engine.addSystem(new MoveGems())` | `engine.addSystem(moveGemsSystem)` |
| `engine.removeSystem(systemInstance)` | `engine.removeSystem(systemFunctionRef)` |
| `engine.getComponentGroup(A, B)` + `.entities` | `engine.getEntitiesWith(A, B)` returning iterable of `[entity, a, b]` |

```typescript
// SDK6
const gems = engine.getComponentGroup(Transform, GemData)
class MoveGems implements ISystem {
  update(dt: number) {
    for (const gem of gems.entities) {
      const data = gem.getComponent(GemData)
      data.lerp += dt
    }
  }
}
engine.addSystem(new MoveGems())

// SDK7
export function moveGemsSystem(dt: number) {
  for (const [entity, data] of engine.getEntitiesWith(GemData, Transform)) {
    const mutable = GemData.getMutable(entity)
    mutable.lerp += dt
  }
}
engine.addSystem(moveGemsSystem)
```

## Transforms & math

| SDK6 | SDK7 |
|------|------|
| `new Transform({ position, rotation, scale })` | `Transform.create(e, { position, rotation, scale, parent? })` |
| `transform.position = new Vector3(x, y, z)` | `Transform.getMutable(e).position = Vector3.create(x, y, z)` |
| `transform.scale.setAll(0.5)` | `Transform.getMutable(e).scale = Vector3.create(0.5, 0.5, 0.5)` |
| `new Vector3(x, y, z)` | `Vector3.create(x, y, z)` |
| `Vector3.Zero()` / `.One()` / `.Up()` / `.Forward()` | Same names — `Vector3.Zero()`, `.One()`, `.Up()`, `.Forward()` (still PascalCase factories) |
| `Vector3.Lerp(a, b, t)` | `Vector3.lerp(a, b, t)` (lowercase `l`) |
| `Vector3.GetAngleBetweenVectors(a, b, up)` | [UNVERIFIED — confirm name in `@dcl/sdk/math`. Common replacement: compute via `Vector3.angle` or manual dot product.] |
| `Quaternion.Euler(x, y, z)` | `Quaternion.fromEulerDegrees(x, y, z)` |
| `Quaternion.Identity` | `Quaternion.Identity()` |
| `Scalar.Lerp(a, b, t)` | `Scalar.lerp(a, b, t)` |
| `Color3.Blue()` / `.Red()` / `.Green()` / `.White()` / `.Black()` | `Color4.Blue()` / `.Red()` / etc. (most component fields use Color4) — `Color3.X()` still exists in `@dcl/sdk/math` for the few that need it |
| `RAD2DEG` constant | [UNVERIFIED] — compute as `180 / Math.PI` if needed |

## Primitive shapes

| SDK6 | SDK7 |
|------|------|
| `new BoxShape()` | `MeshRenderer.setBox(e)` + (if collisions wanted) `MeshCollider.setBox(e)` |
| `new SphereShape()` | `MeshRenderer.setSphere(e)` + `MeshCollider.setSphere(e)` |
| `new PlaneShape()` | `MeshRenderer.setPlane(e)` + `MeshCollider.setPlane(e)` |
| `new CylinderShape()` | `MeshRenderer.setCylinder(e)` + `MeshCollider.setCylinder(e)` |
| `new ConeShape()` | `MeshRenderer.setCylinder(e, radiusTop=0, radiusBottom=1)` (cone is a cylinder degenerate case) |
| `shape.withCollisions = true` (default) | Add a `MeshCollider.setX(e)` separately. Use `ColliderLayer.CL_POINTER` mask for clicks, `CL_PHYSICS` for player blocking |
| `shape.visible = false` | `VisibilityComponent.create(e, { visible: false })` |

## GLTF models

| SDK6 | SDK7 |
|------|------|
| `new GLTFShape('models/x.glb')` | `GltfContainer.create(e, { src: 'models/x.glb' })` |
| `shape.withCollisions = true` | `visibleMeshesCollisionMask: 3` (clickable + physics) — see [[add-3d-models]] for the full mask table |
| `shape.isPointerBlocker = true` | `visibleMeshesCollisionMask: 1` (CL_POINTER only) |
| `shape.visible = false` | `VisibilityComponent.create(e, { visible: false })` |
| `entity.addComponentOrReplace(new GLTFShape('models/new.glb'))` | `GltfContainer.createOrReplace(e, { src: 'models/new.glb' })` — but re-verify Transform per the **swap rule** in [[add-3d-models]] |

## Materials & textures

```typescript
// SDK6
const mat = new Material()
mat.albedoColor = Color3.Blue()
mat.metallic = 0
mat.roughness = 1
entity.addComponent(mat)

const tex = new Texture('textures/logo.png')
const basic = new BasicMaterial()
basic.texture = tex
plane.addComponent(basic)

// SDK7
Material.setPbrMaterial(entity, {
  albedoColor: Color4.Blue(),
  metallic: 0,
  roughness: 1
})

Material.setBasicMaterial(plane, {
  texture: Material.Texture.Common({ src: 'textures/logo.png' })
})
```

| SDK6 | SDK7 |
|------|------|
| `new Material()` | `Material.setPbrMaterial(e, {...})` (no separate object) |
| `new BasicMaterial()` | `Material.setBasicMaterial(e, {...})` |
| `new Texture(url)` | `Material.Texture.Common({ src: url })` or `Material.Texture.Avatar({...})` or `Material.Texture.Video({...})` |
| `Color3.Blue()` etc. | Generally `Color4.Blue()` for PBR fields |

## Text

| SDK6 | SDK7 |
|------|------|
| `new TextShape('hello')` | `TextShape.create(e, { text: 'hello' })` |
| `ts.fontSize = 1` | Field on the create payload: `TextShape.create(e, { fontSize: 1, ... })` |
| `ts.color = Color3.White()` | `textColor: Color4.White()` (note rename: `color` → `textColor`) |
| `ts.shadowColor = Color3.Gray()` / `ts.shadowOffsetX/Y` | Same fields exist on SDK7 `TextShape`: `shadowColor` (`Color3`), `shadowBlur`, `shadowOffsetX`, `shadowOffsetY`. (`outlineWidth` / `outlineColor` are often preferred for legibility.) |
| `ts.font` (string name) | `font: Font.F_SANS_SERIF` (enum) |

## Animations (model clips)

```typescript
// SDK6
const animator = new Animator()
entity.addComponent(animator)
const openClip = new AnimationState('Open')
openClip.looping = false
animator.addClip(openClip)
openClip.play()
openClip.stop()

// SDK7
Animator.create(entity, {
  states: [
    { clip: 'Open',  playing: false, loop: false },
    { clip: 'Close', playing: false, loop: false }
  ]
})
Animator.playSingleAnimation(entity, 'Open')
Animator.stopAllAnimations(entity)
// To toggle one clip directly:
const open = Animator.getClip(entity, 'Open') // returns the state object
// then mutate the Animator with getMutable to flip `playing`
```

**A clip must be in `states[]` when calling `playSingleAnimation` programmatically.** Unlike SDK6's `Animator.getClip(name)`, which auto-created the clip on first use, `Animator.playSingleAnimation(entity, clipName)` returns `false` and does nothing if `clipName` is not already in `Animator.states` (verified — `@dcl/ecs/dist-cjs/components/extended/Animator.js` lines 35-46). This is the path porters typically hit, because they author the Animator in code. Walk every `playAnimation` / `getClip` call in the SDK6 source and collect the full set of clip names per entity before writing `states`. For a port-friendly shim that lazily pushes missing states, see the wrapper in [[animations-tweens]] (PITFALL section). This rule does **not** apply to Animators authored by the Creator Hub Inspector (whose composite already lists every GLB clip in `states[]`) or by asset packs / smart items (which ship populated).

Also: if a GLTF model has animation clips and the entity has **no** `Animator` component, `GltfContainer` autoplays one clip from the .glb on its own — this is the same mechanism that lets clip-less Inspector scenes animate without explicit registration. SDK6 stayed in bind pose by default, so porting an SDK6 scene that simply omitted `Animator` will produce models that spawn playing an arbitrary clip (observed: `die` autoplaying on ghosts with no Animator). If you want a specific default, attach an `Animator.create` with the intended clip set to `playing: true`. If you also want to switch clips at runtime via `playSingleAnimation`, list every clip you'll switch to in `states[]` per the rule above.

See [[animations-tweens]] for full details. Note: `AnimationState` is gone — clips are configured inside `Animator.states[]`.

## Pointer events / clicks

```typescript
// SDK6
entity.addComponent(new OnPointerDown(
  (e) => { /* clicked */ },
  { button: ActionButton.POINTER, hoverText: 'Open' }
))

// SDK7
pointerEventsSystem.onPointerDown(
  {
    entity,
    opts: { button: InputAction.IA_POINTER, hoverText: 'Open' }
  },
  () => { /* clicked */ }
)
```

| SDK6 | SDK7 |
|------|------|
| `new OnPointerDown(handler, opts)` on entity | `pointerEventsSystem.onPointerDown({entity, opts}, handler)` |
| `new OnPointerUp(...)` | `pointerEventsSystem.onPointerUp({entity, opts}, handler)` |
| `new OnPointerHoverEnter(...)` | `pointerEventsSystem.onPointerHoverEnter({entity, opts}, handler)` |
| `new OnPointerHoverExit(...)` | `pointerEventsSystem.onPointerHoverLeave({entity, opts}, handler)` |
| Remove handler (was: drop the component) | `pointerEventsSystem.removeOnPointerDown(entity)` etc. |
| `ActionButton.POINTER` | `InputAction.IA_POINTER` |
| `ActionButton.PRIMARY` (E) | `InputAction.IA_PRIMARY` |
| `ActionButton.SECONDARY` (F) | `InputAction.IA_SECONDARY` |
| `ActionButton.ACTION_3..6` (1-4 keys) | `InputAction.IA_ACTION_3 .. IA_ACTION_6` |
| `ActionButton.JUMP` | `InputAction.IA_JUMP` |
| `ActionButton.WALK` | `InputAction.IA_WALK` |
| `ActionButton.FORWARD/BACKWARD/LEFT/RIGHT` | `InputAction.IA_FORWARD/BACKWARD/LEFT/RIGHT` |

**Critical**: SDK7 pointer events require the entity to have a `CL_POINTER` collider. For primitives add `MeshCollider.setBox(e)`. For GLTFs set `visibleMeshesCollisionMask: 1` (or `3` for clicks + physics). See [[add-interactivity]].

## Global input (key down/up anywhere)

```typescript
// SDK6
Input.instance.subscribe('BUTTON_DOWN', ActionButton.POINTER, false, (e) => {
  swipeChecker.buttonDown(e.direction)
})

// SDK7 — inside a system
engine.addSystem(() => {
  if (inputSystem.isTriggered(InputAction.IA_POINTER, PointerEventType.PET_DOWN)) {
    /* just pressed this frame */
  }
  if (inputSystem.isPressed(InputAction.IA_FORWARD)) {
    /* currently held */
  }
})
```

| SDK6 | SDK7 |
|------|------|
| `Input.instance.subscribe('BUTTON_DOWN', btn, false, cb)` | `inputSystem.isTriggered(action, PointerEventType.PET_DOWN)` inside a system |
| `Input.instance.subscribe('BUTTON_UP', btn, false, cb)` | `inputSystem.isTriggered(action, PointerEventType.PET_UP)` inside a system |
| `Input.instance.isButtonPressed(btn)` | `inputSystem.isPressed(action)` |
| Event `e.hit` / `e.origin` / `e.direction` | `inputSystem.getInputCommand(action, eventType)` returns the full event, or use `pointerEventsSystem.onPointerDown` with a per-entity handler whose callback receives `{ hit }` |

See [[advanced-input]] for the full polling API.

## Click interception across entities (key/tool acting on a target)

SDK6 items like keys, magnets, or inventory tools subscribed to `Input.instance.subscribe('BUTTON_DOWN', ActionButton.POINTER, true, …)` to **intercept clicks globally**, walk up the entity hierarchy of the hit result, and fire their own behavior if the click target matched a registered target name (e.g. a key clicked on its target chest).

SDK7 has no global pointer subscriber that returns a hit result. `pointerEventsSystem.onPointerDown` is per-entity only. To preserve the SDK6 "tool intercepts clicks on its target" pattern:

1. The intercepting item (key) registers itself in a small in-memory registry keyed by **target entity name**, with `{ isEquipped: () => boolean, use: () => void }`.
2. The target entity (chest) consults the registry inside its own `pointerEventsSystem.onPointerDown` callback — calling the registered `use()` if the predicate returns true, falling back to its own default behavior otherwise.

```typescript
// key registry (shared between key.ts and target items like chest.ts)
type Entry = { isEquipped: () => boolean; use: () => void }
const keysByTarget = new Map<string, Entry>()

export function registerKey(target: string, e: Entry) { keysByTarget.set(target, e) }
export function tryUseKeyOn(target: string): boolean {
  const e = keysByTarget.get(target)
  if (e && e.isEquipped()) { e.use(); return true }
  return false
}

// in key.ts on spawn:
registerKey('chestPirates', { isEquipped: () => equipped, use: () => { unequip(); dispatch(onUse) } })

// in chest.ts pointer handler:
pointerEventsSystem.onPointerDown({ entity: door, opts: {...} }, () => {
  if (!tryUseKeyOn('chestPirates')) dispatch(onClick) // "you need a key"
})
```

**Why a registry rather than two `pointerEventsSystem.onPointerDown` registrations on the same entity:** the last `onPointerDown` call wins and overwrites the previous handler. Two items both calling `onPointerDown` on the same target entity will silently leave only one handler attached.

## Trigger areas (player-entry regions)

SDK6 had **no native trigger area component**. The community `@dcl/ecs-scene-utils` library ("the Utils library") provided this with a custom helper that ran a per-frame system checking the local player's position against a box/sphere region. SDK7 has a **native** `TriggerArea` component — do NOT port the Utils polling code; replace the pattern entirely.

```typescript
// SDK6 — community Utils library (one common shape; varied between versions)
import * as utils from '@dcl/ecs-scene-utils'

entity.addComponent(
  new utils.TriggerComponent(
    new utils.TriggerBoxShape(new Vector3(4, 4, 4), new Vector3(0, 0, 0)),
    {
      onCameraEnter: () => { /* local player entered */ },
      onCameraExit:  () => { /* local player exited */ }
    }
  )
)

// SDK7 — native component
import { engine, Transform, TriggerArea, triggerAreaEventsSystem, ColliderLayer } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

const area = engine.addEntity()
Transform.create(area, {
  position: Vector3.create(8, 0, 8),
  scale: Vector3.create(4, 4, 4)        // box dimensions come from Transform.scale
})
TriggerArea.setBox(area)                 // or TriggerArea.setSphere(area)

triggerAreaEventsSystem.onTriggerEnter(area, (result) => {
  if (result.trigger?.entity !== engine.PlayerEntity) return   // local-player guard — see parity note
  /* local player entered */
})
triggerAreaEventsSystem.onTriggerExit(area, (result) => {
  if (result.trigger?.entity !== engine.PlayerEntity) return
  /* local player exited */
})
```

| SDK6 (Utils library)                                                                | SDK7 (native) |
|-------------------------------------------------------------------------------------|---------------|
| `import * as utils from '@dcl/ecs-scene-utils'`                                     | `import { TriggerArea, triggerAreaEventsSystem, ColliderLayer } from '@dcl/sdk/ecs'` |
| `new utils.TriggerBoxShape(size, offset)`                                           | `TriggerArea.setBox(entity)` — size driven by `Transform.scale`; offset by `Transform.position` |
| `new utils.TriggerSphereShape(radius, offset)`                                      | `TriggerArea.setSphere(entity)` — radius driven by `Transform.scale` |
| `new utils.TriggerComponent(shape, { onCameraEnter, onCameraExit })`                | `triggerAreaEventsSystem.onTriggerEnter(entity, cb)` + `.onTriggerExit(entity, cb)` |
| (no continuous "while inside" callback — had to add a per-frame system)             | `triggerAreaEventsSystem.onTriggerStay(entity, cb)` — fires every frame an entity is inside |
| Custom per-frame system polling `Camera.instance.position` against the region       | Replace entirely. Do NOT port the polling logic — the native component handles it. |
| Utils library implicitly only ever detected the local player                        | Native `TriggerArea` defaults to `ColliderLayer.CL_PLAYER`. **Behavioral note below.** |

**Behavior parity — local player only (important):**

The Utils library trigger only ever fired for the **current local player** — there was no concept of detecting other avatars inside the region. The native SDK7 `TriggerArea` defaults to the `CL_PLAYER` layer, which fires for ANY player on that layer — local OR remote. The guard inside the handler is the documented way to preserve "local-player-only" behavior:

```typescript
if (result.trigger?.entity !== engine.PlayerEntity) return
```

`engine.PlayerEntity` is the **local** player. **Important — the field naming is counterintuitive**: use `result.trigger?.entity` (nested field — the entity that entered the volume), NOT `result.triggeredEntity` (top-level — despite its name, this is the trigger area's own entity). Comparing `result.triggeredEntity` to `engine.PlayerEntity` is always true and the guard never fires.

**Other gotchas when porting:**

- The Utils library box/sphere shape took an explicit `size` and `offset`. In SDK7 the dimensions come from `Transform.scale` and the position from `Transform.position` on the same entity — don't pass dimensions to `setBox`/`setSphere`.
- The second argument to `TriggerArea.setBox(entity, layerMask)` is a `ColliderLayer` bitmask, NOT a size. Leave it off to keep the default `CL_PLAYER` behavior.
- `triggerAreaEventsSystem.onTriggerEnter` registers a handler once — register at scene setup, NOT inside a system update or you'll re-register every frame.

See [[add-interactivity]] for the full TriggerArea reference and [[player-physics]] for examples of the `engine.PlayerEntity` guard in trigger callbacks.

## Camera & Player

| SDK6 | SDK7 |
|------|------|
| `Camera.instance.position` | `Transform.get(engine.CameraEntity).position` |
| `Camera.instance.rotation` | `Transform.get(engine.CameraEntity).rotation` |
| `Camera.instance.cameraMode` | `CameraMode.get(engine.CameraEntity).mode` |
| `Camera.instance.feetPosition` (player feet) | `Transform.get(engine.PlayerEntity).position` |
| `Camera.instance.worldPosition` | Read on `engine.CameraEntity` Transform — already world-space if no parent |

### Attaching items to the player

SDK6 had two coarse "follow" options for items meant to ride along with the player. SDK7 splits these into three distinct paths, picked by **what kind of item** it is. Use the table to pick the right destination — bone-level `AvatarAttach` is **not** the universal SDK7 replacement for SDK6 `Attachable`, and `engine.PlayerEntity` is **not** the universal replacement for `Attachable.FIRST_PERSON_CAMERA` (it loses camera pitch — see anti-patterns below).

| Parent / mechanism | Tracks | Use for | SDK6 origin |
|--------------------|--------|---------|-------------|
| `Transform.parent = engine.CameraEntity` (plus local `position` offset for "in front of and below" the camera) | Camera **yaw + pitch** (aim follows look direction) | **Aim-sensitive held items — recommended default for guns, aiming reticles, flashlights, anything the player should be able to point by looking around.** | Direct SDK7 equivalent of `entity.setParent(Attachable.FIRST_PERSON_CAMERA)`. |
| `Transform.parent = engine.PlayerEntity` (plus local `position` offset for hand-height / forward distance) | Player root: feet + body **yaw only**, **no pitch**, no animation | **Body-fixed items that should stay level regardless of where the camera points** — held shield not used for aim, static carried torch, non-aimed inventory carried at hip-level. Wrong default for guns/aim items. | SDK7 equivalent of `entity.setParent(Attachable.AVATAR)`. |
| `AvatarAttach.create(e, { anchorPointId: AAPT_RIGHT_HAND \| AAPT_HEAD \| AAPT_SPINE \| ... })` | The actual animated bone (idle bob, walk cycle, gestures all propagate) | **Cosmetic items** that should ride the avatar animation: hats, halos, backpacks, name plates, torches visible to other players. **NOT for gameplay aim.** | No SDK6 equivalent — bone-level attachment is new in SDK7. |

| SDK6 | SDK7 (porting target) |
|------|----------------------|
| `entity.setParent(Attachable.FIRST_PERSON_CAMERA)` | `Transform.getMutable(e).parent = engine.CameraEntity` (or `parent` in `Transform.create`) + local `position` offset |
| `entity.setParent(Attachable.AVATAR)` | `Transform.getMutable(e).parent = engine.PlayerEntity` + local `position` offset |

**Anti-patterns (common SDK6 → SDK7 porting mistakes):**

- Replacing `Attachable.FIRST_PERSON_CAMERA` with `AvatarAttach({ anchorPointId: AAPT_RIGHT_HAND })`. The API name reads like the right SDK7 way to "put it in the avatar's hand", but `AAPT_RIGHT_HAND` is a bone on the animated skeleton — the attached entity inherits idle bob, walk cycle, and any active gesture animation, so a gun jitters every frame and is unaimable. Use parenting (`Transform.parent`) for held items; reserve `AvatarAttach` for cosmetics.
- Replacing `Attachable.FIRST_PERSON_CAMERA` with `Transform.parent = engine.PlayerEntity`. This is the **most common subtle failure** when porting held gameplay items: it looks correct for hip-fire (the gun follows yaw with the body), but the moment the player tilts the camera up to aim at a high target the gun stays flat — `PlayerEntity` inherits body yaw only, not camera pitch. For any aim-sensitive item, parent to `engine.CameraEntity` instead. Reserve `PlayerEntity` for items that should explicitly stay level regardless of look direction.

See [[player-avatar]] for the full "Held items vs cosmetic items" comparison and a worked gun example, and [[camera-control]] for camera-mode forcing when equipping a held weapon.

See [[camera-control]] and [[player-avatar]].

## Audio

```typescript
// SDK6
const clip = new AudioClip('sounds/chime.mp3')
const source = new AudioSource(clip)
entity.addComponent(source)
source.playOnce()

// SDK7
AudioSource.create(entity, {
  audioClipUrl: 'sounds/chime.mp3',
  playing: false,
  loop: false,
  volume: 1
})
// To play:
AudioSource.getMutable(entity).playing = true
```

| SDK6 | SDK7 |
|------|------|
| `new AudioClip(url)` + `new AudioSource(clip)` | `AudioSource.create(e, { audioClipUrl: url, ... })` |
| `source.playOnce()` | Set `playing: true` then back to `false` after the clip ends, OR toggle `playing` to retrigger |
| `source.playing = true/false` | `AudioSource.getMutable(e).playing = true/false` |
| `source.volume` | Field on `AudioSource` |
| `source.loop` | Field on `AudioSource` |
| Streaming via `AudioStream` (URL) | `AudioStream.create(e, { url, playing, volume })` |

See [[audio-video]].

## Timers / delays

SDK6 scenes commonly used `Delay` / `ExpireIn` / `Interval` from the community `decentraland-ecs-utils` library (later renamed `@dcl-sdk/utils`) for one-shot delays and repeating callbacks. Many scenes also created a dedicated "timer entity" just to host the `Delay` component.

**SDK7 ships an engine-bound `timers` object on `@dcl/sdk/ecs`.** Use it for all delays and intervals in a Decentraland scene:

```ts
import { timers } from '@dcl/sdk/ecs'

timers.setTimeout(callback: () => void, ms: number): number
timers.clearTimeout(timerId: number): void
timers.setInterval(callback: () => void, ms: number): number
timers.clearInterval(timerId: number): void
```

```typescript
// SDK6 (community Utils library)
import * as utils from '@dcl/ecs-scene-utils' // or 'decentraland-ecs-utils' / '@dcl-sdk/utils'

const timerEntity = new Entity()
engine.addEntity(timerEntity)
timerEntity.addComponent(new utils.Delay(2000, () => {
  // fires once, 2 seconds later
}))

// SDK7 — no entity needed
import { timers } from '@dcl/sdk/ecs'

const id = timers.setTimeout(() => {
  // fires once, 2 seconds later
}, 2000)
// timers.clearTimeout(id) to cancel
```

| SDK6 (community Utils library)                                  | SDK7 (`timers` from `@dcl/sdk/ecs`)                                                     |
|-----------------------------------------------------------------|-----------------------------------------------------------------------------------------|
| `import * as utils from '@dcl/ecs-scene-utils'` (or `decentraland-ecs-utils` / `@dcl-sdk/utils`) | `import { timers } from '@dcl/sdk/ecs'`                              |
| `entity.addComponent(new utils.Delay(ms, cb))`                  | `timers.setTimeout(cb, ms)` — **note argument order flip**: `(callback, ms)`, NOT `(ms, callback)` |
| `entity.addComponent(new utils.ExpireIn(ms))` (removes entity)  | `timers.setTimeout(() => engine.removeEntity(entity), ms)`                              |
| `entity.addComponent(new utils.Interval(ms, cb))`               | `timers.setInterval(cb, ms)` — same `(callback, ms)` order                              |
| "Timer entity" created just to host a `Delay` component         | Delete the entity entirely — `timers.setTimeout` doesn't need an entity                 |
| Custom per-frame `timerSystem` that accumulates `dt` to fire delayed callbacks | Delete the system — use `timers.setTimeout` / `timers.setInterval` directly      |

**Critical migration rule — argument order**: SDK6 `Delay(ms, cb)` puts the duration first; JS-standard `timers.setTimeout(cb, ms)` puts the callback first. Do NOT write a custom `setSceneTimeout(ms, cb)` helper that preserves the SDK6 order — it's a known footgun.

**Do NOT use the native JS `setTimeout` / `setInterval` globals.** The QuickJS runtime exposes them (declared as globals in `@dcl/js-runtime/index.d.ts`), and they may appear to work, but they are not bound to the scene engine and can introduce subtle problems. Always go through the `timers` named export. For a custom engine instance, use `createTimers(engineInstance)` to get an engine-scoped `Timers` object.

See [[scene-runtime]] (Timers section) for the full reference.

## UI

SDK6 UI used `UICanvas`, `UIImage`, `UIText`, `UIClickable`, etc. — all created as component instances and added to a canvas entity. **SDK7 UI is React-ECS (JSX)** and is structurally different.

```typescript
// SDK7 — completely different paradigm
import ReactEcs from '@dcl/sdk/react-ecs'
import { ReactEcsRenderer, UiEntity, Label } from '@dcl/sdk/react-ecs'

const Hud = () => (
  <UiEntity uiTransform={{ width: 200, height: 50 }}>
    <Label value="Hello" fontSize={18} />
  </UiEntity>
)

// Always pass a virtual canvas size — see "UI sizing" below
ReactEcsRenderer.setUiRenderer(Hud, { virtualWidth: 1920, virtualHeight: 1080 })
```

UI migrations almost always need a from-scratch rewrite. See [[build-ui]].

### UI sizing — virtual canvas (critical for ports)

| SDK6 | SDK7 |
|------|------|
| UI sizes/positions are raw pixels against a **fixed** screen size (e.g. `width = 200`, `positionX = -350`) | UI lays out in raw screen pixels too, **but the real screen size varies per user** — so absolute pixel layouts drift between displays |
| No virtual canvas concept | `ReactEcsRenderer.setUiRenderer(ui, { virtualWidth, virtualHeight })` defines a virtual coordinate space; the engine scales it to the real screen |

Without `virtualWidth` / `virtualHeight`, the engine lays out in raw screen pixels and an SDK6 UI ported verbatim will render at a different relative size on every machine. **Setting a virtual canvas makes existing SDK6 pixel values behave as coordinates inside that virtual space**, so layouts scale predictably.

```ts
ReactEcsRenderer.setUiRenderer(uiRoot, { virtualWidth: 1920, virtualHeight: 1080 })
```

Picking the right size:

- Open the SDK6 source (the legacy ECS reference is https://github.com/decentraland/ecs) and read the `UICanvas`/`UIImage`/`UIText` setup to see what pixel grid the original UI was authored against.
- Pass those numbers as `virtualWidth` / `virtualHeight`. `1920x1080` is a reasonable default and matches what most community examples assume, but if the SDK6 scene targeted a different resolution (e.g. `1280x720`), use those instead so existing pixel coordinates land in the same place.
- Only one `setUiRenderer` call per scene — pass the virtual size there, not on individual elements. See [[build-ui]] for the full default-rule guidance.

Signature reference (verified against [[build-ui]] skill docs):

```ts
ReactEcsRenderer.setUiRenderer(ui: UiComponent, options?: UiRendererOptions): void
type UiRendererOptions = { virtualWidth: number; virtualHeight: number }
```

## Logging

| SDK6 | SDK7 |
|------|------|
| `log('hello', x)` | `console.log('hello', x)` |
| `log(obj)` | `console.log(obj)` — note that complex objects may serialize differently |

## Missing or renamed concepts

- **`Vector2`** as a math type: not exported from `@dcl/sdk/math`. Use plain `{ x: number; y: number }` objects or flatten into two scalars in component schemas.
- **`@Component` decorator**: gone. Replaced by `engine.defineComponent('name', schema, defaults)`.
- **`ISystem` interface**: gone. Systems are plain functions.
- **`Entity.alive`**: gone. Use `Component.has(entity)` or your own bookkeeping.
- **`Entity.children`** / `Entity.parent` traversal: not directly available. To find children, iterate `engine.getEntitiesWith(Transform)` and check `transform.parent === myEntity`.
- **`engine.entities`** array: not exposed. Use `engine.getEntitiesWith(Component)` queries instead.

## Verification notes

The mappings above are derived from:
- Decentraland SDK7 components reference (`sdk-scenes/references/components-reference.md`)
- The Migrated-2048 example scene (verified working SDK7 port of an SDK6 scene)
- Cross-checked against [[add-interactivity]], [[animations-tweens]], [[add-3d-models]], [[advanced-input]] skill documents

Items marked `[UNVERIFIED]` were not directly confirmed from the SDK source and should be re-checked before being used as-is.
