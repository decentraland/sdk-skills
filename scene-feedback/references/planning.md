# Plan or adapt a playtest

Before proposing new scene-specific questions or moments, read [Scene context](scene-context.md)
to find relevant design intent and verify implemented flow and exposure. Use a supplied goal
and constraints directly. When the creator asks to define the focus together, enter the
[focus interview](planning-details.md#determine-the-focus) directly; otherwise offer the starter below.

For question wording and candidate sets, read relevant sections of the [question guide][guide]
and [question bank][bank]. Adapt candidates to the scene, creating questions when needed.

What the module ships: 20 implemented questions in `lib/bank.ts`, grouped into `coreMechanic`,
`coreLoop`, `social`, `motivation`, `world` and `technical`, each with a rating scale, suggested
timing and what the answer can tell you; 14 five-label rating scales in `lib/shared/scales.ts`,
usable as-is or as templates; and a 113-question candidate bank in `QUESTION_BANK.md` with
ready-made sets by playtest goal. Entries marked **In bank.ts** start from the implemented
question; others are defined in `questions.ts` with a suggested or custom scale.

## Offer a starting plan

For an unsure creator, deliver one compact starter proposal:

- A brief purpose grounded in the scene.
- A short list of adapted questions, each with a plain answer format and moment to show it.
- A closing invitation offering the three paths below. Explain the interview's benefit:
  deciding what is useful to investigate, such as where players get lost, why they stop,
  or what would encourage returning.

Match questions to actual exposure at a safe pause; failed or abandoned attempts can
qualify. For uncertain exposure, use an observable event or answerable wording. Keep
participation and skipping voluntary with ordinary progress intact. Fold requested device
considerations into low-effort answer formats. Describe effort from known question/comment
choices; give time estimates only when checked in that flow. For finding testers or organizing
a session, offer the [Playtests guide][playtests] as a brief relevant link.

When attracting responses or the requested effort makes an in-game perk relevant, inspect
the actual economy/mechanics and read [Participation rewards](participation-rewards.md).
Proactively offer one fitting optional choice briefly for creator review.

## Follow the chosen path

- **Use this starter:** acceptance approves the choices shown; resolve only material open
  choices and follow [Integration](integration.md), reusing approvals already supplied.
- **Adapt it to creator priorities:** ask a few relevant clarifications and revise affected
  parts using [Adapt a starter](planning-details.md#adapt-a-starter).
- **Determine the focus together:** use the [focus interview](planning-details.md#determine-the-focus)
  to identify what would be useful to learn before proposing questions and moments.

For other requested refinement or unresolved implementation detail, read [Planning details](planning-details.md).
When planning runtime, device, or Storage checks, read [Verification](verification.md).

[guide]: https://github.com/decentraland/sdk7-test-scenes/blob/main/scenes/0,-1-scene-feedback/QUESTION_GUIDE.md
[bank]: https://github.com/decentraland/sdk7-test-scenes/blob/main/scenes/0,-1-scene-feedback/QUESTION_BANK.md
[playtests]: https://docs.decentraland.org/creator/scenes-sdk7/designing-the-experience/playtests
