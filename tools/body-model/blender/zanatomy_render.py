"""Renders the Z-Anatomy male: coloured muscles seen through a see-through skin.

    blender --background --factory-startup --disable-autoexec --python zanatomy_render.py -- --work <folder>
        [--set debug|heat|closeup|all] [--view front|back|three-quarter|three-quarter-back]

Reads zanatomy-body-head.blend (made by zanatomy_head.py from zanatomy-body.blend). Files go to renders/muscles/:
  male-debug-<view>.png, one colour per id with a legend, on a dark background;
  male-heat-front.png and male-heat-back.png, the v3 heat colours from packages/tokens for a push day;
  male-heat-torso-three-quarter.png, a close-up of the torso and head.
The head is the CC0 realistic male's, grafted at the neck, drawn nearly opaque in clay with its eyes, and no face or
head muscle is drawn. The skeleton and the deep muscles are not drawn either. The skin is a faint shell with a bright
rim, and the core under the muscles is a dark fill so the gaps between muscles read as flesh and not as holes.
"""

import math
import os
import re
import sys

import bpy
import mathutils

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common  # noqa: E402
import render_bases  # noqa: E402
import zanatomy_common as zanatomy  # noqa: E402

OUTPUT_FOLDER = os.path.join(common.TOOL_FOLDER, "renders", "muscles")
TOKENS_FOLDER = os.path.join(common.TOOL_FOLDER, "..", "..", "packages", "tokens", "src", "source")
HEAD_BLEND = "zanatomy-body-head.blend"
HEAD_CLAY = "#b3a79b"
IRIS_COLOUR = "#4a5560"
MAXIMUM_BYTES = 400 * 1024
WIDTH = 760
HEIGHT = 1160
CLOSEUP_WIDTH = 620
CLOSEUP_HEIGHT = 900
LEGEND_WIDTH = 250
FRAME_HEIGHT_METRES = 1.86
# The torso close-up is framed to include the head.
CLOSEUP_FRAME_HEIGHT_METRES = 0.95
CLOSEUP_CENTRE_Z = 1.3
VIEW_YAW_DEGREES = {"front": 0, "three-quarter": 35, "three-quarter-back": 145, "back": 180}

MUSCLE_IDS = [
    "chest_upper", "chest_lower", "delt_front", "delt_side", "delt_rear", "lats", "traps_upper", "traps_mid",
    "lower_back", "biceps", "triceps", "forearms", "abs", "obliques", "glute_max", "glute_med", "quads",
    "hamstrings", "adductors", "calves", "tibialis", "neck",
]  # fmt: skip
DEBUG_PALETTE = {
    "chest_upper": "#e6194b", "chest_lower": "#f58231", "delt_front": "#ffe119", "delt_side": "#bfef45",
    "delt_rear": "#3cb44b", "lats": "#4363d8", "traps_upper": "#42d4f4", "traps_mid": "#911eb4",
    "lower_back": "#f032e6", "biceps": "#ff9eb5", "triceps": "#b5651d", "forearms": "#c9b037",
    "abs": "#ffffff", "obliques": "#2ec4b6", "glute_max": "#d62976", "glute_med": "#b39ddb",
    "quads": "#6cf0a8", "hamstrings": "#ffb88c", "adductors": "#fff0a8", "calves": "#5aa9ff",
    "tibialis": "#ff7b00", "neck": "#20b2aa",
}  # fmt: skip
DEBUG_OTHER = "#7d8594"
DEBUG_CORE = "#3b414d"
SKIN_COLOUR = "#b9cbe6"

# A push day. Every id not named here is rested (heat step 0).
PUSH_DAY_HEAT_STEP = {
    "chest_upper": 5,
    "chest_lower": 5,
    "delt_front": 4,
    "triceps": 3,
    "delt_side": 2,
    "abs": 1,
}
HEAT_LABELS = ["rested", "ready", "warm", "hot", "very hot", "peak"]


def read_tokens():
    """The v3 body-map colours from the tokens package: the first (dark) value of each name in training.css and the
    dark surface colour in colors.css."""
    training = open(os.path.join(TOKENS_FOLDER, "training.css")).read()
    heat = [re.search(rf"--heat-{step}:(#[0-9A-Fa-f]{{6}});", training).group(1) for step in range(6)]
    silhouette = re.search(r"--body-silhouette:(#[0-9A-Fa-f]{6});", training).group(1)
    colours = open(os.path.join(TOKENS_FOLDER, "colors.css")).read()
    surface = re.search(r"--surface:(#[0-9A-Fa-f]{6});", colours).group(1)
    return heat, silhouette, surface


