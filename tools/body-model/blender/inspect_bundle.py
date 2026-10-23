"""Prints, and writes to inspection/bundle.json, what the Human Base Meshes bundle holds for the four bases.

    blender --background --factory-startup --python inspect_bundle.py -- --source <folder>
"""

import json
import math
import os
import sys

import bpy
import numpy

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common  # noqa: E402

HAIR_AND_FACIAL_EXTRA_WORDS = ("hair", "teeth", "tooth", "tongue", "lash", "brow", "beard")


def rounded(value, digits=4):
    return round(float(value), digits)


def world_vertices(evaluated_object):
    mesh = evaluated_object.to_mesh()
    points = numpy.empty(len(mesh.vertices) * 3, dtype=numpy.float64)
    mesh.vertices.foreach_get("co", points)
    points = points.reshape(-1, 3)
    matrix = numpy.array(evaluated_object.matrix_world)
    points = points @ matrix[:3, :3].T + matrix[:3, 3]
    counts = {
        "vertices": len(mesh.vertices),
        "faces": len(mesh.polygons),
        "triangles": sum(len(polygon.vertices) - 2 for polygon in mesh.polygons),
    }
    evaluated_object.to_mesh_clear()
    return points, counts


def modifier_details(modifier):
    details = {"name": modifier.name, "type": modifier.type}
    if modifier.type == "MIRROR":
        details.update(
            axes=[bool(flag) for flag in modifier.use_axis],
            mergeAtCentre=bool(modifier.use_mirror_merge),
            bisect=[bool(flag) for flag in modifier.use_bisect_axis],
            mirrorObject=modifier.mirror_object.name if modifier.mirror_object else None,
        )
    elif modifier.type == "MULTIRES":
        details.update(
            totalLevels=modifier.total_levels,
            viewportLevels=modifier.levels,
            sculptLevels=modifier.sculpt_levels,
            renderLevels=modifier.render_levels,
        )
    elif modifier.type == "SUBSURF":
        details.update(viewportLevels=modifier.levels, renderLevels=modifier.render_levels)
    details["showViewport"] = bool(modifier.show_viewport)
    details["showRender"] = bool(modifier.show_render)
    return details


def face_set_details(mesh, world_matrix, centre_x, bottom, height):
    """Sculpt face sets are an integer face attribute, with no names. Report each set's size and where it sits."""
    attribute = mesh.attributes.get(".sculpt_face_set")
    if attribute is None:
        return {"present": False, "count": 0, "sets": []}
    identifiers = numpy.empty(len(mesh.polygons), dtype=numpy.int32)
    attribute.data.foreach_get("value", identifiers)
    centres = numpy.empty(len(mesh.polygons) * 3, dtype=numpy.float64)
    mesh.polygons.foreach_get("center", centres)
    centres = centres.reshape(-1, 3) @ numpy.array(world_matrix)[:3, :3].T + numpy.array(world_matrix)[:3, 3]
    sets = []
    for identifier in sorted(set(identifiers.tolist())):
        members = centres[identifiers == identifier]
        sideways = members[:, 0] - centre_x
        faces_left = int((sideways > 0.005).sum())
        faces_right = int((sideways < -0.005).sum())
        sets.append(
            {
                "id": identifier,
                "faces": int(len(members)),
                "facesOnLeft": faces_left,
                "facesOnRight": faces_right,
                "side": "both" if faces_left and faces_right else ("left" if faces_left else ("right" if faces_right else "midline")),
                "lowestHeightFraction": rounded((members[:, 2].min() - bottom) / height, 3),
                "highestHeightFraction": rounded((members[:, 2].max() - bottom) / height, 3),
            }
        )
    one_side = [entry for entry in sets if entry["side"] in ("left", "right")]
    mirrored = sum(
        1
        for one in one_side
        if any(other["side"] != one["side"] and other["faces"] == one["faces"] for other in one_side)
    )
    return {"present": True, "count": len(sets), "oneSidedSetsWithAMirroredPartner": mirrored,
        "setsSpanningBothSides": sum(1 for entry in sets if entry["side"] == "both"), "sets": sets}


def facing_direction(body, children, points):
    """Which way the body faces, from where the eyes sit against the head. Blender's front view looks along +Y."""
    eyes = [child for child in children if "eye" in child.name.lower()]
    if not eyes:
        return None
    eye_y = numpy.mean([child.matrix_world.translation.y for child in eyes])
    eye_z = numpy.mean([child.matrix_world.translation.z for child in eyes])
    head_slab = points[numpy.abs(points[:, 2] - eye_z) < 0.04]
    return "-Y" if eye_y < head_slab[:, 1].mean() else "+Y"


