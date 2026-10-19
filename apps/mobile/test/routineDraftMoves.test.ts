import { pushPullLegsDraft } from "./support/routineEditorFixtures";
import { draftOfState, routineDraftReducer, startingStateOf } from "../components/RoutineEditor";

// The folder's index brings the editor with it, which reads the theme and the router.
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

type EditorState = ReturnType<typeof startingStateOf>;

// Moving a day or an exercise one place, and opening the days that hold a problem. The order of the state is
// the order of the draft, and so of the saved routine.

const start = (): EditorState => startingStateOf(pushPullLegsDraft);
const dayNames = (state: EditorState) => state.days.map((day) => day.name);
const keyOfDay = (state: EditorState, position: number): number => {
  const day = state.days[position];
  if (day === undefined) {
    throw new Error(`There is no day at ${position}`);
  }
  return day.key;
};
const exerciseIds = (state: EditorState, dayPosition: number) =>
  state.days[dayPosition]?.exercises.map((exercise) => exercise.exercise_id) ?? [];

describe("moving a day", () => {
  it("should move a day down one place", () => {
    const state = start();

    const moved = routineDraftReducer(state, {
      type: "moveDay",
      key: keyOfDay(state, 0),
      by: "down",
    });

    expect(dayNames(moved)).toStrictEqual(["Pull", "Push", "Legs", "Push"]);
  });

  it("should move a day up one place", () => {
    const state = start();

    const moved = routineDraftReducer(state, {
      type: "moveDay",
      key: keyOfDay(state, 2),
      by: "up",
    });

    expect(dayNames(moved)).toStrictEqual(["Push", "Legs", "Pull", "Push"]);
  });

  it("should keep a day's weekday, id and exercises with it", () => {
    const state = start();

    const moved = routineDraftReducer(state, {
      type: "moveDay",
      key: keyOfDay(state, 2),
      by: "up",
    });

    expect(draftOfState(moved).days[1]).toStrictEqual(draftOfState(state).days[2]);
  });

  it("should leave the first day where it is when asked to move up, and the last when asked to move down", () => {
    const state = start();

    expect(routineDraftReducer(state, { type: "moveDay", key: keyOfDay(state, 0), by: "up" })).toBe(
      state,
    );
    expect(
      routineDraftReducer(state, { type: "moveDay", key: keyOfDay(state, 3), by: "down" }),
    ).toBe(state);
  });
});

describe("moving an exercise", () => {
  const legsDay = 2;

  it("should move an exercise down within its day", () => {
    const state = start();
    const [first, second, ...rest] = exerciseIds(state, legsDay);
    const key = state.days[legsDay]?.exercises[0]?.key ?? -1;

    const moved = routineDraftReducer(state, {
      type: "moveExercise",
      dayKey: keyOfDay(state, legsDay),
      key,
      by: "down",
    });

    expect(exerciseIds(moved, legsDay)).toStrictEqual([second, first, ...rest]);
  });

  it("should move an exercise up within its day and leave the other days alone", () => {
    const state = start();
    const [first, second, ...rest] = exerciseIds(state, legsDay);
    const key = state.days[legsDay]?.exercises[1]?.key ?? -1;

    const moved = routineDraftReducer(state, {
      type: "moveExercise",
      dayKey: keyOfDay(state, legsDay),
      key,
      by: "up",
    });

    expect(exerciseIds(moved, legsDay)).toStrictEqual([second, first, ...rest]);
    expect(exerciseIds(moved, 0)).toStrictEqual(exerciseIds(state, 0));
  });

  it("should keep what was typed in an exercise's fields with it", () => {
    const state = start();
    const key = state.days[legsDay]?.exercises[0]?.key ?? -1;

    const moved = routineDraftReducer(state, {
      type: "moveExercise",
      dayKey: keyOfDay(state, legsDay),
      key,
      by: "down",
    });

    expect(moved.days[legsDay]?.exercises[1]).toStrictEqual(state.days[legsDay]?.exercises[0]);
  });

  it("should leave the first exercise where it is when asked to move up, and the last when asked to move down", () => {
    const state = start();
    const exercises = state.days[legsDay]?.exercises ?? [];
    const dayKey = keyOfDay(state, legsDay);

    expect(
      routineDraftReducer(state, {
        type: "moveExercise",
        dayKey,
        key: exercises[0]?.key ?? -1,
        by: "up",
      }),
    ).toBe(state);
    expect(
      routineDraftReducer(state, {
        type: "moveExercise",
        dayKey,
        key: exercises[exercises.length - 1]?.key ?? -1,
        by: "down",
      }),
    ).toBe(state);
  });
});

describe("opening the days that hold a problem", () => {
  it("should open the days given and leave the others as they were", () => {
    const state = start();

    const opened = routineDraftReducer(state, {
      type: "openDays",
      keys: [keyOfDay(state, 1), keyOfDay(state, 3)],
    });

    expect(opened.days.map((day) => day.isOpen)).toStrictEqual([false, true, false, true]);
  });

  it("should leave a day that is open open", () => {
    const state = routineDraftReducer(start(), { type: "toggleDay", key: 0 });

    const opened = routineDraftReducer(state, { type: "openDays", keys: [0] });

    expect(opened.days[0]?.isOpen).toBe(true);
  });
});
