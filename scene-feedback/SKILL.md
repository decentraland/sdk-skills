---
name: scene-feedback
description: Plan and integrate player feedback questions in a Decentraland SDK7 scene, help creators choose a playtest focus, or retrieve responses as CSV. Use for in-game surveys, opt-in playtest questions, and player-opened feedback forms. For audiovisual reactions to gameplay actions, use game-design or build-ui.
---

# Scene Feedback

Help creators learn what players find confusing, frustrating, or enjoyable while playing.
Integrate the copyable Scene Feedback module into the existing scene and make its responses
available in World scene Storage.

## 1. Help the creator choose what to learn

Inspect the scene's client/server startup, UI, and game events. Read an available design
brief for the intended experience; use the code to establish what players can currently do.
Keep planned mechanics and missing event hooks distinct from implemented ones.

### Establish the focus

Use a goal already supplied. Otherwise begin with one easy question, for example:

> Are you looking for an overall impression, or is there a particular part of the game
> you want feedback on?

Offer a few relevant choices from this scene, such as finding the start, buying an upgrade,
or playing another round. Treat them as suggestions, not a questionnaire to complete.
Ask a short follow-up only when it changes the proposal: what the creator is unsure about,
which players and devices will test, or which part is ready to try. Infer what the scene and brief
already establish. If the creator is unsure, suggest a lightweight first-visit overview
and explain what it could reveal. General feedback is a valid goal; do not force a feature focus.

### Propose questions and timing

Read the [question guide](https://github.com/decentraland/sdk7-test-scenes/blob/main/scenes/0,-1-scene-feedback/QUESTION_GUIDE.md)
before selecting questions and triggers. For candidate wording and starting sets, consult
the [question bank](https://github.com/decentraland/sdk7-test-scenes/blob/main/scenes/0,-1-scene-feedback/QUESTION_BANK.md).

- **Focused test:** select questions that inform the creator's decision about that feature.
  Include failed or abandoned attempts where the player can still answer.
- **Overall impression:** suggest a small set about the visit or core activity, with a
  neutral opportunity to explain what worked or caused difficulty. Avoid a survey of every system.
- Start from a suitable bank question and adapt its wording and comment prompt to the
  scene. Create a new question when existing candidates do not answer the playtest goal.
  Use one topic per question and ask about experienced events.
- Ask after the relevant attempt at a natural pause, once competing UI has cleared.
  Establish exposure from the event; when it is unknown, use wording the player can answer
  without assuming that experience. Avoid surveying only successful players.

### Choose how players answer

- **Rating only:** for a quick assessment when the rating itself serves the goal.
- **Rating plus optional comment:** when an explanation would help decide what to inspect
  or change. Use a neutral prompt that welcomes positive and negative experiences.
- **Text only:** for open problem reports or unexpected experiences, where a numeric score
  would add little. Prompt for what happened and what the player was trying to do.

Choose a built-in scale matching the question, or create five ordered labels following the
README's custom-scale example when no existing scale fits. Show the exact labels for review;
keep their meaning aligned with the wording and avoid treating every high score as desirable.
Recommend a format and explain its purpose; let the creator adjust it rather than defaulting
all questions to the same format. On mobile, consider typing effort when choosing comments,
without removing a text answer that the playtest needs.

Choose consent followed by questions during play, a player-opened form, or both according
to the goal. Separate the invitation to participate from evaluation: arriving in the scene
alone does not establish experience of its gameplay. Offer timing choices instead of imposing
an entry-time questionnaire or a fixed delay.

Explain what the proposed answers can inform. Reported impressions help identify what to
investigate; observed behavior or gameplay data may be needed to explain the cause. Interest
in returning is not measured retention. Keep the proposal proportionate to the creator's goal.

## 2. Review the plan with the creator

Read the current [README installation and API](https://github.com/decentraland/sdk7-test-scenes/blob/main/scenes/0,-1-scene-feedback/README.md)
for setup requirements and supported behavior before proposing changes.

Before changing the receiving scene, present:

- The playtest goal and how it relates to the scene or design brief.
- A short table: adapted question text, answer format (including scale labels and comment
  prompt where used), proposed moment/event, and why that moment fits.
- The participation route and proposed Intro wording/timing, plus any server, dependency,
  or permission changes needed for installation. Include the target devices and any
  mobile-specific wording or verification needed.

Wait for the creator to review, revise, and approve this concrete plan before installation
or event wiring. A request to install the module alone does not approve agent-chosen
questions and timing. If the creator has already approved the concrete plan, apply it
without asking again. Keep unresolved choices visible rather than silently deciding them.

## 3. Integrate the module

Follow the approved plan and the README's current setup instructions. Retrieve the module
and its assets from that scene; keep unrelated demo game code out of the receiving project.

Read the matching [integration recipe](https://github.com/decentraland/sdk7-test-scenes/blob/main/scenes/0,-1-scene-feedback/EXAMPLES.md)
for separate consent, immediate consent plus question, player-opened forms, selected testers,
or mixed rating/text groups. Follow it within the receiving scene's startup and event flow.

Use Scene Feedback's public API and configuration first. Change its `lib/` when the intended
behavior requires an extension, explaining the missing capability.

Preserve these integration conditions:

- The feedback import runs on both client and server; player-facing handlers run on the client.
- With participation required, `ask()` needs enrollment or a pending `intro()`; it does not
  create an Intro. `leaveFeedback()` is the player-opened route, including after declining
  game-triggered questions.
- Use a text-only question for an open answer without a rating. Use a rating question with
  or without an optional comment when that fits the goal.
- Keep existing UI and game behavior. The scene decides when other panels have cleared;
  avoid substituting an arbitrary startup delay for an available event.

## 4. Verify the integration

Run the receiving scene's relevant checks. Prefer the available TypeScript compiler with
`--noEmit` for a type check; SDK build can install dependencies and update scene artifacts,
so use it when build validation is needed. Exercise the chosen triggers, acceptance and
refusal, blank answers, and group navigation where used. Check that existing startup UI and
game flow still work. If an Explorer is available, use `unity-explorer-mcp` for the runtime
check; otherwise state exactly which interactions remain untested.

When gameplay triggers are hard to reproduce, offer an optional debug panel. Read the
README's Debug section and reuse the module's existing debug UI before adding controls.
Adapt only the actions needed for this scene: Intro, a single question, a group, and visible
call results or participation state. Gate extra controls to local development; follow the
module's access rules for its built-in panel and disable `DEBUG` before release. Label test
responses with `trigger = debug` so they can be filtered from playtest data. Use the panel
to check forms, then exercise the real gameplay triggers and verify Storage separately.

When mobile is a target, start with the module's existing mobile layout. Follow the README's
Debug and phone-preview instructions; check actual question/scale-label wrapping, touch
controls, text input with the keyboard open, and coexistence with the scene's HUD. Use
`PREVIEW_MOBILE` for a local layout preview, and distinguish it from a real-device test.
Adjust wording or configuration first; extend the UI only for a demonstrated unmet need.

For a deployed World check, follow the README's Review and Stored CSV sections: submit a
known answer, allow the documented write delay, download the CSV, and find that question
and trigger. A resolved call or server acknowledgement is not proof of a Storage write.
Deploy when authorized; otherwise give the creator the remaining verification steps.

Report the configured questions and trigger handlers, checks actually run, and whether a
matching CSV row was verified locally or in a deployed World.
