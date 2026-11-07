import { describe, expect, it } from "vitest";

import { assistantCardSchema, buildRoutineUpdatedCard } from "../../src/assistant";
import { describeWorkoutInProgressRefusal, REMOVE_DAY_REFUSAL } from "../../src/copy";

import type { RoutineUpdatedChange } from "../../src/assistant";

const routineId = "00000000-0000-4000-8000-0000000000e2";
const routineName = "Push Pull Legs";

const build = (changes: readonly RoutineUpdatedChange[]) =>
  buildRoutineUpdatedCard({ routineId, routineName, changes });

const added: RoutineUpdatedChange = {
  op: "add",
  dayName: "Legs",
  exerciseName: "Leg extension",
  targets: { sets: 3, repMin: 12, repMax: 15, targetRir: 1 },
};
const swapped: RoutineUpdatedChange = {
  op: "swap",
  dayName: "Legs",
  oldExerciseName: "Leg press",
  newExerciseName: "Hack squat",
  targets: { sets: 3, repMin: 10, repMax: 12, targetRir: 1 },
};
const removed: RoutineUpdatedChange = {
  op: "remove",
  dayName: "Legs",
  exerciseName: "Seated leg curl",
};
const changed: RoutineUpdatedChange = {
  op: "set_targets",
  dayName: "Legs",
  exerciseName: "Barbell squat",
  now: { sets: 4, repMin: 5, repMax: 8, targetRir: 2 },
  was: { sets: 3, repMin: 5, repMax: 8, targetRir: 2 },
};

describe("buildRoutineUpdatedCard, the board's four changes in one day", () => {
  const card = build([added, swapped, removed, changed]);

  it("should title the card with the routine and link to the routine editor", () => {
    expect(card.kind).toBe("routine_updated");
    expect(card.title).toBe("Updated routine Push Pull Legs");
    expect(card.link).toEqual({
      label: "Open in routine editor",
      target: { screen: "routine_editor", routineId },
    });
  });

  it("should say the day and the count in the sub and the count in the change detail", () => {
    expect(card.sub).toBe("Legs · 4 changes");
    expect(card.changeDetail).toBe("4 changes");
  });

  it("should word every row as the board does", () => {
    expect(card.rows.map(({ name, amountText }) => [name, amountText])).toEqual([
      ["Added Leg extension", "Legs · 3 sets, 12 to 15 reps, RIR 1"],
      ["Swapped Leg press for Hack squat", "Legs · 3 sets, 10 to 12 reps, RIR 1"],
      ["Removed Seated leg curl", "Legs"],
      ["Changed Barbell squat", "Legs · 4 sets, was 3 · 5 to 8 reps, RIR 2"],
    ]);
  });

  it("should offer Undo and say what Undo puts back", () => {
    expect(card.undo).toBe("available");
    expect(card.undoneSub).toBe("Put Push Pull Legs back as it was");
    expect(card.note).toBeNull();
  });

  it("should draft a card the contract accepts", () => {
    expect(
      assistantCardSchema.safeParse({
        actionIds: ["00000000-0000-4000-8000-0000000000d1"],
        ...card,
      }).success,
    ).toBe(true);
  });
});

