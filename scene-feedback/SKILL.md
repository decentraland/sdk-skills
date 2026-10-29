---
name: scene-feedback
description: "Scene Feedback surveys for Decentraland SDK7 playtests: plan questions and timing, integrate or debug the module, or analyze exported CSV ratings and comments. For audiovisual reactions to gameplay actions, use game-design or build-ui."
---

# Scene Feedback

Help creators learn how players experience their scene using Scene Feedback questions and
CSV responses.

## REQUIRED gate: approved plan

**Approved plan** gate: before writing receiving-scene files for a new integration, or making
content or timing edits the creator did not dictate, the creator has explicitly approved each of:

1. goal,
2. questions and Intro,
3. formats and scales,
4. moments,
5. participation route.

An assistant suggestion, including one from an earlier session, stays a proposal until the
creator confirms it. A request to "install it" or "connect it", or approval of a technical
option, is not approval of these choices. An approved exact edit or plan proceeds without a
renewed interview.

Any item missing → read [Planning](references/planning.md) and
[Scene context](references/scene-context.md), then present a compact plan covering the missing
items, with the three planning paths. The gate passes when the creator accepts that concrete plan.

When updating project notes, distinguish creator-approved decisions, assistant proposals,
and implemented facts; implementation itself does not establish approval.

## Creator-facing review

Show question wording, rating label meaning and player moments, with any bank, scale or event
ID beside its meaning. Keep exact IDs in code and configuration.

## Choose the route

| Request | Read next | Scope |
| --- | --- | --- |
| Choose a playtest focus, propose/adapt questions, scales, or timing | [Planning](references/planning.md) | Ground the proposal in the scene or brief and review creator-facing choices before applying them. |
| Install, wire events, apply approved edits, or update the module | [Integration](references/integration.md) | Inspect the current installation first; reuse it and change only what the task needs. |
| Check/debug existing behavior or test devices/Storage | [Verification](references/verification.md) | Inspect configuration and hooks, then run relevant checks. |
| Download responses only | [World Storage retrieval](https://github.com/decentraland/sdk7-test-scenes/blob/main/scenes/0,-1-scene-feedback/README.md#4-review) | Explain retrieval without starting a full analysis. |
| Analyze collected CSV ratings/comments or compare playtests | [Analysis](references/analysis.md) | Start with the exports and goal; offer optional HTML. |

Enter at the matching row and stop at its scope. Reuse supplied goals and approved decisions.
For an existing integration, distinguish a question/configuration edit from installation or
update; for CSV analysis, the exports can be sufficient without access to scene source. The
module docs linked from each workflow are the source of truth for configuration, API, examples
and CSV semantics; disclose any version mismatch between them and the scene that affects the work.
