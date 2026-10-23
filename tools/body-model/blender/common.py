"""Shared by inspect_bundle.py and render_bases.py. Runs inside Blender's Python."""

import os
import sys

import bpy

BUNDLE_FILE_NAME = "human_base_meshes_bundle.blend"

# The four bases. The key names the body in the findings and in the render file names. The value is the body
# object in the bundle. (The bundle also has a thumbnail camera per body, named like the key, except that the
# realistic female camera is spelled "realistic_body_emale". The cameras are not used.)
BODIES = {
    "realistic_body_male": "GEO-body_male_realistic",
    "realistic_body_female": "GEO-body_female_realistic",
    "stylized_body_male": "GEO-body_male_stylized",
    "stylized_body_female": "GEO-body_female_stylized",
}

TOOL_FOLDER = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def script_arguments():
    """The arguments after the double dash, which Blender leaves alone."""
    return sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []


def source_folder(arguments):
    """The folder holding the bundle: --source, else BODY_MODEL_SOURCE."""
    for index, argument in enumerate(arguments):
        if argument == "--source" and index + 1 < len(arguments):
            return arguments[index + 1]
        if argument.startswith("--source="):
            return argument.split("=", 1)[1]
    from_environment = os.environ.get("BODY_MODEL_SOURCE")
    if from_environment:
        return from_environment
    raise SystemExit("Pass --source <folder holding human_base_meshes_bundle.blend> or set BODY_MODEL_SOURCE.")


def open_bundle(folder):
    """Opens the bundle without its UI or its scripts. A downloaded .blend is untrusted, so the preference check
    is a second guard behind --disable-autoexec and use_scripts=False."""
    if bpy.context.preferences.filepaths.use_scripts_auto_execute:
        raise SystemExit("Auto Run Python Scripts is on. Run with --disable-autoexec so the bundle cannot run code.")
    path = os.path.join(folder, BUNDLE_FILE_NAME)
    if not os.path.isfile(path):
        raise SystemExit(f"{BUNDLE_FILE_NAME} not found in {folder}")
    bpy.ops.wm.open_mainfile(filepath=path, load_ui=False, use_scripts=False)
    return path