def srgb_triple(hex_colour):
    return tuple(int(hex_colour[index : index + 2], 16) / 255 for index in (1, 3, 5))


def to_linear(channel):
    return channel / 12.92 if channel <= 0.04045 else ((channel + 0.055) / 1.055) ** 2.4


def linear_colour(hex_colour):
    return (*(to_linear(channel) for channel in srgb_triple(hex_colour)), 1.0)


def make_muscle_material(name, hex_colour, glow=0.0):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    shader = material.node_tree.nodes["Principled BSDF"]
    shader.inputs["Base Color"].default_value = linear_colour(hex_colour)
    shader.inputs["Roughness"].default_value = 0.5
    shader.inputs["Specular IOR Level"].default_value = 0.35
    shader.inputs["Emission Color"].default_value = linear_colour(hex_colour)
    shader.inputs["Emission Strength"].default_value = glow
    return material


def height_fade(nodes, links):
    """0 below the neck and 1 above it, from the world height of the surface point."""
    position = nodes.new("ShaderNodeNewGeometry")
    split = nodes.new("ShaderNodeSeparateXYZ")
    fade = nodes.new("ShaderNodeMapRange")
    fade.inputs["From Min"].default_value = zanatomy.HEAD_BLEND_START_METRES
    fade.inputs["From Max"].default_value = zanatomy.HEAD_BLEND_END_METRES
    fade.inputs["To Min"].default_value = 0.0
    fade.inputs["To Max"].default_value = 1.0
    links.new(position.outputs["Position"], split.inputs["Vector"])
    links.new(split.outputs["Z"], fade.inputs["Value"])
    return fade.outputs["Result"]


def make_skin_material(hex_colour, floor_alpha=0.05, rim_alpha=0.55):
    """Faint when seen face on and brighter at the edge, so the outline reads and the muscles show through."""
    material = bpy.data.materials.new("skin")
    material.use_nodes = True
    material.surface_render_method = "BLENDED"
    material.use_backface_culling = True
    nodes, links = material.node_tree.nodes, material.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    mix = nodes.new("ShaderNodeMixShader")
    transparent = nodes.new("ShaderNodeBsdfTransparent")
    emission = nodes.new("ShaderNodeEmission")
    emission.inputs["Color"].default_value = linear_colour(hex_colour)
    emission.inputs["Strength"].default_value = 0.9
    weight = nodes.new("ShaderNodeLayerWeight")
    weight.inputs["Blend"].default_value = 0.35
    ramp = nodes.new("ShaderNodeMapRange")
    ramp.inputs["From Min"].default_value = 0.0
    ramp.inputs["From Max"].default_value = 1.0
    ramp.inputs["To Min"].default_value = floor_alpha
    ramp.inputs["To Max"].default_value = rim_alpha
    links.new(weight.outputs["Fresnel"], ramp.inputs["Value"])
    links.new(ramp.outputs["Result"], mix.inputs["Fac"])
    links.new(transparent.outputs["BSDF"], mix.inputs[1])
    links.new(emission.outputs["Emission"], mix.inputs[2])
    links.new(mix.outputs["Shader"], output.inputs["Surface"])
    return material


def make_face_material():
    """The grafted head: lit clay, fading to nothing at its lower edge so it dissolves into the skin of the neck."""
    material = bpy.data.materials.new("face")
    material.use_nodes = True
    material.surface_render_method = "DITHERED"
    nodes, links = material.node_tree.nodes, material.node_tree.links
    shader = nodes["Principled BSDF"]
    shader.inputs["Base Color"].default_value = linear_colour(HEAD_CLAY)
    shader.inputs["Roughness"].default_value = 0.6
    links.new(height_fade(nodes, links), shader.inputs["Alpha"])
    return material


