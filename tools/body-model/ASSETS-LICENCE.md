# Licence of the committed derived files

The pictures in `renders/muscles/` (and the `dist/` folder, when the phone model is added to this package) are **adapted from Z-Anatomy and BodyParts3D**. They are licensed under **Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)**: https://creativecommons.org/licenses/by-sa/4.0/

Anyone who reuses or adapts them must keep this notice, give the credit below, say what they changed and share their adaptation under the same licence.

## Attribution

- BodyParts3D - The Database Center for Life Science - CC-BY-SA 2.1 Japan
- Z-Anatomy - The libre 3D atlas of anatomy - CC-BY-SA 4.0

## What was changed

The muscle meshes come from `Startup.blend` of Z-Anatomy, which is itself adapted from BodyParts3D. Ki-Lo changed them in these ways:

- The muscles were grouped into the 22 muscle ids of the app. Both sides of a muscle are one mesh.
- Sheets that hide the muscles under them (the external oblique and the latissimus dorsi) were trimmed away from the rectus abdominis and the erector spinae.
- Deep muscles, face muscles, tendon sheaths, bursae, fascia, ligaments and the skeleton were left out of the pictures. The muscles and bones that are not drawn were used only to build the skin.
- A see-through skin and a dark core were generated from the muscles and bones, because Z-Anatomy has no skin.
- A head and its two eyes from the Blender Studio Human Base Meshes (bundle v1.4.1, CC0 1.0) were grafted on at the neck. The Z-Anatomy face muscles are hidden. The CC0 material is in the public domain, and the combined work is CC BY-SA 4.0.
- Colours, lighting and the camera were added for the renders.

Some organs in the Z-Anatomy file carry non-commercial licences (the inner ear and the kidney). None of them is read, used or included.

## Other committed files

- `renders/bases/` holds pictures of the Blender Studio Human Base Meshes (bundle v1.4.1). They are CC0 1.0 (public domain) and are not part of the CC BY-SA work.
- `inspection/zanatomy-objects.json` lists the names, face counts and collections of the Z-Anatomy objects. It is adapted data from Z-Anatomy and is part of the licensed work, under CC BY-SA 4.0 with the attribution above.

## The code

This notice covers only the files named above. It does not set a licence for the scripts, data and tests in this package. The two source files are never committed. Their names and sha256 values are in `README.md`.
