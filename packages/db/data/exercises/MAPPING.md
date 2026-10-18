# Exercise library: mapping rules

How free-exercise-db's coarse muscle groups become the 22 muscle ids of ADR 0005 ("The muscle list is the contract"), which exercises are left out, and when a hand override applies. The code is `scripts/exercises/rules.ts` (the rules) and `data/exercises/overrides.csv` (the hand decisions); this document is their written form, and a change to one is a change to the other.

Movement patterns are read from the exercise name, lower-cased, because the source records nothing finer than the 17 groups. Each pattern below lists the name fragments that trigger it.

## Roles and weights

Every exercise's map is a list of `muscle:role:weight` entries (the `muscles` column, for example `delt_side:primary:1.0;traps_upper:secondary:0.5`). The weight is the share of a set the muscle receives in the heat model.

| Role       | Default weight | Comes from                                                                       |
| ---------- | -------------- | -------------------------------------------------------------------------------- |
| primary    | 1.0            | the source's `primaryMuscles`, or a rule that promotes a muscle (rows, below)    |
| secondary  | 0.5            | the source's `secondaryMuscles`                                                  |
| stabiliser | 0.2            | a secondary listing the rules judge to be bracing or grip rather than prime work |

The default weights change in two places only, both in the chest rules: the upper chest on a flat press is 0.6 (the bench press of ADR 0005, "Tables": `chest_lower 1.0, chest_upper 0.6, delt_front 0.5, triceps 0.5`), and on a decline press, dip or hands-elevated push-up it is 0.3. Any other weight comes from `overrides.csv` and carries an `override_note`.

When two listings land on the same muscle, the strongest role wins (primary over secondary over stabiliser), and within a role the larger weight. So a muscle is never listed twice in a row.

## Default group map

| Source group | Muscle id                              | As primary                                      | As secondary                                                             |
| ------------ | -------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------ |
| chest        | `chest_upper`, `chest_lower`           | split by incline (below)                        | `chest_upper` on a shoulder exercise or an incline, else `chest_lower`   |
| shoulders    | `delt_front`, `delt_side`, `delt_rear` | split by movement (below)                       | split by movement (below)                                                |
| lats         | `lats`                                 | primary; with `traps_mid` primary too on a row  | secondary                                                                |
| middle back  | `traps_mid`                            | primary; with `lats` primary too on a row       | secondary                                                                |
| traps        | `traps_upper`                          | primary, except upright rows (below)            | secondary                                                                |
| lower back   | `lower_back`                           | primary                                         | secondary on a hinge, stabiliser otherwise                               |
| biceps       | `biceps`                               | primary                                         | secondary                                                                |
| triceps      | `triceps`                              | primary                                         | secondary                                                                |
| forearms     | `forearms`                             | primary                                         | secondary when the primary is an arm muscle, stabiliser (grip) otherwise |
| abdominals   | `abs`, `obliques`                      | `abs`, or `obliques` with `abs` 0.5 on rotation | `abs` stabiliser, plus `obliques` secondary on rotation                  |
| glutes       | `glute_max`, `glute_med`               | `glute_max`, or `glute_med` on abduction        | the same split                                                           |
| abductors    | `glute_med`                            | primary                                         | secondary                                                                |
| adductors    | `adductors`                            | primary                                         | secondary                                                                |
| quadriceps   | `quads`                                | primary                                         | secondary                                                                |
| hamstrings   | `hamstrings`                           | primary                                         | secondary                                                                |
| calves       | `calves`, `tibialis`                   | `calves`, or `tibialis` on dorsiflexion         | secondary in triple extension, stabiliser otherwise                      |
| neck         | `neck`                                 | primary                                         | secondary                                                                |

## Shoulders

The source has one group for all three heads. The head is chosen from the name, in this order, and the first pattern that matches wins.

