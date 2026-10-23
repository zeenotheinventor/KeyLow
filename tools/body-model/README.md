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
pnpm --filter @keylow/body-model regions --source <folder>   # assigns the trunk regions, prints the coverage, writes the two renders
pnpm --filter @keylow/body-model assign --source <folder>    # the assignment and the report alone, no renders
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

## Muscle regions

The 22 muscle ids are aesthetic regions, not anatomical muscles. They are cut on the surface of one base body, the realistic male (`GEO-body_male_realistic`), by rules held as data in `regions/male/`. `blender/regions.py` is the engine (pure Python, no Blender import, so the Vitest tests run it), `blender/assign_regions.py` applies it to the body and `blender/render_regions.py` draws the result.

```sh
pnpm --filter @keylow/body-model regions --source <folder> [--scratch <folder>]
```

runs headless in about fifteen seconds, prints the coverage report and writes `renders/regions/male-trunk-{front,three-quarter,back,three-quarter-back}.png`. `render_regions.py` also takes `--group <name>|all` (one data file only, or `all` colours every file in one picture) and `--view front|three-quarter|side|three-quarter-back|back` (all but `side` when left out), so the next tickets need no edit to the script. Without `--group` every file in `regions/male/` gets its own set of renders named `male-<group>-<view>.png` (trunk now, `shoulders_arms` and `legs` when their files exist). `--scratch` is the folder for the scratch `.blend` and the unframed render, default `<system temp>/keylow-body-model`. It must be outside any git checkout (the run refuses a path inside the repository or inside another checkout).

### The cut is on Multires level 3

The base mesh has 10,590 quads and its detail lives in three Multires levels above it. A cut on the base steps along quads of about 2 cm and reads as patches, so the regions are cut on **level 3 (677,440 faces, about 64 times the base)**, with the sculpted detail, and the borders follow smooth lines. Level 2 (169,360 faces) was tried and still showed a saw tooth along gently sloping borders. The export ticket decimates to the budget (about 30,000 triangles) and pins the muscle borders, so the face count here costs nothing in the final size. The bundle's own body is left as it was. `assign_regions.py` evaluates a copy at the level and cuts that. The level is a contract, not a setting. Every file names it in `multiresLevel` (0 is the base mesh, 3 the top) and the files must agree. A face number is only valid for the bundle's sha256, that level, the face count (`faceCount`, 677,440 at level 3) and the order of the faces (`faceFingerprint`, the sha256 of the centre of every 1,000th face, rounded to two decimals of the height, so float noise does not change it). The run stops, with no clamping, when the body has fewer Multires levels than the file names, when its face count differs from `faceCount` (a file set to level 2 stops with "cut on 677440 faces but the body has 169360"), or when the fingerprint differs, which catches a Blender version that numbers the faces differently. The indices of `addFaces` and `removeFaces` mean faces of that level. The scratch `.blend` (about 73 MB) holds the level mesh with the result as an integer face attribute `muscle_region` (an index into the JSON list in the mesh property `muscle_region_ids`, `body` first) and the level in `multires_level`.

### Data format

One file per group in `regions/male/`, named after the group: `trunk.json` here, `shoulders_arms.json` and `legs.json` in the next two tickets. The loader reads every `.json` file in the folder and no file refers to another.

```json
{
  "sourceSha256": "3c12...c137",
  "multiresLevel": 3,
  "faceCount": 677440,
  "faceFingerprint": "651c...3b0b",
  "regions": [
    {
      "id": "abs",
      "priority": 130,
      "facing": "front",
      "shape": {
        "type": "outline",
        "mirror": true,
        "depth": [0, 1],
        "points": [
          [0, 0.689],
          [0.036, 0.676],
          [0.045, 0.615],
          [0.028, 0.563],
          [0, 0.556]
        ]
      },
      "addFaces": [],
      "removeFaces": []
    }
  ]
}
```

- `sourceSha256`: the sha256 of the bundle's `.blend` the regions were cut against (the value in the Source section above). The run compares it with the file passed in `--source` before it opens it and stops with a message naming both hashes when they differ, because the face numbers would point at different faces.
- `multiresLevel`, `faceCount`, `faceFingerprint`: the Multires level of the body the face numbers belong to (0 to 3, the same in every file), the number of faces the body has at that level and the order fingerprint. The run prints the current fingerprint on its first line. See the contract above.
- `id`: one of the 22 ids. A region names both sides of the body.
- `priority`: a whole number in the group's reserved band. A higher number wins where regions overlap. Trunk is 100 to 199, `shoulders_arms` 200 to 299 (wins over the trunk where they overlap) and `legs` 300 to 399 (wins over the trunk below the hip). Two overlapping regions with the same priority stop the run, because the winner would be a guess.
- `facing`: `front`, `back` or `any` (the default). A face counts as front when its normal points at least 0.3 toward the front (the body faces -Y) and as back when it points that far the other way. A flank face is neither, so a rule that has to reach round the side uses `any` and a `depth` range.
- `shape`: where the face centre has to lie. Shapes are written in the **normalised body frame**, so the same rules can be re-fitted to the female body with small changes:
  - `side`: the distance from the midline as a fraction of the body's height. It is always positive, so a rule written for one side covers both.
  - `height`: 0 at the soles, 1 at the crown.
  - `depth`: the distance in front of the body's centre as a fraction of the height, negative behind it.
  - `{"type": "box", "side": [min, max], "height": [min, max], "depth": [min, max]}`, an axis left out is unbounded.
  - `{"type": "outline", "points": [[side, height], ...], "mirror": true|false, "smooth": true|false, "depth": [min, max]}`: a closed curve in the side and height plane, projected through the body, so it needs `facing` or a `depth` range to keep to one surface. `smooth` (the default) draws a closed Catmull-Rom curve through the points, so a handful of points give a rounded anatomical edge, and `false` joins them with straight lines. `mirror` takes the points as the outer edge of a shape that touches the midline: the list runs from the top midline point, out and round, to the bottom midline point (both with side 0), and the other half is added for you. A shape beside the midline (the lats, the lower back columns) is a plain closed list.
  - `{"type": "ellipsoid", "centre": [side, height, depth], "radii": [side, height, depth]}`.
  - `{"type": "plane", "point": [side, height, depth], "normal": [side, height, depth]}`: the half-space on the side the normal points to.
  - `{"type": "union", "of": [shape, ...]}`, `{"type": "intersection", "of": [shape, ...]}` and `{"type": "difference", "from": shape, "minus": shape}`.
