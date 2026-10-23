"""Renders the four base bodies, front and three-quarter, and a contact sheet of the front views.

    blender --background --factory-startup --python render_bases.py -- --source <folder>

Every body gets the same plain clay material, the same three lights and the same orthographic camera at
the same scale, so the pictures show proportions and nothing else.
"""

import math
import os
import sys

import bpy
import mathutils

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common  # noqa: E402

RENDER_WIDTH = 800
RENDER_HEIGHT = 1200
FRAME_HEIGHT_METRES = 2.0
FLOOR_MARGIN_METRES = 0.05
THREE_QUARTER_YAW_DEGREES = 35
MAXIMUM_BYTES = 300 * 1024
BACKGROUND_COLOUR = (0.9, 0.9, 0.9)
CLAY_COLOUR = (0.6, 0.6, 0.58)

SHEET_ORDER = ["realistic_body_male", "realistic_body_female", "stylized_body_male", "stylized_body_female"]
SHEET_LABELS = {
    "realistic_body_male": "Realistic male",
    "realistic_body_female": "Realistic female",
    "stylized_body_male": "Stylised male",
    "stylized_body_female": "Stylised female",
}
SHEET_CELL_WIDTH = RENDER_WIDTH * 5 // 8
SHEET_CELL_HEIGHT = RENDER_HEIGHT * 5 // 8
SHEET_LABEL_BAND = 80

OUTPUT_FOLDER = os.path.join(common.TOOL_FOLDER, "renders", "bases")


def file_stem(key, view):
    style, _, sex = key.split("_")
    return f"{style}-{sex}-{view}"


def pick_engine():
    names = [item.identifier for item in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items]
    return next(name for name in names if name.startswith("BLENDER_EEVEE"))


def make_clay_material():
    material = bpy.data.materials.new("clay")
    material.use_nodes = True
    shader = material.node_tree.nodes["Principled BSDF"]
    shader.inputs["Base Color"].default_value = (*CLAY_COLOUR, 1)
    shader.inputs["Roughness"].default_value = 0.9
    shader.inputs["Specular IOR Level"].default_value = 0.1
    return material


def turn_off_stamps(scene):
    """Blender writes the .blend path, the date and the render time into the PNG as text chunks. The repository is
    public, so none of that goes in."""
    for flag in (name for name in dir(scene.render) if name.startswith("use_stamp")):
        setattr(scene.render, flag, False)


def make_scene(name):
    scene = bpy.data.scenes.new(name)
    turn_off_stamps(scene)
    scene.render.engine = pick_engine()
    scene.render.resolution_x = RENDER_WIDTH
    scene.render.resolution_y = RENDER_HEIGHT
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.image_settings.color_depth = "8"
    scene.render.image_settings.compression = 100
    scene.render.dither_intensity = 0
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.world = bpy.data.worlds.new(f"{name} world")
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes["Background"]
    background.inputs["Color"].default_value = (*BACKGROUND_COLOUR, 1)
    background.inputs["Strength"].default_value = 0.35
    return scene


def add_light(scene, pivot, name, location, energy, size):
    light_data = bpy.data.lights.new(name, "AREA")
    light_data.energy = energy
    light_data.size = size
    light = bpy.data.objects.new(name, light_data)
    scene.collection.objects.link(light)
    light.parent = pivot
    light.location = location
    constraint = light.constraints.new("TRACK_TO")
    constraint.target = pivot
    constraint.track_axis = "TRACK_NEGATIVE_Z"
    constraint.up_axis = "UP_Y"
    return light


def add_camera_rig(scene, centre):
    """A pivot at the middle of the frame. The camera and lights hang off it, so turning it turns them together."""
    pivot = bpy.data.objects.new("pivot", None)
    scene.collection.objects.link(pivot)
    pivot.location = centre

    camera_data = bpy.data.cameras.new("camera")
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = FRAME_HEIGHT_METRES
    camera_data.clip_end = 50
    camera = bpy.data.objects.new("camera", camera_data)
    scene.collection.objects.link(camera)
    camera.parent = pivot
    camera.location = (0, -10, 0)
    camera.rotation_euler = (math.radians(90), 0, 0)
    scene.camera = camera

    add_light(scene, pivot, "key", (2.5, -3.0, 2.2), 250, 2.5)
    add_light(scene, pivot, "fill", (-3.0, -2.5, 0.6), 80, 3.5)
    add_light(scene, pivot, "rim", (0.5, 3.0, 2.0), 160, 2.0)
    return pivot


def link_body(scene, body, material):
    """The body, its eyes and nothing else from the bundle's 400 objects."""
    for obj in [body, *[child for child in body.children if child.type == "MESH"]]:
        scene.collection.objects.link(obj)
        obj.data.materials.clear()
        obj.data.materials.append(material)
        obj.data.shade_smooth()


