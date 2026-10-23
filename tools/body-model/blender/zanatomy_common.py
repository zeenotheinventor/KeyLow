"""Shared by the Z-Anatomy scripts. Runs inside Blender's Python."""

import hashlib
import json
import os
import sys

sys.dont_write_bytecode = True

ZANATOMY_FILE = "Startup.blend"
ZANATOMY_SHA256 = "9f08a17ea0115fed80b2a73ecdf0a1bc2ab2f6956f37c593ce23d513ea35afcd"
MUSCLE_COLLECTION = "4: Muscular system"
SKELETON_COLLECTION = "1: Skeletal system"
TOOL_FOLDER = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPOSITORY_ROOT = os.path.dirname(os.path.dirname(TOOL_FOLDER))
# The head fades in from the neck skin between these heights. The CC0 head is cut so its lowest ring sits at
# HEAD_BLEND_START_METRES.
HEAD_BLEND_START_METRES = 1.445
HEAD_BLEND_END_METRES = 1.492
MAP_PATH = os.path.join(TOOL_FOLDER, "muscles", "male", "zanatomy-map.json")


def load_json(path):
    with open(path) as handle:
        return json.load(handle)


def script_arguments():
    return sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []


def argument_value(arguments, name, default=None):
    for index, argument in enumerate(arguments):
        if argument == name and index + 1 < len(arguments):
            return arguments[index + 1]
        if argument.startswith(name + "="):
            return argument.split("=", 1)[1]
    return default


def work_folder_problem(path, repository_root):
    """Why a scratch folder is not allowed, or None. Links are followed, so a link into the repository is refused."""
    resolved = os.path.realpath(path)
    root = os.path.realpath(repository_root)
    if os.path.commonpath([resolved, root]) == root:
        return "--work must be outside the repository."
    return None


def require_work_folder(arguments):
    """The --work folder, resolved, or a stop with a message when it is missing or inside the repository."""
    work_folder = argument_value(arguments, "--work")
    if not work_folder:
        raise SystemExit("Pass --work <scratch folder outside the repository>.")
    problem = work_folder_problem(work_folder, REPOSITORY_ROOT)
    if problem:
        raise SystemExit(problem)
    return os.path.realpath(work_folder)


def file_hash_problem(path, expected_sha256):
    """Why a file is not the one the hash names, or None."""
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for block in iter(lambda: handle.read(1 << 20), b""):
            digest.update(block)
    if digest.hexdigest() != expected_sha256:
        return f"{os.path.basename(path)} has sha256 {digest.hexdigest()} but this tool was written for {expected_sha256}."
    return None


def open_zanatomy(arguments):
    """Opens the Z-Anatomy file without its UI or its scripts. The file embeds a Python script that is never run."""
    import bpy

    if bpy.context.preferences.filepaths.use_scripts_auto_execute:
        raise SystemExit("Auto Run Python Scripts is on. Run with --disable-autoexec so the file cannot run code.")
    folder = argument_value(arguments, "--source", os.environ.get("ZANATOMY_SOURCE"))
    if not folder:
        raise SystemExit("Pass --source <folder holding Startup.blend> or set ZANATOMY_SOURCE.")
    path = os.path.join(folder, ZANATOMY_FILE)
    if not os.path.isfile(path):
        raise SystemExit(f"{ZANATOMY_FILE} not found in {folder}")
    problem = file_hash_problem(path, ZANATOMY_SHA256)
    if problem:
        raise SystemExit(problem)
    bpy.ops.wm.open_mainfile(filepath=path, load_ui=False, use_scripts=False)
    return path


def collection_meshes(collection_name):
    import bpy

    collection = bpy.data.collections[collection_name]
    return [obj for obj in collection.all_objects if obj.type == "MESH"]
