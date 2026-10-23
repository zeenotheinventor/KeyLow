"""Lists every mesh of the Z-Anatomy muscle collection and the skeleton: name, faces, bounds, parent, modifiers.

    blender --background --factory-startup --disable-autoexec --python zanatomy_inspect.py -- --source <folder> --out <json>
"""

import json
import os
import sys

import bpy
import mathutils

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import zanatomy_common as common  # noqa: E402


def describe(obj):
    corners = [obj.matrix_world @ mathutils.Vector(corner) for corner in obj.bound_box]
    low = [min(c[i] for c in corners) for i in range(3)]
    high = [max(c[i] for c in corners) for i in range(3)]
    return {
        "name": obj.name,
        "faces": len(obj.data.polygons),
        "vertices": len(obj.data.vertices),
        "parent": obj.parent.name if obj.parent else None,
        "collections": [c.name for c in obj.users_collection],
        "modifiers": [m.type for m in obj.modifiers],
        "hidden": obj.hide_viewport,
        "low": [round(v, 4) for v in low],
        "high": [round(v, 4) for v in high],
    }


def main():
    arguments = common.script_arguments()
    common.open_zanatomy(arguments)
    output = common.argument_value(arguments, "--out")
    result = {
        "scene_units": [bpy.context.scene.unit_settings.system, bpy.context.scene.unit_settings.scale_length],
        "muscles": [describe(o) for o in common.collection_meshes(common.MUSCLE_COLLECTION)],
        "bones": [describe(o) for o in common.collection_meshes(common.SKELETON_COLLECTION)],
        "collections": [c.name for c in bpy.data.collections],
    }
    with open(output, "w") as handle:
        json.dump(result, handle, indent=1)
    print("muscles", len(result["muscles"]), "bones", len(result["bones"]))


if __name__ == "__main__":
    main()
