# Reactive custom-host scheduling

For a custom `PlanRunner` host, keep an idle result until relevant inputs change. This is an optional
host policy, not a planner option or a change to `GuardAgent`. Use the installed API resolved through
[module-reference.md](module-reference.md); the example matches that guide's baseline.

The game supplies a **wake key** covering every input that can make idle work eligible: jobs/goals,
capabilities, route/resource availability and deadline/observation transitions. Include changes to
previously blocked candidates, not just the selected target. Exclude unrelated UI values and raw frame time.
A deadline crossing needs an event, a relevant time bucket, or a scheduled wake. Otherwise idle can become stale.

Copy this adapter into `src/game/reactive-host.ts` and provide game-owned callbacks. Actions publish their
actual effects. `cancel()` is idempotent: release only reservation tokens still owned by that action,
even if failure already cleaned up or the same owner ID acquired a newer token. One action updates per host tick.

```ts
import { PlanRunner, type PlanStep } from '../htn-planner/htn/planner'

type Primitive = Extract<PlanStep, { kind: 'primitive' }>
type Action = {
  update(dt: number): 'running' | 'done' | 'failed'
  cancel(): void // Safe after failure cleanup; never release a newer owner's lease.
}

export class ReactiveHost {
  private planned = false
  private action: Action | null = null
  private sleepKey: string | undefined
  private failedKey: string | undefined
  private failures = 0

  constructor(
    private runner: PlanRunner,
    private publishFacts: () => void,
    private wakeKey: () => string,
    private start: (step: Primitive) => Action
  ) {}

  // A game event can cancel work and deliberately re-arm a sleeping host.
  invalidate(): void {
    this.drop()
    this.sleepKey = this.failedKey = undefined
    this.failures = 0
  }

  private drop(): void {
    const action = this.action
    this.action = null
    this.runner.clear()
    this.planned = false
    action?.cancel()
  }

  private recover(): void {
    this.drop()
    this.publishFacts()
    const key = this.wakeKey() // After cleanup, not a temporary held reservation.
    this.failures = key === this.failedKey ? this.failures + 1 : 1
    this.failedKey = key
    this.sleepKey = this.failures >= 2 ? key : undefined // One retry, then sleep.
  }

  update(dt: number): void {
    this.publishFacts()
    if (!this.planned) {
      const key = this.wakeKey()
      if (key === this.sleepKey) return
      this.sleepKey = undefined
      const status = this.runner.plan('behave')
      if (status !== 'succeeded' && status !== 'no_plan') throw new Error(status)
      const resolution = status === 'no_plan' ? 'completed' : this.runner.resolve()
      if (resolution !== 'ready') {
        // Repeated deferred failure shares the same bounded retry policy as actions.
        if (resolution === 'completed') {
          this.sleepKey = this.wakeKey()
          if (status === 'succeeded') { this.failedKey = undefined; this.failures = 0 }
        } else this.recover()
        return
      }
      this.planned = true
    }
    const step = this.runner.current()
    if (step === null) throw new Error('Expected a resolved primitive')
    if (this.action === null) {
      const action = this.start(step)
      if (!this.planned) { action.cancel(); return } // start() invalidated this plan.
      this.action = action
    }
    const result = this.action.update(dt)
    this.publishFacts()
    if (result === 'running') return
    if (result === 'failed') { this.recover(); return }
    this.action = null
    this.runner.complete()
    // Fresh executor effects are visible even to same-update deferred expansion.
    const resolution = this.runner.resolve()
    if (resolution === 'failed') this.recover()
    else if (resolution === 'completed') {
      this.planned = false
      this.failedKey = undefined
      this.failures = 0 // Reset only after the whole plan, not a completed prefix.
    }
    // Full completion gets one root decision next update; an idle result then sleeps.
  }
}
```

Ordinary wake-key changes do not preempt valid running work in this adapter. The game calls `invalidate()`
when that work becomes invalid or a higher-priority goal must interrupt it. Refresh facts after cancellation;
stop calling `update()` after shutdown. Handle callback exceptions through the game's lifecycle policy.
A synchronous `start()` callback may invalidate the plan; its returned action is cancelled before adoption.
Recursive `update()` calls from callbacks are outside this example's contract.
The sample cancels only its current action. Completed actions release their obligations, or transfer
plan-spanning obligations to game-owned cleanup that you add to `drop()` before using this adapter.

On failure this adapter permits one recovery attempt, then sleeps until a meaningful wake-key change or
explicit `invalidate()`. That call deliberately resets the retry budget: use it for game events, not every
frame or from automatic failure handling. A full plan completion also resets the budget; a successful
primitive/prefix does not. Keep per-attempt counters, own lease churn and unrelated progress out of the
semantic key. A whole-world revision is suitable only if unrelated writes cannot re-arm repeated failures.

A repair with no observable key change needs an explicit event or scheduled wake. This policy cannot discover
missing dependencies. Record repeated failures for diagnosis instead of treating retries as successful progress.

Before using this policy, check initial empty/no-plan results plus ten unchanged idle updates, new work,
resource/route unblocking, persistent action/deferred failure, a successful prefix before failure, an unrelated
change during a long action, late/repeated cancellation and deferred
reads of actual effects. Count root and deferred decompositions separately; measure outcomes and whole-host
CPU/work together. These checks validate your wake dependencies, not only this adapter.

A bounded periodic decision is also valid: define its interval in seconds or logical simulation ticks and
measure it. Events can wake it earlier. Neither this example nor `replanThrottle` supplies that scheduler.
