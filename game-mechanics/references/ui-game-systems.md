# UI Game Systems

Menu- and card-driven game systems built entirely from React-ECS primitives (`UiEntity`, `Label`, `Button`) plus in-world `TextShape` for floating feedback. Covers quiz/trivia, a card hand/deck, dialogue sequencing, turn-based battle flow, and game-feel feedback (floating 3D text, combo counters).

**Build everything from scratch with React-ECS.** There is no widget library to install — do not use or reference `dcl-ui-toolkit`. See **build-ui** for the React-ECS primitives, the `ReactEcsRenderer.setUiRenderer(...)` setup, and the module-level-state model (React hooks are unavailable; the UI re-renders every frame from module variables).

**Text contrast is mandatory.** All game text sits over varying backgrounds (3D world, screenshots, other UI). Give it a contrast treatment so it stays legible:

- **3D `TextShape`:** set `outlineWidth` (e.g. `0.15`) and a dark `outlineColor` (`Color3`).
- **UI text:** place it on a solid/semi-opaque panel `uiBackground`, or layer a dark offset copy of the `Label` behind it as a drop shadow.

All timing uses `timers.setTimeout` / `timers.setInterval` from `@dcl/sdk/ecs` (never native JS timers). See **scene-runtime**.

---

## 1. Quiz / trivia

Question data → choice buttons → scoring → per-question timer.

```typescript
import ReactEcs, { UiEntity, Label, Button } from '@dcl/sdk/react-ecs'
import { ReactEcsRenderer } from '@dcl/sdk/react-ecs'
import { Color4 } from '@dcl/sdk/math'
import { timers } from '@dcl/sdk/ecs'

export type Question = { prompt: string; choices: string[]; correct: number }

const QUESTIONS: Question[] = [
  { prompt: 'What powers a Decentraland scene?', choices: ['SDK7', 'Flash', 'jQuery', 'PHP'], correct: 0 },
]

// --- module-level state (no React hooks) ---
let qIndex = 0
let score = 0
let answered = false
let timeLeft = 10          // seconds
let quizActive = false

export function startQuiz() {
  qIndex = 0; score = 0; answered = false; timeLeft = 10; quizActive = true
  runTimer()
}

function runTimer() {
  const id = timers.setInterval(() => {
    if (!quizActive) { timers.clearInterval(id); return }
    if (answered) return
    timeLeft -= 1
    if (timeLeft <= 0) { timers.clearInterval(id); onAnswer(-1) } // timeout = wrong
  }, 1000)
}

function onAnswer(choice: number) {
  if (answered) return
  answered = true
  if (choice === QUESTIONS[qIndex].correct) score += 1
  timers.setTimeout(nextQuestion, 1200) // brief feedback pause
}

function nextQuestion() {
  qIndex += 1
  if (qIndex >= QUESTIONS.length) { quizActive = false; return }
  answered = false; timeLeft = 10; runTimer()
}

function choiceColor(i: number): Color4 {
  if (!answered) return Color4.create(0.15, 0.2, 0.35, 0.95)
  if (i === QUESTIONS[qIndex].correct) return Color4.create(0.1, 0.6, 0.2, 0.95) // green
  return Color4.create(0.6, 0.15, 0.15, 0.95)                                    // red
}

export const QuizUI = () => {
  if (!quizActive) return <UiEntity uiTransform={{ width: '100%', height: '100%', display: 'none' }} />
  const q = QUESTIONS[qIndex]
  return (
    <UiEntity uiTransform={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
      <UiEntity
        uiTransform={{ width: 900, height: 520, flexDirection: 'column', padding: 32, alignItems: 'center' }}
        uiBackground={{ color: Color4.create(0, 0, 0, 0.85) }}  // panel = contrast
      >
        <Label value={`Time: ${timeLeft}s   Score: ${score}`} fontSize={26} color={Color4.White()}
               uiTransform={{ width: '100%', height: 40 }} />
        <Label value={q.prompt} fontSize={40} color={Color4.White()}
               uiTransform={{ width: '100%', height: 120 }} />
        {q.choices.map((c, i) => (
          <UiEntity key={i} uiTransform={{ width: 700, height: 64, margin: '8px 0' }}
                    uiBackground={{ color: choiceColor(i) }}
                    onMouseDown={() => onAnswer(i)}>
            <Label value={c} fontSize={30} color={Color4.White()}
                   uiTransform={{ width: '100%', height: '100%' }} textAlign="middle-center" />
          </UiEntity>
        ))}
      </UiEntity>
    </UiEntity>
  )
}

// Register once (combine with other UI roots via an array return — see build-ui):
export function setupUi() {
  ReactEcsRenderer.setUiRenderer(QuizUI, { virtualWidth: 1920, virtualHeight: 1080 })
}
```

