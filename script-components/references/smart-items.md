# Script-based Smart Items

Read this before inspecting, extending or copying a catalog Smart Item. Most catalog Smart Items are **`asset-packs::Script` code with `@action`-tagged methods**, the mechanism **script-components** documents, not an Actions/Triggers no-code graph.

## Anatomy of a Script-based item

- **No `asset-packs::Triggers`.** The behavior is in the `.ts` file the `Script` component points at (`Door.ts`, `Seat.ts`, `Button.ts`, `Lever.ts`, `Bell.ts`, `Teleport.ts`, `Sign.ts`, …).
- **The remaining `Actions` are `call_script_method` pointers** that keep the public action names ("Open", "Close", "Open or Close", "Sit Here"), so scenes that reference them keep working. Their `jsonPayload` is `{"scriptPath": "{assetPath}/Door.ts", "methodName": "open", "params": {}}`.
- **The Script's params are the configuration UI**; these items have no `inspector::Config` panel.
- **"When X happens" hooks are optional `ActionCallback` params.** Names in the shipped items: `onClick`, `onActivate` / `onDeactivate`, `onReachStart` / `onReachEnd` (the moving-platform family), `onRing` (bell), and `onOpen` / `onClose` (the open/closed sign, not the doors). Wire them as in SKILL.md → *ActionCallback parameters*.
- **State lives in a synced `asset-packs::States` component** listed in `core-schema::Sync-Components` (`{"componentIds": ["asset-packs::States"]}`). A door creates `States` with `value: ['Open','Closed'], defaultValue: 'Closed'` in `start()`; a chair carries `['Free','Taken']` per sit spot. Read and write state through `States`, not through script instance fields, or it will not replicate.

## Items that are not Script-based

These still use `Actions`/`Triggers` and/or the `inspector::Config` panel: `click_area`, `audio_stream`, the lights, the screen/media family, `camera` (Actions + Config, no Triggers), `admin_toolkit`, `image`, `nft`, `text`, and the health/combat family (`first_aid`, `healing_pad`, `health_bar`, `respawn_pad`, `robot`, `spikes`, `sword`, `barrel`, `wooden_wall`). `video_player` is **`[DEPRECATED]`** (in the `deprecated` category); use one of the video screen items instead.

## Item behaviors worth knowing

- **`teleport`** handles world teleports: a non-empty `world` param does a realm change; otherwise it teleports to `x`/`y` coordinates.
- **`trigger_area_prompt`** (shown as **"Trigger Area"**, id `e9fa0eab-44de-4efe-af77-a71171a1a73f`) is the catalog's only trigger-area item, and Script-based. Read its `TriggerArea.tsx` before writing a detector of your own; it is the reference for the `@event` detector/reaction pattern (SKILL.md → *`@event`*). The `TriggerArea` component itself: **add-interactivity**.
- **Seat** (`Seat.ts`): a seat frees itself when the sitter walks more than **1.5 m** away; `sit()` picks the **nearest free** spot; with no spot free the item shows its `takenMessage` (default **"Seat is taken"**). The avatar is moved *before* the sitting emote plays; reversing that order cancels the emote.

## Reference items to read before writing your own

All under `packs/smart_items/assets/` in the creator-hub asset packs.

- **`locomotion_settings`** ("Locomotion Settings", `utils`): nine `Slider<Min,Max,Step>` params seeded with the SDK defaults and a `@param` tooltip each; a `start()` that writes a component onto `engine.PlayerEntity` (a **global** effect, so the item has no in-world presence); two `@action` methods (`apply` re-writes the values, `restoreDefaults` calls `deleteFrom`); and an editor-only `asset-packs::Placeholder` cube so it can be selected in the viewport while invisible in-world. No `Actions`, `Triggers`, `Config` or `States`. What it configures: **player-avatar**.

The next three are described from the items' change descriptions, not verified in-world:

- **`floor_pressure_button/FloorButton.ts`**, a shared multiplayer button: a trigger area the size of its disc. In the default `all players` mode the button stays down while *anyone* stands on it, and its On Press / On Release actions run **once**, on the client of the player who caused the change (first on / last off), with a `press()`/`release()` *hold* synced through `asset-packs::States`. `my player` makes it a private per-player button.
- **`water_plane/Water.ts`** builds the water from five translucent `MeshRenderer` layers at runtime (the GLB is an editor-only `Placeholder`), refits its trigger area only when rescaled, and spawns splashes in scene coordinates.
- **`lab_stair_platform/PistonPlatform.ts`**: `startState` as a string-literal union (the editor turns it into an enum dropdown) and only `States` in Sync-Components, since `update()` replays `Animator`/`AudioSource` from the synced state on every client.

## Preview error after adding the first item

`Component asset-packs::Actions not found` in a running preview, right after adding the scene's first smart item or `asset-packs::Script`, is a bundling defect on `@dcl/sdk` older than 7.30.1, not a component missing from the composite: restart the preview. On 7.30.1+ the next watch rebuild recovers on its own.
