# Blender MCP `bpy` patterns for Decentraland models

Snippets for `execute_blender_code`. All of them assume Blender 3.x/4.x Python (`bpy`).

## Start clean (delete default cube, light, camera)

```python
import bpy
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()
for block_list in (bpy.data.meshes, bpy.data.lights, bpy.data.cameras, bpy.data.materials):
    for block in list(block_list):
        if block.users == 0:
            block_list.remove(block)
```

## Import a scene GLB

```python
import bpy
bpy.ops.import_scene.gltf(filepath='/abs/path/to/scene/assets/Models/myModel.glb')
```

## Count triangles (evaluated mesh — includes modifiers)

Run before every export. This is the number the engine will actually render.

```python
import bpy
depsgraph = bpy.context.evaluated_depsgraph_get()
total = 0
per_object = {}
for obj in bpy.context.scene.objects:
    if obj.type != 'MESH':
        continue
    mesh = obj.evaluated_get(depsgraph).to_mesh()
    mesh.calc_loop_triangles()
    per_object[obj.name] = len(mesh.loop_triangles)
    total += len(mesh.loop_triangles)
    obj.evaluated_get(depsgraph).to_mesh_clear()
print(per_object)
print('TOTAL TRIANGLES:', total)
```

## Audit materials (PBR check + who counts against the limit)

Flags non-Principled setups and lists collider meshes that still carry materials.

```python
import bpy
for mat in bpy.data.materials:
    if not mat.users:
        continue
    if not mat.use_nodes:
        print('NOT PBR (no nodes):', mat.name)
        continue
    out = next((n for n in mat.node_tree.nodes if n.type == 'OUTPUT_MATERIAL' and n.is_active_output), None)
    surf = out.inputs['Surface'].links[0].from_node if out and out.inputs['Surface'].links else None
    if not surf or surf.type != 'BSDF_PRINCIPLED':
        print('NOT PBR (surface is %s):' % (surf.type if surf else 'unlinked'), mat.name)
for obj in bpy.context.scene.objects:
    if obj.type == 'MESH' and obj.name.endswith('_collider') and obj.data.materials:
        print('COLLIDER WITH MATERIALS:', obj.name)
unique = {m for o in bpy.context.scene.objects if o.type == 'MESH' for m in o.data.materials if m}
print('unique materials in scene:', len(unique))
```

## Palette texture for plain colors (one material for N colors)

Builds a 64×64 image holding a grid of flat color swatches, packed into the .blend so it embeds in the GLB, plus one material using it.

```python
import bpy

COLORS = [  # RGBA, linear — extend up to grid*grid entries
    (0.80, 0.20, 0.20, 1.0),
    (0.20, 0.55, 0.90, 1.0),
    (0.95, 0.80, 0.25, 1.0),
    (0.25, 0.70, 0.30, 1.0),
]
GRID = 2      # 2x2 swatches; use 4 (16 colors) or 8 (64 colors) as needed
SIZE = 64     # power-of-two, tiny is fine for flat colors

img = bpy.data.images.new('palette', width=SIZE, height=SIZE, alpha=False)
cell = SIZE // GRID
pixels = [0.0] * (SIZE * SIZE * 4)
for i in range(GRID * GRID):
    color = COLORS[i] if i < len(COLORS) else (0.5, 0.5, 0.5, 1.0)  # spare swatches
    cx, cy = (i % GRID) * cell, (i // GRID) * cell
    for y in range(cy, cy + cell):
        for x in range(cx, cx + cell):
            idx = (y * SIZE + x) * 4
            pixels[idx:idx + 4] = color
img.pixels = pixels
img.pack()  # required — an unpacked generated image exports as empty

mat = bpy.data.materials.new('palette')
mat.use_nodes = True
bsdf = mat.node_tree.nodes['Principled BSDF']
tex = mat.node_tree.nodes.new('ShaderNodeTexImage')
tex.image = img
tex.interpolation = 'Closest'  # hard swatch edges — no bleeding between colors
mat.node_tree.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
```

