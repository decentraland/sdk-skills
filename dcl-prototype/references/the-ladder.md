# The Ladder — Which Rung Answers Which Question

Two build rungs, plus an optional check before any build. The rung is chosen in the Brief and
recorded in `Tested on` when the experiment closes.

> **Escalation discipline.** Try the cheapest method that can actually answer the question.
> Arithmetic can settle rule-based quantities and bounds before a build, when its inputs suffice.
> Apply [arithmetic evidence](../../dcl-gdd/references/hypothesis-log/arithmetic.md); a conditional
> scenario is not a measured behavioural result. Missing inputs call for a focused check, not an
> automatic build or a forced verdict.

## 0 · Before a build: audience check

When the owner has chosen specific people (a named server, group or meetup)
and the open question is whether they understand the promise or act on it, asking them can be
cheaper than any scene. Offer it once as an option beside building; it is never a gate, and a
decline stands. Pick the cheapest check that could change the next design step:

| Check | Can show | Cannot show |
|---|---|---|
| The one-line promise told to a few members ([listener check](../../dcl-gdd/references/player-promise.md#try-it-with-a-listener)) | whether they picture the intended action | interest, demand or play |
| An invitation posted where the group allows it | who replies or asks to join | that they would enter the scene or play |
| Sign-up with a real commitment, such as a scheduled session | who commits time | that they show up or enjoy it |
| A paper challenge or a one-action toy shared with the group (a toy is a small rung 1 build) | whether they try the action and what they change | that the full loop holds or that they return |

The owner chooses the place, approves the wording and does all posting and contact within the
group's rules. You can draft an invitation, labelled as a concept; you never publish, message
people or pay for promotion. For questions put to people, use
[player feedback](../../dcl-gdd/references/player-feedback.md).

Without an agreed criterion this is exploration: save what the owner reports in a note. As a
registered experiment it uses the normal Brief and verdicts: the criterion names the action, who
saw or was asked (the denominator) and the time window, agreed before posting. Write `Rung` and
`Tested on` as `audience check`; build lines and the owner kill-check may be `—`. `validated`
here covers only that action in that group: not demand, play or return. Feed the result back
through [reaching players → requirement → mechanic](../../dcl-gdd/references/acquisition.md#let-reaching-players-inform-the-game),
then test whether people actually play on a build rung.

## 1 · Desktop Explorer via Creator Hub — the default

Creator Hub with hot-reload can make a small experiment quick when the project is ready.
Estimate setup, reuse and unknown dependencies separately; a networked or unfamiliar mechanic
may take longer. Do not promise a fixed build duration to persuade the owner to continue.

Settles: existence, layout, rough timing, **feel, input response, the 10th repetition** — and
multiplayer, with real people in the scene. Unless the brief argues otherwise, a hypothesis about
**fun** is settled here. Mind what the verdict earns: an owner self-test writes `survived`
(kill-check held) or `failed` — `validated` takes measured evidence, arithmetic or an
agent-instrumented run.

> **Runtime facts are checked, not assumed.** Before claiming anything about what is running — which
> client the preview launched, whether an MCP server is up, whether a restart is needed after a
> config change — check the live thing itself. The preview port varies (Creator Hub has served 8000
> *and* 8001): find it by probing `/scene.json`, never by trusting a number from any doc, including
> this one. Hot-reload is broader than it looks — it has survived a `scene.json` parcel change — so
> "restart required" is a claim to verify, not to issue.

**Who launches — ask first.** The owner may prefer to launch the scene themselves from Creator Hub
(their everyday workflow, their client), or want you to run the preview server and push the
deeplink. One question, recommendation attached; never spawn servers or open clients unasked.

**Driving the Explorer.** Two legitimate setups, in order of preference:

- **sdk-skills installed in the scene** (`npx skills add decentraland/sdk-skills` → `.claude/skills/`
  inside the scene repo): use its Explorer-MCP skill directly — it is callable, and it gives
  screenshots, camera moves and scene state without leaving the session.
- **No sdk-skills:** the unity-explorer repo's own `mcp-scene-iteration` skill is
  `disable-model-invocation: true` — **you cannot invoke it; only the owner can**, as a slash
  command. Ask the owner to run it, or read its reference material as knowledge and watch the owner
  play. Do not write, imply, or plan around "the skill calls the other skill". (If `mcp__explorer__*`
  tools are already present in the session, they are usable directly — that is a different thing
  from invoking a skill.)

## Who tests — ask it in the Brief

Record in the Brief **who runs the sessions**, as a question to the owner with a recommendation:

- **The skill itself, via MCP** — mechanical validation only: the scene runs, the metric records,
  the physics does what the brief says. **Never a fun verdict** — fun is felt by a human.
- **The creator, by hand** — the only source of a *feel* verdict, and in an early experiment usually the only tester
  available. For Creator Success testing, use the program's external-player protocol when supplied.
- **Both** (*recommended default*): the skill smoke-tests through MCP first, so the creator's first
  session is spent feeling the mechanic — not discovering that it doesn't compile.

## 2 · Mobile — when it is a design target

Use when mobile is part of the chosen scope, or for an applicable Creator Success requirement.
The cost depends on device access, setup and what the check must establish.

**The QR pass** (verified): Creator Hub → the dropdown next to **Preview** → **Show QR Code for
Mobile** → point the phone camera at it. CLI fallback: `npm run start -- --mobile` (prints the QR
in the terminal; the desktop explorer does not launch with this flag). Phone and machine must share
one Wi-Fi — a personal hotspot beats corporate isolation. Hot-reload reaches the phone, so you
iterate without re-scanning.

A **mobile-sensitive** hypothesis under the chosen target scope still closes with a terminal
suffix at the verdict (`_validated` / `_survived` /
`_failed`); the index renders *… — mobile pending* from `Mobile-sensitive: yes` + `Tested on:
desktop` while that is true. Offer the mobile check when relevant to the chosen target, including
at core-loop stage close when using stages; record the answer and never force it.

Cheap proxies still come before the pass: one screenshot on one phone answers "is this readable at
arm's length"; thumb-reach and tap-target questions are answerable on a still image; asset-weight
arithmetic precedes any frame-rate measurement.

## Choosing the rung

| The hypothesis is about | Where it settles |
|---|---|
| balance, pacing, reward math, budget headroom | arithmetic in the doc — no build |
| whether chosen people understand or act on the promise | 0 · audience check — no build, optional |
| existence, layout, feel, timing, the 10th repetition | 1 · desktop Explorer |
| multiplayer, other players' presence, social moments | 1 · desktop Explorer, with real people |
| touch input, one-handed reach, small-screen legibility | 2 · mobile (screenshot proxy first) |
| frame rate under load | arithmetic first, then 1, then 2 |

## Numbers

> **Never quote numeric scene budgets from memory.** Triangle, entity, texture and file-size limits are
> deliberately absent from this file. Look them up in the current SDK7 documentation before a number
> goes into a brief or a verdict, and cite where it came from. A wrong budget carried into a proposal
> is worse than a `TBD:` with a plan to check it.

For Creator Success work, the program's performance bar (frame-rate targets, player counts) lives in the program doc and in
`dcl-gdd`'s `references/mobile-first.md` — read it there rather than restating it here.
