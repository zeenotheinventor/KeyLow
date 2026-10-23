"""Renders the male body with one debug colour per muscle id, plus a legend.

    blender --background --factory-startup --python render_regions.py -- --source <folder>
        [--group <name>|all] [--view front|back|side|three-quarter|three-quarter-back] [--scratch <folder>]

Without --group every data file gets its own set of renders (trunk now, shoulders_arms and legs when their files
exist). --group <name> renders one file, and --group all colours every file in one picture. The ids of the group are in
colour and every other face is grey. The body is smooth shaded under soft light, so
the form reads, and the colours are the palette below. Without --view the front, the three-quarter, the back and the
back three-quarter are rendered. Files go to renders/regions/male-<group>-<view>.png. The assignment is made fresh on
every run (assign_regions.run), so the picture always matches the data files.
"""

import math
import os
import sys

import bpy
import mathutils

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import assign_regions  # noqa: E402
import common  # noqa: E402
import regions  # noqa: E402
import render_bases  # noqa: E402

OUTPUT_FOLDER = os.path.join(common.TOOL_FOLDER, "renders", "regions")
VIEW_YAW_DEGREES = {"front": 0, "three-quarter": 35, "side": 90, "three-quarter-back": 145, "back": 180}
DEFAULT_VIEWS = ["front", "three-quarter", "back", "three-quarter-back"]
LEGEND_WIDTH = 260
CANVAS_BACKGROUND = (0.9, 0.9, 0.9)

# Fixed and high contrast, in the order of MUSCLE_IDS. Grey is kept for faces outside the group.
PALETTE = {
    "chest_upper": "#e6194b",
    "chest_lower": "#f58231",
    "delt_front": "#ffe119",
    "delt_side": "#bfef45",
    "delt_rear": "#3cb44b",
    "lats": "#4363d8",
    "traps_upper": "#42d4f4",
    "traps_mid": "#911eb4",
    "lower_back": "#f032e6",
    "biceps": "#800000",
    "triceps": "#9a6324",
    "forearms": "#808000",
    "abs": "#000075",
    "obliques": "#469990",
    "glute_max": "#fabed4",
    "glute_med": "#dcbeff",
    "quads": "#aaffc3",
    "hamstrings": "#ffd8b1",
    "adductors": "#fffac8",
    "calves": "#00a86b",
    "tibialis": "#b8860b",
    "neck": "#20b2aa",
}
GREY = "#b4b4b4"


def srgb_triple(hex_colour):
    return tuple(int(hex_colour[index : index + 2], 16) / 255 for index in (1, 3, 5))


def to_linear(channel):
    return channel / 12.92 if channel <= 0.04045 else ((channel + 0.055) / 1.055) ** 2.4


def linear_colour(hex_colour):
    return (*(to_linear(channel) for channel in srgb_triple(hex_colour)), 1.0)


def make_material(name, attribute_name=None, hex_colour=GREY):
    """A matte material in the palette colour. With an attribute name it reads the colour from that attribute of each
    face."""
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    shader = material.node_tree.nodes["Principled BSDF"]
    shader.inputs["Roughness"].default_value = 0.85
    shader.inputs["Specular IOR Level"].default_value = 0.15
    if attribute_name:
        attribute = material.node_tree.nodes.new("ShaderNodeAttribute")
        attribute.attribute_name = attribute_name
        material.node_tree.links.new(attribute.outputs["Color"], shader.inputs["Base Color"])
    else:
        shader.inputs["Base Color"].default_value = linear_colour(hex_colour)
    return material


def colour_faces(obj, ids, shown_ids):
    colours = obj.data.color_attributes.get("region_colour")
    if colours is None:
        colours = obj.data.color_attributes.new("region_colour", "FLOAT_COLOR", "FACE")
    values = []
    for muscle_id in ids:
        values.extend(linear_colour(PALETTE[muscle_id] if muscle_id in shown_ids else GREY))
    colours.data.foreach_set("color", values)


def add_legend(strips, labels):
    """One coloured box per id, down the right-hand side of the canvas."""
    canvas_width = render_bases.RENDER_WIDTH + LEGEND_WIDTH
    x = (render_bases.RENDER_WIDTH + 24) / canvas_width
    step = 54 / render_bases.RENDER_HEIGHT
    y = 1 - 60 / render_bases.RENDER_HEIGHT
    for index, (text, hex_colour) in enumerate(labels):
        red, green, blue = srgb_triple(hex_colour)
        label = render_bases.add_label(strips, text, x, y - index * step, 28, 3 + index)
        label.anchor_x = "LEFT"
        label.color = (0, 0, 0, 1) if 0.299 * red + 0.587 * green + 0.114 * blue > 0.5 else (1, 1, 1, 1)
        label.use_box = True
        label.box_color = (red, green, blue, 1)
        label.box_margin = 0.012


