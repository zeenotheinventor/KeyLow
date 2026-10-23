# @keylow/body-model

Tools for the 3D body (KEY-342). They build the male body that the app will show in 3D: the real muscles from **Z-Anatomy**, grouped into the 22 muscle ids, seen through a see-through skin and a dark core that are generated here, with a CC0 realistic male head ("head A") grafted at the neck and drawn in neutral clay. The result is rendered to `renders/muscles/`, which are the pictures the 3D tickets are built to match. The same scratch files are decimated to phone size and exported to `dist/male.glb` (KEY-556), with its licence notice beside it and two pictures of it in `renders/muscles/`.

It is a development tool. Nothing in `apps/*` or `packages/*` depends on it, CI never runs Blender, and neither source file is ever committed. The committed pictures are CC BY-SA 4.0, see `ASSETS-LICENCE.md`.

## Source and licence

Two sources, both outside the repository. Check each hash before use.

**Z-Anatomy** (the muscles, CC BY-SA 4.0 on BodyParts3D, which is CC BY-SA 2.1 Japan). The licence text is at https://creativecommons.org/licenses/by-sa/4.0/

- "Z-Anatomy, the libre 3D atlas of anatomy", `Startup.blend` from `Z-Anatomy.zip` in https://github.com/Z-Anatomy/Models-of-human-anatomy at commit `22d77228e500b88a2e4802c1135e75c8834cdaaa`.
- sha256 of the zip: `e029688545627bd0214b269e1063143abb580aad72b2c2445d6d8a9a0d9da736`
- sha256 of `Startup.blend` as unpacked (306 MB): `9f08a17ea0115fed80b2a73ecdf0a1bc2ab2f6956f37c593ce23d513ea35afcd`
- Anything derived from the meshes carries the licence and the two attribution lines below, word for word:
  - BodyParts3D - The Database Center for Life Science - CC-BY-SA 2.1 Japan
  - Z-Anatomy - The libre 3D atlas of anatomy - CC-BY-SA 4.0
- Some organs in the file carry non-commercial licences (the inner ear and the kidney). The scripts read **only** the muscle collection (`4: Muscular system`) and the skeleton (`1: Skeletal system`, used to build the skin and never drawn), and the scratch files they write hold nothing else.
- **The file embeds a Python script (`z-anatomy.py`). It is never run.** Only `zanatomy:muscles` and `zanatomy_inspect.py` open the file. They open it with `--disable-autoexec` and `use_scripts=False`, stop before opening it if Auto Run Python Scripts is on, check its sha256 first and stop if it differs, and `zanatomy:muscles` removes the script text from the scratch `.blend` it saves.

**Blender Studio Human Base Meshes** (head A, CC0 1.0, public domain, no attribution required)

- Bundle v1.4.1. Download page: https://www.blender.org/download/demo-files/ (the file is `human-base-meshes-bundle-v1.4.1.zip`, 50.6 MB, served from https://mirror.blender.org/demo/asset-bundles/human-base-meshes/human-base-meshes-bundle-v1.4.1.zip).
- sha256 of the `.blend` as unpacked (49,420,489 bytes): `3c121505651140ceb4d69fd1d8923f7788ffadd81672f5be14845a5f2c75c137`
- sha256 of the zip as downloaded: `811f43accbb31a88266d932f8f5563b2d13586fca0ba2693aad1f5fe582b3515`

The head is CC0 material combined with a CC BY-SA 4.0 asset, so **the combined pictures (and any `.glb` made from them) are CC BY-SA 4.0** and carry both attribution lines. This notice does not cover the code in this package.

Unpack both anywhere outside the repository and check the hashes:

```sh
mkdir -p ~/body-model-source && unzip human-base-meshes-bundle-v1.4.1.zip -d ~/body-model-source
shasum -a 256 ~/body-model-source/human-base-meshes-bundle-v1.4.1/human_base_meshes_bundle.blend
shasum -a 256 <folder holding Startup.blend>/Startup.blend
```

`--source` takes the folder that holds the file. For the bundle, `BODY_MODEL_SOURCE` does the same when the flag is left out (and is the default for `--head-source`). For Z-Anatomy, `ZANATOMY_SOURCE` does.

## Blender

