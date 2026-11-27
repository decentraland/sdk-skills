# Verifier rounds

The agent that made a fix is the worst judge of it. A verifier is a separate agent whose only job is to check a list of items in-world and say PASS or FAIL.

## The loop

1. Keep one numbered list of open items (bugs, requested changes), each with how to reproduce it.
2. Fix a batch. Build once, and make sure only one process writes the bundle (**unity-explorer-mcp** → recovery).
3. Hand the list to a verifier agent with the brief below.
4. Fix every FAIL in the same batch and send just those items back to a verifier. Repeat until they pass.
5. Then move to the next batch. The next round's verifier also catches a fix that broke something checked earlier.

Issues left "for later" pile up. One rule from the round behind this guide: what a batch check finds is fixed in that batch.

## The brief

- **Role:** "Only observe and report. Do not edit source files, build, commit, push or publish."
- **Where:** preview or published World, the port or World name, and "do not start a second server or run a build".
- **Fresh build check:** a visible marker that proves the preview runs the new bundle (a build date shown in a tester panel, a log line). Reload once at the start, and stop if the marker is wrong. One verifier found the preview was serving a different folder; another found someone else's rebuild had reloaded the bundle mid-check.
- **Rules:** desktop or phone layout, which controls are allowed (tester panel resets, language switch), what to put back at the end (language, camera in third person), what never to flag (the owner's own tools).
- **The items,** each with its ID, what PASS looks like, and how to reach it.
- **Output:** for each item PASS, FAIL or NOT REACHABLE, what was seen, and a screenshot named after the item, saved to a folder the owner can open.

## What counts as PASS

- A fix that works in some tries and not others is a FAIL. In one round a fix that kept a bot opponent kneeling failed twice ("stood in 3 of 5 games") before it passed on the third round.
- Match the proof to the claim: a screenshot shows a look; a log line or a state read shows behaviour; only a phone shows the phone (**phone-testing.md**).
- NOT REACHABLE is an honest result. Report what blocked it (the Explorer wasn't running, a scene reload dropped the scene); don't guess.

## After a publish

Run the key items again on the published World. Sign-in, loading and anything served from your own backend can differ from the preview.
