"""How many triangles each exported muscle id gets. Pure Python, no Blender import, tested from test/zanatomyBudget.test.ts."""

import math


def id_targets(budget, source_triangles):
    """Shares budget["idsTriangles"] between the ids in proportion to the square root of their source triangles, so the
    heaviest are cut hardest. An id never gets fewer than budget["minimumIdTriangles"] (or its own floor in
    budget["idFloors"], for an id whose shape needs more) or more than its source has."""
    total_share = sum(math.sqrt(count) for count in source_triangles.values())
    targets = {}
    for muscle_id, count in source_triangles.items():
        share = budget["idsTriangles"] * math.sqrt(count) / total_share
        floor = budget.get("idFloors", {}).get(muscle_id, budget["minimumIdTriangles"])
        targets[muscle_id] = min(count, max(floor, round(share)))
    return targets


def budget_problems(budget, muscle_ids, counts, source_counts, outside_percent):
    """What is wrong with the triangles per mesh, as messages. counts has every exported mesh, counted after the meshes
    were validated, and source_counts the triangles each id had before decimation."""
    problems = []
    total = sum(counts.values())
    if total > budget["maximumTriangles"]:
        problems.append(f"{total:,} triangles is over {budget['maximumTriangles']:,}.")
    for muscle_id in muscle_ids:
        minimum = min(budget["minimumIdTriangles"], source_counts[muscle_id])
        if counts[muscle_id] < minimum:
            problems.append(f"{muscle_id} has only {counts[muscle_id]:,} triangles, the minimum is {minimum:,}.")
    low, high = budget["minimumSkinTriangles"], budget["maximumSkinTriangles"]
    if not low <= counts["skin"] <= high:
        problems.append(f"skin has {counts['skin']:,} triangles, it must be {low:,} to {high:,}.")
    head_and_eyes = counts["head"] + counts["eyes"]
    if head_and_eyes > budget["maximumHeadAndEyesTriangles"]:
        problems.append(
            f"head and eyes have {head_and_eyes:,} triangles, the limit is {budget['maximumHeadAndEyesTriangles']:,}."
        )
    if outside_percent > budget["maximumPercentOutsideSkin"]:
        problems.append(f"{outside_percent:.3f} % of the drawn muscle vertices are outside the skin.")
    return problems
