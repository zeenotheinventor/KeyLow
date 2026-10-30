import { describe, expect, it } from "vitest";

import { collectStrings } from "./collectStrings";
import { samples } from "./samples/sessionEntry";
import {
  describePrefillLine,
  describeSameAgainName,
  describeSetCellName,
  describeSetColumns,
  describeSetEntryName,
  describeSetEntrySubtitle,
  describeSetInputError,
  isWordedSetInputRule,
  describeSetRow,
  describeSetTypeSheet,
  describeMoreForExercise,
  describeExerciseTarget,
  RIR_CHIP_LABELS,
  SESSION_ACTIVE,
  SET_ENTRY,
  SET_MARKS,
  SET_TYPE_OPTIONS,
} from "../../src/copy";
import * as sessionActiveCopy from "../../src/copy/sessionActive";
import * as sessionEntryCopy from "../../src/copy/sessionEntry";
import { loadToKg, prefillNextSet, SET_TYPES, validateSetDraft } from "../../src/training";

import type { SetRowInput } from "../../src/copy";
import type { SetDraft } from "../../src/training";

/*
 * The golden Thursday Legs of KEY-353 on the boards `session · active`, `session · from-routine`,
 * `session · set-entry`, `session · set-types`, `session · invalid` and `session · lb` (canvas version 30),
 * in kilograms and in pounds. The lb board draws 180 kg as 395 lb because a person who trains in pounds
 * enters pounds: 395 lb is stored as 179.169 kg and shown back as 395.
 */
const lb = (pounds: number): number => loadToKg(pounds, "lb");

const logged = (
  setNumber: number,
  loadKg: number | null,
  reps: number,
  rir: number | null,
  overrides: Partial<SetRowInput> = {},
): SetRowInput => ({
  setType: "working",
  setNumber,
  unit: "kg",
  previous: { loadKg: 170, reps: 10 },
  entry: { state: "logged", loadKg, reps, rir },
  ...overrides,
});

describe("the active session's fixed words", () => {
  it("should name the header, the add controls and the list as the session · active board does", () => {
    expect(SESSION_ACTIVE).toEqual({
      finishAction: "Finish",
      hideSessionName: "Hide session, it keeps running",
      addSetAction: "Add set",
      addExerciseAction: "Add exercise",
      setsListName: "Sets",
      loggedColumnName: "Logged",
    });
  });

  it("should head the columns Set, Previous, the unit, Reps and RIR", () => {
    expect(describeSetColumns("kg")).toEqual({
      set: "Set",
      previous: "Previous",
      load: "kg",
      reps: "Reps",
      rir: "RIR",
    });
  });

  it("should head the load column lb for a person who trains in pounds", () => {
    expect(describeSetColumns("lb").load).toBe("lb");
  });

  it("should name a cell of a set's row with the exercise, the set and the column", () => {
    expect(
      describeSetCellName({
        exerciseName: "Leg press",
        setType: "working",
        setNumber: 3,
        unit: "kg",
        column: "load",
      }),
    ).toBe("Leg press, set 3, kilograms");
    expect(
      describeSetCellName({
        exerciseName: "Leg press",
        setType: "working",
        setNumber: 3,
        unit: "lb",
        column: "load",
      }),
    ).toBe("Leg press, set 3, pounds");
    expect(
      describeSetCellName({
        exerciseName: "Leg press",
        setType: "working",
        setNumber: 3,
        unit: "kg",
        column: "reps",
      }),
    ).toBe("Leg press, set 3, reps");
    expect(
      describeSetCellName({
        exerciseName: "Leg press",
        setType: "working",
        setNumber: 3,
        unit: "kg",
        column: "rir",
      }),
    ).toBe("Leg press, set 3, RIR");
  });

  it("should name a cell of a warm-up row without a number", () => {
    expect(
      describeSetCellName({
        exerciseName: "Barbell squat",
        setType: "warmup",
        setNumber: 0,
        unit: "kg",
        column: "reps",
      }),
    ).toBe("Barbell squat, warm-up set, reps");
  });

  it("should name the exercise's more button with the exercise", () => {
    expect(describeMoreForExercise("Leg press")).toBe("More for Leg press");
  });
});

