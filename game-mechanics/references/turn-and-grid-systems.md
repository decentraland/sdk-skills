# Turn & Grid Systems

Two cooperating systems for discrete, grid-based games (sokoban, sliding puzzles, tactics, snake-likes, match-3, board games):

1. **TurnManager** — controls *when* the game advances (timing model + phase cycle).
2. **BoardManager** — holds *what* is on the grid (2D cell state, entity tracking, undo).

Grid games have no physics and no continuous movement. Everything is a discrete cell transition, and **input is locked while animations play** so state cannot be corrupted mid-resolution.

---

## Part A — TurnManager

### Four timing modes

| Mode | Behaviour | Use case |
|---|---|---|
| `step` | Each input = exactly one game step, processed immediately | Sokoban, sliding puzzles |
| `turn` | N actions per turn, then the turn ends (manually or after N) | Tactics, chess-like |
| `realtime` | A timer fires ticks; player input is buffered between ticks | Snake, falling-block games |
| `freeform` | No turn structure; every input processes on its own | Match-3, free placement |

### The phase cycle — and why it exists

```
WAITING  → PROCESSING → ANIMATING → CHECKING → (back to WAITING)
```

- **WAITING** — accepting player input.
- **PROCESSING** — resolving the logical result of the input (move pieces in data, compute captures). No animation yet.
- **ANIMATING** — playing tweens for the resolution. **Input is locked here.**
- **CHECKING** — evaluating win/lose/chain conditions after animations settle, then returning to WAITING (or ending the game).

**Why lock input during ANIMATING?** If the player could issue a second move while the first is still tweening, both moves would read/write the board mid-transition and produce a corrupted state (a piece animating from A→B is logically "at B" but visually between them; a new input could move it from A again, or resolve a capture that the animation has not shown). Locking input until animations finish guarantees game state and its visual representation stay consistent. This is the single most important reason grid games use an explicit phase machine instead of resolving input inline.

```typescript
import { engine } from '@dcl/sdk/ecs'

export type TimingMode = 'step' | 'turn' | 'realtime' | 'freeform'
export type Phase = 'WAITING' | 'PROCESSING' | 'ANIMATING' | 'CHECKING'

export type TurnConfig = {
  mode: TimingMode
  actionsPerTurn?: number    // 'turn' mode; default 1
  realtimeIntervalMs?: number // 'realtime' mode; default 500
}

export class TurnManager {
  phase: Phase = 'WAITING'
  turnNumber = 0
  private actionsThisTurn = 0
  private tickAccum = 0

  constructor(
    private config: TurnConfig,
    private hooks: {
      onProcess: () => void            // resolve logic; enqueue animations
      onAnimationsDone?: () => boolean // return true to loop PROCESSING again (chains)
      onCheck: () => void              // win/lose after settle
      onTurnStart?: (n: number) => void
      onTurnEnd?: (n: number) => void
      onRealtimeTick?: () => void
    },
  ) {
    engine.addSystem((dt) => this.update(dt))
  }

  get acceptingInput(): boolean { return this.phase === 'WAITING' }

  // Called by input handlers (pointer click, E key). Ignored unless WAITING.
  submitAction(): boolean {
    if (this.phase !== 'WAITING') return false
    if (this.turnNumber === 0) this.beginTurn()
    this.phase = 'PROCESSING'
    this.hooks.onProcess()          // caller enqueues tweens during this
    this.phase = 'ANIMATING'        // stay here until animations report done
    this.actionsThisTurn++
    return true
  }

  // Caller signals its enqueued animations have finished (see BoardManager/animation gate).
  reportAnimationsComplete() {
    if (this.phase !== 'ANIMATING') return
    const chain = this.hooks.onAnimationsDone?.() ?? false
    if (chain) { this.phase = 'PROCESSING'; this.hooks.onProcess(); this.phase = 'ANIMATING'; return }
    this.phase = 'CHECKING'
    this.hooks.onCheck()
    this.endStepOrTurn()
    this.phase = 'WAITING'
  }

  private beginTurn() { this.turnNumber++; this.actionsThisTurn = 0; this.hooks.onTurnStart?.(this.turnNumber) }

  private endStepOrTurn() {
    if (this.config.mode === 'turn') {
      const max = this.config.actionsPerTurn ?? 1
      if (this.actionsThisTurn >= max) { this.hooks.onTurnEnd?.(this.turnNumber); this.beginTurn() }
    } else {
      // step / realtime / freeform: each processed action is its own turn boundary
      this.hooks.onTurnEnd?.(this.turnNumber); this.beginTurn()
    }
  }

  private update(dt: number) {
    if (this.config.mode !== 'realtime' || this.phase !== 'WAITING') return
    this.tickAccum += dt * 1000
    const interval = this.config.realtimeIntervalMs ?? 500
    if (this.tickAccum >= interval) {
      this.tickAccum = 0
      this.hooks.onRealtimeTick?.()
      this.submitAction() // a realtime tick is an automatic action
    }
  }
}
```

