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

The rule is to **ask**, not to avoid the change. When the design needs more space than the parcels give, put the question to the user. Don't add parcels silently, and don't shrink the design to fit so you can skip the question: owners expect to be asked.

### 2. Fetching assets from external sources

Downloading any file not already in the project — 3D models (.glb), images, audio, video. The user may have their own assets in mind, may not want new files added, or may be targeting a specific visual style. Confirm before downloading:

> "I'd like to download a [description] model from [source] and add it to your scene. Should I go ahead?"

Before proposing a download, check the free catalogs and suggest specific assets from them: models and asset packs (**add-3d-models**), sounds (**audio-video**), emotes (**avatar-animations**, read its catalog header for the `triggerEmote` vs `triggerSceneEmote` split). Grep the model and asset-pack catalogs by keyword; never read them whole (the model catalog is ~5,800 lines).

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

- `ps -ef | grep '[-]-data-layer'` (the bracket keeps grep from matching itself; Windows PowerShell: `Get-CimInstance Win32_Process | Where-Object CommandLine -match 'data-laye[r]'`) lists `sdk-commands start … --data-layer` with the scene folder in its path — the strong signal. Not `pgrep -fl`: on Linux `-l` prints only the process name, so a grep on the arguments never matches. A `tsc … --watch` on the scene folder is a hint only (a plain preview runs one too).
- A `.mcp.json` holding only a `creator-hub` entry on `http://127.0.0.1:…` — the scene is open right now and outside access is on.
- `.editor/project.json` exists, or `assets/scene/main.composite` contains `inspector::*` components — the Hub has opened the scene at least once.

**Before asking, try to connect yourself:** **creator-hub-mcp** → `reference/connect.md` → Connect. The scene's `.mcp.json` or a live `<userData>/mcp-server.json` means the server is up and only your session lacks it: register from the file (never print the token) and ask the user only for what your client cannot do itself, usually one `/mcp` reconnect or a new session. Neither file: create `<userData>/mcp-server.request` and ask the creator to click **Allow** in the Creator Hub. Do the editor work through the tools once they bind; until they do, the rule below still holds. Ask the three-option question when the creator declines access or the connection still fails.

Ask:

> "Your scene is open in the Creator Hub, so I can't safely add the room to the scene file — the editor would overwrite my changes. Three ways forward: (1) close the scene in the Creator Hub and I'll add everything to the scene file; (2) let me connect to the Creator Hub (click **Allow** when it asks, or turn on Settings > AI > *Allow other AI apps to edit your scenes*), so I place everything live in the editor; or (3) I build the room in code — it shows in the preview but not in the editor, so you can't select or move any of it there. Which do you prefer?"

Option 3 is legitimate only as the user's explicit choice. Building static entities in `src/` without that decision is never acceptable — not as a greybox, a prototype or a "temporary" stand-in, and not because the session is non-interactive or autonomous (put the question in your final message). Do all the work that does not depend on the answer first (scripts, behaviour, asset files), then stop with the question. Reporting code-built geometry in a summary after the fact is not asking. This is the canonical statement; **composites** and **creator-hub-mcp** point here.

### 6. Reporting an SDK bug before working around it

Before working around an SDK, Explorer or Creator Hub defect, or a capability the scene needs that seems missing, run **report-sdk-issue**: its step 1 holds the platform-vs-scene diagnosis order, and it handles consent and deduplication. Failing to recall an API is not evidence it is missing (`GltfNodeModifiers` in **advanced-rendering** changes GLB materials at runtime; number-key actions are `IA_ACTION_3`–`IA_ACTION_6` in **advanced-input** — read the enum, never infer members).

### 7. Working without a runtime view

If the `explorer` MCP server is not connected (ConnectionRefused, or no `explorer_*` / `mcp__explorer__*` tools), say so once and offer to set it up per **unity-explorer-mcp** — a refused connection only means the Explorer is not running. Until then, label every visual claim as unverified ("should now fit the bezel — not seen") and never report a visual fix as done on the strength of the code alone.

When the Explorer MCP is **connected**, verify every change in-world before you report it done. Don't wait for the user to ask. "Unverified in-world" is not a finished state when you could have verified it. If the MCP was set up before but the Explorer isn't running, offer to launch it, going through **unity-explorer-mcp**'s gates. Don't launch it unasked.

### 8. A feature that needs a newer SDK

