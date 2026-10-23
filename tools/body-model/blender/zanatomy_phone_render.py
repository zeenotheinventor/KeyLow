"""Renders dist/male.glb with the spike's render settings, so the phone file can be judged against the full pictures.

    blender --background --factory-startup --disable-autoexec --python zanatomy_phone_render.py

Writes renders/muscles/male-phone-front.png and male-phone-three-quarter.png: the push-day heat colours on the dark
surface colour, the same camera, light and sample count as male-heat-front.png and male-heat-three-quarter. Only what
the file holds is drawn: its 27 meshes, its quantised positions and normals, and for the eyes its vertex colours.
"""

import os
import sys

import bpy
import mathutils

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common  # noqa: E402
import zanatomy_render as render  # noqa: E402

GLB_PATH = os.path.join(common.TOOL_FOLDER, "dist", "male.glb")
RENAMED = {"other": "muscle_other", "head": "head_face"}
VIEWS = ["front", "three-quarter"]


def import_phone_file():
    """The 27 objects of the file, named as the render expects, with their node transforms baked into the geometry."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=GLB_PATH)
    objects = {}
    for obj in set(bpy.data.objects) - before:
        if obj.type != "MESH":
            continue
        obj.data.transform(obj.matrix_world)
        obj.parent = None
        obj.matrix_basis = mathutils.Matrix.Identity(4)
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
        # Blender adds a suffix when a name is already taken (the factory scene is not empty).
        file_name = obj.name.split(".")[0] if obj.name.split(".")[0] in ("core", "skin", "eyes") else obj.name
        name = RENAMED.get(file_name, file_name if file_name in ("core", "skin", "eyes") else f"muscle_{file_name}")
        obj.name = name
        objects[name] = obj
    return objects


def vertex_colour_material(mesh):
    """The eyes as the file holds them: the white, iris and pupil come only from the vertex colours."""
    material = bpy.data.materials.new("eyes")
    material.use_nodes = True
    nodes, links = material.node_tree.nodes, material.node_tree.links
    shader = nodes["Principled BSDF"]
    shader.inputs["Roughness"].default_value = 0.25
    colour = nodes.new("ShaderNodeVertexColor")
    colour.layer_name = mesh.color_attributes[0].name
    links.new(colour.outputs["Color"], shader.inputs["Base Color"])
    return material


def main():
    objects = import_phone_file()
    print("Imported", len(objects), "meshes", sorted(objects))
    direction = render.face_direction(objects)
    heat, silhouette, surface = render.read_tokens()
    heat_colours = {muscle_id: heat[render.PUSH_DAY_HEAT_STEP.get(muscle_id, 0)] for muscle_id in render.MUSCLE_IDS}
    glow = {muscle_id: 0.12 + 0.05 * render.PUSH_DAY_HEAT_STEP.get(muscle_id, 0) for muscle_id in render.MUSCLE_IDS}
    heat_arguments = (heat_colours, silhouette, "#1e2430", render.make_skin_material("#8fa6c8", 0.04, 0.5), glow)
    objects["eyes"].data.materials.clear()
    objects["eyes"].data.materials.append(vertex_colour_material(objects["eyes"].data))
    render.WORK_FOLDER = ""
    os.makedirs(render.OUTPUT_FOLDER, exist_ok=True)
    centre_z = render.FRAME_HEIGHT_METRES / 2 - 0.07
    render.render_set(objects, "phone", VIEWS, surface, heat_arguments, None, render.FRAME_HEIGHT_METRES, centre_z, direction, render.WIDTH)  # fmt: skip


if __name__ == "__main__":
    main()
