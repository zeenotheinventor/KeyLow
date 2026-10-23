"""Grafts the head and upper neck of the CC0 realistic male onto the Z-Anatomy body.

    blender --background --factory-startup --disable-autoexec --python zanatomy_head.py -- --work <folder>
        --head-source <folder holding human_base_meshes_bundle.blend>

Reads zanatomy-body.blend (made by zanatomy_skin.py) and the Human Base Meshes bundle (CC0), and writes
zanatomy-body-head.blend. In that file:

- head_face, eye_left and eye_right are the bundle's head and eyes, cut at the neck with the shoulder slope dropped,
  scaled to the Z-Anatomy head and moved so the lowest neck ring sits on the skin's neck. The lower neck is fitted to
  the skin's ring so the seam does not step;
- the skin and the core stop at SKIN_CUT_METRES, so the generated head bubble is gone;
- every drawn muscle loses the faces above MUSCLE_CLIP_METRES, so nothing shows inside or through the face.

The bundle is opened without its scripts.
"""

import os
import sys

import bmesh
import bpy
import mathutils
import numpy

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common  # noqa: E402
import zanatomy_common as zanatomy  # noqa: E402

BODY_BLEND = "zanatomy-body.blend"
HEAD_BLEND = "zanatomy-body-head.blend"
BUNDLE_BODY = "GEO-body_male_realistic"
BUNDLE_EYES = ("GEO-body_male_realistic.eye.L", "GEO-body_male_realistic.eye.R")
MULTIRES_LEVEL = 2
# Where the bundle's head is cut, and how it is scaled and placed. The bundle's eyes are at z 1.574 and its chin at
# about 1.453, the Z-Anatomy eyes at about 1.59, and the Z-Anatomy head is about 0.92 of the bundle's.
BUNDLE_CUT_Z = 1.415
BUNDLE_CHIN_Z = 1.453
BUNDLE_EYE_Z = 1.574
# Below the chin, faces further out than this (the bundle's metres) are the start of the shoulders and are dropped.
BUNDLE_NECK_HALF_WIDTH = 0.08
HEAD_SCALE = 0.92
BODY_EYE_Z = 1.59
# The skin and the face meet where the render material fades the skin into clay.
SKIN_CUT_METRES = zanatomy.HEAD_BLEND_END_METRES
NECK_FIT_TOP_METRES = 1.52
MUSCLE_CLIP_METRES = zanatomy.HEAD_BLEND_END_METRES + 0.005
SKIN_NAMES = ("skin", "core")
# The bundle's mesh has rings about a centimetre apart, so the lowest ring is read over a band.
RING_TOLERANCE_METRES = 0.012


def remove_faces_above(obj, height):
    builder = bmesh.new()
    builder.from_mesh(obj.data)
    above = [face for face in builder.faces if face.calc_center_median().z > height]
    bmesh.ops.delete(builder, geom=above, context="FACES")
    builder.to_mesh(obj.data)
    builder.free()
    return len(above)


def vertex_array(mesh):
    positions = numpy.zeros(len(mesh.vertices) * 3, dtype=numpy.float32)
    mesh.vertices.foreach_get("co", positions)
    return positions.reshape(-1, 3)


def ring(points, height, tolerance):
    """Centre and half extents (x, y) of the points within tolerance of a height."""
    chosen = points[numpy.abs(points[:, 2] - height) < tolerance]
    low, high = chosen[:, :2].min(axis=0), chosen[:, :2].max(axis=0)
    return (low + high) / 2, (high - low) / 2, len(chosen)


def load_bundle_objects(arguments):
    folder = zanatomy.argument_value(arguments, "--head-source", os.environ.get("BODY_MODEL_SOURCE"))
    if not folder:
        raise SystemExit("Pass --head-source <folder holding human_base_meshes_bundle.blend>.")
    path = os.path.join(folder, common.BUNDLE_FILE_NAME)
    if not os.path.isfile(path):
        raise SystemExit(f"{common.BUNDLE_FILE_NAME} not found in {folder}")
    with bpy.data.libraries.load(path, link=False) as (source, target):
        target.objects = [BUNDLE_BODY, *BUNDLE_EYES]
    for obj in target.objects:
        bpy.context.scene.collection.objects.link(obj)
    bpy.context.view_layer.update()
    return {obj.name: obj for obj in target.objects}


