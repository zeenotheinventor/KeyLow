# Licence of the phone model

`male.glb` is the male body of Ki-Lo, an adaptation of Z-Anatomy and BodyParts3D. It is licensed under **Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)**: https://creativecommons.org/licenses/by-sa/4.0/

Anyone who reuses or adapts it must keep this notice, give the credit below, say what they changed and share their adaptation under the same licence. The same notice is in the file itself, in the `asset.copyright` field.

## Attribution

- BodyParts3D - The Database Center for Life Science - CC-BY-SA 2.1 Japan
- Z-Anatomy - The libre 3D atlas of anatomy - CC-BY-SA 4.0

## Sources

- **Muscles:** Z-Anatomy, `Startup.blend` from `Z-Anatomy.zip` in https://github.com/Z-Anatomy/Models-of-human-anatomy at commit `22d77228e500b88a2e4802c1135e75c8834cdaaa`. Z-Anatomy is licensed CC BY-SA 4.0 and is built on BodyParts3D, licensed CC BY-SA 2.1 Japan. Only its muscle collection and its skeleton were read.
- **Head and eyes:** the Blender Studio Human Base Meshes, bundle v1.4.1 (`human-base-meshes-bundle-v1.4.1.zip`), from https://www.blender.org/download/demo-files/ . They are CC0 1.0 (public domain). CC0 material mixed into a CC BY-SA 4.0 work gives a combined work that is CC BY-SA 4.0.

## What was changed

- The muscles were grouped into the 22 muscle ids of the app. Both sides of a muscle are one mesh.
- Sheets that hide the muscles under them (the external oblique and the latissimus dorsi) were trimmed away from the rectus abdominis and the erector spinae.
- The superficial muscles that have no id were grouped into one mesh called `other`. The hand muscles, the foot muscles and the superficial masseter were left out of it.
- The deep muscles, the face muscles, the tendon sheaths, the bursae, the fascia, the ligaments and the skeleton are not in the file. They were used only to build the skin.
- A see-through skin and a dark core were generated from the muscles and bones, because Z-Anatomy has no skin.
- A head and its two eyes from the Blender Studio Human Base Meshes were grafted on at the neck. The Z-Anatomy face muscles are not in the file.
- Every mesh was reduced to far fewer triangles, moved to stand on the floor and face the front, given a plain material, and stored with 16 bit positions and 8 bit normals (`KHR_mesh_quantization`).

Some organs in the Z-Anatomy file carry non-commercial licences (the inner ear and the kidney). None of them is read, used or included.

## The code

This notice covers only the files in this folder. It does not set a licence for the scripts, data and tests that made them.
