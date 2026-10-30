# In-scene checks: build the assertion into the scene

Reached when a behaviour cannot be read back through any MCP tool. Put the assertion in scene code and read the verdict off an in-world panel. [`9,99-modifier-areas`](https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/9,99-modifier-areas) is the reusable shape (`src/qaPanelUi.tsx`):

- A **QA info panel** pinned in a corner holds the instructions, a **Run** button per check, and a PASS (green) / FAIL (red) / NOT RUN result per check. One `screenshot` then reports the whole suite.
- Each check **drives itself**: it creates its own probe entities, `movePlayerTo`s the player to a position that discriminates pass from fail, waits for the state to settle, reads an *observable* proxy, prints the verdict, and tears the probes down so it can be re-run.
- When the property you care about is unreadable, **substitute a readable sibling**: the scene cannot ask whether an avatar is hidden, so it swaps in a `TriggerArea` drawn from the same collider pool and asserts on the enter event instead; for the camera it reads `CameraMode`. Keep the unreadable case as a short manual step in the same panel.
- Every step logs with a `[checkName]` prefix, so `get_scene_logs` explains a FAIL without another screenshot.
- Hold **Alt** to use a panel like this (pointer unlock), and keep probe geometry on a **separate entity** from the thing under test — a `MeshRenderer` on the tested entity misreports as soon as the test mutates it.

Write the panel before you start clicking: a check that reports itself survives the session, a conclusion drawn from a screenshot does not.
