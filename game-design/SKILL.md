---
name: game-design
description: Game design for Decentraland scenes - core loop and MVP scope, game-loop archetypes, what the platform already provides, onboarding and tutorials, playtest planning, spatial layout, engagement and monetization, mobile-safe mechanics. For implementation see add-interactivity, build-ui, multiplayer-sync; for performance techniques see optimize-scene.
---

# Game Design for Decentraland

## 1. DCL Game Design Philosophy

Decentraland is a **continuous, shared 3D world**. Design around these constraints:

- **No startup screen**: The scene is always live. Players walk in from adjacent parcels — there is no splash screen, no "press start." Your scene must be meaningful the instant a player arrives.
- **No forced endings**: You cannot force a "game over" state. Players can leave at any time by walking away or teleporting. Design loops that accommodate drop-in / drop-out naturally.
- **Cannot remove players**: There is no API to eject a player from a scene. You can teleport a player, but only within the existing scene. If you're teleporting outside the scene, you can only do it with their consent (they must accept the prompt). Design around misbehaving players with game mechanics, not eviction. If the scene has admin players, admins are able to ban other players from the scene manually.
- **Boundary awareness**: Players standing outside your parcel can see into it. Your scene is always on display. Neighboring scenes are visible too — consider visual harmony.
- **Shared space**: Multiple players are always potentially present. Even a "single-player" puzzle is witnessed by others. Embrace or account for this.

### The platform already provides this — don't rebuild it by default

The Explorer ships these for every scene. Do not plan, scope or build a scene version unless the design genuinely needs a different one:

| Provided by the Explorer | So the scene does NOT need |
|---|---|
| Identity: wallet + display name (`getPlayer()?.name`, `.userId`, `.isGuest` from `@dcl/sdk/players`) | A login, account or "enter your nickname" screen |
| Name tags above every avatar, and a profile **passport** on click | Floating player-name labels. For a rank/team plate, add an `AvatarNametag` (see **player-avatar**) |
| Text chat, voice chat (nearby, private and community calls), friends list and requests, user blocking | A chat box, a friends list, a mute/block feature |
| Emote wheel with default + owned emotes | An emote menu (to trigger one from gameplay: `triggerEmote` / `triggerSceneEmote`) |
| Avatar customization from the backpack (wearables) | A dress-up / character-creator screen |
| Loading screen while the scene downloads | A loading screen or progress bar |

- **Scenes CAN override any of these when the design calls for it**: hide all avatars and/or name tags in a zone (`AvatarModifierArea` with `AMT_HIDE_AVATARS` / `AMT_HIDE_NAMETAGS`, plus `AMT_DISABLE_PASSPORTS`), then show your own body at the player's position (an `AvatarShape` or a model that follows the player; other players see it only if you sync it yourself — docs `avatars/npc-avatars.md` → *Replace the player's avatar*, **npcs**); silence voice chat on the scene (scene settings restrictions / `featureToggles.voiceChat`, see `{baseDir}/../create-scene/references/scene-json.md` → Feature Toggles); show a custom start or title screen. Make it a deliberate choice, not a reflex carried over from standalone games.
- **Skipping a start screen is a feature.** With none, the player lands straight in the game and starts playing on arrival. If you add one, gate it on the loading screen (see *First impression* in §2) and keep it to one tap.

Verified: Explorer modules `Chat`, `VoiceChat`, `Friends`, `EmotesWheel`, `NameTags`, `Passport`, `Backpack`, `SceneLoadingScreens` (unity-explorer `Explorer/Assets/DCL/`); docs `design-experience/design-games.md` (*Communication between players*, *Avatars*) and `scene-editor/configure/scene-settings.md` (*Scene restrictions*); `AvatarModifierType` enum in protocol `avatar_modifier_area.proto`.

## 2. Design Budgets

Most limits scale with parcel count `n` (triangles, entities, bodies linear; materials, textures logarithmic). Height is a flat 330 m for every scene; content above ~200 m may suffer multiplayer sync issues. Rule of thumb for scoping: **10,000 triangles and 200 entities per parcel**.

- **Mobile adds a flat budget that constrains design**: 8 light sources (2 shadow-casting) and 8 VFX emitters per scene, and low mobile profiles light no scene source at all. Budget lights and VFX as accents over a baseline that reads with no scene light (**lighting-environment** → *Light Limits*).
- Limits table, texture sizes, pooling, LOD, draw calls, system throttling, colliders, `AssetLoad` preloading: **optimize-scene**.
- **Single-scene World with a self-contained aesthetic** (open water, space, void): set `landscapeTerrain: false` to remove the surrounding landscape (`{baseDir}/../create-scene/references/scene-json.md` → Fields).

