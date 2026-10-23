# @keylow/body-model

Tools for the 3D body (KEY-342). Ki-Lo builds its own stylised male and female bodies from the Blender Studio Human Base Meshes, cuts them into one mesh per muscle, and shows them in the app. This package holds the first steps. It looks inside the bundle and renders the four base bodies so the base can be chosen before any muscle is cut. Later tickets add the cutting and the export to the same package.

It is a development tool. Nothing in `apps/*` or `packages/*` depends on it, CI never runs Blender, and the bundle is never committed.

## Source and licence

- **Blender Studio Human Base Meshes**, bundle v1.4.1, licence **CC0 1.0** (public domain, no attribution required).
- Download page: https://www.blender.org/download/demo-files/ (the file is `human-base-meshes-bundle-v1.4.1.zip`, 50.6 MB, served from https://mirror.blender.org/demo/asset-bundles/human-base-meshes/human-base-meshes-bundle-v1.4.1.zip).
- sha256 of the `.blend` as unpacked (49,420,489 bytes): `3c121505651140ceb4d69fd1d8923f7788ffadd81672f5be14845a5f2c75c137`
- sha256 of the zip as downloaded: `811f43accbb31a88266d932f8f5563b2d13586fca0ba2693aad1f5fe582b3515`

Unpack it anywhere outside the repository and check the hash before using it:

```sh
mkdir -p ~/body-model-source && unzip human-base-meshes-bundle-v1.4.1.zip -d ~/body-model-source
shasum -a 256 ~/body-model-source/human-base-meshes-bundle-v1.4.1/human_base_meshes_bundle.blend
```

`--source` takes the folder that holds `human_base_meshes_bundle.blend`. `BODY_MODEL_SOURCE` does the same when the flag is left out.

## Blender

Written and run against **Blender 5.2.3 LTS** on macOS (Homebrew, `/opt/homebrew/bin/blender`). Blender 4.2 or later should work, but only 5.2.3 has been run. `src/runBlender.ts` finds Blender in this order: the `BLENDER` environment variable, `/opt/homebrew/bin/blender`, then `blender` on the path. It runs `blender --background --factory-startup --disable-autoexec --python blender/<script>.py -- <arguments>` and passes Blender's exit code through, or exits 127 with a message when Blender is not installed. Because the bundle is a download, it is opened without its UI and without its scripts (`load_ui=False, use_scripts=False`), with `--disable-autoexec` on the command line, and the scripts refuse to open it at all if Blender's Auto Run Python Scripts preference is on.

## Commands

Run from the repository root. Blender is not needed for `lint`, `typecheck` or `test`.

```sh
pnpm --filter @keylow/body-model inspect --source <folder>   # prints the findings, writes inspection/bundle.json
pnpm --filter @keylow/body-model render --source <folder>    # writes the eight PNGs and the contact sheet
pnpm --filter @keylow/body-model lint
pnpm --filter @keylow/body-model typecheck
pnpm --filter @keylow/body-model test
```

There is no `build` script on purpose. The root turbo `build` task would run it in CI, where there is no Blender.

`render` takes about ten seconds on an Apple silicon Mac (EEVEE, headless). It writes to `renders/bases/`:

