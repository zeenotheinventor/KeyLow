# Exercise library verification

This is the written record of where the global exercise library comes from and how it is built. It covers the pinned source file, how to check and rebuild it, what the source looks like, and what the curation keeps and leaves out. The mapping rules themselves are in `MAPPING.md`, and the lifts a human should check are in `REVIEW-SAMPLE.md`. The last section records the import of the library into the database.

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

The script refuses a source file whose sha256 does not match its `.sha256` file, runs the checker (`scripts/exercises/checkCurated.ts`) on the result and writes nothing if any check fails. Like the importer, it prints only the rule and the CSV line of each failed check of the curated file, never an exercise name or a muscle. The generator was run twice and gave byte-identical files. The unit test `test/unit/exercises/committedLibrary.test.ts` rebuilds both CSVs from the source and the overrides on every `pnpm test`, so a hand edit of a generated file, or an override or rule change without a rebuild, fails CI.

## What the source looks like

Each entry has `id`, `name`, `force`, `level`, `mechanic`, `equipment`, `primaryMuscles`, `secondaryMuscles`, `instructions`, `category` and `images`. The curation reads all of these except `level` and `images`. Ids are unique and are file-name-like (`Barbell_Bench_Press_-_Medium_Grip`), so they are the `source_ref` the importer stores. No two entries share a name.

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

## Import

`pnpm --filter @keylow/db import:exercises --label <label>` reads `exercises.curated.csv`, runs the checker on it and refuses to write anything if the checker fails. It then writes the exercises, their muscle maps and their source rows to the database that `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` name, or to the local stack when neither is set. The unit tests under `test/unit/exercises` and the integration tests `test/integration/database/exercises-import.test.ts` and `exercise-library.test.ts` cover it.

- `--dry-run` maps and checks every row and writes nothing. It connects to nothing.
- `--emit-migration <file>` writes the same library as a migration, `supabase/migrations/<timestamp>_exercise_library.sql`, and connects to nothing. It takes no `--label`.
- One `exercise_import_runs` row records each import (the label, the source repository's commit and the sha256 of the CSV), and each exercise has one `exercise_source_data` row holding its entry of the source file exactly as it was fetched, pointing at the latest run.
- Exercises are keyed by `(source, source_ref)`. Importing the same CSV again leaves every exercise row and every map row as it was, and only moves the source rows to the new run. A changed name, equipment or mechanic updates that exercise. A changed muscle, role or weight replaces that exercise's map and no other. An exercise that the CSV no longer has is soft deleted (`deleted_at`) and never deleted, and it is live again if a later CSV has it back.
- Every write goes through the function `public.import_exercises`, one call per batch of 100 exercises. PostgREST gives each request its own transaction and the primary-muscle trigger is checked at commit, so an exercise and its map have to arrive in one call. The migration calls the same function.
- No log line and no error message holds an exercise name, a source reference or a muscle. A failed check names its rule and the line of the CSV, and a database failure names only its error code.

### Result

An import of the committed CSV into an empty local database, with the label `key349-local-full`:

| Outcome                             | Exercises |
| ----------------------------------- | --------- |
| Imported (created)                  | 673       |
| Left out (`exercises.excluded.csv`) | 203       |
| Source file                         | 876       |

The same command run again gave 0 created, 0 updated, 673 unchanged and 0 soft deleted, and the database held the same 673 exercises and 2,189 map rows with the same ids (an md5 over the map row ids was equal before and after). Applying the seed over the imported library changed nothing either.

Exercises that have each muscle as primary, counted in the database after the import (live global exercises, an exercise with two primaries counting for both). They equal the counts under "Result" above, and all 22 muscles have at least one:

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

`exercise-library.test.ts` repeats that check on any database: each of the 22 muscle ids has a live global exercise with that muscle as its primary.

### Migration

`supabase/migrations/20261019030000_exercise_library.sql` holds the full curated list (673 exercises), not a subset, and loads it into every database that applies the migrations. It is 996 kB. A unit test regenerates the newest `*_exercise_library.sql` from the CSV and the source file and fails if the committed file differs. A later CSV change is a new generated migration, never an edit of an applied one.

### Production

The library reaches production through the migration: Deploy Supabase runs `supabase db push` on the merge to `main`, and nobody runs the import by hand. The `--label` import above stays for a local stack.