Written and run against **Blender 5.2.3 LTS** on macOS (Homebrew, `/opt/homebrew/bin/blender`). Blender 4.2 or later should work, but only 5.2.3 has been run. `src/runBlender.ts` finds Blender in this order: the `BLENDER` environment variable, `/opt/homebrew/bin/blender`, then `blender` on the path. It runs `blender --background --factory-startup --disable-autoexec --python blender/<script>.py -- <arguments>` and passes Blender's exit code through, or exits 127 with a message when Blender is not installed. Both sources are downloads. Every `.blend` the scripts open is opened without its UI and without its scripts (`load_ui=False, use_scripts=False`), with `--disable-autoexec` on the command line. The steps that open a downloaded file as a whole (`zanatomy:muscles`, `inspect`, `render` and `zanatomy_inspect.py`) also refuse to run if Blender's Auto Run Python Scripts preference is on, and `zanatomy:head` only reads meshes out of the bundle.

## Commands

Run from the repository root, in this order. Blender is not needed for `lint`, `typecheck` or `test`. `WORK` is a scratch folder that holds the `.blend` files the steps pass on (70 to 80 MB each, never committed). All four steps refuse a `--work` folder inside the repository, links followed.

```sh
pnpm --filter @keylow/body-model zanatomy:muscles --source <folder holding Startup.blend> --work $WORK --names inspection/zanatomy-objects.json
pnpm --filter @keylow/body-model zanatomy:skin --work $WORK
pnpm --filter @keylow/body-model zanatomy:head --work $WORK --head-source <folder holding human_base_meshes_bundle.blend>
pnpm --filter @keylow/body-model zanatomy:render --work $WORK [--set debug|heat|closeup|all] [--view front|back|three-quarter|three-quarter-back]
pnpm --filter @keylow/body-model export --work $WORK
pnpm --filter @keylow/body-model zanatomy:phone-render
pnpm --filter @keylow/body-model lint
pnpm --filter @keylow/body-model typecheck
pnpm --filter @keylow/body-model test
```

- `zanatomy:muscles` groups the muscles into the 22 ids and takes about two minutes (the trims are slow Python loops). `--names` rewrites `inspection/zanatomy-objects.json`.
- `zanatomy:skin` builds the skin and the core, about ten seconds.
- `zanatomy:head` grafts head A on.
- `zanatomy:render` writes the seven pictures in `renders/muscles/`, about half a minute.
- `export` decimates the body and writes `dist/male.glb`, 10 to 25 seconds (see The phone file). It prints the triangles per mesh, the skin check and the sha256 of the file.
- `zanatomy:phone-render` imports `dist/male.glb` into a fresh scene and writes the two pictures `male-phone-front.png` and `male-phone-three-quarter.png` in `renders/muscles/`. It needs no `--work`.
- Two more steps are optional. `pnpm --filter @keylow/body-model inspect --source <bundle folder>` writes `inspection/bundle.json` and `pnpm --filter @keylow/body-model render --source <bundle folder>` writes the nine pictures in `renders/bases/`. `node --experimental-strip-types src/run.ts zanatomy_inspect --source <folder> --out <json>` lists every Z-Anatomy muscle and bone object with its face count, bounds and collections.

There is no `build` script on purpose. The root turbo `build` task would run it in CI, where there is no Blender.

## The Blender Studio bundle (head A's source)

The muscle pictures use only the realistic male's head and eyes from this bundle. `inspect_bundle.py` and `render_bases.py` look inside it and render the four base bodies. These findings come from `inspection/bundle.json` (Blender 5.2.3). The file also holds each body's attributes, silhouette widths and the full face set table. Run `inspect` again after any change to this section.

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
- **Pose: a relaxed A-pose in all four.** The arms hang about 14 to 23 degrees away from the body (fitted arm angle below horizontal: 70 degrees realistic male, 67 realistic female, 76 stylised male, 73 stylised female), feet slightly apart. It is not a T-pose and not a neutral pose with the arms at the sides, and the span between the hands (about 0.88 m for the male bodies) comes from the arms hanging out.
- **Head, hands and feet are in the body object.** The same mesh holds the head with ears, nose, mouth and eye sockets (the eyeballs are the two child objects), both hands with five separate fingers, and both feet with five separate toes. The stylised bodies have a large head, hands and feet, and the realistic bodies have adult proportions, head about 1 in 7.3 of the height on the male and 1 in 7.1 on the female (1 in 5.4 on the stylised male and 1 in 5.8 on the stylised female, measured from the top of the head to the chin and written to `inspection/bundle.json`). The male bodies include anatomical groin geometry and the realistic female has breasts, so the app will need a decision on how the base is covered before it is shown to users.
- **Face sets are body parts, not muscles, and have no names.** They are an integer face attribute (`.sculpt_face_set`), shown in sculpt mode as colours.
  - Realistic: 102 sets. 95 sit on one side and 92 of those have a mirrored partner of the same size, so left and right are separate sets. 7 span both sides: the head and neck (about 2,025 faces), the torso (about 705) and five more midline pieces in the neck and trunk (100 to 494 faces). Fingers and toes are cut into many small sets (77 of the 102 have 78 faces or fewer, down to 4).
  - Stylised: 42 sets. Every one spans both sides, so each set is a segment of both arms or both legs together (for example 1,680 faces for both lower legs), plus the head, torso and pelvis. The stylised sets are coarser than the muscle list and are not split left from right.
  - Neither set family follows the 22 muscle ids. They are a starting point for the cuts, not a replacement for them.