### Assign faces to a swatch

Collapses each face's UVs to the center of the chosen swatch. Works face-by-face, so one mesh can use many colors with the single palette material.

```python
import bpy, bmesh

def assign_faces_to_swatch(obj, face_indices, swatch, grid=2):
    """Map the given faces of obj to palette cell `swatch` (0-based, row-major from bottom-left)."""
    u = ((swatch % grid) + 0.5) / grid
    v = ((swatch // grid) + 0.5) / grid
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    uv_layer = bm.loops.layers.uv.verify()
    bm.faces.ensure_lookup_table()
    for fi in face_indices:
        for loop in bm.faces[fi].loops:
            loop[uv_layer].uv = (u, v)
    bm.to_mesh(obj.data)
    bm.free()

# Example: whole object one color
obj = bpy.data.objects['Crate']
obj.data.materials.clear()
obj.data.materials.append(bpy.data.materials['palette'])
assign_faces_to_swatch(obj, range(len(obj.data.polygons)), swatch=0, grid=2)
```

## Create a box collider for a mesh

Axis-aligned bounding box collider, correctly named, no materials.

```python
import bpy
from mathutils import Vector

src = bpy.data.objects['Crate']
world_corners = [src.matrix_world @ Vector(c) for c in src.bound_box]
lo = Vector((min(c[i] for c in world_corners) for i in range(3)))
hi = Vector((max(c[i] for c in world_corners) for i in range(3)))

bpy.ops.mesh.primitive_cube_add(location=(lo + hi) / 2)
col = bpy.context.active_object
col.scale = (hi - lo) / 2
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
col.name = src.name + '_collider'
col.data.name = col.name
col.data.materials.clear()
```

For non-boxy shapes, duplicate the source object, add a heavy Decimate modifier (or replace with a convex hull via `bmesh.ops.convex_hull`), apply it, then rename and clear materials the same way.

## Set origin to bottom-center

So `Transform.position.y = 0` grounds the model in the scene.

```python
import bpy
from mathutils import Vector

obj = bpy.data.objects['Crate']
corners = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
bottom_center = Vector((
    sum(c.x for c in corners) / 8,
    sum(c.y for c in corners) / 8,
    min(c.z for c in corners),   # Blender is Z-up; exporter converts to Y-up
))
bpy.context.scene.cursor.location = bottom_center
bpy.context.view_layer.objects.active = obj
obj.select_set(True)
bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
obj.location = (0, 0, 0)
```

## Export back into the scene

```python
import bpy
bpy.ops.export_scene.gltf(
    filepath='/abs/path/to/scene/assets/Models/myModel.glb',
    export_format='GLB',
    use_selection=False,                     # True to export only selected objects
    export_yup=True,                         # Decentraland is Y-up (this is the default)
    export_apply=True,                       # bake modifiers into the mesh
    export_cameras=False,
    export_lights=False,
    export_animation_mode='ACTIVE_ACTIONS',  # only if animated — default mode leaks every action in the .blend
)
```

The scene preview hot-reloads the file on write. If the model's bounding box or pivot changed, re-audit the entity's `Transform` per the model-swap rule in **add-3d-models**.

## Conversion traps (FBX/OBJ → GLB)

Verified traps when converting downloaded assets through Blender:

- **FBX transparency quirk**: FBX materials can import with Principled Alpha = 0 — the exported GLB gets `alphaMode: MASK` with baseColor alpha 0 and the model is invisible in the engine while logs look healthy. Force Alpha = 1 and `mat.blend_method = 'OPAQUE'` before export.
- **Animation leaking**: the exporter's default animation mode exports every action in the .blend that fits an armature — clips from other imported models leak into each GLB. Use `export_animation_mode='ACTIVE_ACTIONS'` with the right action active.
- **ASCII FBX**: some asset kits ship ASCII FBX, which Blender refuses to import — check with `file *.fbx` and fall back to the kit's OBJ files.
