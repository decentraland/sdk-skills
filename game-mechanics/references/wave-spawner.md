# Wave Spawner

A data-driven system for spawning enemies in timed waves and walking them along a fixed path — the core of tower-defense and horde games. Waves are plain data; a manager system drives spawning, between-wave countdowns, and lifecycle callbacks.

Design principles:

- **Waves are data, not code.** Define them as arrays so difficulty is tunable and, if needed, loadable from a server.
- **One driver system.** A single `engine.addSystem` tick advances the current wave, spawn timers, and countdowns.
- **Pool enemies.** Never `addEntity`/`removeEntity` per spawn at scale — reuse. See **optimize-scene**.
- **Path-follow with Tweens.** Waypoint-to-waypoint motion is a `TweenSequence`; the SDK renderer interpolates, so no per-frame position math is needed.

---

## Wave data model

```typescript
import { Vector3 } from '@dcl/sdk/math'

// One contiguous burst of identical enemies within a wave.
export type WaveGroup = {
  enemyType: string   // key into your enemy factory
  count: number       // how many to spawn
  interval: number    // ms between spawns within this group
}

export type WaveDefinition = {
  groups: WaveGroup[]
  reward?: number      // bonus currency granted when the wave is cleared
  preDelay?: number    // ms to wait before this wave's first spawn
}

// The ordered path enemies walk, in scene-local coordinates.
export const PATH: Vector3[] = [
  Vector3.create(2, 0.5, 2),
  Vector3.create(2, 0.5, 14),
  Vector3.create(14, 0.5, 14),
  Vector3.create(14, 0.5, 2),
]

export const WAVES: WaveDefinition[] = [
  { groups: [{ enemyType: 'grunt', count: 5, interval: 900 }], reward: 20, preDelay: 2000 },
  { groups: [
      { enemyType: 'grunt', count: 8, interval: 700 },
      { enemyType: 'runner', count: 3, interval: 500 },
    ], reward: 35, preDelay: 4000 },
]
```

**Minimum spawn spacing.** Space spawns so models never visually overlap at the spawn point. A safe floor: `minInterval = (enemyDepth / enemySpeed) * 1000 * 1.2` ms, where `enemyDepth` is the model's footprint length along the path (metres) and `enemySpeed` is metres/second. Clamp each group's `interval` to at least this value. For a 1 m enemy at 2 m/s that is ~600 ms.

---

## Path-following via TweenSequence

Give each enemy a `Tween` for the first leg and a `TweenSequence` for the rest. The renderer interpolates position; `faceDirection: true` on the `Move` turns the model to face travel direction. Detect arrival at the exit with `tweenSystem.tweenCompleted`.

```typescript
import {
  engine, Entity, Transform, Tween, TweenSequence,
  tweenSystem, EasingFunction,
} from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

const SPEED = 2 // metres per second

function legDuration(from: Vector3, to: Vector3): number {
  return (Vector3.distance(from, to) / SPEED) * 1000
}

// Send an entity walking through PATH from index 0. Returns nothing;
// arrival is detected in the driver system below.
export function startPath(enemy: Entity, path: Vector3[]) {
  Transform.createOrReplace(enemy, { position: path[0] })

  // First leg as the base Tween.
  Tween.createOrReplace(enemy, {
    mode: Tween.Mode.Move({ start: path[0], end: path[1], faceDirection: true }),
    duration: legDuration(path[0], path[1]),
    easingFunction: EasingFunction.EF_LINEAR,
  })

  // Remaining legs as a sequence chained off the base tween.
  const rest = []
  for (let i = 1; i < path.length - 1; i++) {
    rest.push({
      mode: Tween.Mode.Move({ start: path[i], end: path[i + 1], faceDirection: true }),
      duration: legDuration(path[i], path[i + 1]),
      easingFunction: EasingFunction.EF_LINEAR,
    })
  }
  // No loop: enemy stops at the exit (last waypoint), where we detect completion.
  TweenSequence.createOrReplace(enemy, { sequence: rest })
}
```

> If you prefer explicit control (variable speed from status effects, mid-path retargeting), replace the tween approach with a per-frame lerp system that advances a `progress` field on a custom component and writes `Transform.position`. Tweens are simpler and cheaper for constant-speed paths; a lerp system is needed when speed changes every frame (see **status-effects** for slow effects that scale speed).

---

## Wave manager

A single driver system. It walks the wave list, honours `preDelay`, spaces spawns per group, tracks alive enemies, and fires lifecycle callbacks. `timers.setTimeout` handles the between-wave countdown.

