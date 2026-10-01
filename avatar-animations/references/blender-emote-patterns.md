# `bpy` patterns for authoring Decentraland avatar emotes

Blender 5.x on the official `Avatar_File.blend`. For the rig's bone/property names see `{baseDir}/references/avatar-rig.md`. For how to *drive* Blender at all (headless CLI vs Blender MCP, binary paths, the never-fall-back-silently rule), see `{baseDir}/../add-3d-models/references/blender-authoring.md`.

Run headless like this:

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background \
  /path/to/Avatar_File.blend --python build_emotes.py -- all
```

## Helper module (`dclrig.py`)

Import this from your build script. It handles the three things that bite every time: slotted actions, resetting to the *idle* pose rather than identity, and rotating about world axes.

```python
"""Helpers for authoring Decentraland emotes on Avatar_File.blend (Blender 5.x)."""
import bpy, math
from mathutils import Vector, Quaternion

arm   = bpy.data.objects['Armature']
vl    = bpy.context.view_layer
scene = bpy.context.scene
BASE  = {}

# Custom props that must be captured, restored and keyed along with the bones.
PROPS = {
    'CTRL_Avatar_UpperBody': ['FK > IK Arm L', 'FK > IK Arm R',
                              'FK > IK Leg L', 'FK > IK Leg R',
                              'IsoRot Arm  FK L', 'IsoRot Arm  FK R'],
    'CTRL_Avatar_Head': ['Inherit Rotation'],
}

def capture_base():
    """Store every pose bone's basis transform + custom props, with Starting_Pose evaluated."""
    scene.frame_set(0)                      # evaluates the Starting_Pose action
    for pb in arm.pose.bones:
        BASE[pb.name] = (pb.location.copy(), pb.rotation_quaternion.copy(),
                         pb.rotation_euler.copy(), pb.scale.copy(),
                         {k: pb[k] for k in PROPS.get(pb.name, [])})

def reset_all():
    """Return every bone to the IDLE pose (not identity) — the baseline every keyframe builds on."""
    for pb in arm.pose.bones:
        loc, rq, re, sc, props = BASE[pb.name]
        pb.location = loc; pb.rotation_quaternion = rq
        pb.rotation_euler = re; pb.scale = sc
        for k, v in props.items():
            pb[k] = v
    vl.update()

def wpos(n):  return arm.matrix_world @ arm.pose.bones[n].head
def wtail(n): return arm.matrix_world @ arm.pose.bones[n].tail

def rl(n, axis, deg):
    """Rotate control bone `n` about one of its OWN local axes ('X'/'Y'/'Z' or a vector)."""
    if isinstance(axis, str):
        axis = {'X': (1, 0, 0), 'Y': (0, 1, 0), 'Z': (0, 0, 1)}[axis]
    pb = arm.pose.bones[n]
    q = Quaternion(axis, math.radians(deg))
    if pb.rotation_mode == 'QUATERNION':
        pb.rotation_quaternion = pb.rotation_quaternion @ q
    else:
        pb.rotation_euler = (pb.rotation_euler.to_quaternion() @ q).to_euler(pb.rotation_mode)

def rw(n, axis, deg):
    """Rotate control bone `n` about a WORLD axis (Z up, avatar faces -Y, avatar's left is +X)."""
    if isinstance(axis, str):
        axis = {'X': (1, 0, 0), 'Y': (0, 1, 0), 'Z': (0, 0, 1)}[axis]
    vl.update()
    pb = arm.pose.bones[n]
    M = (arm.matrix_world @ pb.matrix).to_3x3().normalized()
    rl(n, M.inverted() @ Vector(axis), deg)   # world axis -> this bone's local frame

def move(n, dx=0, dy=0, dz=0):
    """Translate control bone `n` by world METRES (dx: avatar left, dy: back, dz: up)."""
    vl.update()
    pb = arm.pose.bones[n]
    M = (arm.matrix_world @ pb.matrix).to_3x3().normalized()
    pb.location += (M.inverted() @ Vector((dx, dy, dz))) * 100.0   # armature scale is 0.01

def setprop(n, key, value):
    arm.pose.bones[n][key] = value

