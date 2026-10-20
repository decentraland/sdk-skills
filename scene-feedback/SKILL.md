---
name: scene-feedback
description: Help creators plan playtest questions and timing, integrate or debug Scene Feedback surveys in Decentraland SDK7, or analyze collected CSV ratings and comments. For audiovisual reactions to gameplay actions, use game-design or build-ui.
---

# Scene Feedback

Help creators learn how players experience their scene using the copyable Scene Feedback
module and its CSV responses in World scene Storage.

Start at the route matching the request:

- **Plan or install:** follow steps 1–4, reusing choices already approved.
- **Check or debug an existing integration:** go to step 4; inspect its configuration and
  event wiring first. Revisit the plan only when the requested fix changes it.
- **Analyze collected responses:** go directly to Analyze collected responses.

Read the linked documentation sections when their branch applies; they are the source of
truth for module configuration, API behavior, examples, and CSV semantics.

## 1. Help the creator choose what to learn

Inspect the scene's startup, UI, and game events. Read an available design brief for intent;
use the code to distinguish implemented gameplay from planned mechanics or missing hooks.

### Establish the focus

Use a goal already supplied. Otherwise begin with one easy question, for example:

> Are you looking for an overall impression, or is there a particular part of the game
> you want feedback on?

Offer a few choices grounded in this scene. Ask a follow-up only when it changes the proposal,
such as the intended players, devices, or what is ready to try. If the creator is unsure,
suggest a lightweight first-visit overview and explain what it could reveal. General feedback
is a valid goal; the interview should help the creator choose, not become a questionnaire.

### Propose questions, formats, and timing

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

## 2. Review the plan with the creator

Read the [installation requirements][install] before proposing scene changes. Present:

- The playtest goal and how it relates to the scene or brief.
- A short table: exact question, format (scale labels and comment prompt where used),
  proposed event, and why the answer would help the creator's decision.
- Participation route, Intro wording/timing, target devices, and required setup changes.

Wait for review and approval before installing or wiring agent-chosen questions and events.
A general installation request does not approve those content and timing choices. Apply an
already approved concrete plan without asking again; keep unresolved choices visible.

## 3. Integrate the module

Follow [Install][install] and the matching [integration recipe][examples] for the approved
plan. Retrieve the module and assets, keeping unrelated demo game code out of the scene.
Read the relevant [API sections][api] before wiring participation and events; use
[queue/results and group behavior][details] when handling completion, repeats, or closing.

Use Scene Feedback's public API and configuration first. Extend its `lib/` when the intended
behavior needs a missing capability, explaining why. Preserve the scene's startup and UI
flow, including when other panels have cleared.

## 4. Verify or debug the integration

Run relevant project checks. Prefer the available TypeScript compiler with `--noEmit` for
type checking; use SDK build when build validation is needed, accounting for dependency
installation and generated scene artifacts. Exercise configured triggers, acceptance and
refusal, blank answers, and group navigation where used; check existing startup and gameplay.
If Explorer is available, use `unity-explorer-mcp` for runtime checks. Report untested
interactions explicitly.

When triggers are hard to reproduce, offer an optional debug panel. Read [Debug][debug]
and reuse the existing UI first; adapt only needed actions, such as Intro, single/group
questions, call results, or participation state. Gate added controls to local development
and follow the documented access and release rules. Label test responses `debug`. Check
real gameplay triggers separately from manually opening forms.

For mobile targets, use the existing layout and the [mobile preview instructions][debug].
Check actual question/label wrapping, touch controls, text input with the keyboard open,
and HUD overlap. Adjust wording or configuration first; extend UI for a demonstrated need.
Distinguish layout preview from a real-device test and identify devices actually checked.

For end-to-end Storage verification, follow [Review][review] and [Stored CSV][csv]: submit
a known answer and find its question and trigger in the downloaded CSV after the documented
write delay. A call result or server acknowledgement does not establish persistence.
Deploy when authorized; otherwise explain the remaining World verification.

Report checks run, configured handlers or fixes, and whether a matching CSV row was verified
locally or in a deployed World. After integration, explain where to download responses and
what to inspect for the agreed goal; link [Reading the CSV][reading] and offer to analyze
the responses when collected.

## Analyze collected responses

Read [CSV fields and response statuses][csv] and the guide's [Reading the CSV][reading]
before interpreting exports. Apply their rules for test data, participation, skips, text
answers, scale meaning, comparability, and limits of conclusions.

Use the supplied goal; clarify only context that changes interpretation. Without a specific
goal, begin with an overview of recurring experiences and questions to investigate.

- Obtain relevant CSV parts, note coverage, and deduplicate repeated exports by response `id`.
  If exports are missing, use [Review][review] to explain retrieval.
- Report response counts and distinct respondents; repeated answers are not independent
  players. Keep addresses out of the readout. Absent rows do not prove a question was shown.
- Compare versions or platforms where relevant, checking wording, timing, and recruitment
  before treating playtests as comparable. Summarize comment themes with representative
  excerpts and preserve conflicting experiences.
- Return coverage/exclusions, findings tied to the goal, uncertainty, and what to inspect
  or change next. Suggest a comparable follow-up test; distinguish evidence from hypotheses.

For a requested HTML report, or when a large answer collection would benefit from a
compact browsable readout, read [Adaptive HTML feedback readout](references/html-readout.md).
Choose views from the data and goal rather than imposing a dashboard.

[guide]: https://github.com/decentraland/sdk7-test-scenes/blob/main/scenes/0,-1-scene-feedback/QUESTION_GUIDE.md
[bank]: https://github.com/decentraland/sdk7-test-scenes/blob/main/scenes/0,-1-scene-feedback/QUESTION_BANK.md
[configure]: https://github.com/decentraland/sdk7-test-scenes/blob/main/scenes/0,-1-scene-feedback/README.md#2-configure
[formats]: https://github.com/decentraland/sdk7-test-scenes/blob/main/scenes/0,-1-scene-feedback/README.md#comments-and-text-only-questions
[api]: https://github.com/decentraland/sdk7-test-scenes/blob/main/scenes/0,-1-scene-feedback/README.md#api-reference
[install]: https://github.com/decentraland/sdk7-test-scenes/blob/main/scenes/0,-1-scene-feedback/README.md#1-install
[examples]: https://github.com/decentraland/sdk7-test-scenes/blob/main/scenes/0,-1-scene-feedback/EXAMPLES.md
[details]: https://github.com/decentraland/sdk7-test-scenes/blob/main/scenes/0,-1-scene-feedback/README.md#details
[debug]: https://github.com/decentraland/sdk7-test-scenes/blob/main/scenes/0,-1-scene-feedback/README.md#debug
[review]: https://github.com/decentraland/sdk7-test-scenes/blob/main/scenes/0,-1-scene-feedback/README.md#4-review
[csv]: https://github.com/decentraland/sdk7-test-scenes/blob/main/scenes/0,-1-scene-feedback/README.md#stored-csv
[reading]: https://github.com/decentraland/sdk7-test-scenes/blob/main/scenes/0,-1-scene-feedback/QUESTION_GUIDE.md#reading-the-csv