## Z-Anatomy male (the muscle spike)

The pipeline in the four `zanatomy:*` steps above, and what it reads, builds and draws.

### The mapping data

`muscles/male/zanatomy-map.json` holds the whole mapping as data, so a different atlas or a changed idea of a muscle is an edit to the file and not to the scripts. Patterns are regular expressions that must match the whole object name. An object is sorted in this order:

1. **exclude**: the collections `Bursae`, `Tendon sheaths` and `Fascia`, the leader lines and label points (`.j` and `.g`), the iliotibial tract, the scalp aponeurosis, retinacula, ligaments and the plantar aponeurosis. These are not muscles and are never drawn or used for the skin.
2. **ids**: the first of the 22 ids with a matching pattern. No object may match two (a test checks it).
3. **head**: muscles in the collections `Head`, `Muscles of head` and `Facial muscles` with no id. They are never drawn (the face is the grafted CC0 head), but they stay part of the body the skin is built from.
4. **hidden**: muscles no one can see through the skin (platysma and the temporalis sheet, which would hide the neck and the temple).
5. **neutral**: superficial muscles with no id (the `Superficial muscles` collection, hand and foot muscles, serratus anterior, the rotator cuff muscles at the back, sartorius and a few more), drawn in one neutral colour.
6. everything else is **deep**: not drawn, but still part of the body the skin is built from.

`trim` removes the faces of one id that lie within a distance of another id's surface. Z-Anatomy models the external oblique aponeurosis and the latissimus dorsi as sheets lying over the rectus abdominis and the erector spinae, and they hide those muscles completely from outside. Trimming 1 cm (obliques from abs) and 1.2 cm (lats from lower back) shows them. This is a judgement for the picture, not anatomy, and it is the one place the data is edited.

`inspection/zanatomy-objects.json` is the list of all 789 muscle-collection objects (name, faces, collections) so the Vitest test can check the mapping without Blender.

### What the data holds (what blocks and what does not)

- **`.j` and `.g` objects are not geometry.** The 105 `.j` objects (and the one `.g`) have zero faces and two vertices: they are the leader lines of the atlas labels. Nothing is double drawn, and no whole-structure parent exists in the muscle collection. The `.l` and `.r` suffixes are the side, one object per side.
- **Four objects have no side suffix**: `Iliocostalis colli muscle` (the left one, its partner ends in `.r`), `Transverse arytenoid muscle`, `Diaphragm` and `Linea alba`. None is mapped to an id. `Linea alba` is drawn neutral.
- **The trapezius parts are named the wrong way round.** The file's `Ascending part` is the upper fibres at the neck and its `Descending part` is the lower fibres between the shoulder blades. The mapping follows the position and not the name: `traps_upper` takes the Ascending part, `traps_mid` takes the Descending part, the Transverse part and the rhomboids. The brief's draft had them the other way and the first render showed it.
- **The external oblique and the lats are sheets over other muscles** (see the trims). Without them the abs and the lower back would be invisible from outside.
- **Gaps in the rectus abdominis.** The mesh has holes at the tendinous inscriptions, so the abs show dark notches. They read as the abs' segments, but they are holes.
- **Intersections.** Neighbouring muscles overlap by a millimetre or two (the quadriceps heads, the three deltoid parts), so borders show small interpenetrations in a close-up. They are in the source.
- **No eyes, no face skin, no ears, no hair in the source.** The first renders showed a skull-like head: facial muscles seen through a bald bubble. The head is now the CC0 head grafted on (see The head).
- **One stray bone** (450 faces) sits about a metre to the side of the body in the skeleton collection. The skeleton step drops bones whose centre is further than 0.4 m sideways or 0.2 m front to back (`skeleton` in the data).
- **Other "other" muscles are not placed under the 22 ids on purpose**: the rotator cuff, serratus anterior, sartorius and the tensor fasciae latae are visible on a body but have no id in the muscle list (ADR 0005), so they are neutral.
- Face counts are polygons of the base meshes. The muscles are almost all triangles already (see the table). Z-Anatomy puts subdivision modifiers on a few bones and ligaments, which are ignored.

