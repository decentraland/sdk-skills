---
name: advanced-rendering
description: Advanced rendering in Decentraland scenes. Billboard (face camera), TextShape (3D world text), PBR materials (metallic, roughness, transparency, emissive glow), GltfNodeModifiers (per-node shadow/material overrides), VisibilityComponent (show/hide entities), and texture modes. Use when the user wants billboards, floating labels, 3D text, material effects, glow, transparency, or model node control. Do NOT use for screen-space UI (see build-ui) or loading 3D models (see add-3d-models).
---

# Advanced Rendering in Decentraland

## When to Use Which Rendering Feature

| Need | Component | When |
|------|-----------|------|
| Entity faces the camera | `Billboard` | Name tags, signs, sprite-like objects |
| Text in the 3D world | `TextShape` | Labels, signs, floating text above entities |
| Custom material appearance | `Material.setPbrMaterial` | Metallic, rough, transparent, emissive surfaces |
| Show/hide without removing | `VisibilityComponent` | LOD systems, toggling objects, conditional display |
| Modify GLTF model nodes | `GltfNodeModifiers` | Override materials or shadow casting on specific mesh nodes |

**Decision flow:**
1. Need text on screen? → Use **build-ui** (React-ECS Label) instead
2. Need text in 3D space? → `TextShape` (+ `Billboard` to face camera)
3. Need glowing/transparent materials? → `Material.setPbrMaterial` with emissive/transparency
4. Need to override material on a model node? → `GltfNodeModifiers` with `modifiers` array

## Billboard (Face the Camera)

Make entities always rotate to face the player's camera:

```typescript
import { engine, Transform, Billboard, BillboardMode, MeshRenderer } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

const sign = engine.addEntity()
Transform.create(sign, { position: Vector3.create(8, 2, 8) })
MeshRenderer.setPlane(sign)

// Rotate only on Y axis (most common — stays upright)
Billboard.create(sign, {
  billboardMode: BillboardMode.BM_Y
})
```

### Billboard Modes

```typescript
BillboardMode.BM_Y      // Rotate on Y axis only (stays upright) — most common
BillboardMode.BM_ALL    // Rotate on all axes (fully faces camera)
BillboardMode.BM_X      // Rotate on X axis only
BillboardMode.BM_Z      // Rotate on Z axis only
BillboardMode.BM_NONE   // No billboard rotation
```

- Prefer `BM_Y` over `BM_ALL` for most use cases — it looks more natural and is cheaper to render.
- `BM_ALL` is useful for particles or effects that should always directly face the camera.
- **No `oppositeDirection` flag.** The SDK7 `Billboard` component exposes only `billboardMode` — there is no way to invert which model face points at the camera. If a model shows its back instead of its front, rotate the model 180° on Y (`Quaternion.fromEulerDegrees(0, 180, 0)`). On a parent-Billboard + child-model setup, apply the rotation to the **child** — the Billboard owns the parent's rotation.
- **Porting note**: SDK6 → SDK7 ports occasionally show a billboarded model facing **away** from the camera that was correct under SDK6. The two SDKs appear to disagree on which face the billboard points at the camera. Same fix — rotate the displayed model 180° on Y. See [[migrate-sdk6-to-sdk7]] (Common Pitfalls) for context.

### Face another entity — `targetEntity`

`Billboard` has an optional `targetEntity?: Entity` field. When set, the entity reorients to face **that target entity** instead of the camera.

> ⚠ **Not yet in production** (as of 2026-07-09): `targetEntity` is in the SDK and protocol but the explorer (client) support ships in an upcoming release expected around mid-July 2026. Until then, setting it has no visible effect in the deployed client — the billboard keeps facing the camera. Safe to write (backwards-compatible), but don't rely on the behavior in production yet.

```typescript
// Face a specific entity instead of the camera
Billboard.create(card, { targetEntity: sphere })

// Yaw-only tracking of a target (BM_Y respected while targeting)
Billboard.create(card, { targetEntity: target, billboardMode: BillboardMode.BM_Y })

// Retarget at runtime
Billboard.getMutable(card).targetEntity = otherEntity
```

- **Unset (default)** → faces the main camera, exactly as before. `targetEntity` is fully backwards-compatible.
- Setting `targetEntity` to the **camera reserved entity** (`engine.CameraEntity`, id `2`) is equivalent to leaving it unset.
- `billboardMode` still applies: `BM_Y` with a `targetEntity` yaws to face the target on the Y axis only.
- **Gotcha:** if the referenced target entity does not exist or is deleted, billboard reorientation is **disabled** (the entity freezes at its last orientation) until the target exists again.

## TextShape (3D Text)

Render text directly in 3D space:

