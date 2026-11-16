# Example scenes catalog

The Decentraland docs keep a curated, machine-readable index of SDK7 example scenes, written for AI agents. Read this when designing a mechanic or system and you want the closest worked example, or when a user asks for an example, template or reference game.

- Machine-readable: `https://raw.githubusercontent.com/decentraland/docs/main/creator/tutorials/examples/catalog.json` — fetch this, not the HTML pages.
- Human index: `creator/tutorials/examples.md` in [decentraland/docs](https://github.com/decentraland/docs/blob/main/creator/tutorials/examples.md), one page per entry under `creator/tutorials/examples/<category>/`.

## How to use it

1. Fetch `catalog.json` and filter `examples[]` (top-level array) by `category` and `tags` for the mechanic at hand. Reuse its tag vocabulary when searching.
2. Read the entry's `highlights[]`: each has `title`, `description`, `context` (project-specific dependencies and limits) and `references[]` whose `url`s point at exact files and line ranges **pinned to a commit SHA** — read those lines, not the whole repo. Half the entries have them: all 15 community games, the 5 DAO games, plus `npc-toolkit`, `spreadsheet-data`, `reward-claim-dispenser` and `clap-to-claim-dispenser`. For the other 24 it is `[]` — read the repo at `source` instead.
3. Point the user at the closest example and adapt its pattern to their scene. Treat it as a reference, not code to paste: check every API it uses against the topic skill (examples can lag the SDK), and keep the scene's own structure.
4. Before copying any code or asset, check `license`: `{ status: 'unknown' }` means the catalog has **not identified** terms (not that none exist) — check upstream first; `{ status: 'identified', name, url }` names them. Several published games are **CC BY-NC-ND 4.0** (no derivatives): learn from them, don't copy them.

Entry fields: `id`, `name`, `description`, `category`, `tags`, `source` (repo URL), `maintenance` (`decentraland` | `community`, derived from the GitHub owner, not a security review), `maintainer`, `license`, `highlights`; published games add `developer` and `realm` (World to play it in) or `position`. `schemaVersion: 2`.

**Caveats:** community entries are maintained independently and can change; inclusion implies no security audit. Review code, dependencies and install scripts before running one. Some older Decentraland-maintained examples use `dcl-ui-toolkit` for their UI (`third-party-leaderboard`, `third-party-player-authentication`): take their server and request pattern, and build the UI with ReactEcs (**build-ui**).

## Categories (as of 2026-11-05: 48 entries in 10 categories)

| `category` | n | What it holds |
| --- | --- | --- |
| `getting-started` | 1 | `sdk7-scene-template` — clean TypeScript starting point |
| `published-games` | 20 | released games (below) |
| `gameplay-interaction` | 6 | input modifier, particles, pointer lock, raycasts and collider layers, trigger areas, Zombie Attack (complete game with enemies and scoring) |
| `ui-camera-player` | 5 | spectate mode, UI safe areas, virtual cameras, UI animations (sprite sheets, loading indicators), NPC Toolkit |
| `multiplayer-data-services` | 2 | Multiplayer Server leaderboard, sdk-mini-games (`@dcl-sdk/mini-games`: player queues, scoreboards) |
| `external-services` | 4 | `spreadsheet-data` (scene data from a published spreadsheet), third-party **guest book**, **leaderboard** and **player authentication** (an external HTTP service verifying who sent a request) |
| `audio-video-environment` | 4 | audio visualization, dynamic lights, skybox control, video streaming |
| `performance-scene-systems` | 3 | asset loading, material and texture gallery, modifier areas |
| `scene-management-feedback` | 1 | Scene Feedback (`playtest-feedback`; **scene-feedback**) |
| `rewards` | 2 | `reward-claim-dispenser`, `clap-to-claim-dispenser` — give players a wearable through a Rewards campaign. No topic skill covers Rewards yet: read the entry's `highlights[]` references. |

**Most of the catalog is official now: 33 of the 48 entries are `maintenance: "decentraland"`.** Three GitHub owners count as official — `decentraland` (27 entries), `decentraland-scenes` (`npc-toolkit`) and `dcl-regenesislabs`, which the docs label **Decentraland DAO** (`cozy-farm`, `dead-surge`, `kick-off`, `my-dear-pet`, `tower-of-madness`). The remaining **15 are community, and all of them are published games**: `shroom-zoom`, `goal-legends`, `monster-recon`, `prime-drive`, `the-fortune-teller`, `clean-the-club`, `astro-crew`, `flag-tag`, `pigeon-deluxe`, `alien-scrapyard`, `fastlane-bowling`, `sky-chaser`, `slay-the-steps`, `bloom-garden`, `slide-penguin`. Outside `published-games`, every entry is official.

Topic skills already link `sdk7-scene-template` (**create-scene**), `ui-animations` (**build-ui**), `video-streaming` (**audio-video**) and `mini-games-library` (**multiplayer-sync**); the rest, including the two `rewards` entries, are reached only through this catalog.

## Published games (playable in their World)

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
