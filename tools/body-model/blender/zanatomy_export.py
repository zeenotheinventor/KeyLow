"""Decimates the male body to phone size and writes it as an unquantised .glb in the scratch folder.

    blender --background --factory-startup --disable-autoexec --python zanatomy_export.py -- --work <folder>

Reads zanatomy-body-head.blend (made by zanatomy_head.py) and writes male-raw.glb. src/exportMale.ts runs this and then
quantises the file into dist/male.glb, so run it with `pnpm --filter @keylow/body-model export --work <folder>`.

The 27 meshes, in this order: the 22 ids, other, skin, core, head, eyes. The deep muscles, the head muscles and the
skeleton are never exported. Triangles per mesh come from the budget block of the mapping data. Each mesh is rebuilt
as plain triangles with smooth normals (no UVs, no masks, no custom normals), moved so the feet are on the floor and the
body is centred, and given a plain material named mat_<name>. Only the eyes carry vertex colours, for the white, iris and
pupil. Blender's Z up becomes glTF's Y up on export, and the body faces +Z.
"""

import json
import math
import os
import sys
import time

import bmesh
import bpy
import mathutils
import numpy

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import zanatomy_budget as budget_rules  # noqa: E402
import zanatomy_common as common  # noqa: E402

HEAD_BLEND = "zanatomy-body-head.blend"
RAW_GLB = "male-raw.glb"
PHONE_DROP_ATTRIBUTE = "phone_drop"
EXTRA_NAMES = ["other", "skin", "core", "head", "eyes"]
SOURCE_OBJECT = {"other": "muscle_other", "skin": "skin", "core": "core", "head": "head_face"}
EYE_OBJECTS = ("eye_left", "eye_right")
# Plain colours. The app sets its own materials by mesh name, these only make the file look sensible in a viewer.
MUSCLE_COLOUR = "#8a8f99"
MATERIAL_COLOUR = {
    "other": "#7d8594",
    "skin": "#b9cbe6",
    "core": "#1e2430",
    "head": "#b3a79b",
    "eyes": "#ffffff",
}
SKIN_ALPHA = 0.12
EYE_WHITE = "#e9e6df"
EYE_IRIS = "#4a5560"
EYE_PUPIL = "#0b0c0e"
# The same cut-offs as the render's eye material: how far the surface faces forward from the eye centre.
EYE_IRIS_FROM = 0.84
EYE_PUPIL_FROM = 0.96
MAXIMUM_PASSES = 3
COUNT_TOLERANCE = 0.03


def log(message):
    print(f"[{time.time() - START:6.1f} s] {message}", flush=True)


START = time.time()


def linear_colour(hex_colour, alpha=1.0):
    def to_linear(channel):
        return channel / 12.92 if channel <= 0.04045 else ((channel + 0.055) / 1.055) ** 2.4

    return (*(to_linear(int(hex_colour[i : i + 2], 16) / 255) for i in (1, 3, 5)), alpha)


def triangle_count(mesh):
    return sum(len(polygon.vertices) - 2 for polygon in mesh.polygons)


def clean_source_mesh(obj, drop_attribute=None):
    """A triangulated copy of the object's mesh, without the faces flagged by the attribute."""
    mesh = obj.data.copy()
    builder = bmesh.new()
    builder.from_mesh(mesh)
    if drop_attribute:
        layer = builder.faces.layers.bool.get(drop_attribute)
        dropped = [face for face in builder.faces if face[layer]]
        bmesh.ops.delete(builder, geom=dropped, context="FACES")
    bmesh.ops.triangulate(builder, faces=builder.faces[:])
    builder.to_mesh(mesh)
    builder.free()
    return mesh


def decimated(mesh, target):
    """The mesh collapsed to about target triangles, as (vertices, triangles) arrays. The ratio is corrected up to
    MAXIMUM_PASSES times until the count is within COUNT_TOLERANCE of the target."""
    source = len(mesh.polygons)
    ratio = min(1.0, target / source)
    result = None
    for _ in range(MAXIMUM_PASSES):
        if ratio >= 1.0:
            result = mesh.copy()
            break
        scratch = bpy.data.objects.new("decimate", mesh.copy())
        bpy.context.scene.collection.objects.link(scratch)
        modifier = scratch.modifiers.new("decimate", "DECIMATE")
        modifier.decimate_type = "COLLAPSE"
        modifier.ratio = ratio
        modifier.use_collapse_triangulate = True
        bpy.context.view_layer.update()
        result = bpy.data.meshes.new_from_object(scratch.evaluated_get(bpy.context.evaluated_depsgraph_get()))
        bpy.data.objects.remove(scratch)
        count = len(result.polygons)
        if abs(count - target) <= COUNT_TOLERANCE * target:
            break
        ratio = min(1.0, ratio * target / count)
    result.calc_loop_triangles()
    vertices = numpy.zeros(len(result.vertices) * 3, dtype=numpy.float32)
    result.vertices.foreach_get("co", vertices)
    triangles = numpy.zeros(len(result.loop_triangles) * 3, dtype=numpy.int32)
    result.loop_triangles.foreach_get("vertices", triangles)
    return vertices.reshape(-1, 3), triangles.reshape(-1, 3)


