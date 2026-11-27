---
name: scene-testing
description: "Plan and run testing for a Decentraland scene with agents and the owner: rounds with a separate verifier, persona walk-throughs of built flows, wording and translation checks, testing the published World, phone testing paired with the owner, a tester control panel with roles, and separate security and performance audits. Use when the user asks how to plan testing or QA for a scene beyond a single change, before a release or launch, after a publish, or when phones are a target. For rounds with human players and surveys use scene-feedback; for driving the Explorer or verifying one change use unity-explorer-mcp; for small design experiments use dcl-prototype."
---

# Testing a Scene

Agents can test far more of a scene than the change in front of them, but only if someone organizes it. This skill is the method: who tests, in what order, and what proves a fix. It complements the owner's own play, which is still the only test of how a scene *feels*.

Driving the Explorer (walk, click, screenshot, logs) is in **unity-explorer-mcp**. Rounds with human players and their surveys are in **scene-feedback**; the rounds here are run by agents, with the owner where noted. Load those for the mechanics; this skill decides what to run and when.

## When to suggest what

Bring these up yourself at the stage they help. In the project behind this skill, every method below was the owner's idea, proposed after a problem it would have caught.

| Stage | Suggest |
| --- | --- |
| First playable build with state worth testing (progress, unlocks, timed events) | A tester panel for this game (§5) |
| First flows done (onboarding, the first game, the first reward) | Persona walk-throughs (§2) |
| Any text players read: FAQ, cards, banners, prompts | A wording round; translation checked by a second agent (§3) |
| Each batch of fixes | A round with a separate verifier (§1) |
| After every publish | The key checks again on the published World (§4) |
| Phones are a target | Phone sessions paired with the owner (§6) |
| Before launch, or before rewards gain real value | Separate security and performance audits (§7) |

Ask before starting anything that costs the owner time (phone sessions, live rounds). Rounds an agent can run alone, offer and run.

## 1. Rounds with a separate verifier

Brief template, what counts as PASS, and the fresh-build check: `{baseDir}/references/verifier-rounds.md`.

- Keep a numbered list of items. Fix a batch, then hand the list to a **separate** agent, not the one that made the fixes, to check each item in-world and report PASS or FAIL with a screenshot and the steps it took.
- Fix what a round finds **in that round**, then check again. Issues left for later pile up, and the next round's check is what catches a fix that broke something else.
- A FAIL repeats until it passes. A fix that works in 2 of 5 tries is a FAIL.
- Before each check, confirm the preview is serving the build you think it is: the folder, the latest bundle, no other session rebuilding mid-check (**unity-explorer-mcp** → recovery).
- Give each item its proof: a screenshot shows a look; a log line or state read shows behaviour; only a device shows how it plays on that device.

## 2. Persona walk-throughs of built flows

How to pick personas, the brief, checking their claims, and examples of what they caught: `{baseDir}/references/persona-rounds.md`.

Personas are not evidence of demand (**dcl-gdd** → acquisition). They are a cheap way to walk the flows you built from a starting point other than yours, and to break a builder's tunnel vision.

- Build one persona per real gap in the audience, for example: *knows the game genre, new to Decentraland* and *a Decentraland regular, new to the genre*. Give each a goal, what they already know, and a day 1 and a day 2.
- Each persona plays through the Explorer and reports where it got stuck, what it misread and what it expected to happen.
- Have a **different** agent check the persona's claims in-world before anything changes. In practice some claims are wrong (a camera "problem" that wasn't there, a sign-in wall that didn't exist) and the check finds new issues along the way.
- Treat findings as leads, not verdicts. Repeat with a fresh persona after the fixes.
- Run a **progress reset to a new player** between runs (§5), so each persona really starts fresh.

## 3. Wording and translation