def make_eye_material(centre):
    """White of the eye with an iris and a pupil, found from the direction (the body faces -Y) from the eye centre."""
    material = bpy.data.materials.new("eye")
    material.use_nodes = True
    nodes, links = material.node_tree.nodes, material.node_tree.links
    shader = nodes["Principled BSDF"]
    shader.inputs["Roughness"].default_value = 0.25
    position = nodes.new("ShaderNodeNewGeometry")
    offset = nodes.new("ShaderNodeVectorMath")
    offset.operation = "SUBTRACT"
    offset.inputs[1].default_value = centre
    direction = nodes.new("ShaderNodeVectorMath")
    direction.operation = "NORMALIZE"
    split = nodes.new("ShaderNodeSeparateXYZ")
    forward = nodes.new("ShaderNodeMath")
    forward.operation = "MULTIPLY"
    forward.inputs[1].default_value = -1.0
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.interpolation = "CONSTANT"
    ramp.color_ramp.elements[0].position = 0.0
    ramp.color_ramp.elements[0].color = linear_colour("#e9e6df")
    iris = ramp.color_ramp.elements.new(0.84)
    iris.color = linear_colour(IRIS_COLOUR)
    pupil = ramp.color_ramp.elements.new(0.96)
    pupil.color = linear_colour("#0b0c0e")
    links.new(position.outputs["Position"], offset.inputs[0])
    links.new(offset.outputs["Vector"], direction.inputs[0])
    links.new(direction.outputs["Vector"], split.inputs["Vector"])
    links.new(split.outputs["Y"], forward.inputs[0])
    links.new(forward.outputs["Value"], ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], shader.inputs["Base Color"])
    return material


def face_direction(scene_objects):
    """+1 when the body faces -Y (the cameras of render_bases look along +Y), -1 when it faces +Y."""
    chest = scene_objects["muscle_chest_upper"]
    back = scene_objects["muscle_lats"]

    def mean_y(obj):
        return sum(v.co.y for v in obj.data.vertices) / len(obj.data.vertices)

    return 1 if mean_y(chest) < mean_y(back) else -1


def paint(objects, ids_to_hex, other_hex, core_hex, skin_material, glow=None):
    """One material per id."""
    for muscle_id in MUSCLE_IDS:
        obj = objects[f"muscle_{muscle_id}"]
        obj.data.materials.clear()
        obj.data.materials.append(
            make_muscle_material(muscle_id, ids_to_hex[muscle_id], (glow or {}).get(muscle_id, 0.0))
        )
    # The core is lit from within as well, so the shadow of a muscle does not turn a gap between muscles black.
    for name, hex_colour, core_glow in (("muscle_other", other_hex, 0.0), ("core", core_hex, 0.5)):
        objects[name].data.materials.clear()
        objects[name].data.materials.append(make_muscle_material(name, hex_colour, core_glow))
    objects["skin"].data.materials.clear()
    objects["skin"].data.materials.append(skin_material)
    if "head_face" in objects:
        objects["head_face"].data.materials.clear()
        objects["head_face"].data.materials.append(make_face_material())
        for name in ("eye_left", "eye_right"):
            if name not in objects:
                continue
            eye = objects[name]
            corners = [eye.matrix_world @ mathutils.Vector(corner) for corner in eye.bound_box]
            centre = sum(corners, mathutils.Vector()) / 8
            eye.data.materials.clear()
            eye.data.materials.append(make_eye_material(centre))


def draw_legend(strips, labels, canvas_width, canvas_height):
    x = (WIDTH + 22) / canvas_width
    step = 46 / canvas_height
    y = 1 - 44 / canvas_height
    for index, (text, hex_colour) in enumerate(labels):
        red, green, blue = srgb_triple(hex_colour)
        label = render_bases.add_label(strips, text, x, y - index * step, 24, 3 + index)
        label.anchor_x = "LEFT"
        label.color = (0, 0, 0, 1) if 0.299 * red + 0.587 * green + 0.114 * blue > 0.5 else (1, 1, 1, 1)
        label.use_box = True
        label.box_color = (red, green, blue, 1)
        label.box_margin = 0.01


def compose_with_legend(picture_path, labels, path, background_hex, height):
    canvas_width = WIDTH + LEGEND_WIDTH
    scene = bpy.data.scenes.new("legend sheet")
    render_bases.turn_off_stamps(scene)
    scene.render.engine = render_bases.pick_engine()
    scene.render.resolution_x = canvas_width
    scene.render.resolution_y = height
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
    background.color = srgb_triple(background_hex)
    picture = strips.new_image("body", picture_path, 2, 1)
    picture.transform.offset_x = (WIDTH - canvas_width) / 2
    draw_legend(strips, labels, canvas_width, height)
    render_bases.render_still(scene, path)


def make_scene(background_hex, width, height):
    scene = render_bases.make_scene("muscles")
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    background = scene.world.node_tree.nodes["Background"]
    background.inputs["Color"].default_value = linear_colour(background_hex)
    background.inputs["Strength"].default_value = 0.6
    scene.view_settings.view_transform = "Standard"
    # More samples smooth the dithered fade of the head into the neck.
    scene.eevee.taa_render_samples = 256
    return scene


