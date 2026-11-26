# Persona rounds

A persona round has agents walk your built flows as specific kinds of visitor. It is not evidence that anyone wants the game (**dcl-gdd** → acquisition). It is a cheap way to see the scene from a starting point other than the builder's, and to catch what the builder no longer notices.

## Choose the personas

One persona per real gap in the audience. A gap is something the visitor doesn't know that the scene assumes. For a board-game club scene the two gaps were:

- **Knows the game, new to Decentraland.** Plays it seriously elsewhere, knows its terms. Has never opened Decentraland: doesn't know the E key, the client's own UI, emotes, wallets or that a click on the world may do nothing.
- **A Decentraland regular, new to the game.** Walks, jumps, presses E, collects emotes and wearables. Doesn't know the rules or the game's vocabulary.

Give each a name, an age, what they know and don't know, what they want from a first visit, and how they behave (reads every card, or closes them and runs). Two or three personas are enough.

## The brief

Each persona agent gets:

1. **Who they are**, as above. "Stay in this head the whole time."
2. **What to do:** a first visit with a goal ("find a game and play one"), then a return visit ("day 2"). A real day can't pass, so day 2 is a reload; say which saved state should carry over.
3. **How to play:** in-world through the Explorer MCP (**unity-explorer-mcp**), on a fresh account or after a progress reset (§5 of the skill), on the published World when possible.
4. **What to report,** for each step: what they saw, what they expected, where they got stuck, the words they didn't understand, and a screenshot name. End with "Would I come back tomorrow, and why?" in character.
5. **Rules:** observe only (no edits, no builds), the controls they may and may not use (a tester panel is for resets, not for skipping the flow), end with the camera in third person.

## Play in-world, then check the claims

- **Run personas in the Explorer, not by reading the code.** In the first round behind this guide the persona agents only read the strings and the code. A second agent then walked the same flows in-world, and several claims were wrong: a spawn camera said to face the roof faced the path, and a sign-in wall didn't exist for that kind of account. The same walk found new issues the readers couldn't see, such as a rank shown on a brand-new player's nametag.
- **Have a separate agent check each claim** before anything changes. Mark each **confirmed**, **partly**, **wrong** or **new**, with the screenshot or code line that settles it. Keep the wrong ones in the report with the reason, so they aren't raised again.
- **Triage** what's left into broken, confusing, quality of life, and wrong, and let the owner pick what goes into the next fix batch.

## What persona rounds caught

From one launch's rounds, as examples of the kind of finding to expect:

- a teleport that landed the player facing a folding screen, so W did nothing;
- a persona running straight at the building got wedged between a lantern and a bridge railing;
- an AI review that took about 100 s while its card promised "under a minute";
- a win in the beginner mode that the profile didn't count, so it "felt like it didn't count";
- no greeting and no nudge on a return visit, the moment that should bring players back.

## Repeat

After the fixes, run a new round with fresh personas or fresh accounts. Persona agents that remember the last round are no longer new visitors.
