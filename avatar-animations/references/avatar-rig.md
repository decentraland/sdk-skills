# Decentraland avatar rig cheat-sheet (Rig 1.0)

Everything below was measured directly in `Avatar_File.blend` with Blender 5.1 (headless probe, 2026-09-25) unless marked otherwise. Docs: [rig features](https://docs.decentraland.org/creator/wearables-and-emotes/emotes/rig-features/), [avatar rig](https://docs.decentraland.org/creator/wearables-and-emotes/emotes/avatar-rig/).

## Getting the rig

- Direct download: `https://raw.githubusercontent.com/decentraland/docs/main/creator/images/emotes/Avatar_File.blend`
- Also bundled with the **Decentraland Tools** Blender add-on (https://extensions.blender.org/add-ons/decentraland-tools/, source https://github.com/decentraland/dcl-blender-toolkit). Installed copy lives at `<addon>/assets/Avatar_File.blend`; the add-on's **Emotes** panel offers *Import DCL Rig*, *Validate Emote*, *Export Emote GLB*.

Never author an emote on a rig you built yourself — the deform bone names and hierarchy must match the avatar exactly.

## Scene / object facts

| Fact | Value |
| --- | --- |
| Armature object name | `Armature` |
| Armature object rotation | X = +90° (`1.5708` rad) |
| Armature object scale | `0.01` uniform |
| Scene FPS in the shipped file | **24** — you must set it to **30** |
| Actions in the file | `Starting_Pose` only (single key at frame 0) |

**Never change the armature object's transform.** Because the object scale is `0.01`, pose-bone local units are **centimetres**: to translate a control by 1 m of world space, add `100` to `pose_bone.location` (after converting the world vector into the bone's local frame).

**World axes** (Blender, Z-up): avatar's **left = +X**, avatar faces **−Y**, **up = +Z**. glTF export with `export_yup=True` converts to the Y-up frame Decentraland expects.

## Objects in the file (delete all but `Armature` before export)

`Animation_Area_Reference`, `Root_Animation_Area`, `Ground_Reference`, `Knee`, `Armature_Prop`, the `ShapeA_*` / `ShapeB_*` base meshes and masks (8 each), and ~24 `WGT_*` control-widget meshes.

`Animation_Area_Reference` is the volume the avatar mesh must stay inside for the whole clip.

## Bone collections

Animate in **Pose mode** only, and only bones from the first six collections:

`Global/Switch` · `FK Upper` · `FK Lower` · `IK Upper` · `IK Lower` · `Fingers` · `Deformation Bones` · `DON'T TOUCH (head rotation)` · `DON'T TOUCH (shoulder rotation)` · `DON'T TOUCH (IK Setup)`

Never edit the rig in **Object mode**, never pose or edit the `Avatar_*` deform bones directly, and never touch the `DON'T TOUCH *` collections — the docs warn that editing the deform bones breaks the rig.

## Deform bones — 62, exported verbatim

```
Avatar_Hips
  Avatar_LeftUpLeg / Avatar_LeftLeg / Avatar_LeftFoot / Avatar_LeftToeBase
  Avatar_RightUpLeg / Avatar_RightLeg / Avatar_RightFoot / Avatar_RightToeBase
  Avatar_Spine / Avatar_Spine1 / Avatar_Spine2
    Avatar_LeftShoulder / Avatar_LeftArm / Avatar_LeftForeArm / Avatar_LeftHand
      Avatar_LeftHand{Thumb,Index,Middle,Ring,Pinky}{1,2,3,4}     (20 bones)
    Avatar_RightShoulder / Avatar_RightArm / Avatar_RightForeArm / Avatar_RightHand
      Avatar_RightHand{Thumb,Index,Middle,Ring,Pinky}{1,2,3,4}    (20 bones)
    Avatar_Neck / Avatar_Head
```

A correctly exported emote GLB therefore has **63 nodes** (`Armature` + 62 bones), **1 skin**, **0 meshes**, and **62 channels per animated path**.

## Control bones — 68, all prefixed `CTRL_`

| Group | Bones | Notes |
| --- | --- | --- |
| Root / COG | `CTRL_Avatar_Root`, `CTRL_Avatar_UpperBody`, `CTRL_Avatar_Hips` | `CTRL_Avatar_UpperBody` is the centre of gravity — moving it lowers the **whole** body. `CTRL_Avatar_Hips` moves only pelvis + legs and stretches the torso. |
| Spine | `CTRL_FK_Avatar_Spine`, `_Spine1`, `_Spine2` | Distribute a lean across all three rather than bending one hard. |
| Head / neck | `CTRL_Avatar_Neck`, `CTRL_Avatar_Head` | |
| Shoulders | `CTRL_Avatar_Shoulder.L` / `.R` | Shrug / clavicle lift. |
| Arms FK | `CTRL_FK_Avatar_Arm`, `_ForeArm`, `_Hand` (`.L`/`.R`) | Default for arms (`FK > IK Arm *` = 0). |
| Arms IK | `CTRL_IK_Avatar_Hand`, `CTRL_IK_Avatar_Elbow` (`.L`/`.R`) | Needs `FK > IK Arm L/R` = 1. |
| Legs FK | `CTRL_FK_Avatar_UpLeg`, `_Leg`, `_Foot`, `_ToeBase` (`.L`/`.R`) | Needs `FK > IK Leg L/R` = 0. |
| Legs IK | `CTRL_IK_Foot`, `CTRL_IK_Foot_Roll`, `CTRL_IK_Foot_ToeTip`, `CTRL_IK_Avatar_ToeBase`, `CTRL_Avatar_Knee` (`.L`/`.R`) | Reverse-IK foot setup; default for legs (`FK > IK Leg *` = 1). |
| Fingers | `CTRL_Avatar_Hand{Thumb,Index,Middle,Ring,Pinky}{1,2,3}.{L,R}` | 30 bones; no `4` control — the tip bone is deform-only. |

## Custom properties (measured defaults)

On **`CTRL_Avatar_UpperBody`** — note the **double space** in the `IsoRot` keys:

| Property key (literal) | Default | Meaning |
| --- | --- | --- |
| `"FK > IK Arm L"` | `0.0` | 0 = FK, 1 = IK |
| `"FK > IK Arm R"` | `0.0` | 0 = FK, 1 = IK |
| `"FK > IK Leg L"` | `1.0` | legs default to **IK** |
| `"FK > IK Leg R"` | `1.0` | legs default to **IK** |
| `"IsoRot Arm  FK L"` | `1.0` | arm rotation isolated from the torso |
| `"IsoRot Arm  FK R"` | `1.0` | arm rotation isolated from the torso |

On **`CTRL_Avatar_Head`**:

| Property key | Default | Meaning |
| --- | --- | --- |
| `"Inherit Rotation"` | `0.0` | 0 = head keeps world orientation when the torso leans; raise it (or rotate the head yourself) to make the head follow the spine |

Keyframe every property you change: `pb.keyframe_insert('["FK > IK Leg L"]', frame=f)`. The docs describe these attributes as "FK/IK Blend", "Isolate Rotation FK Blend" and "Isolate Rotation"; the strings above are the literal keys in the file.

## Rest / idle measurements (world metres, `Starting_Pose` at frame 0)

| Landmark | World position |
| --- | --- |
| `Avatar_Hips` | `(0.000, 0.005, 0.985)` |
| `Avatar_Head` | `(0.000, 0.029, 1.718)` |
| `Avatar_LeftHand` | `(0.286, −0.024, 0.912)` |

The **rest pose** of the armature is an A/T-pose. The **idle** the runtime blends from is the `Starting_Pose` action (arms down). Always start and end your clip from `Starting_Pose` values, not from the identity/rest transform.

## The rig is NOT mirrored

The docs state plainly that mirroring behaviour on shoulders, arms, hands and fingers is not possible. The same rotation applied to `.L` and `.R` controls does **not** produce a symmetric pose — the sign, and sometimes the axis, differ per side. Detect signs programmatically (see `{baseDir}/references/blender-emote-patterns.md` → "Sign detection") or verify in a render. Never assume symmetry.