describe("the target line under an exercise's name", () => {
  it("should read sets, reps, RIR and equipment as the board does", () => {
    expect(
      describeExerciseTarget({
        target: { sets: 3, repMin: 10, repMax: 12, rir: 1 },
        equipment: "machine",
      }),
    ).toBe("3 × 10 to 12 · RIR 1 · Machine");
    expect(
      describeExerciseTarget({
        target: { sets: 3, repMin: 5, repMax: 8, rir: 2 },
        equipment: "barbell",
      }),
    ).toBe("3 × 5 to 8 · RIR 2 · Barbell");
  });

  it("should write one rep figure when the range is a single number", () => {
    expect(
      describeExerciseTarget({
        target: { sets: 5, repMin: 5, repMax: 5, rir: 2 },
        equipment: "barbell",
      }),
    ).toBe("5 × 5 · RIR 2 · Barbell");
  });

  it("should leave out the RIR when the plan sets none", () => {
    expect(
      describeExerciseTarget({
        target: { sets: 3, repMin: 8, repMax: 10, rir: null },
        equipment: "dumbbell",
      }),
    ).toBe("3 × 8 to 10 · Dumbbell");
  });

  it("should give the equipment alone for an exercise added to the session, which has no plan", () => {
    expect(describeExerciseTarget({ target: null, equipment: "cable" })).toBe("Cable");
  });

  it("should write the equipment as the goals chips do", () => {
    expect(describeExerciseTarget({ target: null, equipment: "smith_machine" })).toBe(
      "Smith machine",
    );
  });
});

describe("a set row", () => {
  it("should name a logged set with its load, reps and RIR, and offer undo, in kilograms", () => {
    const row = describeSetRow(logged(3, 180, 11, 1));
    expect(row.accessibleName).toBe("Set 3 logged, 180 kilograms, 11 reps, RIR 1, undo");
  });

  it("should name the same logged set in pounds", () => {
    const row = describeSetRow(
      logged(3, lb(395), 11, 1, { unit: "lb", previous: { loadKg: lb(375), reps: 10 } }),
    );
    expect(row.accessibleName).toBe("Set 3 logged, 395 pounds, 11 reps, RIR 1, undo");
    expect(row.load).toBe("395");
    expect(row.previous).toBe("375 × 10");
  });

  it("should name a warm-up as the board does, with no RIR when none was entered", () => {
    const row = describeSetRow(
      logged(1, 60, 8, null, { setType: "warmup", previous: { loadKg: 60, reps: 8 } }),
    );
    expect(row.accessibleName).toBe("Warm-up set logged, 60 kilograms, 8 reps, undo");
    expect(row.label).toBe("W");
  });

  it("should name a warm-up in pounds", () => {
    const row = describeSetRow(
      logged(1, lb(130), 8, null, { setType: "warmup", unit: "lb", previous: null }),
    );
    expect(row.accessibleName).toBe("Warm-up set logged, 130 pounds, 8 reps, undo");
  });

  it("should leave the RIR out of the name of a working set logged without one", () => {
    const row = describeSetRow(logged(2, 100, 7, null));
    expect(row.accessibleName).toBe("Set 2 logged, 100 kilograms, 7 reps, undo");
    expect(row.rir).toBe("–");
  });

  it("should name drop and failure sets as the history does, and mark them D and F", () => {
    expect(describeSetRow(logged(4, 80, 6, 0, { setType: "drop" }))).toMatchObject({
      label: "D",
      accessibleName: "Drop set logged, 80 kilograms, 6 reps, RIR 0, undo",
    });
    expect(describeSetRow(logged(5, 70, 5, 0, { setType: "failure" }))).toMatchObject({
      label: "F",
      accessibleName: "Failure set logged, 70 kilograms, 5 reps, RIR 0, undo",
    });
  });

  it("should use the singular for one kilogram, one pound and one rep", () => {
    expect(describeSetRow(logged(1, 1, 1, 0)).accessibleName).toBe(
      "Set 1 logged, 1 kilogram, 1 rep, RIR 0, undo",
    );
    expect(describeSetRow(logged(1, lb(1), 1, 0, { unit: "lb" })).accessibleName).toBe(
      "Set 1 logged, 1 pound, 1 rep, RIR 0, undo",
    );
  });

  it("should use the plural for a fraction and for zero", () => {
    expect(describeSetRow(logged(1, 0.5, 8, 2)).accessibleName).toBe(
      "Set 1 logged, 0.5 kilograms, 8 reps, RIR 2, undo",
    );
    expect(describeSetRow(logged(1, 0, 8, 2)).accessibleName).toBe(
      "Set 1 logged, 0 kilograms, 8 reps, RIR 2, undo",
    );
  });

  it("should write a set with no load by its reps alone", () => {
    const row = describeSetRow(logged(1, null, 12, 2, { previous: { loadKg: null, reps: 10 } }));
    expect(row.accessibleName).toBe("Set 1 logged, 12 reps, RIR 2, undo");
    expect(row.load).toBe("–");
    expect(row.previous).toBe("10 reps");
  });

  it("should show the cells of the golden Leg press set 1 as the board does", () => {
    const row = describeSetRow(logged(1, 180, 12, 1, { previous: { loadKg: 170, reps: 12 } }));
    expect(row).toMatchObject({
      label: "1",
      previous: "170 × 12",
      load: "180",
      reps: "12",
      rir: "1",
    });
  });

  it("should offer the next set with its prefilled numbers to log", () => {
    const row = describeSetRow({
      setType: "working",
      setNumber: 3,
      unit: "kg",
      previous: { loadKg: 170, reps: 10 },
      entry: { state: "ready", loadKg: 180, reps: 11 },
    });
    expect(row.accessibleName).toBe("Log set 3, 180 kilograms, 11 reps");
    expect(row).toMatchObject({
      label: "3",
      previous: "170 × 10",
      load: "180",
      reps: "11",
      rir: "–",
    });
  });

  it("should offer the next set in pounds", () => {
    const row = describeSetRow({
      setType: "working",
      setNumber: 3,
      unit: "lb",
      previous: { loadKg: lb(375), reps: 10 },
      entry: { state: "ready", loadKg: lb(395), reps: 11 },
    });
    expect(row.accessibleName).toBe("Log set 3, 395 pounds, 11 reps");
  });

  it("should name a set still to come by its number alone, with dashes in its cells", () => {
    const row = describeSetRow({
      setType: "working",
      setNumber: 2,
      unit: "kg",
      previous: { loadKg: 97.5, reps: 7 },
      entry: { state: "empty" },
    });
    expect(row).toEqual({
      label: "2",
      previous: "97.5 × 7",
      load: "–",
      reps: "–",
      rir: "–",
      accessibleName: "Log set 2",
    });
  });

  it("should show a dash for the previous set of an exercise never done", () => {
    const row = describeSetRow({
      setType: "working",
      setNumber: 1,
      unit: "kg",
      previous: null,
      entry: { state: "empty" },
    });
    expect(row.previous).toBe("–");
  });

  it("should name a warm-up still to come as a warm-up", () => {
    const row = describeSetRow({
      setType: "warmup",
      setNumber: 1,
      unit: "kg",
      previous: null,
      entry: { state: "empty" },
    });
    expect(row.accessibleName).toBe("Log warm-up set");
  });
});

