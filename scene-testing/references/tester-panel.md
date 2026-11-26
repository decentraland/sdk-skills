# A tester panel for your game

Most of a tester's time goes into reaching the state they want to check: ten games played, a reward unlocked, a card that shows once a day. A tester panel is an in-scene card that gets them there directly. It is for people; the automated PASS/FAIL panel in **unity-explorer-mcp** → in-scene checks is for agents.

## What goes on it

Ask: *what would a tester need to reach, force or reset quickly in this game?* The answer is different for every game. As an example, one board-game scene's panel grew to three tabs as testing needed them:

- **Account:**
  - *start over as a new player*, asking once more before it wipes the account;
  - end the current game now, to test the result card;
  - rate limits off for this account;
  - a phone-layout preview on desktop;
  - debug info and the build date, which verifiers use to confirm they're on the new build.
- **Progress:** pretend games played and pretend daily-puzzle days on top of the real record, "+1 step" on each progress track, and preview of locked cosmetics. All of it can be switched off again.
- **World:** time of day and fog for your screen only, trying alternative looks for the game pieces, trying effects.

Each control was added when someone needed it. Some proved their worth beyond testing:

- Switching effect groups on and off on a phone found the cause of a performance problem: NPC avatars were counted as effect emitters.
- Time of day and fog picked the scene's final lighting.
- "Start over" made fresh-player persona runs possible (**persona-rounds.md**).

Keep the panel small enough to fit a phone screen. Use tabs before it runs off the bottom.

## Roles

The panel can stay in the published scene, shown only to people the owner gives a role. Then real people test on real devices, phones included, without owner powers. One scene used five roles: owner, admin, organizer, teacher and QA, each with its own options. The owner grants roles to wallets from an admin card.

- **Check every role on the server.** The scene hiding a button is not a permission. Each action re-checks the caller's role where the state lives (**authoritative-server**, or your own backend: **scene-runtime** → Your own backend).
- **Keep tester tools away from anything with real value.** In one security audit the QA role could start the next round of a live prize tournament, settle running games and read the winners' wallets. Event and prize tools moved to owner and admin only. A safer design marks events as tests and lets QA act only on those.
- **Keep the limits on what QA can grant itself.** Rate limits switched off for a tester's own account are fine; progress, rewards or rank that count for real are not.
- **Log actions that change shared state,** with who did them, so a tester's action can be told apart from a player's.
- **Hide the panel completely** from everyone without a role, and keep it out of the way of the owner's other tools.

## Without a server

Gate the panel to the preview with `realm.realmInfo?.isPreview` (**scene-runtime**), and keep its actions to the tester's own local state. Anything shared needs a server to check roles.
