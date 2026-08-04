---
name: game-mechanics
description: Reusable, implementation-level game-mechanic systems for Decentraland SDK7 games. Covers wave spawning (enemy waves, path-following, between-wave countdowns), turn/grid systems (step/turn/realtime/freeform timing, board state, undo), economy and upgrades (currency, purchase/sell, upgrade tracks), status effects (timed modifiers as components), combat AI behaviors (patrol/chase/melee/ranged, targeting modes, projectile prediction, enemy FSM), UI game systems (quiz, cards, dialogue sequencing, turn-based battle flow built from React-ECS), and game-feel feedback (floating 3D text, combos). Use when the user is building the moving parts of a game — spawners, turn managers, currency, buffs/debuffs, enemy behavior, or menu-driven battle/quiz/card UI. Do NOT use for game planning, scene limits, or loop archetypes (see game-design); basic pointer/proximity/trigger input (see add-interactivity); NPC dialog toolkit (see npcs); networking primitives (see multiplayer-sync, authoritative-server); or general screen UI setup (see build-ui).
---

# Game Mechanics for Decentraland Scenes

Implementation-level building blocks for DCL games. This is the counterpart to **game-design** (which covers planning, loops, and limits): here you get concrete, verified SDK7 systems you can adapt. Every system is data-driven (define content as plain arrays/objects) and runs on `engine.addSystem` loops, custom components, or Tweens.

> This skill assumes the ECS mental model (entities as IDs, data-only components, systems as free functions). If that is unfamiliar, read **create-scene** and **game-design** first.

## System Taxonomy

| System             | What it gives you                                                                                             | Reference                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Wave spawning      | Data-defined enemy waves, spawn pacing, between-wave countdowns, lifecycle callbacks, waypoint path-following | `{baseDir}/references/wave-spawner.md`          |
| Turn & grid        | Timing manager (step/turn/realtime/freeform), phase cycle with input-locking, 2D board state, undo            | `{baseDir}/references/turn-and-grid-systems.md` |
| Economy & upgrades | Currency (afford/spend/earn), purchase + sell/refund, data-driven upgrade tracks                              | `{baseDir}/references/economy-and-upgrades.md`  |
| Status effects     | Timed modifiers as a custom component, refresh-don't-stack, auto-expiry, stat multipliers, visual tint        | `{baseDir}/references/status-effects.md`        |
| Combat behaviors   | Composable patrol/chase/melee/ranged components, targeting modes, projectile lead prediction, enemy FSM       | `{baseDir}/references/combat-behaviors.md`      |
| UI game systems    | Quiz/trivia, card hand/deck, dialogue sequencing, turn-based battle flow, all in React-ECS                    | `{baseDir}/references/ui-game-systems.md`       |
| Game-feel feedback | Floating 3D damage/reward text, combo counters (in `ui-game-systems.md`)                                      | `{baseDir}/references/ui-game-systems.md`       |

## Genre Fit in Decentraland

DCL is a third or first-person, always-live, shared 3D world. Some genres map cleanly; others need adaptation.

| Genre                                                   | Fit            | Why / adaptation                                                                                                                                                                                                               |
| ------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tower defense                                           | Excellent      | Click-to-place towers, path-following enemies, no player character needed. Pointer-only, so it works on mobile. See wave-spawner + combat-behaviors + economy.                                                                 |
| Grid / board games (sokoban, tactics, match-3, puzzles) | Excellent      | Discrete state, no physics, input locked during animations. Lay the board on the parcel floor as 3D entities, or drive it entirely through React-ECS UI. See turn-and-grid.                                                    |
| Arena / horde combat                                    | Good (adapted) | The player is their own avatar, not a spawned sprite. Enemies chase `engine.PlayerEntity`, melee/ranged the avatar, apply knockback via **player-physics**. No respawn screen — design drop-in/drop-out. See combat-behaviors. |
| Card / quiz / narrative                                 | Good           | Built entirely in React-ECS UI (**build-ui**). Deck/hand/quiz/dialogue state lives in module variables or components. See ui-game-systems.                                                                                     |
| Twitch platformers                                      | Good           | Network latency make precise timing hard. Prefer having key interactions against the environment vs against other player's position                                                                                            |
| fast shooters                                           | Weak           | Network latency make precise timing hard. Prefer turn-based, timing-window, or placement mechanics (see game-design "Competitive").                                                                                            |

