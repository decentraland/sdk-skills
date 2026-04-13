# Entity Validation Rules

Rules for validating entity component combinations. Apply to any entity in the scene — whether defined in a `main.composite` file or created at runtime via TypeScript code. Organized by severity.

---

## Tier 1 — Critical (prevent runtime breakage)

### Rule 1: `pointer-events-requires-collider`

**If** an entity has `PointerEvents` **or** a trigger of type `on_input_action`/`on_click`, **then** it must have:

- `MeshCollider` with `collisionMask` that includes `CL_POINTER` (bit 1, value ≥ 1), **or**
- `GltfContainer` with `visibleMeshesCollisionMask` or `invisibleMeshesCollisionMask` that includes `CL_POINTER` (bit 1)

Without a pointer-enabled collider, pointer events are silently ignored at runtime — clicks register nothing.

### Rule 2: `invisible-collider-requires-gltf-or-mesh`

**If** an entity has `VisibilityComponent` with `visible: false` and is intended to act as a collider, **then** it must have:

- `GltfContainer` with `visibleMeshesCollisionMask > 0` or `invisibleMeshesCollisionMask > 0`, **or**
- `MeshCollider` with `collisionMask > 0`

Practical variant: if an entity has `VisibilityComponent(visible: false)` + `GltfContainer`, the GltfContainer must have at least one collision mask > 0. Otherwise the entity has no effect at runtime.

This catches broken invisible walls, cylinders, domes, ramps, and spheres that appear correct in the editor but provide no collision in-world.

### Rule 3: `trigger-action-references-must-resolve`

**If** a trigger references an action by name (e.g. `name: "Sit Here"`), **then**:

- The entity must have an `Actions` component
- That component must contain an action with the referenced name

For `{self}` references, validate within the same entity. For cross-entity references, validate only that the format is correct (the target entity may not be in scope).

---

## Tier 2 — High value (prevent subtle errors)

### Rule 4: `animator-requires-gltf`

**If** an entity has `Animator`, **then** it must have `GltfContainer`. Animation clips live inside the GLTF model — an Animator without a GLTF has no clips to play.

### Rule 5: `video-player-requires-display`

**If** an entity has `VideoPlayer`, **then** it must have:

- `GltfNodeModifiers` or `Material` (to bind the VideoTexture), **and**
- `GltfContainer` or `MeshRenderer` (a surface to render on)

A VideoPlayer with no display surface plays audio only (and silently if muted).

### Rule 6: `states-referenced-in-triggers`

**If** an entity has `States`, **then** at least one trigger or action must reference those states (via `set_state`, `when_state_is`, etc.).

Unreferenced states are dead code and indicate a misconfigured interaction.

### Rule 7: `tween-requires-transform`

**If** an entity has `Tween` or `TweenSequence`, **then** it must have `Transform`. Tweens animate transform properties — without a Transform the tween has nothing to operate on.

### Rule 8: `light-source-requires-transform`

**If** an entity has `LightSource`, **then** it must have `Transform`. The Transform determines where in the scene the light is positioned.

### Rule 9: `avatar-attach-requires-transform`

**If** an entity has `AvatarAttach`, **then** it must have `Transform`. The Transform defines the offset and orientation of the attachment relative to the avatar bone.

### Rule 10: `virtual-camera-requires-transform`

**If** an entity has `VirtualCamera`, **then** it must have `Transform`. The Transform sets the camera's position and facing direction in the scene.

---

## Tier 3 — Nice to have (quality and consistency)

### Rule 11: `asset-files-exist`

All paths referenced in components (`src` of `GltfContainer`, `audioClipUrl` of `AudioSource`, etc.) must correspond to files that exist in the project. Paths with `{assetPath}` resolve relative to the asset's directory.

### Rule 12: `actions-component-has-unique-names`

Within an `Actions` component, all `name` values must be unique. Duplicate names cause only the first matching action to execute — subsequent actions with the same name are silently skipped.

### Rule 13: `placeholder-no-runtime-collision-needed`

**If** an entity has `Placeholder` (editor-only component), **then** it must NOT have `PointerEvents` without a `MeshCollider`. A Placeholder does not generate any collider at runtime, so PointerEvents cannot function without an explicit MeshCollider.

### Rule 14: `trigger-conditions-reference-valid-components`

**If** a trigger has conditions of type `when_state_is` or `when_counter_equals`, **then** the referenced entity must have `States` or `Counter` respectively. Missing these components means the condition can never evaluate.

### Rule 15: `text-shape-mutually-exclusive`

**If** an entity has `TextShape`, **then** it must NOT have `MeshRenderer` or `GltfContainer`. These are mutually exclusive rendering components — only one shape renderer per entity is valid per the SDK.
