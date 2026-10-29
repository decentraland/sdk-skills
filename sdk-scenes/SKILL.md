---
name: sdk-scenes
description: "Build, extend or deploy a Decentraland SDK7 scene. Load it first for any scene task: when to confirm with the user (parcel changes, asset downloads, the Multiplayer Server, a scene open in the Creator Hub, Blender MCP fallback, SDK bug reports), the composite-first rule, and the index of which topic skill to load."
---

# Decentraland SDK7 Scene Development

> **Runtime constraint:** Decentraland runs in a QuickJS sandbox. No Node.js APIs (`fs`, `http`, `path`, `process`). Use `executeTask()` + `fetch()` for async work.

## Agent Behavioral Guidelines

Before taking any significant action, check whether it falls into one of the categories below and **confirm with the user first**.

**How to ask:** Phrase the question in plain, non-technical language that describes _what will happen to the scene_, not the underlying command.

> Good: _"Should I download this tree model into your scene assets?"_
> Bad: _"Run `curl https://… -o assets/Models/tree.glb`?"_

### 1. Changing parcel count or layout

Any modification to `scene.parcels` in scene.json changes the scene's coordinate space. Entities near the current boundary may end up outside (invisible) or inside the wrong parcel. The user may also have a deployment slot in mind and parcel count needs to match it. Describe the change and its effect before acting:

> "To fit the scene you described, I'd need to expand from 1 parcel (16×16 m) to a 2×1 layout (32×16 m). This changes the coordinate bounds for every entity. Should I go ahead?"

The rule is to **ask**, not to avoid the change. When the design needs more space than the parcels give, put the question to the user. Don't add parcels silently, and don't shrink the design to fit so you can skip the question. (2026-10: an agent stacked three escape rooms vertically in one parcel instead of asking; the owner: "How come you didn't realize you need to assign more parcels??")

### 2. Fetching assets from external sources

Downloading any file not already in the project — 3D models (.glb), images, audio, video. The user may have their own assets in mind, may not want new files added, or may be targeting a specific visual style. Confirm before downloading:

> "I'd like to download a [description] model from [source] and add it to your scene. Should I go ahead?"

For a font, also check that its licence allows redistributing it with the scene (**fonts**).

For streaming references (`AudioStream`, `VideoPlayer`): these don't download files but do add an external URL dependency. Confirm if the URL wasn't provided by the user:

> "I'd set up a video stream from [source]. Is that the one you want to use?"

### 3. Adding a Multiplayer Server

Introduces `isServer()`, `registerMessages()`, `Storage`, `EnvVar`, or switches to `@dcl/sdk@auth-server`. This feature requires switching to an alternative SDK branch (`@dcl/sdk@auth-server`). Many users who want "multiplayer" only need the simpler `multiplayer-sync` skill (no server). Confirm before implementing:

> "To handle multiplayer this way I'd need to add the Multiplayer Server — that requires switching to the `@dcl/sdk@auth-server` SDK branch instead of the standard one. Is that what you're after, or would simpler peer-to-peer sync work for your use case?"

### 4. Falling back from the Blender MCP to headless Blender

If `mcp__blender__*` tools exist in the session but aren't connected (Blender isn't running, add-on disabled), **never silently switch to headless Blender CLI** — ask first:

> "The Blender MCP is set up but Blender isn't running. Want to open Blender so I can work in it live — you'd see the model as it's built and could edit alongside me — or should I do this headless instead?"

The MCP is what makes model work collaborative; a silent fallback removes that choice. If the MCP isn't installed at all, don't ask the user to install it — go headless and just mention the MCP as an option in your report. Full rule in **add-3d-models**.

### 5. Building static geometry in code because the scene is open in the Creator Hub

When walls, floors, furniture or props need to go into the scene, the Creator Hub MCP is not in the session (no `mcp__creator-hub__*` tools), and the scene **is or may be open in the Creator Hub**, **stop and let the user choose** — never fall back to `engine.addEntity()` in `src/` on your own. Signs the scene is open or Hub-managed:

- `pgrep -fl 'sdk-commands start'` lists `sdk-commands start … --data-layer` with the scene folder in its path — the strong signal. A `tsc … --watch` on the scene folder is a hint only (a plain preview runs one too).
- `.editor/project.json` exists, or `assets/scene/main.composite` contains `inspector::*` components — the Hub has opened the scene at least once.

Ask:

