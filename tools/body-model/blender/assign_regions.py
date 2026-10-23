"""Gives every face of the male body one muscle id (or `body`) from the data files in regions/male/.

    blender --background --factory-startup --python assign_regions.py -- --source <folder> [--scratch <folder>]

The faces are those of the body at the Multires level the data files name (level 3 is 677,440 faces), with the
sculpted detail, so borders follow smooth lines instead of the steps of the 10,590 base quads. The level is a contract,
not a setting: the run stops when the body does not have that level, or when the face count or the face order differs
from what the data files were cut on. Writes the result as an
integer face attribute `muscle_region` on a copy of that mesh in a scratch .blend, outside the repository, and prints
the coverage report. render_regions.py runs this first, so it is rarely run alone.
"""

import json
import os
import sys
import tempfile

import bpy
import numpy

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common  # noqa: E402
import regions  # noqa: E402

BODY_KEY = "realistic_body_male"
REGIONS_FOLDER = os.path.join(common.TOOL_FOLDER, "regions", "male")
ATTRIBUTE_NAME = "muscle_region"
REGION_ID_LIST = [regions.BODY_ID, *regions.MUSCLE_IDS]
SCRATCH_FILE_NAME = "male-regions.blend"


def argument_value(arguments, name, default):
    for index, argument in enumerate(arguments):
        if argument == name and index + 1 < len(arguments):
            return arguments[index + 1]
        if argument.startswith(name + "="):
            return argument.split("=", 1)[1]
    return default


def repository_root():
    """The nearest ancestor of the tool folder with a .git (a folder, or a file in a worktree)."""
    folder = os.path.realpath(common.TOOL_FOLDER)
    while not os.path.exists(os.path.join(folder, ".git")):
        parent = os.path.dirname(folder)
        if parent == folder:
            raise SystemExit("The repository root was not found, so the scratch folder cannot be checked.")
        folder = parent
    return folder


def inside_a_git_checkout(folder):
    while True:
        if os.path.exists(os.path.join(folder, ".git")):
            return True
        parent = os.path.dirname(folder)
        if parent == folder:
            return False
        folder = parent


def scratch_folder(arguments):
    folder = os.path.realpath(
        os.path.abspath(argument_value(arguments, "--scratch", os.path.join(tempfile.gettempdir(), "keylow-body-model")))
    )
    root = repository_root()
    if os.path.commonpath([folder, root]) == root or inside_a_git_checkout(folder):
        raise SystemExit(f"The scratch folder must be outside any git checkout, so no .blend is ever committed: {folder}")
    os.makedirs(folder, exist_ok=True)
    return folder


def level_object(body, scene, level):
    """A new object holding the body's mesh at the given Multires level, detail included. The bundle's own body is
    left as it was."""
    scene.collection.objects.link(body)
    multires = [modifier for modifier in body.modifiers if modifier.type == "MULTIRES"]
    if level > 0 and not multires:
        raise SystemExit(f"The data files name Multires level {level} but {body.name} has no Multires modifier.")
    for modifier in multires:
        if modifier.total_levels < level:
            raise SystemExit(
                f"The data files name Multires level {level} but {body.name} only has {modifier.total_levels}."
            )
        modifier.levels = modifier.render_levels = level
    bpy.context.window.scene = scene
    bpy.context.view_layer.update()
    depsgraph = bpy.context.evaluated_depsgraph_get()
    mesh = bpy.data.meshes.new_from_object(body.evaluated_get(depsgraph), depsgraph=depsgraph)
    mesh.shade_smooth()
    obj = bpy.data.objects.new(f"{body.name}.level{level}", mesh)
    obj.matrix_world = body.matrix_world
    scene.collection.objects.link(obj)
    return obj


def body_frame_and_faces(obj):
    """The body's frame, each face as (point in the frame, normal Y), and each face's neighbours by shared edge."""
    mesh = obj.data
    world = numpy.array(obj.matrix_world)
    vertex_count, face_count = len(mesh.vertices), len(mesh.polygons)

    vertices = numpy.empty(vertex_count * 3)
    mesh.vertices.foreach_get("co", vertices)
    vertices = vertices.reshape(-1, 3) @ world[:3, :3].T + world[:3, 3]
    floor_z = vertices[:, 2].min()
    frame = regions.BodyFrame(
        floor_z=float(floor_z),
        height=float(vertices[:, 2].max() - floor_z),
        midline_x=float(vertices[:, 0].mean()),
        centre_y=float((vertices[:, 1].min() + vertices[:, 1].max()) / 2),
    )

    centres = numpy.empty(face_count * 3)
    mesh.polygons.foreach_get("center", centres)
    centres = centres.reshape(-1, 3) @ world[:3, :3].T + world[:3, 3]
    normals = numpy.empty(face_count * 3)
    mesh.polygons.foreach_get("normal", normals)
    normals = normals.reshape(-1, 3) @ world[:3, :3].T
    normals_y = normals[:, 1] / numpy.linalg.norm(normals, axis=1)
    sides = numpy.abs(centres[:, 0] - frame.midline_x) / frame.height
    heights = (centres[:, 2] - frame.floor_z) / frame.height
    depths = (frame.centre_y - centres[:, 1]) / frame.height
    faces = [((side, height, depth), normal_y) for side, height, depth, normal_y in zip(
        sides.tolist(), heights.tolist(), depths.tolist(), normals_y.tolist()
    )]

    loop_totals = numpy.empty(face_count, dtype=numpy.int32)
    mesh.polygons.foreach_get("loop_total", loop_totals)
    loop_edges = numpy.empty(len(mesh.loops), dtype=numpy.int32)
    mesh.loops.foreach_get("edge_index", loop_edges)
    loop_faces = numpy.repeat(numpy.arange(face_count), loop_totals)
    order = numpy.argsort(loop_edges, kind="stable")
    sorted_edges, sorted_faces = loop_edges[order], loop_faces[order]
    shared = numpy.nonzero(sorted_edges[:-1] == sorted_edges[1:])[0]
    neighbours = [[] for _ in range(face_count)]
    for first, second in zip(sorted_faces[shared].tolist(), sorted_faces[shared + 1].tolist()):
        neighbours[first].append(second)
        neighbours[second].append(first)
    return frame, faces, neighbours


