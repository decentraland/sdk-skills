# What a Decentraland scene is, and what the Explorer already provides

## A scene is a place in a shared, continuous world

- **No startup screen**: The scene is always live. Players walk in from adjacent parcels — there is no splash screen, no "press start." Your scene must be meaningful the instant a player arrives.
- **No forced endings**: You cannot force a "game over" state. Players can leave at any time by walking away or teleporting. Design loops that accommodate drop-in / drop-out naturally.
- **Cannot remove players**: There is no API to eject a player from a scene. You can teleport a player, but only within the existing scene. If you're teleporting outside the scene, you can only do it with their consent (they must accept the prompt). Design around misbehaving players with game mechanics, not eviction. If the scene has admin players, admins are able to ban other players from the scene manually.
- **Boundary awareness**: Players standing outside your parcel can see into it. Your scene is always on display — make it look inviting from the parcel boundary. Neighboring scenes are visible too — consider visual harmony.
- **Shared space**: Multiple players are always potentially present. Even a "single-player" puzzle is witnessed by others. Embrace or account for this.

## The platform already provides this — don't rebuild it by default

The Explorer ships these for every scene. Do not plan, scope or build a scene version unless the design genuinely needs a different one:

| Provided by the Explorer | So the scene does NOT need |
|---|---|
| Identity: wallet + display name (`getPlayer()?.name`, `.userId`, `.isGuest` from `@dcl/sdk/players`) | A login, account or "enter your nickname" screen |
| Name tags above every avatar, and a profile **passport** on click | Floating player-name labels. For a rank/team plate, add an `AvatarNametag` (see **player-avatar**) |
| Text chat, voice chat (nearby, private and community calls), friends list and requests, user blocking | A chat box, a friends list, a mute/block feature |
| Emote wheel with default + owned emotes | An emote menu (to trigger one from gameplay: `triggerEmote` / `triggerSceneEmote`) |
| Avatar customization from the backpack (wearables) | A dress-up / character-creator screen |
| Loading screen while the scene downloads | A loading screen or progress bar |

- **Scenes CAN override any of these when the design calls for it**: hide all avatars and/or name tags in a zone (`AvatarModifierArea` with `AMT_HIDE_AVATARS` / `AMT_HIDE_NAMETAGS`, plus `AMT_DISABLE_PASSPORTS`), then show your own body at the player's position (an `AvatarShape` or a model that follows the player; other players see it only if you sync it yourself — docs `avatars/npc-avatars.md` → *Replace the player's avatar*, **npcs**); silence voice chat on the scene (scene settings restrictions / `featureToggles.voiceChat`, see `{baseDir}/references/scene-json.md` → Feature Toggles); show a custom start or title screen. Make it a deliberate choice, not a reflex carried over from standalone games.
- **Skipping a start screen is a feature.** With none, the player lands straight in the game and starts playing on arrival. If you add one, gate it on the loading screen lifting (`EngineInfo.sceneHidden`, pattern in **scene-runtime**) and keep it to one tap.

Verified: Explorer modules `Chat`, `VoiceChat`, `Friends`, `EmotesWheel`, `NameTags`, `Passport`, `Backpack`, `SceneLoadingScreens` (unity-explorer `Explorer/Assets/DCL/`); docs `design-experience/design-games.md` (*Communication between players*, *Avatars*) and `scene-editor/configure/scene-settings.md` (*Scene restrictions*); `AvatarModifierType` enum in protocol `avatar_modifier_area.proto`.
