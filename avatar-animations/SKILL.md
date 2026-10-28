---
name: avatar-animations
description: Find or author avatar animations (scene emotes) for the player — first the built-in emotes, then the Creator Hub Avatar Animations pack (45 downloadable `_emote.glb` clips, catalogued with previews), and only then a custom clip authored in Blender on the official Decentraland avatar rig, exported as `_emote.glb`, verified and handed to the scene — including upper-body-only (masked) clips and clips with animated props or bone particles. Use when the user wants an avatar animation or emote of any kind, a custom emote, to animate the player/avatar, to make the avatar do something specific (sit, hold cards, carry a crate, throw, cheer), to work with the Blender avatar rig, or to produce a scene emote .glb. Do NOT use for playing animations baked into a model (see animations-tweens), for merely triggering an emote the scene already has (see player-avatar), or for NPC animation (see npcs).
---

# Authoring Avatar Animations (Scene Emotes)

This skill covers **making the animation file**: posing the official Decentraland avatar rig in Blender, exporting a clip as a `*_emote.glb`, verifying it, and handing it to the scene. The scene-side API that plays it — `triggerSceneEmote`, `stopEmote`, `AvatarEmoteCommand`, the `AvatarMask` enum, the permission — lives in **player-avatar**; this skill links there rather than repeating it.

## RULE: Look for an existing animation before authoring one

When the user asks for an avatar animation, go through these in order and stop at the first fit — authoring is the last resort, not the default:

1. **Built-in emotes** — 32 ids playable by name (`triggerEmote({ predefinedEmote })`, or `AvatarShape.expressionTriggerId`), nothing to download: wave, clap, dances, sitting poses (looping), button/lever/door/chest interactions, punch, throw… Catalogued with animated previews in `{baseDir}/references/animation-catalog.md` §1; loop flags and the 5 embedded-only ids in `{baseDir}/references/embedded-emotes.md`. In the Creator Hub they sit inside the Avatar Animations pack with a **Built-in** badge, cannot be dragged into the scene, and offer **Copy name** — there is no file, by design (§1 of the catalog has the editor details).
2. **Avatar Animations asset pack** — 45 ready-made `_emote.glb` clips (sitting on stools, puffs, bean bags and ledges; chess; a full fishing set; carry, pick up, drink, craft, water plants, whack, sword, magic, fly, dance…). `{baseDir}/references/animation-catalog.md` §2 has every row with duration, download and the `triggerSceneEmote` path. Fetch the `preview:` webp to confirm the motion.
3. **Custom clip** — only when nothing above matches (or the user explicitly wants their own): the Blender workflow below.

Say which of the three you picked and why. A built-in or pack clip usually reads more naturally than a hand-authored one and costs minutes instead of hours; a custom clip is still the right call for a pose tied to a specific prop or scene geometry.

**Scope check before you start:**

| The user wants | Skill |
| --- | --- |
| An avatar animation of any kind — check the catalog first | **this skill** → `references/animation-catalog.md` (built-in, then pack), then **player-avatar** to play it |
| A new animation *of the player's avatar* that nothing in the catalog covers | **this skill** (Blender workflow) |
| To play a built-in emote, or a `_emote.glb` that already exists | **player-avatar** |
| To play an animation clip baked into a `.glb` model/prop | **animations-tweens** |
| To animate an NPC | **npcs** |
| To move/rotate an entity procedurally | **animations-tweens** (`Tween`) |

## Workflow

1. **Get the rig** — `Avatar_File.blend`, never a hand-built armature. Download + bone/control/property reference: `{baseDir}/references/avatar-rig.md`.
2. **Set up** — set the scene to **30 fps** (the shipped file is 24), capture the `Starting_Pose` values, create one new action per clip.
3. **Author** — pose `CTRL_` bones only, in Pose mode, keyframing every bone you touch at every keyframe.
4. **Verify while authoring** — print world positions (clipping, floor, animation area) *and* render four angles per keyframe into a contact sheet. If the clip poses the fingers, add hand close-ups and the fingertip decomposition.
5. **Export** — one clip per file, armature only, `export_def_bones=True`, `ACTIVE_ACTIONS`.
6. **Verify the GLB** — parse the JSON chunk: 1 animation, 0 meshes, 63 nodes, 62 channels per path, duration = `(frames − 1) / 30`. If the clip poses the fingers, also run the fingertip decomposition on the re-imported GLB.
7. **Hand off** — rename to `*_emote.glb`, drop under `assets/animations/`, add the permission, play it (see **player-avatar**).

