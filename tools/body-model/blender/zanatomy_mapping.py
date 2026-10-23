"""Sorts the Z-Anatomy muscle objects into the 22 ids from the mapping data. Pure Python, no Blender import.

The same rules are checked in test/zanatomyMap.test.ts, so the two must stay in step: an object is excluded first,
then mapped to the first id whose pattern matches its whole name, then head when it lies in a head collection, then hidden when it matches a hidden pattern, then drawn neutral, and is otherwise deep.
"""

import json
import re

EXCLUDED = "excluded"
NEUTRAL = "other"
DEEP = "deep"
HEAD = "head"


def load_map(path):
    with open(path) as handle:
        return json.load(handle)


def compile_map(mapping):
    return {
        "exclude_collections": set(mapping["exclude"]["collections"]),
        "exclude": [re.compile(pattern) for pattern in mapping["exclude"]["patterns"]],
        "head_collections": set(mapping["head"]["collections"]),
        "hidden": [re.compile(pattern) for pattern in mapping["hidden"]["patterns"]],
        "ids": {muscle_id: [re.compile(p) for p in patterns] for muscle_id, patterns in mapping["ids"].items()},
        "neutral_collections": set(mapping["neutral"]["collections"]),
        "neutral": [re.compile(pattern) for pattern in mapping["neutral"]["patterns"]],
    }


def classify(compiled, name, collection_names):
    """The id the object maps to, or "other" (drawn neutral), "deep" (not drawn) or "excluded"."""
    if set(collection_names) & compiled["exclude_collections"]:
        return EXCLUDED
    if any(pattern.fullmatch(name) for pattern in compiled["exclude"]):
        return EXCLUDED
    for muscle_id, patterns in compiled["ids"].items():
        if any(pattern.fullmatch(name) for pattern in patterns):
            return muscle_id
    if set(collection_names) & compiled["head_collections"]:
        return HEAD
    if any(pattern.fullmatch(name) for pattern in compiled["hidden"]):
        return DEEP
    if set(collection_names) & compiled["neutral_collections"] or any(
        pattern.fullmatch(name) for pattern in compiled["neutral"]
    ):
        return NEUTRAL
    return DEEP