def write_scratch_blend(obj, ids, level, folder):
    """Saves the level mesh alone with the assignment on it as a face attribute, for the split ticket to read."""
    mesh = obj.data
    attribute = mesh.attributes.new(ATTRIBUTE_NAME, "INT", "FACE")
    attribute.data.foreach_set("value", [REGION_ID_LIST.index(muscle_id) for muscle_id in ids])
    mesh[ATTRIBUTE_NAME + "_ids"] = json.dumps(REGION_ID_LIST)
    mesh["multires_level"] = level
    path = os.path.join(folder, SCRATCH_FILE_NAME)
    bpy.data.libraries.write(path, {obj}, fake_user=True)
    return path


def print_report(groups, ids, report, faces, islands):
    counts = report["counts"]
    print("\nCoverage report (faces per id):")
    for group in groups:
        for region in group.regions:
            print(f"  {region.id:<12} {counts[region.id]:>6}  ({group.name}, priority {region.priority})")
    print(f"  {regions.BODY_ID:<12} {counts[regions.BODY_ID]:>6}  (unclaimed)")
    print(f"  total        {len(ids):>6}")

    print(f"\nUnclaimed faces: {len(report['unclaimed'])}, by height band (0 soles, 1 crown):")
    for band, count in regions.unclaimed_summary(report["unclaimed"], faces).items():
        print(f"  {band}: {count}")

    print(f"\nClaimed by more than one region before priority: {len(report['claimedTwice'])}")
    pairs = {}
    for _, owners in report["claimedTwice"]:
        pairs[" over ".join(owners)] = pairs.get(" over ".join(owners), 0) + 1
    for pair, count in sorted(pairs.items()):
        print(f"  {pair}: {count} (the first won)")

    wanted = {muscle_id for group in groups for muscle_id in (region.id for region in group.regions)}
    print("\nPieces per id (a left and a right half are two pieces):")
    single_faces = []
    for muscle_id in sorted(wanted):
        pieces = sorted((len(piece) for name, piece in islands if name == muscle_id), reverse=True)
        print(f"  {muscle_id:<12} {len(pieces)} pieces, largest {pieces[0] if pieces else 0}, smallest {pieces[-1] if pieces else 0}")
        single_faces += [piece[0] for name, piece in islands if name == muscle_id and len(piece) == 1]
    print(f"Single-face islands: {len(single_faces)}")
    for index in single_faces[:20]:
        side, height, depth = faces[index][0]
        print(f"  face {index} ({ids[index]}) at side {side:.3f}, height {height:.3f}, depth {depth:.3f}")


def run(arguments):
    """Opens the bundle, checks its hash, assigns the faces, writes the scratch .blend and prints the report.
    Returns (body, level object, groups, ids)."""
    source = common.source_folder(arguments)
    scratch = scratch_folder(arguments)
    try:
        groups = regions.load_groups(REGIONS_FOLDER)
        regions.check_source_hash(groups, regions.file_sha256(os.path.join(source, common.BUNDLE_FILE_NAME)))
        level = regions.common_multires_level(groups)
    except regions.RegionError as error:
        raise SystemExit(str(error))
    common.open_bundle(source)
    body = bpy.data.objects[common.BODIES[BODY_KEY]]
    obj = level_object(body, bpy.data.scenes.new("regions working"), level)
    _, faces, neighbours = body_frame_and_faces(obj)
    print(f"Cutting {len(faces)} faces (Multires level {level}). Face fingerprint: {regions.order_fingerprint(faces)}")
    try:
        regions.check_face_contract(groups, faces)
        ids, report = regions.assign(groups, faces)
    except regions.RegionError as error:
        raise SystemExit(str(error))
    islands = regions.find_islands(ids, neighbours)
    print_report(groups, ids, report, faces, islands)
    print(f"\nScratch file: {write_scratch_blend(obj, ids, level, scratch)}")
    return body, obj, groups, ids


if __name__ == "__main__":
    run(common.script_arguments())