Version floors in these skills (`fontSrc` 7.31.0+, `screenInset` 7.26.0+, …) name the stable `@dcl/sdk` release. A Multiplayer Server scene runs a prerelease from the `@dcl/sdk@auth-server` tag whose version string trails `latest` (a `7.32.1-<build>` today), so a numeric compare says "too old" for a build that already has the field. Before writing a floored feature, read the installed version from `node_modules/@dcl/sdk/package.json`; on an `auth-server` build decide from the installed typings instead (`grep -rl <field> node_modules/@dcl/react-ecs/dist node_modules/@dcl/ecs/dist`: no file listed means it does not exist). If the scene is too old, upgrade: a stable scene to `latest`, a Multiplayer Server scene to the newest `auth-server` build and never to `latest`, which has no server APIs (**authoritative-server** → Setup). The upgrade is the step to confirm with the user (it changes every dependency, and on a server scene the tag); the version check itself needs no confirmation. If the user does not want to upgrade, use the fallback the topic skill names. Never patch the SDK's generated types or serializers in `node_modules`; it breaks on the next install.

### General principle

These aren't things the agent should refuse to do — they're things it should communicate about before doing them. If the user confirms, proceed confidently. The goal is transparency, not gatekeeping.

---

## CRITICAL RULE — Composite-first scene authoring

All static entities (models, primitive walls and floors, lights, spawn points) MUST be defined in `assets/scene/main.composite`, NOT created in TypeScript via `engine.addEntity()`. In a scene open in the Creator Hub the way to put them there is the MCP (**creator-hub-mcp**); a room built in `src/` renders in the preview but is invisible and unselectable in the editor's viewport and entity tree. Scene open and no MCP: Agent Behavioral Guidelines, item 5.

| `main.composite` | TypeScript (`src/`) |
|---|---|
| Every entity present at scene load: models, lights, primitives, text, audio | Dynamic behavior: systems, event handlers, state changes, UI |
| Static and decorative objects, and anything the creator should see and edit in the Creator Hub | Entities spawned or despawned at runtime (projectiles, clones, NPCs that appear on demand), whose count depends on runtime state, or whose identity/structure cannot be known at author time |
| Entities that get behavior later | Fetching those entities by name or tag (`getEntityOrNullByName`, `getEntitiesByTag`) inside `main()` or later, never re-creating them; patterns: **composites** → `composite-reference.md` → Referencing Composite Entities from Code |

Composite entities load faster, are editable in the Creator Hub, and keep the code focused on logic.

## CRITICAL RULE — Editing an existing composite

**If the Creator Hub MCP is available, use it — never hand-edit the file**, and that includes `scene.json` (`set_scene_settings`, except `thumbnail`: write it with `set_component` on entity `0`, see **creator-hub-mcp**). Tools, connection and the decision ladder: **creator-hub-mcp**. A file edit made while the scene is open in the Creator Hub is lost silently: the inspector rewrites `main.composite` wholesale from memory on its next autosave and never re-reads the file (mechanism: **composites** → `composite-reference.md` → Editing an existing composite (edit mode)).

Only when the MCP is not available (no Creator Hub in play, or the user declines to connect it) fall back to editing `assets/scene/main.composite` directly, and then:

- **The scene must NOT be open in the Creator Hub while you edit the file.** Ask the user to close the scene first, then reopen it when you are done; until then, item 5 applies.
- Scan the file for `inspector::Nodes`. If present, the user has opened the scene in the Creator Hub at least once and the file is in **edit mode**: every new entity you add MUST be registered in `inspector::Nodes`, or it will render in-world but be **invisible and un-selectable in the Creator Hub entity tree**. Procedure: **composites** → `composite-reference.md` → Editing an existing composite (edit mode).

---

## Individual Skills

Load the topic skill that matches the request; for requests spanning several topics, load each.

Every skill named below ships in the same `decentraland/sdk-skills` package. If one you need is not in your skills list, check the scene's `.claude/skills` / `.agents/skills` and the user-level `~/.claude/skills` / `~/.agents/skills` (symlinks — use `grep -R`) before installing; install with `npx skills add decentraland/sdk-skills --skill <name>` (or `--all`; `npx skills update` never adds new skills), then tell the user a new session is needed to load it: the skill list and the MCP tool list are fixed at session start.

- `npx skills add … --all` and the Creator Hub's skills update overwrite every released skill's folder, locally patched copies included, so install an unreleased skill from a PR under its own folder name and leave the released folders (`sdk-scenes`, `npcs`, …) unpatched.
- The installer skips a skill whose frontmatter it cannot parse and still exits 0, and the Hub reports success on exit 0 (creator-hub `skills.ts`), so when a skill seems missing, compare `skills-lock.json` with the upstream skill list.

