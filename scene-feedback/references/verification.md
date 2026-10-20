# Verify or debug an existing integration

Inspect configuration and actual event wiring first. Select checks for the requested issue,
changed behavior, and target devices; read optional sections below only when relevant.
A verification request does not require reinstalling or replanning a working module.

## Project and runtime checks

Run relevant project checks. Prefer the available TypeScript compiler with `--noEmit` for
type checking; use SDK build when build validation is needed, accounting for dependency
installation and generated scene artifacts. Exercise configured triggers, acceptance and
refusal, blank answers, and group navigation where used; check existing startup and gameplay.
If Explorer is available, use `unity-explorer-mcp` for runtime checks. Report untested
interactions explicitly.

## Optional debug controls

When triggers are hard to reproduce, offer an optional debug panel. Read [Debug][debug]
and reuse the existing UI first; adapt only needed actions, such as Intro, single/group
questions, call results, or participation state. Gate added controls to local development
and follow the documented access and release rules. Label test responses `debug`. Check
real gameplay triggers separately from manually opening forms.

## Mobile targets

For mobile targets, use the existing layout and the [mobile preview instructions][debug].
Check actual question/label wrapping, touch controls, text input with the keyboard open,
and HUD overlap. Adjust wording or configuration first; extend UI for a demonstrated need.
Distinguish layout preview from a real-device test and identify devices actually checked.

## End-to-end Storage check

For end-to-end Storage verification, follow [Review][review] and [Stored CSV][csv]: submit
a known answer and find its question and trigger in the downloaded CSV after the documented
write delay. A call result or server acknowledgement does not establish persistence.
Deploy when authorized; otherwise explain the remaining World verification.

Report checks run, configured handlers or fixes, and whether a matching CSV row was verified
locally or in a deployed World.

[debug]: https://github.com/decentraland/sdk7-test-scenes/blob/main/scenes/0,-1-scene-feedback/README.md#debug
[review]: https://github.com/decentraland/sdk7-test-scenes/blob/main/scenes/0,-1-scene-feedback/README.md#4-review
[csv]: https://github.com/decentraland/sdk7-test-scenes/blob/main/scenes/0,-1-scene-feedback/README.md#stored-csv
