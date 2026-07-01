# Decentraland SDK7 Components Quick Reference

All components are imported from `@dcl/sdk/ecs`.

## Transform & Positioning

| Component | Key Fields | Description |
|-----------|-----------|-------------|
| **Transform** | `position: Vector3`, `rotation: Quaternion`, `scale: Vector3`, `parent?: Entity` | Position, rotation, and scale of an entity. Parent for hierarchy. |

## 3D Rendering

| Component | Key Fields | Description |
|-----------|-----------|-------------|
| **MeshRenderer** | Static methods: `setBox()`, `setSphere()`, `setCylinder()`, `setPlane()` | Renders primitive 3D shapes. |
| **MeshCollider** | Static methods: `setBox()`, `setSphere()`, `setCylinder()`, `setPlane()` | Adds collision geometry for physics/pointer events. |
| **Material** | Static methods: `setPbrMaterial({ albedoColor, metallic, roughness, texture })`, `setBasicMaterial()` | PBR or unlit material for meshes. |
| **GltfContainer** | `src: string`, `visibleMeshesCollisionMask?`, `invisibleMeshesCollisionMask?` | Loads a .glb/.gltf 3D model file. |
| **GltfContainerLoadingState** | `currentState` | Read-only loading state for GLTF models. |
| **GltfNodeModifiers** | `nodes: Array<{ path, visibleMeshes, invisibleMeshes }>` | Modify visibility of specific nodes in GLTF. |
| **Billboard** | `billboardMode: BillboardMode` | Makes entity always face the camera. |
| **VisibilityComponent** | `visible: boolean` | Show/hide entity without removing it. |
| **NftShape** | `src: string (urn)`, `style?` | Display an NFT artwork frame. |
| **TextShape** | `text: string`, `fontSize?: number`, `textColor?: Color4`, `font?: Font`, `outlineWidth?: number`, `outlineColor?: Color3`, `shadowColor?: Color3`, `shadowBlur?: number`, `shadowOffsetX?: number`, `shadowOffsetY?: number` | Render 3D text in the scene. Give text a thin contrasting outline (`outlineWidth` ~0.1–0.2 + an `outlineColor` that contrasts the text) so it stays legible against any background. |
| **LightSource** | `type`, `color`, `intensity`, `range`, `innerAngle`, `outerAngle`, `shadows` | Add point, spot, or directional lights. |
| **ParticleSystem** | `rate`, `maxParticles`, `lifetime`, `gravity`, `shape`, `initialColor`, `colorOverTime`, `initialSize`, `texture`, `blendMode`, `loop`, `spriteSheet` | Emit particles (fire, smoke, sparks, snow). Many fields — see the `particle-system` skill for the full list, enums, and presets. Unity explorer only. |

## Interaction & Input

| Component | Key Fields | Description |
|-----------|-----------|-------------|
| **PointerEvents** | `pointerEvents: Array<{ eventType, eventInfo: { button, hoverText, maxDistance } }>` | Define clickable/hoverable areas. Use `pointerEventsSystem.onPointerDown()` helper. |
| **PointerEventsResult** | Read-only | Results of pointer events (which button, hit point). |
| **PointerLock** | `isPointerLocked: boolean` | Whether pointer is locked (first-person mode). |
| **PrimaryPointerInfo** | Read-only | Position and entity of the primary pointer. |
| **InputModifier** | `mode` | Modify input behavior for the entity. |
| **Raycast** | `direction`, `maxDistance`, `queryType`, `continuous` | Cast rays for collision detection. |
| **RaycastResult** | Read-only | Results of a raycast (hits, distances). |
| **TriggerArea** | `mesh?: TriggerAreaMeshType` (TAMT_BOX/TAMT_SPHERE), `collisionMask?: number` (default `CL_PLAYER`) | Volume that detects entities matching the mask. Size/pose come from the entity's `Transform`. Use `TriggerArea.setBox(entity)` / `TriggerArea.setSphere(entity)` and subscribe via `triggerAreaEventsSystem.onTriggerEnter/onTriggerExit/onTriggerStay`. |
| **TriggerAreaResult** | Read-only — CRDT result component | Underlying result component for `TriggerArea`. Don't read directly — use `triggerAreaEventsSystem` callbacks (`PBTriggerAreaResult`: `triggeredEntity`, `triggeredEntityPosition`, `triggeredEntityRotation`, `eventType`, `timestamp`, nested `trigger: { entity, layers, position, rotation, scale }`). |

