# Recovery reference

Reached when the scene, the client, or the connection has gone wrong. The everyday invariants stay in `SKILL.md` under "Scene health"; these are the branches a minority of sessions hit.

## Torn bundle (an unrecoverable scene drop)

The **one write per change** rule in the iteration loop exists because of this failure. Two saves seconds apart can make the Explorer load a mid-write bundle → `SyntaxError: Invalid or unexpected token` at scene start → the scene drops out and `get_scene_state` reports `scene: null` while you are standing on the parcel.

From that state nothing recovers in-session: `reload_scene` errors ("no scene at the current parcel"), `/reload` hangs, the minimap RELOAD SCENE button no-ops, and moving off-parcel and back does not bring it back. Only relaunching the Explorer restores it: have the user close the client, then relaunch the stack the way it was started.

The milder version of the same cause: usage and import landing in separate saves gives a transient `SceneError: X is not defined`.

Prevention, in order: batch multi-part changes into ONE write, write new modules before wiring them in, and after any save landing seconds after a previous one verify `get_scene_state` still shows a scene before saving again.

## Player ends up off-parcel after a hot reload

The player can land outside the scene (e.g. parcel `0,-1`); `get_scene_state` then reports a null scene and `reload_scene` fails with "no scene at the current parcel". Check `get_player_state` → `parcel`, `move_to` back inside, and the scene loads again.

## The connection dropped

The client probably crashed or was closed — relaunch it the same way it was started (`npm run start -- --mcp --skip-auth-screen true`, or the manual launch line in [`setup.md`](setup.md)); the MCP endpoint URL stays the same.