def head_height_metres(points, centre_x, bottom, height):
    """Top of the head to the chin. Down the midline, the front of the face runs forward to the chin and then steps
    back sharply to the throat, so the chin is where the front edge first drops back 4 cm from its furthest point."""
    midline = points[(numpy.abs(points[:, 0] - centre_x) < 0.012) & (points[:, 2] > bottom + 0.75 * height)]
    top = midline[:, 2].max()
    furthest_forward = 0.0
    bin_height = 0.01
    for index in range(int((top - (bottom + 0.75 * height)) / bin_height)):
        upper = top - index * bin_height
        in_bin = midline[(midline[:, 2] <= upper) & (midline[:, 2] > upper - bin_height)][:, 1]
        front_edge = in_bin[in_bin < 0].min() if (in_bin < 0).any() else None
        if front_edge is None:
            continue
        if front_edge > furthest_forward + 0.04 and furthest_forward < -0.1:
            return rounded(top - upper)
        furthest_forward = min(furthest_forward, front_edge)
    return None


def arm_angle_degrees(points, centre_x, bottom, height):
    """The arm's angle below horizontal, from a line fitted through the vertices out beyond the torso."""
    arm = points[(points[:, 0] > centre_x + 0.13 * height) & (points[:, 2] > bottom + 0.3 * height)]
    if len(arm) < 10:
        return None
    centred = arm[:, [0, 2]] - arm[:, [0, 2]].mean(axis=0)
    direction = numpy.linalg.svd(centred, full_matrices=False)[2][0]
    return rounded(abs(math.degrees(math.atan2(direction[1], direction[0]))), 1)


def silhouette_widths(points, bottom, height, steps=20):
    """Width and depth of the body at evenly spaced heights, as a fraction of its height. Shows where the head,
    neck and shoulders are, which is what the region cuts depend on."""
    rows = []
    for step in range(steps + 1):
        fraction = step / steps
        low, high = bottom + max(fraction - 0.025, 0) * height, bottom + min(fraction + 0.025, 1) * height
        slab = points[(points[:, 2] >= low) & (points[:, 2] <= high)]
        if len(slab):
            rows.append(
                {
                    "heightFraction": rounded(fraction, 2),
                    "widthMetres": rounded(slab[:, 0].max() - slab[:, 0].min()),
                    "depthMetres": rounded(slab[:, 1].max() - slab[:, 1].min()),
                }
            )
    return rows


def inspect_body(key, object_name, depsgraph):
    body = bpy.data.objects[object_name]
    evaluated = body.evaluated_get(depsgraph)
    points, evaluated_counts = world_vertices(evaluated)
    mesh = body.data
    mesh.calc_loop_triangles()
    bottom, top = points[:, 2].min(), points[:, 2].max()
    height = top - bottom
    centre_x = (points[:, 0].min() + points[:, 0].max()) / 2
    head_metres = head_height_metres(points, centre_x, bottom, height)
    children = list(body.children)
    cameras_on_body = [o.name for o in bpy.data.objects if o.type == "CAMERA" and o.parent == body]
    collection_names = [collection.name for collection in body.users_collection]

    return {
        "key": key,
        "object": body.name,
        "mesh": mesh.name,
        "collections": collection_names,
        "parent": body.parent.name if body.parent else None,
        "cameraObjectsParentedToBody": cameras_on_body,
        "counts": {
            "baseMesh": {
                "vertices": len(mesh.vertices),
                "edges": len(mesh.edges),
                "faces": len(mesh.polygons),
                "triangles": len(mesh.loop_triangles),
            },
            "evaluatedAtViewportLevel": evaluated_counts,
        },
        "modifiers": [modifier_details(modifier) for modifier in body.modifiers],
        "hasMirrorModifier": any(modifier.type == "MIRROR" for modifier in body.modifiers),
        "faceSets": face_set_details(mesh, body.matrix_world, centre_x, bottom, height),
        "vertexGroups": [group.name for group in body.vertex_groups],
        "uvLayers": [layer.name for layer in mesh.uv_layers],
        "attributes": [
            {"name": attribute.name, "domain": attribute.domain, "type": attribute.data_type}
            for attribute in mesh.attributes
        ],
        "materials": [slot.material.name if slot.material else None for slot in body.material_slots],
        "shapeKeys": [key_block.name for key_block in mesh.shape_keys.key_blocks] if mesh.shape_keys else [],
        "armatureModifier": any(modifier.type == "ARMATURE" for modifier in body.modifiers),
        "transform": {
            "location": [rounded(value) for value in body.location],
            "rotationEulerDegrees": [rounded(math.degrees(value), 2) for value in body.rotation_euler],
            "scale": [rounded(value) for value in body.scale],
        },
        "dimensionsMetres": {
            "width": rounded(body.dimensions.x),
            "depth": rounded(body.dimensions.y),
            "height": rounded(body.dimensions.z),
        },
        "worldBoundsMetres": {
            "minimum": [rounded(value) for value in points.min(axis=0)],
            "maximum": [rounded(value) for value in points.max(axis=0)],
        },
        "upAxis": "Z" if height >= max(numpy.ptp(points[:, 0]), numpy.ptp(points[:, 1])) else "unclear",
        "facing": facing_direction(body, children, points),
        "poseArmAngleBelowHorizontalDegrees": arm_angle_degrees(points, centre_x, bottom, height),
        "head": {
            "topToChinMetres": head_metres,
            "bodyHeightInHeads": rounded(height / head_metres, 1) if head_metres else None,
        },
        "silhouette": silhouette_widths(points, bottom, height),
        "children": [{"name": child.name, "type": child.type, "mesh": child.data.name} for child in children],
    }


