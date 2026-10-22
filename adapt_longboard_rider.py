import bpy
from mathutils import Vector

OUT = '/Users/A200255476/Documents/ChatGPT/lofisurf'
GLB = OUT + '/public/assets/ohto-longboard-rider.glb'

# Let the adaptation script be safely rerun from Blender's console.
for obj in list(bpy.data.objects):
    if obj.name.startswith('Backpack |') or any(collection.name == 'UNAPPLIED' for collection in obj.users_collection):
        bpy.data.objects.remove(obj, do_unlink=True)

# Keep the character meshes that are enabled in the authored view layer; the source
# file also contains a reference image, a light, and an unapplied duplicate.
view_layer_names = {obj.name for obj in bpy.context.view_layer.objects if obj is not None}
for obj in list(bpy.data.objects):
    keep = obj.type == 'MESH' and obj.name in view_layer_names
    if keep:
        points = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
        keep = all(max(abs(p[i]) for p in points) < 4.0 for i in range(3))
        keep = keep and min(p.z for p in points) > -1.0 and max(p.z for p in points) < 3.5
    if not keep:
        bpy.data.objects.remove(obj, do_unlink=True)

# The authored toon nodes are not glTF compatible. Convert each material to a
# Principled shader using the original emission color as its intended flat color.
for material in bpy.data.materials:
    color = tuple(material.diffuse_color)
    if material.use_nodes and material.node_tree:
        emissions = [node for node in material.node_tree.nodes if node.type == 'EMISSION']
        if emissions:
            color = tuple(emissions[-1].inputs['Color'].default_value)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    nodes.clear()
    output = nodes.new('ShaderNodeOutputMaterial')
    principled = nodes.new('ShaderNodeBsdfPrincipled')
    principled.inputs['Base Color'].default_value = color
    principled.inputs['Roughness'].default_value = 0.72
    material.node_tree.links.new(principled.outputs['BSDF'], output.inputs['Surface'])
    material.diffuse_color = color

def make_mat(name, rgba, roughness=0.82):
    material = bpy.data.materials.new(name)
    material.diffuse_color = rgba
    material.use_nodes = True
    shader = material.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = rgba
    shader.inputs['Roughness'].default_value = roughness
    return material

pack = make_mat('Longboard rider | ochre canvas pack', (0.62, 0.34, 0.09, 1))
pack_light = make_mat('Longboard rider | golden piping', (0.84, 0.56, 0.20, 1))
pack_dark = make_mat('Longboard rider | leather straps', (0.23, 0.15, 0.075, 1))
zipper = make_mat('Longboard rider | brass hardware', (0.60, 0.42, 0.14, 1), 0.38)

def box(name, location, dimensions, material, bevel=0.035):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    if bevel:
        modifier = obj.modifiers.new('Rounded canvas seams', 'BEVEL')
        modifier.width = bevel
        modifier.segments = 3
        obj.modifiers.new('Soft weighted normals', 'WEIGHTED_NORMAL')
    return obj

# In this Blender file the character faces -Y, so +Y is her back.
box('Backpack | rounded body', (0, 0.365, 1.46), (0.62, 0.29, 0.72), pack, 0.11)
box('Backpack | upper flap', (0, 0.535, 1.72), (0.55, 0.075, 0.20), pack_light, 0.05)
box('Backpack | main pocket', (0, 0.535, 1.43), (0.48, 0.08, 0.31), pack, 0.045)
box('Backpack | pocket flap', (0, 0.585, 1.57), (0.44, 0.025, 0.085), pack_light, 0.025)
for side in (-1, 1):
    box('Backpack | side pocket', (side * 0.32, 0.38, 1.42), (0.09, 0.21, 0.23), pack_light, 0.035)
    box('Backpack | shoulder strap', (side * 0.22, -0.205, 1.45), (0.075, 0.075, 0.70), pack_dark, 0.03)
    box('Backpack | strap tab', (side * 0.22, -0.22, 1.18), (0.09, 0.035, 0.11), pack_light, 0.02)
box('Backpack | center buckle', (0, 0.607, 1.57), (0.055, 0.018, 0.06), zipper, 0.01)
for height in (1.30, 1.56):
    box('Backpack | stitched piping', (0, 0.59, height), (0.37, 0.014, 0.014), pack_dark, 0.004)

# Save the Blender source in the normal modeling workspace with the character framed.
layout = bpy.data.workspaces.get('Layout')
if layout:
    bpy.context.window.workspace = layout
    for area in bpy.context.screen.areas:
        if area.type == 'VIEW_3D':
            area.spaces.active.region_3d.view_location = (0, 0, 1.2)
            area.spaces.active.region_3d.view_distance = 4.2
bpy.ops.object.select_all(action='DESELECT')
bpy.ops.wm.save_as_mainfile(filepath=OUT + '/ohto_longboard_rider.blend')

# Export the selected visible character meshes as a compact, self-contained glTF.
for obj in bpy.context.scene.objects:
    if obj.type == 'MESH' and obj.name in bpy.context.view_layer.objects:
        obj.select_set(True)
bpy.context.view_layer.objects.active = bpy.context.selected_objects[0]
bpy.ops.export_scene.gltf(filepath=GLB, export_format='GLB', use_selection=True,
                          export_apply=True, export_materials='EXPORT',
                          export_cameras=False, export_lights=False)