def check_size(path):
    size = os.path.getsize(path)
    print(f"Rendered {path} ({size / 1024:.0f} KB)")
    if size > MAXIMUM_BYTES:
        raise SystemExit(f"{path} is over 400 KB.")


def render_set(objects, name, views, background_hex, paint_arguments, legend, frame_height, centre_z, direction, width, height=HEIGHT):
    scene = make_scene(background_hex, width, height)
    for obj in objects.values():
        scene.collection.objects.link(obj)
        obj.hide_render = obj.name in ("muscle_deep", "muscle_head", "skeleton")
    paint(objects, *paint_arguments)
    bpy.context.window.scene = scene
    bpy.context.view_layer.update()
    pivot = render_bases.add_camera_rig(scene, (0, 0.0, centre_z))
    scene.camera.data.ortho_scale = frame_height
    for light in (child for child in pivot.children if child.type == "LIGHT"):
        light.data.energy *= 0.8
    for view in views:
        pivot.rotation_euler = (0, 0, math.radians(VIEW_YAW_DEGREES[view] + (0 if direction == 1 else 180)))
        stem = f"male-{name}" if name == "heat-torso" else f"male-{name}-{view}"
        stem = "male-heat-torso-three-quarter" if name == "heat-torso" else stem
        path = os.path.join(OUTPUT_FOLDER, stem + ".png")
        if legend:
            picture_path = os.path.join(WORK_FOLDER, stem + "-body.png")
            render_bases.render_still(scene, picture_path)
            compose_with_legend(picture_path, legend, path, background_hex, HEIGHT)
        else:
            render_bases.render_still(scene, path)
        check_size(path)
    for obj in objects.values():
        scene.collection.objects.unlink(obj)


WORK_FOLDER = ""


def main():
    global WORK_FOLDER
    arguments = zanatomy.script_arguments()
    WORK_FOLDER = zanatomy.require_work_folder(arguments)
    which = zanatomy.argument_value(arguments, "--set", "all")
    view_name = zanatomy.argument_value(arguments, "--view", "all")
    os.makedirs(OUTPUT_FOLDER, exist_ok=True)
    bpy.ops.wm.open_mainfile(filepath=os.path.join(WORK_FOLDER, HEAD_BLEND), load_ui=False, use_scripts=False)
    objects = {obj.name: obj for obj in bpy.data.objects}
    for obj in objects.values():
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
    direction = face_direction(objects)
    print("Body faces", "-Y" if direction == 1 else "+Y")
    heat, silhouette, surface = read_tokens()
    print("Heat tokens", heat, silhouette, surface)

    centre_z = FRAME_HEIGHT_METRES / 2 - 0.07
    debug_views = ["front", "back", "three-quarter", "three-quarter-back"]
    if which in ("debug", "all"):
        legend = [(f" {muscle_id}", DEBUG_PALETTE[muscle_id]) for muscle_id in MUSCLE_IDS]
        legend.append((" other muscle", DEBUG_OTHER))
        legend.append((" skin", SKIN_COLOUR))
        views = debug_views if view_name == "all" else [view_name]
        render_set(objects, "debug", views, "#20242d",
                   (DEBUG_PALETTE, DEBUG_OTHER, DEBUG_CORE, make_skin_material(SKIN_COLOUR)),
                   legend, FRAME_HEIGHT_METRES, centre_z, direction, WIDTH)  # fmt: skip
    heat_colours = {muscle_id: heat[PUSH_DAY_HEAT_STEP.get(muscle_id, 0)] for muscle_id in MUSCLE_IDS}
    glow = {muscle_id: 0.12 + 0.05 * PUSH_DAY_HEAT_STEP.get(muscle_id, 0) for muscle_id in MUSCLE_IDS}
    heat_arguments = (heat_colours, silhouette, "#1e2430", make_skin_material("#8fa6c8", 0.04, 0.5), glow)
    if which in ("heat", "all"):
        render_set(objects, "heat", ["front", "back"] if view_name == "all" else [view_name], surface,
                   heat_arguments, None, FRAME_HEIGHT_METRES, centre_z, direction, WIDTH)  # fmt: skip
    if which in ("closeup", "all"):
        render_set(objects, "heat-torso", ["three-quarter"], surface, heat_arguments, None,
                   CLOSEUP_FRAME_HEIGHT_METRES, CLOSEUP_CENTRE_Z, direction, CLOSEUP_WIDTH, CLOSEUP_HEIGHT)  # fmt: skip


if __name__ == "__main__":
    main()