### First impression: time the intro to the loading screen

Anything the scene does on startup — an intro cinematic, a welcome sound, a title UI, an opening tween — happens **behind the Explorer's loading screen** and the player never sees it. Gate the opening beat on the loading screen lifting (`EngineInfo.sceneHidden` flipping to `false`; pattern in **scene-runtime**), not on a timer or a frame count. The same flag pauses gameplay while a full-screen Explorer UI covers the scene.

## 3. Input Design

- Input is E (`IA_PRIMARY`), F (`IA_SECONDARY`), pointer click / tap and keys 1-4; there is no mouse wheel. Full map: **advanced-input**.
- Design for **mobile** too: it has no keyboard, so core interactions must work with pointer taps and on-screen buttons.
- Keep interactions close: pointer range and proximity limits (proximity caps near 3 m) are in **add-interactivity** → *Distance rules*.
- Use `hoverText` as the just-in-time instruction: it tells the player what an interaction does before they commit.
- Model game phases as explicit states with clear transitions (lobby → countdown → active → cooldown); implementation in **add-interactivity** → *Toggle Pattern*.

## 4. UX/UI Guidelines

- **Keep UI minimal**: The metaverse is about 3D presence, not 2D overlays. Avoid large HUDs that obscure the world.
- **Prefer spatial UI**: Use `TextShape` on entities and 3D signs over screen-space UI whenever the information is tied to a place or object.
- **Clear affordances**: Interactive objects should look interactive. Use glow effects, outlines, floating indicators, or subtle animations to signal "you can click this."
- **Sound feedback**: Every significant player action should produce audio feedback. It confirms the action registered and adds polish.
- **Progressive disclosure**: Do not dump all information at once. Reveal mechanics and story as the player engages. Start simple, layer complexity.
- **Show, don't tell**: teach rules through play, not a text-heavy pop-up or in-world rulebook (§9, "Rules: show, don't tell").
- **Place screen UI where the client is not**: never anchor a HUD to the top-left corner (minimap, chat, mobile joystick live there). Anchor right or center, or use the interactable inset; keep mobile HUDs clear of the bottom-right action buttons, or hide those buttons while a full-screen UI is open. Rules and code in the **build-ui** skill.
- **Immediate feedback**: When a player interacts, respond within the same frame. Use tweens, sounds, or UI popups so the player never wonders "did that work?"
- **Accessibility**: Use high-contrast text, readable font sizes (fontSize >= 16 for screen UI), and audio cues alongside visual ones.
- **Photosensitivity: no strobing by default.** Flashing lights, strobes, rapid color/brightness swaps (emissive pulses, flickering `LightSource`, full-screen UI flashes, video) can trigger seizures. Keep any flash to **at most 3 per second** (WCAG 2.3.1 "Three Flashes or Below Threshold"), keep flashing regions small, and avoid saturated red and large high-contrast full-view flashes. If the design depends on intense effects (club strobes, lightning, damage flashes), add an in-scene toggle to turn them off or tone them down.

## 5. MVP Planning

### Start with the Core Loop
Ask: **What does the player DO?** The answer should be a single sentence:
- "The player explores rooms and finds hidden objects."
- "The player races other players through an obstacle course."
- "The player collects resources and builds structures."

### Prototype Fast
- Build in **1-2 parcels** first, even if the final scene will be larger
- Use primitive shapes (boxes, spheres) as placeholders — do not wait for final art
- Get the core loop working before adding any secondary features

### Test Early — and match the playtest to the stage

- Deploy to a **test World** (never your live LAND or main World) and walk through it yourself.
- Invite 2-3 real players and watch them. **Do not explain the game** — if you have to explain something, that is the design feedback.
- Measure against the MVP checklist's *First action obvious* item.

**The question to ask depends on how finished the game is.** Asking "did you have fun?" about a vertical slice tells you nothing (there is not enough game yet for the answer to mean anything); asking "did you understand what to do?" about a V2 wastes a session on something you already know.

| Stage | What to learn | Who to invite |
| --- | --- | --- |
| **V0** vertical slice | Is the core mechanic understandable and usable? Can players form a strategy around it? | A few players who already know Decentraland, so the client does not get in the way |
| **V1** first full loop | Can players progress unaided? Where do they get stuck or lose interest? | A mix of Decentraland players and people new to your game |
| **V2+** | How does the game make players *feel*? Do they come back? Would they recommend it? | New players, including people from outside Decentraland |