Ready-made `bpy` helpers for every step — the helper module, sign detection, render/contact-sheet setup, the export call, and the GLB verifier — are in `{baseDir}/references/blender-emote-patterns.md`.

**How to drive Blender** (headless CLI vs Blender MCP, binary paths, and the rule that you must never fall back from the MCP to headless silently) is already covered in `{baseDir}/../add-3d-models/references/blender-authoring.md`. Emote authoring uses exactly those two paths; do not re-derive them.

## RULE: One new action per clip — and reset to the idle pose, not identity

Create a fresh action for every clip. In Blender 4.4+/5 actions are **slotted**, and `Action.fcurves` no longer exists (curves live under `act.layers[0].strips[0].channelbags`):

```python
act  = bpy.data.actions.new(name)
slot = act.slots.new('OBJECT', 'Avatar_Animation')
arm.animation_data.action = act
arm.animation_data.action_slot = slot
```

Before authoring anything, `scene.frame_set(0)` to evaluate `Starting_Pose` and **capture every pose bone's transform**. That snapshot — not the identity transform — is the baseline you reset to between keyframes. The rest pose of the armature is an A/T-pose; the idle the runtime blends from is `Starting_Pose`. Resetting to identity gives you a clip that snaps to a T-pose on the first frame.

## RULE: Key everything you pose, at every keyframe

`scene.frame_set()` **re-evaluates the active action and overwrites any un-keyed pose** (`view_layer.update()` does not). A render taken after `frame_set` of a pose you forgot to key silently shows the idle instead — you will debug the wrong thing. So insert keys on location, rotation and scale for every control bone you touched, plus any custom property you changed:

```python
pb.keyframe_insert('["FK > IK Leg L"]', frame=f)
```

On the **first and last frame**, also key location/rotation/scale on **every deform bone**. Channels left without boundary keys stay "open" and keep whatever a previously playing emote left there — the official docs call these *emote overrides*, and they show up as an avatar whose legs are still doing the last emote.

## RULE: Upper arms — world axes for direction, local Y for twist

The upper-arm bone's local X is tilted. Rotating about it sweeps the arm across the chest, and a pose that should have both arms forward ends up with the arms **crossed** — this happens in practice and is not obvious in a front render. So set the arm's *direction* with world axes, converting the world axis into the bone's current frame first:

```python
M = (arm.matrix_world @ pb.matrix).to_3x3().normalized()
local_axis = M.inverted() @ Vector(world_axis)
pb.rotation_quaternion @= Quaternion(local_axis, math.radians(deg))
```

- Pure forward raise → world **X**.
- Moving a raised arm in/out → yaw about world **Z**.
- A world-axis move is only "semantic" for the arm direction it was tuned on: the roll that spreads hanging arms outward **closes** the V once the arms point overhead (sign flips), and after a deep forward fold the arms point backward so a *forward* raise is what brings them down to hang. Check the numbers, not the verb name.
- Translating a control (`pose_bone.location`) works in the bone's **rest** frame, not its rotated frame — strip `matrix_basis` before converting a world delta, or a rotated control (an IK hand, a yawed COG) moves the wrong way. `move()` in the patterns reference does this.

World axes alone do not give a perfect arm pose, though. Arms move in many directions, and the rig's animator works with world **and** local rotations together. Two things need the bone's **local** axes:

- **Twist** — palm up/down, elbow pointing out or in, a wrist that has to face a prop — can only be done by rotating the bone about its own length, which is **local Y** on this rig (verified: local Y of `CTRL_FK_Avatar_Arm.*` is the bone axis; rotating it leaves the elbow where it is and only rolls the forearm and hand). `rl('CTRL_FK_Avatar_Arm.L', 'Y', deg)`.
- **Fine-tuning** once the gross direction is right — a small local correction is often more precise than another world-axis rotation.

## RULE: Elbows and knees hinge on local X — fingers curl on local Z

| Control | Locked | Bend axis |
| --- | --- | --- |
| `CTRL_FK_Avatar_ForeArm.*` (elbow), `CTRL_FK_Avatar_Leg.*` (knee) | Y, Z | **local X** |
| `CTRL_FK_Avatar_Hand.*` (wrist) | none | **local Z** flexes toward the palm, on both sides. Local X tilts the hand sideways. |
| `CTRL_Avatar_Hand{Index,Middle,Ring,Pinky}{1,2,3}.*` | Y | **local Z = curl**. Local X swings the finger **sideways** in the plane of the palm, on every joint. |
| `CTRL_Avatar_HandThumb1.*` | Y | local X swings the whole thumb across the palm. The sign differs per side. |
| `CTRL_Avatar_HandThumb2/3.*` | Y | local Z = curl |

- Curling fingers on X shipped an emote whose fingers folded sideways, and the owner caught it in-world. A sign test based on "the tip gets closer to the wrist" passed on X too, because a sideways swing also shortens that distance. Detect the curl sign by the tip's displacement along the **palm normal** (`auto_sign_pm` in `{baseDir}/references/blender-emote-patterns.md`).
- A closed fist that reads well in close-ups: joints 1/2/3 at 60/70/45° (the middle joint bends most), thumb 35° across on Thumb1, and 30/45° on Thumb2/3.
- **Rotation locks are a hint, not a guard.** They constrain Blender's interactive transform tools, but a script writing `rotation_quaternion` ignores them. A 30° scripted turn about a forearm's locked Z moved the hand 14 cm. Rotate only about the axes the rig leaves free.

## RULE: Legs mirror, the upper body does not — fix the pasted upper body by flipping X and Z

Blender's **Pose ▸ Copy Pose / Paste X-Flipped** only works on half of this rig (verified on `Avatar_File.blend`; numbers in `{baseDir}/references/avatar-rig.md`):

- **Legs and feet mirror normally**, FK or IK — Paste X-Flipped is exact for IK legs and within ~3 cm for FK legs.
- **Shoulders, upper arms, forearms, hands and fingers do not** — Paste X-Flipped lands the other hand 40–70 cm away. The rig animator's fix: on every pasted upper-body control, **negate the X and Z values and keep Y**. Example: a pasted arm reading X −0.5, Z 0.1 becomes X 0.5, Z −0.1. Apply it to the rotation (quaternion or Euler) and, on the IK hand and elbow controls, to the location too. Verified exact (0.000 m) for the whole arm chain, FK and IK, all 30 finger controls included.
- `mirror_side('L')` in `{baseDir}/references/blender-emote-patterns.md` does both steps for every control at once.
- When you pose a **single** joint rather than mirroring, still detect its sign programmatically — rotate +15°, measure which way the downstream bone moved, cache (`auto_sign`). For fingers, compare a bend each way along the palm normal instead (`auto_sign_pm`). The same angle on `.L` and `.R` is not symmetric for the elbow, the wrist tilt, Thumb1 and thigh-out, whose signs flip between sides; the curls, wrist flex, shoulder, thigh-forward, knee and foot keep theirs (sign table in `{baseDir}/references/avatar-rig.md`).

## RULE: FK or IK — lose contact → FK, keep contact → IK

Legs default to **IK**, arms to **FK** (`FK > IK *` properties on `CTRL_Avatar_UpperBody`). Switch only when the pose needs it, using one rule: **if a hand or foot has to keep contact** with the floor, a seat, a wall or a prop, it should be **IK**; **if it loses contact**, it should be **FK**.

