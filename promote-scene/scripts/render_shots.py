# Hero renders of a Decentraland scene's own GLBs for its marketing kit (headless Blender, Cycles).
# Copy to <scene>/promote/tools/render_shots.py, then rewrite the SHOTS section for this scene.
#
#   B=/Applications/Blender.app/Contents/MacOS/Blender
#   $B -b -P promote/tools/render_shots.py -- preview [shot ...]   # 480 px, 12 samples -> promote/images/preview/
#   $B -b -P promote/tools/render_shots.py -- final   [shot ...]   # 1600 px, 128 samples -> promote/images/renders/
#   $B -b -P promote/tools/render_shots.py -- keyart preview       # same at 1/4 size, 12 samples -> promote/images/preview/
#   $B -b -P promote/tools/render_shots.py -- keyart               # KEYART_SHOT at KEYART_SIZES -> promote/images/keyart/
#   $B -b -P promote/tools/render_shots.py -- clip preview shot    # 640x360 EEVEE camera move -> promote/images/preview/<shot>_clip.mp4
#   $B -b -P promote/tools/render_shots.py -- clip shot [shot ...] # 1920x1080 EEVEE, CLIP_SECONDS long -> promote/clips/<shot>.mp4
#
# Always run the preview modes first and look at every PNG before the final pass.
# Clips are only made on request, for a post video (see the skill's references/video-posts.md): the same
# shot, 16:9, with a slow camera move (CLIP_MOVE / CLIP_MOVES) rendered in EEVEE at CLIP_FPS. Nothing in
# the scene animates: no avatars, no runtime effects. A 6 s 1080p clip took about 2 minutes on Apple Silicon.
# Finals take 1-3 min each (whole-interior scenes are at the slow end): render them one or two shots
# per command, or in the background, so a shell timeout does not kill the batch half-way.
import bpy, math, sys, os, time
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # scene root
P = os.path.join(ROOT, 'promote')

# ------------------------------------------------------------------ per-scene settings (edit)
MODELS = os.path.join(ROOT, 'assets', 'Models')   # relative GLB paths in load() resolve here
KEYART_SHOT = 'hero'                              # the shot re-rendered for key art (no text in it)
KEYART_SIZES = [(1920, 1080), (1080, 1080)]       # expanded kit: add (1080, 1350), (1080, 1920)
MONO = '/System/Library/Fonts/Supplemental/Courier New Bold.ttf'   # for in-scene 3D text (signs, boards)
CLIP_SECONDS = 6                                  # length of every -- clip
CLIP_FPS = 30                                     # matches the Remotion project in promote/video/
CLIP_SAMPLES = 16                                 # EEVEE TAA samples per frame; 48 looked no better and cost 3x
CLIP_MOVE = dict(dolly=-0.10, orbit=4.0, rise=0.0)   # default move: push in 10 % of dist, orbit 4 deg, no rise
CLIP_MOVES = {}                                   # per-shot overrides, e.g. {'hero': dict(orbit=12, dolly=0)}

# ------------------------------------------------------------------ mode
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
MODE = argv[0] if argv else 'preview'
DRAFT = MODE == 'preview' or (MODE in ('keyart', 'clip') and 'preview' in argv[1:])
ONLY = [KEYART_SHOT] if MODE == 'keyart' else [a for a in argv[1:] if a != 'preview']
OUT = os.path.join(P, 'images', 'preview') + '/' if DRAFT else (
    os.path.join(P, 'clips') + '/' if MODE == 'clip' else os.path.join(P, 'images', {'final': 'renders', 'keyart': 'keyart'}[MODE]) + '/')
os.makedirs(OUT, exist_ok=True)
RES = (360 if DRAFT else 1080) if MODE == 'clip' else (480 if DRAFT else 1600)
SAMPLES = 12 if DRAFT else (160 if MODE == 'keyart' else 128)
CAM = {}   # the last camera() call, so clip mode can animate it