- `<style>-<sex>-front.png` and `<style>-<sex>-three-quarter.png` for `realistic` and `stylized` (the bundle's spelling) and `male` and `female`. Each is 800 by 1200 pixels, under 300 KB, and the script fails if one is not.
- `bases-compare.png`, the four front views side by side and labelled, at one scale.

Every body gets the same flat clay material, the same three area lights and the same orthographic camera at the same scale, so the pictures compare proportions and nothing else. The three-quarter view turns the camera 35 degrees toward the body's left. Face and hair detail, skin and clothing are deliberately absent.

## Findings

These come from `inspection/bundle.json` (Blender 5.2.3). The file also holds each body's attributes, silhouette widths and the full face set table. Run `inspect` again after any change to this section.

### What the bundle holds

- 407 objects and 8 body collections: for each of male and female, a **Realistic** body, a **Stylized** body, and two **Primitive** blockouts (one realistic, one stylised), each made of about a hundred small separate objects. Only the four finished bodies are inspected here.
- Each finished body is **one mesh object** named `GEO-body_<sex>_<style>`, with two child objects for the eyes (`.eye.L`, `.eye.R`). A camera named after the body (`realistic_body_male`, `stylized_body_female` and so on, with the bundle's own typo `realistic_body_emale` for the realistic female) is also parented to it. Those cameras are thumbnail cameras and are not part of the body.
- Standalone heads, hands, feet, jaws, eyes and skulls (`Head - Stylized`, `Hand - Realistic` and so on) are separate sculpting assets in the same file. The bodies do **not** use them.
- No hair, no teeth, no tongue, no eyelashes, no clothing. No armature and no materials in the file, and no shape keys on the four bodies (one head asset has some), so the bodies are unrigged and unshaded.
- Scene units are metric with scale 1.0. Every body is `rotation 0, scale 1`, laid out in a row along X (the realistic male is at X -2.26, the stylised female at X +0.64), so apply a translation, not a rotation or scale, to bring a body to the origin. The object origin sits on the floor between the feet.

### The four bodies

|                                 | Realistic male            | Realistic female            | Stylised male            | Stylised female            |
| ------------------------------- | ------------------------- | --------------------------- | ------------------------ | -------------------------- |
| Object                          | `GEO-body_male_realistic` | `GEO-body_female_realistic` | `GEO-body_male_stylized` | `GEO-body_female_stylized` |
| Mesh data name                  | `female_v006lowresUV`     | `GEO-body_female_realistic` | `GEO-body_male_stylized` | `GEO-body_female_stylized` |
| Base mesh vertices              | 10,582                    | 10,582                      | 12,502                   | 12,502                     |
| Base mesh faces (quads)         | 10,590                    | 10,590                      | 12,500                   | 12,500                     |
| Base mesh triangles             | 21,160                    | 21,160                      | 25,000                   | 25,000                     |
| Modifiers                       | Multires, 3 levels        | Multires, 3 levels          | none                     | none                       |
| Faces at the top Multires level | 677,440                   | 677,440                     | not applicable           | not applicable             |
| Mirror modifier                 | none                      | none                        | none                     | none                       |
| Sculpt face sets                | 102                       | 102                         | 42                       | 42                         |
| Vertex groups                   | none                      | none                        | none                     | none                       |
| UV layers                       | `UVMap`                   | `UVMap`                     | `UVMap`                  | `UVMap`                    |
| Width, depth, height (m)        | 0.883, 0.292, 1.690       | 0.842, 0.284, 1.640         | 0.879, 0.308, 1.798      | 0.721, 0.273, 1.617        |

- **No mirror modifier on any body.** Both halves are real geometry, so a muscle cut can be made on the left side and checked against the right without applying anything.
- **The realistic bodies carry their detail in Multires.** The base mesh has 10,590 faces and the displacement is stored in three levels above it. A cut made on the base mesh keeps the high-resolution detail only if the Multires is applied or baked afterwards. The mesh data name `female_v006lowresUV` on the male is the bundle's own and is misleading. The male and female realistic meshes have identical topology (same vertex and face counts).
- **The stylised bodies have no modifiers** and the bundle has stale drivers on them that point at `mask_legs` and `mask_arms` modifiers that do not exist. Blender prints "Invalid driver" warnings on load. They are harmless.
- **Up is Z, the body faces -Y** (Blender's front view looks along +Y, so it sees the front). The body's left is +X. Units are metres.
- **Pose: a relaxed A-pose in all four.** The arms hang about 14 to 23 degrees away from the body (fitted arm angle below horizontal: 70 degrees realistic male, 67 realistic female, 76 stylised male, 73 stylised female), feet slightly apart. It is not a T-pose and not a neutral pose with the arms at the sides, and the span between the hands (about 0.88 m for the male bodies) comes from the arms hanging out. The render camera and the region cuts must allow for hands that are 0.2 m or more clear of the hips.
- **Head, hands and feet are in the body object.** The same mesh holds the head with ears, nose, mouth and eye sockets (the eyeballs are the two child objects), both hands with five separate fingers, and both feet with five separate toes. The stylised bodies have a large head, hands and feet, and the realistic bodies have adult proportions, head about 1 in 7.3 of the height on the male and 1 in 7.1 on the female (1 in 5.4 on the stylised male and 1 in 5.8 on the stylised female, measured from the top of the head to the chin and written to `inspection/bundle.json`). The male bodies include anatomical groin geometry and the realistic female has breasts, so the app will need a decision on how the base is covered before it is shown to users.
- **Face sets are body parts, not muscles, and have no names.** They are an integer face attribute (`.sculpt_face_set`), shown in sculpt mode as colours.
  - Realistic: 102 sets. 95 sit on one side and 92 of those have a mirrored partner of the same size, so left and right are separate sets. 7 span both sides: the head and neck (about 2,025 faces), the torso (about 705) and five more midline pieces in the neck and trunk (100 to 494 faces). Fingers and toes are cut into many small sets (77 of the 102 have 78 faces or fewer, down to 4).
  - Stylised: 42 sets. Every one spans both sides, so each set is a segment of both arms or both legs together (for example 1,680 faces for both lower legs), plus the head, torso and pelvis. The stylised sets are coarser than the muscle list and are not split left from right.
  - Neither set family follows the 22 muscle ids. They are a starting point for the cuts, not a replacement for them.

### Recommendation

The realistic male is the recommended base: on the contact sheet its adult proportions (a head about 1 in 7.3 of the height, long limbs, a defined shoulder, chest and abdomen) read as real anatomy, which is what a muscle map needs. The stylised pair has a head about 1 in 5.4 of the height and thick, soft limbs, so its muscle regions would be coarse and look cartoonish beside the app's data. This does not decide anything: Zee decides at the approval ticket.

## Mesh naming contract

The tools that follow this one produce a body in which **every mesh is named by a muscle id**, and nothing else is named:

- One mesh per id of `MUSCLE_IDS` in [`packages/core/src/training/muscles.ts`](../../packages/core/src/training/muscles.ts), 22 in all: `chest_upper`, `chest_lower`, `delt_front`, `delt_side`, `delt_rear`, `lats`, `traps_upper`, `traps_mid`, `lower_back`, `biceps`, `triceps`, `forearms`, `abs`, `obliques`, `glute_max`, `glute_med`, `quads`, `hamstrings`, `adductors`, `calves`, `tibialis`, `neck`.
- One mesh named `body` for everything no muscle covers: head, hands, feet and joints.
- A muscle id names **both sides** of the body. The left and right of one muscle are one mesh, because the ids carry no side.
- Adding or splitting an id is a new muscle list version (ADR 0005), so this list changes only with it.

## Notes

- Blender writes nothing into the repository. The scripts write only `inspection/bundle.json` and `renders/bases/`, and the package `.gitignore` keeps Python bytecode and any `.blend`, `.blend1` and `.blend@` file out.
- PNG text stamps (the `.blend` path, date and render time Blender adds by default) are off on purpose, so no local path reaches the public repository. A test fails if a committed render holds a text chunk or `/Users/`.
- The Blender steps are not part of `pnpm check`. `lint`, `typecheck` and `test` are, and the one test covers how the Blender command line is built.
- `inspection/` is excluded from Prettier in the root `.prettierignore` because it is written exactly as the script builds it.