def evaluated_copy(obj):
    """The object as it displays, in world space (modifiers applied)."""
    mesh = bpy.data.meshes.new_from_object(obj.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    mesh.transform(obj.matrix_world)
    return mesh


def bundle_head_mesh(body, midline_x):
    """The bundle body at a Multires level with everything below the neck cut away, and the shoulder slope dropped."""
    body.modifiers[0].levels = MULTIRES_LEVEL
    mesh = evaluated_copy(body)
    builder = bmesh.new()
    builder.from_mesh(mesh)

    def unwanted(face):
        centre = face.calc_center_median()
        shoulder = centre.z < BUNDLE_CHIN_Z and abs(centre.x - midline_x) > BUNDLE_NECK_HALF_WIDTH
        return centre.z < BUNDLE_CUT_Z or shoulder

    bmesh.ops.delete(builder, geom=[face for face in builder.faces if unwanted(face)], context="FACES")
    builder.to_mesh(mesh)
    builder.free()
    return mesh


def main():
    arguments = zanatomy.script_arguments()
    work_folder = zanatomy.require_work_folder(arguments)
    bpy.ops.wm.open_mainfile(filepath=os.path.join(work_folder, BODY_BLEND), load_ui=False, use_scripts=False)
    scene = bpy.context.scene

    # 1. the bundle's head and eyes, scaled and moved. The pivot is the middle of the eyes.
    objects = load_bundle_objects(arguments)
    midline_x = objects[BUNDLE_BODY].matrix_world.translation.x
    head_mesh = bundle_head_mesh(objects[BUNDLE_BODY], midline_x)
    pivot = mathutils.Vector((midline_x, 0.0, BUNDLE_EYE_Z))
    target = mathutils.Vector((0.0, 0.0, BODY_EYE_Z))
    eye_meshes = {}
    for name in BUNDLE_EYES:
        eye_meshes[f"eye_{'left' if name.endswith('L') else 'right'}"] = evaluated_copy(objects[name])
    for name in objects:
        bpy.data.objects.remove(objects[name])
    for mesh in [head_mesh, *eye_meshes.values()]:
        mesh.transform(mathutils.Matrix.Translation(-pivot))
        mesh.transform(mathutils.Matrix.Scale(HEAD_SCALE, 4))
        mesh.transform(mathutils.Matrix.Translation(target))
    for name, mesh in eye_meshes.items():
        scene.collection.objects.link(bpy.data.objects.new(name, mesh))
        mesh.polygons.foreach_set("use_smooth", [True] * len(mesh.polygons))

    # 2. the skin ring at the head's lowest ring, then the neck ring onto it and the lower neck widened to its width
    points = vertex_array(head_mesh)
    bottom = float(points[:, 2].min())
    skin_centre, skin_extent, skin_count = ring(vertex_array(bpy.data.objects["skin"].data), bottom, 0.004)
    print(f"Skin ring at {bottom:.3f} m: centre {skin_centre.round(3)}, half extent {skin_extent.round(3)} ({skin_count} vertices)")
    head_centre, head_extent, head_count = ring(points, bottom, RING_TOLERANCE_METRES)
    print(f"Head ring at {bottom:.3f} m: centre {head_centre.round(3)}, half extent {head_extent.round(3)} ({head_count} vertices)")
    shift = skin_centre - head_centre
    weight = numpy.clip((NECK_FIT_TOP_METRES - points[:, 2]) / (NECK_FIT_TOP_METRES - bottom), 0.0, 1.0)
    weight = weight * weight * (3 - 2 * weight)
    ratio = skin_extent / head_extent
    for axis in (0, 1):
        points[:, axis] = (
            skin_centre[axis] + (points[:, axis] - head_centre[axis]) * (1 + weight * (ratio[axis] - 1))
        )
    for mesh in eye_meshes.values():
        mesh.transform(mathutils.Matrix.Translation((shift[0], shift[1], 0.0)))
    head_mesh.vertices.foreach_set("co", points.reshape(-1))
    head_mesh.update()
    scene.collection.objects.link(bpy.data.objects.new("head_face", head_mesh))
    head_mesh.polygons.foreach_set("use_smooth", [True] * len(head_mesh.polygons))
    print(f"Head: {len(head_mesh.polygons):,} faces, shifted {shift.round(3)}, widening ratio {ratio.round(2)}")

    # 3. the generated head bubble and everything inside the face goes
    for name in SKIN_NAMES:
        removed = remove_faces_above(bpy.data.objects[name], SKIN_CUT_METRES)
        print(f"{name}: {removed:,} faces above {SKIN_CUT_METRES} m removed")
    for obj in list(scene.objects):
        if obj.name.startswith("muscle_") and obj.name not in ("muscle_deep", "muscle_head"):
            if max(vertex_array(obj.data)[:, 2]) > MUSCLE_CLIP_METRES:
                removed = remove_faces_above(obj, MUSCLE_CLIP_METRES)
                print(f"{obj.name}: {removed:,} faces above {MUSCLE_CLIP_METRES} m removed")

    output = os.path.join(work_folder, HEAD_BLEND)
    bpy.ops.wm.save_as_mainfile(filepath=output, compress=True)
    print("Saved", output)


if __name__ == "__main__":
    main()
