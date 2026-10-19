import { MAX_EXERCISES_PER_ROUTINE_DAY } from "@keylow/core/training";

import { pushPullLegsDraft } from "./support/routineEditorFixtures";
import {
  draftOfState,
  routineDraftReducer,
  startingStateOf,
  summaryOf,
} from "../components/RoutineEditor";

// The folder's index brings the editor with it, which reads the theme and the router.
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

type EditorState = ReturnType<typeof startingStateOf>;
type EditorAction = Parameters<typeof routineDraftReducer>[1];

// The exercises of a day in the editor's draft: adding with the starting targets, editing the three fields
// from their text, and removing. The rows' words and the picker are the editor's tests.

const SIDE_LATERAL_RAISE = {
  id: "0000000a-0000-4000-8000-000000000002",
  name: "Side lateral raise",
};
const PULL_DAY = 1;

const start = (): EditorState => startingStateOf(pushPullLegsDraft);

const dayAt = (state: EditorState, position: number) => {
  const day = state.days[position];
  if (day === undefined) {
    throw new Error(`There is no day at ${position}`);
  }
  return day;
};

const exerciseAt = (state: EditorState, dayPosition: number, position: number) => {
  const exercise = dayAt(state, dayPosition).exercises[position];
  if (exercise === undefined) {
    throw new Error(`There is no exercise at ${position} of day ${dayPosition}`);
  }
  return exercise;
};

const run = (state: EditorState, ...actions: EditorAction[]): EditorState =>
  actions.reduce(routineDraftReducer, state);

const addToPull = (state: EditorState) =>
  routineDraftReducer(state, {
    type: "addExercise",
    dayKey: dayAt(state, PULL_DAY).key,
    exercise: SIDE_LATERAL_RAISE,
  });

const edit = (
  state: EditorState,
  position: number,
  field: "sets" | "reps" | "rir",
  text: string,
): EditorState =>
  routineDraftReducer(state, {
    type: "editExercise",
    dayKey: dayAt(state, PULL_DAY).key,
    key: exerciseAt(state, PULL_DAY, position).key,
    field,
    text,
  });

const pullExercise = (state: EditorState, position: number) =>
  draftOfState(state).days[PULL_DAY]?.exercises[position];