---

## 2. Card system (hand / deck)

Deck and hand as data; render the hand as clickable cards; support play and discard.

```typescript
export type Card = { id: string; name: string; cost: number }

let deck: Card[] = []
let hand: Card[] = []
let discard: Card[] = []
let selected: string | null = null

export function initDeck(cards: Card[]) { deck = shuffle([...cards]); hand = []; discard = [] }

function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}

export function draw(n: number) {
  for (let i = 0; i < n; i++) {
    if (deck.length === 0) { deck = shuffle(discard); discard = [] } // reshuffle discard
    const c = deck.pop(); if (c) hand.push(c)
  }
}

export function playCard(id: string) {
  const i = hand.findIndex(c => c.id === id); if (i < 0) return
  const [c] = hand.splice(i, 1); discard.push(c); selected = null
  onCardPlayed(c) // your game hook: apply the card's effect
}

export function discardCard(id: string) {
  const i = hand.findIndex(c => c.id === id); if (i < 0) return
  discard.push(...hand.splice(i, 1)); selected = null
}
```

```tsx
import ReactEcs, { UiEntity, Label } from '@dcl/sdk/react-ecs'
import { Color4 } from '@dcl/sdk/math'

export const HandUI = () => (
  <UiEntity uiTransform={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'flex-end' }}>
    <UiEntity uiTransform={{ height: 220, flexDirection: 'row', alignItems: 'flex-end', margin: '0 0 40px 0' }}>
      {hand.map((c) => (
        <UiEntity key={c.id}
          uiTransform={{ width: 140, height: selected === c.id ? 210 : 190, margin: 8, flexDirection: 'column',
                         borderWidth: selected === c.id ? 4 : 2, borderColor: Color4.create(1, 0.85, 0.2, 1) }}
          uiBackground={{ color: Color4.create(0.1, 0.12, 0.2, 0.97) }}
          onMouseDown={() => { selected = selected === c.id ? (playCard(c.id), null) : c.id }}>
          <Label value={c.name} fontSize={22} color={Color4.White()} uiTransform={{ width: '100%', height: 60 }} />
          <Label value={`Cost ${c.cost}`} fontSize={18} color={Color4.create(1, 0.85, 0.2, 1)}
                 uiTransform={{ width: '100%', height: 30 }} />
        </UiEntity>
      ))}
    </UiEntity>
  </UiEntity>
)
```

First click selects (card lifts); second click on the selected card plays it. Adapt to click-to-select + a separate "Play"/"Discard" button for clarity on mobile.

---

## 3. Dialogue sequencing (cutscene narrative)

A linear script with typed-text reveal, click-to-advance, and branching choices.

```typescript
export type DialogueLine =
  | { speaker: string; text: string }
  | { speaker: string; text: string; choices: { label: string; goto: number }[] }

let script: DialogueLine[] = []
let line = 0
let shown = 0            // characters revealed (typewriter)
let dialogueActive = false
let typeTimer: number | null = null

export function startDialogue(s: DialogueLine[]) {
  script = s; line = 0; dialogueActive = true; typeLine()
}

function typeLine() {
  shown = 0
  if (typeTimer !== null) timers.clearInterval(typeTimer)
  const full = script[line].text
  typeTimer = timers.setInterval(() => {
    shown += 1
    if (shown >= full.length && typeTimer !== null) { timers.clearInterval(typeTimer); typeTimer = null }
  }, 30)
}

export function advance() {
  const cur = script[line]
  const full = cur.text
  if (shown < full.length) { shown = full.length; if (typeTimer !== null) { timers.clearInterval(typeTimer); typeTimer = null }; return } // reveal all first
  if ('choices' in cur && cur.choices) return           // wait for a choice
  goTo(line + 1)
}

export function choose(gotoLine: number) { goTo(gotoLine) }

function goTo(n: number) {
  if (n >= script.length) { dialogueActive = false; return }
  line = n; typeLine()
}
```