describe("the set entry sheet's heading", () => {
  it("should name the sheet by the exercise and the set", () => {
    expect(describeSetEntryName("Leg press", "working", 3)).toBe("Leg press, set 3");
    expect(describeSetEntryName("Leg press", "warmup", 1)).toBe("Leg press, warm-up set");
  });

  it("should state the golden set 3 of 3 with its target", () => {
    expect(
      describeSetEntrySubtitle({
        setType: "working",
        setNumber: 3,
        plannedSets: 3,
        target: { repMin: 10, repMax: 12, rir: 1 },
      }),
    ).toBe("Set 3 of 3 · target 10 to 12 reps at RIR 1");
  });

  it("should leave the RIR out of a target that has none", () => {
    expect(
      describeSetEntrySubtitle({
        setType: "working",
        setNumber: 2,
        plannedSets: 4,
        target: { repMin: 8, repMax: 8, rir: null },
      }),
    ).toBe("Set 2 of 4 · target 8 reps");
  });

  it("should write a single rep target in the singular", () => {
    expect(
      describeSetEntrySubtitle({
        setType: "working",
        setNumber: 1,
        plannedSets: 1,
        target: { repMin: 1, repMax: 1, rir: 0 },
      }),
    ).toBe("Set 1 of 1 · target 1 rep at RIR 0");
  });

  it("should give the set alone for an exercise with no plan", () => {
    expect(
      describeSetEntrySubtitle({
        setType: "working",
        setNumber: 2,
        plannedSets: null,
        target: null,
      }),
    ).toBe("Set 2");
  });

  it("should give the set alone once the sets pass the plan", () => {
    expect(
      describeSetEntrySubtitle({
        setType: "working",
        setNumber: 4,
        plannedSets: 3,
        target: { repMin: 10, repMax: 12, rir: 1 },
      }),
    ).toBe("Set 4 · target 10 to 12 reps at RIR 1");
  });

  it("should name a warm-up without a target, since a warm-up has none", () => {
    expect(
      describeSetEntrySubtitle({
        setType: "warmup",
        setNumber: 1,
        plannedSets: 3,
        target: { repMin: 10, repMax: 12, rir: 1 },
      }),
    ).toBe("Warm-up set");
  });
});