```typescript
import { engine, Transform, TextShape, TextAlignMode } from '@dcl/sdk/ecs'
import { Vector3, Color4 } from '@dcl/sdk/math'

const label = engine.addEntity()
Transform.create(label, { position: Vector3.create(8, 3, 8) })

TextShape.create(label, {
  text: 'Hello World!',
  fontSize: 24,
  textColor: Color4.White(),
  outlineColor: Color4.Black(),
  outlineWidth: 0.1,
  textAlign: TextAlignMode.TAM_MIDDLE_CENTER
})
```

### Text Alignment Options

```typescript
TextAlignMode.TAM_TOP_LEFT
TextAlignMode.TAM_TOP_CENTER
TextAlignMode.TAM_TOP_RIGHT
TextAlignMode.TAM_MIDDLE_LEFT
TextAlignMode.TAM_MIDDLE_CENTER
TextAlignMode.TAM_MIDDLE_RIGHT
TextAlignMode.TAM_BOTTOM_LEFT
TextAlignMode.TAM_BOTTOM_CENTER
TextAlignMode.TAM_BOTTOM_RIGHT
```

### Floating Label (Billboard + TextShape)

Combine Billboard and TextShape to create labels that always face the player:

```typescript
const floatingLabel = engine.addEntity()
Transform.create(floatingLabel, { position: Vector3.create(8, 4, 8) })

TextShape.create(floatingLabel, {
  text: 'NPC Name',
  fontSize: 16,
  textColor: Color4.White(),
  outlineColor: Color4.Black(),
  outlineWidth: 0.08,
  textAlign: TextAlignMode.TAM_BOTTOM_CENTER
})

Billboard.create(floatingLabel, {
  billboardMode: BillboardMode.BM_Y
})
```

## Advanced PBR Materials

### Metallic and Roughness

```typescript
import { engine, Transform, MeshRenderer, Material, MaterialTransparencyMode } from '@dcl/sdk/ecs'
import { Color4, Color3 } from '@dcl/sdk/math'

// Shiny metal
Material.setPbrMaterial(entity, {
  albedoColor: Color4.create(0.8, 0.8, 0.9, 1),
  metallic: 1.0,
  roughness: 0.1
})

// Rough stone
Material.setPbrMaterial(entity, {
  albedoColor: Color4.create(0.5, 0.5, 0.5, 1),
  metallic: 0.0,
  roughness: 0.9
})
```

### Transparency

```typescript
// Alpha blend — smooth transparency
Material.setPbrMaterial(entity, {
  albedoColor: Color4.create(1, 0, 0, 0.5), // 50% transparent red
  transparencyMode: MaterialTransparencyMode.MTM_ALPHA_BLEND
})

// Alpha test — cutout (binary visible/invisible based on threshold)
Material.setPbrMaterial(entity, {
  texture: Material.Texture.Common({ src: 'assets/Images/cutout.png' }),
  transparencyMode: MaterialTransparencyMode.MTM_ALPHA_TEST,
  alphaTest: 0.5
})
```

### Emissive (Glow Effects)

```typescript
// Glowing material (emissiveColor uses Color3, not Color4)
Material.setPbrMaterial(entity, {
  albedoColor: Color4.create(0, 0, 0, 1),
  emissiveColor: Color3.create(0, 1, 0),  // Green glow
  emissiveIntensity: 2.0
})

// Emissive with texture
Material.setPbrMaterial(entity, {
  texture: Material.Texture.Common({ src: 'assets/Images/diffuse.png' }),
  emissiveTexture: Material.Texture.Common({ src: 'assets/Images/emissive.png' }),
  emissiveIntensity: 1.0,
  emissiveColor: Color3.White()
})
```

### Texture Maps

```typescript
Material.setPbrMaterial(entity, {
  texture: Material.Texture.Common({ src: 'assets/Images/diffuse.png' }),
  bumpTexture: Material.Texture.Common({ src: 'assets/Images/normal.png' }),
  emissiveTexture: Material.Texture.Common({ src: 'assets/Images/emissive.png' })
})
```

### castShadows

Both `setPbrMaterial` and `setBasicMaterial` accept `castShadows: boolean` (default `true`). Set `false` to stop a surface from casting shadows without changing its appearance:

```typescript
Material.setPbrMaterial(entity, { albedoColor: Color4.Green(), castShadows: false })
```

For disabling shadows on a specific node inside a GLTF model, use `GltfNodeModifiers` with `castShadows: false` instead (see below).

## GltfContainer Collision Masks

Use collision masks to control which collision layers respond to the different mesh layers in a GLTF model. GLTF models have two mesh layers: visible meshes (what players see rendered), and invisible layers (collider meshes, named internally with _collider):