1. **Rear delt** (`rear`, `reverse fly`, `reverse machine fly`, `face pull`, `pull apart`, `back fly`, `external rotation`, `bent over low-pulley side lateral`, `row to neck`): `delt_rear` primary. External rotation counts here because ADR 0005 has no rotator cuff id and the external rotators sit with the rear delt.
2. **Side delt** (`lateral`, `upright`, `high pull`, `crucifix`): `delt_side` primary. This covers lateral raises, upright rows and high pulls. An upright row the source files under traps still becomes `delt_side` primary, with `traps_upper` secondary.
3. **Overhead press** (`press`, `jerk`, `handstand`, `thruster`, `get-up`, `jammer`, `log lift`, `circus bell`, `clean and`, `bradford`): `delt_front` primary and `delt_side` secondary.
4. **Anything else** (front raises, internal rotation, the incline shoulder raises, kettlebell snatches and cleans): `delt_front` primary. Internal rotation counts as front delt for the same reason external rotation counts as rear delt.

Shoulders listed as **secondary** become `delt_side` on a side-delt exercise, `delt_rear` on a rear-delt exercise or a pull (`row`, `t-bar`, `bench pull`, `pulldown`, `pull-up`, `chin`, `rope climb`, `muscle up`, `london bridge`), and `delt_front` on everything else, which is mostly pressing.

## Chest

The source has one group for both regions. The region is chosen by angle.

- **Upper chest** (`incline` except an incline push-up, `decline push-up`, `feet elevated`, `low cable crossover`, `guillotine`, `neck press`): `chest_upper` primary, `chest_lower` secondary 0.5. A decline push-up raises the feet, so it is an incline press for the chest.
- **Lower chest** (`decline`, `dip`, `incline push-up`): `chest_lower` primary, `chest_upper` secondary 0.3. An incline push-up raises the hands, so it is a decline press for the chest.
- **Flat** (everything else, including flyes, crossovers and pullovers): `chest_lower` primary, `chest_upper` secondary 0.6.

Chest listed as **secondary** becomes `chest_upper` when the exercise's primary group is shoulders or the name is an upper-chest one, and `chest_lower` otherwise (close-grip presses, dips, triceps work).

## Back

- **Rows** (`row`, `t-bar`, `bench pull`, but not upright rows or rear-delt rows, which the shoulder rules take first): when the source lists lats or middle back as primary, both `lats` and `traps_mid` become primary. The source lists one first and the other second with no pattern across rows, and a horizontal row trains both hard.
- **Pull-ups and pulldowns** keep `lats` alone as primary, with the middle back as `traps_mid` secondary.
- `traps` is `traps_upper` (shrugs). `middle back` is `traps_mid`, which ADR 0005 defines as mid and lower traps with the rhomboids.
- **Lower back** listed as secondary is a secondary on a hinge (`deadlift`, `good morning`, `romanian`, `stiff-legged`, `rack pull`, `hyperextension`, `back extension`, `pull through`, `swing`, `clean`, `snatch`, `atlas`, `keg`, `sandbag`, `tire flip`, `windmill`, `bent press`, `glute ham`, `figure 8`, `pass between`, `landmine 180`, and every Olympic weightlifting and strongman exercise) and a stabiliser on anything else, such as squats, where the lower back braces rather than moves.

## Core

- `abdominals` is `abs`.
- **Rotation, anti-rotation and side bending** (`oblique`, `twist`, `side bend`, `russian`, `wood chop`, `windmill`, `side bridge`, `side plank`, `judo flip`, `landmine 180`, `cable lift`, `pallof`, `heel touch`, `cross-body crunch`, `elbow to knee`, `side jackknife`, `figure 8`, `pirate ship`, `spell caster`, `bent press`): `obliques` primary and `abs` secondary.
- Abdominals listed as secondary are a stabiliser (bracing), plus `obliques` secondary when the name is a rotation one.

## Legs and glutes

- `glutes` is `glute_max`. On **hip abduction** (`abduct`, `monster walk`, `side leg raise`, `lateral band walk`, `clam`, `fire hydrant`) it is `glute_med` instead.
- `abductors` is always `glute_med`; ADR 0005 has no separate abductor id.
- `calves` is `calves`. On **dorsiflexion** (`reverse calf raise`, `tibialis raise`, `toe raise`, `dorsiflex`) it is `tibialis` instead. This is the only rule that puts tibialis on the map.
- Calves listed as secondary drive the movement in **triple extension** (`clean`, `snatch`, `jerk`, `push press`, `jump`, `thruster`, `high pull`, `swing`, and all Olympic weightlifting), so they are secondary there and a stabiliser elsewhere (squats, lunges, deadlifts, hip thrusts).