def joined_eyes(scene_objects):
    """Both eyes as one (vertices, triangles) pair, with the eye each vertex belongs to."""
    all_vertices, all_triangles, centres = [], [], []
    for name in EYE_OBJECTS:
        mesh = clean_source_mesh(scene_objects[name])
        vertices = numpy.zeros(len(mesh.vertices) * 3, dtype=numpy.float32)
        mesh.vertices.foreach_get("co", vertices)
        vertices = vertices.reshape(-1, 3)
        mesh.calc_loop_triangles()
        triangles = numpy.zeros(len(mesh.loop_triangles) * 3, dtype=numpy.int32)
        mesh.loop_triangles.foreach_get("vertices", triangles)
        triangles = triangles.reshape(-1, 3) + sum(len(v) for v in all_vertices)
        all_vertices.append(vertices)
        all_triangles.append(triangles)
        centres.append(numpy.repeat([(vertices.min(axis=0) + vertices.max(axis=0)) / 2], len(vertices), axis=0))
    return numpy.concatenate(all_vertices), numpy.concatenate(all_triangles), numpy.concatenate(centres)


def eye_colours(vertices, centres):
    """White, iris and pupil by how far each vertex faces forward (-Y) from its eye centre."""
    offset = vertices - centres
    direction = offset / numpy.maximum(numpy.linalg.norm(offset, axis=1, keepdims=True), 1e-9)
    forward = -direction[:, 1]
    colours = numpy.tile(linear_colour(EYE_WHITE), (len(vertices), 1))
    colours[forward >= EYE_IRIS_FROM] = linear_colour(EYE_IRIS)
    colours[forward >= EYE_PUPIL_FROM] = linear_colour(EYE_PUPIL)
    return colours.astype(numpy.float32)


def percent_outside(skin, drawn):
    """The spike's skin check on the decimated meshes: drawn muscle vertices that lie outside the closed skin."""
    skin_vertices, skin_triangles = skin
    tree = mathutils.bvhtree.BVHTree.FromPolygons(
        [mathutils.Vector(vertex) for vertex in skin_vertices.tolist()], skin_triangles.tolist()
    )
    outside = total = 0
    for vertices, _ in drawn:
        for vertex in vertices.tolist():
            point = mathutils.Vector(vertex)
            location, normal, _, _ = tree.find_nearest(point)
            total += 1
            if location is not None and (point - location).dot(normal) > 0:
                outside += 1
    return outside, total


def mesh_arrays(mesh):
    """The vertices and triangles of a built mesh as arrays."""
    vertices = numpy.zeros(len(mesh.vertices) * 3, dtype=numpy.float32)
    mesh.vertices.foreach_get("co", vertices)
    mesh.calc_loop_triangles()
    triangles = numpy.zeros(len(mesh.loop_triangles) * 3, dtype=numpy.int32)
    mesh.loop_triangles.foreach_get("vertices", triangles)
    return vertices.reshape(-1, 3), triangles.reshape(-1, 3)


def make_material(name, hex_colour, alpha=1.0):
    """Plain and single colour. Only the skin is culled on its back faces, because the muscle meshes and the head are
    not all closed."""
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    shader = material.node_tree.nodes["Principled BSDF"]
    shader.inputs["Base Color"].default_value = linear_colour(hex_colour)
    shader.inputs["Metallic"].default_value = 0.0
    shader.inputs["Roughness"].default_value = 0.6
    if alpha < 1.0:
        shader.inputs["Alpha"].default_value = alpha
        material.surface_render_method = "BLENDED"
        material.use_backface_culling = True
    return material


def build_object(name, vertices, triangles, colours=None):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices.tolist(), [], triangles.tolist())
    mesh.polygons.foreach_set("use_smooth", [True] * len(mesh.polygons))
    mesh.validate()
    if colours is not None:
        attribute = mesh.color_attributes.new("Color", "FLOAT_COLOR", "POINT")
        attribute.data.foreach_set("color", colours.reshape(-1))
        mesh.color_attributes.active_color = attribute
    mesh.materials.append(make_material(f"mat_{name}", MATERIAL_COLOUR.get(name, MUSCLE_COLOUR), SKIN_ALPHA if name == "skin" else 1.0))
    return bpy.data.objects.new(name, mesh)