> "Your scene is open in the Creator Hub, so I can't safely add the room to the scene file — the editor would overwrite my changes. Three ways forward: (1) close the scene in the Creator Hub and I'll add everything to the scene file; (2) turn on Settings > AI > *Expose AI assistant MCP server* and connect me, so I place everything live in the editor; or (3) I build the room in code — it shows in the preview but not in the editor, so you can't select or move any of it there. Which do you prefer?"

Option 3 is legitimate only as the user's explicit choice. Building static entities in `src/` without that decision is never acceptable — not as a greybox, a prototype or a "temporary" stand-in, and not because the session is non-interactive or autonomous (put the question in your final message). Do all the work that does not depend on the answer first (scripts, behaviour, asset files), then stop with the question. (2026-10-23: an agent refused to hand-edit the composite of an open scene, then built the whole room, a chair and ~60 props in code and mentioned it only in its summary; the creator: "NEVER do this without a warning … the user decides what to do.") This is the canonical statement; **composites** and **creator-hub-mcp** point here.

### 6. Reporting an SDK bug before working around it

When the SDK, the Explorer, or the Creator Hub doesn't behave as documented, or lacks something the scene needs, and you're about to work around it, report it first with the **report-sdk-issue** skill. The first time this happens in a scene, ask the user whether SDK issue reports may be sent. After that, report without asking, or never, depending on their answer. Tell the user in one line when a report goes out. Reporting never blocks the work.

Before calling anything a platform limitation, check in this order: the owning topic skill, the installed typings under `node_modules/@dcl/ecs`, a minimal reproduction, the running client and SDK versions, and known fixes in the Explorer and SDK changelogs **matched to the running version** — an older source checkout proves nothing about the client in front of you (a session ruled out audio volume fades from an August checkout after the fix had already shipped). Distinguish scene error, engine defect and unsupported capability before designing an architectural workaround. Failing to recall an API is not evidence it is missing (`GltfNodeModifiers` in **advanced-rendering** changes GLB materials at runtime; number-key actions are `IA_ACTION_3`–`IA_ACTION_6` in **advanced-input** — read the enum, never infer members).

### 7. Working without a runtime view

If the `explorer` MCP server is not connected (ConnectionRefused, or no `explorer_*` / `mcp__explorer__*` tools), say so once and offer to set it up per **unity-explorer-mcp** — a refused connection only means the Explorer is not running. Until then, label every visual claim as unverified ("should now fit the bezel — not seen") and never report a visual fix as done on the strength of the code alone. Two sessions on one scene (2026-10) shipped every visual defect to the owner this way.

When the Explorer MCP is **connected**, verify every change in-world before you report it done. Don't wait for the user to ask. "Unverified in-world" is not a finished state when you could have verified it. If the MCP was set up before but the Explorer isn't running, offer to launch it, going through **unity-explorer-mcp**'s gates. Don't launch it unasked.

### General principle

These aren't things the agent should refuse to do — they're things it should communicate about before doing them. If the user confirms, proceed confidently. The goal is transparency, not gatekeeping.

---

## CRITICAL RULE — Composite-first scene authoring

All static entities (models, primitive walls and floors, lights, spawn points) MUST be defined in `assets/scene/main.composite`, NOT created in TypeScript via `engine.addEntity()`. In a scene open in the Creator Hub the way to put them there is the MCP (**creator-hub-mcp**); a room built in `src/` renders in the preview but is invisible and unselectable in the editor's viewport and entity tree. Scene open and no MCP: Agent Behavioral Guidelines, item 5.

| `main.composite` | TypeScript (`src/`) |
|---|---|
| Every entity present at scene load: models, lights, primitives, text, audio | Dynamic behavior: systems, event handlers, state changes, UI |
| Static and decorative objects, and anything the creator should see and edit in the Creator Hub | Entities spawned or despawned at runtime (projectiles, clones, NPCs that appear on demand), whose count depends on runtime state, or whose identity/structure cannot be known at author time |
| Entities that get behavior later | Fetching those entities by name or tag (`getEntityOrNullByName`, `getEntitiesByTag`) inside `main()` or later, never re-creating them; patterns: `{baseDir}/../composites/composite-reference.md` → Referencing Composite Entities from Code |

Composite entities load faster, are editable in the Creator Hub, and keep the code focused on logic.

## CRITICAL RULE — Editing an existing composite