# ------------------------------------------------------------------ helpers
def reset(aspect=1.0, exposure=-0.7):
    """Empty Cycles scene, AgX High Contrast, near-black world. aspect = width / height.
    In clip mode the engine is EEVEE and the frame is always 16:9 (the aspect argument is ignored)."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scn = bpy.context.scene
    if MODE == 'clip':
        aspect = 16 / 9
        scn.render.engine = 'BLENDER_EEVEE'
        scn.eevee.taa_render_samples = 8 if DRAFT else CLIP_SAMPLES
        scn.eevee.use_raytracing = True
        scn.eevee.use_shadows = True
        scn.eevee.shadow_pool_size = '1024'   # a whole interior with many point lights overflows the 512 MB default
        scn.render.fps = CLIP_FPS
        scn.frame_start, scn.frame_end = 1, int(CLIP_SECONDS * CLIP_FPS)
    else:
        scn.render.engine = 'CYCLES'
        scn.cycles.samples = SAMPLES
        scn.cycles.use_denoising = True
        try:  # Apple Silicon GPU; falls back to CPU silently
            prefs = bpy.context.preferences.addons['cycles'].preferences
            prefs.compute_device_type = 'METAL'
            prefs.get_devices()
            for d in prefs.devices:
                d.use = True
            scn.cycles.device = 'GPU'
        except Exception as ex:
            print('GPU setup failed, using CPU:', ex)
    scn.render.resolution_x = int(round(RES * aspect))
    scn.render.resolution_y = RES
    scn.view_settings.view_transform = 'AgX'
    scn.view_settings.look = 'AgX - High Contrast'
    scn.view_settings.exposure = exposure
    scn.render.image_settings.file_format = 'PNG'
    world = bpy.data.worlds.new('w'); scn.world = world; world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.004, 0.004, 0.008, 1)
    return scn


def haze(density=0.04, color=(0.8, 0.78, 0.7)):
    """World volume scatter: visible light shafts. 0.02 subtle, 0.06-0.07 thick."""
    wn = bpy.context.scene.world.node_tree
    vol = wn.nodes.new('ShaderNodeVolumePrincipled')
    vol.inputs['Density'].default_value = density
    vol.inputs['Anisotropy'].default_value = 0.4
    vol.inputs['Color'].default_value = (*color, 1)
    wn.links.new(vol.outputs['Volume'], wn.nodes['World Output'].inputs['Volume'])


def bbox(objs):
    pts = [o.matrix_world @ Vector(c) for o in objs if o.type == 'MESH' for c in o.bound_box]
    if not pts:
        return Vector((0, 0, 0)), Vector((0, 0, 0))
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi


def load(path, at=(0, 0, 0), rot=0, scale=1.0, align_long_x=False, anchor='bottom'):
    """Import a GLB under an empty, normalised by its world bounding box so its footprint centre sits
    at `at` (Blender coords: X right, Y away from camera at az=0, Z up). anchor='bottom' puts the
    lowest point on at[2]; 'center' centres it vertically. align_long_x turns long pieces (walls,
    benches, counters) so their long axis runs along X before `rot` (degrees, about Z) is applied."""
    if not os.path.isabs(path):
        path = os.path.join(MODELS, path)
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    root = bpy.data.objects.new(os.path.basename(path) + '_root', None)
    bpy.context.scene.collection.objects.link(root)
    for o in new:
        if o.parent is None or o.parent not in new:
            o.parent = root
    bpy.context.view_layer.update()
    lo, hi = bbox(new)
    if align_long_x and (hi.y - lo.y) > (hi.x - lo.x):
        rot += 90
    root.rotation_euler = (0, 0, math.radians(rot))
    root.scale = (scale, scale, scale)
    bpy.context.view_layer.update()
    lo, hi = bbox(new)
    c = (lo + hi) / 2
    dz = lo.z if anchor == 'bottom' else c.z
    root.location = (at[0] - c.x, at[1] - c.y, at[2] - dz)
    bpy.context.view_layer.update()
    return new


def room(floor, wall=None, ceiling=None, tile=8.0, back_y=5.0, centre_wall=None, ceiling_z=6.0):
    """A 3x3 patch of the scene's floor tiles centred on the origin (tiles at -tile/0/+tile, so no seam
    runs through the middle of the shot), a back wall at y=back_y made of three pieces, and an optional
    ceiling row. Put a doorway piece in `centre_wall`; never stack it in front of a plain wall."""
    objs = []
    for x in (-tile, 0, tile):
        for y in (-tile, 0, tile):
            objs += load(floor, (x, y, 0))
    if wall:
        for x in (-tile, tile):
            objs += load(wall, (x, back_y, 0), align_long_x=True)
        objs += load(centre_wall or wall, (0, back_y, 0), align_long_x=True)
    if ceiling:
        for x in (-tile, 0, tile):
            objs += load(ceiling, (x, 0, ceiling_z))
    return objs


def light_area(loc, energy=400, color=(1.0, 0.93, 0.78), size=(4.0, 0.6), rot=(0, 0, 0)):
    """Rectangular area light. Overhead fluorescent: loc z just under the ceiling, rot (0,0,0).
    Backlight through a doorway: behind the opening, rot=(radians(90),0,0), big size, high energy."""
    bpy.ops.object.light_add(type='AREA', location=loc, rotation=rot)
    a = bpy.context.active_object.data
    a.shape = 'RECTANGLE'; a.size = size[0]; a.size_y = size[1]; a.energy = energy; a.color = color
    return bpy.context.active_object


def light_point(loc, energy=600, color=(1, 0.1, 0.06), radius=0.8):
    bpy.ops.object.light_add(type='POINT', location=loc)
    l = bpy.context.active_object.data
    l.energy = energy; l.color = color; l.shadow_soft_size = radius
    return bpy.context.active_object


def _pose(target, az, el, dist):
    az_r, el_r = math.radians(az), math.radians(el)
    d = Vector((math.cos(el_r) * math.sin(az_r), -math.cos(el_r) * math.cos(az_r), math.sin(el_r)))
    pos = Vector(target) + d * dist
    return pos, (Vector(target) - pos).to_track_quat('-Z', 'Y').to_euler()


def camera(target, az=0, el=12, dist=6.0, lens=40, fstop=4.0, focus=None):
    """Camera looking at `target`. az=0 looks along +Y from the -Y side; positive az orbits
    counter-clockwise seen from above. el in degrees above the target. DOF focused on the target.
    Clip mode animates this camera along CLIP_MOVE from the pose given here."""
    pos, rot = _pose(target, az, el, dist)
    bpy.ops.object.camera_add(location=pos)
    cam = bpy.context.active_object
    cam.rotation_euler = rot
    cam.data.lens = lens
    cam.data.dof.use_dof = True
    cam.data.dof.focus_distance = focus or dist
    cam.data.dof.aperture_fstop = fstop
    bpy.context.scene.camera = cam
    CAM.update(obj=cam, target=Vector(target), az=az, el=el, dist=dist, focus=focus)
    return cam


def text(body, at, size=0.5, color=(1, 0.6, 0.1), emit=6.0, font=MONO, rot=(90, 0, 0), align='CENTER'):
    """Emissive 3D text, e.g. to fill a sign or departures board the scene fills at runtime."""
    bpy.ops.object.text_add(location=at, rotation=tuple(math.radians(r) for r in rot))
    t = bpy.context.active_object
    t.data.body = body; t.data.font = bpy.data.fonts.load(font); t.data.size = size
    t.data.align_x = align; t.data.align_y = 'CENTER'
    m = bpy.data.materials.new('txt'); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Emission Color'].default_value = (*color, 1)
    b.inputs['Emission Strength'].default_value = emit
    t.data.materials.append(m)
    return t


def render_clip(name):
    """Keyframe the shot's camera from its pose to pose + CLIP_MOVE and render CLIP_SECONDS of H.264."""
    scn = bpy.context.scene
    cam, mv = CAM['obj'], {**CLIP_MOVE, **CLIP_MOVES.get(name, {})}
    n = scn.frame_end
    for frame, k in ((1, 0.0), (n, 1.0)):
        dist = CAM['dist'] * (1 + mv['dolly'] * k)
        pos, rot = _pose(CAM['target'], CAM['az'] + mv['orbit'] * k, CAM['el'] + mv['rise'] * k, dist)
        cam.location, cam.rotation_euler = pos, rot
        cam.data.dof.focus_distance = (CAM['focus'] or CAM['dist']) * dist / CAM['dist']
        cam.keyframe_insert('location', frame=frame)
        cam.keyframe_insert('rotation_euler', frame=frame)
        cam.data.dof.keyframe_insert('focus_distance', frame=frame)
    scn.frame_set(1)
    if hasattr(scn.render.image_settings, 'media_type'):   # Blender 5+
        scn.render.image_settings.media_type = 'VIDEO'
    scn.render.image_settings.file_format = 'FFMPEG'
    scn.render.ffmpeg.format = 'MPEG4'
    scn.render.ffmpeg.codec = 'H264'
    scn.render.ffmpeg.constant_rate_factor = 'HIGH'
    scn.render.ffmpeg.gopsize = CLIP_FPS
    scn.render.use_file_extension = True
    suffix = '_clip' if DRAFT else ''
    scn.render.filepath = OUT + name + suffix + '.mp4'
    t0 = time.time()
    bpy.ops.render.render(animation=True)
    # Blender may append the frame range to a movie file name; normalise to <name>.mp4.
    made = [f for f in os.listdir(OUT) if f.startswith(name + suffix) and f.endswith('.mp4')]
    for f in made:
        if f != name + suffix + '.mp4':
            os.replace(OUT + f, OUT + name + suffix + '.mp4')
    print('RENDERED %s (%.0f s, %d frames at %dx%d)' % (OUT + name + suffix + '.mp4', time.time() - t0, n,
                                                       scn.render.resolution_x, scn.render.resolution_y))