describe("the set types", () => {
  it("should give the four types their names and help lines as session · set-types draws them", () => {
    expect(SET_TYPE_OPTIONS).toEqual({
      warmup: { name: "Warm-up", help: "Never counts toward heat or weekly sets." },
      working: {
        name: "Working",
        help: "Counts by its effort. Left without RIR, it counts as hard.",
      },
      drop: { name: "Drop", help: "A lighter set straight after. Counts like a working set." },
      failure: { name: "Failure", help: "Taken to failure. Counts like a working set." },
    });
  });

  it("should list every set type core knows, so a new one cannot go without words", () => {
    expect(Object.keys(SET_TYPE_OPTIONS)).toEqual([...SET_TYPES]);
  });

  it("should name the sheet and its line from the exercise and the set", () => {
    expect(
      describeSetTypeSheet({ exerciseName: "Barbell squat", setType: "working", setNumber: 1 }),
    ).toEqual({
      accessibleName: "Set type, barbell squat set 1",
      subtitle: "Barbell squat · set 1 · tap the set number to change it",
    });
  });

  it("should name a warm-up's sheet by the warm-up", () => {
    expect(
      describeSetTypeSheet({ exerciseName: "Barbell squat", setType: "warmup", setNumber: 1 }),
    ).toEqual({
      accessibleName: "Set type, barbell squat warm-up set",
      subtitle: "Barbell squat · warm-up set · tap the set number to change it",
    });
  });

  it("should keep an acronym's capitals when the name runs into a sentence", () => {
    expect(
      describeSetTypeSheet({ exerciseName: "EZ bar curl", setType: "working", setNumber: 2 })
        .accessibleName,
    ).toBe("Set type, EZ bar curl set 2");
  });

  it("should mark a warm-up W, a working set by its number, a drop D and a failure F", () => {
    expect(SET_TYPES.map((setType) => SET_MARKS[setType](2))).toEqual(["W", "2", "D", "F"]);
  });

  it("should label the sheet and its group", () => {
    expect(SET_ENTRY.setTypeGroupName).toBe("Set type");
  });
});

describe("the set entry sheet's fixed words", () => {
  it("should give the labels, the RIR help and the buttons as the set-entry board does", () => {
    expect(SET_ENTRY).toMatchObject({
      repsLabel: "Reps",
      rirHeading: "RIR, reps in reserve",
      rirHelp: "Optional. Left blank, a working set counts as hard.",
      sameAgainAction: "Same again",
      logSetAction: "Log set",
      setTypeSheetTitle: "Set type",
    });
  });

  it("should say a set did not save, what to check and what to do, with no number in it", () => {
    expect(SET_ENTRY.saveFailed).toBe(
      "Your set did not save. Check your connection, then try again.",
    );
  });

  it("should say a full session holds 200 sets, the most it can hold", () => {
    expect(SET_ENTRY.sessionFull).toBe("This session holds 200 sets, the most a session can hold.");
  });

  it("should say a set was not removed and what to do, with no number in it", () => {
    expect(SET_ENTRY.removeFailed).toBe(
      "Your set was not removed. Check your connection, then try again.",
    );
  });

  it("should offer RIR chips from 0 to 6+", () => {
    expect(RIR_CHIP_LABELS).toEqual(["0", "1", "2", "3", "4", "5", "6+"]);
  });
});