## Animation & Movement

| Component | Key Fields | Description |
|-----------|-----------|-------------|
| **Animator** | `states: Array<{ clip, playing, loop, speed, weight }>` | Play animations embedded in GLTF models. |
| **Tween** | `mode`, `duration`, `easingFunction`, `currentTime`, `playing?` | Animate entity properties over time. `mode` is a discriminated union: `move`, `rotate`, `scale`, `textureMove`, `moveRotateScale`, plus the endless variants `moveContinuous`, `rotateContinuous`, `textureMoveContinuous` (these loop forever — take a speed rather than a `duration`). |
| **TweenSequence** | `sequence: Array<{ ... }>`, `loop` | Chain multiple tweens together. |
| **TweenState** | Read-only | Current state of a tween. |

## Audio & Video

| Component | Key Fields | Description |
|-----------|-----------|-------------|
| **AudioSource** | `audioClipUrl: string`, `playing: boolean`, `loop: boolean`, `volume: number`, `pitch: number` | Play audio clips (.mp3, .ogg, .wav). |
| **AudioStream** | `url: string`, `playing: boolean`, `volume: number`, `spatial?: boolean`, `spatialMinDistance?: number`, `spatialMaxDistance?: number` | Stream audio from a URL. Non-spatial by default; set `spatial: true` to position it in 3D space at the entity. |
| **AudioEvent** | Read-only | Audio playback events. |
| **AudioAnalysis** | `mode: PBAudioAnalysisMode`, `amplitudeGain?`, `bandsGain?`; output: `amplitude`, `band0..band7` | Real-time amplitude + 8-band frequency data from `AudioSource`/`AudioStream`/`VideoPlayer`. Use `AudioAnalysis.createAudioAnalysis(entity)` then `readIntoView`. Unity explorer only. |
| **VideoPlayer** | `src: string`, `playing: boolean`, `loop: boolean`, `volume: number`, `playbackRate: number`, `position?: number`, `spatial?: boolean`, `spatialMinDistance?: number`, `spatialMaxDistance?: number` | Play video on a surface. Requires `Material` with video texture. `position` seeks (seconds); audio is non-spatial unless `spatial: true`. |
| **VideoEvent** | Read-only | Video playback events. |

## Player & Avatar

| Component | Key Fields | Description |
|-----------|-----------|-------------|
| **PlayerIdentityData** | `address: string`, `isGuest: boolean` | Player's wallet address and guest status. |
| **AvatarShape** | `id: string`, `name: string`, `bodyShape`, `wearables`, `emotes` | Render an avatar (for NPCs). |
| **AvatarBase** | `skinColor`, `eyeColor`, `hairColor`, `bodyShapeUrn` | Base avatar appearance. |
| **AvatarAttach** | `avatarId: string`, `anchorPointId` | Attach an entity to a player's avatar. |
| **AvatarModifierArea** | `area`, `modifiers: Array<AvatarModifierType>` | Modify avatars in an area (hide, freeze). |
| **AvatarEmoteCommand** | `emoteUrn`, `loop` | Trigger avatar emotes. |
| **AvatarEquippedData** | Read-only | Data about equipped wearables. |
| **AvatarLocomotionSettings** | `walkSpeed?` (1.5), `jogSpeed?` (8), `runSpeed?` (10), `jumpHeight?` (1), `runJumpHeight?` (1.5), `hardLandingCooldown?` (0.75) | Override the player's movement speeds and jump heights (m/s and m). Apply to `engine.PlayerEntity`. Numbers in parentheses are defaults. |

## Camera

| Component | Key Fields | Description |
|-----------|-----------|-------------|
| **CameraMode** | `mode: CameraType` | Read-only current camera mode. `CameraType`: `CT_FIRST_PERSON` (0), `CT_THIRD_PERSON` (1), `CT_CINEMATIC` (2 — reported while a `VirtualCamera` drives the view). |
| **CameraModeArea** | `area`, `mode` | Force camera mode in an area. |
| **MainCamera** | Read-only | Access main camera position/rotation. |
| **VirtualCamera** | `lookAtEntity?`, `defaultTransition` | Create cinematic camera angles. |