**If the Creator Hub MCP is available, use it — never hand-edit the file**, and that includes `scene.json` (`set_scene_settings`, except `spawnPoints` and `thumbnail`: write those with `set_component` on entity `0`, see **creator-hub-mcp**). Its tools edit the open scene live, with autosave, undo and the editor bookkeeping handled for you; tool list, connection and the decision ladder are in **creator-hub-mcp**. Editing the file while the scene is open in the Creator Hub loses your work silently, with no error: the inspector autosaves about 100 ms after any editor transaction and regenerates the whole `main.composite` from its in-memory engine, overwriting the file wholesale — it never re-reads it from disk (mechanism: `{baseDir}/../composites/composite-reference.md` → Editing an existing composite (edit mode)).

Only when the MCP is not available (no Creator Hub in play, or the user declines to connect it) fall back to editing `assets/scene/main.composite` directly, and then:

- **The scene must NOT be open in the Creator Hub while you edit the file.** Ask the user to close the scene first, then reopen it when you are done; until then, item 5 applies.
- Scan the file for `inspector::Nodes`. If present, the user has opened the scene in the Creator Hub at least once and the file is in **edit mode**: every new entity you add MUST be registered in `inspector::Nodes`, or it will render in-world but be **invisible and un-selectable in the Creator Hub entity tree**. See the "Editing an existing composite (edit mode)" section of `{baseDir}/../composites/composite-reference.md` for the exact procedure.

---

## Individual Skills

Load the topic skill that matches the request; for requests spanning several topics, load each.

### Scene Setup & Configuration

**Skill: `create-scene`** — Scaffolding a new project, and editing `scene.json` (parcels, spawn points, permissions, tags, feature toggles). Field reference: `{baseDir}/../create-scene/references/scene-json.md`.

### Composite File Format

**Skill: `composites`** — The `.composite` JSON format for static scene entities; hand-editing `main.composite` when the Creator Hub MCP is not available (check item 5 and the CRITICAL RULES above first).

### 3D Models

**Skill: `add-3d-models`** — Loading `.glb`/`.gltf` with `GltfContainer`, positioning, colliders, and browsing the free asset catalogs (8,800+ OpenDCL models plus the Creator Hub asset packs). Also authoring and editing custom models by driving Blender (headless CLI or Blender MCP).

### Animations & Tweens

**Skill: `animations-tweens`** — GLTF animation clips with `Animator`, programmatic `Tween` and `TweenSequence`, easing functions.

### Materials & Rendering

**Skill: `advanced-rendering`** — PBR materials, `TextShape`, `Billboard`, `VisibilityComponent`, texture modes.

### Lighting & Environment

**Skill: `lighting-environment`** — Point/spot lights, shadows, `SkyboxTime` (day/night cycle), emissive materials.

### Particle Systems

**Skill: `particle-system`** — `ParticleSystem` component for fire, smoke, sparks, snow, rain, magic, fireworks. Emitter shapes (Point/Sphere/Cone/Box), continuous rate vs Burst emission, gravity, sprite-sheet animation, blend modes.

### Click & Proximity Interactivity

**Skill: `add-interactivity`** — `pointerEventsSystem`, trigger areas, raycasting. For polling-based input see `advanced-input`.

### Advanced Input & Movement Control

**Skill: `advanced-input`** — `inputSystem` polling, WASD-controlled entities, `InputModifier`, `PointerLock`, `PrimaryPointerInfo`, `TouchScreenControls` (mobile on-screen joystick/crosshair/buttons).

### Player & Avatar

**Skill: `player-avatar`** — Player position/profile, emotes, wearables, `AvatarAttach`, `AvatarNametag`, `AvatarModifierArea`.

### Avatar Animations (Custom Emotes)

**Skill: `avatar-animations`** — Authoring custom avatar animations in Blender on the official Decentraland rig: rig controls, posing rules, export to `*_emote.glb`, GLB verification, and upper-body (masked) clips.

### NPCs

**Skill: `npcs`** — `AvatarShape` NPCs and the NPC Toolkit library for GLB-based NPCs with dialogue and state machines.

### Player Physics

**Skill: `player-physics`** — Impulse forces, knockback, repulsion fields.

### Camera

**Skill: `camera-control`** — Camera state, `CameraModeArea`, `VirtualCamera` for cinematic shots.

### Fonts

**Skill: `fonts`** — Built-in faces (`font`) and custom `.ttf` fonts shipped with the scene (`fontSrc`) on `TextShape` and all UI text. Explorer support matrix, no support on mobile, limits, licensing, and why the desktop client shows custom fonts only from asset bundles.

### Screen-Space UI

