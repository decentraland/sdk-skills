# Recovering from a dead data layer or a broken spawn-point write

Read this when `assets/scene/main.composite`'s mtime did not advance across a batch of mutations, or when `scene.json` shows `"position": {}` in a spawn point. The rules are in `SKILL.md` → RULE — confirm a batch landed on disk; mechanisms in [`internals.md`](internals.md).

## Symptoms of a dead data layer

Observed 2026-10-08; check these when the mtime is stale:

- `set_component`, `create_entity`, `place_smart_item` and friends all still return success.
- `scene_state` / `entity_detail` keep returning the **pre-crash** values: a read-back "confirming" your write is confirming the old snapshot.
- `editor_screenshot` returns a blank image.
- `get_scene_metrics` returns all zeros with an empty `entitiesOutOfBoundaries`, but under the Bevy renderer those fields are hardcoded zeros anyway, so this is no tell. The mtime check is the reliable one.

## Recovery (the user's; your in-memory edits are lost)

No tool restarts the data layer.

1. Stop writing.
2. Grep the Creator Hub main log (macOS: `~/Library/Logs/creator-hub/main.log`; Windows: `%APPDATA%\creator-hub\logs\main.log`) for the crash line: `grep -n "exit code=1\|reading 'deserialize'" main.log`. Grep rather than skim: the 2026-10-08 crash line sat inside a 241 KB result. The line looks like `Exiting "sdk-commands start … --data-layer" … exit code=1`.
3. Tell the creator to **close and reopen the scene** in the Creator Hub.
4. **Re-apply every mutation made since the crash**: compare against the composite on disk to find where the truth stops.
5. Leaving the editor page also kills that scene's preview server, so after the reopen the creator presses **Play** again (or you call `launch_preview` again) before expecting anything new in-world.

## Spawn points that came out as `"position": {}`

Close the scene in the Hub and fix `scene.json` by hand. On the next open the data layer re-seeds the scene metadata from `scene.json`, so the hand edit wins; the same holds for any other scene setting edited with the scene closed. The shape mismatch is a Hub bug; report it with **report-sdk-issue**.