### Scene Setup & Configuration

**Skill: `create-scene`** — Scaffolding a new project, and editing `scene.json` (parcels, spawn points, permissions, tags, feature toggles). Field reference: `{baseDir}/../create-scene/references/scene-json.md`.

### Composite File Format

**Skill: `composites`** — The `.composite` JSON format for static scene entities; hand-editing `main.composite` when the Creator Hub MCP is not available (check item 5 and the CRITICAL RULES above first).

### 3D Models

**Skill: `add-3d-models`** — Loading `.glb`/`.gltf` with `GltfContainer`, positioning, colliders, and browsing the free asset catalogs (8,800+ OpenDCL models plus the Creator Hub asset packs). Also authoring and editing custom models by driving Blender (headless CLI or Blender MCP).

### Animations & Tweens

**Skill: `animations-tweens`** — GLTF animation clips with `Animator`, programmatic `Tween` and `TweenSequence`, easing functions.

### Materials & Rendering

**Skill: `advanced-rendering`** — PBR and emissive materials, `GltfNodeModifiers`, `TextShape`, `Billboard`, `VisibilityComponent`, texture modes and UVs.

### Lighting & Environment

**Skill: `lighting-environment`** — `LightSource` point/spot lights, shadows, `SkyboxTime` (day/night cycle), `Skybox`, `Sun` and `EnvironmentFog` (custom sky image, sky/sun/fog colors, a dimmed, fixed or hidden sun, complete darkness); glow that also lights its surroundings.

### Particle Systems

**Skill: `particle-system`** — `ParticleSystem` effects: fire, smoke, sparks, snow, rain, magic, fireworks; emitter shapes, bursts, sprite sheets.

### Click & Proximity Interactivity

**Skill: `add-interactivity`** — `pointerEventsSystem`, trigger areas, raycasting. For polling-based input see `advanced-input`.

### Advanced Input & Movement Control

**Skill: `advanced-input`** — `inputSystem` polling, WASD-controlled entities, `InputModifier`, `PointerLock`, `PrimaryPointerInfo`, `TouchScreenControls` (mobile on-screen joystick/crosshair/buttons), platform detection, player language / localization.

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

**Skill: `fonts`** — Built-in faces (`font`) and custom `.ttf` fonts (`fontSrc`) for 3D and UI text, including why a custom font isn't showing.

### Screen-Space UI

**Skill: `build-ui`** — 2D screen-space UI (HUDs, menus, dialogs, inputs, sliders) with React-ECS, editable in the Creator Hub UI Designer by default; adapting coded UI for the editor.

### Player Feedback & Playtesting

**Skill: `scene-feedback`** — Scene Feedback playtest surveys: plan questions and timing, organize test rounds and find testers, integrate or debug the module, analyze exported CSV responses.

### Audio & Video

**Skill: `audio-video`** — `AudioSource`, `AudioStream`, `VideoPlayer`, media permissions.

### Audio Analysis (Reactive Visualizers)

**Skill: `audio-analysis`** — `AudioAnalysis` amplitude and 8-band frequency data to drive scale, color, lights and particles from music. Desktop: all three media sources; mobile: `AudioSource` only.

### Blockchain & NFTs

**Skill: `nft-blockchain`** — `NftShape`, wallet checks, token gating, signed requests, smart contracts.

### Multiplayer (CRDT, no server)

**Skill: `multiplayer-sync`** — `syncEntity` for peer-to-peer sync, `MessageBus`, parent-child sync, testing with two local players.

### Multiplayer Server

**Skill: `authoritative-server`** — Headless server, `isServer()`, `registerMessages()`, `Storage`, `EnvVar`. Also investigate deployed multiplayer scenes automatically using persisted log search, bounded live tail, executions and CPU/memory metrics (`scene-insights`). Read-only diagnostics reuse an existing session; they do not require adding a server. First check the installed `node_modules/.bin/sdk-commands scene-insights --help`, including stderr; if unavailable, explain the required SDK update. Do not upgrade automatically. Older installations may need updating, and granting log access requires redeploying. Authoring requires `@dcl/sdk@auth-server`.

### Script Components (Creator Hub)

**Skill: `script-components`** — Writing `.ts` script files for the Creator Hub Script component, constructor parameters, `@action` JSDoc tags (never decorator syntax).

