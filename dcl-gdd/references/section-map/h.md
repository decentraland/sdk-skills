# Section Map — Step H — §6 Mobile-First

A step of [../section-map.md](../section-map.md) — its preamble applies here.

- **Ask:** Copy the verbs from §3 and map every one to touch. Then: how is the UI small-screen-first
  (one or two sentences)? Performance against the template's targets — 60 fps on recommended desktop
  and 30 fps on a **named** mobile device and client, both at the target player count from §5 (the
  program baseline covers up to 20 players) — and the single biggest risk with its plan. Any
  desktop-only dependency (reuse scoped evidence or check the affected tracker entry under
  [platform-fit](../platform-fit.md)), and how it switches on later without a redesign.
- Ask which device/client can be used for the test, not which personal phone should become the
  platform's minimum. Distinguish availability, chosen target and verified official baseline
  under [mobile-first](../mobile-first.md#performance-and-dependencies); unknowns stay explicit.
- **Good:** A row per verb with a real touch gesture. One named perf risk (asset weight, physics,
  effects) with a plan. Honest desktop-only dependencies with a switch-on path.
- **Smell:** "We'll adapt it later." Mouse-precision aiming, keyboard combos, hover states. Perf
  unmentioned. An achieved performance claim with no identified device/client; a planned test
  may honestly leave them TBD.
- **Load:** [mobile-first.md](../mobile-first.md)
- **Park:** most input and performance claims are mobile-sensitive — mark `Mobile-sensitive: yes`;
  how it renders and the QR pass: [parking.md](../hypothesis-log/parking.md).
