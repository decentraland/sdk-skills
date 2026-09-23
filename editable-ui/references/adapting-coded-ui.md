# Adapting an existing coded UI

Recipes from porting a shipped production scene's UI (Genesis Plaza central plaza — ten HUD elements: skip hint, parkour timer, message banner, cinematic letterbox, confetti HUD, bookshelf popup, NPC dialog, error toast, position readout, show-debug panel). Eight of ten ported faithfully, one needed a mechanical redesign, one was out of reach. Every recipe below is what actually made the difference.

Work through them in this order — each one removes a class of blocker, and later recipes assume the earlier ones are done.

## 0. Split the files first

- One component per file under `src/ui/<PascalCaseName>.tsx`, filename equal to the exported component name.
- Everything that is not JSX — helpers, constants, math, data, ECS access — moves to a `.ts` file outside `src/ui/`. That file becomes the driver.
- A local helper component used inside the same file (`const Pill = () => …`) is opaque. Either give it its own `src/ui/` file with `/** @ui-component */`, or inline it at each use site.
- `{/* comments */}` become opaque nodes. Convert to `//` comments outside the JSX.

## 1. Interpolated text → segment bindings

The single largest surface in a real scene: debug panels, counters, timers, readouts.

```tsx
// BEFORE — a call inside the template freezes the node
<Label value={`Time: ${formatTime(elapsed)}`} />
<Label value={`env: ${realm}  |  players: ${count + 1}`} />
```

```tsx
// AFTER — every interpolation is a bare reference
<Label value={`Time: ${state.timeLabel}`} />
<Label value={`env: ${state.realm}  |  players: ${state.playerCount}`} />
```

```ts
// driver
ui.timeLabel = formatTime(elapsed)     // padStart / rounding lives here
ui.playerCount = count + 1             // arithmetic lives here
```

Multi-line `\n` literals inside the template are fine, so a whole debug block can be one Label. Markup like `<b>${state.score}</b>` is fine — it is literal text around a bare reference.

## 2. Tween-hack animations → driver-eased bound variables

Scenes commonly tween a dummy entity and multiply the tweened value into width/alpha/fontSize during render.

```tsx
// BEFORE — every multiplication freezes its node
const t = Transform.get(tweenDummy).scale.z
<UiEntity uiTransform={{ width: 894 * t }} uiBackground={{ color: Color4.create(1, 1, 1, t) }}>
  <Label value="…" fontSize={17 * t * t} />
```

```tsx
// AFTER — the finished product is the bound value
<UiEntity uiTransform={{ width: state.panelWidth }} uiBackground={{ color: state.panelColor }}>
  <Label value="…" fontSize={32} color={state.textColor} />
```

```ts
// driver — same 250ms easeOutCubic feel, zero editability cost
const t = easeOutCubic(anim)
banner.panelWidth = Math.max(1, Math.round(894 * t))
banner.panelColor.a = t
banner.textColor.a = t
```

Two practical limits found in the port:

- **Fading a whole subtree** needs one bound `Color4` per faded node. Fade the two or three load-bearing colors (card fill, border, body text) and let small accents pop in with the display gate instead of adding a variable per node.
- **Animated font size** is bindable in principle but rarely worth a state variable per text node. Drop it.

## 3. Hand-tracked hover → hover layers

```tsx
// BEFORE
let nextHovered = false
<UiEntity
  uiBackground={{ color: nextHovered ? HOVER : NORMAL }}
  onMouseEnter={() => { nextHovered = true }}
  onMouseLeave={() => { nextHovered = false }}
>
```

```tsx
// AFTER
const nextButton = useInteraction({
  base: { uiBackground: { color: { r: 1, g: 0.2, b: 0.36, a: 1 } } },
  hover: { uiBackground: { color: { r: 1, g: 0.2, b: 0.36, a: 0.85 } } },
})
<UiEntity {...nextButton}>
```

The module-level flags and their pointer plumbing disappear entirely.

## 4. Visibility conditionals → active display gates

```tsx
// BEFORE — the first is opaque, the second is frozen
{state.visible && <UiEntity …>…</UiEntity>}
<UiEntity uiTransform={{ display: visible ? 'flex' : 'none' }}>
```

```tsx
// AFTER — the gate goes on the element being hidden, sized to its own box
const panel = useInteraction(
  { base: { uiTransform: { display: 'flex', width: 720, height: 260 } },
    active: { uiTransform: { display: 'none' } } },
  state.visible !== true,
)
<UiEntity uiTransform={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
  <UiEntity {...panel}>…</UiEntity>
</UiEntity>
```

**Do not put the gate on the enclosing `100%`×`100%` wrapper**, even though the conditional you are replacing wrapped the whole subtree. `useInteraction` returns all four pointer listeners unconditionally — a base+active gate is still a handler-bearing element — and a full-screen element with a listener captures clicks over the entire screen, so the player can no longer click any other UI or anything in the world. The wrapper stays a plain literal-styled `UiEntity` doing positioning only; the gate sizes itself to the panel it hides. This was a real top-severity bug in a shipped scene; see `SKILL.md` → **Interaction layers** and `component-template.md` §4.

If the original kept rendering during a fade/shrink-out, use the two-variable pattern (`visible` intent + driver-owned `hidden` gate) so the exit animation stays visible — see `driver-pattern.md` §3.