def key_all(frame, deform=False):
    """Key every control bone (and its custom props); pass deform=True on the first/last frame."""
    vl.update()
    for pb in arm.pose.bones:
        if not pb.name.startswith('CTRL_') and not (deform and pb.bone.use_deform):
            continue
        pb.keyframe_insert('location', frame=frame)
        pb.keyframe_insert('rotation_quaternion' if pb.rotation_mode == 'QUATERNION'
                           else 'rotation_euler', frame=frame)
        pb.keyframe_insert('scale', frame=frame)
        for k in PROPS.get(pb.name, []):
            pb.keyframe_insert('["%s"]' % k, frame=frame)

def new_action(name):
    """Blender 4.4+/5 slotted actions. `Action.fcurves` no longer exists — curves live in
    act.layers[0].strips[0].channelbags[...]."""
    act = bpy.data.actions.new(name)
    slot = act.slots.new('OBJECT', 'Avatar_Animation')
    if arm.animation_data is None:
        arm.animation_data_create()
    arm.animation_data.action = act
    arm.animation_data.action_slot = slot
    act.use_fake_user = True
    return act
```

## Sign detection — never assume the rig is mirrored

Rotate a control by a small test angle, measure which way a downstream bone actually moved, and cache the sign. Cheaper and more reliable than eyeballing renders for every joint.

```python
def auto_sign(bone, axis, metric, prep=None):
    """+1 if a positive rotation about `axis` increases `metric`, else -1."""
    reset_all()
    if prep: prep()                      # e.g. switch legs to FK first
    vl.update(); before = metric()
    rl(bone, axis, 15)
    vl.update(); after = metric()
    reset_all()
    return 1 if after > before else -1

S = {}
for s, full in (('L', 'Left'), ('R', 'Right')):
    # elbow flexion: does the hand move forward (-Y in world) ?
    S['elbow' + s] = auto_sign('CTRL_FK_Avatar_ForeArm.' + s, 'X',
                               lambda: -wpos('Avatar_%sHand' % full).y)
    # finger curl: does the fingertip get closer to the palm ?
    S['curl' + s]  = auto_sign('CTRL_Avatar_HandIndex1.' + s, 'X',
                               lambda: -(wpos('Avatar_%sHandIndex4' % full)
                                         - wpos('Avatar_%sHand' % full)).length)

def elbow(s, deg): rl('CTRL_FK_Avatar_ForeArm.' + s, 'X', S['elbow' + s] * deg)
```

Elbows, knees, wrists and fingers hinge on their **local X** (Y/Z are locked on those controls). Upper arms must be driven from **world** axes with `rw()` — see the RULE in the skill doc.

## Semantic pose vocabulary + a parametric default pose

Build named verbs on top of `rl`/`rw`/`move`, then express every keyframe as a diff from one default pose. Keyframe lists stay readable and a tweak to the base pose propagates everywhere.

```python
def arm_fwd(s, d):  rw('CTRL_FK_Avatar_Arm.' + s, 'X', -d)                # pure forward raise
def arm_out(s, d):  rw('CTRL_FK_Avatar_Arm.' + s, 'Z', d if s == 'L' else -d)
def head_down(d):   rl('CTRL_Avatar_Head', 'X', S['headdown'] * d)
def fk_legs():
    setprop('CTRL_Avatar_UpperBody', 'FK > IK Leg L', 0.0)
    setprop('CTRL_Avatar_UpperBody', 'FK > IK Leg R', 0.0)

DEFAULTS = dict(hips_dz=-0.35, thigh=82, knee=78, foot=-4, spine=5, head=22,
                L_fwd=38, L_elbow=100, R_fwd=36, R_elbow=96)   # seated, hands at chest

def pose(**kw):
    p = dict(DEFAULTS); p.update(kw)
    reset_all(); fk_legs()
    move('CTRL_Avatar_UpperBody', dz=p['hips_dz'])
    for s in 'LR':
        arm_fwd(s, p[s + '_fwd']); elbow(s, p[s + '_elbow'])
    head_down(p['head'])
    vl.update()

CLIP = [(1, {}), (12, dict(R_fwd=84, R_elbow=26, head=28)), (36, {})]   # ends where it started
act = new_action('PickUpCard')
last = CLIP[-1][0]
for frame, kw in CLIP:
    pose(**kw)
    key_all(frame, deform=(frame == 1 or frame == last))