def compose(picture_path, labels, path):
    """The 3D render on the left, the legend on the right, in one PNG."""
    canvas_width = render_bases.RENDER_WIDTH + LEGEND_WIDTH
    scene = bpy.data.scenes.new("regions sheet")
    render_bases.turn_off_stamps(scene)
    scene.render.engine = render_bases.pick_engine()
    scene.render.resolution_x = canvas_width
    scene.render.resolution_y = render_bases.RENDER_HEIGHT
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.image_settings.compression = 100
    scene.render.dither_intensity = 0
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.frame_start = scene.frame_end = 1
    scene.render.use_sequencer = True
    strips = render_bases.sequencer_strips(scene)

    background = strips.new_effect("background", "COLOR", 1, 1, length=1)
    background.color = CANVAS_BACKGROUND
    picture = strips.new_image("body", picture_path, 2, 1)
    picture.transform.offset_x = (render_bases.RENDER_WIDTH - canvas_width) / 2
    add_legend(strips, labels)
    render_bases.render_still(scene, path)


def render_view(scene, pivot, view, labels, scratch, group_name):
    pivot.rotation_euler = (0, 0, math.radians(VIEW_YAW_DEGREES[view]))
    picture_path = os.path.join(scratch, f"male-{group_name}-{view}-body.png")
    render_bases.render_still(scene, picture_path)
    path = os.path.join(OUTPUT_FOLDER, f"male-{group_name}-{view}.png")
    compose(picture_path, labels, path)
    size = os.path.getsize(path)
    print(f"Rendered {path} ({size / 1024:.0f} KB)")
    if size > render_bases.MAXIMUM_BYTES:
        raise SystemExit(f"{path} is over 300 KB, which the repository does not allow.")


def main():
    arguments = common.script_arguments()
    group_name = assign_regions.argument_value(arguments, "--group", "")
    view_name = assign_regions.argument_value(arguments, "--view", "all")
    views = DEFAULT_VIEWS if view_name == "all" else [view_name]
    if any(view not in VIEW_YAW_DEGREES for view in views):
        raise SystemExit(f"--view is one of {', '.join(VIEW_YAW_DEGREES)}.")

    body, obj, groups, ids = assign_regions.run(arguments)
    available = {group.name: group for group in groups}
    if group_name not in ("", "all") and group_name not in available:
        raise SystemExit(f"--group is one of {', '.join(sorted(available))} or all.")
    if group_name == "":
        pictures = [(group.name, [group]) for group in groups]
    elif group_name == "all":
        pictures = [("all", groups)]
    else:
        pictures = [(group_name, [available[group_name]])]

    scratch = assign_regions.scratch_folder(arguments)
    os.makedirs(OUTPUT_FOLDER, exist_ok=True)

    scene = render_bases.make_scene("regions")
    scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.8
    obj.data.materials.clear()
    obj.data.materials.append(make_material("regions", attribute_name="region_colour"))
    scene.collection.objects.link(obj)
    # The eyes hang off the bundle's own body, which stays in the scene for their placement but is not drawn.
    scene.collection.objects.link(body)
    body.hide_render = True
    grey_material = make_material("grey")
    for eye in (child for child in body.children if child.type == "MESH"):
        scene.collection.objects.link(eye)
        eye.data.materials.clear()
        eye.data.materials.append(grey_material)
        eye.data.shade_smooth()
    bpy.context.window.scene = scene
    bpy.context.view_layer.update()

    corners = [obj.matrix_world @ mathutils.Vector(corner) for corner in obj.bound_box]
    bottom = min(corner.z for corner in corners)
    centre_x = (min(corner.x for corner in corners) + max(corner.x for corner in corners)) / 2
    centre_y = (min(corner.y for corner in corners) + max(corner.y for corner in corners)) / 2
    pivot = render_bases.add_camera_rig(
        scene,
        (centre_x, centre_y, bottom - render_bases.FLOOR_MARGIN_METRES + render_bases.FRAME_HEIGHT_METRES / 2),
    )

    for light in (child for child in pivot.children if child.type == "LIGHT"):
        light.data.energy *= 0.7
    for picture_name, shown_groups in pictures:
        shown_ids = [region.id for group in shown_groups for region in group.regions]
        colour_faces(obj, ids, shown_ids)
        labels = [(f" {muscle_id:<13}", PALETTE[muscle_id]) for muscle_id in shown_ids]
        labels.append((f" {'other':<13}", GREY))
        for view in views:
            render_view(scene, pivot, view, labels, scratch, picture_name)


if __name__ == "__main__":
    main()
