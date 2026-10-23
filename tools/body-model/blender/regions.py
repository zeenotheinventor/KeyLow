"""The muscle region engine: turns the data files under regions/<sex>/ into one muscle id per face.

Pure Python with no Blender import, so Vitest can run it (test/regions.test.ts calls the command line at the
bottom of this file). The format is documented in the package README.

Every point is first put in the normalised body frame, so a rule is written once and can be re-fitted to another
body with small changes:

    side    distance from the midline as a fraction of the body's height (always >= 0, so one rule covers both sides)
    height  0 at the soles, 1 at the crown
    depth   distance in front of the body's centre as a fraction of the height (negative behind it)

The faces are those of the body at the Multires level the data files name, so a face index only means something
together with that level and the bundle's sha256.
"""

import hashlib
import json
import math
import os
import sys

# The 22 ids of MUSCLE_IDS in packages/core/src/training/muscles.ts, in the same order. test/regions.test.ts
# fails if the two lists differ.
MUSCLE_IDS = [
    "chest_upper",
    "chest_lower",
    "delt_front",
    "delt_side",
    "delt_rear",
    "lats",
    "traps_upper",
    "traps_mid",
    "lower_back",
    "biceps",
    "triceps",
    "forearms",
    "abs",
    "obliques",
    "glute_max",
    "glute_med",
    "quads",
    "hamstrings",
    "adductors",
    "calves",
    "tibialis",
    "neck",
]
BODY_ID = "body"

# The priority band of each group file. A higher number wins where regions overlap.
PRIORITY_BANDS = {
    "trunk": (100, 199),
    "shoulders_arms": (200, 299),
    "legs": (300, 399),
}

# A face counts as facing the front when its normal points at least this far toward -Y (the body faces -Y), and as
# facing the back when it points this far toward +Y. The flank between the two faces neither.
FACING_THRESHOLD = 0.3

AXES = ("side", "height", "depth")
FACINGS = ("front", "back", "any")


class RegionError(Exception):
    """A data file is wrong, or does not match the bundle it was cut against. The message says what to fix."""


class BodyFrame:
    """Puts world coordinates in the normalised body frame."""

    def __init__(self, floor_z, height, midline_x, centre_y):
        self.floor_z = floor_z
        self.height = height
        self.midline_x = midline_x
        self.centre_y = centre_y

    def point(self, x, y, z):
        return (
            abs(x - self.midline_x) / self.height,
            (z - self.floor_z) / self.height,
            (self.centre_y - y) / self.height,
        )


# --- shapes -----------------------------------------------------------------------------------------------------


def _is_number(value):
    """A real, finite number. A NaN or an infinity would make every comparison quietly false."""
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def _bounds(shape, where):
    bounds = []
    for axis in AXES:
        pair = shape.get(axis)
        if pair is None:
            bounds.append((-math.inf, math.inf))
        elif isinstance(pair, list) and len(pair) == 2 and all(_is_number(value) for value in pair):
            if pair[0] > pair[1]:
                raise RegionError(f"{where}: '{axis}' is [{pair[0]}, {pair[1]}], with the minimum above the maximum.")
            bounds.append((pair[0], pair[1]))
        else:
            raise RegionError(f"{where}: '{axis}' must be [minimum, maximum], two finite numbers.")
    return bounds


def _triple(shape, key, where):
    value = shape.get(key)
    if not (isinstance(value, list) and len(value) == 3 and all(_is_number(item) for item in value)):
        raise RegionError(f"{where}: '{key}' must be three numbers (side, height, depth).")
    return value


OUTLINE_SAMPLES_PER_SPAN = 6


def _catmull_rom_loop(points):
    """A closed smooth curve through the points, as a polygon with several samples between neighbours."""
    count = len(points)
    polygon = []
    for index in range(count):
        before, start, end, after = (points[(index + offset) % count] for offset in (-1, 0, 1, 2))
        for step in range(OUTLINE_SAMPLES_PER_SPAN):
            t = step / OUTLINE_SAMPLES_PER_SPAN
            polygon.append(
                tuple(
                    0.5
                    * (
                        2 * b
                        + (-a + c) * t
                        + (2 * a - 5 * b + 4 * c - d) * t * t
                        + (-a + 3 * b - 3 * c + d) * t * t * t
                    )
                    for a, b, c, d in zip(before, start, end, after)
                )
            )
    return polygon