def objects_named_after_hair_or_facial_extras():
    return [obj.name for obj in bpy.data.objects if any(word in obj.name.lower() for word in HAIR_AND_FACIAL_EXTRA_WORDS)]


def standalone_part_objects():
    """The bundle also ships heads, hands, feet, jaws, eyes and skulls as separate assets."""
    parts = []
    for obj in bpy.data.objects:
        if obj.type == "MESH" and obj.parent is None and not obj.name.startswith("GEO-"):
            parts.append(
                {
                    "name": obj.name,
                    "collections": [collection.name for collection in obj.users_collection],
                    "dimensionsMetres": [rounded(value) for value in obj.dimensions],
                    "modifiers": [modifier.type for modifier in obj.modifiers],
                }
            )
    standalone_heads = [
        {"name": obj.name, "collections": [c.name for c in obj.users_collection], "parent": obj.parent.name if obj.parent else None}
        for obj in bpy.data.objects
        if obj.name.startswith(("GEO-head_stylized", "GEO-head_animation", "GEO-head_sculpting")) and obj.parent is None
    ]
    return parts, standalone_heads


def main():
    arguments = common.script_arguments()
    bundle_path = common.open_bundle(common.source_folder(arguments))
    depsgraph = bpy.context.evaluated_depsgraph_get()

    bodies = {key: inspect_body(key, name, depsgraph) for key, name in common.BODIES.items()}
    parts, standalone_heads = standalone_part_objects()
    scene = bpy.context.scene
    result = {
        "blenderVersion": bpy.app.version_string,
        "bundleFile": os.path.basename(bundle_path),
        "objectCount": len(bpy.data.objects),
        "scene": {
            "unitSystem": scene.unit_settings.system,
            "unitScale": scene.unit_settings.scale_length,
            "armatureCount": len(bpy.data.armatures),
            "materialCount": len(bpy.data.materials),
        },
        "bodies": bodies,
        "objectsNamedAfterHairOrFacialExtras": objects_named_after_hair_or_facial_extras(),
        "standaloneParts": parts,
        "standaloneHeads": standalone_heads,
        "bodyCollections": sorted(collection.name for collection in bpy.data.collections if collection.name.startswith("Body ")),
    }

    output = os.path.join(common.TOOL_FOLDER, "inspection", "bundle.json")
    os.makedirs(os.path.dirname(output), exist_ok=True)
    with open(output, "w", encoding="utf-8") as handle:
        json.dump(result, handle, indent=2)
        handle.write("\n")

    for key, details in bodies.items():
        print(f"\n== {key}: {details['object']}")
        for field in ("mesh", "counts", "modifiers", "hasMirrorModifier", "dimensionsMetres", "upAxis", "facing",
                      "poseArmAngleBelowHorizontalDegrees", "children"):
            print(f"  {field}: {details[field]}")
        print(f"  faceSets: {details['faceSets']['count']}")
        print(f"  vertexGroups: {len(details['vertexGroups'])} {details['vertexGroups'][:30]}")
        print(f"  uvLayers: {details['uvLayers']}")
    print(f"\nWrote {output}")


main()