describe("the exercises a stored routine starts with", () => {
  it("should carry the name given for each exercise and give the same draft back", () => {
    const names = Object.fromEntries(
      pushPullLegsDraft.days.flatMap((day) =>
        day.exercises.map((exercise) => [exercise.exercise_id, `Name of ${exercise.exercise_id}`]),
      ),
    );

    const state = startingStateOf(pushPullLegsDraft, names);

    const first = exerciseAt(state, 0, 0);
    expect(first.name).toBe(`Name of ${first.exercise_id}`);
    expect(draftOfState(state)).toStrictEqual(pushPullLegsDraft);
  });

  it("should hold each field as the text the board draws: the sets, the range of reps and the RIR", () => {
    const row = exerciseAt(start(), 0, 0);

    expect([row.setsText, row.repsText, row.rirText]).toStrictEqual(["4", "8 to 12", "2"]);
  });

  it("should hold no RIR text for an exercise with no target", () => {
    const state = startingStateOf({
      name: "Routine",
      days: [
        {
          id: null,
          weekday: null,
          name: "Day",
          exercises: [
            {
              exercise_id: SIDE_LATERAL_RAISE.id,
              target_sets: 3,
              rep_min: 8,
              rep_max: 8,
              target_rir: null,
            },
          ],
        },
      ],
    });

    const row = exerciseAt(state, 0, 0);
    expect([row.repsText, row.rirText]).toStrictEqual(["8", ""]);
  });

  it("should give each exercise a key of its own, across the days", () => {
    const keys = start().days.flatMap((day) => day.exercises.map((exercise) => exercise.key));

    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("adding an exercise to a day", () => {
  it("should append it last with 3 sets, 8 to 12 reps and RIR 2", () => {
    const state = addToPull(start());

    expect(pullExercise(state, 5)).toStrictEqual({
      exercise_id: SIDE_LATERAL_RAISE.id,
      target_sets: 3,
      rep_min: 8,
      rep_max: 12,
      target_rir: 2,
    });
    const row = exerciseAt(state, PULL_DAY, 5);
    expect([row.name, row.setsText, row.repsText, row.rirText]).toStrictEqual([
      "Side lateral raise",
      "3",
      "8 to 12",
      "2",
    ]);
  });

  it("should count it in the day's exercises and sets, and in the sets a week", () => {
    const state = addToPull(start());

    expect(summaryOf(state).days[PULL_DAY]).toMatchObject({ exerciseCount: 6, setCount: 18 });
    expect(summaryOf(state).setsPerWeek).toBe(66);
  });

  it("should leave the other days and the open and closed days as they were", () => {
    const before = run(start(), { type: "toggleDay", key: dayAt(start(), 2).key });
    const after = addToPull(before);

    expect(after.days.map((day) => day.isOpen)).toStrictEqual(before.days.map((day) => day.isOpen));
    expect(after.days[0]).toBe(before.days[0]);
    expect(after.days[2]).toBe(before.days[2]);
  });

  it("should give the new row a key no other exercise has", () => {
    const state = addToPull(start());

    const keys = state.days.flatMap((day) => day.exercises.map((exercise) => exercise.key));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("should add the same exercise twice as two rows", () => {
    const state = addToPull(addToPull(start()));

    expect(dayAt(state, PULL_DAY).exercises).toHaveLength(7);
  });

  it(`should not add a ${MAX_EXERCISES_PER_ROUTINE_DAY + 1}st exercise to a day`, () => {
    let state = start();
    for (let added = 5; added < MAX_EXERCISES_PER_ROUTINE_DAY; added += 1) {
      state = addToPull(state);
    }
    expect(dayAt(state, PULL_DAY).exercises).toHaveLength(MAX_EXERCISES_PER_ROUTINE_DAY);

    expect(addToPull(state)).toBe(state);
  });
});

describe("editing the sets of an exercise", () => {
  it("should read the digits as the sets, and count them in the sets a week", () => {
    const state = edit(addToPull(start()), 5, "sets", "4");

    expect(pullExercise(state, 5)?.target_sets).toBe(4);
    expect(summaryOf(state).setsPerWeek).toBe(67);
  });

  it("should keep only the digits typed", () => {
    const state = edit(start(), 0, "sets", "4a.5");

    expect(exerciseAt(state, PULL_DAY, 0).setsText).toBe("45");
    expect(pullExercise(state, 0)?.target_sets).toBe(45);
  });

  it("should keep a number past the bounds as typed, for the checks to mark", () => {
    const state = edit(start(), 0, "sets", "99");

    expect(pullExercise(state, 0)?.target_sets).toBe(99);
  });

  it("should leave an emptied field unreadable and count it as no sets", () => {
    const state = edit(start(), 0, "sets", "");

    expect(pullExercise(state, 0)?.target_sets).toBeNaN();
    expect(exerciseAt(state, PULL_DAY, 0).setsText).toBe("");
    expect(summaryOf(state).days[PULL_DAY]?.setCount).toBe(12);
    expect(summaryOf(state).setsPerWeek).toBe(60);
  });

  it("should count a number too long to be a whole number as no sets", () => {
    const state = edit(start(), 0, "sets", "9".repeat(400));

    expect(summaryOf(state).setsPerWeek).toBe(60);
  });

  it("should touch only the exercise it was for", () => {
    const before = start();
    const after = edit(before, 2, "sets", "5");

    expect(pullExercise(after, 1)).toStrictEqual(pullExercise(before, 1));
    expect(after.days[0]).toBe(before.days[0]);
  });
});

describe("editing the reps of an exercise", () => {
  it.each([
    ["5 to 8", 5, 8],
    ["5-8", 5, 8],
    ["5 - 8", 5, 8],
    ["10 TO 12", 10, 12],
    ["8", 8, 8],
  ])("should read %s as the range %d to %d", (text, repMin, repMax) => {
    const exercise = pullExercise(edit(start(), 0, "reps", text), 0);

    expect([exercise?.rep_min, exercise?.rep_max]).toStrictEqual([repMin, repMax]);
  });

  it("should keep the text as typed while the range is not finished", () => {
    const state = edit(start(), 0, "reps", "8 to");

    const exercise = pullExercise(state, 0);
    expect(exerciseAt(state, PULL_DAY, 0).repsText).toBe("8 to");
    expect(exercise?.rep_min).toBe(8);
    expect(exercise?.rep_max).toBeNaN();
  });

  it("should leave both unreadable when the field is emptied", () => {
    const exercise = pullExercise(edit(start(), 0, "reps", ""), 0);

    expect(exercise?.rep_min).toBeNaN();
    expect(exercise?.rep_max).toBeNaN();
  });

  it("should leave both unreadable for words that are not a range", () => {
    const exercise = pullExercise(edit(start(), 0, "reps", "to 8"), 0);

    expect(exercise?.rep_min).toBeNaN();
    expect(exercise?.rep_max).toBeNaN();
  });

  it("should keep a range the wrong way round as typed, for the checks to mark", () => {
    const exercise = pullExercise(edit(start(), 0, "reps", "12 to 8"), 0);

    expect([exercise?.rep_min, exercise?.rep_max]).toStrictEqual([12, 8]);
  });

  it("should keep only digits, spaces, hyphens and the word to", () => {
    const state = edit(start(), 0, "reps", "8.5 to; 12!");

    expect(exerciseAt(state, PULL_DAY, 0).repsText).toBe("85 to 12");
  });
});

describe("editing the RIR of an exercise", () => {
  it("should read the digits as the target", () => {
    expect(pullExercise(edit(start(), 0, "rir", "1"), 0)?.target_rir).toBe(1);
  });

  it("should read an emptied field as no target, which the rules allow", () => {
    const state = edit(start(), 0, "rir", "");

    expect(pullExercise(state, 0)?.target_rir).toBeNull();
    expect(exerciseAt(state, PULL_DAY, 0).rirText).toBe("");
  });

  it("should keep only the digits typed", () => {
    expect(exerciseAt(edit(start(), 0, "rir", "-2"), PULL_DAY, 0).rirText).toBe("2");
  });
});

describe("removing an exercise", () => {
  it("should take that exercise out and leave the others in order", () => {
    const before = addToPull(start());
    const removed = exerciseAt(before, PULL_DAY, 1);

    const after = routineDraftReducer(before, {
      type: "removeExercise",
      dayKey: dayAt(before, PULL_DAY).key,
      key: removed.key,
    });

    expect(dayAt(after, PULL_DAY).exercises.map((exercise) => exercise.key)).toStrictEqual(
      dayAt(before, PULL_DAY)
        .exercises.filter((exercise) => exercise.key !== removed.key)
        .map((exercise) => exercise.key),
    );
  });

  it("should take away its exercise and sets from the day and the sets a week", () => {
    const before = addToPull(start());
    const after = routineDraftReducer(before, {
      type: "removeExercise",
      dayKey: dayAt(before, PULL_DAY).key,
      key: exerciseAt(before, PULL_DAY, 5).key,
    });

    expect(summaryOf(after).days[PULL_DAY]).toMatchObject({ exerciseCount: 5, setCount: 15 });
    expect(summaryOf(after).setsPerWeek).toBe(63);
  });

  it("should remove only one of two rows of the same exercise", () => {
    const before = addToPull(addToPull(start()));
    const after = routineDraftReducer(before, {
      type: "removeExercise",
      dayKey: dayAt(before, PULL_DAY).key,
      key: exerciseAt(before, PULL_DAY, 5).key,
    });

    expect(dayAt(after, PULL_DAY).exercises).toHaveLength(6);
  });

  it("should never give a removed row's key to the next exercise added", () => {
    const added = addToPull(start());
    const removedKey = exerciseAt(added, PULL_DAY, 5).key;
    const removed = routineDraftReducer(added, {
      type: "removeExercise",
      dayKey: dayAt(added, PULL_DAY).key,
      key: removedKey,
    });

    expect(exerciseAt(addToPull(removed), PULL_DAY, 5).key).not.toBe(removedKey);
  });
});

describe("the sets of a routine that can be counted", () => {
  it("should be the golden routine's 63 sets a week as it starts", () => {
    expect(summaryOf(start()).setsPerWeek).toBe(63);
  });
});