For the complete, self-contained manager (spawn loop, alive-count tracking, `onWaveStart` / `onWaveComplete` / `onAllWavesComplete` callbacks, `skipToNextWave`, and pool integration), see the worked implementation below.

```typescript
import { engine, Entity, Transform, tweenSystem } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'
import { timers } from '@dcl/sdk/ecs'

type WaveCallbacks = {
  onWaveStart?: (waveIndex: number, total: number) => void
  onWaveComplete?: (waveIndex: number, reward: number) => void
  onAllWavesComplete?: () => void
  onEnemyReachedExit?: (enemy: Entity) => void  // e.g. player loses a life
  onEnemyKilled?: (enemy: Entity) => void
}

export class WaveManager {
  private waveIndex = -1
  private spawning = false
  private alive = new Set<Entity>()
  private pending = 0            // enemies still to spawn this wave
  private betweenWaves = false

  constructor(
    private waves: WaveDefinition[],
    private path: Vector3[],
    private spawnEnemy: (type: string) => Entity, // factory (pooled)
    private cb: WaveCallbacks = {},
  ) {
    engine.addSystem((dt) => this.update(dt))
  }

  start() { this.beginNextWave() }

  private beginNextWave() {
    this.waveIndex++
    if (this.waveIndex >= this.waves.length) { this.cb.onAllWavesComplete?.(); return }
    const wave = this.waves[this.waveIndex]
    this.betweenWaves = false
    timers.setTimeout(() => this.runWave(wave), wave.preDelay ?? 0)
  }

  private runWave(wave: WaveDefinition) {
    this.cb.onWaveStart?.(this.waveIndex, this.waves.length)
    this.spawning = true
    this.pending = wave.groups.reduce((n, g) => n + g.count, 0)

    // Schedule every spawn up-front using timers, respecting per-group intervals.
    let clock = 0
    for (const g of wave.groups) {
      for (let i = 0; i < g.count; i++) {
        timers.setTimeout(() => this.spawnOne(g.enemyType), clock)
        clock += g.interval
      }
    }
    // When the last spawn has fired, spawning is done; wave clears when alive hits 0.
    timers.setTimeout(() => { this.spawning = false }, clock)
  }

  private spawnOne(type: string) {
    const e = this.spawnEnemy(type)
    startPath(e, this.path)
    this.alive.add(e)
    this.pending--
  }

  // Call from combat when an enemy dies.
  killEnemy(e: Entity) {
    if (!this.alive.has(e)) return
    this.alive.delete(e)
    this.cb.onEnemyKilled?.(e)
  }

  private update(_dt: number) {
    // Detect enemies that finished their path (reached the exit).
    for (const e of [...this.alive]) {
      if (tweenSystem.tweenCompleted(e)) {
        this.alive.delete(e)
        this.cb.onEnemyReachedExit?.(e)
      }
    }
    // Wave cleared: no pending spawns, none alive, not already counting down.
    if (!this.spawning && !this.betweenWaves && this.pending === 0 && this.alive.size === 0
        && this.waveIndex >= 0 && this.waveIndex < this.waves.length) {
      this.betweenWaves = true
      const reward = this.waves[this.waveIndex].reward ?? 0
      this.cb.onWaveComplete?.(this.waveIndex, reward)
      this.beginNextWave()
    }
  }

  // Optional: let a UI button skip the pre-delay of the next wave.
  skipToNextWave() { /* clear the active preDelay timer id and call runWave immediately */ }
}
```

Notes:

- `tweenSystem.tweenCompleted(entity)` returns `true` on the frame the entity's tween (or last sequence leg) finishes — this is how "reached the exit" is detected without polling positions.
- Grant the wave `reward` through the **economy** system (`economy.earn(reward)`); do not hard-code currency here.
- To pool enemies, have `spawnEnemy` pull from a free list and re-`createOrReplace` its components rather than `addEntity`. Return killed/exited enemies to the pool inside `onEnemyKilled` / `onEnemyReachedExit`. See **optimize-scene**.

---

## Multiplayer

In a shared tower-defense game, run the wave manager on **one authority** and let others observe, otherwise every client spawns its own copy of every enemy. Two viable approaches:

- **Server-authoritative (recommended for competitive/shared economy):** the headless server owns wave state and spawns synced enemy entities; clients only render and click. See **authoritative-server**.
- **Serverless shared:** elect one client as host (e.g. first to arrive) to run `WaveManager`, and `syncEntity` the enemy entities so others see them. Reward/economy must still be reconciled carefully. See **multiplayer-sync**.

For a **local-only** single-player defense (each visitor plays their own instance), run the manager on every client with no sync — the simplest option, and fine when players do not share the same board.