## DCL Constraints That Shape These Mechanics

These are not optional — they change how every system above is written:

- **Always-live, no native title screen / no forced game-over.** There is no "press start" and no way to freeze the world or eject a player. A "round" is a state your systems track, not a scene boundary. Waves, turns, and battles must tolerate a player walking away mid-game.
- **Drop-in / drop-out players.** A player can arrive or leave at any moment. Per-player game state (economy, hand, current battle) must handle a player who appears mid-round or vanishes. Games might otherwise have a spectator mode before the next round starts.
- **Shared multiplayer space.** Multiple players are always potentially present, even in a "single-player" game. Every mechanic below has a multiplayer note: decide up front whether state is **local-only** (each client runs its own copy), **synced** for a shared game (`syncEntity` — see multiplayer-sync), or **server-validated** (see authoritative-server). Competitive/economy mechanics that matter should be server-validated.
- **Mobile, pointer-only input.** Do not build keyboard-dependent mechanics. Everything must be reachable with pointer clicks, on-screen React-ECS buttons, and at most the pointer, E (`IA_PRIMARY`) / F (`IA_SECONDARY`) action keys and 1, 2, 3 & 4. See add-interactivity and advanced-input.
- **Performance budget.** Spawners, projectiles, and per-frame AI must respect entity/triangle limits. Pool entities (never create/destroy per shot or per enemy) and throttle heavy systems. See optimize-scene.

## Conventions Used Across the References

- **Scheduling:** use `timers.setTimeout` / `timers.setInterval` from `@dcl/sdk/ecs` for delays and countdowns — never the native JS `setTimeout` globals (they are not bound to the scene engine). See scene-runtime.
- **Motion:** use `Tween` / `TweenSequence` for procedural movement (enemy paths, floating text) and `tweenSystem.tweenCompleted(entity)` to detect completion. See animations-tweens.
- **State:** small games use module-level variables; structured/queryable state uses custom components via `engine.defineComponent(name, { ...Schemas })`. Shared state uses `syncEntity`.
- **Pooling:** reuse entities for enemies/projectiles/floating text. See optimize-scene.

## Cross-References

| Topic                                         | Skill                    | When                                                |
| --------------------------------------------- | ------------------------ | --------------------------------------------------- |
| Game planning, loops, scene limits, MVP       | **game-design**          | Before implementing — decide the loop and budget    |
| Pointer / proximity / trigger / raycast input | **add-interactivity**    | Click-to-place, "press E", zone triggers            |
| Held-key polling, cursor lock, action bar     | **advanced-input**       | Continuous input, custom action keys                |
| Screen UI (menus, HUD, React-ECS primitives)  | **build-ui**             | Building the UI shell that ui-game-systems fills in |
| Shared game state, broadcast events           | **multiplayer-sync**     | Making a mechanic multiplayer without a server      |
| Server validation, anti-cheat, persistence    | **authoritative-server** | Competitive scores, real economy, leaderboards      |
| NPC dialog toolkit, AvatarShape NPCs          | **npcs**                 | Conversation NPCs (vs. combat enemies here)         |
| Impulses, knockback, forces on the avatar     | **player-physics**       | Combat knockback against the player                 |
| Model animations, procedural tweens           | **animations-tweens**    | Enemy walk clips, path motion, text rise            |
| Pooling, LOD, throttling, budgets             | **optimize-scene**       | Keeping spawners and projectiles within limits      |
| 3D text, Billboard, materials                 | **advanced-rendering**   | Floating text and tint feedback details             |