```typescript
import { engine, Transform, GltfContainer, ColliderLayer } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

const model = engine.addEntity()
Transform.create(model, { position: Vector3.create(4, 0, 4) })

GltfContainer.create(model, {
  src: 'models/myModel.glb',
  visibleMeshesCollisionMask: ColliderLayer.CL_PHYSICS | ColliderLayer.CL_POINTER,
  invisibleMeshesCollisionMask: ColliderLayer.CL_PHYSICS
})
```

## VisibilityComponent

Show or hide entities without removing them:

```typescript
import { engine, VisibilityComponent } from '@dcl/sdk/ecs'

// Hide an entity
VisibilityComponent.create(entity, { visible: false })

// Toggle visibility
const visibility = VisibilityComponent.getMutable(entity)
visibility.visible = !visibility.visible

// Useful for LOD (Level of Detail)
function lodSystem() {
  const playerPos = Transform.get(engine.PlayerEntity).position

  for (const [entity, transform] of engine.getEntitiesWith(Transform, MeshRenderer)) {
    const distance = Vector3.distance(playerPos, transform.position)

    if (distance > 30) {
      VisibilityComponent.createOrReplace(entity, { visible: false })
    } else {
      VisibilityComponent.createOrReplace(entity, { visible: true })
    }
  }
}

engine.addSystem(lodSystem)
```

### propagateToChildren

Set `propagateToChildren: true` on a `VisibilityComponent` to apply visibility to all children in the hierarchy at once. This avoids having to mark every child entity individually:

```typescript
VisibilityComponent.create(parentEntity, { visible: false, propagateToChildren: true })
```

Rules (verified against the `1,0-visibility-comp-propagation` test scene):
- If a child has its **own** `VisibilityComponent`, that value wins regardless of what an ancestor propagates — even if the child's own `propagateToChildren` is `false`, the child stays at its own `visible` value and does not re-inherit the parent's.
- If a child has **no** `VisibilityComponent`, it inherits from the nearest ancestor with `propagateToChildren: true`.
- A child that overrides an invisible parent to `visible: true` can itself set `propagateToChildren: true` to force its own subtree visible again — propagation re-evaluates at each node that carries a `VisibilityComponent`.
- Propagation follows the live `Transform.parent` hierarchy: re-parenting an entity at runtime changes which ancestor's propagated visibility applies to it.

### Per-Node Modifiers (GltfNodeModifiers)

Override material or shadow casting on specific nodes within a GLTF model:

```typescript
import { GltfNodeModifiers } from '@dcl/sdk/ecs'

GltfNodeModifiers.create(entity, {
  modifiers: [
    {
      path: 'RootNode/Armor',     // GLTF hierarchy path
      castShadows: false           // Disable shadow casting for this node
    }
  ]
})
```

To override the materials or shadow casting of the entire model, set the path to ''.

```typescript
import { GltfNodeModifiers } from '@dcl/sdk/ecs'

GltfNodeModifiers.create(entity, {
  modifiers: [
    {
      path: '', 
      material: {
				material: {
					$case: 'pbr',
					pbr: {
						albedoColor: Color4.Red(),
					},
				},
			},
    }
  ]
})
```

**Modifier details** (from the `74,-8-gltfnodemodifier` test scene):

- `path` is the GLTF node hierarchy path, `/`-separated (e.g. `Scene_root/shark_skeleton/Sphere/Sphere.001`). `path: ''` targets the whole model; a nested path targets one node and its descendants.
- `material` accepts either `$case: 'pbr'` (full PBR: `albedoColor`, `emissiveColor`, `emissiveIntensity`, textures, …) or `$case: 'unlit'` (`diffuseColor`, …). Different nodes in the same `modifiers` array can use different cases.
- Textures work here too, including video: `pbr: { texture: Material.Texture.Video({ videoPlayerEntity: someEntityWithVideoPlayer }) }`.
- `castShadows: false` per node (no `material` needed) disables shadow casting for that node only.
- One `modifiers` array can contain many entries, each targeting a different `path` in a single call.
- **Debug trick**: passing a `path` that does not exist logs the model's full GLTF node hierarchy to the scene console — use a deliberately wrong path to discover the correct node names.
- Update with `GltfNodeModifiers.createOrReplace(entity, { modifiers: [...] })`; remove all overrides with `GltfNodeModifiers.deleteFrom(entity)`.

Node paths are engine-visible names baked into the GLB, not arbitrary — if a target node has no material of the requested kind, the override may be ignored.


### Avatar Texture

Generate a texture from a player's avatar portrait:

```typescript
Material.setPbrMaterial(portraitFrame, {
  texture: Material.Texture.Avatar({ userId: '0x...' })
})
```

This will fetch a thumbnail image with a closeup of the player's face, wearing the wearables that this player currently has on.


### Texture Modes

Control how textures are filtered and wrapped:

```typescript
import { TextureFilterMode, TextureWrapMode } from '@dcl/sdk/ecs'

Material.setPbrMaterial(entity, {
  texture: Material.Texture.Common({
    src: 'assets/Images/pixel-art.png',
    filterMode: TextureFilterMode.TFM_POINT,    // crisp pixels (no smoothing)
    wrapMode: TextureWrapMode.TWM_REPEAT        // tile the texture
  })
})
```

Filter modes: `TFM_POINT` (pixelated), `TFM_BILINEAR` (smooth), `TFM_TRILINEAR` (smoothest).
Wrap modes: `TWM_REPEAT` (tile), `TWM_CLAMP` (stretch edges), `TWM_MIRROR` (mirror tile).

## Texture tweens

You can use tweens to make a texture slide sideways or shrink or zoom in, this can be used to achieve very cool effects. Requires a `Material` with a texture whose `wrapMode` is `TWM_REPEAT`, and a `TweenSequence` component (even with an empty `sequence`) for the tween to loop.

```typescript
Material.setPbrMaterial(myEntity, {
	texture: Material.Texture.Common({
		src: 'materials/water.png',
		wrapMode: TextureWrapMode.TWM_REPEAT,
	}),
})

// move continuously — (entity, direction, speed)
Tween.setTextureMoveContinuous(myEntity, Vector2.create(0, 1), 1)
```

You can also make a texture move once, lasting a specific duration:

```typescript
// slide once, for 1 second — (entity, start, end, durationMs, movementType?, easing?)
Tween.setTextureMove(myEntity, Vector2.create(0, 0), Vector2.create(0, 1), 1000)
```

**Movement type**: both helpers take an optional `movementType: TextureMovementType` (defaults to `TMT_OFFSET`):
- `TextureMovementType.TMT_OFFSET` — pans the texture across the surface (scrolling water, conveyor belts).
- `TextureMovementType.TMT_TILING` — animates the tiling factor (zoom / density changes).

```typescript
import { TextureMovementType, TweenLoop, TweenSequence } from '@dcl/sdk/ecs'

// animate tiling from 1x to 2x over 4s, then yoyo back
Tween.setTextureMove(plane, Vector2.create(1, 1), Vector2.create(2, 2), 4000, TextureMovementType.TMT_TILING)
TweenSequence.create(plane, { sequence: [], loop: TweenLoop.TL_YOYO })
```

To loop, pair the tween with `TweenSequence.create(entity, { sequence: [], loop: TweenLoop.TL_RESTART | TL_YOYO })`.


## FlatMaterial Accessors

The `Material` component provides shortcut methods that skip the nested union structure, making material access more ergonomic:

| Method | Returns | Throws if no material? |
|---|---|---|
| `Material.getFlat(entity)` | Read-only `FlatMaterial` | Yes |
| `Material.getFlatOrNull(entity)` | Read-only `FlatMaterial \| null` | No |
| `Material.getFlatMutable(entity)` | Read/write `FlatMaterial` | Yes |
| `Material.getFlatMutableOrNull(entity)` | Read/write `FlatMaterial \| null` | No |

```typescript
// Read a property safely
const src = Material.getFlatOrNull(entity)?.texture?.src

// Mutate a texture in-place without knowing PBR vs Basic
Material.getFlatMutableOrNull(entity)!.texture = Material.Texture.Common({ src: 'assets/Images/new.png' })
```

## Best Practices

- Use `BillboardMode.BM_Y` instead of `BM_ALL` — looks more natural and renders faster
- Keep `fontSize` readable (16-32 for in-world text)
- Add `outlineColor` and `outlineWidth` to TextShape for legibility against any background
- Use `emissiveColor` with a dark `albedoColor` for maximum glow visibility
- `MTM_ALPHA_TEST` is cheaper than `MTM_ALPHA_BLEND` — use cutout when smooth transparency isn't needed
- Combine Billboard + TextShape for floating name labels above NPCs or objects
- Use VisibilityComponent for LOD systems instead of removing/re-adding entities

## Example scenes

Engine-team test scenes exercising these APIs against the real runtime:

- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/74,-8-gltfnodemodifier — `GltfNodeModifiers` overriding PBR/unlit materials, video textures, per-node colors and `castShadows` on specific GLTF nodes; `createOrReplace`/`deleteFrom`; wrong-path console-dump debug trick.
- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/1,0-visibility-comp-propagation — `VisibilityComponent` `propagateToChildren` across a parent/child/grandchild hierarchy with runtime re-parenting, covering every override combination.
- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/0,3-texture-movement — texture tweens via `Tween.setTextureMove` with `TextureMovementType.TMT_OFFSET` and `TMT_TILING`, paired with `TweenSequence` loops; also `Billboard` + `TextShape`.
- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/52,-52-testing-gallery — PBR material sweeps (metallic/roughness/emissive/normal-map) and `GltfContainer` collision-mask combinations shown side by side.