```

## Numeric verification of a pose

Renders catch composition problems; numbers catch clipping. Print world positions at every keyframe.

```python
def report(tag):
    vl.update()
    r3 = lambda v: [round(x, 3) for x in v]
    print('POSE', tag,
          'head', r3(wpos('Avatar_Head')), 'handL', r3(wpos('Avatar_LeftHand')),
          'handR', r3(wpos('Avatar_RightHand')), 'toeL', r3(wpos('Avatar_LeftToeBase')))
    # assertions worth making:
    #   toe world z >= 0                                  (feet above the floor)
    #   |hand - head| >= 0.3                              (limb not passing through the skull)
    #   |handL - handR| >= 0.10                           (hands not interpenetrating)
```

## Render to verify (Workbench, four angles)

```python
def setup_render():
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.render.resolution_x = scene.render.resolution_y = 480
    scene.render.image_settings.file_format = 'PNG'
    scene.display.shading.light = 'STUDIO'
    scene.display.shading.color_type = 'SINGLE'
    scene.display.shading.single_color = (0.8, 0.7, 0.6)
    for o in bpy.data.objects:                       # hide reference geometry
        if o.name.startswith('ShapeB') or o.name in ('Animation_Area_Reference',
                                                     'Root_Animation_Area'):
            o.hide_render = True
    cam = bpy.data.objects.new('AuthorCam', bpy.data.cameras.new('AuthorCam'))
    scene.collection.objects.link(cam); scene.camera = cam
    return cam

def aim(cam, loc, target):
    cam.location = loc
    cam.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()

def render(path, frame=None):
    if frame is not None:
        scene.frame_set(frame)                       # re-evaluates the action — see the RULE
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)

VIEWS = {'front':   ((1.7, -2.3, 1.45), (0, -0.25, 0.85)),   # front three-quarter
         'frontal': ((0,  -2.6, 1.30),  (0, -0.20, 1.05)),
         'side':    ((2.9, -0.3, 1.15), (0, -0.25, 0.85)),
         'top':     ((0,  -0.35, 3.4),  (0, -0.30, 1.00))}
```

## Contact sheet without PIL

System Python often has no Pillow. Blender ships numpy and its own image API, so tile inside Blender. **Blender image rows run bottom-up** — hence the `rows - 1 - ...`.

```python
# Blender --background --python sheet.py -- out.png shot1.png shot2.png ...
import bpy, sys, numpy as np
argv  = sys.argv[sys.argv.index('--') + 1:]
out, files = argv[0], argv[1:]
cols  = min(4, len(files)); rows = (len(files) + cols - 1) // cols; tile = 400
canvas = np.ones((rows * tile, cols * tile, 4), dtype=np.float32)
for i, f in enumerate(files):
    img = bpy.data.images.load(f)
    img.scale(tile, tile)
    px = np.array(img.pixels[:], dtype=np.float32).reshape(tile, tile, 4)
    r, c = rows - 1 - (i // cols), i % cols
    canvas[r * tile:(r + 1) * tile, c * tile:(c + 1) * tile] = px
res = bpy.data.images.new('sheet', cols * tile, rows * tile, alpha=True)
res.pixels = canvas.ravel().tolist()
res.filepath_raw = out; res.file_format = 'PNG'; res.save()
```

## Export — one clip per file

Strip the file down to the armature, drop `Starting_Pose`, then export each action on its own.

```python
import os

# 1. Strip: meshes, widgets, reference planes, Armature_Prop, cameras and lights must all go.
if bpy.data.actions.get('Starting_Pose'):
    bpy.data.actions.remove(bpy.data.actions['Starting_Pose'])
for o in list(bpy.data.objects):
    if o.name != 'Armature':
        bpy.data.objects.remove(o, do_unlink=True)

def export_clip(act, last_frame, path, step=1):
    arm.animation_data.action = act
    arm.animation_data.action_slot = act.slots[0]
    scene.frame_start = 1; scene.frame_end = last_frame; scene.frame_set(1)
    for o in scene.objects:
        o.select_set(o == arm)
    vl.objects.active = arm
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format='GLB',
        use_selection=True,
        export_def_bones=True,           # deformation bones only — no CTRL_ bones in the file
        export_force_sampling=True,      # bake constraints/IK down to plain bone keys
        export_frame_step=step,          # 1 by default; 2 or 3 to shrink the file
        export_frame_range=True,
        export_animation_mode='ACTIVE_ACTIONS',   # exactly ONE clip per file
        export_animations=True,
        export_anim_slide_to_zero=True,
        export_apply=False,
        export_materials='NONE',
        export_cameras=False,
        export_lights=False,
        export_yup=True,
    )
    print('EXPORTED', path, os.path.getsize(path))

