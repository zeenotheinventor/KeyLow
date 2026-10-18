# Exercise library verification

This is the written record of where the global exercise library comes from and how it is built. It covers the pinned source file, how to check and rebuild it, what the source looks like, and what the curation keeps and leaves out. The mapping rules themselves are in `MAPPING.md`, and the lifts a human should check are in `REVIEW-SAMPLE.md`. Importing the library into the database is a later ticket; nothing here touches the database.

## Provenance

- Dataset: free-exercise-db, "Open Public Domain Exercise Dataset in JSON format"
- Repository: https://github.com/yuhonas/free-exercise-db
- Commit: `f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5` (the head of `main` on the fetch date, resolved with `git ls-remote https://github.com/yuhonas/free-exercise-db HEAD`)
- File URL: https://raw.githubusercontent.com/yuhonas/free-exercise-db/f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5/dist/exercises.json
- Fetch date: 2026-10-18
- File sha256: `5bb747e3fc658f095a60dcbf6d53c96627acdcc6ffb6fffde86f7e26995d40bf` (checked with `sha256sum -c` after the download)
- Size: 1,005,327 bytes, 876 exercises
- Licence: The Unlicense (public domain dedication), as the repository's README states at that commit

## Licence and attribution

The Unlicense dedicates the data to the public domain, so it may be copied, changed and shipped without attribution and without any share-alike condition. That is why ADR 0005 picked it as the starting source, and why wger (CC-BY-SA) stays a reference only. Crediting free-exercise-db on the About screen is a courtesy, not a requirement.

## Files in this directory

| File                                              | Committed | What it is                                                                                    |
| ------------------------------------------------- | --------- | --------------------------------------------------------------------------------------------- |
| `upstream/free-exercise-db.exercises.json`        | Yes       | The source file exactly as downloaded, 1.0 MB. Prettier ignores it so it stays byte for byte. |
| `upstream/free-exercise-db.exercises.json.sha256` | Yes       | Its sha256 in the format `sha256sum -c` and `shasum -a 256 -c` read.                          |
| `overrides.csv`                                   | Yes       | The hand decisions the rules cannot make, each with a note (`MAPPING.md`, "Overrides").       |
| `exercises.curated.csv`                           | Yes       | Generated. The kept exercises with their muscle maps.                                         |
| `exercises.excluded.csv`                          | Yes       | Generated. The left-out exercises with the reason for each.                                   |
| `MAPPING.md`                                      | Yes       | The mapping rules.                                                                            |
| `REVIEW-SAMPLE.md`                                | Yes       | The common lifts and their maps, for a human to review.                                       |
| `VERIFICATION.md`                                 | Yes       | This record.                                                                                  |

The source is kept in `upstream/` because it is a verbatim third-party file, the same way `packages/tokens/src/source/` keeps the design export.

## How to check and rebuild

To check the pinned file against the published one, from `packages/db`:

```sh
curl -fsSL -o /tmp/exercises.json https://raw.githubusercontent.com/yuhonas/free-exercise-db/f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5/dist/exercises.json
cmp /tmp/exercises.json data/exercises/upstream/free-exercise-db.exercises.json
cd data/exercises/upstream && sha256sum -c free-exercise-db.exercises.json.sha256
```

To rebuild the two generated CSVs, from the repository root:

```sh
pnpm --filter @keylow/db curate:exercises          # writes exercises.curated.csv and exercises.excluded.csv
pnpm --filter @keylow/db curate:exercises --check  # writes nothing; fails if the committed CSVs are stale
```

The script refuses a source file whose sha256 does not match its `.sha256` file, runs the checker (`scripts/exercises/checkCurated.ts`) on the result and writes nothing if any check fails. The generator was run twice and gave byte-identical files. The unit test `test/unit/exercises/committedLibrary.test.ts` rebuilds both CSVs from the source and the overrides on every `pnpm test`, so a hand edit of a generated file, or an override or rule change without a rebuild, fails CI.

## What the source looks like

Each entry has `id`, `name`, `force`, `level`, `mechanic`, `equipment`, `primaryMuscles`, `secondaryMuscles`, `instructions`, `category` and `images`. The curation reads all of these except `level` and `images`. Ids are unique and are file-name-like (`Barbell_Bench_Press_-_Medium_Grip`), so they are the `source_ref` the importer will store. No two entries share a name.

| Category              | Exercises |
| --------------------- | --------- |
| strength              | 584       |
| stretching            | 123       |
| plyometrics           | 61        |
| powerlifting          | 38        |
| olympic weightlifting | 35        |
| strongman             | 21        |
| cardio                | 14        |

The muscle groups are 17 coarse names: abdominals, abductors, adductors, biceps, calves, chest, forearms, glutes, hamstrings, lats, lower back, middle back, neck, quadriceps, shoulders, traps, triceps. Every exercise has exactly one primary group except `Kettlebell_Halo_With_Overhead_Extension`, which has two. `mechanic` is missing on 87 entries (mostly stretches), `equipment` on 77, `force` on 30. Five entries have empty instructions.

The source has no tibialis group and nothing finer than "shoulders" or "chest", so the delt heads, the chest regions, glute medius, obliques and tibialis all come from the rules in `MAPPING.md`.

## Result

| Outcome                                                      | Exercises |
| ------------------------------------------------------------ | --------- |
| Curated                                                      | 673       |
| Excluded: stretch                                            | 122       |
| Excluded: plyometric drill                                   | 61        |
| Excluded: cardio                                             | 14        |
| Excluded: duplicate (2 by identical instructions, 1 by hand) | 3         |
| Excluded by hand: not resistance training                    | 3         |
| Total                                                        | 876       |

One source stretch (`Side_Leg_Raises`) is kept by an override, which is why 122 of the 123 stretches are excluded.

Exercises with each muscle as primary (an exercise with two primaries counts for both):

| Muscle      | Primary in | Muscle     | Primary in |
| ----------- | ---------- | ---------- | ---------- |
| chest_upper | 14         | forearms   | 23         |
| chest_lower | 56         | abs        | 50         |
| delt_front  | 77         | obliques   | 30         |
| delt_side   | 21         | glute_max  | 17         |
| delt_rear   | 21         | glute_med  | 3          |
| lats        | 56         | quads      | 91         |
| traps_upper | 9          | hamstrings | 51         |
| traps_mid   | 34         | adductors  | 3          |
| lower_back  | 16         | calves     | 13         |
| biceps      | 50         | tibialis   | 1          |
| triceps     | 67         | neck       | 5          |

All 22 ids are primary somewhere. The thin ones are discussed in `MAPPING.md`, "Gaps": tibialis has one exercise because the source has only one dorsiflexion exercise, and no exercise was invented to pad it.
