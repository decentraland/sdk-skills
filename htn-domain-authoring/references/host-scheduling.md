# Reactive custom-host scheduling

For a custom `PlanRunner` host, keep an idle result until relevant inputs change. This is an optional
host policy, not a planner option or a change to `GuardAgent`. Use the installed API resolved through
[module-reference.md](module-reference.md); the example matches that guide's baseline.

The game supplies a **wake key** covering every input that can make idle work eligible: jobs/goals,
capabilities, route/resource availability and deadline/observation transitions. Include changes to
previously blocked candidates, not just the selected target. Exclude unrelated UI values and raw frame time.
A deadline crossing needs an event, a relevant time bucket, or a scheduled wake. Otherwise idle can become stale.

Copy this adapter into `src/game/reactive-host.ts` and provide game-owned callbacks. Actions publish their
actual effects; `cancel()` releases their reservations. One action gets an update per host tick.

```ts
import { PlanRunner, type PlanStep } from '../htn-planner/htn/planner'

type Primitive = Extract<PlanStep, { kind: 'primitive' }>
type Action = {
  update(dt: number): 'running' | 'done' | 'failed'
  cancel(): void
}

export class ReactiveHost {
  private planned = false
  private action: Action | null = null
  private sleepKey: string | undefined

  constructor(
    private runner: PlanRunner,
    private publishFacts: () => void,
    private wakeKey: () => string,
    private start: (step: Primitive) => Action
  ) {}

  // Call for invalid work, preemption or shutdown; the next update may plan again.
  invalidate(): void {
    this.action?.cancel()
    this.action = null
    this.runner.clear()
    this.planned = false
    this.sleepKey = undefined
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
        // A failed deferred expansion gets a root recovery attempt next update.
        if (resolution === 'completed') this.sleepKey = this.wakeKey()
        return
      }
      this.planned = true
    }
    const step = this.runner.current()
    if (step === null) throw new Error('Expected a resolved primitive')
    this.action ??= this.start(step)
    const result = this.action.update(dt)
    this.publishFacts()
    if (result === 'running') return
    if (result === 'failed') { this.invalidate(); return }
    this.action = null
    this.runner.complete()
    // Fresh executor effects are visible even to same-update deferred expansion.
    if (this.runner.resolve() !== 'ready') this.planned = false
    // Completion/failure gets one root decision next update; an idle result then sleeps.
  }
}
```

Ordinary wake-key changes do not preempt valid running work in this adapter. The game calls `invalidate()`
when that work becomes invalid or a higher-priority goal must interrupt it. Refresh facts after cancellation;
stop calling `update()` after shutdown. Handle callback exceptions through the game's lifecycle policy.
A whole-world revision is safe only if its unrelated changes cannot create repeated idle decisions.

Before using this policy, check initial empty/no-plan results plus ten unchanged idle updates, new work,
resource/route unblocking, action failure, an unrelated change during a long action, cleanup and deferred
reads of actual effects. Count root and deferred decompositions separately; measure outcomes and whole-host
CPU/work together. These checks validate your wake dependencies, not only this adapter.

A bounded periodic decision is also valid: define its interval in seconds or logical simulation ticks and
measure it. Events can wake it earlier. Neither this example nor `replanThrottle` supplies that scheduler.