describe("buildRoutineUpdatedCard, the sub", () => {
  it("should say '1 change' for one change in one day", () => {
    expect(build([removed]).sub).toBe("Legs · 1 change");
  });

  it("should say the count alone when the changes are in more than one day", () => {
    const push: RoutineUpdatedChange = { ...removed, dayName: "Push" };

    expect(build([removed, push]).sub).toBe("2 changes");
  });

  it("should say the count alone when a day change comes with an exercise change", () => {
    const renamed: RoutineUpdatedChange = {
      op: "rename_day",
      oldName: "Legs",
      newName: "Lower",
      weekday: 3,
    };

    expect(build([removed, renamed]).sub).toBe("2 changes");
  });

  it("should say 'changes to days' when only days changed", () => {
    const addedDay: RoutineUpdatedChange = {
      op: "add_day",
      dayName: "Arms",
      weekday: 5,
      exerciseCount: 0,
    };
    const renamed: RoutineUpdatedChange = {
      op: "rename_day",
      oldName: "Push",
      newName: "Chest and shoulders",
      weekday: 0,
    };
    const moved: RoutineUpdatedChange = {
      op: "move_day_weekday",
      dayName: "Legs",
      weekday: 4,
      was: 3,
    };
    const card = build([addedDay, renamed, moved]);

    expect(card.sub).toBe("3 changes to days");
    expect(card.changeDetail).toBe("3 changes");
    expect(card.rows.map(({ name, amountText }) => [name, amountText])).toEqual([
      ["Added day Arms", "Saturday · no exercises yet"],
      ["Renamed Push to Chest and shoulders", "Monday"],
      ["Moved Legs to Friday", "Was Thursday"],
    ]);
  });

  it("should say '1 change to days' for a single day change", () => {
    const moved: RoutineUpdatedChange = {
      op: "move_day_weekday",
      dayName: "Legs",
      weekday: 4,
      was: null,
    };

    expect(build([moved]).sub).toBe("1 change to days");
    expect(build([moved]).rows[0]?.amountText).toBe("Was any day");
  });
});

describe("buildRoutineUpdatedCard, the rows", () => {
  it("should leave the RIR out of an added exercise that has none", () => {
    const row = build([{ ...added, targets: { sets: 3, repMin: 8, repMax: 8, targetRir: null } }])
      .rows[0];

    expect(row?.amountText).toBe("Legs · 3 sets, 8 reps");
  });

  it("should say '1 set' and '1 rep' as one", () => {
    const row = build([{ ...added, targets: { sets: 1, repMin: 1, repMax: 1, targetRir: 0 } }])
      .rows[0];

    expect(row?.amountText).toBe("Legs · 1 set, 1 rep, RIR 0");
  });

  it("should give a swap with unknown numbers the day only", () => {
    expect(build([{ ...swapped, targets: null }]).rows[0]?.amountText).toBe("Legs");
  });

  it("should say what a changed rep range and a changed RIR were", () => {
    const row = build([
      {
        ...changed,
        now: { sets: 3, repMin: 6, repMax: 10, targetRir: 1 },
        was: { sets: 3, repMin: 5, repMax: 8, targetRir: null },
      },
    ]).rows[0];

    expect(row?.amountText).toBe("Legs · 3 sets · 6 to 10 reps, was 5 to 8, RIR 1, was not set");
  });

  it("should word changed numbers without a 'was' when the old numbers are not known", () => {
    const row = build([{ ...changed, was: null }]).rows[0];

    expect(row?.amountText).toBe("Legs · 4 sets · 5 to 8 reps, RIR 2");
  });

  it("should give changed targets whose numbers are not known the day only", () => {
    const row = build([{ ...changed, now: null, was: null }]).rows[0];

    expect(row?.name).toBe("Changed Barbell squat");
    expect(row?.amountText).toBe("Legs");
  });

  it("should say the weekday of an added day that already has exercises, and no exercises yet otherwise", () => {
    const withExercises = build([
      { op: "add_day", dayName: "Arms", weekday: null, exerciseCount: 2 },
    ]).rows[0];
    const empty = build([{ op: "add_day", dayName: "Arms", weekday: null, exerciseCount: 0 }])
      .rows[0];

    expect(withExercises?.amountText).toBe("Any day");
    expect(empty?.amountText).toBe("Any day · no exercises yet");
  });

  it("should word a day moved to another place in the routine", () => {
    const row = build([{ op: "reorder_day", dayName: "Legs", place: 2 }]).rows[0];

    expect(row?.name).toBe("Moved Legs to day 2");
  });
});

describe("the refusal words", () => {
  it("should say what the press says when a workout started, in two paragraphs", () => {
    expect(describeWorkoutInProgressRefusal().split("\n\n")).toEqual([
      "Your workout is in progress, so nothing in your training can change yet. Questions are still fine.",
      "Finish it or discard it on the Train tab, then ask again.",
    ]);
  });

  it("should say what the board says when a day cannot be removed here", () => {
    expect(REMOVE_DAY_REFUSAL).toBe(
      "A day can only be removed in the routine editor, because removing it unlinks the sessions you logged from it. Exercises can be changed here.",
    );
  });
});