## Arms

- Forearms listed as secondary are a secondary on arm work (the primary is biceps, triceps or forearms) and a grip stabiliser elsewhere (pulls, carries, deadlifts).
- **Neutral and overhand curls** (`hammer`, `reverse ... curl`, `zottman`, with biceps primary) get `forearms` secondary even when the source lists no secondary muscle, because they load the brachioradialis. This is the only rule that adds a muscle the source does not list.

## Mechanic and equipment

`mechanic` is the source's `compound` or `isolation`. Where the source has none (87 entries, 5 of them kept), it is `compound` when the source lists any secondary muscle and `isolation` otherwise. `equipment` is the source's text; where the source has none, every one of the 6 kept exercises is bodyweight work (inverted rows, decline push-ups, the floor glute-ham raise), so it is `body only`.

## Exclusions

An exercise goes to `exercises.excluded.csv`, with its reason, when:

1. its category is `stretching` (reason `stretch`), `cardio` (`cardio`) or `plyometrics` (`plyometric drill`). Plyometrics covers the jumps, bounds, hops, sprints, medicine ball throws and skipping drills, including the few with a light load, because they train power, not the resistance volume the heat model counts;
2. an override excludes it, with the override's note as the reason (balance and conditioning drills filed under strength, a bodyweight jump squat, and one duplicate the instructions do not reveal);
3. it duplicates an exercise already kept: two kept exercises with identical, non-empty instructions are one exercise, and the one whose id sorts first stays (reason `duplicate of <source_ref>`). Five entries have empty instructions; they are not compared.

Olympic weightlifting, powerlifting and strongman are resistance training and are kept.

## Overrides

`overrides.csv` has the columns `source_ref,action,muscles,note`, one row per exercise, and every row needs a note.

| Action    | Effect                                                                                                                                          |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `map`     | Replaces the rule-based muscles of an exercise the rules keep. The note becomes the row's `override_note`.                                      |
| `include` | Keeps an exercise the category rules would leave out. The muscles are optional; blank means the rules map it. The note becomes `override_note`. |
| `exclude` | Leaves out an exercise the rules would keep. The note becomes the reason in `exercises.excluded.csv`.                                           |

An override applies only when the rules get an exercise wrong for a reason the name cannot show: the instructions describe a different movement from the name (`Dumbbell_Raise` is an upright row, `Power_Partials` and `Standing_Low-Pulley_Deltoid_Raise` are lateral raises, `Cable_Hip_Adduction` is filed under quadriceps), one exercise trains two heads in turn (`Alternating_Deltoid_Raise`, `Side_Laterals_to_Front_Raise`), or the source's primary is plainly wrong for a common lift (`Barbell_Deadlift`, `Bench_Press_-_Powerlifting`). The generator refuses an override that names an exercise missing from the source, maps an excluded exercise, includes a kept one, or names a duplicate, so an override cannot silently stop applying when the source or rules change.

## Gaps

ADR 0005 asks for every id to be primary somewhere. All 22 are. Three are thin, and the source is the limit, not the rules:

- **tibialis: 1 exercise.** The source has exactly one dorsiflexion exercise, `Smith_Machine_Reverse_Calf_Raises` (stand with the heels on a platform and lift the balls of the feet). Its other tibialis entries are a foam-rolling drill and a stretch, both excluded. `Rocking_Standing_Calf_Raise` ends every rep with a toe raise, so it has tibialis as secondary. Nothing was invented to reach three; a seated or wall tibialis raise would have to be added as a user or hand-authored exercise later.
- **glute_med: 3 exercises.** `Thigh_Abductor` and `Monster_Walk` come from the rules. `Side_Leg_Raises` is a source stretch kept by an `include` override because it is a standing hip abduction, which is resistance work with an ankle weight or band.
- **adductors: 3 exercises.** `Thigh_Adductor` and `Band_Hip_Adductions` come from the rules; `Cable_Hip_Adduction` needs a `map` override because the source files it under quadriceps.

`neck` has five strength exercises in the source (isometric holds, plate resistance lying face up and face down, and the head harness), so it needs no override. `delt_side` (21), `delt_rear` (21) and `chest_upper` (14) all have well over three.