- `addFaces` and `removeFaces`: hand-tuned boundaries. Face indices of the level mesh added to the region or taken out of it, applied after the shape and before priority. They are only valid for the bundle named by `sourceSha256`.

The frame is made from the bounds of the level mesh: the soles and crown set height 0 and 1 (about 1.69 m for the realistic male), the mean of the vertices' X is the midline and the middle of the Y range is depth 0.

### The coverage report

The run prints the faces per id, the unclaimed faces (counted in bands of one tenth of the height), the faces claimed by more than one region before priority and which pair won, and the connected pieces of each id with any single-face island listed. A face no region claims goes to `body`. The trunk files leave the head, arms, legs, hands and feet there until the next tickets.

### Counts to compare a run against

The trunk run at level 3 (677,440 faces) gives these faces per id. A reviewer can run `regions` and compare. If the numbers differ, the data, the bundle or Blender changed.

| Id            | Faces   |
| ------------- | ------- |
| `chest_upper` | 5,984   |
| `chest_lower` | 5,258   |
| `abs`         | 2,380   |
| `obliques`    | 7,719   |
| `lats`        | 6,880   |
| `traps_mid`   | 2,302   |
| `lower_back`  | 3,923   |
| `body`        | 642,994 |

### The trunk, second cut

All numbers are fractions of the body's height, and every region except the traps is an `outline`. Landmarks on the realistic male: clavicle at 0.78 to 0.79, nipples at 0.72, navel at 0.61, the torso is about 0.105 from the midline at the chest and 0.09 at the waist. Regions overlap on purpose where the priority decides the border, so the borders tuck under the stronger region and leave no gap.

| Id            | Rule                                                                                                                                                                                                                                            |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `chest_upper` | the whole pectoral on the front: a clavicle curve rising from the sternal notch (0.776) to the shoulder (0.797), an outer edge that tapers in toward the front delt, and a lower edge sweeping up from the sternum (0.678) to the armpit (0.74) |
| `chest_lower` | the pectoral below a split that rises from the nipple line at the sternum (0.732) to the armpit (0.752), so the lower pec is a full wedge and not a crescent. Priority 125, so it wins over `chest_upper`                                       |
| `abs`         | the rectus strip, 0.09 wide at the navel with rounded ends from just under the sternum (0.689) to the groin line (0.556), front only                                                                                                            |
| `obliques`    | the flank outside the abs from the pectoral edge down, tapering to the hip with a V cut at the groin side, wrapping back to depth -0.06                                                                                                         |
| `lats`        | the wing from the armpit (0.748) down and in to the waist (0.60), back and flank up to the mid-axillary line                                                                                                                                    |
| `traps_mid`   | a smooth diamond from 0.79 to 0.69 at the spine, 0.07 wide at its middle                                                                                                                                                                        |
| `lower_back`  | two tapered erector columns either side of the spine (0.008 to 0.06 from the midline, 0.706 down to 0.562), back only                                                                                                                           |

The groin and the nipples are not cut out. The base body is anatomically complete there, the groin area goes to `body` (the split and export ticket gives it a smooth, neutral finish) and the nipples sit inside `chest_upper` or `chest_lower`.

## Mesh naming contract

The tools that follow this one produce a body in which **every mesh is named by a muscle id**, and nothing else is named:

- One mesh per id of `MUSCLE_IDS` in [`packages/core/src/training/muscles.ts`](../../packages/core/src/training/muscles.ts), 22 in all: `chest_upper`, `chest_lower`, `delt_front`, `delt_side`, `delt_rear`, `lats`, `traps_upper`, `traps_mid`, `lower_back`, `biceps`, `triceps`, `forearms`, `abs`, `obliques`, `glute_max`, `glute_med`, `quads`, `hamstrings`, `adductors`, `calves`, `tibialis`, `neck`.
- One mesh named `body` for everything no muscle covers: head, hands, feet and joints.
- A muscle id names **both sides** of the body. The left and right of one muscle are one mesh, because the ids carry no side.
- Adding or splitting an id is a new muscle list version (ADR 0005), so this list changes only with it.

## Notes

- Blender writes nothing into the repository. The scripts write only `inspection/bundle.json`, `renders/bases/` and `renders/regions/`, and the package `.gitignore` keeps Python bytecode and any `.blend`, `.blend1` and `.blend@` file out.
- PNG text stamps (the `.blend` path, date and render time Blender adds by default) are off on purpose, so no local path reaches the public repository. A test fails if a committed render holds a text chunk or `/Users/`.
- The Blender steps are not part of `pnpm check`. `lint`, `typecheck` and `test` are, and the tests cover how the Blender command line is built, the region engine (they run `blender/regions.py` with `python3`, which the CI runners have) and that no committed render holds metadata.
- `inspection/` is excluded from Prettier in the root `.prettierignore` because it is written exactly as the script builds it.
