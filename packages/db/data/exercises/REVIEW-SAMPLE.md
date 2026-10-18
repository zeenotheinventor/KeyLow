# Exercise library: review sample

The 47 most common lifts in `exercises.curated.csv`, with the muscle map each one gets, for a human to check before the library is imported. The rules behind every row are in `MAPPING.md`. A test (`test/unit/exercises/committedLibrary.test.ts`) reads the tables below and fails when a row no longer matches the curated CSV, so this sample cannot drift from the data.

How to read a row: each cell lists `muscle weight` pairs for one role. Weights are the share of a set that muscle receives in the heat model (ADR 0005), so a bench press set counts as 1 set for `chest_lower` and 0.6 of a set for `chest_upper`. "(override)" after a name means the row comes from `overrides.csv` rather than from the rules, and its `override_note` in the CSV says why.

## The two splits to check first

free-exercise-db has one group, `shoulders`, for all three delt heads and one group, `chest`, for both chest regions. ADR 0005 splits them, so the rules choose the head or region from the movement pattern in the exercise name. These are the decisions most worth a second opinion.

- **Shoulders.** Overhead pressing makes `delt_front` primary with `delt_side` secondary. Lateral raises, upright rows and high pulls make `delt_side` primary. Rear-delt flyes, reverse flyes, face pulls, band pull-aparts and external rotation make `delt_rear` primary. Front raises make `delt_front` primary on its own. Where the source lists shoulders only as a secondary muscle, they become `delt_rear` on rows and pulldowns and `delt_front` on presses.
- **Chest.** Incline pressing and flyes, feet-elevated push-ups and low-to-high crossovers make `chest_upper` primary with `chest_lower` 0.5. Flat pressing makes `chest_lower` primary with `chest_upper` 0.6 (the ADR's bench press). Decline pressing, dips and hands-elevated push-ups make `chest_lower` primary with `chest_upper` only 0.3.

### Chest

| Lift                                      | `source_ref`                                | Primary         | Secondary                                    | Stabiliser | Split rule                           |
| ----------------------------------------- | ------------------------------------------- | --------------- | -------------------------------------------- | ---------- | ------------------------------------ |
| Barbell Bench Press - Medium Grip         | `Barbell_Bench_Press_-_Medium_Grip`         | chest_lower 1.0 | chest_upper 0.6, delt_front 0.5, triceps 0.5 | none       | flat press, the ADR 0005 example     |
| Dumbbell Bench Press                      | `Dumbbell_Bench_Press`                      | chest_lower 1.0 | chest_upper 0.6, delt_front 0.5, triceps 0.5 | none       | flat press                           |
| Barbell Incline Bench Press - Medium Grip | `Barbell_Incline_Bench_Press_-_Medium_Grip` | chest_upper 1.0 | chest_lower 0.5, delt_front 0.5, triceps 0.5 | none       | incline: **upper chest primary**     |
| Incline Dumbbell Press                    | `Incline_Dumbbell_Press`                    | chest_upper 1.0 | chest_lower 0.5, delt_front 0.5, triceps 0.5 | none       | incline: **upper chest primary**     |
| Decline Barbell Bench Press               | `Decline_Barbell_Bench_Press`               | chest_lower 1.0 | delt_front 0.5, triceps 0.5, chest_upper 0.3 | none       | decline: light upper chest           |
| Dips - Chest Version                      | `Dips_-_Chest_Version`                      | chest_lower 1.0 | delt_front 0.5, triceps 0.5, chest_upper 0.3 | none       | dip: light upper chest               |
| Pushups                                   | `Pushups`                                   | chest_lower 1.0 | chest_upper 0.6, delt_front 0.5, triceps 0.5 | none       | flat press                           |
| Push-Ups With Feet Elevated               | `Push-Ups_With_Feet_Elevated`               | chest_upper 1.0 | chest_lower 0.5, delt_front 0.5, triceps 0.5 | none       | feet up: **upper chest primary**     |
| Dumbbell Flyes                            | `Dumbbell_Flyes`                            | chest_lower 1.0 | chest_upper 0.6                              | none       | flat fly                             |
| Cable Crossover                           | `Cable_Crossover`                           | chest_lower 1.0 | chest_upper 0.6, delt_front 0.5              | none       | high-to-low fly                      |
| Low Cable Crossover                       | `Low_Cable_Crossover`                       | chest_upper 1.0 | chest_lower 0.5, delt_front 0.5              | none       | low-to-high: **upper chest primary** |

### Shoulders

| Lift                    | `source_ref`              | Primary        | Secondary                             | Stabiliser | Split rule                     |
| ----------------------- | ------------------------- | -------------- | ------------------------------------- | ---------- | ------------------------------ |
| Standing Military Press | `Standing_Military_Press` | delt_front 1.0 | delt_side 0.5, triceps 0.5            | none       | overhead press: **front delt** |
| Dumbbell Shoulder Press | `Dumbbell_Shoulder_Press` | delt_front 1.0 | delt_side 0.5, triceps 0.5            | none       | overhead press: **front delt** |
| Arnold Dumbbell Press   | `Arnold_Dumbbell_Press`   | delt_front 1.0 | delt_side 0.5, triceps 0.5            | none       | overhead press: **front delt** |
| Push Press              | `Push_Press`              | delt_front 1.0 | delt_side 0.5, triceps 0.5, quads 0.5 | none       | overhead press: **front delt** |
| Side Lateral Raise      | `Side_Lateral_Raise`      | delt_side 1.0  | none                                  | none       | lateral raise: **side delt**   |
| Upright Barbell Row     | `Upright_Barbell_Row`     | delt_side 1.0  | traps_upper 0.5                       | none       | upright row: **side delt**     |
| Front Dumbbell Raise    | `Front_Dumbbell_Raise`    | delt_front 1.0 | none                                  | none       | front raise: **front delt**    |
| Face Pull               | `Face_Pull`               | delt_rear 1.0  | traps_mid 0.5                         | none       | face pull: **rear delt**       |
| Reverse Flyes           | `Reverse_Flyes`           | delt_rear 1.0  | none                                  | none       | reverse fly: **rear delt**     |
| Band Pull Apart         | `Band_Pull_Apart`         | delt_rear 1.0  | traps_upper 0.5, traps_mid 0.5        | none       | pull-apart: **rear delt**      |

## The other lifts

### Back

| Lift                        | `source_ref`             | Primary                                       | Secondary                                                         | Stabiliser |
| --------------------------- | ------------------------ | --------------------------------------------- | ----------------------------------------------------------------- | ---------- |
| Pullups                     | `Pullups`                | lats 1.0                                      | traps_mid 0.5, biceps 0.5                                         | none       |
| Wide-Grip Lat Pulldown      | `Wide-Grip_Lat_Pulldown` | lats 1.0                                      | delt_rear 0.5, traps_mid 0.5, biceps 0.5                          | none       |
| Bent Over Barbell Row       | `Bent_Over_Barbell_Row`  | lats 1.0, traps_mid 1.0                       | delt_rear 0.5, biceps 0.5                                         | none       |
| One-Arm Dumbbell Row        | `One-Arm_Dumbbell_Row`   | lats 1.0, traps_mid 1.0                       | delt_rear 0.5, biceps 0.5                                         | none       |
| Seated Cable Rows           | `Seated_Cable_Rows`      | lats 1.0, traps_mid 1.0                       | delt_rear 0.5, biceps 0.5                                         | none       |
| Barbell Deadlift (override) | `Barbell_Deadlift`       | lower_back 1.0, glute_max 1.0, hamstrings 1.0 | lats 0.5, traps_upper 0.5, traps_mid 0.5, forearms 0.5, quads 0.5 | calves 0.2 |
| Barbell Shrug               | `Barbell_Shrug`          | traps_upper 1.0                               | none                                                              | none       |

### Arms

| Lift                           | `source_ref`                     | Primary     | Secondary                       | Stabiliser |
| ------------------------------ | -------------------------------- | ----------- | ------------------------------- | ---------- |
| Barbell Curl                   | `Barbell_Curl`                   | biceps 1.0  | forearms 0.5                    | none       |
| Hammer Curls                   | `Hammer_Curls`                   | biceps 1.0  | forearms 0.5                    | none       |
| Triceps Pushdown               | `Triceps_Pushdown`               | triceps 1.0 | none                            | none       |
| Close-Grip Barbell Bench Press | `Close-Grip_Barbell_Bench_Press` | triceps 1.0 | chest_lower 0.5, delt_front 0.5 | none       |

### Legs and glutes

| Lift                              | `source_ref`                        | Primary        | Secondary                     | Stabiliser                 |
| --------------------------------- | ----------------------------------- | -------------- | ----------------------------- | -------------------------- |
| Barbell Squat                     | `Barbell_Squat`                     | quads 1.0      | glute_max 0.5, hamstrings 0.5 | lower_back 0.2, calves 0.2 |
| Front Barbell Squat               | `Front_Barbell_Squat`               | quads 1.0      | glute_max 0.5, hamstrings 0.5 | calves 0.2                 |
| Leg Press                         | `Leg_Press`                         | quads 1.0      | glute_max 0.5, hamstrings 0.5 | calves 0.2                 |
| Dumbbell Lunges                   | `Dumbbell_Lunges`                   | quads 1.0      | glute_max 0.5, hamstrings 0.5 | calves 0.2                 |
| Romanian Deadlift                 | `Romanian_Deadlift`                 | hamstrings 1.0 | lower_back 0.5, glute_max 0.5 | calves 0.2                 |
| Barbell Hip Thrust                | `Barbell_Hip_Thrust`                | glute_max 1.0  | hamstrings 0.5                | calves 0.2                 |
| Leg Extensions                    | `Leg_Extensions`                    | quads 1.0      | none                          | none                       |
| Lying Leg Curls                   | `Lying_Leg_Curls`                   | hamstrings 1.0 | none                          | none                       |
| Thigh Abductor                    | `Thigh_Abductor`                    | glute_med 1.0  | none                          | none                       |
| Standing Calf Raises              | `Standing_Calf_Raises`              | calves 1.0     | none                          | none                       |
| Smith Machine Reverse Calf Raises | `Smith_Machine_Reverse_Calf_Raises` | tibialis 1.0   | none                          | none                       |

### Core and neck

| Lift                                     | `source_ref`                               | Primary      | Secondary | Stabiliser     |
| ---------------------------------------- | ------------------------------------------ | ------------ | --------- | -------------- |
| Plank                                    | `Plank`                                    | abs 1.0      | none      | none           |
| Hanging Leg Raise                        | `Hanging_Leg_Raise`                        | abs 1.0      | none      | none           |
| Russian Twist                            | `Russian_Twist`                            | obliques 1.0 | abs 0.5   | lower_back 0.2 |
| Isometric Neck Exercise - Front And Back | `Isometric_Neck_Exercise_-_Front_And_Back` | neck 1.0     | none      | none           |

## Questions for the reviewer

These are the judgements in the sample that a coach might decide differently. Each one is a single line in `MAPPING.md` or `overrides.csv` to change.

1. **Rows as two primaries.** Rows make both `lats` and `traps_mid` primary at 1.0, because the source lists one as primary and the other as secondary with no pattern across rows. Pull-ups and pulldowns keep `lats` alone as primary.
2. **Squat and lunge glutes at 0.5.** The source lists glutes as secondary on squats, lunges and the leg press, so `glute_max` gets 0.5. Deep squats arguably deserve more.
3. **The deadlift override.** The source makes only the lower back primary. The override makes the glutes and hamstrings primary too. The Romanian deadlift keeps the source's hamstrings-first map.
4. **Calves on the hip thrust.** The source lists calves on the hip thrust and glute bridge; the rules turn every calf listing outside triple extension into a 0.2 stabiliser rather than dropping it.
5. **No serratus or rotator cuff ids.** Internal rotation counts as `delt_front` and external rotation as `delt_rear`; the incline shoulder raises (serratus work) count as `delt_front`.
6. **Hammer curls.** The source lists no forearms on hammer curls; the rules add `forearms` 0.5 to hammer, reverse and Zottman curls.