The same trick covers tab switching, modals, toggle thumbs (flip `justifyContent` in the `active` layer), pills, banners and toasts. The `active` expression may be any code, so `state.tab !== 'video'`, `props.active === true` and `state.cycle % 8 === 3` are all fine.

## 5. `Date.now()` deadlines → driver clocks

```tsx
// BEFORE — inside the UI file
if (Date.now() > hideAt) visible = false
```

```ts
// AFTER — driver
if (toast.visible && hideIn > 0) {
  hideIn -= dt
  if (hideIn <= 0) toast.visible = false
}
```

## 6. `.map()` rows → unrolled siblings

Every list is unrolled by hand; there is no repeater. Budget for it: unrolled files run 2–3× the line count of the original.

- A change to "all nav buttons" becomes N edits — unless the row is factored into its own `/** @ui-component */` file, which is the right move for anything repeated more than about three times.
- Static rows inside an `overflow: 'scroll'` column still scroll correctly. Only the data-driven part is lost.

## 7. Theme constants → inline literals

Any identifier inside a style object freezes the node — including a theme token.

```tsx
// BEFORE
uiBackground={{ color: THEME.primary }}
// AFTER
uiBackground={{ color: { r: 1, g: 0.459, b: 0.22, a: 1 } }}
```

There is no "restyle the theme" operation: a palette change is a find-and-replace. If a color must change at runtime, make it a `Color4` state variable instead (that binds) — but only where it genuinely animates or switches, not for every accent.

## 8. Percent-based motion → px, anchored to an edge

A bound value must be a px **number**; a percent-string state variable also fails strict TS (`string` is not `PositionUnit`).

```tsx
// BEFORE — letterbox bars slid in by animating a percent position
uiTransform={{ position: { top: (pos.y + '%') as PositionUnit } }}
```

```tsx
// AFTER — bars anchored to the screen edges, px HEIGHT animated
uiTransform={{ positionType: 'absolute', position: { top: 0 }, width: '100%', height: state.topBarHeight }}
```

Same look, still resolution-independent, and fully editable. Reach for this rethink whenever the original animated a percent: ask what edge the element is attached to, and animate the px dimension that grows from it.

Static percent **literals** in unbound keys (`width: '90%'`, `position: { left: '14%' }`) round-trip fine and remain the best tool for fluid layout.

## 9. Sizes become plain px numbers

Write every size and position as a plain px number against the virtual canvas (desktop `1920x1080`, mobile `1600x720`) — any arithmetic in a style value freezes the node. If the source computed its sizes, evaluate the arithmetic once at the reference resolution and write the resulting number. The virtual canvas handles resolution scaling at runtime, so nothing needs to scale sizes in code.

**This includes every `Label`**: give each one an explicit `uiTransform` `width` **and** `height`, and an explicit height to any container that stacks labels — never auto-size a panel from its text children. Coded UI leans on text intrinsic sizing constantly, and that is engine-dependent: Bevy measures rendered text into the layout, Unity gives an unset text dimension ~0 while still drawing the glyphs, so ported labels overlap and panels collapse on Unity while looking correct on Bevy. Wrapped text needs a height for its line count. The `<Label value={…} />` fragments earlier in this file show only the attribute under discussion and omit the box for brevity — real code always carries it.

While you are re-deriving the numbers, do the mobile pass: pressables at least ~48 px, body text ≥ 16 (≥ 20 for anything read while moving), and check that the vertical stack survives the shorter `1600x720` canvas. Where the structure genuinely cannot survive it, add a platform variant instead of shrinking everything.

## 10. What survives untouched

- Nine-slice frames: `textureMode: 'nine-slices'` + `textureSlices` round-trip as static values.
- Literal 8-float `uvs` atlas crops are modeled as editable UV regions.
- Scene-relative `texture.src`, tint colors, `overflow: 'scroll'`, `pointerFilter`, `borderRadius`/`Width`/`Color`, the whole flex layout model.
- Event handler **bodies** — arbitrary code is fine inside a `/** @ui-action */` function.

## 11. What to tell the user is not portable

Say so explicitly rather than half-porting:

- **Data-driven panels.** Rows built by `.map()` over a record, with per-row draft objects, per-row closures, and remount hacks for uncontrolled inputs, are the hard wall — porting means unrolling every row *and* adding 2–3 state variables per field. Keep that panel as coded UI in its own module outside `src/ui/`.
- **Per-call content variability.** A function that renders arbitrary content per call (`showPopup(title, body, imageSrc)`) collapses to one slot: the text becomes state variables (fine), but a *set* of alternative textures has no representation. `texture.src` binds to one string; there is no texture-set or atlas-lookup story.
- **Children/slots.** A generic wrapper component around arbitrary content is not expressible. Panels stay inline in the screen file; only leaf-ish widgets factor out.
- **Uncontrolled inputs cleared by a `key` bump.** Substitute `value={state.draft}`; runtime behavior differs slightly.
- **A shared per-subtree opacity.** Each faded color needs its own bound variable.

## 12. Verification pass

After adapting, re-read every file against the self-check list in `SKILL.md`. The two highest-yield greps:

1. Inside every `uiTransform` / `uiBackground` object, look for `?`, `+`, `-`, `*`, `Math.`, `(`, or a bare identifier that is not `state.x` / `props.x` — each is a frozen node.
2. Search the JSX for `{` followed by anything other than a style object, a bare reference, a template literal of bare references, a thunk arrow, or a `usePlatform()` variant — each is an opaque subtree.
