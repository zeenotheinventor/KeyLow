"""Groups the Z-Anatomy muscles into the 22 ids and saves them, with the skeleton, to a scratch .blend.

    blender --background --factory-startup --disable-autoexec --python zanatomy_muscles.py -- --source <folder> --work <folder>
        [--names <json>]

Only muscle meshes and the skeleton are taken from the file, nothing else (some organs in it carry non-commercial
licences). Every object is read as its base mesh, in world space, and joined into one object per group:
muscle_<id> for each of the 22 ids, muscle_other (superficial muscles with no id, drawn neutral), muscle_head (face and head muscles, never drawn), muscle_deep
(everything else, not drawn but used to build the skin) and skeleton. Prints the faces per id, the objects that
mapped to nothing and any id without objects, and stops when an id is empty. --names writes the object names to a
JSON file that the Vitest test checks the mapping data against.
"""

import json
import os
import sys

import bmesh
import bpy
import mathutils

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import zanatomy_common as common  # noqa: E402
import zanatomy_mapping as mapping  # noqa: E402

MUSCLES_BLEND = "zanatomy-muscles.blend"


def new_group_mesh(objects):
    """One mesh holding the world-space geometry of every object."""
    builder = bmesh.new()
    for obj in objects:
        copy = obj.data.copy()
        copy.transform(obj.matrix_world)
        if obj.matrix_world.determinant() < 0:
            copy.flip_normals()
        builder.from_mesh(copy)
        bpy.data.meshes.remove(copy)
    return builder


def make_group_object(name, objects, collection):
    builder = new_group_mesh(objects)
    mesh = bpy.data.meshes.new(name)
    builder.to_mesh(mesh)
    builder.free()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    return obj


def trim_faces(trims, objects):
    """Deletes the faces of one group that lie within a distance of another group's surface."""
    for trim in trims:
        target, other = objects[f"muscle_{trim['id']}"], objects[f"muscle_{trim['awayFrom']}"]
        tree = mathutils.bvhtree.BVHTree.FromObject(other, bpy.context.evaluated_depsgraph_get())
        builder = bmesh.new()
        builder.from_mesh(target.data)
        near = [
            face
            for face in builder.faces
            if (tree.find_nearest(face.calc_center_median())[3] or 1e9) < trim["withinMetres"]
        ]
        before = len(builder.faces)
        bmesh.ops.delete(builder, geom=near, context="FACES")
        builder.to_mesh(target.data)
        builder.free()
        print(f"Trim: {len(near):,} of {before:,} {trim['id']} faces within {trim['withinMetres']} m of {trim['awayFrom']} removed")