def _orientation(a, b, c):
    cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
    return (cross > 1e-12) - (cross < -1e-12)


def _on_segment(a, b, c):
    """c is collinear with a and b. True when it lies between them."""
    return min(a[0], b[0]) <= c[0] <= max(a[0], b[0]) and min(a[1], b[1]) <= c[1] <= max(a[1], b[1])


def _segments_cross(a, b, c, d):
    first, second = _orientation(a, b, c), _orientation(a, b, d)
    third, fourth = _orientation(c, d, a), _orientation(c, d, b)
    if first != second and third != fourth:
        return True
    return (
        (first == 0 and _on_segment(a, b, c))
        or (second == 0 and _on_segment(a, b, d))
        or (third == 0 and _on_segment(c, d, a))
        or (fourth == 0 and _on_segment(c, d, b))
    )


def is_simple_polygon(polygon):
    """True when no two edges that are not neighbours cross or touch."""
    count = len(polygon)
    for first in range(count):
        for second in range(first + 2, count):
            if first == 0 and second == count - 1:
                continue
            if _segments_cross(polygon[first], polygon[(first + 1) % count], polygon[second], polygon[(second + 1) % count]):
                return False
    return True


def _inside_polygon(polygon, x, y):
    """Even-odd test."""
    inside = False
    previous_x, previous_y = polygon[-1]
    for current_x, current_y in polygon:
        if (current_y > y) != (previous_y > y) and x < (previous_x - current_x) * (y - current_y) / (previous_y - current_y) + current_x:
            inside = not inside
        previous_x, previous_y = current_x, current_y
    return inside


def _compile_outline(shape, where):
    points = shape.get("points")
    if not (
        isinstance(points, list)
        and len(points) >= 3
        and all(
            isinstance(point, list) and len(point) == 2 and all(_is_number(value) for value in point)
            for point in points
        )
    ):
        raise RegionError(f"{where}: an outline needs 'points', a list of at least three [side, height] pairs of finite numbers.")
    points = [tuple(point) for point in points]
    if shape.get("mirror", False):
        if points[0][0] != 0 or points[-1][0] != 0:
            raise RegionError(f"{where}: a mirrored outline starts and ends on the midline (side 0).")
        points = points + [(-side, height) for side, height in reversed(points[1:-1])]
    polygon = _catmull_rom_loop(points) if shape.get("smooth", True) else points
    if not is_simple_polygon(polygon):
        raise RegionError(f"{where}: the outline crosses itself. Reorder its points so the curve does not cut across its own path.")
    low_side, high_side = min(x for x, _ in polygon), max(x for x, _ in polygon)
    low_height, high_height = min(y for _, y in polygon), max(y for _, y in polygon)
    depth_low, depth_high = _bounds({"depth": shape.get("depth")}, where)[2]

    def test(point):
        side, height, depth = point
        return (
            low_height <= height <= high_height
            and depth_low <= depth <= depth_high
            and low_side <= side <= high_side
            and _inside_polygon(polygon, side, height)
        )

    return test


