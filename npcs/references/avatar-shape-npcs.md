# AvatarShape NPCs: emote, locomotion and wearable internals

Read this when an `AvatarShape` NPC must hold a custom pose, move while emoting, hide and reappear, or copy the player. The one-line rules are in `SKILL.md` → Approach 2.

## Custom clips do not loop on an `AvatarShape`

The Explorer builds every scene-emote request for an `AvatarShape` with `loop: false` regardless of the clip's own flag ("looping scene emotes on SDK AvatarShapes is not supported yet", `AvatarShapeHandlerSystem` in unity-explorer). Only the embedded looping emotes (`{baseDir}/../avatar-animations/references/embedded-emotes.md`) hold a pose. Authoring an emote, looping it on the live player via `triggerSceneEmote({ loop: true })`, and triggering it on an `AvatarShape` are three different playback paths.

For a sustained custom pose: author one long static clip and retrigger it shortly before it ends by bumping `expressionTriggerTimestamp`. Verify the seam in-world; the retrigger has not been checked for visible snapping.

## Moving the NPC cancels the emote

Writing the `AvatarShape`'s `Transform.position`, or running a `Tween` on it, while an emote plays drops the emote and the avatar falls back to its walk cycle: the Explorer re-derives the locomotion blend from the per-frame Transform delta on every frame (`SDKAvatarShapesMotionSystem.UpdateAnimations`). To move an NPC **during** an emote (sink through the floor while screaming, slump sideways), bake the translation into the clip as root/hips motion inside the `_emote.glb`; the Explorer plays that back on an `AvatarShape`.

## Hiding an `AvatarShape`

Moving it out of sight (e.g. 60 m underground) makes it *walk* there, visibly, because the Explorer interpolates AvatarShape movement. Set `Transform.scale` to near zero (`0.001`) and restore it afterwards. `VisibilityComponent` on an `AvatarShape` has not been tested; do not rely on it until it has. Primitives, GLBs, `AvatarShape`, nametags, lights and colliders each hide differently: check the recipe per kind.

## No masked emotes on NPCs

`mask?: AvatarMask` (upper-body only) exists only on `TriggerSceneEmoteRequest`, i.e. the player's own `triggerSceneEmote`. `PBAvatarShape` has no mask field, so `expressionTriggerId` is always full-body.

## Locomotion is engine-driven: no frame-by-frame puppeting

Each frame an `AvatarShape` walks from where it is toward the authored `Transform.position` at 4 m/s, or faster once the target is 1.5 m or more away. The speed is frame-rate dependent: it is reset to 4 and nudged by `100·dt` every frame (about 5.7 m/s at 60 fps, 7.3 at 30, the nominal 10 m/s only below ~17 fps). It **turns to face its direction of travel** (slerp, 6.5/s); the authored rotation applies only once it has arrived (`SDKAvatarShapesMotionSystem.cs`).

A `Tween` on the entity's position suppresses the engine move and a `Tween` on its rotation suppresses the auto-facing, but an entity holds one `Tween`, so you cannot own both. Feeding it the player's mirrored position therefore gives a double that trails at walking pace and spins round when the player backs up (observed on a mirror double, 2026-10-09, with both a per-frame `Transform` write and a continuous move tween).

For a mirror double, a shadow, a replay ghost or anything that must match the player's pose every frame, use a **rigged humanoid GLB** with an `Animator` (idle / walk clips switched from the player's speed) and write its `Transform` directly each frame. It will not wear the player's look; that is the trade. Rigged humanoids with clips: grep `{baseDir}/../add-3d-models/references/model-catalog.md` for `character/` rows whose `[anim: …]` lists `idle` and `walk` (e.g. `base-character`, `berserker-npc`; `arissa3` has idle + running). `mannequin` returns display dummies with no clips.

## What a copy of the player can visibly differ in

Decided by wearable *categories*, which you can read from the catalyst:

```
https://peer.decentraland.org/lambdas/collections/wearables?wearableId=<urn>&wearableId=<urn>
```

Each entry returns `data.category`, `data.hides`, `data.replaces` and `data.representations[].overrideHides` / `.overrideReplaces` (e.g. `urn:decentraland:off-chain:base-avatars:red_bandana` → `category: "tiara"`, `replaces: ["mask","hat","helmet"]`). Use it to pick swaps that will actually show.

**Fallback that always shows:** vary the copy's `Transform` scale, e.g. taller `1.07`, shorter `0.93`, broader `1.10`. It is independent of wearables and reads instantly in a line-up.

## Unconfirmed

Owner reports, not source-verified. Confirm in-world before designing around them.

- The **first** `expressionTriggerId` pointing at a scene `_emote.glb` shows a visible delay on an NPC (clip load). Playing it once on an off-screen `AvatarShape` at scene start to warm the cache was tried, with unconfirmed effect.
- A worn **skin** replaces the whole body, so added wearables, hair, skin colour and eye colour do not show on the copy.
- A **helmet** hides hair, headwear, earrings, eyewear and beard.
- `AvatarShape` cannot force a hidden wearable to render.