def main():
    arguments = common.script_arguments()
    work_folder = common.require_work_folder(arguments)
    common.open_zanatomy(arguments)
    os.makedirs(work_folder, exist_ok=True)

    compiled = mapping.compile_map(mapping.load_map(common.MAP_PATH))
    groups = {muscle_id: [] for muscle_id in compiled["ids"]}
    groups[mapping.NEUTRAL] = []
    groups[mapping.DEEP] = []
    groups[mapping.HEAD] = []
    excluded = []
    names = []
    for obj in common.collection_meshes(common.MUSCLE_COLLECTION):
        collection_names = [collection.name for collection in obj.users_collection]
        names.append({"name": obj.name, "faces": len(obj.data.polygons), "collections": collection_names})
        if not obj.data.polygons:
            continue
        group = mapping.classify(compiled, obj.name, collection_names)
        if group == mapping.EXCLUDED:
            excluded.append(obj)
        else:
            groups[group].append(obj)
    limits = json.load(open(common.MAP_PATH))["skeleton"]
    skeleton, stray = [], []
    for bone in common.collection_meshes(common.SKELETON_COLLECTION):
        if not bone.data.polygons:
            continue
        centre = sum((bone.matrix_world @ mathutils.Vector(corner) for corner in bone.bound_box), mathutils.Vector()) / 8
        inside = abs(centre.x) <= limits["maximumAbsoluteX"] and abs(centre.y) <= limits["maximumAbsoluteY"]
        (skeleton if inside else stray).append(bone)

    names_path = common.argument_value(arguments, "--names")
    if names_path:
        with open(names_path, "w") as handle:
            handle.write("[\n" + ",\n".join(json.dumps(entry) for entry in sorted(names, key=lambda e: e["name"])) + "\n]\n")

    face_count = {group: sum(len(obj.data.polygons) for obj in objects) for group, objects in groups.items()}
    print("\nFaces per id (objects)")
    for group, objects in groups.items():
        print(f"  {group:<14}{face_count[group]:>9,}  ({len(objects)})")
    print(f"  {'excluded':<14}{sum(len(o.data.polygons) for o in excluded):>9,}  ({len(excluded)})")
    print(f"  {'skeleton':<14}{sum(len(o.data.polygons) for o in skeleton):>9,}  ({len(skeleton)})")
    print(f"  {'stray bones':<14}{sum(len(o.data.polygons) for o in stray):>9,}  ({len(stray)}) left out, off the body")
    print("\nMuscle objects mapped to nothing and not drawn (deep):")
    for obj in sorted(groups[mapping.DEEP], key=lambda o: o.name):
        print(f"  {obj.name} ({len(obj.data.polygons)})")
    print("\nMuscle objects drawn neutral (other):")
    for obj in sorted(groups[mapping.NEUTRAL], key=lambda o: o.name):
        print(f"  {obj.name} ({len(obj.data.polygons)})")
    print("\nObjects per id:")
    for muscle_id in compiled["ids"]:
        print(f"  {muscle_id}: " + ", ".join(sorted(o.name for o in groups[muscle_id])))
    empty = [muscle_id for muscle_id in compiled["ids"] if not groups[muscle_id]]
    print("\nIds with no objects:", empty or "none")
    if empty:
        raise SystemExit(f"Ids with no objects: {', '.join(empty)}")

    scene = bpy.data.scenes.new("grouped")
    made = {}
    for group, objects in groups.items():
        made[group] = make_group_object(f"muscle_{group}", objects, scene.collection)
    bpy.context.window.scene = scene
    bpy.context.view_layer.update()
    trim_faces(json.load(open(common.MAP_PATH))["trim"], {f"muscle_{key}": obj for key, obj in made.items()})
    make_group_object("skeleton", skeleton, scene.collection)
    print("\nFaces and triangles per group after the trims")
    for group, obj in made.items():
        triangles = sum(len(polygon.vertices) - 2 for polygon in obj.data.polygons)
        print(f"  {group:<14}{len(obj.data.polygons):>9,}{triangles:>11,}")
    drawn = [obj for group, obj in made.items() if group not in (mapping.DEEP, mapping.HEAD)]
    print(
        f"  {'drawn total':<14}{sum(len(o.data.polygons) for o in drawn):>9,}"
        f"{sum(len(p.vertices) - 2 for o in drawn for p in o.data.polygons):>11,}"
    )
    # Keep only the new scene, so the saved file holds no other part of the source.
    bpy.context.window.scene = scene
    for other in [s for s in bpy.data.scenes if s != scene]:
        bpy.data.scenes.remove(other)
    for text in list(bpy.data.texts):
        bpy.data.texts.remove(text)
    kept_meshes = {obj.data for obj in scene.collection.objects}
    for mesh in [m for m in bpy.data.meshes if m not in kept_meshes]:
        bpy.data.meshes.remove(mesh)
    for obj in [o for o in bpy.data.objects if o.name not in scene.collection.objects]:
        bpy.data.objects.remove(obj)
    output = os.path.join(work_folder, MUSCLES_BLEND)
    bpy.ops.wm.save_as_mainfile(filepath=output, compress=True)
    print("Saved", output)


if __name__ == "__main__":
    main()