### Faces per id

The 23 drawn groups after the trims (the hidden deep muscles, the skeleton and the excluded objects are not drawn):

| Group                   |       Faces |   Triangles |
| ----------------------- | ----------: | ----------: |
| `chest_upper`           |       1,700 |       1,700 |
| `chest_lower`           |       9,450 |       9,460 |
| `delt_front`            |       5,804 |       5,804 |
| `delt_side`             |       5,928 |       5,928 |
| `delt_rear`             |       8,756 |       8,756 |
| `lats`                  |      24,564 |      24,564 |
| `traps_upper`           |       9,192 |       9,192 |
| `traps_mid`             |      32,092 |      32,092 |
| `lower_back`            |      61,988 |      61,988 |
| `biceps`                |      18,784 |      18,784 |
| `triceps`               |      23,412 |      23,412 |
| `forearms`              |     144,430 |     144,436 |
| `abs`                   |      43,432 |      43,432 |
| `obliques`              |      24,384 |      24,384 |
| `glute_max`             |       6,652 |       6,652 |
| `glute_med`             |      22,852 |      22,852 |
| `quads`                 |      60,512 |      60,512 |
| `hamstrings`            |      42,984 |      42,984 |
| `adductors`             |      43,500 |      43,500 |
| `calves`                |      36,288 |      36,288 |
| `tibialis`              |       7,052 |       7,052 |
| `neck`                  |      38,636 |      38,636 |
| other muscles (neutral) |     182,186 |     182,276 |
| **Drawn total**         | **854,578** | **854,684** |

Not drawn: 776,983 faces of deep muscles, 125,928 of face and head muscles (the `head` group, 76 objects), 577,420 of skeleton, 234,800 excluded. The source's muscle collection is 2,045,745 faces. Each id has objects and the run stops if one does not. The run prints the list of muscle objects that mapped to nothing (the deep ones, about 166 objects, and the 76 head objects) so the unmapped set can be read at a glance.

### The skin

Z-Anatomy has no skin (its `Integument` collection is empty), so `zanatomy_skin.py` builds a shell from the body:

1. join every muscle and bone (deep ones too) and voxel-remesh the union at 5 mm, which gives one closed envelope of the whole body, head, hands and feet included.
2. the **core** is that envelope pulled in 4 mm. It is a dark fill under the muscles so the gaps between them read as flesh and not as holes.
3. the **skin** is the envelope pushed out 10 mm, closed again with an 8 mm remesh and smoothed 40 times, so it reads as one smooth outline and not as lumpy muscle.

The run checks the result: 14 of 428,643 drawn muscle vertices (0.00 percent) end up outside the skin. The skin material is a faint see-through shell (alpha 0.05 face on, 0.5 at the edge, from a fresnel weight), so the silhouette reads and the coloured muscles show clearly. The skeleton is hidden. It is only used to build the shell, and drawn faint it would add clutter in front of the deep gaps. The CC0 fallback was not needed.

### The renders

EEVEE, one orthographic camera, the same for every view, 760 by 1160 pixels, each under 400 KB, no PNG text chunk and no local path (a test checks both).

- `male-debug-{front,back,three-quarter,three-quarter-back}.png`: one high-contrast colour per id with a legend, `other` muscles in grey, on a dark background.
- `male-heat-{front,back}.png`: the v3 heat colours read from `packages/tokens/src/source/training.css` (dark values) on the dark surface colour, for a push day: chest (both ids) peak, `delt_front` very hot, `triceps` hot, `delt_side` warm, `abs` ready, every other id rested, other muscles in the body silhouette colour.
- `male-heat-torso-three-quarter.png`: a close-up of the torso and head at 620 by 900 pixels.