- FK legs: jumps, rolls, flying, handstands, swimming, legs dangling off a ledge or a theatre seat.
- IK hands: push-ups, climbing, leaning on a table, both hands fixed on one prop.
- Do **not** flip modes during walk cycles, dances or anywhere contact is lost only briefly — the defaults handle those, and every switch pops unless the two chains match exactly at that frame.
- Key the `FK > IK` property itself when you change it, not just the bones.

**Seated poses.** Lower the body with `CTRL_Avatar_UpperBody` — it is the centre of gravity and moves the **whole** body. `CTRL_Avatar_Hips` moves only pelvis + legs and stretches the torso — wrong tool for sitting. Then decide per leg:

| Feet | Legs |
| --- | --- |
| Both feet on the ground (chair, bench) | Stay **IK**: move `CTRL_IK_Foot.*` to where the feet will rest, then drop the COG — the knees bend on their own, feet stay planted (verified: toes stay at Z = 0 through a 0.4 m drop). Aim the knees with `CTRL_Avatar_Knee.*`. |
| One leg crossed over the other | Only the lifted leg to **FK**; the grounded one stays IK. |
| Feet off the ground (pond edge, theatre seat, high stool) | Both legs **FK**. |

```python
setprop('CTRL_Avatar_UpperBody', 'FK > IK Leg L', 0.0)   # only for a leg that leaves the ground
setprop('CTRL_Avatar_UpperBody', 'FK > IK Leg R', 0.0)
# ...then pose CTRL_FK_Avatar_UpLeg / _Leg / _Foot / _ToeBase on that side
```

Whatever the mode, check the feet: world Z of `Avatar_LeftToeBase` / `Avatar_RightToeBase` must stay **≥ 0** or the avatar sinks through the floor.

## RULE: Touching something (face, prop, other hand) — arm IK, solve the fingertip, measured landmarks

FK angles cannot land a finger on a target reliably. Switch that arm to IK (`FK > IK Arm L/R` = 1), place `CTRL_IK_Avatar_Hand.*` in world space, then iterate the **fingertip** (`Avatar_*HandIndex4`, a deform bone) onto the target by shifting the hand control by the remaining error — the hand control is at the wrist, so aiming *it* puts the wrist on the target. The `Avatar_Head` bone starts **mid-face**, not at the skull base: the nose tip is 0.19 m in front of and 0.06 m below it, the chin 0.12 m below, so build face targets from the measured offsets in the head's *current* rotation (`{baseDir}/references/avatar-rig.md` → "Face geometry"; `ik_hand` / `solve_tip` / `nose_world` in `{baseDir}/references/blender-emote-patterns.md`).

Key the FK arm to roughly the same pose as the IK target on the keyframes where `FK > IK Arm` switches: the property is interpolated between keys, so an FK arm left hanging at the side swings through the chest while the blend runs.

## RULE: Verify with numbers as well as renders

Renders catch composition; numbers catch clipping. Print world positions of hands, head, feet and any prop reference at **every** keyframe:

- Keep hands **≥ ~0.3 m** from the head centre when a limb passes the head. A throw over the shoulder clipped straight through the skull until the arm was routed outward first. Deliberate face contact (see the RULE on touching) is the exception: check the fingertip lands on its target, and keep the rest of the hand and the forearm outside the head.
- Keep hands **≥ ~0.10 m** apart rather than overlapping at the centre line.
- Keep the **face visible** in any default/holding pose — hold objects at upper-chest height with the head tilted down, not in front of the face.

Render four angles per keyframe (front three-quarter, straight front, side, top) with Workbench and tile them into one contact sheet. Iterate in a cheap **pose-only stage** first (seconds per run), and only then do the full build with exports.

**Hands need their own check.** Body-scale renders did not reveal fingers folding sideways. Whenever a clip poses the fingers:

- Render the hands in close-up: only `ShapeB_Hands_BaseMesh` visible, with the camera placed from the hand's own frame (back, palm, thumb side, along the fingers).
- Decompose each fingertip's offset from its knuckle into forward / palm-normal / sideways. A curl keeps **sideways ≈ 0** and the palm component positive. Several cm sideways with palm ≤ 0 means the wrong axis.

Both scripts are in `{baseDir}/references/blender-emote-patterns.md` → "Hand and finger check". When you render a test pose, clear the action after `frame_set(0)` (`arm.animation_data.action = None`) or the render re-applies `Starting_Pose` and every variant looks the same (see "Key everything" above).

## RULE: Stay inside the animation area

Measured on the reference objects in `Avatar_File.blend` (world metres, Blender Z-up):

| Reference object | Extent | Meaning |
| --- | --- | --- |
| `Animation_Area_Reference` | 4 × 4 × 4 m box — X, Y ∈ [−2, 2], Z ∈ [0, 4] | **Everything** stays inside for the whole clip: every body part, prop and particle. Nothing moves more than 4 m in any direction. |
| `Root_Animation_Area` | 2 m diameter cylinder on the origin | The avatar **root / centre of gravity** (`CTRL_Avatar_UpperBody`, i.e. `Avatar_Hips`) travels at most **1 m** forward, back, left or right — 2 m across. Vertically it may rise as far as the box allows (the docs say 4 m; the cylinder mesh in the file is 3 m tall). |
| `Ground_Reference` | plane at Z = 0 | Nothing below it. |

Within that budget a clip **may carry root translation** — the whole body walking forward, slumping sideways or sinking through the floor — and the Explorer plays that translation back on an `AvatarShape` NPC as well as on the player. It is the only way to move an NPC while a full-body emote plays, since a `Transform`/`Tween` move cancels the emote (**npcs**).

Legs, arms, head and props may leave the root cylinder — a kick or a cartwheel does — as long as they stay inside the box. Add the checks to the per-keyframe report: `|hips.x| ≤ 1`, `|hips.y| ≤ 1`, every deform bone head and tail inside the box, every toe Z ≥ 0 (`in_area()` in `{baseDir}/references/blender-emote-patterns.md`). The Decentraland Tools add-on's **Validate Emote** only *warns* when `CTRL_Avatar_UpperBody` moves more than 1 m horizontally or vertically from its first frame; it does not check the box, so the `in_area()` check is yours to run.

## RULE: Loops must close; one-shots must land where the scene resumes

- **Looping** clip: make the first and last keyframes **identical** (e.g. frame 1 and frame 121 for a 4 s loop) or the loop pops.
- **One-shot** clip: start *and* end in the resting pose the scene returns to — for a seated game, the seated holding pose; otherwise `Starting_Pose`.

## RULE: Export one clip per file, armature only

Delete every other object first — meshes, `WGT_*` widgets, reference planes, `Armature_Prop`, cameras, lights — and remove the `Starting_Pose` action, or the exporter emits two clips. `export_animation_mode='ACTIVE_ACTIONS'` is what guarantees exactly one animation per file. Full export call in `{baseDir}/references/blender-emote-patterns.md`.

**Exception — emotes with props:** a clip that carries a prop or bone particles keeps `Armature_Prop` and its meshes and exports two clips (`*_Avatar` + `*_Prop`) with `NLA_TRACKS`. See `{baseDir}/references/emote-props.md`.

Save an editable `.blend` (meshes included) **before** stripping, so the user can tweak the actions by hand afterwards.

## RULE: Verify the exported GLB before handing it over

Parse the GLB's JSON chunk and assert: **1 animation, 0 meshes, 63 nodes** (`Armature` + 62 deform bones), **1 skin**, **62 channels each** for translation/rotation/scale, and `duration == (last_frame − first_frame) / 30`. Verifier script in `{baseDir}/references/blender-emote-patterns.md`. A duration mismatch means the scene FPS wasn't 30.

If the clip poses the fingers, also run the fingertip decomposition on the **exported** GLB: re-import it, assign the avatar clip, and measure. Blender's glTF importer leaves each clip on a **muted** NLA track with no active action. Measured without assigning it, the skeleton sits in its T-pose rest, so the check passes on the wrong pose.

