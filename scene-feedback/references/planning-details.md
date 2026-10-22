# Refine or prepare a playtest plan

Use for the chosen adaptation or focus-interview path, requested detailed refinement, or
implementation preparation. Follow [Planning](planning.md) and reuse supplied priorities,
constraints, and approved choices.

## Adapt a starter

Ask a few clarifying questions about the creator's priorities or constraints that would
change the starter. For example, a mobile-control concern may change the relevant questions
and exposure moments. Revise those parts and explain the change; retain choices outside
that scope. Use priorities already supplied rather than reopening them.

## Determine the focus

Enter this conversation when the creator chooses it or asks for help defining what to test.
Begin with an easy scene-grounded question about what they want to learn from players.
Use their answer to explore the decision the feedback could inform and the relevant player
experience or exposure. If they are unsure, offer directions grounded in this scene, such
as finding a starting point, abandoning an activity, or wanting to return.

Let each answer determine the next useful question. Reuse known context and stop when you
can name a useful learning goal, the decision it informs, and an experience players can
answer about. A general first-visit overview remains valid. Then propose adapted questions,
plain answer formats, and moments for review using the guidance below.

## Refine questions, formats, and timing

For question selection and wording, read the [question guide's focus, timing, and wording
sections][guide].
Use the [question bank][bank] for candidate questions and starting sets. Adapt a suitable
candidate to the scene; create a new question when the candidates do not serve the goal.
Recommend the answer format according to the decision it informs:

- **Rating only:** a quick assessment when the score serves the goal.
- **Rating plus optional comment:** an explanation would help decide what to inspect or change.
- **Text only:** an open problem report or unexpected experience where a score adds little.

Use [Configure][configure] and [answer formats][formats] when choosing scales or preparing
configuration. Choose a suitable scale or adapt one following the documented example.
Show full scale labels and comment prompts when those details need review or implementation. On mobile, weigh typing effort
against the information needed for the playtest.

When choosing a participation flow, use the README's [participation routes][api] to propose
consent followed by gameplay questions, a player-opened form, or both. Let the goal and existing game events determine
the invitation and question timing; present those choices to the creator.

## Invite participation

Use this branch when planning invitation wording, recruitment, or incentives.
If the creator needs help finding playtesters or organizing a session, suggest
[Decentraland's Playtests guide][playtests]. Read its relevant sections when helping
plan recruitment, observation, or test rounds.

Treat motivation to keep playing and willingness to give feedback as separate questions.
A useful playtest can reveal why players stop. Follow the guide's exposure and timing rules;
an engaging game is not a prerequisite for useful feedback.

Use the module Intro as a starting point. Within the requested scope, adapt its greeting,
team voice, purpose, timing, and participation terms to this scene/playtest. Review its exact
proposed wording with the creator when Intro changes are part of the plan.

Give the Intro a neutral, concrete purpose tied to the creator's decision and an honest
account of the effort and timing: a form now, questions during play, or both. Use exact counts
only when bounded by the configuration.
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

## Prepare the chosen plan for implementation

Review outstanding content, timing, or Intro choices that materially change the chosen
plan before applying them. Retain existing choices outside the requested scope.

When preparing an integration or setup change, read the relevant [installation requirements][install].
For an existing installation, inspect what is configured and propose only needed changes.
For a planning-only request, stop at the proposal.

A general installation request does not settle agent-chosen content and timing choices.
Apply an already approved concrete plan without asking again; keep unresolved choices visible.

[guide]: https://github.com/decentraland/sdk7-test-scenes/blob/main/scenes/0,-1-scene-feedback/QUESTION_GUIDE.md
[bank]: https://github.com/decentraland/sdk7-test-scenes/blob/main/scenes/0,-1-scene-feedback/QUESTION_BANK.md
[configure]: https://github.com/decentraland/sdk7-test-scenes/blob/main/scenes/0,-1-scene-feedback/README.md#2-configure
[formats]: https://github.com/decentraland/sdk7-test-scenes/blob/main/scenes/0,-1-scene-feedback/README.md#comments-and-text-only-questions
[api]: https://github.com/decentraland/sdk7-test-scenes/blob/main/scenes/0,-1-scene-feedback/README.md#api-reference
[install]: https://github.com/decentraland/sdk7-test-scenes/blob/main/scenes/0,-1-scene-feedback/README.md#1-install

[invitation]: https://aapor.org/standards-and-ethics/institutional-review-boards/
[incentives]: https://doi.org/10.29115/SP-2016-0003
[playtests]: https://docs.decentraland.org/creator/scenes-sdk7/designing-the-experience/playtests
