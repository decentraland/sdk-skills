# Decentraland SDK Skills

AI coding skills for building [Decentraland](https://decentraland.org) scenes with SDK7. These skills provide context and guidelines for AI coding assistants (Claude Code, Cursor, Codex, Cline, Windsurf, and others) to help you create, extend, and deploy Decentraland scenes.

## Quick Start

Install all skills at once:

```bash
npx skills add decentraland/sdk-skills --skill '*'
```

Or install just the entry-point skill (behavioral guidelines + skill index):

```bash
npx skills add decentraland/sdk-skills --skill sdk-scenes
```

Or install individual topic skills:

```bash
npx skills add decentraland/sdk-skills --skill create-scene
npx skills add decentraland/sdk-skills --skill add-3d-models
npx skills add decentraland/sdk-skills --skill multiplayer-sync
```

## Available Skills

| Skill | Description |
|-------|-------------|
| `sdk-scenes` | **Entry point.** Agent behavioral guidelines, composite-first rule, and index of all topic skills. |
| `create-scene` | Scaffold a new SDK7 scene project (scene.json, package.json, tsconfig, index.ts). |
| `add-3d-models` | Add 3D models (.glb/.gltf) with GltfContainer — positioning, scaling, colliders, visibility. |
| `add-interactivity` | Event-driven interactivity — pointer events, triggers, raycasts. |
| `advanced-input` | System-level input polling and player movement control. |
| `advanced-rendering` | Billboard, TextShape, PBR materials, video materials, avatar textures. |
| `animations-tweens` | GLTF model animations with Animator, SDK tweens for position/rotation/scale. |
| `audio-video` | Sound effects, music, audio streaming, and video players. |
| `authoritative-server` | Headless authoritative server for multiplayer (BETA). |
| `build-ui` | 2D screen-space UI with React-ECS (JSX) — HUDs, menus, dialogs. |
| `camera-control` | Camera mode detection, cinematic camera, virtual cameras. |
| `composites` | Composite file format reference for static scene content. |
| `deploy-scene` | Deploy scenes to Genesis City (LAND-based). |
| `deploy-worlds` | Deploy scenes to Worlds (personal 3D spaces). |
| `game-design` | Game design patterns, scene limits, performance budgets. |
| `lighting-environment` | Dynamic lighting, shadows, skybox, fog, environment settings. |
| `multiplayer-sync` | Peer-to-peer multiplayer using CRDT networking. |
| `nft-blockchain` | NFT display and blockchain/crypto interactions. |
| `npcs` | Non-player characters — NPC Toolkit library and manual approaches. |
| `optimize-scene` | Performance optimization, scene limits, best practices. |
| `player-avatar` | Player position, profile, avatar customization, attachments. |
| `player-physics` | Physics forces — impulses, knockback, continuous forces. |
| `scene-runtime` | Cross-cutting runtime APIs — async work, HTTP, messaging, observables. |
| `script-components` | Script component classes for the Creator Hub. |

## What Are Skills?

Skills are markdown files that give AI coding assistants the context they need to write correct code for specific frameworks and platforms. They're installed using the [Vercel Skills CLI](https://github.com/vercel/skills) and work with any AI tool that supports `.cursor/skills`, `.claude/skills`, or similar conventions.

## Contributing

The source of truth for these skills is maintained in the [decentraland/docs](https://github.com/decentraland/docs) repository under the `skills/` directory. To contribute improvements, please open a PR there.

## License

See [LICENSE](./LICENSE).