```tsx
export const DialogueUI = () => {
  if (!dialogueActive) return <UiEntity uiTransform={{ width: '100%', height: '100%', display: 'none' }} />
  const cur = script[line]
  const visible = cur.text.substring(0, shown)
  return (
    <UiEntity uiTransform={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'flex-end' }}
              onMouseDown={() => advance()}>
      <UiEntity uiTransform={{ width: 1100, height: 240, flexDirection: 'column', padding: 24, margin: '0 0 60px 0' }}
                uiBackground={{ color: Color4.create(0, 0, 0, 0.88) }}>
        <Label value={cur.speaker} fontSize={26} color={Color4.create(1, 0.85, 0.2, 1)}
               uiTransform={{ width: '100%', height: 34 }} />
        <Label value={visible} fontSize={30} color={Color4.White()} uiTransform={{ width: '100%', height: 110 }} />
        {'choices' in cur && cur.choices && shown >= cur.text.length &&
          <UiEntity uiTransform={{ width: '100%', flexDirection: 'row' }}>
            {cur.choices.map((ch, i) => (
              <UiEntity key={i} uiTransform={{ width: 260, height: 50, margin: 6 }}
                        uiBackground={{ color: Color4.create(0.15, 0.2, 0.4, 1) }}
                        onMouseDown={() => choose(ch.goto)}>
                <Label value={ch.label} fontSize={22} color={Color4.White()}
                       uiTransform={{ width: '100%', height: '100%' }} textAlign="middle-center" />
              </UiEntity>
            ))}
          </UiEntity>}
      </UiEntity>
    </UiEntity>
  )
}
```

> For NPC conversations tied to a character in the world (greeting, quests), the **npcs** skill's dialog toolkit is usually a better fit than a hand-rolled sequencer. Use this pattern for scripted cutscenes and framed narrative.

---

## 4. Turn-based battle flow

Menu-driven actions with animated HP bars. Reuse the phase model from `{baseDir}/references/turn-and-grid-systems.md` (`'turn'` mode) to gate input during resolution.

```typescript
type Combatant = { name: string; hp: number; maxHp: number }
let player: Combatant = { name: 'You', hp: 100, maxHp: 100 }
let enemy: Combatant = { name: 'Goblin', hp: 80, maxHp: 80 }
let battlePhase: 'player' | 'resolving' | 'enemy' | 'over' = 'player'
let logLine = 'Choose an action.'

export function playerAction(kind: 'attack' | 'defend') {
  if (battlePhase !== 'player') return   // input locked otherwise
  battlePhase = 'resolving'
  const dmg = kind === 'attack' ? 18 : 6
  enemy.hp = Math.max(0, enemy.hp - dmg)
  logLine = `You ${kind} for ${dmg}.`
  timers.setTimeout(enemyTurn, 900)
}

function enemyTurn() {
  if (enemy.hp <= 0) { battlePhase = 'over'; logLine = 'Victory!'; return }
  battlePhase = 'enemy'
  const dmg = 12
  player.hp = Math.max(0, player.hp - dmg)
  logLine = `${enemy.name} hits for ${dmg}.`
  timers.setTimeout(() => {
    battlePhase = player.hp <= 0 ? 'over' : 'player'
    if (player.hp <= 0) logLine = 'Defeated.'
  }, 900)
}
```

```tsx
const HpBar = (c: Combatant, tint: Color4) => (
  <UiEntity uiTransform={{ width: 400, height: 30, margin: '4px 0' }} uiBackground={{ color: Color4.create(0,0,0,0.6) }}>
    <UiEntity uiTransform={{ width: `${(c.hp / c.maxHp) * 100}%`, height: '100%' }} uiBackground={{ color: tint }} />
    <Label value={`${c.name} ${c.hp}/${c.maxHp}`} fontSize={20} color={Color4.White()}
           uiTransform={{ width: '100%', height: '100%', positionType: 'absolute' }} textAlign="middle-center" />
  </UiEntity>
)

export const BattleUI = () => (
  <UiEntity uiTransform={{ width: '100%', height: '100%', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
    <UiEntity uiTransform={{ flexDirection: 'column', padding: 20, alignItems: 'center' }}
              uiBackground={{ color: Color4.create(0,0,0,0.8) }}>
      {HpBar(enemy, Color4.create(0.7,0.2,0.2,1))}
      {HpBar(player, Color4.create(0.2,0.6,0.9,1))}
      <Label value={logLine} fontSize={24} color={Color4.White()} uiTransform={{ width: 400, height: 40 }} />
      {battlePhase === 'player' &&
        <UiEntity uiTransform={{ flexDirection: 'row' }}>
          <Button value="Attack" fontSize={24} uiTransform={{ width: 160, height: 50, margin: 6 }}
                  onMouseDown={() => playerAction('attack')} />
          <Button value="Defend" fontSize={24} uiTransform={{ width: 160, height: 50, margin: 6 }}
                  onMouseDown={() => playerAction('defend')} />
        </UiEntity>}
    </UiEntity>
  </UiEntity>
)
```

