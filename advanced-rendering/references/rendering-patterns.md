# Advanced Rendering — Patterns

Branch-specific and long code examples split out of `advanced-rendering/SKILL.md` for progressive disclosure. Each block below is relocated verbatim and referenced by a pointer in that file.

## Floating Label (Billboard + TextShape)

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

## LOD via VisibilityComponent

```typescript
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

## GltfNodeModifiers — Whole-Model Material Override

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

## Texture Tweens

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

