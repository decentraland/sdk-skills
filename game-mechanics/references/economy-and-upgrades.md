# Economy & Upgrades

In-game currency (gold, credits, points) plus purchase, sell/refund, and data-driven upgrade tracks. The core of tower-defense towers, shop mechanics, and progression. Keep the economy logic pure and separate from rendering so it can move between local, synced, or server-validated storage without a rewrite.

---

## Currency manager

```typescript
export type EconomyEvents = {
  onChange?: (balance: number, delta: number) => void
}

export class Economy {
  constructor(private balance: number, private events: EconomyEvents = {}) {}

  get amount() { return this.balance }

  canAfford(cost: number): boolean { return this.balance >= cost }

  // Attempt to spend. Returns false and changes nothing if unaffordable.
  spend(cost: number): boolean {
    if (cost < 0 || !this.canAfford(cost)) return false
    this.balance -= cost
    this.events.onChange?.(this.balance, -cost)
    return true
  }

  earn(amount: number) {
    if (amount <= 0) return
    this.balance += amount
    this.events.onChange?.(this.balance, amount)
  }
}
```

Bind `onChange` to your HUD so the balance display updates immediately (see **build-ui**). Grant wave rewards through `earn` (see `{baseDir}/references/wave-spawner.md`).

---

## Purchase, sell, and refund

Track **invested value** per purchasable so refunds are proportional to what was actually spent (base cost + all upgrades), not a flat rate on base cost.

```typescript
export const SELL_REFUND_RATE = 0.7 // sell for 70% of total invested

export type Purchasable = {
  invested: number   // total currency put into this item so far
}

// Buy something for `cost`. Returns the created record or null if unaffordable.
export function purchase(economy: Economy, cost: number): Purchasable | null {
  if (!economy.spend(cost)) return null
  return { invested: cost }
}

export function sellValue(item: Purchasable, rate = SELL_REFUND_RATE): number {
  return Math.floor(item.invested * rate)
}

export function sell(economy: Economy, item: Purchasable, rate = SELL_REFUND_RATE): number {
  const refund = sellValue(item, rate)
  economy.earn(refund)
  return refund
}
```

---

## Upgrade tracks as data

Model each upgrade path as an array indexed by level. Level 0 is the base; each entry holds the cost to reach that level and the stats granted there. This makes balancing a data edit, not a code change.

```typescript
export type UpgradeLevel = {
  cost: number                  // currency to REACH this level from the previous one
  stats: Record<string, number> // e.g. { damage: 10, range: 6, fireRate: 1.5 }
}

// Index 0 = starting stats (cost is the base purchase price).
export const TOWER_TRACK: UpgradeLevel[] = [
  { cost: 50,  stats: { damage: 10, range: 6,  fireRate: 1.0 } },
  { cost: 40,  stats: { damage: 18, range: 6,  fireRate: 1.2 } },
  { cost: 80,  stats: { damage: 30, range: 7,  fireRate: 1.5 } },
]

export type Upgradable = Purchasable & { level: number; track: UpgradeLevel[] }

export function currentStats(u: Upgradable): Record<string, number> {
  return u.track[u.level].stats
}

export function nextUpgradeCost(u: Upgradable): number | null {
  const next = u.level + 1
  return next < u.track.length ? u.track[next].cost : null // null = max level
}

export function canUpgrade(economy: Economy, u: Upgradable): boolean {
  const cost = nextUpgradeCost(u)
  return cost !== null && economy.canAfford(cost)
}

// Apply an upgrade: charge, bump level, accumulate invested value for refunds.
export function upgrade(economy: Economy, u: Upgradable): boolean {
  const cost = nextUpgradeCost(u)
  if (cost === null || !economy.spend(cost)) return false
  u.level += 1
  u.invested += cost
  return true
}

// Build a tower record when first purchased.
export function buyTower(economy: Economy, track: UpgradeLevel[]): Upgradable | null {
  const base = track[0].cost
  if (!economy.spend(base)) return null
  return { invested: base, level: 0, track }
}
```

`sell(economy, tower)` then refunds `floor(tower.invested * rate)`, correctly accounting for every upgrade paid for. Read live combat stats from `currentStats(tower)` in the targeting/firing loop (see `{baseDir}/references/combat-behaviors.md`).

---

## Where the economy must live (multiplayer fairness)

The right storage depends entirely on whether currency is shared and whether it matters:

| Scope                      | Storage                                                                                                                               | When                                                                                                  | Risk                                                                                                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Per-player, local**      | Module variable / component on this client only                                                                                       | Single-player-style defense where each visitor has their own board and gold                           | None — nothing shared. Client can trivially cheat its own display, but it affects no one else.                                |
| **Shared, cooperative**    | `syncEntity` on a currency component (see **multiplayer-sync**)                                                                       | Co-op games where players share one treasury                                                          | Any client can write the synced value; a modified client can grant itself gold. Acceptable for casual co-op, not for rewards. |
| **Validated / persistent** | Server owns the balance; clients request spends via `signedFetch`, server validates and responds; or an authoritative-server holds it | Competitive economies, real rewards (MANA, wearables, leaderboards), anything a cheater would exploit | Server is the source of truth; clients cannot fabricate balances.                                                             |

Rule of thumb: **if winning the currency has real value or affects other players, it must be server-validated.** Use `signedFetch` so the server can verify the player's wallet identity on each transaction (see **scene-runtime** and **authoritative-server**). Never trust a client-reported balance for anything that grants a real reward.

---

## Multiplayer note

For a shared treasury, wrap `Economy`'s backing number in a synced custom component and reconcile with last-write-wins semantics (`syncEntity`). Because concurrent spends can race, prefer requesting spends through a single authority (server) rather than mutating a synced number from every client. See **authoritative-server** for validated transactions.