---

## 5. Game-feel feedback

### Floating 3D damage / reward text

A pooled `TextShape` entity that rises and fades in world space, always facing the camera via `Billboard`. Rise is a `Tween.Move`; fade decrements the `textColor` alpha per frame; `outlineWidth`/`outlineColor` guarantee legibility.

```typescript
import {
  engine, Entity, Transform, TextShape, Billboard, BillboardMode,
  Tween, EasingFunction, tweenSystem,
} from '@dcl/sdk/ecs'
import { Vector3, Color3, Color4 } from '@dcl/sdk/math'

const floaters = new Map<Entity, number>() // entity -> seconds remaining

export function showFloatingText(worldPos: Vector3, text: string, color = Color4.White()) {
  const e = engine.addEntity() // pool these in a real game (see optimize-scene)
  Transform.create(e, { position: worldPos, scale: Vector3.create(2, 2, 2) })
  Billboard.create(e, { billboardMode: BillboardMode.BM_ALL })
  TextShape.create(e, {
    text, fontSize: 4,
    textColor: color,
    outlineWidth: 0.2,                        // contrast
    outlineColor: Color3.create(0, 0, 0),
  })
  Tween.create(e, {
    mode: Tween.Mode.Move({ start: worldPos, end: Vector3.add(worldPos, Vector3.create(0, 1.5, 0)) }),
    duration: 1000,
    easingFunction: EasingFunction.EF_EASEOUTQUAD,
  })
  floaters.set(e, 1.0)
}

export function floatingTextSystem(dt: number) {
  for (const [e, remaining] of [...floaters]) {
    const left = remaining - dt
    const ts = TextShape.getMutable(e)
    ts.textColor = Color4.create(ts.textColor!.r, ts.textColor!.g, ts.textColor!.b, Math.max(0, left)) // fade
    if (left <= 0) { engine.removeEntity(e); floaters.delete(e) } else floaters.set(e, left)
  }
}
engine.addSystem(floatingTextSystem)
```

Call `showFloatingText(enemyPos, '-18', Color4.create(1,0.85,0.2,1))` on a hit, or `'+20'` in green on a reward. Green/gold for gains, red for damage is the conventional coding.

### Combo counter

Track consecutive quick hits/answers; multiply score and surface a tier label. Reset if the window lapses (`timers`).

```typescript
let combo = 0
let comboTimer: number | null = null

export function registerHit() {
  combo += 1
  if (comboTimer !== null) timers.clearTimeout(comboTimer)
  comboTimer = timers.setTimeout(() => { combo = 0 }, 2000) // 2 s window
  return comboMultiplier()
}

export function comboMultiplier(): number { return 1 + Math.min(combo, 10) * 0.1 } // up to 2x
export function comboTier(): string {
  if (combo >= 8) return 'PERFECT'; if (combo >= 5) return 'GREAT'; if (combo >= 2) return 'GOOD'; return ''
}
```

Render `comboTier()` and `x${comboMultiplier().toFixed(1)}` as a `Label` with a drop-shadow (a dark offset copy behind it) or on a small panel, and pop it with a brief scale change for feel.

---

## Multiplayer

UI is inherently **local** — each player sees their own HUD, hand, quiz, and floating text. Nothing above needs sync by default.

- **Shared game state behind the UI** (a co-op battle's enemy HP, a shared score) belongs in synced components; the UI just reads it. See **multiplayer-sync**.
- **Broadcast feedback** (show everyone a "Player X scored!" toast) via `MessageBus` — fire-and-forget, then each client renders its own floating text / toast. See **multiplayer-sync**.
- **Validated results** (competitive quiz scores, card-game outcomes for rewards) must be checked server-side; render the UI optimistically but treat the server's result as authoritative. See **authoritative-server**.