## UI Components (React-ECS)

Imported from `@dcl/sdk/react-ecs`:

| Component | Key Fields | Description |
|-----------|-----------|-------------|
| **UiTransform** | `width`, `height`, `positionType`, `flexDirection`, `alignItems`, `justifyContent`, `margin`, `padding`, `position` | Layout and positioning (CSS flexbox-like). |
| **UiText** | `value: string`, `fontSize`, `color`, `textAlign`, `font` | Render text in UI. |
| **UiBackground** | `color?`, `textureMode?`, `texture?` | Background color or image for UI elements. |
| **UiInput** | `placeholder`, `fontSize`, `color`, `onSubmit` | Text input field. |
| **UiInputResult** | Read-only | Input field value. |
| **UiDropdown** | `options: string[]`, `selectedIndex`, `onChange` | Dropdown selector. |
| **UiDropdownResult** | Read-only | Selected dropdown value. |
| **UiCanvasInformation** | Read-only | Screen dimensions and device pixel ratio. |

## System & Runtime

| Component | Key Fields | Description |
|-----------|-----------|-------------|
| **EngineInfo** | Read-only: `tickNumber`, `totalRuntime`, `frameNumber` | Engine timing information. |
| **RealmInfo** | Read-only: `realmName`, `networkId`, `baseUrl` | Current realm/server info. |
| **SkyboxTime** | `time` | Control the time of day (skybox). |
| **AssetLoad** | `src`, `type` | Request loading of external assets. |
| **AssetLoadLoadingState** | Read-only | Loading state of external assets. |
| **MapPin** | `position: Vector2`, `iconSize: number`, `title: string`, `description: string`, `texture?: TextureUnion` | Place a marker on the world/mini-map at parcel coordinates. |

## Physics (player forces)

Raw force components — most scenes should use the `Physics.*` helper functions (see the `player-physics` skill) rather than writing these directly.

| Component | Key Fields | Description |
|-----------|-----------|-------------|
| **PhysicsCombinedForce** | `vector: Vector3` | Continuous force applied to the player each frame. |
| **PhysicsCombinedImpulse** | `vector: Vector3`, `eventId: number` | One-shot impulse applied to the player. |

## Multiplayer / Networking (from `@dcl/sdk/network`)

Usually managed via the `syncEntity()` / `parentEntity()` helpers — see the `multiplayer-sync` skill. Rarely read directly.

| Component | Key Fields | Description |
|-----------|-----------|-------------|
| **SyncComponents** | `componentIds: number[]` | Marks which components on an entity are synced across peers. Set by `syncEntity()`. |
| **NetworkEntity** | `networkId: number`, `entityId: Entity` | Stable network identity of a synced entity. |
| **NetworkParent** | `networkId: number`, `entityId: Entity` | Network-stable parent link for synced hierarchies. Set by `parentEntity()`. |

## Core-schema (composite / editor)

Imported from `@dcl/sdk/ecs`; in a `.composite` they appear as `core-schema::Name` / `core-schema::Tags`.

| Component | Key Fields | Description |
|-----------|-----------|-------------|
| **Name** | `value: string` | Human-readable entity name. Required for `engine.getEntityOrNullByName()` lookups and for the Creator Hub entity tree. |
| **Tags** | `tags: string[]` | Group entities under shared tags; fetch with `engine.getEntitiesByTag()`. `Tags.add()` / `Tags.remove()` at runtime. |

## Math Types (from `@dcl/sdk/math`)

| Type | Factory | Description |
|------|---------|-------------|
| **Vector3** | `Vector3.create(x, y, z)`, `.Zero()`, `.One()`, `.Up()`, `.Forward()` | 3D position/direction. |
| **Quaternion** | `Quaternion.fromEulerDegrees(x, y, z)`, `.Identity()` | Rotation. |
| **Color4** | `Color4.create(r, g, b, a)`, `.Red()`, `.Blue()`, `.Green()`, `.White()`, `.Black()` | RGBA color (0-1 range). |
| **Color3** | `Color3.create(r, g, b)` | RGB color. |