**Skill: `build-ui`** — React ECS components for 2D screen-space UI overlays: layout, text, images, buttons, inputs, sliders. By default writes UI the Creator Hub's 2D UI editor (UI Designer) can read and edit — the `src/ui/` file-per-component layout, the `state`/`props` binding surface, `useInteraction` style layers, `@ui-action` handlers, and the driver pattern that keeps animation outside the editor's reach — and falls back to free-form coded React-ECS only for data-driven UI the editor cannot represent. Also covers adapting an existing coded UI for the editor.

### Player Feedback & Playtesting

**Skill: `scene-feedback`** — Help the creator choose a playtest focus, review adapted questions and timing, then integrate gameplay questions or a player-opened form. Also use to retrieve and analyze existing Scene Feedback CSV responses from World scene Storage.

### Audio & Video

**Skill: `audio-video`** — `AudioSource`, `AudioStream`, `VideoPlayer`, media permissions.

### Audio Analysis (Reactive Visualizers)

**Skill: `audio-analysis`** — `AudioAnalysis` component for real-time amplitude + 8-band frequency data from any `AudioSource`/`AudioStream`/`VideoPlayer`. Drive scale, color, lights, and particles from music. Desktop: all three sources. Mobile: `AudioSource` only (`AudioStream`/`VideoPlayer` read 0; band values differ by a constant factor). Bevy leaves the values at 0.

### Blockchain & NFTs

**Skill: `nft-blockchain`** — `NftShape`, wallet checks, token gating, signed requests, smart contracts.

### Multiplayer (CRDT, no server)

**Skill: `multiplayer-sync`** — `syncEntity` for peer-to-peer sync, `MessageBus`, parent-child sync.

### Multiplayer Server

**Skill: `authoritative-server`** — Headless server, `isServer()`, `registerMessages()`, `Storage`, `EnvVar`. Requires `@dcl/sdk@auth-server`.

### Script Components (Creator Hub)

**Skill: `script-components`** — Writing `.ts` script files for the Creator Hub Script component, constructor parameters, `@action` JSDoc tags (never decorator syntax).

### Creator Hub MCP (live scene editing)

**Skill: `creator-hub-mcp`** — Editing the scene open in the Creator Hub through its MCP server (preferred over editing `main.composite`), placing catalog items and custom models, and connecting an external agent to it.

### Testing in the Explorer (MCP)

**Skill: `unity-explorer-mcp`** — Launch a Decentraland Explorer and drive it over MCP to see, walk, click, screenshot and debug the scene in-world: camera and player movement, logs, performance stats. Inside the Creator Hub the same tools arrive through the Creator Hub MCP's `launch_preview` / `explorer_*`. Also the answer when the `explorer` MCP server reports ConnectionRefused at session start, or was never set up: either just means the Explorer is not running yet.

### Async, HTTP, WebSocket, Timers

**Skill: `scene-runtime`** — `executeTask`, `fetch`, `signedFetch`, WebSocket, timers, realm/scene info, restricted actions.

### Scene Optimization

**Skill: `optimize-scene`** — Scene limits, object pooling, LOD, texture optimization, system throttling.

### Game Design

**Skill: `game-design`** — DCL design philosophy, state management, UX guidelines, game loop archetypes, MVP planning.

### Deployment

- **Skill: `deploy-scene`** — Genesis City (LAND) deployment with `npx @dcl/sdk-commands deploy`: pre-deploy checklist, thumbnail spec, `.dclignore`, post-publish conversion, troubleshooting.
- **Skill: `deploy-worlds`** — Personal Worlds, `worldConfiguration`, ENS/DCL NAME requirements.

### Wearables & Smart Wearables

**Skill: `smart-wearables`** — Wearables that run SDK7 code while equipped (portable experiences): project layout, the Builder's strict `wearable.json` schema, the 3 MB uncompressed limit, how the preview differs from the published wearable, what other players can see (emote props and bone particles, not scene entities or sound), multiplayer limits (no `MessageBus` or Multiplayer Server; third-party server only), and pack/upload.

**Skill: `wearables`** — Making wearable files: official base meshes (male/female), category triangle/material/texture limits, skinning and rigid parts, texturing, glTF export and verification, thumbnail, representations per body shape, Builder upload.

### Reporting SDK Issues

**Skill: `report-sdk-issue`** — Report SDK, engine, or Explorer bugs and limitations to the Decentraland team before working around them. Asks for consent once per scene, keeps a local ignored ledger so nothing is sent twice, and queues reports when offline.