### The head

The first renders showed a skull-like head: the face and head muscles seen through the see-through skin of a bald bubble. The chosen head, called head A, is a real face, so every muscle in the `head` group is hidden and the head is the CC0 realistic male's, drawn nearly opaque in clay. Everything below the neck is the generated body.

`zanatomy_head.py` takes the head and upper neck of `GEO-body_male_realistic` and its two eyes from the CC0 Human Base Meshes bundle (see Source and licence at the top), at Multires level 2, cut at z 1.415 m with the shoulder slope dropped. It scales it by 0.92 about the eyes (the Z-Anatomy head is smaller than the bundle's) and puts the eyes at the Z-Anatomy eye height. It then puts the lowest neck ring on the skin's ring at that height and widens the lower neck to the skin's width with a smooth falloff up to 1.52 m, so the seam does not step. The skin and the core stop at 1.492 m, so the generated head bubble is gone, and every drawn muscle loses its faces above 1.497 m, so nothing sticks out of the face. The render draws the head in lit clay (`#b3a79b`) that fades in over the neck between 1.445 and 1.492 m (the material reads the world height), so it dissolves into the faint skin. The bundle's eyes have no material, so the render gives them a white, a grey iris and a pupil, found from the direction out of the eye. There is no hair, no beard, no eyelashes and no teeth.

**Licence of the head.** The bundle is CC0 (public domain), so it may be mixed freely. But **the grafted head is CC0 material combined with the CC BY-SA 4.0 Z-Anatomy asset, so the combined asset (the renders and any `.glb` made from them) is CC BY-SA 4.0** and carries the two attribution lines above. The bundle's sha256 values are in Source and licence above. `ASSETS-LICENCE.md` is the notice for the committed pictures.

Looked at in the renders: the head reads as a calm clay mannequin head with eyes, neither skull nor caricature. The seam is a soft fade at the base of the neck. Two small dark neck muscle tips (the sternocleidomastoid and the splenius) show at the sides of the neck where the clay fades, and in the back view the top of the spine muscles shows as a dark blot at the nape. The scale and cut heights are constants at the top of `zanatomy_head.py`.

### The phone file

`pnpm --filter @keylow/body-model export --work $WORK` runs `blender/zanatomy_export.py` and then `src/exportMale.ts`. The first reads `zanatomy-body-head.blend`, decimates every mesh to the `budget` block of `muscles/male/zanatomy-map.json` and writes `male-raw.glb` in `$WORK`. The second quantises that file into `dist/male.glb`, because Blender's glTF exporter has no quantisation of its own (its Draco and meshopt options need a decoder the app does not have, and its gltfpack option needs an outside program). The quantiser is `src/quantiseGlb.ts`, with no dependency.

**What it does.** The muscles of `other` that are hand, foot or the superficial masseter are dropped (`phoneDropFromOther` in the map data, flagged on the faces by `zanatomy:muscles`, so run that step again after changing the list). Each mesh is triangulated and collapsed with Blender's Decimate modifier, with no border pinned, until it is within 3 percent of its budget. The ids share `idsTriangles` in proportion to the square root of their source triangles, so the heaviest are cut hardest, and an id in `idFloors` has its own higher minimum (`abs`). Then each mesh is rebuilt as plain triangles with smooth normals (no UVs, no masks, no custom normals), moved so the feet are on y = 0 and the skin is centred on x and z, and the skin check is run again on the decimated meshes. Building a mesh validates it, which drops degenerate triangles (44 of them in the committed file), so every count and every check below is taken after validation, and the export prints how many were dropped. The export stops if the total is over 250,000, an id is under 1,000, the skin is outside 10,000 to 15,000, the head and eyes together are over 15,000 (the eyes are not decimated), or more than 0.1 percent of the drawn muscle vertices are outside the skin.

**The file contract.** `src/maleExport.ts` holds the copyright text and `src/verifyGlb.ts` checks a file against this table. It returns a list of problems that is empty when the file is good, and its limits are named constants at the top of the file (`MAXIMUM_FILE_BYTES`, `MAXIMUM_BODY_TRIANGLES` and the others). `test/committedAssets.test.ts` runs it over every `.glb` in `dist/`, so CI fails when a committed file breaks the contract. The names come from `src/meshNames.ts` (`BODY_MESH_NAMES`, the ids of `MUSCLE_IDS` from `@keylow/core/training` and then the five meshes with no id), which the package exports as `@keylow/body-model/meshNames`, so the renderer reads the same list. `test/maleGlb.test.ts` keeps the checks that are about the numbers inside the file (the decoded positions and normals, the skin and head budgets, the vertex colours on the eyes, the generator and the sources in `LICENCE.md`).

**Checking a glb by hand.** `pnpm --filter @keylow/body-model verify dist/male.glb` prints `<file>: ok` or one line per problem and exits 1 when there is any. It also reads the `LICENCE.md` in the same folder. A problem names the mesh or the value (`` `lats` is missing ``, `` `biceps` appears twice ``, `` `forearms` has 640 triangles, the floor is 1,000 ``) and never prints vertex data. To see it fail, copy `dist/` to a scratch folder, delete the `LICENCE.md` or edit a mesh name in the JSON chunk, and verify the copy.

| Part       | Contract                                                                                                                                                                                                                            |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Axes       | Y up, metres, feet on y = 0, the skin centred on x and z, facing +z                                                                                                                                                                 |
| Nodes      | 27, named exactly as in the mesh naming contract below, once each, in the order of `MUSCLE_IDS` and then `other`, `skin`, `core`, `head`, `eyes`. One mesh and one primitive per node                                               |
| Materials  | One per mesh, named `mat_<name>`, plain colour, no textures. `mat_skin` is `BLEND` with alpha 0.12 and single sided, the rest are opaque. The app sets its own materials by mesh name                                               |
| Colours    | Vertex colours (`COLOR_0`) on `eyes` only, for the white, iris and pupil, found from the direction out of each eye. Every other mesh has none                                                                                       |
| Attributes | `POSITION` and `NORMAL` only (and `COLOR_0` on `eyes`). Smooth normals                                                                                                                                                              |
| Encoding   | `KHR_mesh_quantization`, used and required, and no other extension. Positions are normalised 16 bit integers (about 0.03 mm) with a uniform scale and a translation on the node, normals are normalised bytes. No Draco, no meshopt |
| Not in it  | Cameras, lights, animation, skins, textures, images                                                                                                                                                                                 |
| Asset      | `generator` is `Ki-Lo body-model zanatomy_export`. `copyright` is `CC BY-SA 4.0` and both attribution lines. No dates, no paths                                                                                                     |

**Numbers** (Blender 5.2.3 LTS, hash e13b728c6880, on macOS):

- Size 2,623,436 bytes (2.50 MiB), 27 draw calls, 214,105 triangles (counted after validation), export 4 to 25 seconds depending on the load of the machine. The raw file before quantising is 3.8 MB.
- Skin check on the decimated meshes: 6 of 85,091 drawn muscle vertices outside the skin (0.007 percent, the limit is 0.1).

| Mesh          | Triangles |
| ------------- | --------: |
| `chest_upper` |     1,684 |
| `chest_lower` |     3,972 |
| `delt_front`  |     3,112 |
| `delt_side`   |     3,144 |
| `delt_rear`   |     3,822 |
| `lats`        |     6,402 |
| `traps_upper` |     3,216 |
| `traps_mid`   |     7,318 |
| `lower_back`  |    10,168 |
| `biceps`      |     5,598 |
| `triceps`     |     6,248 |
| `forearms`    |    15,518 |
| `abs`         |    16,000 |
| `obliques`    |     6,378 |
| `glute_max`   |     3,332 |
| `glute_med`   |     6,172 |
| `quads`       |    10,048 |
| `hamstrings`  |     8,466 |
| `adductors`   |     8,520 |
| `calves`      |     7,776 |
| `tibialis`    |     3,430 |
| `neck`        |     7,134 |
| `other`       |    19,998 |
| `skin`        |    12,000 |
| `core`        |    19,973 |
| `head`        |    12,500 |
| `eyes`        |     2,176 |
| **Total**     |   214,105 |

**Repeatable.** Two runs give the same bytes: the order of the nodes is fixed, the exporter options are fixed, Blender's decimation gives the same result for the same input, and the quantiser writes the JSON in a fixed order with a fixed generator string and no dates. The committed file was made by Blender 5.2.3 LTS (hash e13b728c6880) from scratch files made by `zanatomy:muscles`, `zanatomy:skin` and `zanatomy:head` of this same commit. A different Blender version, or a different CPU architecture (the committed file was made on Apple silicon), may decimate differently and give different bytes, so compare the sha256 of a re-export only on the same machine and Blender version.

**What the phone file loses against the full renders** (`male-phone-front.png` against `male-heat-front.png`, `male-phone-three-quarter.png` against the debug three-quarter picture):

- The abs keep their notches and read as in the full picture, but the fine fibre relief on them is gone. This took some finding. With `core` at 6,000 triangles the abs looked like ragged islands, and the cause was not the abs: the core is a dark shell only 4 mm under the muscles, a coarse decimation of it moves it by more than that, and it poked through the abs and the kneecaps. Raising the abs to 28,000 or even to their full 43,432 triangles changed nothing, pinning the abs boundary is moot (the abs mesh is closed, it has no boundary edges), and `core` at 10,000 was better but not enough. `core` at 20,000 matches the full picture. Cheapest way to save those triangles again: move the decimated core in along its normals by a few millimetres, which costs no triangles.
- The fibre texture and fine relief on the legs, forearms and back are gone, so those muscles are smoother and flatter. Cheapest fix: raise `idsTriangles` (the total has about 36,000 triangles of room under the cap).
- The hands and feet are the skin alone, because their muscles are dropped, so the fingers and toes are fused and webbed and the knuckles are soft. Cheapest fix: raise `skin` towards 15,000, or keep a few hand muscles in `other`.
- The eyes keep their white, iris and pupil but the iris edge is a soft blend, because the colours are per vertex. Cheapest fix: duplicate the vertices along the iris ring so the colour edge is hard, or add a small texture.
- The head is the bundle's head cut from 117,000 to 12,500 triangles, so the ears and the lips are slightly softer. Cheapest fix: raise `head` (the head and eyes together may use 15,000).

## Mesh naming contract

`dist/male.glb` is a body in which **every mesh is named, and the names are these**:

- One mesh per id of `MUSCLE_IDS` in [`packages/core/src/training/muscles.ts`](../../packages/core/src/training/muscles.ts), 22 in all: `chest_upper`, `chest_lower`, `delt_front`, `delt_side`, `delt_rear`, `lats`, `traps_upper`, `traps_mid`, `lower_back`, `biceps`, `triceps`, `forearms`, `abs`, `obliques`, `glute_max`, `glute_med`, `quads`, `hamstrings`, `adductors`, `calves`, `tibialis`, `neck`. A muscle id names **both sides** of the body, so left and right are one mesh.
- `other`: the superficial muscles that have no id, drawn in one neutral colour.
- `skin`: the generated see-through shell.
- `core`: the dark fill under the muscles.
- `head`: head A, the grafted CC0 head and upper neck.
- `eyes`: the two eyes of head A.
- Nothing else is exported. The deep muscles, the head muscles and the skeleton build the skin and are never exported.
- Adding or splitting an id is a new muscle list version (ADR 0005), so the list of ids changes only with it.

The scratch files written by the steps above name their objects `muscle_<id>`, `muscle_other`, `muscle_head`, `muscle_deep`, `skeleton`, `skin` and `core`, plus the head and eyes. They are working names and are not this contract.

## Notes

- Blender writes nothing into the repository except the files named here. The scripts write only `inspection/bundle.json`, `inspection/zanatomy-objects.json`, `renders/bases/`, `renders/muscles/` and (through `export`) `dist/male.glb`, and the package `.gitignore` keeps Python bytecode and any `.blend`, `.blend1` and `.blend@` file out.
- PNG text stamps (the `.blend` path, date and render time Blender adds by default) are off on purpose, so no local path reaches the public repository. A test fails if a committed render holds a text chunk or `/Users/`.
- The Blender steps are not part of `pnpm check`. `lint`, `typecheck` and `test` are, and the tests cover how the Blender command line is built, the package scripts, the Z-Anatomy mapping data (every id has objects and no object matches two ids), the budget and the drop list, the quantiser, `verifyGlb` with glbs built in memory, the committed `dist/male.glb` against the file contract and that no committed render holds metadata.
- `inspection/` is excluded from Prettier in the root `.prettierignore` because it is written exactly as the script builds it.