def compile_shape(shape, where):
    """Checks a shape from the data file and returns a function from a frame point to True or False."""
    if not isinstance(shape, dict) or "type" not in shape:
        raise RegionError(f"{where}: a shape is an object with a 'type'.")
    kind = shape["type"]

    if kind == "box":
        bounds = _bounds(shape, where)
        return lambda p: all(low <= value <= high for value, (low, high) in zip(p, bounds))

    if kind == "outline":
        return _compile_outline(shape, where)

    if kind == "ellipsoid":
        centre = _triple(shape, "centre", where)
        radii = _triple(shape, "radii", where)
        if any(radius <= 0 for radius in radii):
            raise RegionError(f"{where}: ellipsoid radii must be positive.")
        return lambda p: sum(((value - c) / r) ** 2 for value, c, r in zip(p, centre, radii)) <= 1.0

    if kind == "plane":
        point = _triple(shape, "point", where)
        normal = _triple(shape, "normal", where)
        if not any(normal):
            raise RegionError(f"{where}: a plane needs a normal that is not zero.")
        return lambda p: sum((value - o) * n for value, o, n in zip(p, point, normal)) >= 0

    if kind in ("union", "intersection"):
        members = shape.get("of")
        if not isinstance(members, list) or not members:
            raise RegionError(f"{where}: a {kind} needs a non-empty 'of' list.")
        tests = [compile_shape(member, f"{where}/{kind}[{index}]") for index, member in enumerate(members)]
        if kind == "union":
            return lambda p: any(test(p) for test in tests)
        return lambda p: all(test(p) for test in tests)

    if kind == "difference":
        if "from" not in shape or "minus" not in shape:
            raise RegionError(f"{where}: a difference needs 'from' and 'minus'.")
        keep = compile_shape(shape["from"], f"{where}/from")
        remove = compile_shape(shape["minus"], f"{where}/minus")
        return lambda p: keep(p) and not remove(p)

    raise RegionError(f"{where}: unknown shape type '{kind}'. Use box, outline, ellipsoid, plane, union, intersection or difference.")


def facing_matches(facing, normal_y):
    if facing == "front":
        return normal_y <= -FACING_THRESHOLD
    if facing == "back":
        return normal_y >= FACING_THRESHOLD
    return True


# --- loading ----------------------------------------------------------------------------------------------------


class Region:
    def __init__(self, group, entry, where):
        self.group = group
        self.id = entry.get("id")
        if self.id not in MUSCLE_IDS:
            raise RegionError(f"{where}: '{self.id}' is not one of the 22 muscle ids.")
        low, high = PRIORITY_BANDS[group]
        self.priority = entry.get("priority")
        if not isinstance(self.priority, int) or not low <= self.priority <= high:
            raise RegionError(f"{where}: priority of {self.id} must be a whole number from {low} to {high} for the {group} group.")
        self.facing = entry.get("facing", "any")
        if self.facing not in FACINGS:
            raise RegionError(f"{where}: facing of {self.id} must be one of {', '.join(FACINGS)}.")
        self.test = compile_shape(entry.get("shape"), f"{where}/{self.id}")
        self.add_faces = _face_list(entry, "addFaces", where, self.id)
        self.remove_faces = _face_list(entry, "removeFaces", where, self.id)


def _face_list(entry, key, where, region_id):
    value = entry.get(key, [])
    if not (isinstance(value, list) and all(isinstance(item, int) and item >= 0 for item in value)):
        raise RegionError(f"{where}: {key} of {region_id} must be a list of face indices.")
    return value


class Group:
    def __init__(self, name, data):
        if name not in PRIORITY_BANDS:
            raise RegionError(f"{name}.json: no priority band is reserved for a group called '{name}'.")
        where = f"{name}.json"
        self.name = name
        self.source_sha256 = data.get("sourceSha256")
        if not isinstance(self.source_sha256, str) or len(self.source_sha256) != 64:
            raise RegionError(f"{where}: sourceSha256 must be the 64 character sha256 of the bundle's .blend.")
        self.multires_level = data.get("multiresLevel")
        if not isinstance(self.multires_level, int) or isinstance(self.multires_level, bool) or not 0 <= self.multires_level <= 3:
            raise RegionError(f"{where}: multiresLevel must be a whole number from 0 (the base mesh) to 3.")
        self.face_count = data.get("faceCount")
        if not isinstance(self.face_count, int) or isinstance(self.face_count, bool) or self.face_count < 1:
            raise RegionError(f"{where}: faceCount must be the number of faces of the body at that Multires level.")
        self.face_fingerprint = data.get("faceFingerprint")
        if not isinstance(self.face_fingerprint, str) or len(self.face_fingerprint) != 64:
            raise RegionError(f"{where}: faceFingerprint must be the 64 character hash that order_fingerprint prints.")
        entries = data.get("regions")
        if not isinstance(entries, list) or not entries:
            raise RegionError(f"{where}: 'regions' must be a non-empty list.")
        self.regions = [Region(name, entry, where) for entry in entries]
        ids = [region.id for region in self.regions]
        if len(set(ids)) != len(ids):
            raise RegionError(f"{where}: an id appears twice.")


