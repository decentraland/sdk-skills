---
name: game-design
description: Plan and design Decentraland games and interactive experiences. Scene limit formulas, performance budgets, texture requirements, asset preloading, state management patterns (module-level, component-based, state machines), object pooling, UX/UI guidelines, input design, and MVP planning. Use when the user wants game design advice, scene architecture, performance planning, or help structuring a game. Do NOT use for specific implementation (see add-interactivity, build-ui, multiplayer-sync).
---

# Decentraland Game Design & Scene Optimization

## 1. DCL Game Design Philosophy

Decentraland is a **continuous, shared 3D world**. Design around these constraints:

- **No startup screen**: The scene is always live. Players walk in from adjacent parcels — there is no splash screen, no "press start." Your scene must be meaningful the instant a player arrives.
- **No forced endings**: You cannot force a "game over" state. Players can leave at any time by walking away or teleporting. Design loops that accommodate drop-in / drop-out naturally.
- **Cannot remove players**: There is no API to eject a player from a scene. You can teleport a player, but only within the existing scene. If you're teleporting outside the scene, you can only do it with their consent (they must accept the prompt). Design around misbehaving players with game mechanics, not eviction. If the scene has admin players, admins are able to ban other players from the scene manually.
- **Boundary awareness**: Players standing outside your parcel can see into it. Your scene is always on display. Neighboring scenes are visible too — consider visual harmony.
- **Shared space**: Multiple players are always potentially present. Even a "single-player" puzzle is witnessed by others. Embrace or account for this.

## 2. Scene Limitation Formulas

Most limits scale with parcel count `n` (triangles, entities, bodies linear; materials, textures, height logarithmic). Key rule of thumb: **10,000 triangles and 200 entities per parcel**.

For the full limits table across all parcel counts, see the **optimize-scene** skill.

## 3. Texture Requirements

- **Dimensions must be power-of-two**: 256, 512, 1024, 2048
- **Recommended sizes**: 1024x1024 for scene objects, 512x512 for wearables
- **Use texture atlases** to combine multiple small textures into one, reducing draw calls and material count
- Prefer compressed formats (WebP) over raw PNG where possible
- Share texture references across materials — do not duplicate texture files

## 4. Asset Preloading

Use the `AssetLoad` component to pre-download large assets before rendering to avoid visible pop-in. Apply to any model over ~1 MB, any asset needed before a game phase starts, and any sound that plays in response to player interaction.

For the implementation pattern, see the **optimize-scene** skill.

## 5. Performance Patterns

### Object Pooling
Reuse entities instead of creating and destroying them:

```typescript
const pool: Entity[] = []

function getFromPool(): Entity {
  const existing = pool.pop()
  if (existing) return existing
  return engine.addEntity()
}

function returnToPool(entity: Entity) {
  Transform.getMutable(entity).position = Vector3.create(0, -100, 0)
  pool.push(entity)
}
```

### LOD (Level of Detail)
Swap models or hide entities based on distance from the player:

```typescript
function lodSystem() {
  const playerPos = Transform.get(engine.PlayerEntity).position
  for (const [entity, transform] of engine.getEntitiesWith(Transform, GltfContainer)) {
    const distance = Vector3.distance(playerPos, transform.position)
    VisibilityComponent.createOrReplace(entity, { visible: distance <= 30 })
  }
}
engine.addSystem(lodSystem)
```

### Draw Call Reduction
- Merge meshes in Blender before export
- Use texture atlases (one material for many objects)
- Limit unique materials — reuse them across entities
- Avoid transparency when possible (transparent objects cost extra draw calls)

### System Optimization
- Do NOT run heavy logic every frame. Use timers:
  ```typescript
  let timer = 0
  function heavySystem(dt: number) {
    timer += dt
    if (timer < 0.5) return // Run every 500ms, not every frame
    timer = 0
    // ... expensive work here
  }
  ```
- Minimize `engine.getEntitiesWith()` queries — cache results when entity sets are stable
- Avoid allocating new objects (Vector3.create, arrays) inside systems that run every frame

### Disable Unused Colliders
Remove collision meshes from decorative objects that players never interact with. This reduces physics body count significantly.

## 6. Input System Design

| Input | Action | Notes |
|---|---|---|
| **E key** | Primary action (`IA_PRIMARY`) | Main interaction |
| **F key** | Secondary action (`IA_SECONDARY`) | Alternate interaction |
| **Pointer click** | `IA_POINTER` | Left mouse click / tap |
| **Keys 1-4** | `IA_ACTION_3` through `IA_ACTION_6` | Action bar slots |

### Design Considerations
- Mouse wheel is **not available** as an input
- Always design for both **desktop and mobile**. Mobile has no keyboard — rely on pointer and on-screen buttons
- Set `maxDistance` on pointer events (8-10 meters typical) to prevent interactions from across the scene
- Use `hoverText` to communicate what an interaction does before the player commits

## 7. State Management Patterns

### Module-Level State (Simple Games)
```typescript
// game-state.ts
export let score = 0
export let gamePhase: 'waiting' | 'playing' | 'ended' = 'waiting'
export function addScore(points: number) { score += points }
```

### Component-Based State (Complex Games)
Use custom components as structured data containers:
```typescript
import { engine, Schemas } from '@dcl/sdk/ecs'

const EnemyState = engine.defineComponent('EnemyState', {
  health: Schemas.Number,
  speed: Schemas.Number,
  target: Schemas.Entity
})
```

