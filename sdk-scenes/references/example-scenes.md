# Example scenes catalog

The Decentraland docs keep a curated, machine-readable index of SDK7 example scenes, written for AI agents. Read this when designing a mechanic or system and you want the closest worked example, or when a user asks for an example, template or reference game.

- Machine-readable: `https://raw.githubusercontent.com/decentraland/docs/main/creator/tutorials/examples/catalog.json` — fetch this, not the HTML pages.
- Human index: `creator/tutorials/examples.md` in [decentraland/docs](https://github.com/decentraland/docs/blob/main/creator/tutorials/examples.md), one page per entry under `creator/tutorials/examples/<category>/`.

## How to use it

1. Fetch `catalog.json` and filter `examples[]` (top-level array) by `category` and `tags` for the mechanic at hand. Reuse its tag vocabulary when searching.
2. Read the entry's `highlights[]`: each has `title`, `description`, `context` (project-specific dependencies and limits) and `references[]` whose `url`s point at exact files and line ranges **pinned to a commit SHA** — read those lines, not the whole repo. `highlights[]` is empty for 24 of the 45 entries, every Decentraland-maintained one included: then read the repo at `source` instead.
3. Point the user at the closest example and adapt its pattern to their scene. Treat it as a reference, not code to paste: check every API it uses against the topic skill (examples can lag the SDK), and keep the scene's own structure.
4. Before copying any code or asset, check `license`: `{ status: 'unknown' }` means the catalog has **not identified** terms (not that none exist) — check upstream first; `{ status: 'identified', name, url }` names them. Several published games are **CC BY-NC-ND 4.0** (no derivatives): learn from them, don't copy them.

Entry fields: `id`, `name`, `description`, `category`, `tags`, `source` (repo URL), `maintenance` (`decentraland` | `community`, derived from the GitHub owner, not a security review), `maintainer`, `license`, `highlights`; published games add `developer` and `realm` (World to play it in) or `position`. `schemaVersion: 2`.

**Caveats:** community entries are maintained independently and can change; inclusion implies no security audit. Review code, dependencies and install scripts before running one. Some older Decentraland-maintained examples use `dcl-ui-toolkit` for their UI (`third-party-leaderboard`, `third-party-player-authentication`): take their server and request pattern, and build the UI with ReactEcs (**build-ui**).

## Categories (as of 2026-10-29: 45 entries)

| `category` | What it holds |
| --- | --- |
| `getting-started` | `sdk7-scene-template` — clean TypeScript starting point |
| `published-games` | 20 released community games (below) |
| `gameplay-interaction` | input modifier, particles, pointer lock, raycasts and collider layers, trigger areas, **Zombie Attack** (complete game with enemies and scoring) |
| `ui-camera-player` | spectate mode, UI safe areas, virtual cameras, **UI animations** (sprite sheets, loading indicators), NPC Toolkit |
| `multiplayer-data-services` | Multiplayer Server leaderboard, **sdk-mini-games** (`@dcl-sdk/mini-games`: player queues, scoreboards), third-party **guest book**, **leaderboard** and **player authentication** (an external HTTP service verifying who sent a request) |
| `audio-video-environment` | audio visualization, dynamic lights, skybox control, **video streaming** |
| `performance-scene-systems` | asset loading, material and texture gallery, modifier areas |
| `scene-management-feedback` | Scene Feedback (`playtest-feedback`; **scene-feedback**) |

Bold entries are the Decentraland-maintained ones, by catalog `id`: `sdk7-scene-template`, `zombie-attack`, `ui-animations` and `video-streaming` (`decentraland/sdk7-goerli-plaza`), `mini-games-library` (`decentraland/sdk-mini-games`), `third-party-guest-book`, `third-party-leaderboard` and `third-party-player-authentication` (`sdk7-goerli-plaza` folders `guest-book-api`, `leader-board`, `validate-player-authenticity`). Topic skills already link `sdk7-scene-template` (**create-scene**), `ui-animations` (**build-ui**), `video-streaming` (**audio-video**) and `mini-games-library` (**multiplayer-sync**); the others are reached only through this catalog.

## Published games (community, playable in their World)

| Game | Closest pattern for |
| --- | --- |
| Goal Legends, Astro Crew, Sky Chaser, Flag Tag | Multiplayer Server matches, persistent leaderboards (Storage) |
| Fastlane Bowling | server-simulated physics, batched state updates, mobile-scaled particles |
| Bloom Garden | persistent shared state, server-clock offset estimation |
| Prime Drive | lane racer, recycled scenery, record ghosts |
| Clean The Club, Alien Scrapyard | cooperative timed rounds; avatar-attached props; phase-driven cinematic cameras |
| The Fortune Teller | conversation state machine, pivot camera rig |
| Shroom Zoom, Tower of Madness, Slide Penguin | platforming: trigger-gated raycast bounces, impulses, asset preloading, camera tour |
| Monster Recon, My Dear Pet | collection loops, trigger chases, movement easing |
| Cozy Farm | timed growth stages, repeated hierarchies |
| Dead Surge | wave survival, enemy steering, pooled reward text |
| Kick Off, Pigeon Deluxe | charged-input kicks; timed delivery with an avatar-mounted pointer |
| Slay the Steps | custom avatars, Marketplace API, raycast color wheel |
