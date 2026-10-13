# Embedded emotes (shipped inside the Explorer)

These 21 emotes ship in the Explorer client binary, so they need no catalyst fetch. Play them by id from a scene with `triggerEmote` on the player, or by setting `emotes` / `expressionTriggerId` on an `AvatarShape` (API details in **player-avatar**). Ids are **case-sensitive exactly as written**.

**Loop** is each entry's own `loop` flag (`Emote.IsLooping()` → `metadata.emoteDataADR74.loop`). A looping emote **holds its pose indefinitely with no re-trigger**; a non-looping one plays through once and the avatar returns to idle.

**Check this list before authoring a custom emote for a pose** (sitting, an idle variant): a built-in clip usually reads more naturally than a hand-authored one, and the looping ones need no replay logic at all.

| Id                     | Group       | Loop | Description                                                                                       |
| ---------------------- | ----------- | ---- | ------------------------------------------------------------------------------------------------- |
| `sittingChair1`        | Sitting     | yes  | Seated on a chair, variant 1. Set once and the avatar stays seated (verified SDK 7.30.1, 2026-10-12) |
| `sittingChair2`        | Sitting     | yes  | Seated on a chair, variant 2                                                                      |
| `sittingGround1`       | Sitting     | yes  | Seated on the ground, variant 1                                                                   |
| `sittingGround2`       | Sitting     | yes  | Seated on the ground, variant 2                                                                   |
| `buttonDown`           | Interaction | no   | Press a button below / at waist height                                                            |
| `buttonFront`          | Interaction | no   | Press a button in front                                                                           |
| `getHit`               | Interaction | no   | Flinch from a hit                                                                                 |
| `knockOut`             | Interaction | no   | Get knocked out                                                                                   |
| `lever`                | Interaction | no   | Pull a lever                                                                                      |
| `openChest`            | Interaction | no   | Open a chest                                                                                      |
| `openDoor`             | Interaction | no   | Open a door                                                                                       |
| `punch`                | Interaction | no   | Punch                                                                                             |
| `push`                 | Interaction | no   | Push                                                                                              |
| `swingWeaponOneHand`   | Interaction | no   | Swing a one-handed weapon                                                                         |
| `swingWeaponTwoHands`  | Interaction | no   | Swing a two-handed weapon                                                                         |
| `throw`                | Interaction | no   | Throw                                                                                             |
| `crafting`             | Other       | no   | Crafting / working with hands                                                                     |
| `handsintheair`        | Other       | no   | Hands in the air — note the lowercase, no separators                                              |
| `Victory`              | Other       | no   | Victory pose — capital `V`, not `victory`                                                         |
| `Waving`               | Other       | no   | Wave — capital `W`, not `waving`                                                                  |
| `fistpump_short`       | Other       | no   | Short fist pump — with the `_short` suffix, not `fistpump`                                        |

**Not embedded:** the social emotes (`wave`, `fistpump`, `robot`, `raiseHand`, `clap`, `money`, `kiss`, `tik`, `hammer`, `tektonik`, `dontsee`, `handsair`, `shrug`, `disco`, `dab`, `headexplode`) are resolved as emote urns like any other wearable emote and are listed in **player-avatar** (`references/avatar-apis.md`).

Source: `Explorer/Assets/DCL/AvatarRendering/Emotes/EmbeddedEmotes/EmbeddedEmotes.asset` (unity-explorer `main`, read 2026-10-12).