describe("Same again", () => {
  it("should name the button with the numbers it repeats", () => {
    expect(describeSameAgainName({ loadKg: 180, reps: 11, rir: 1, unit: "kg" })).toBe(
      "Same again, 180 kilograms, 11 reps, RIR 1",
    );
  });

  it("should name it in pounds", () => {
    expect(describeSameAgainName({ loadKg: lb(395), reps: 11, rir: 1, unit: "lb" })).toBe(
      "Same again, 395 pounds, 11 reps, RIR 1",
    );
  });

  it("should leave out a load and an RIR that were not entered", () => {
    expect(describeSameAgainName({ loadKg: null, reps: 1, rir: null, unit: "kg" })).toBe(
      "Same again, 1 rep",
    );
  });
});

describe("the line that says where the numbers came from", () => {
  const lastSet = { load_kg: 180, reps: 11, rir: 1 };

  it("should state the golden fill from this session's last set, with last week", () => {
    const prefill = {
      ...lastSet,
      rpe: null,
      set_type: "working",
      source: "session",
    } as const;
    expect(describePrefillLine(prefill, { loadKg: 170, reps: 10 }, "kg")).toBe(
      "Filled from your last set: 180 kg × 11 at RIR 1. Last week: 170 kg × 10.",
    );
  });

  it("should state it in pounds", () => {
    const prefill = {
      load_kg: lb(395),
      reps: 11,
      rir: 1,
      rpe: null,
      set_type: "working",
      source: "session",
    } as const;
    expect(describePrefillLine(prefill, { loadKg: lb(375), reps: 10 }, "lb")).toBe(
      "Filled from your last set: 395 lb × 11 at RIR 1. Last week: 375 lb × 10.",
    );
  });

  it("should leave out last week when the exercise was not done last week", () => {
    const prefill = { ...lastSet, rpe: null, set_type: "working", source: "session" } as const;
    expect(describePrefillLine(prefill, null, "kg")).toBe(
      "Filled from your last set: 180 kg × 11 at RIR 1.",
    );
  });

  it("should leave out the RIR of a set that had none", () => {
    const prefill = {
      load_kg: 180,
      reps: 11,
      rir: null,
      rpe: null,
      set_type: "working",
      source: "session",
    } as const;
    expect(describePrefillLine(prefill, null, "kg")).toBe(
      "Filled from your last set: 180 kg × 11.",
    );
  });

  it("should write a set with no load by its reps", () => {
    const prefill = {
      load_kg: null,
      reps: 12,
      rir: 2,
      rpe: null,
      set_type: "working",
      source: "session",
    } as const;
    expect(describePrefillLine(prefill, null, "kg")).toBe(
      "Filled from your last set: 12 reps at RIR 2.",
    );
  });

  it("should say last time when the numbers come from an earlier session", () => {
    const prefill = { ...lastSet, rpe: null, set_type: "working", source: "last_time" } as const;
    expect(describePrefillLine(prefill, { loadKg: 170, reps: 10 }, "kg")).toBe(
      "Filled from last time: 180 kg × 11 at RIR 1.",
    );
  });

  it("should say nothing is logged yet when there is no history", () => {
    const prefill = {
      load_kg: null,
      reps: null,
      rir: null,
      rpe: null,
      set_type: "working",
      source: "none",
    } as const;
    expect(describePrefillLine(prefill, null, "kg")).toBe("Nothing logged for this exercise yet.");
  });

  it("should read what KEY-381's prefillNextSet gives", () => {
    const prefill = prefillNextSet(
      "leg-press",
      [
        {
          id: "set-2",
          exercise_id: "leg-press",
          set_type: "working",
          load_kg: 180,
          reps: 11,
          rir: 1,
          rpe: null,
          position: 2,
          performed_at: "2026-10-15T18:50:00+01:00",
          deleted_at: null,
        },
      ],
      [],
    );
    expect(describePrefillLine(prefill, { loadKg: 170, reps: 10 }, "kg")).toBe(
      "Filled from your last set: 180 kg × 11 at RIR 1. Last week: 170 kg × 10.",
    );
  });
});