- Run a wording round on any text players must act on: one agent reviews it for the audience in §2 (is it clear to someone new to Decentraland? to someone new to the genre?), another applies the changes, and the result is read back in-world at the real size, on desktop and phone.
- For translations, one agent translates and a **separate** agent checks the translation against the source and against the UI's own terms (a setting named one way in the menu and another way in the FAQ is a common slip). Then check in-world in each language: text length breaks layouts.
- Language selection itself: `getPlayerLanguage()` (**advanced-input**).

## 4. The published World, not only the preview

The preview hides things: download time (files come from your PC), sign-in and anything served from your own backend, the converted assets, and what other players see.

- After every publish, repeat the key checks on the published World through the Explorer MCP: load to movement, sign-in, the main flow, anything the publish touched.
- Persona rounds work on the live World too.
- A publish to a World replaces the scene live there, even on a private World, so a test publish replaces the real one. Use a separate World for experiments (**deploy-worlds** for publishing).

## 5. A tester panel for this game

A worked example (three tabs, five roles), the role rules, and the audit finding behind them: `{baseDir}/references/tester-panel.md`.

Suggest an in-scene panel that lets testers reach the state they need instead of playing their way to it. It is different from the automated PASS/FAIL panel in **unity-explorer-mcp** → in-scene checks: this one is for people.

- Its contents come from the game. Ask: *what would a tester need to reach, force or reset quickly here?* Examples from one scene, none required: set progress or level, unlock rewards, force a card or screen to show, switch time of day or fog, turn effect groups on and off (which found the cause of a phone performance problem), and **start over as a new player**.
- **Roles.** The panel can stay in the published scene behind roles the owner grants to other wallets (for example QA and organizer), each with its own options. That brings real people on real devices, phones included, into testing without owner powers.
- Check every role on the server, not only in the scene UI, with the caller's wallet taken from the verified sender, never from the message. Keep tester tools away from anything with real value: live prizes, other players' data. In one audit a QA role could start rounds of a live prize tournament and read winners' wallets.
- Hide the panel completely from players without a role, and design it for the phone layout too.

## 6. Phones

The paired-session steps, the frame-capture script (`{baseDir}/scripts/capture-mirror.ps1`, Windows) and how to review the frames: `{baseDir}/references/phone-testing.md`.

Agents can't run the phone client, and phone-only bugs are common: a fix can pass on desktop and fail on the phone.

- **Pair with the owner.** The owner plays on the phone while an agent on desktop plays the other side (an opponent, a second player) or gives the steps one at a time.
- **Capture what the phone shows.** The owner mirrors the phone to the PC; a small script grabs the mirroring window about once a second and keeps only frames that changed; a separate agent reviews the frames and lists findings with the frame each comes from. Check the script on a short run first: a first run that keeps no frames is easy to miss.
- Re-check on the phone every fix that touches layout, NPCs, loading or input.
- Read limits in the mobile preview only, and take each reading twice (**optimize-scene** → Mobile Scene Limits).
- Some flows need two people or two devices (a match, a tournament). Plan them with a desktop agent as the second player.

## 7. Security and performance audits

Before launch, run each as its own read-only pass, ideally by a fresh agent, then fix in batches with §1.

- **Brief:** read-only (no edits, deploys or publishes); measuring is allowed; every finding states its risk to gameplay, a test that proves gameplay still works, and its effect on desktop and phone separately.
- **Report:** findings ranked by gain for effort, with what was not covered.
- **Decisions:** the owner rules on each trade-off in a decisions file; then batches, each checked by a separate agent.
- **Security checklist** for scenes with their own backend: signed-request binding, per-wallet limits, sybil farming, display state built by the server, private state, fail-closed secrets, and **what the host logs** (**scene-runtime** → Your own backend; **authoritative-server**).
- **Performance checklist:** know which readings come from the preview and which from the published scene; time cold loads on the published scene; measure before and after each change (**optimize-scene**).

## Output

Keep test state in files the next session can read: the item list with PASS/FAIL, the persona briefs and their reports, the audit reports and decisions. A conclusion drawn from one screenshot in a chat doesn't survive the session; a written result does.
