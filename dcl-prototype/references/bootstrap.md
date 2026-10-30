# Bootstrap once, check availability on resume

Use for scene work, not paper or arithmetic-only exploration. Reuse an existing project bootstrap
record; otherwise save a short `design/bootstrap.md`. This is the agent's working note, not an
owner questionnaire. Check what the current workflow needs, not every possible integration.

## First use in this environment

- **Skills and project.** Inspect available skills and project instructions. Read `sdk-scenes`
  and only relevant topic skills. Creator Hub may already have installed/linked them; do not
  reinstall merely because this chat is new. Confirm the intended project, SDK/dependencies and
  build command. Preserve an existing scene; use the SDK creation workflow only when needed.
- **Tools.** Discover the tools actually exposed to this session, including deferred tools.
  Distinguish installed/configured, listed, and successfully called. For each integration needed
  now, make a small non-mutating call: for example current project info, preview state or a
  Blender scene read. An open app or config entry is not proof of agent access. Blender and
  other optional services wait until needed.
- **Working path.** Confirm the project returned by the scene tool matches the intended one.
  Use the selected Hub gateway or direct client connection according to its SDK skill; do not
  require both. Reuse a recent applicable build/smoke result or build once and confirm the
  intended scene loads, following the [preview lifecycle](greybox-build.md#preview-lifecycle).
  Read-only calls establish access; editing, movement and visual results
  are verified during the first relevant task, not by exercising every tool speculatively.

Record date, project, agent/client route, relevant skill names/location or known version,
SDK/dependency identity when available, successful checks and their evidence, and pending
capabilities. Keep tokens, credentials and copied MCP configs out of this note. A manual owner
preview is a usable fallback, but not agent-controlled verification. Say exactly what is ready
and what remains unavailable; never label the entire toolset tested from one successful call.

## Before a jam or a requested refresh

Installed skills may be outdated. During jam preparation, offer one refresh if it has not already
been done; do not make it a gate or repeat it on every return. Follow the current
[SDK skills README](https://github.com/decentraland/sdk-skills#updating-skills): re-running its
install command also fetches new skills; `skills update` alone does not. Preserve the existing
project/global scope, agent targets and Hub-managed links rather than creating a competing copy.
After a refresh, rediscover availability and read only relevant changed guidance. Record the
refresh and recheck affected integrations. Updating skills does not upgrade the scene SDK or
install/connect Blender and Explorer MCP by itself.

## Return to the project

Read the short record and compare the current skill/tool inventory with the saved route. Report
only useful availability and changes, for example: “SDK skills available; Hub responds for this
project; Explorer not connected — manual preview available.” Show the full inventory on request.
Do not reload every skill, browse setup docs, reinstall packages or repeat the build just to resume.

Before relying on a live integration in a new session, use its cheapest read-only status/project
call, or let the first needed read serve as that check. Within the same session, reuse a successful
check until a failure or relevant change. A tool list alone means available to call, not connected.

Recheck only the affected part after a project/host/client switch, tool or skill change, dependency
change, restart or error. Hub restarts can change its port/token; an authentication failure calls
for refreshed connection settings, not scene recreation. Diagnose the selected route from current
SDK guidance. No retry loop or repeated setup lecture: state the unresolved dependency and offer
the available way forward. Never bypass the SDK's protections against competing scene writes.

Update the note when something changes. A bootstrap record never replaces smoke after build
changes, proves a game mechanic, or establishes behaviour in other clients.

## Setup references

Use these when setup or recovery is needed; do not load them on every return:
[Vibe Coding with AI](https://docs.decentraland.org/creator/scenes-sdk7/getting-started/vibe-coding) ·
[Creator Hub AI Assistant](https://docs.decentraland.org/creator/scene-editor/extend-with-code/ai-assistant).
Read current instructions rather than copying endpoint values or installation commands into this
skill. These pages describe specific supported clients, not identical MCP support across all DCL clients.
