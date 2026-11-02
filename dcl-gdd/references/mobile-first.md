# Mobile-First

Use when mobile is a target or the owner wants to explore it. In the Creator Success proposal,
load at Step H (§6): **touch is the primary design target, not a port**. For general design, use
the chosen devices and inputs; a desktop-only game has no missing touch requirement.
When designing for mobile, work on input and small-screen UI early. The clients are different programs — Unity on desktop,
Godot on mobile — so a desktop capability proves nothing about mobile. Apply the
[playbook's fact-checking rules](playbook.md).

Design for a visit that can end early: what satisfying action fits before an interruption,
and what state survives it? Use this game's rhythm; another platform's contest criteria are not
Decentraland requirements.

## Desktop evidence, mobile design

Mobile parity is **not a blocker**: desktop may sign off a design intended to work on mobile.
Every verdict carries `tested on`. For a promised mobile experience, a **mobile-sensitive**
hypothesis (often input or performance) can close its desktop question while the mobile part
stays pending. The proposal offers a Creator Hub QR pass at core-loop stage close; general
design offers a mobile test when it addresses the current question. See [parking.md](hypothesis-log/parking.md) and
[stage gate](stages-and-gates.md).

## Mapping verbs to touch

For the proposal, use one row per §3 verb, including the rarest; a missing row is unfinished and
fails P5. For general mobile design, use the mapping when it exposes an uncertain input or response.

| Fights touch | Design toward |
|---|---|
| Precision aim, small hit targets, pixel accuracy | Large tap targets, forgiveness windows, snapping or assist instead of accuracy |
| Hover states, right-click, affordances revealed only by pointing | One visible, contextual primary action |
| Key combinations, modifiers, more than one simultaneous input beyond move + one action | Gestures the platform's own UI already teaches, not invented ones |
| Precision timing on a moving camera — a headshot | Timing over precision — a rhythm window is touch-friendly, a headshot is not |
| Small text, UI that assumes a wide screen | State readable at arm's length, in one glance |

If a verb's fun *is* the precision, the honest answers are to redesign the verb or to change the
target platform — never to promise an adaptation later (a note to you, not a line to say aloud). To
the owner: *"this verb fights touch — worth deciding now whether the verb changes or the platform
does."* A choice put on the table, never a verdict.

## Performance and dependencies

The proposal targets **60 fps on recommended desktop hardware** and **30 fps on a *named* mobile device and
client**, both at §5's **target player count** (programme baseline: up to 20 players). If §5's count is
`TBD:`, the load for the performance target is too.
For general design, choose performance goals appropriate to the intended devices, load and experience.

Distinguish the device available for a test, the design's chosen target device and any official
hardware baseline. Owning or borrowing a phone establishes only test availability; a performance
result needs an actual test. An official baseline requires a current authoritative source, not
an owner choice or your inference. If none is verified, say it is unconfirmed. If the test device
is unknown, keep it `TBD:` with a plan to identify it; do not make naming a phone a submission gate.

Targets can exist before tests. An achieved FPS result needs the measured player load, client,
device and source; never promote the target to a result because the owner agreed with the plan.

Name **one biggest risk and its plan**, not an audit. The usual candidates, roughly in order of how
often they are the actual cause: asset weight (texture and mesh budget, draw calls), per-frame
physics, particle and post effects, the number of simultaneously animated entities. Pick the one
this design will actually hit — a scene with 200 physics objects needs a different plan from one
with 4K textures.

**Never quote numeric scene budgets from memory.** For triangle, entity, texture or file-size
limits, use source-backed evidence applicable to the target SDK, client and deployment, and
cite it. Apply [platform-fit's reuse rule](platform-fit.md#reuse-the-platform-answer-before-researching-it-again):
reuse an inspected limit within its scope; check the affected official docs when that scope
has changed or is missing. A wrong budget is worse than a `TBD:` with a focused check.

For a desktop-only dependency the question is not "does it work" but **"can the feature switch on
later without a redesign?"** — name the feature, the fallback that ships now, and the seam where the
real version drops in. Reuse feature evidence for the intended client and release. For a changed
client, an active rollout or a missing or conflicting answer, check the affected entry in the
[Desktop vs Mobile Feature Gap tracker](https://github.com/decentraland/godot-explorer/issues/2402)
(the link the template hands the owner in §6) and the
[official missing-features inventory](https://docs.decentraland.org/creator/build-for-mobile/mobile-client/missing-features).
Do not infer a rollout's availability from an older release. If a needed source will not open,
keep any still-applicable evidence and mark the unresolved claim `TBD:`; do not guess.
A core loop that depends on a desktop-only feature with no fallback is not
mobile-ready in any useful sense, whatever the section says.

## Small-screen UI

One or two document sentences, but ask for the real thing: what stays on screen during the loop, how
much it covers, and what the thumb holding the phone does. Thumb reach is a layout constraint;
anything essential in a top corner is unreachable one-handed.

## Park

- "The core verb feels good on touch" — the archetypal mobile-sensitive hypothesis: desktop cannot
  settle it, and settling it late is how a design gets redone in week 5.
- "The scene holds 30 fps on the named mobile device at the target player count" — start with cheap
  asset-budget arithmetic, then measure.
- "UI is readable at arm's length" — one screenshot on one phone; never leave it parked.