def load_groups(folder):
    """Reads every .json file in the folder as one group, named after the file. No file refers to another."""
    names = sorted(name for name in os.listdir(folder) if name.endswith(".json"))
    if not names:
        raise RegionError(f"No region files found in {folder}.")
    groups = []
    for name in names:
        with open(os.path.join(folder, name), encoding="utf-8") as handle:
            groups.append(Group(name[: -len(".json")], json.load(handle)))
    return groups


def file_sha256(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for block in iter(lambda: handle.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


def common_multires_level(groups):
    """Every file cuts the same faces, so every file names the same Multires level."""
    levels = {group.name: group.multires_level for group in groups}
    if len(set(levels.values())) != 1:
        raise RegionError(f"The region files name different Multires levels ({levels}). Face numbers only mean something at one level.")
    return groups[0].multires_level


def check_source_hash(groups, actual):
    for group in groups:
        if group.source_sha256 != actual:
            raise RegionError(
                f"The bundle's sha256 is {actual} but {group.name}.json was cut against {group.source_sha256}. "
                "The face numbers would point at different faces. Use the original human_base_meshes_bundle.blend "
                "(v1.4.1), or cut the regions again and update sourceSha256."
            )


FINGERPRINT_STEP = 1000
FINGERPRINT_DECIMALS = 2


def order_fingerprint(faces):
    """A hash of the centre of every 1,000th face, rounded to two decimals of the height (about 1.7 cm). Two Blender
    versions that number the faces differently give different hashes. The rounding is coarse on purpose, so float noise
    between machines does not change it."""
    digest = hashlib.sha256()
    for point, _ in faces[::FINGERPRINT_STEP]:
        digest.update(",".join(f"{value:.{FINGERPRINT_DECIMALS}f}" for value in point).encode("ascii") + b";")
    return digest.hexdigest()


def check_face_contract(groups, faces):
    """The face numbers in a data file mean something only for the exact mesh it was cut on."""
    for group in groups:
        if len(faces) != group.face_count:
            raise RegionError(
                f"{group.name}.json was cut on {group.face_count} faces but the body has {len(faces)} at "
                f"Multires level {group.multires_level}. The face numbers would point at different faces."
            )
        if order_fingerprint(faces) != group.face_fingerprint:
            raise RegionError(
                f"The faces of the body are in a different order from the ones {group.name}.json was cut on "
                "(the face fingerprint differs). Use the Blender version the regions were cut with, or cut them again "
                "and update faceFingerprint."
            )


# --- assigning --------------------------------------------------------------------------------------------------


def claims_by_region(regions, faces):
    """For each region, the set of face indices it claims. A face is (point in the body frame, normal Y)."""
    claims = {}
    for region in regions:
        claimed = {
            index
            for index, (point, normal_y) in enumerate(faces)
            if facing_matches(region.facing, normal_y) and region.test(point)
        }
        for index in region.add_faces + region.remove_faces:
            if index >= len(faces):
                raise RegionError(f"{region.group}.json: {region.id} names face {index} but the body has {len(faces)} faces.")
        claimed |= set(region.add_faces)
        claimed -= set(region.remove_faces)
        claims[(region.group, region.id)] = claimed
    return claims


def assign(groups, faces):
    """Returns (ids, report). ids[i] is the muscle id of face i, or BODY_ID. The highest priority wins where regions
    overlap. Two overlapping regions with the same priority are an error, because the winner would be a guess."""
    regions = [region for group in groups for region in group.regions]
    claims = claims_by_region(regions, faces)
    claimants = [[] for _ in faces]
    for region in regions:
        for index in claims[(region.group, region.id)]:
            claimants[index].append(region)

    ids = []
    claimed_twice = []
    for index, owners in enumerate(claimants):
        if not owners:
            ids.append(BODY_ID)
            continue
        owners = sorted(owners, key=lambda region: -region.priority)
        if len(owners) > 1:
            claimed_twice.append((index, [region.id for region in owners]))
            if owners[0].priority == owners[1].priority:
                raise RegionError(
                    f"Face {index} is claimed by {owners[0].id} and {owners[1].id} at the same priority "
                    f"({owners[0].priority}). Give one of them a higher priority."
                )
        ids.append(owners[0].id)

    counts = {muscle_id: 0 for muscle_id in [*MUSCLE_IDS, BODY_ID]}
    for muscle_id in ids:
        counts[muscle_id] += 1
    unclaimed = [index for index, muscle_id in enumerate(ids) if muscle_id == BODY_ID]
    return ids, {"counts": counts, "unclaimed": unclaimed, "claimedTwice": claimed_twice}


def unclaimed_summary(unclaimed, faces, band_size=0.1):
    """Where the unclaimed faces are: how many in each band of height, from the soles up."""
    bands = {}
    for index in unclaimed:
        band = int(faces[index][0][1] / band_size)
        bands[band] = bands.get(band, 0) + 1
    return {f"{band * band_size:.1f} to {(band + 1) * band_size:.1f}": count for band, count in sorted(bands.items())}


def find_islands(ids, neighbours):
    """The connected pieces of each id. neighbours[i] lists the faces that share an edge with face i. Returns a list
    of (id, [face indices]) for every piece, so a left and a right half of one id are two pieces."""
    seen = [False] * len(ids)
    islands = []
    for start, muscle_id in enumerate(ids):
        if seen[start]:
            continue
        seen[start] = True
        stack, piece = [start], []
        while stack:
            current = stack.pop()
            piece.append(current)
            for other in neighbours[current]:
                if not seen[other] and ids[other] == muscle_id:
                    seen[other] = True
                    stack.append(other)
        islands.append((muscle_id, sorted(piece)))
    return islands


# --- command line, for the tests -------------------------------------------------------------------------------


def _faces_of(request):
    """Faces as (point in the frame, normal Y). A request gives them in the frame, or in world coordinates with the frame
    to put them in."""
    if "worldFaces" in request:
        frame = request["frame"]
        body_frame = BodyFrame(frame["floorZ"], frame["height"], frame["midlineX"], frame["centreY"])
        return [(body_frame.point(x, y, z), normal_y) for x, y, z, normal_y in request["worldFaces"]]
    return [((entry[0], entry[1], entry[2]), entry[3]) for entry in request["faces"]]


def _run_from_standard_input():
    """Reads {"groups": {name: data}, "faces": [[side, height, depth, normalY]] or "worldFaces" with "frame",
    "bundleSha256", "neighbours", "verifyFaces"} and prints {"ids", "report", "islands", "muscleIds"}, or {"error"}
    with exit code 1. {"fingerprintOf": true} with faces prints {"fingerprint"} instead."""
    request = json.load(sys.stdin)
    try:
        faces = _faces_of(request)
        if request.get("fingerprintOf"):
            print(json.dumps({"fingerprint": order_fingerprint(faces)}))
            return
        groups = [Group(name, data) for name, data in sorted(request["groups"].items())]
        check_source_hash(groups, request["bundleSha256"])
        common_multires_level(groups)
        if request.get("verifyFaces"):
            check_face_contract(groups, faces)
        ids, report = assign(groups, faces)
        islands = find_islands(ids, request["neighbours"]) if "neighbours" in request else []
    except RegionError as error:
        print(json.dumps({"error": str(error)}))
        sys.exit(1)
    print(json.dumps({"ids": ids, "report": report, "islands": islands, "muscleIds": MUSCLE_IDS}))


if __name__ == "__main__":
    _run_from_standard_input()