### Creator Hub MCP (live scene editing)

**Skill: `creator-hub-mcp`** — Editing the scene open in the Creator Hub through its MCP server (preferred over editing `main.composite`), placing catalog items and custom models, and connecting an external agent to it.

### Testing in the Explorer (MCP)

**Skill: `unity-explorer-mcp`** — Launch and drive an Explorer over MCP to see, walk, click, screenshot and debug the scene in-world. Also when the `explorer` MCP server reports ConnectionRefused or was never set up: the Explorer just isn't running yet.

### Async, HTTP, WebSocket, Timers

**Skill: `scene-runtime`** — `executeTask`, `fetch`, `signedFetch`, WebSocket, timers, realm/scene info, restricted actions.

### Scene Optimization

**Skill: `optimize-scene`** — Scene limits (including mobile), draw calls, reusing vs merging, object pooling, LOD, texture optimization, asset preloading, system throttling.

### Game Design

- **Skill: `dcl-gdd`** — Design a game or experience with the creator: brainstorm, core loop, audience, readability, social play, retention, mobile, scope; audit an idea; write or revise a GDD.
- **Skill: `dcl-prototype`** — Small playable prototypes and greyboxes that answer a design question; owner self-tests, registered experiments and their verdicts.
- What a scene in a shared world can and cannot do, and what the Explorer already provides (login, chat, name tags, emotes, loading screen): `{baseDir}/../create-scene/references/platform-provided.md`. Rules and instruction text: **build-ui** → *Rules: show, don't tell*. Organizing playtest rounds: **scene-feedback**.

### Deployment

- **Skill: `deploy-scene`** — Genesis City (LAND) deployment with `npx @dcl/sdk-commands deploy`: pre-deploy checklist, thumbnail spec, `.dclignore`, post-publish conversion, troubleshooting.
- **Skill: `deploy-worlds`** — Personal Worlds, `worldConfiguration`, ENS/DCL NAME requirements.

### Promotion & Marketing Kit

**Skill: `promote-scene`** — Audience-first marketing kit for a finished or upcoming scene: names who the game is for and which communities they are in (sources and assumptions shown on the page), then post copy for X, Instagram, named subreddits and YouTube Shorts, logo/wordmark/icon, Blender hero renders of the scene's own GLBs, key art, quote cards, a footage shot list, a first-20-players plan with a stop rule, and an offline HTML kit page to copy/download everything; on request, a Remotion-cut video for one footage post or Short (from the creator's recordings, gameplay it records itself in the Explorer, Blender clips or stills). Not for deploying or for the scene thumbnail alone.

### Wearables & Smart Wearables

**Skill: `smart-wearables`** — Wearables that run SDK7 code while equipped: `wearable.json` schema, 3 MB limit, what other players see, multiplayer limits, Builder upload errors.

**Skill: `wearables`** — Making wearable 3D files: base meshes, category limits, skinning, texturing, glTF export, thumbnail, Builder upload.

### Reporting SDK Issues

**Skill: `report-sdk-issue`** — Report SDK, Explorer or Creator Hub bugs and limitations to the Decentraland team before working around them.

### Scene Retrospectives

**Skill: `scene-retro`** — Retro or post-mortem of a scene's build sessions: turns mistakes and owner corrections into evidence-backed skill fixes, saved as a report.

### SDK6 → SDK7 Migration

**Skill: `migrate-sdk6-to-sdk7`** — Port legacy SDK6 (`decentraland-ecs`) scenes to SDK7.

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

- **Components:** `{baseDir}/references/components-reference.md` — key fields, types and defaults of common SDK7 components. A component's complete field list lives in its topic skill or the SDK typings.
- **Mobile parity:** `{baseDir}/references/mobile-parity.md` — what the mobile app does not support or does differently (TweenSequence, Draco, AvatarNametag, custom fonts, UI tint and safe area, VirtualCamera FOV, colliders, movement). Read it before designing anything a mobile player depends on.
- **Example scenes:** `{baseDir}/references/example-scenes.md` — the docs' machine-readable catalog of 45 worked examples (20 published community games plus Decentraland references), with commit-pinned code highlights and licence status. Read it before designing a mechanic from scratch or when the user asks for an example or template.
- **Entity validation** (component combinations that require or exclude each other, for composite and TypeScript entities): **create-scene**.
- **Asset catalogs:** see Agent Behavioral Guidelines, item 2.