Typical size for a 1–4 s clip at `export_frame_step=1` is **70–110 KB** — far under the 3 MB cap, so there is normally no reason to raise the sampling step.

## Upper-body (masked) animations

A masked emote is not a different file format — the **same** `.glb` is played with `mask: AvatarMask.AM_UPPER_BODY` at trigger time (API and enum details: **player-avatar** → "Emote masks"). What changes is what you should *author*.

**Which bones the mask keeps** — verified against the Explorer's `UpperBodyAvatarMask.mask` asset:

- **Animated:** `Avatar_Spine`, `_Spine1`, `_Spine2`, both shoulders/arms/forearms/hands, **all 40 finger bones**, `Avatar_Neck`, `Avatar_Head`.
- **Ignored:** `Avatar_Hips` and both legs (`UpLeg`/`Leg`/`Foot`/`ToeBase`) — these keep whatever the locomotion state or another emote is doing that frame.

Mechanically the renderer samples your clip each `LateUpdate`, then **restores the non-masked bones' local position and rotation** from the pose the Animator had already produced (`MaskedLegacyEmoteBlender`). So:

- **Hip/root motion in a masked clip has no effect.** `Avatar_Hips` is outside the mask, so the drop you authored with `CTRL_Avatar_UpperBody` to sit the avatar down is discarded; the legs show the locomotion state (idle, walk, run).
- **A masked clip does NOT layer over another emote.** Verified in the Explorer's `SceneMaskedEmoteSystem`: starting a masked emote on the local player stops any full-body emote that is playing, and starting a full-body emote cancels the masked one. So a masked clip cannot run on top of a chair's sitting emote — the avatar stands up. It layers only over locomotion, which is what the mask is for: carrying, holding or cheering while the player walks, runs or idles.
- **For a seated player, check `sittingChair1`/`sittingGround1` first** — they loop and hold the pose for free (see the embedded-emote note at the top of this skill). If you do author one, **have the owner look at the arms and hands before it ships**: observed 2026-10-12, the IK-feet + lowered-`UpperBody` recipe below produced a correct seat with awkward arms, which only a human eye caught.
- **For a seated player, play the clip full body.** Author a seated lower body into every clip (hips lowered, FK legs bent), trigger it unmasked, and have the scene replay the sitting emote (`triggerEmote({ predefinedEmote: 'sittingChair1' })` or the chair's own) when the clip ends and no looping seated clip takes over. A one-shot that returns to the same seated pose as your looping idle clip chains into it without a pop; the only visible pop is the height difference against the built-in sitting emote, which you tune with the hip drop.
- **Author the full body anyway, even for masked use.** A plausible lower body makes the same file usable unmasked. The mask is a trigger-time decision, not a property of the file.
- **Masked emotes on the local player emit no `AvatarEmoteCommand` lifecycle events** (documented in **player-avatar**). The scene must therefore time them itself — store each clip's duration alongside its path in scene config, since you know it exactly from the frame count.

Design notes for a seated holding pose that reads well: hips ≈ 0.6 m, hands at chest height, head tilted toward the hands.

> The bone list and blending mechanism above were read from the Explorer source (`MaskedLegacyEmoteBlender`, `SceneMaskedEmoteSystem`, `CharacterEmoteSystem` on `main`, 2026-09); the "masked stops full-body" rule was confirmed in-world on a seated player. For the **enum values and call signatures**, trust **player-avatar**, which is verified against the shipped protocol.

## Props and particles

A clip can carry an animated prop or bone-driven particles (`Armature_Prop` + a `*_Prop` clip of the same length, exported together with the avatar clip via NLA tracks). Other players see the prop with the animation. `triggerSceneEmote` plays no sound: Builder emotes ship audio as a separate file, and scene emotes never fetch one. Layout, limits, making a prop follow the body, particles as bones, the export call and gotchas: `{baseDir}/references/emote-props.md`.

## File requirements

| Requirement | Value | Source |
| --- | --- | --- |
| Frame rate | **30 fps** (Blender defaults to 24) | docs |
| Max length | **10 s / 300 frames** | docs |
| Format | `.glb` | docs |
| Max file size | **3 MB** | docs |
| Sampling rate | `1` by default; `2` or `3` to shrink | docs |
| Animation clips per file | **exactly 1** (Emotes 2.0 may add 1 prop clip; sequences unsupported) | docs |
| File contents | deforming skeleton + animation **only** — no mesh, no control bones, no cameras/lights (except a prop: `Armature_Prop` + its meshes, see `references/emote-props.md`) | docs |
| Start / end pose | both from the idle (`Starting_Pose`) | docs |
| Deform-bone keys | location + rotation + scale on the **first and last** frame, every bone | docs |
| Animation area | root ≤ **1 m** in each horizontal direction (2 m across); **every mesh part and prop** inside the **4 × 4 × 4 m** `Animation_Area_Reference` box (see RULE above) | docs + measured |
| **Filename** | must end **`_emote.glb`** (case-insensitive) | **player-avatar** |
| Scene permission | `ALLOW_TO_TRIGGER_AVATAR_EMOTE` in `scene.json` `requiredPermissions` | **player-avatar** |

Conventional location in the scene: `assets/animations/`. The glTF animation's *name* is irrelevant to the runtime — the file path is the identifier.

Blender's glTF exporter UI equivalents, if the user is exporting by hand: **Include > Limit to > Visible Objects**, **Data > Armature > Export Deformation Bones Only**, **Animation > Sampling Animations**.

The Decentraland Tools add-on's **Validate Emote** operator checks most of this (30 fps, ≤ 300 frames, exactly one armature action, first/last-frame keys on deform channels) before it will export, and warns — without blocking — when the COG moves more than 1 m horizontally or vertically. It does not check the 4 m bounding box.

## Testing in the scene

The fastest harness is a row of clickable primitive cubes — `MeshRenderer` + `MeshCollider` + `pointerEventsSystem.onPointerDown` with a generous `maxDistance` so they stay clickable from a chair — one per clip, plus a **Stop** cube and a **mask toggle** cube:

```typescript
pointerEventsSystem.onPointerDown(
	{ entity: cube, opts: { button: InputAction.IA_POINTER, hoverText: label, maxDistance } },
	() => void triggerSceneEmote({ src, loop: false, mask: upperBody ? AvatarMask.AM_UPPER_BODY : undefined })
)
```

Gate the whole harness behind a config flag and remove it before publishing.

**The Explorer MCP's `trigger_emote` only plays URN/base emotes, not scene files** — it cannot test a `_emote.glb`. Use in-scene triggers (see **unity-explorer-mcp** for driving the client around them).

## Cross-references

- **player-avatar** — `triggerSceneEmote` / `stopEmote` / `AvatarEmoteCommand` / `AvatarMask`, the `_emote.glb` rule, the permission, and freezing the player with `InputModifier` during a full-body emote.
- **add-3d-models** → `references/blender-authoring.md` — how to drive Blender at all (headless CLI vs MCP), plus general model export rules.
- **animations-tweens** — animations baked into props and models, and procedural `Tween` motion.
- **npcs** — animating `AvatarShape` NPCs and GLB NPCs.
- **smart-wearables** — emotes played by a smart wearable, the main use of props: the only effects other players see.
- Official docs: [props and sounds](https://docs.decentraland.org/creator/wearables-and-emotes/emotes/props-and-sounds/) · [particles in emotes](https://docs.decentraland.org/creator/wearables-and-emotes/emotes/particles-in-emotes/) · [creating emotes](https://docs.decentraland.org/creator/wearables-and-emotes/emotes/creating-emotes/) · [rig features](https://docs.decentraland.org/creator/wearables-and-emotes/emotes/rig-features/) · [avatar rig](https://docs.decentraland.org/creator/wearables-and-emotes/emotes/avatar-rig/)
