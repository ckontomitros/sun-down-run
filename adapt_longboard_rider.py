import bpy
from mathutils import Euler, Vector

OUT = '/Users/A200255476/Documents/ChatGPT/lofisurf'
GLB = OUT + '/public/assets/ohto-longboard-rider.glb'

# Let the adaptation script be safely rerun from Blender's console.
for obj in list(bpy.data.objects):
    if obj.name.startswith('Backpack |') or any(collection.name == 'UNAPLLIED' for collection in obj.users_collection):
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

# The mesh has disconnected leg islands. Rotate the right leg gently at its hip
# and shift its shoe back, giving the rider a front/back longboard stance.
def components(mesh):
    parent = list(range(len(mesh.vertices)))
    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i
    for edge in mesh.edges:
        a, b = find(edge.vertices[0]), find(edge.vertices[1])
        if a != b:
            parent[b] = a
    groups = {}
    for vertex in mesh.vertices:
        groups.setdefault(find(vertex.index), []).append(vertex.index)
    return list(groups.values())

body = bpy.data.objects.get('full body')
if body:
    for indices in components(body.data):
        verts = [body.data.vertices[i] for i in indices]
        center_x = sum(v.co.x for v in verts) / len(verts)
        max_z = max(v.co.z for v in verts)
        min_z = min(v.co.z for v in verts)
        if center_x > 0.04 and min_z < 0.12 and max_z < 1.1:
            pivot = Vector((center_x, 0.0, max_z))
            rotation = Euler((0.42, 0, 0), 'XYZ').to_quaternion()
            for vertex in verts:
                offset = vertex.co - pivot
                offset.rotate(rotation)
                vertex.co = pivot + offset
    body.data.update()

# The shoe mesh is split into islands for sole, upper, and laces; move them together.
shoe = bpy.data.objects.get('shoes')
if shoe:
    for vertex in shoe.data.vertices:
        if vertex.co.x > 0.08:
            vertex.co.y += 0.42
    shoe.data.update()

# The side shorts panel follows the shifted leg enough to keep the hem connected.
short_panel = bpy.data.objects.get('trouser')
if short_panel:
    for vertex in short_panel.data.vertices:
        if vertex.co.x > 0:
            vertex.co.y += 0.14
    short_panel.data.update()

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