def render(name):
    scn = bpy.context.scene
    if MODE == 'clip':
        return render_clip(name)
    if MODE == 'keyart':
        for w, h in KEYART_SIZES:
            scn.render.resolution_x, scn.render.resolution_y = (w // 4, h // 4) if DRAFT else (w, h)
            scn.render.filepath = OUT + '%s_%dx%d.png' % (name, w, h)
            t0 = time.time()
            bpy.ops.render.render(write_still=True)
            print('RENDERED %s (%.0f s)' % (scn.render.filepath, time.time() - t0))
        return
    scn.render.filepath = OUT + name + '.png'
    t0 = time.time()
    bpy.ops.render.render(write_still=True)
    print('RENDERED %s (%.0f s)' % (scn.render.filepath, time.time() - t0))


# ------------------------------------------------------------------ SHOTS (rewrite per scene)
# One function per signature moment. These two are from the Eeireport kit (airport_v2 kit pieces)
# and only illustrate the pattern: a small room from the scene's own floor/wall/ceiling pieces,
# one focal object, an overhead fluorescent, one coloured accent light, a camera on the target.

def shot_hero():
    """Key-art plate: the creature as a silhouette in a backlit doorway. No text in the frame, and
    headroom above the subject (target raised, low elevation) where the wordmark will go."""
    reset(); haze(0.06)
    room('airport_v2/floor_tiles_8m.glb', 'airport_v2/wall_8m.glb', 'airport_v2/ceiling_8m_lit_b.glb',
         back_y=5.0, centre_wall='airport_v2/wall_8m_doorway_b.glb')
    load('airport_v2/shadow_figure_e.glb', (0.5, 6.3, 0), rot=200)
    light_area((0, 10.0, 3.2), energy=4000, color=(1.0, 0.95, 0.85), size=(6, 5), rot=(math.radians(90), 0, 0))
    light_area((0, 0, 5.9), energy=90, size=(6, 0.5))
    light_point((-5, 1, 2.5), energy=200, color=(0.2, 1.0, 0.3), radius=1.5)
    camera((0.3, 5.2, 2.6), az=-10, el=3, dist=9.0, lens=30, fstop=2.8)
    render('hero')


def shot_security():
    """A gameplay space: the checkpoint the player has to get through."""
    reset(); haze(0.02)
    room('airport_v2/floor_tiles_8m.glb', 'airport_v2/wall_8m.glb', 'airport_v2/ceiling_8m_lit_b.glb', back_y=5.0)
    load('airport_v2/customs_booth_b.glb', (2.2, 2.6, 0))
    load('airport_v2/security_arch.glb', (-1.6, 1.2, 0))
    load('airport_v2/xray_belt.glb', (-4.4, 1.4, 0), align_long_x=True)
    for x in (-4.5, -2.5, -0.5, 1.5):
        load('airport_v2/queue_barrier_2m.glb', (x, -2.2, 0), align_long_x=True)
    light_area((0, 0, 5.9), energy=520, size=(7, 0.6))
    light_point((-1.6, 1.2, 3.0), energy=400, color=(1, 0.08, 0.05), radius=0.5)
    camera((-1.0, 1.6, 1.3), az=-18, el=13, dist=10.0, lens=35, fstop=4)
    render('security')


SHOTS = {
    'hero': shot_hero,
    'security': shot_security,
}

for name, fn in SHOTS.items():
    if ONLY and name not in ONLY:
        continue
    print('=== shot', name)
    fn()