describe("the set input errors", () => {
  const board = (load: string, reps: string): SetDraft => ({
    setType: "working",
    load,
    reps,
    rir: "",
    rpe: "",
  });

  it("should state the load rule in kilograms as the invalid board does", () => {
    expect(describeSetInputError("load_0_to_1000_kg", "kg")).toBe(
      "Enter a load from 0 to 1,000 kg.",
    );
  });

  it("should state the load rule in pounds, not kilograms", () => {
    expect(describeSetInputError("load_0_to_1000_kg", "lb")).toBe(
      "Enter a load from 0 to 2,204 lb.",
    );
  });

  it("should state the same load rule for text that is not a number", () => {
    expect(describeSetInputError("load_not_a_number", "kg")).toBe(
      "Enter a load from 0 to 1,000 kg.",
    );
    expect(describeSetInputError("load_not_a_number", "lb")).toBe(
      "Enter a load from 0 to 2,204 lb.",
    );
  });

  it("should state the separator rule for a load that could be read two ways", () => {
    expect(describeSetInputError("load_ambiguous_separator", "kg")).toBe(
      "Enter the load without a thousands separator, such as 1000, or with a decimal, such as 52.5.",
    );
  });

  it("should state the reps rule as the invalid board does", () => {
    expect(describeSetInputError("reps_whole_1_to_100", "kg")).toBe(
      "Enter whole reps from 1 to 100.",
    );
  });

  it("should state the effort rule for RIR", () => {
    expect(describeSetInputError("rir_whole_0_to_10", "kg")).toBe(
      "Enter RIR as a whole number from 0 to 10.",
    );
  });

  it("should word the rules KEY-376 reports for the invalid board's 1800 kg and 11.5 reps", () => {
    const result = validateSetDraft(board("1800", "11.5"), { unit: "kg", effortMode: "rir" });
    if (result.ok) {
      throw new Error("the invalid board's numbers should break the set rules");
    }
    const sentences = result.issues.map(({ rule }) => {
      if (rule === "rpe_1_to_10_in_halves" || rule === "effort_one_measure_only") {
        throw new Error("RIR mode should never report an RPE rule");
      }
      return describeSetInputError(rule, "kg");
    });
    expect(sentences).toEqual([
      "Enter a load from 0 to 1,000 kg.",
      "Enter whole reps from 1 to 100.",
    ]);
  });

  it("should tell the rules with a sentence from the two RPE rules", () => {
    expect(isWordedSetInputRule("load_0_to_1000_kg")).toBe(true);
    expect(isWordedSetInputRule("rir_whole_0_to_10")).toBe(true);
    expect(isWordedSetInputRule("rpe_1_to_10_in_halves")).toBe(false);
    expect(isWordedSetInputRule("effort_one_measure_only")).toBe(false);
  });

  it("should let a screen narrow the rules KEY-376 reports and word every one that has a sentence", () => {
    const result = validateSetDraft(board("1800", "11.5"), { unit: "kg", effortMode: "rir" });
    if (result.ok) {
      throw new Error("the invalid board's numbers should break the set rules");
    }
    const sentences = result.issues.flatMap(({ rule }) =>
      isWordedSetInputRule(rule) ? [describeSetInputError(rule, "kg")] : [],
    );
    expect(sentences).toHaveLength(2);
  });

  it("should never echo what the person typed", () => {
    const typed = ["1800", "11.5", "2500", "52,5"];
    const ownNumbers = ["0", "1", "10", "100", "1000", "1,000", "2,204", "52.5"];
    const rules = [
      "load_not_a_number",
      "load_ambiguous_separator",
      "load_0_to_1000_kg",
      "reps_whole_1_to_100",
      "rir_whole_0_to_10",
    ] as const;
    for (const rule of rules) {
      for (const unit of ["kg", "lb"] as const) {
        const sentence = describeSetInputError(rule, unit);
        for (const text of typed) {
          expect(sentence).not.toContain(text);
        }
        for (const number of sentence.match(/\d[\d,.]*\d|\d/g) ?? []) {
          expect(ownNumbers).toContain(number);
        }
      }
    }
  });
});

describe("the sweep samples", () => {
  it("should give a row to every function the module exports", () => {
    const exportedFunctions = Object.entries({ ...sessionActiveCopy, ...sessionEntryCopy })
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name);
    expect(Object.keys(samples).sort()).toEqual(exportedFunctions.sort());
  });

  it("should produce sentences with no em dash from every sample", () => {
    for (const sentence of Object.values(samples).flatMap((call) => call())) {
      expect(sentence).not.toContain("—");
    }
  });

  it("should find strings in the fixed words", () => {
    expect(collectStrings({ ...sessionActiveCopy, ...sessionEntryCopy }).length).toBeGreaterThan(
      10,
    );
  });
});
