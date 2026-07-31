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
| **GltfNodeModifiers** | `modifiers: Array<{ path: string, castShadows?: boolean, material?: PBMaterial }>` | Override the material and/or shadow-casting of specific nodes inside a loaded GLTF, addressed by hierarchy `path`. |
| **Billboard** | `billboardMode: BillboardMode`, `targetEntity?: Entity` | Makes entity face the camera (default) or, when `targetEntity` is set, that entity instead. Unset or `engine.CameraEntity` = faces camera. If the target is missing/deleted, reorientation freezes until it exists again. Multiplayer: camera-facing billboards are computed locally per player (each sees it facing them); a `targetEntity` billboard faces the same way for ALL players, since the target position is scene state. |
| **VisibilityComponent** | `visible: boolean` | Show/hide entity without removing it. |
| **NftShape** | `urn: string`, `style?: NftFrameType`, `color?: Color3` | Display an NFT artwork frame. The NFT is identified by `urn`. |
| **TextShape** | `text: string`, `fontSize?: number`, `textColor?: Color4`, `font?: Font`, `outlineWidth?: number`, `outlineColor?: Color3`, `shadowColor?: Color3`, `shadowBlur?: number`, `shadowOffsetX?: number`, `shadowOffsetY?: number` | Render 3D text in the scene. Give text a thin contrasting outline (`outlineWidth` ~0.1–0.2 + an `outlineColor` that contrasts the text) so it stays legible against any background. |
| **LightSource** | `type` (`{ $case: 'point' \| 'spot' }`; `innerAngle`/`outerAngle` live inside the `spot` variant), `color?`, `intensity?` (16000), `range?` (-1 = auto), `shadow?: boolean` (false) | Add point or spot lights (no directional type). Set via `LightSource.create(e, { type: LightSource.Type.Spot({ innerAngle, outerAngle }), shadow: true })`. |
| **ParticleSystem** | `rate`, `maxParticles`, `lifetime`, `gravity`, `shape`, `initialColor`, `colorOverTime`, `initialSize`, `texture`, `blendMode`, `loop`, `spriteSheet` | Emit particles (fire, smoke, sparks, snow). Many fields — see the `particle-system` skill for the full list, enums, and presets. Unity explorer only. |

## Interaction & Input

| Component | Key Fields | Description |
|-----------|-----------|-------------|
| **PointerEvents** | `pointerEvents: Array<{ eventType, eventInfo: { button, hoverText, maxDistance } }>` | Define clickable/hoverable areas. Use `pointerEventsSystem.onPointerDown()` helper. |
| **PointerEventsResult** | Read-only | Results of pointer events (which button, hit point). |
| **PointerLock** | `isPointerLocked: boolean` | Whether pointer is locked (first-person mode). |
| **PrimaryPointerInfo** | Read-only: `pointerType`, `screenCoordinates`, `screenDelta`, `worldRayDirection` | Screen coordinates and world ray of the primary pointer. It has no entity field — get the hovered/hit entity from `PointerEventsResult` or a raycast. |
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
| **AvatarBase** | `skinColor`, `eyesColor`, `hairColor`, `bodyShapeUrn`, `name` | Base avatar appearance. |
| **AvatarAttach** | `avatarId: string`, `anchorPointId` | Attach an entity to a player's avatar. |
| **AvatarModifierArea** | `area: Vector3`, `modifiers: Array<AvatarModifierType>` | Modify avatars in an area. Modifiers: `AMT_HIDE_AVATARS` (0), `AMT_DISABLE_PASSPORTS` (1), `AMT_HIDE_NAMETAGS` (2). |
| **AvatarEmoteCommand** | `emoteUrn`, `loop` | Trigger avatar emotes. |
| **AvatarEquippedData** | Read-only | Data about equipped wearables. |
| **AvatarLocomotionSettings** | `walkSpeed?`, `jogSpeed?`, `runSpeed?`, `jumpHeight?`, `runJumpHeight?`, `hardLandingCooldown?`, `doubleJumpHeight?`, `glidingSpeed?`, `glidingFallingSpeed?` | Override the player's movement speeds and jump/glide behavior (m/s and m). Apply to `engine.PlayerEntity`. All fields optional; engine defaults apply when omitted. `[UNVERIFIED: default values]` — the protocol documents no defaults; see `player-avatar/references/avatar-apis.md`. |

## Camera

| Component | Key Fields | Description |
|-----------|-----------|-------------|
| **CameraMode** | `mode: CameraType` | Read-only current camera mode. `CameraType`: `CT_FIRST_PERSON` (0), `CT_THIRD_PERSON` (1), `CT_CINEMATIC` (2 — reported while a `VirtualCamera` drives the view). |
| **CameraModeArea** | `area`, `mode` | Force camera mode in an area. |
| **MainCamera** | `virtualCameraEntity?: Entity` | Activate a `VirtualCamera` by setting this to its entity (use `MainCamera.createOrReplace(engine.CameraEntity, { virtualCameraEntity })`); clear it to return control. Read the live camera pose from `Transform.get(engine.CameraEntity)`. |
| **VirtualCamera** | `lookAtEntity?`, `defaultTransition` | Create cinematic camera angles. |

## UI Components (React-ECS)

These are the underlying ECS UI components (from `@dcl/sdk/ecs`). You normally don't set them directly — build screen-space UI with the React-ECS **JSX widgets** `UiEntity`, `Label`, `Button`, `Input`, `Dropdown` (imported from `@dcl/sdk/react-ecs`), whose props map onto these components. See the `build-ui` skill. The `onSubmit` / `onChange` below are JSX handler props on those widgets, not data fields of the underlying component.

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
| **SkyboxTime** | `fixedTime: number`, `transitionMode?: TransitionMode` | Fix the time of day (seconds since 00:00; 43200 = noon, 86400 = full day). |
| **AssetLoad** | `assets: string[]` | Pre-request loading of asset files (paths). Loading state is reported separately via `AssetLoadLoadingState`. |
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
