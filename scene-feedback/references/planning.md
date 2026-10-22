# Plan or adapt a playtest

Inspect the scene's startup, UI, and game events. Read an available design brief for intent;
use the code to distinguish implemented gameplay from planned mechanics or missing hooks.

## Establish the focus

Use a goal already supplied. Otherwise begin with one easy question, for example:

> Are you looking for an overall impression, or is there a particular part of the game
> you want feedback on?

Offer a few choices grounded in this scene. Ask a follow-up only when it changes the proposal,
such as the intended players, devices, or what is ready to try. If the creator is unsure,
suggest a lightweight first-visit overview and explain what it could reveal. General feedback
is a valid goal; the interview should help the creator choose, not become a questionnaire.

## Propose questions, formats, and timing

Before drafting, read the [question guide's focus, timing, and wording sections][guide].
Use the [question bank][bank] for candidate questions and starting sets. Adapt a suitable
candidate to the scene; create a new question when the candidates do not serve the goal.
For uncertain exposure, propose an observable event or answerable wording rather than
assuming the player experienced or completed an activity.

Recommend the answer format according to the decision it informs:

- **Rating only:** a quick assessment when the score serves the goal.
- **Rating plus optional comment:** an explanation would help decide what to inspect or change.
- **Text only:** an open problem report or unexpected experience where a score adds little.

Read [Configure][configure] for built-in and custom scales and [answer formats][formats]
for their configuration. Choose a suitable scale or create one following the documented
example. Show exact labels and comment prompts for review. On mobile, weigh typing effort
against the information needed for the playtest.

Use the README's [participation routes][api] to propose consent followed by gameplay
questions, a player-opened form, or both. Let the goal and existing game events determine
the invitation and question timing; present those choices to the creator.

## Invite participation

If the creator needs help finding playtesters or organizing a session, suggest
[Decentraland's Playtests guide][playtests]. Read its relevant sections when helping
plan recruitment, observation, or test rounds.

Treat motivation to keep playing and willingness to give feedback as separate questions.
A useful playtest can reveal why players stop. Follow the guide's exposure and timing rules;
an engaging game is not a prerequisite for useful feedback.

Give the Intro a neutral, concrete purpose tied to the creator's decision and an honest
account of the effort and timing: a form now, questions during play, or both. Use exact counts
only when bounded by the configuration, and time estimates only when checked in that flow.
Make declining and skipping voluntary without losing normal progress. Match data-use wording
to what is actually stored; the current CSV includes player addresses, so avoid promising
anonymity. See [AAPOR's introduction guidance][invitation]. Acknowledge participation without
promising changes the creator has not committed to.

When recruitment needs make incentives relevant, discuss them as optional. State terms in
advance, keep feedback rewards independent of praise or rating direction, and preserve the
ability to skip individual questions. For organized testers, reward agreed time or effort.
Consider who the offer attracts and whether it encourages rushed answers. [Incentive effects
vary by context][incentives]; more responses alone establish neither representativeness nor
freedom from bias. Retain invitation eligibility, route, and any incentive terms with the
playtest notes for later comparison; these are context notes, not new CSV fields.

For a concrete reward proposal, read [Decentraland reward recipes](participation-rewards.md).
Choose a recipe that fits the scene and verify its prerequisites before promising delivery.

## Review the proposed changes

For a new integration or a setup change, read the relevant [installation requirements][install].
For an existing installation, inspect what is already configured and propose only the needed
changes. For a planning-only request, stop at the proposal. Present:

- The playtest goal and how it relates to the scene or brief.
- A short table: exact question, format (scale labels and comment prompt where used),
  proposed event, and why the answer would help the creator's decision.
- Participation route, Intro wording/timing, target devices, and setup changes only where
  relevant to this proposal. Retain existing choices outside its scope.

Wait for review and approval before applying agent-chosen questions and events.
A general installation request does not approve those content and timing choices. Apply an
already approved concrete plan without asking again; keep unresolved choices visible.

[guide]: https://github.com/decentraland/sdk7-test-scenes/blob/main/scenes/0,-1-scene-feedback/QUESTION_GUIDE.md
[bank]: https://github.com/decentraland/sdk7-test-scenes/blob/main/scenes/0,-1-scene-feedback/QUESTION_BANK.md
[configure]: https://github.com/decentraland/sdk7-test-scenes/blob/main/scenes/0,-1-scene-feedback/README.md#2-configure
[formats]: https://github.com/decentraland/sdk7-test-scenes/blob/main/scenes/0,-1-scene-feedback/README.md#comments-and-text-only-questions
[api]: https://github.com/decentraland/sdk7-test-scenes/blob/main/scenes/0,-1-scene-feedback/README.md#api-reference
[install]: https://github.com/decentraland/sdk7-test-scenes/blob/main/scenes/0,-1-scene-feedback/README.md#1-install

[invitation]: https://aapor.org/standards-and-ethics/institutional-review-boards/
[incentives]: https://doi.org/10.29115/SP-2016-0003
[playtests]: https://docs.decentraland.org/creator/scenes-sdk7/designing-the-experience/playtests