export_clip(act, last, os.path.join(OUT_DIR, 'pick_up_card_emote.glb'))
```

Older Blender builds reject some keywords. Wrap in `try/except TypeError` and retry after dropping `export_anim_slide_to_zero`, `export_materials`, `export_animation_mode`.

## Verify the exported GLB (plain Python, no Blender)

Parse the GLB's JSON chunk and assert the invariants. Run this on every file before handing it to a scene.

```python
# python3 verify_emote_glb.py assets/animations/*.glb
import json, struct, sys, collections

def gltf_json(path):
    with open(path, 'rb') as f:
        magic, _version, total = struct.unpack('<III', f.read(12))
        assert magic == 0x46546C67, 'not a GLB'
        while f.tell() < total:
            length, ctype = struct.unpack('<II', f.read(8))
            data = f.read(length)
            if ctype == 0x4E4F534A:              # 'JSON'
                return json.loads(data)
    raise ValueError('no JSON chunk')

for path in sys.argv[1:]:
    g = gltf_json(path)
    anims = g.get('animations', [])
    paths = collections.Counter(c['target']['path'] for a in anims for c in a['channels'])
    duration = max((g['accessors'][s['input']]['max'][0]
                    for s in anims[0]['samplers']), default=0.0) if anims else 0.0
    print(f"{path}: animations={len(anims)} meshes={len(g.get('meshes', []))} "
          f"nodes={len(g.get('nodes', []))} skins={len(g.get('skins', []))} "
          f"channels={dict(paths)} duration={duration:.3f}s")
    assert len(anims) == 1,                 'must contain exactly one animation'
    assert len(g.get('meshes', [])) == 0,   'mesh leaked into the export'
    assert len(g.get('nodes', [])) == 63,   'expected Armature + 62 deform bones'
    assert paths['translation'] == paths['rotation'] == paths['scale'] == 62, \
        'every deform bone needs T/R/S channels'
    assert duration <= 10.0,                'max 10 s'
    assert path.lower().endswith('_emote.glb'), 'runtime requires the _emote.glb suffix'
```

Reference output from seven shipped clips (Blender 5.1.1, `export_frame_step=1`):

```
hold_cards_emote.glb:    animations=1 meshes=0 nodes=63 skins=1 channels={'translation': 62, 'rotation': 62, 'scale': 62} duration=4.000s   77 KB
play_power_card_emote.glb: animations=1 meshes=0 nodes=63 skins=1 channels={'translation': 62, 'rotation': 62, 'scale': 62} duration=2.467s   92 KB
pick_up_card_emote.glb:  animations=1 meshes=0 nodes=63 skins=1 channels={'translation': 62, 'rotation': 62, 'scale': 62} duration=1.167s   74 KB
```

`duration` must equal `(last_frame - first_frame) / 30`. A mismatch means the scene FPS was not 30 or the frame range was wrong.

## Two-stage build loop

A full build renders every keyframe of every clip and exports — slow. Add a `pose` stage that only poses, reports and renders a handful of representative key poses (seconds, not minutes), and iterate there until the numbers and contact sheets look right.

```python
STAGE = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else 'all'
if STAGE == 'pose':
    act = new_action('PoseTest')
    for i, (tag, kw) in enumerate(KEY_POSES):
        pose(**kw); report(tag); key_all(i + 1, deform=(i == 0))
        for v in ('frontal', 'top', 'side'):
            aim(cam, *VIEWS[v]); render('%s/pose_%s_%s.png' % (SHOTS, tag, v), i + 1)
    sys.exit(0)
```

Also save an editable `.blend` (meshes included) at the end of a full build so the user can open and tweak the actions by hand: `bpy.ops.wm.save_as_mainfile(filepath='my_emotes.blend')`. Do this **before** the strip-and-export step.
