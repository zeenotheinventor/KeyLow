"""Builds the see-through skin shell and the dark core that fills the gaps between muscles, from the grouped muscles.

    blender --background --factory-startup --disable-autoexec --python zanatomy_skin.py -- --work <folder>

Reads zanatomy-muscles.blend (made by zanatomy_muscles.py) and writes zanatomy-body.blend. There is no skin in
Z-Anatomy, so the shell is made from the body itself:

1. join every muscle and bone (deep muscles too) and voxel-remesh the union, which gives one closed envelope;
2. core = that envelope pulled in by CORE_INSET_METRES, so it sits just under the muscle surfaces;
3. skin = the envelope pushed out by SKIN_OUTSET_METRES, closed again with a coarser voxel remesh and then
   smoothed hard, so it reads as a smooth body outline and not as lumpy muscle.

The run prints how many of the drawn muscle vertices end up outside the skin, which has to stay near zero.
"""

import os
import sys
import time

import bpy
import mathutils
import numpy

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import zanatomy_common as common  # noqa: E402

ENVELOPE_VOXEL_METRES = 0.005
CORE_INSET_METRES = 0.004
SKIN_OUTSET_METRES = 0.010
SKIN_CLOSE_VOXEL_METRES = 0.008
SKIN_SMOOTH_ITERATIONS = 40
SKIN_SMOOTH_FACTOR = 0.6
MUSCLES_BLEND = "zanatomy-muscles.blend"
BODY_BLEND = "zanatomy-body.blend"


def select_only(obj):
    for other in bpy.context.view_layer.objects:
        other.select_set(False)
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def duplicate(obj, name):
    copy = obj.copy()
    copy.data = obj.data.copy()
    copy.name = name
    bpy.context.scene.collection.objects.link(copy)
    return copy


def join(objects, name):
    copies = [duplicate(obj, f"{name}-{index}") for index, obj in enumerate(objects)]
    select_only(copies[0])
    for copy in copies:
        copy.select_set(True)
    bpy.ops.object.join()
    joined = bpy.context.view_layer.objects.active
    joined.name = name
    return joined


def voxel_remesh(obj, size):
    select_only(obj)
    obj.data.remesh_voxel_size = size
    obj.data.remesh_voxel_adaptivity = 0.0
    bpy.ops.object.voxel_remesh()


def displace(obj, metres):
    """Moves every vertex along its normal."""
    obj.data.update()
    count = len(obj.data.vertices)
    positions = numpy.zeros(count * 3, dtype=numpy.float32)
    normals = numpy.zeros(count * 3, dtype=numpy.float32)
    obj.data.vertices.foreach_get("co", positions)
    obj.data.vertices.foreach_get("normal", normals)
    obj.data.vertices.foreach_set("co", positions + normals * metres)
    obj.data.update()


def log(message):
    print(f"[{time.time() - START:6.1f} s] {message}", flush=True)


START = time.time()


def smooth(obj, iterations, factor):
    modifier = obj.modifiers.new("smooth", "SMOOTH")
    modifier.iterations = iterations
    modifier.factor = factor
    select_only(obj)
    bpy.ops.object.modifier_apply(modifier=modifier.name)


def vertices_outside(shell, objects):
    """How many vertices of the objects lie outside the closed shell, by the side of the nearest face."""
    tree = mathutils.bvhtree.BVHTree.FromObject(shell, bpy.context.evaluated_depsgraph_get())
    outside = total = 0
    for obj in objects:
        for vertex in obj.data.vertices:
            total += 1
            location, normal, _, _ = tree.find_nearest(vertex.co)
            if location is not None and (vertex.co - location).dot(normal) > 0:
                outside += 1
    return outside, total


def main():
    arguments = common.script_arguments()
    work_folder = common.require_work_folder(arguments)
    bpy.ops.wm.open_mainfile(filepath=os.path.join(work_folder, MUSCLES_BLEND), load_ui=False, use_scripts=False)
    bpy.context.window.scene = bpy.data.scenes["grouped"]

    everything = [obj for obj in bpy.context.scene.objects]
    drawn = [obj for obj in everything if obj.name.startswith("muscle_") and obj.name not in ("muscle_deep", "muscle_head")]

    envelope = join(everything, "envelope")
    log(f"Joined: {len(envelope.data.polygons):,} faces")
    voxel_remesh(envelope, ENVELOPE_VOXEL_METRES)
    log(f"Envelope: {len(envelope.data.polygons):,} faces")

    core = duplicate(envelope, "core")
    displace(core, -CORE_INSET_METRES)
    smooth(core, 4, 0.5)

    skin = duplicate(envelope, "skin")
    displace(skin, SKIN_OUTSET_METRES)
    voxel_remesh(skin, SKIN_CLOSE_VOXEL_METRES)
    smooth(skin, SKIN_SMOOTH_ITERATIONS, SKIN_SMOOTH_FACTOR)
    log(f"Skin: {len(skin.data.polygons):,} faces")

    bpy.data.objects.remove(envelope)
    outside, total = vertices_outside(skin, drawn)
    print(f"Drawn muscle vertices outside the skin: {outside:,} of {total:,} ({100 * outside / total:.2f} %)")

    for obj in (skin, core):
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(work_folder, BODY_BLEND), compress=True)
    print("Saved", os.path.join(work_folder, BODY_BLEND))


if __name__ == "__main__":
    main()
