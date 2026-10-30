import * as copy from "../../../src/copy";

import type { WordedSetInputRule } from "../../../src/copy";
import type { SetPrefill } from "../../../src/training";

// Every function `src/copy/sessionEntry.ts` exports, called with representative arguments. The voice test
// fails when a function has no row, so no sentence escapes the sweep.
const setTypes = ["warmup", "working", "drop", "failure"] as const;
const units = ["kg", "lb"] as const;
const previous = { loadKg: 170, reps: 10 };
const target = { repMin: 10, repMax: 12, rir: 1 };
const worded: readonly WordedSetInputRule[] = [
  "load_not_a_number",
  "load_ambiguous_separator",
  "load_0_to_1000_kg",
  "reps_whole_1_to_100",
  "rir_whole_0_to_10",
];
const sessionPrefill: SetPrefill = {
  load_kg: 180,
  reps: 11,
  rir: 1,
  rpe: null,
  set_type: "working",
  source: "session",
};

export const samples: Record<string, () => string[]> = {
  describeSetColumns: () => units.flatMap((unit) => Object.values(copy.describeSetColumns(unit))),
  describeSetCellName: () =>
    units.flatMap((unit) =>
      setTypes.flatMap((setType) =>
        (["load", "reps", "rir"] as const).map((column) =>
          copy.describeSetCellName({
            exerciseName: "Leg press",
            setType,
            setNumber: 3,
            unit,
            column,
          }),
        ),
      ),
    ),
  describeMoreForExercise: () => [copy.describeMoreForExercise("Leg press")],
  describeExerciseTarget: () => [
    copy.describeExerciseTarget({ target: { sets: 3, ...target }, equipment: "machine" }),
    copy.describeExerciseTarget({ target: null, equipment: "cable" }),
  ],
  describeSetRow: () =>
    units
      .flatMap((unit) =>
        setTypes.flatMap((setType) => {
          const base = { setType, setNumber: 3, unit, previous };
          return [
            { ...base, entry: { state: "logged", loadKg: 180, reps: 11, rir: 1 } },
            { ...base, entry: { state: "ready", loadKg: 180, reps: 11 } },
            { ...base, entry: { state: "empty" } },
          ] satisfies copy.SetRowInput[];
        }),
      )
      .flatMap((input) => {
        const row = copy.describeSetRow(input);
        return [row.label, row.previous, row.load, row.reps, row.rir, row.accessibleName];
      }),
  describeSetEntryName: () =>
    setTypes.map((type) => copy.describeSetEntryName("Leg press", type, 3)),
  describeSetEntrySubtitle: () =>
    setTypes.flatMap((setType) => [
      copy.describeSetEntrySubtitle({ setType, setNumber: 3, plannedSets: 3, target }),
      copy.describeSetEntrySubtitle({ setType, setNumber: 3, plannedSets: null, target: null }),
    ]),
  describeSetTypeSheet: () =>
    setTypes.flatMap((setType) => {
      const sheet = copy.describeSetTypeSheet({
        exerciseName: "Barbell squat",
        setType,
        setNumber: 1,
      });
      return [sheet.accessibleName, sheet.subtitle];
    }),
  describeSameAgainName: () => [
    copy.describeSameAgainName({ loadKg: 180, reps: 11, rir: 1, unit: "kg" }),
    copy.describeSameAgainName({ loadKg: null, reps: 1, rir: null, unit: "lb" }),
  ],
  describePrefillLine: () => [
    copy.describePrefillLine(sessionPrefill, previous, "kg"),
    copy.describePrefillLine(sessionPrefill, null, "lb"),
    copy.describePrefillLine({ ...sessionPrefill, source: "last_time" }, previous, "kg"),
    copy.describePrefillLine({ ...sessionPrefill, load_kg: null, rir: null }, null, "kg"),
    copy.describePrefillLine(
      { load_kg: null, reps: null, rir: null, rpe: null, set_type: "working", source: "none" },
      null,
      "kg",
    ),
  ],
  isWordedSetInputRule: () => [
    copy.isWordedSetInputRule("reps_whole_1_to_100") ? "worded" : "not worded",
    copy.isWordedSetInputRule("rpe_1_to_10_in_halves") ? "worded" : "not worded",
  ],
  describeSetInputError: () =>
    units.flatMap((unit) => worded.map((rule) => copy.describeSetInputError(rule, unit))),
};