### State Machines
Model game phases as explicit states with clear transitions:
```typescript
type GameState = 'lobby' | 'countdown' | 'active' | 'cooldown'
let currentState: GameState = 'lobby'

function gameStateSystem(dt: number) {
  switch (currentState) {
    case 'lobby': handleLobby(dt); break
    case 'countdown': handleCountdown(dt); break
    case 'active': handleActive(dt); break
    case 'cooldown': handleCooldown(dt); break
  }
}
```

## 8. UX/UI Guidelines

- **Keep UI minimal**: The metaverse is about 3D presence, not 2D overlays. Avoid large HUDs that obscure the world.
- **Prefer spatial UI**: Use `TextShape` on entities and 3D signs over screen-space UI whenever the information is tied to a place or object.
- **Clear affordances**: Interactive objects should look interactive. Use glow effects, outlines, floating indicators, or subtle animations to signal "you can click this."
- **Sound feedback**: Every significant player action should produce audio feedback. It confirms the action registered and adds polish.
- **Progressive disclosure**: Do not dump all information at once. Reveal mechanics and story as the player engages. Start simple, layer complexity.
- **Immediate feedback**: When a player interacts, respond within the same frame. Use tweens, sounds, or UI popups so the player never wonders "did that work?"
- **Accessibility**: Use high-contrast text, readable font sizes (fontSize >= 16 for screen UI), and audio cues alongside visual ones.

## 9. MVP Planning

### Start with the Core Loop
Ask: **What does the player DO?** The answer should be a single sentence:
- "The player explores rooms and finds hidden objects."
- "The player races other players through an obstacle course."
- "The player collects resources and builds structures."

### Prototype Fast
- Build in **1-2 parcels** first, even if the final scene will be larger
- Use primitive shapes (boxes, spheres) as placeholders — do not wait for final art
- Get the core loop working before adding any secondary features

### Test Early
- Deploy to a test world and walk through it yourself
- Invite 2-3 real players and watch them (do not explain the game — see if it is self-explanatory)
- Measure: Do players understand what to do within 30 seconds?

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
- [ ] **Mobile compatible**: Core interactions work without a keyboard (pointer-only inputs available).

> **Starting from scratch?** See the **create-scene** skill first to scaffold the project before designing the game.

## 11. Game Loop Archetypes

### Exploration
- **Core loop**: Discover locations, find hidden items, unlock areas.
- **DCL fit**: Excellent. The 3D world and spatial navigation are strengths.
- **Design tips**: Use landmarks for wayfinding. Reward curiosity with hidden content. Use lighting and sound to guide attention.

### Collection
- **Core loop**: Gather items, complete sets, earn rewards.
- **DCL fit**: Strong. Combines well with exploration and daily engagement.
- **Design tips**: Use entity pooling for collectibles. Scatter items spatially. Tie collections to visual progress (display cases, counters).

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

## 12. Spatial Design

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

### Parcel Transitions
- If your scene spans multiple parcels, ensure smooth visual transitions.
- Do not place critical interactive elements right at parcel boundaries (loading edge cases).
- Use open space at parcel edges as buffer zones.

## 13. Engagement and Monetization

### Engagement Patterns
- **Daily rewards**: Offer small rewards for daily visits. Track visits via external server — DCL has no built-in daily tracking. Display streak counters in-scene.
- **Progression systems**: Levels or unlockable content tied to cumulative play. Store progress on a server or use NFT-based progression. Show progression visually (leaderboards, badges, evolving scene elements).
- **Achievements**: Define clear milestones (first win, 100 collectibles, visited all rooms). Announce with sound and visual effects. Display achievement history in-scene (trophy room, wall of fame).

### Monetization Approaches
- **In-scene purchases**: Sell virtual items or abilities via MANA transactions. Use `signedFetch` for secure server-verified purchases. Always provide free gameplay alongside paid upgrades.
- **Wearable sales**: Create and sell wearables that complement your scene's theme. Display wearables on mannequins in-scene as advertisements.
- **Entry fees/token gating**: Charge MANA to enter a premium area, or require ownership of a specific NFT. Always have a free area that showcases what the paid area offers.

### Social Mechanics
- **Cooperative tasks**: Design objectives requiring multiple players (two switches pressed simultaneously, etc.). Reward cooperation with shared benefits.
- **Shared spaces**: Create common areas where players naturally congregate. Add ambient interactive objects that encourage casual interaction.
- **Events**: Design scenes that can host scheduled events (concerts, competitions). Include a stage area with good sightlines. Provide event host controls (start/stop game, reset scene, broadcast messages).

## 14. Tutorial and Onboarding

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

### Zero-Explanation Test
- If a new player cannot figure out the first action within 30 seconds without any text or instructions, the design needs work.
- Watch real players attempt your scene cold. Their confusion is your design feedback.

## 10. Cross-References

| Topic | Skill | When to Use |
|---|---|---|
| Interactivity, input handling, raycasting | **add-interactivity** | Implementing click handlers, triggers, input |
| Multiplayer sync, server communication | **multiplayer-sync** | Networked game state, real-time sync |
| Screen UI, React-ECS, HUD elements | **build-ui** | Building menus, scoreboards, dialogs |
| Performance optimization, entity/triangle budgets | **optimize-scene** | Detailed optimization techniques |

This skill focuses on the **design decisions and optimization constraints** that shape implementations. For detailed code patterns, see the referenced skills.