### Scene Retrospectives

**Skill: `scene-retro`** — When the user asks for a retro, retrospective or post-mortem of a scene or game ("make a retro report based on this game"), review the session history and turn real mistakes, failed first attempts and owner corrections into evidence-backed improvements to these skills. Read-only: saves a report and changes nothing else.

### SDK6 → SDK7 Migration

**Skill: `migrate-sdk6-to-sdk7`** — Port legacy `decentraland-ecs` scenes to SDK7. Conceptual ECS shift (entities as IDs, data-only components, mutable/immutable access), full API mapping (`new Entity()` → `engine.addEntity()`, `GLTFShape` → `GltfContainer`, `OnPointerDown` → `pointerEventsSystem`, `ISystem` classes → free functions, `Input.instance` → `inputSystem`, etc.), and an annotated before/after example.

---

## Terminology — deprecated tool names

Older names still circulate in tutorials, forum posts, and model-generated answers. Do not offer these to users, and translate them when a user says one:

| Deprecated name | What it was | Say / use instead |
|---|---|---|
| **Web Editor** | browser-based scene editor | the **Creator Hub** |
| **Decentraland Editor** | a Visual Studio Code extension | the **Creator Hub** |
| **SDK6** | the previous SDK; its code does not run on current Decentraland | **SDK7** (to port an old scene, see the `migrate-sdk6-to-sdk7` skill) |
| **`dclcontext` folder** | downloaded AI context files inside scene projects | **SDK Skills** (these skills) |

Current names: Creator Hub, Scene Editor, SDK7, SDK Skills.

## Shared References

These reference files are used across multiple skills. Load them when you need detailed component APIs, validation rules, or asset catalogs.

### Components Reference

**Reference: `{baseDir}/references/components-reference.md`**
Quick-reference of key fields, types, and defaults for the SDK7 components you'll commonly use. For a component's complete field list, consult its dedicated skill or the SDK typings.

### Entity Validation Rules

**Reference: `{baseDir}/../create-scene/references/entity-validation-rules.md`**
Rules for validating entity component combinations — which components require each other, mutual exclusions, and common misconfigurations. Apply to both composite and TypeScript entities.

### Free Asset Catalogs

- **3D Models (8,800+ models):** `{baseDir}/../add-3d-models/references/model-catalog.md` — grep it by keyword, never read it whole; optimized 3D models with descriptions, dimensions, animations, and download URLs
- **Creator Hub asset packs (420 models + 7 Smart Items, latest additions):** `{baseDir}/../add-3d-models/references/asset-pack-catalog.md` — Genesis City buildings/street/furniture/nature, Halloween, sci-fi lab kit, scripted buttons/doors/platform/water; multi-file download helper in `model-patterns.md`
- **Avatar animations (32 built-in emotes + 45 downloadable clips):** `{baseDir}/../avatar-animations/references/animation-catalog.md` — check before authoring any emote
- **Audio (50 sounds):** `{baseDir}/../audio-video/references/audio-catalog.md` — Music, Ambient, SFX, Game Mechanics, UI sounds

### Mobile Parity

**Reference: `{baseDir}/references/mobile-parity.md`**
What the mobile app does not support or does differently (TweenSequence, Draco, AvatarNametag, custom fonts, colliders, movement). Read it before designing anything a mobile player depends on.

### Composites

**Reference: `{baseDir}/../composites/composite-reference.md`**
The `.composite` JSON format for declaring initial scene entities. Includes `getEntityOrNullByName` and `getEntitiesByTag` patterns for fetching composite entities in TypeScript.

### Library References

- **NPC Toolkit:** `{baseDir}/../npcs/references/npc-library.mdc` — GLB-based NPCs with dialogue, movement, state machines
- **Blockchain/NFT patterns:** `{baseDir}/../nft-blockchain/references/blockchain-patterns.md` — NFT display, wallet checks, MANA operations, currency/NFT transactions, marketplace integration (dcl-crypto-toolkit)

---

## How to use

1. Identify the topic from the user's request
2. Load the corresponding skill — it contains the full API, code patterns, and rules
3. For broad requests spanning multiple topics, load each relevant skill
4. For asset discovery, read the relevant catalog's header first (the animation catalog's holds the `triggerEmote` vs `triggerSceneEmote` split and the emote permission), then grep the model and asset-pack catalogs by keyword rather than reading them whole (the model catalog is ~5,800 lines); suggest specific assets before fetching any
