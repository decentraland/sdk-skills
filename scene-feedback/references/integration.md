# Install or change an integration

Inspect the receiving scene before choosing work: existing Scene Feedback source/assets,
questions and Intro configuration, startup imports, server/permission setup, and event hooks.
Reuse the installed module and approved choices. Distinguish a missing installation from a
configuration change or requested update; copying a new module version is a separate change.
Preserve creator-owned questions and existing event wiring unless the task changes them.

## Apply the requested scope

- **New or incomplete installation:** follow the relevant parts of [Install][install]. Copy
  only missing module/assets and apply needed setup changes; keep demo game code out.
- **Questions, scales, or Intro only:** follow the matching [Configure][configure] or
  [answer-format section][formats]. Read the planning reference only if new content or
  timing choices need to be proposed; an exact approved edit can be applied directly.
- **Participation or event wiring:** read the matching [API sections][api] and
  [integration recipe][examples]. Use [queue/results and group behavior][details] when
  handling completion, repeats, or closing. Follow existing scene events and UI flow.
- **Requested version update:** follow [Updating the module][updating], inspect local
  customizations, and preserve the receiving scene's configuration and hooks.

Use Scene Feedback's public API and configuration first. Extend its `lib/` when the intended
behavior needs a missing capability, explaining why. Resolve agent-proposed question or
timing choices through [planning](planning.md) before applying them.

For changed behavior, read [verification](verification.md) and run checks relevant to the
change. After integration, explain where to download responses via [Review][review], what
to inspect for the agreed goal via [Reading the CSV][reading], and offer to analyze them.

[configure]: https://github.com/decentraland/sdk7-test-scenes/blob/main/scenes/0,-1-scene-feedback/README.md#2-configure
[formats]: https://github.com/decentraland/sdk7-test-scenes/blob/main/scenes/0,-1-scene-feedback/README.md#comments-and-text-only-questions
[api]: https://github.com/decentraland/sdk7-test-scenes/blob/main/scenes/0,-1-scene-feedback/README.md#api-reference
[install]: https://github.com/decentraland/sdk7-test-scenes/blob/main/scenes/0,-1-scene-feedback/README.md#1-install
[examples]: https://github.com/decentraland/sdk7-test-scenes/blob/main/scenes/0,-1-scene-feedback/EXAMPLES.md
[details]: https://github.com/decentraland/sdk7-test-scenes/blob/main/scenes/0,-1-scene-feedback/README.md#details
[review]: https://github.com/decentraland/sdk7-test-scenes/blob/main/scenes/0,-1-scene-feedback/README.md#4-review
[reading]: https://github.com/decentraland/sdk7-test-scenes/blob/main/scenes/0,-1-scene-feedback/QUESTION_GUIDE.md#reading-the-csv
[updating]: https://github.com/decentraland/sdk7-test-scenes/blob/main/scenes/0,-1-scene-feedback/README.md#updating-the-module