### Iterate with RITE (test → fix → test)

Rapid Iterative Testing and Evaluation: 3-5 players per round, fix the clearest problem between rounds, run the next round with new players. Beats one big playtest with a long issue list. DCL-specific habits:

- **Fix between rounds, never during one.** Redeploying mid-session breaks players' games and destroys the attribution — you no longer know which build a comment refers to.
- **Keep the same questions across rounds**, or the ratings are not comparable. Add questions; do not reword the ones you track.
- **"Clear" means**: you saw it happen, you can say what the player expected instead, and you know what to change. One player, cause unknown → carry it to the next round.
- **Log every round**: build, who played, what you saw, what you changed.
- **Finding testers**: the `#playtesters` channel on the Decentraland Discord; an event on [Decentraland Events](https://decentraland.org/events/) for a live session; or people from outside Decentraland when the thing under test is the first-time experience. A small thank-you (a wearable or emote you own can be gifted in-client by right-clicking the player) raises turnout — say plainly that you want criticism, not praise.
- **Close the loop**: post a "you said / we learned / we changed" update to the same thread. Testers who see their feedback land come back for the next round.

To collect playtest answers in-scene, or feedback players submit while you are away → **scene-feedback**.

### Iterate on Fun
- Polish comes last. If the core loop is not fun with placeholder art, better art will not fix it
- Cut features aggressively. A tight, small experience beats a sprawling, unfinished one
- Replay value matters more than content volume in DCL (players return to scenes they enjoy)

### MVP Checklist
- [ ] **Core loop defined**: One sentence describing what the player does.
- [ ] **First action obvious**: A new player knows what to do within 30 seconds.
- [ ] **Feedback present**: Every interaction produces visible and/or audible feedback.
- [ ] **Win/progress condition clear**: The player understands when they are succeeding.
- [ ] **Lose/fail condition fair**: If there is failure, the player understands why and can retry quickly.
- [ ] **Replay value exists**: There is a reason to play again (score improvement, new content, social competition).
- [ ] **Multiplayer compatible**: Works correctly with 1 player and with 5+ simultaneous players.
- [ ] **Within scene limits**: Triangle count, entity count, texture count, and file size all within budget for the target parcel count.
- [ ] **Performance acceptable**: Maintains 30+ FPS during gameplay with target entity/triangle counts.
- [ ] **Mobile compatible**: Core interactions work without a keyboard (pointer-only inputs). Use `TouchScreenControls` (see **advanced-input**) to customize on-screen buttons and `UiInputBinding` (see **build-ui**) for custom touch-action buttons. Detect platform with `isMobile()` from `@dcl/sdk/platform` to branch UI/controls.
- [ ] **No mechanic depends on a mobile gap**: no `TweenSequence` on the path across (it does not move on mobile), no fence made only of invisible or sub-1 cm colliders, no Draco GLBs, no information carried only by `AvatarNametag`, no Smart Item on the path a mobile player needs. Full list of gaps, consequences and workarounds, and what does work on mobile (`ParticleSystem`, `LightSource` and more) with the app version each needs, since mobile players can be on an older app: `{baseDir}/../sdk-scenes/references/mobile-parity.md`.
- [ ] **Within mobile scene limits**: ≤ 8 light sources (2 shadow-casting) and ≤ 8 VFX emitters, and the scene still reads on the Very Low graphics profile where no scene light is active. See **optimize-scene** → *Mobile Scene Limits*.

> **Starting from scratch?** See the **create-scene** skill first to scaffold the project before designing the game.

## 6. Game Loop Archetypes

### Exploration
- **Core loop**: Discover locations, find hidden items, unlock areas.
- **DCL fit**: Excellent. The 3D world and spatial navigation are strengths.
- **Design tips**: Use landmarks for wayfinding. Reward curiosity with hidden content. Use lighting and sound to guide attention.

### Collection
- **Core loop**: Gather items, complete sets, earn rewards.
- **DCL fit**: Strong. Combines well with exploration and daily engagement.
- **Design tips**: Use entity pooling for collectibles. Scatter items spatially. Tie collections to visual progress (display cases, counters). Pickup feel (delayed removal under the effect, upright spinning coins, pitch-varied sound): **add-interactivity** → *Pickups / collectibles: polish details*.

### Puzzle
- **Core loop**: Solve spatial or logic challenges to progress.
- **DCL fit**: Good. Spatial puzzles (move objects, find paths, activate sequences) work well.
- **Design tips**: Provide clear feedback on progress. Avoid puzzles that require typing (input is limited). Use 3D interactions (click, proximity triggers) as puzzle inputs.

### Social
- **Core loop**: Interact with other players, attend events, roleplay.
- **DCL fit**: Excellent. This is the platform's native strength.
- **Design tips**: Create gathering spaces (seating, stages, open areas). Provide conversation starters (interactive objects, games). Design for groups of 5-20.

### Competitive
- **Core loop**: Race, fight, or outscore other players.
- **DCL fit**: Moderate. Latency and input limitations constrain fast-paced action.
- **Design tips**: Prefer turn-based or timing-based competition over twitch reflexes. Use server-authoritative state to prevent cheating. Keep rounds short (2-5 minutes).
- **Anti-cheat architecture**: whenever scores or prizes are at stake, make the scene server-authoritative (**authoritative-server**). Clients send **intent** messages only (e.g. `claimPoint`) — never a score; the server validates (proximity to the objective, permissions) and is the only writer of game state. The official leaderboard test scene is a complete end-to-end template of this design: https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/90,-9-authoritative-server-leaderboard

## 7. Spatial Design

### Landmarks
- Place a tall, visible landmark at the center or entrance of your scene. Players use it to orient themselves.
- Every distinct area should have a unique visual identity (color, shape, lighting).

### Pathfinding
- Guide players with visible paths (floor patterns, lighting, railings).
- Avoid dead ends that require backtracking — use loops.
- Place interactive elements along paths to maintain engagement during traversal.

### Sightlines
- Use open sightlines to draw players toward objectives.
- Block sightlines strategically to create mystery and discovery.
- Ensure the scene looks inviting from the parcel boundary (this is your "shop window").

### Building Scale
- Do not build rooms, doors or stairs at real-world size. The third-person camera sits behind the avatar and is pulled forward whenever a wall gets in the way, and the controller has a hard step height and slope limit. Size the floor plan with the canonical table (ceilings, openings, corridors, stairs, ramps) and the verified avatar, collider and camera numbers in **add-3d-models** → *RULE: Scale interiors up for the third-person camera*, before you count parcels.

### Parcel Transitions
- If your scene spans multiple parcels, ensure smooth visual transitions.
- Do not place critical interactive elements right at parcel boundaries (loading edge cases).

### Vertical Traversal with Gliding
- While a player glides, continuous scene forces are 1.5× stronger and their **upward** component can lift the glider (the falling-speed cap only limits descent). This enables traversal mechanics like thermal updrafts, wind corridors, and floating-island hops. One-shot impulses (launch pads, knockback) are unaffected by gliding. See the `player-physics` skill ("Forces while gliding").
- Use open space at parcel edges as buffer zones.

## 8. Engagement and Monetization

### Engagement Patterns
- **Daily rewards**: Offer small rewards for daily visits. Track visits via external server — DCL has no built-in daily tracking. Display streak counters in-scene.
- **Progression systems**: Levels or unlockable content tied to cumulative play. Store progress on a server or use NFT-based progression. Show progression visually (leaderboards, badges, evolving scene elements). For persistent leaderboards and per-player progress, the built-in Multiplayer Server's `Storage` persists across redeploys and server sleep, with a server-owned synced component all clients render — see **authoritative-server** for the full pattern and reference scene.
- **Achievements**: Define clear milestones (first win, 100 collectibles, visited all rooms). Announce with sound and visual effects. Display achievement history in-scene (trophy room, wall of fame).
- **Progress while nobody is there** (crops growing, shop restocking, energy refilling): nothing is guaranteed to run while the scene is empty (the players' clients are gone, and the Multiplayer Server may be stopped between visits), so never model this as a running timer. Store a timestamp; on the next visit compute how many whole units finished, `gained = floor((now − savedAt) / msPerUnit)`, clamp to a cap, and apply it. Then move the timestamp forward by only the time those units took (`savedAt += gained × msPerUnit`), not to `now`, so the partial progress toward the next unit is kept. Reset it to `now` only once the cap is reached. Use the **server's** clock (`Date.now()` on the Multiplayer Server, then `Storage`) — a client's clock can be set forward to skip the wait. Pattern: **authoritative-server** → *Storage*.

### Monetization Approaches
- **In-scene purchases**: Sell virtual items or abilities via MANA transactions. Use `signedFetch` for secure server-verified purchases. Always provide free gameplay alongside paid upgrades.
- **Wearable sales**: Create and sell wearables that complement your scene's theme. Display wearables on mannequins in-scene as advertisements.
- **Entry fees/token gating**: Charge MANA to enter a premium area, or require ownership of a specific NFT. Always have a free area that showcases what the paid area offers.

### Social Mechanics
- **Cooperative tasks**: Design objectives requiring multiple players (two switches pressed simultaneously, etc.). Reward cooperation with shared benefits.
- **Shared spaces**: Create common areas where players naturally congregate. Add ambient interactive objects that encourage casual interaction.
- **Events**: Design scenes that can host scheduled events (concerts, competitions). Include a stage area with good sightlines. Provide event host controls (start/stop game, reset scene, broadcast messages). Gate host/admin actions server-side with an admin allow-list checked against the server-verified sender (**authoritative-server** Pattern 4) — never trust a client-reported role.

## 9. Tutorial and Onboarding

### In-World Signs
- Place `TextShape` entities with short instructions at key locations.
- Use arrows, glowing outlines, or animated indicators to point to interactive objects.
- Keep text under 10 words per sign.

### NPC Guides
- Use an animated NPC at the scene entrance to greet and instruct.
- Deliver instructions through a dialog system (one message at a time, player advances).
- NPC dialog should be skippable for returning players.

### Progressive Complexity
- Introduce one mechanic at a time. The first interaction should be obvious (a big, glowing button).
- After the player succeeds at the simple task, introduce the next layer.
- Gate advanced mechanics behind early accomplishments.

### Rules: show, don't tell

Two anti-patterns show up constantly in generated games. Both lose players before the first interaction.

- **The rules pop-up.** An intro modal with several dense paragraphs explaining every mechanic, scoring rule and control. Players dismiss it unread. Fix: the pop-up (if any) is one screen, 3–5 lines, ≤ 8 words each, ideally one goal line plus one control line plus one picture/diagram. Everything else is learned by playing.
- **The in-world rulebook.** The same paragraphs on a stylized plane or board in the scene. It looks like design, but the text is too small and too long to read in-world, and players will not stand still and squint. Fix: a sign says one thing (≤ 10 words, large `fontSize`); one sign per idea; put the rest into the level design.

Show instead of tell:
- Make the first target unmistakable: a glowing, animated, or oversized object placed in the player's opening sightline. A pulsing outline teaches "click me" better than a sentence does.
- Teach one mechanic by letting the player do it once safely (tutorial gate, practice target) before the real game starts.
- Use `hoverText` on interactive entities as the just-in-time instruction — it appears exactly when it is relevant and costs no reading up-front.
- Use an image/diagram (a `uiBackground` texture or an in-world plane) for spatial or sequence rules; a picture of "red gems = 1, blue = 5" replaces a paragraph.
- Deliver anything longer through an NPC or a dialog one message at a time, skippable, or as `Timed Announcement`-style hints at the moment they matter.

Text budget as a checklist: intro panel ≤ 5 lines; sign ≤ 10 words; hint ≤ 1 sentence; if a rule needs more than that, redesign the mechanic or show it with visuals.

### Zero-Explanation Test
- Watch real players attempt your scene cold, with no text or instructions; the bar is the MVP checklist's *First action obvious* item. Their confusion is your design feedback.

## 10. Cross-References

| Topic | Skill | When |
|---|---|---|
| Follow/chase a moving target | **animations-tweens** | Entities tracking the player |
| Clicks, proximity, zones, raycasts | **add-interactivity** | Implementing interactions and zone mechanics |
| Multiplayer sync | **multiplayer-sync** | Shared, real-time game state |
| Server-authoritative games, leaderboards, anti-cheat | **authoritative-server** | Scores or prizes at stake |
| In-scene playtest feedback | **scene-feedback** | Collecting player answers |
| Mouselook or spectate cameras | **camera-control** | Custom camera modes |
| Audio-reactive visuals | **audio-analysis** | Visuals driven by music |
| Screen UI, HUD, menus | **build-ui** | Scoreboards, dialogs, on-screen buttons |
| Mobile touch controls, platform detection | **advanced-input** | Customizing on-screen buttons |
| Open Explorer UI panels (map, backpack) | **scene-runtime** | Onboarding shortcuts |
| Pause when the scene is hidden | **scene-runtime** | Full-screen Explorer UI covers the scene |
| Publish timing before live events | **deploy-scene** | Scheduling a launch |
| World storage budget | **deploy-worlds** | Planning file sizes for a World |
| Performance budgets and techniques | **optimize-scene** | Scene over budget or slow |
| Placeholder media during blockout | **creator-hub-mcp** | Greyboxing in the Creator Hub |

This skill focuses on the **design decisions** that shape implementations. For detailed code patterns, see the referenced skills.
