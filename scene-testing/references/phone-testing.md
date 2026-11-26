# Phone testing with the owner

Agents can't run the Decentraland mobile client. Phone-only bugs are common anyway: in one launch round a fix that passed every desktop check (an NPC opponent visible during an opening animation) was still invisible on the phone from the start of the game to its end. These are the two ways that worked.

## 1. Paired session: owner on the phone, agent on desktop

Use it for anything that needs a second player or a second device: a match, an invite, a tournament, two players seeing each other's state.

1. The agent plays on desktop through the Explorer MCP (**unity-explorer-mcp**), on the published World or the preview, as the other side.
2. The agent gives the owner one step at a time ("challenge me from the Players list", "press Leave now") and waits for "done" before its own next move. Say plainly what to look at on the phone after each step.
3. The owner reports what the phone shows in a word or two, or takes a phone screenshot when something looks wrong.
4. The agent writes each result next to its step, with the time, so findings can be matched to frames later (§2).

Clocks keep running while the agent waits for the owner. A timer that ran down during a pause is not a bug; note the pause.

## 2. Frame capture from a mirrored phone screen

Use it to review a whole phone session without asking the owner to screenshot every moment.

1. The owner mirrors the phone to the PC with any screen-mirroring app, and leaves its window open (it can be covered, but not minimised).
2. Find the mirroring app's process name (`Get-Process | Where-Object MainWindowTitle` on Windows).
3. Run `powershell -ExecutionPolicy Bypass -File {baseDir}/scripts/capture-mirror.ps1 -Process <name> -Minutes 1` as a test (Windows' default policy blocks unsigned scripts), and check the output folder has frames. A first run that keeps nothing is easy to miss: check before the real session.
4. Run it for the session (`-Minutes 30`, default one capture a second). It keeps a frame only when the picture changed, so idle moments cost nothing.
5. Hand the folder to a **separate** agent to review. Ask it for a list of findings, each with the frame file name, what is wrong, and whether it looks phone-only. In the session behind this guide, 141 kept frames produced 16 phone findings, including:
   - an NPC that never showed on the phone;
   - a large 3D label in the player's face after leaving a table;
   - a first-visit card missing after a progress reset;
   - a panel that took about 13 s to open;
   - a card overlapping the phone's own on-screen buttons.
6. Treat what the reviewer reads from small frames with care: text in a downscaled frame is easy to misread (a "60.5" read as "50.5", a correct word read as a typo). Confirm anything surprising on the phone or in the code before fixing it.

The script is Windows-only (PowerShell and `System.Drawing`). On other systems, any loop that screenshots the mirroring window once a second and drops near-identical frames does the same job.

## What to check on the phone after every fix

- Layout: cards, buttons and text at the phone's real size, clear of the client's own on-screen buttons (**build-ui** → mobile placement).
- NPCs and avatars: present when they should be.
- Loading: time to move on the published scene, from a cold start.
- Input: anything a desktop player does with a key, the phone player can reach by touch.
- Limits: read in the mobile preview only, twice (**optimize-scene** → Mobile Scene Limits).