def face_direction_is_negative_y(body):
    eyes = [child for child in body.children if child.type == "MESH"]
    eye_y = sum(eye.matrix_world.translation.y for eye in eyes) / len(eyes)
    return eye_y < body.matrix_world.translation.y


def render_still(scene, path):
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True, scene=scene.name)


def render_body(key, material):
    body = bpy.data.objects[common.BODIES[key]]
    if not face_direction_is_negative_y(body):
        raise SystemExit(f"{body.name} does not face -Y, so the camera rig would shoot its back.")

    scene = make_scene(key)
    link_body(scene, body, material)
    bpy.context.window.scene = scene
    bpy.context.view_layer.update()

    corners = [body.matrix_world @ mathutils.Vector(corner) for corner in body.bound_box]
    bottom = min(corner.z for corner in corners)
    centre_x = (min(corner.x for corner in corners) + max(corner.x for corner in corners)) / 2
    centre_y = (min(corner.y for corner in corners) + max(corner.y for corner in corners)) / 2
    pivot = add_camera_rig(
        scene, (centre_x, centre_y, bottom - FLOOR_MARGIN_METRES + FRAME_HEIGHT_METRES / 2)
    )

    paths = {}
    for view, yaw in (("front", 0), ("three-quarter", THREE_QUARTER_YAW_DEGREES)):
        pivot.rotation_euler = (0, 0, math.radians(yaw))
        paths[view] = os.path.join(OUTPUT_FOLDER, file_stem(key, view) + ".png")
        render_still(scene, paths[view])
        print(f"Rendered {paths[view]}")
    return paths, round(body.dimensions.z, 2)


def sequencer_strips(scene):
    editor = scene.sequence_editor_create()
    # Blender 5 calls them strips, 4.2 calls them sequences.
    return editor.strips if hasattr(editor, "strips") else editor.sequences


def add_label(strips, text, x, y, size, channel):
    label = strips.new_effect(f"label {text}", "TEXT", channel, 1, length=1)
    label.text = text
    label.font_size = size
    label.color = (0.1, 0.1, 0.1, 1)
    label.location = (x, y)
    label.anchor_x = "CENTER"
    label.anchor_y = "CENTER"
    return label


def render_contact_sheet(front_paths, heights):
    scene = bpy.data.scenes.new("contact sheet")
    turn_off_stamps(scene)
    scene.render.engine = pick_engine()
    scene.render.resolution_x = SHEET_CELL_WIDTH * len(SHEET_ORDER)
    scene.render.resolution_y = SHEET_CELL_HEIGHT + SHEET_LABEL_BAND
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.image_settings.compression = 100
    scene.render.dither_intensity = 0
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.frame_start = scene.frame_end = 1
    scene.render.use_sequencer = True
    strips = sequencer_strips(scene)

    background = strips.new_effect("background", "COLOR", 1, 1, length=1)
    background.color = BACKGROUND_COLOUR

    width, height = scene.render.resolution_x, scene.render.resolution_y
    for index, key in enumerate(SHEET_ORDER):
        picture = strips.new_image(key, front_paths[key], 2, 1)
        picture.transform.scale_x = picture.transform.scale_y = SHEET_CELL_WIDTH / RENDER_WIDTH
        picture.transform.offset_x = (index + 0.5) * SHEET_CELL_WIDTH - width / 2
        picture.transform.offset_y = -SHEET_LABEL_BAND / 2
        centre_x = (index + 0.5) / len(SHEET_ORDER)
        add_label(strips, SHEET_LABELS[key], centre_x, 1 - 28 / height, 42, 3)
        add_label(strips, f"{heights[key]:.2f} m tall", centre_x, 1 - 62 / height, 26, 4)

    render_still(scene, os.path.join(OUTPUT_FOLDER, "bases-compare.png"))


def check_sizes():
    too_big = []
    for name in sorted(os.listdir(OUTPUT_FOLDER)):
        size = os.path.getsize(os.path.join(OUTPUT_FOLDER, name))
        print(f"{name}: {size / 1024:.0f} KB")
        if name != "bases-compare.png" and size > MAXIMUM_BYTES:
            too_big.append(name)
    if too_big:
        raise SystemExit(f"Over 300 KB, which the repository does not allow: {', '.join(too_big)}")


def main():
    common.open_bundle(common.source_folder(common.script_arguments()))
    os.makedirs(OUTPUT_FOLDER, exist_ok=True)
    material = make_clay_material()

    front_paths, heights = {}, {}
    for key in common.BODIES:
        paths, height = render_body(key, material)
        front_paths[key] = paths["front"]
        heights[key] = height

    render_contact_sheet(front_paths, heights)
    check_sizes()


main()