> **Animation gate.** `reportAnimationsComplete()` must be called after your enqueued tweens finish. Track them with `tweenSystem.tweenCompleted(entity)` in a small system, or with a `timers.setTimeout` matching the tween duration for simple cases. Keep the manager in `ANIMATING` until then so input stays locked (see **animations-tweens**).

---

## Part B — BoardManager

Holds a 2D array of cell-state integers, maps between grid and scene coordinates, tracks which entity sits on which cell, and supports undo via state snapshots.

```typescript
import { Entity } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

export type GridPos = { x: number; y: number }

export class BoardManager {
  cells: number[][]                       // cells[y][x] = cell-state value
  private entities = new Map<string, { id: Entity; x: number; y: number; type: string }>()
  private history: string[] = []          // serialized snapshots for undo

  constructor(
    public width: number,
    public height: number,
    public cellSize: number,              // metres per cell in the scene
    public origin: Vector3,               // scene position of cell (0,0) centre
    fill = 0,
  ) {
    this.cells = Array.from({ length: height }, () => Array<number>(width).fill(fill))
  }

  inBounds(x: number, y: number) { return x >= 0 && y >= 0 && x < this.width && y < this.height }
  getCell(x: number, y: number) { return this.inBounds(x, y) ? this.cells[y][x] : -1 }
  setCell(x: number, y: number, v: number) { if (this.inBounds(x, y)) this.cells[y][x] = v }

  // Grid → scene: lay the board flat on the parcel floor (X→X, Y→Z).
  gridToWorld(x: number, y: number): Vector3 {
    return Vector3.create(
      this.origin.x + x * this.cellSize,
      this.origin.y,
      this.origin.z + y * this.cellSize,
    )
  }
  worldToGrid(p: Vector3): GridPos {
    return {
      x: Math.round((p.x - this.origin.x) / this.cellSize),
      y: Math.round((p.z - this.origin.z) / this.cellSize),
    }
  }

  // Entity-on-cell tracking (by a stable string key you assign, e.g. "box1").
  placeEntity(key: string, id: Entity, x: number, y: number, type: string) {
    this.entities.set(key, { id, x, y, type })
  }
  moveEntity(key: string, x: number, y: number) {
    const e = this.entities.get(key); if (e) { e.x = x; e.y = y }
  }
  entityAt(x: number, y: number) {
    for (const e of this.entities.values()) if (e.x === x && e.y === y) return e
    return null
  }
  removeEntity(key: string) { this.entities.delete(key) }

  // Undo via snapshot serialization.
  pushState() {
    this.history.push(JSON.stringify({
      cells: this.cells,
      entities: [...this.entities.entries()],
    }))
  }
  popState(): boolean {
    const snap = this.history.pop()
    if (!snap) return false
    const data = JSON.parse(snap)
    this.cells = data.cells
    this.entities = new Map(data.entities)
    return true
  }
  get canUndo() { return this.history.length > 0 }
}
```

**Wiring it up (step-mode sokoban sketch):** call `board.pushState()` before applying a move; on player input, resolve the push in `onProcess` (update `cells`/entity positions and enqueue a `Tween` to `gridToWorld(...)` for the moved model); when the tween completes, call `turnManager.reportAnimationsComplete()`; check the win condition in `onCheck`. An undo button calls `board.popState()` then re-syncs every tracked entity's `Transform` to `gridToWorld(e.x, e.y)`.

> **Custom per-entity state (HP, cooldowns) is not in the snapshot.** `pushState` only serializes cell values and entity grid positions. If pieces have HP or flags, extend the snapshot to capture and restore that data too.

### Board layout variants

- **3D board on the parcel floor (default above):** grid Y maps to scene Z, board lies flat; entities are `GltfContainer`/`MeshRenderer` at `gridToWorld(...)`. Player clicks cells via pointer raycast on per-cell colliders (see **add-interactivity**).
- **Wall-mounted board:** map grid Y to scene Y instead of Z (`origin.y + y*cellSize`, fixed Z) to hang the board vertically on a wall.
- **Pure UI board:** skip scene entities entirely and render the grid as a React-ECS flex grid of clickable `UiEntity` cells (good for match-3 / card boards). See **build-ui** and `{baseDir}/references/ui-game-systems.md`.

---

## Multiplayer

A grid game is turn-based, which suits networking well but demands a **single source of truth** for the board — two clients resolving the same move independently will diverge.

- **Shared board (co-op or hotseat):** `syncEntity` the board-state (store `cells` in a synced custom component, or sync each piece entity's `Transform`) and gate whose input is accepted by turn. See **multiplayer-sync**.
- **Competitive / anti-cheat:** validate every move on a server so a client cannot fabricate board states. See **authoritative-server**.
- **Local-only puzzle:** no sync — each visitor solves their own board. Simplest and common for single-player puzzles in a shared space.