def main():
    arguments = common.script_arguments()
    work_folder = common.require_work_folder(arguments)
    bpy.ops.wm.open_mainfile(filepath=os.path.join(work_folder, HEAD_BLEND), load_ui=False, use_scripts=False)
    mapping = common.load_json(common.MAP_PATH)
    budget = mapping["budget"]
    muscle_ids = list(mapping["ids"].keys())
    names = muscle_ids + EXTRA_NAMES
    sources = {obj.name: obj for obj in bpy.data.objects}

    # 1. clean triangles from every source mesh
    cleaned = {}
    for muscle_id in muscle_ids:
        cleaned[muscle_id] = clean_source_mesh(sources[f"muscle_{muscle_id}"])
    cleaned["other"] = clean_source_mesh(sources["muscle_other"], PHONE_DROP_ATTRIBUTE)
    for name in ("skin", "core", "head"):
        cleaned[name] = clean_source_mesh(sources[SOURCE_OBJECT[name]])
    eye_vertices, eye_triangles, eye_centres = joined_eyes(sources)
    log("Source triangles: " + f"{sum(len(m.polygons) for m in cleaned.values()):,} without the eyes")

    # 2. decimate to the budget
    targets = budget_rules.id_targets(budget, {muscle_id: len(cleaned[muscle_id].polygons) for muscle_id in muscle_ids})
    for name in EXTRA_NAMES[:-1]:
        targets[name] = min(budget[name], len(cleaned[name].polygons))
    results = {name: decimated(cleaned[name], targets[name]) for name in names[:-1]}
    results["eyes"] = (eye_vertices, eye_triangles)
    log("Decimated")

    # 3. feet on the floor, centred on x and y (glTF z), measured on the skin
    skin_vertices = results["skin"][0]
    centre = (skin_vertices.min(axis=0) + skin_vertices.max(axis=0)) / 2
    floor = min(vertices[:, 2].min() for vertices, _ in results.values())
    shift = numpy.array([centre[0], centre[1], floor], dtype=numpy.float32)
    results = {name: (vertices - shift, triangles) for name, (vertices, triangles) in results.items()}
    eye_centres = eye_centres - shift

    # 4. a fresh scene with the 27 plain objects, in the contract order. Building a mesh validates it, which drops
    # degenerate triangles, so the counts and the budget checks come from the built meshes.
    scene = bpy.data.scenes.new("phone")
    bpy.context.window.scene = scene
    for other in [s for s in bpy.data.scenes if s != scene]:
        bpy.data.scenes.remove(other)
    # Object names are unique in the whole file, so the sources go first or "skin" and "core" would become "skin.001".
    for source in list(bpy.data.objects):
        bpy.data.objects.remove(source)
    exported = {}
    for name in names:
        vertices, triangles = results[name]
        colours = eye_colours(vertices, eye_centres) if name == "eyes" else None
        exported[name] = build_object(name, vertices, triangles, colours)
        if exported[name].name != name:
            raise SystemExit(f"The object {name} was named {exported[name].name}.")
    triangles_per_mesh = {name: len(exported[name].data.polygons) for name in names}
    total_triangles = sum(triangles_per_mesh.values())
    dropped = sum(len(results[name][1]) for name in names) - total_triangles
    print(f"Degenerate triangles dropped by validation: {dropped:,}")

    # 5. the skin check on the decimated meshes, from the built meshes
    built = {name: mesh_arrays(exported[name].data) for name in names}
    outside, total = percent_outside(built["skin"], [built[name] for name in muscle_ids + ["other"]])
    outside_percent = 100 * outside / total
    print(f"Drawn muscle vertices outside the decimated skin: {outside:,} of {total:,} ({outside_percent:.3f} %)")
    print("\nTriangles per mesh")
    for name in names:
        print(f"  {name:<14}{triangles_per_mesh[name]:>9,}")
    print(f"  {'total':<14}{total_triangles:>9,}  (limit {budget['maximumTriangles']:,})")
    source_counts = {muscle_id: len(cleaned[muscle_id].polygons) for muscle_id in muscle_ids}
    problems = budget_rules.budget_problems(budget, muscle_ids, triangles_per_mesh, source_counts, outside_percent)
    if problems:
        raise SystemExit("\n".join(problems))
    for name in names:
        scene.collection.objects.link(exported[name])

    output = os.path.join(work_folder, RAW_GLB)
    bpy.ops.export_scene.gltf(
        filepath=output,
        export_format="GLB",
        use_active_scene=True,
        export_yup=True,
        export_apply=False,
        export_normals=True,
        export_tangents=False,
        export_texcoords=False,
        export_materials="EXPORT",
        export_vertex_color="ACTIVE",
        export_attributes=False,
        export_cameras=False,
        export_lights=False,
        export_animations=False,
        export_skins=False,
        export_morph=False,
        export_extras=False,
    )
    log(f"Saved {output} ({os.path.getsize(output) / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
