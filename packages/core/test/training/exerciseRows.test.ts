import { describe, expect, it } from "vitest";

import { rowId } from "./historyRows";
import { goldenLegsDay, goldenPullDay } from "./routines";
import {
  goldenLegsSets,
  LEG_PRESS_ID,
  ROMANIAN_DEADLIFT_ID,
  SEATED_LEG_CURL_ID,
  SQUAT_ID,
  STANDING_CALF_RAISE_ID,
} from "./sessionRows";
import { exerciseSetRows, scaffoldSession, sessionExercises } from "../../src/training";

import type { SessionSet } from "./sessionRows";
import type { LastPerformanceSet } from "../../src/training";

const legs = scaffoldSession(goldenLegsDay);

const ADDED_EXERCISE_ID = rowId(1, 97);
const OTHER_ADDED_EXERCISE_ID = rowId(1, 96);

/** A set of an exercise the day does not plan, `minute` minutes after 20:00. */
const extraSet = (
  exerciseId: string,
  minute: number,
  overrides: Partial<SessionSet> = {},
): SessionSet => {
  const [template] = goldenLegsSets;
  if (template === undefined) {
    throw new Error("The golden Legs session holds sets");
  }
  return {
    ...template,
    id: rowId(5, 4000 + minute),
    exercise_id: exerciseId,
    position: 100 + minute,
    set_type: "working",
    reps: 12,
    load_kg: 20,
    rir: 2,
    performed_at: `2026-10-15T20:${String(minute).padStart(2, "0")}:00Z`,
    ...overrides,
  };
};

const stateAndNumber = (exercise: { rows: readonly { state: string; setNumber: number }[] }) =>
  exercise.rows.map((row) => `${row.state}:${row.setNumber}`);

describe("sessionExercises for the golden Legs session at 19:00", () => {
  const exercises = sessionExercises(legs, goldenLegsSets);

  it("should list the day's five exercises in the plan's order", () => {
    expect(exercises.map((exercise) => exercise.exerciseId)).toStrictEqual([
      SQUAT_ID,
      ROMANIAN_DEADLIFT_ID,
      LEG_PRESS_ID,
      SEATED_LEG_CURL_ID,
      STANDING_CALF_RAISE_ID,
    ]);
  });

  it("should give the squat 5 done rows, 2 warm-ups and then working sets 1 to 3", () => {
    const squat = exercises[0];

    expect(squat?.rows.map((row) => row.setType)).toStrictEqual([
      "warmup",
      "warmup",
      "working",
      "working",
      "working",
    ]);
    expect(squat && stateAndNumber(squat)).toStrictEqual([
      "done:0",
      "done:0",
      "done:1",
      "done:2",
      "done:3",
    ]);
  });

  it("should give the Romanian deadlift 3 done rows", () => {
    expect(exercises[1] && stateAndNumber(exercises[1])).toStrictEqual([
      "done:1",
      "done:2",
      "done:3",
    ]);
  });

  it("should give the leg press 2 done rows and set 3 as the next", () => {
    expect(exercises[2] && stateAndNumber(exercises[2])).toStrictEqual([
      "done:1",
      "done:2",
      "next:3",
    ]);
  });

  it("should leave the exercises after the next one to do, 3 curls and 4 calf raises", () => {
    expect(exercises[3] && stateAndNumber(exercises[3])).toStrictEqual([
      "todo:1",
      "todo:2",
      "todo:3",
    ]);
    expect(exercises[4] && stateAndNumber(exercises[4])).toStrictEqual([
      "todo:1",
      "todo:2",
      "todo:3",
      "todo:4",
    ]);
  });

  it("should mark exactly one row of the whole session as next", () => {
    const next = exercises
      .flatMap((exercise) => exercise.rows)
      .filter((row) => row.state === "next");

    expect(next).toHaveLength(1);
  });

  it("should hold the logged set on a done row and none on the others", () => {
    const [, , legPress] = exercises;

    expect(legPress?.rows.map((row) => row.set?.reps ?? null)).toStrictEqual([12, 11, null]);
  });
});

describe("sessionExercises for a fresh session", () => {
  const exercises = sessionExercises(legs, []);

  it("should give every planned set a row to do, with the first of the day as next", () => {
    expect(exercises.map(stateAndNumber)).toStrictEqual([
      ["next:1", "todo:2", "todo:3"],
      ["todo:1", "todo:2", "todo:3"],
      ["todo:1", "todo:2", "todo:3"],
      ["todo:1", "todo:2", "todo:3"],
      ["todo:1", "todo:2", "todo:3", "todo:4"],
    ]);
  });
});

describe("sessionExercises with the next set in a later exercise", () => {
  it("should mark the first unlogged set of the plan as next, not the first row of a later exercise", () => {
    const squatOnly = goldenLegsSets.filter((set) => set.exercise_id === SQUAT_ID);

    const exercises = sessionExercises(legs, squatOnly);

    expect(exercises[0] && stateAndNumber(exercises[0])).toStrictEqual([
      "done:0",
      "done:0",
      "done:1",
      "done:2",
      "done:3",
    ]);
    expect(exercises[1] && stateAndNumber(exercises[1])).toStrictEqual([
      "next:1",
      "todo:2",
      "todo:3",
    ]);
  });

  it("should leave nothing as next when every planned set is logged", () => {
    const everySet = [
      ...goldenLegsSets,
      extraSet(LEG_PRESS_ID, 1, { position: 40 }),
      ...[1, 2, 3].map((minute) => extraSet(SEATED_LEG_CURL_ID, 10 + minute)),
      ...[1, 2, 3, 4].map((minute) => extraSet(STANDING_CALF_RAISE_ID, 20 + minute)),
    ];

    const rows = sessionExercises(legs, everySet).flatMap((exercise) => exercise.rows);

    expect(rows.filter((row) => row.state !== "done")).toStrictEqual([]);
  });
});

describe("sessionExercises with sets beyond the plan", () => {
  it("should add a row for a set logged beyond the target, after the target's rows", () => {
    const sets = [...goldenLegsSets, extraSet(SQUAT_ID, 1, { position: 30 })];

    const [squat] = sessionExercises(legs, sets);

    expect(squat && stateAndNumber(squat)).toStrictEqual([
      "done:0",
      "done:0",
      "done:1",
      "done:2",
      "done:3",
      "done:4",
    ]);
  });

  it("should list an exercise that was added after the planned ones, with all its rows done", () => {
    const sets = [
      ...goldenLegsSets,
      extraSet(ADDED_EXERCISE_ID, 1),
      extraSet(ADDED_EXERCISE_ID, 2),
    ];

    const exercises = sessionExercises(legs, sets);

    expect(exercises.map((exercise) => exercise.exerciseId).slice(-2)).toStrictEqual([
      STANDING_CALF_RAISE_ID,
      ADDED_EXERCISE_ID,
    ]);
    expect(exercises.at(-1) && stateAndNumber(exercises.at(-1) ?? { rows: [] })).toStrictEqual([
      "done:1",
      "done:2",
    ]);
  });

  it("should list an added exercise that has only a warm-up, which is no working set", () => {
    const sets = [...goldenLegsSets, extraSet(ADDED_EXERCISE_ID, 1, { set_type: "warmup" })];

    const added = sessionExercises(legs, sets).at(-1);

    expect(added?.exerciseId).toBe(ADDED_EXERCISE_ID);
    expect(added && stateAndNumber(added)).toStrictEqual(["done:0"]);
  });

  it("should number drop and failure sets among the working sets, and keep their type", () => {
    const sets = [
      extraSet(ADDED_EXERCISE_ID, 1),
      extraSet(ADDED_EXERCISE_ID, 2, { set_type: "drop" }),
      extraSet(ADDED_EXERCISE_ID, 3, { set_type: "failure" }),
    ];

    const [added] = sessionExercises(null, sets);

    expect(added?.rows.map((row) => `${row.setType}:${row.setNumber}`)).toStrictEqual([
      "working:1",
      "drop:2",
      "failure:3",
    ]);
  });

  it("should leave a removed set out", () => {
    const [firstSquat] = goldenLegsSets;
    if (firstSquat === undefined) {
      throw new Error("The golden Legs session holds sets");
    }
    const sets = [
      { ...firstSquat, deleted_at: "2026-10-15T19:30:00Z" },
      ...goldenLegsSets.slice(1),
    ];

    const [squat] = sessionExercises(legs, sets);

    expect(squat?.rows).toHaveLength(4);
  });
});

describe("sessionExercises for a session with no plan", () => {
  it("should list only the exercises that have sets, in the order they were first logged", () => {
    const sets = [
      extraSet(OTHER_ADDED_EXERCISE_ID, 1, { position: 0 }),
      extraSet(ADDED_EXERCISE_ID, 2, { position: 1 }),
      extraSet(OTHER_ADDED_EXERCISE_ID, 3, { position: 2 }),
    ];

    const exercises = sessionExercises(null, sets);

    expect(exercises.map((exercise) => exercise.exerciseId)).toStrictEqual([
      OTHER_ADDED_EXERCISE_ID,
      ADDED_EXERCISE_ID,
    ]);
    expect(exercises.map(stateAndNumber)).toStrictEqual([["done:1", "done:2"], ["done:1"]]);
  });

  it("should list nothing for a session with no sets", () => {
    expect(sessionExercises(null, [])).toStrictEqual([]);
  });

  it("should never mark a row as next", () => {
    const rows = sessionExercises(null, goldenLegsSets).flatMap((exercise) => exercise.rows);

    expect(rows.some((row) => row.state !== "done")).toBe(false);
  });
});

describe("sessionExercises with exercises added and no set logged yet", () => {
  it("should list an added exercise after the plan's, with one row to do", () => {
    const exercises = sessionExercises(legs, goldenLegsSets, [ADDED_EXERCISE_ID]);

    expect(exercises.map((exercise) => exercise.exerciseId)).toStrictEqual([
      SQUAT_ID,
      ROMANIAN_DEADLIFT_ID,
      LEG_PRESS_ID,
      SEATED_LEG_CURL_ID,
      STANDING_CALF_RAISE_ID,
      ADDED_EXERCISE_ID,
    ]);
    expect(stateAndNumber(exercises[5] ?? { rows: [] })).toStrictEqual(["todo:1"]);
  });

  it("should leave the plan's own next set as next", () => {
    const exercises = sessionExercises(legs, goldenLegsSets, [ADDED_EXERCISE_ID]);

    expect(
      exercises.flatMap((exercise) => exercise.rows).filter((row) => row.state === "next"),
    ).toHaveLength(1);
    expect(stateAndNumber(exercises[2] ?? { rows: [] })).toStrictEqual([
      "done:1",
      "done:2",
      "next:3",
    ]);
  });

  it("should list the added exercises in the order they were added", () => {
    const exercises = sessionExercises(null, [], [OTHER_ADDED_EXERCISE_ID, ADDED_EXERCISE_ID]);

    expect(exercises.map((exercise) => exercise.exerciseId)).toStrictEqual([
      OTHER_ADDED_EXERCISE_ID,
      ADDED_EXERCISE_ID,
    ]);
  });

  it("should make the first added exercise the next set when the plan has none left", () => {
    const exercises = sessionExercises(null, [], [OTHER_ADDED_EXERCISE_ID, ADDED_EXERCISE_ID]);

    expect(exercises.map(stateAndNumber)).toStrictEqual([["next:1"], ["todo:1"]]);
  });

  it("should list an added exercise after the exercises that have sets in a session with no plan", () => {
    const sets = [extraSet(OTHER_ADDED_EXERCISE_ID, 1)];

    const exercises = sessionExercises(null, sets, [ADDED_EXERCISE_ID]);

    expect(exercises.map((exercise) => exercise.exerciseId)).toStrictEqual([
      OTHER_ADDED_EXERCISE_ID,
      ADDED_EXERCISE_ID,
    ]);
    expect(exercises.map(stateAndNumber)).toStrictEqual([["done:1"], ["next:1"]]);
  });

  it("should ignore an added exercise that already has sets", () => {
    const sets = [extraSet(ADDED_EXERCISE_ID, 1), extraSet(ADDED_EXERCISE_ID, 2)];

    const exercises = sessionExercises(null, sets, [ADDED_EXERCISE_ID]);

    expect(exercises.map((exercise) => exercise.exerciseId)).toStrictEqual([ADDED_EXERCISE_ID]);
    expect(exercises.map(stateAndNumber)).toStrictEqual([["done:1", "done:2"]]);
  });

  it("should ignore an added exercise whose only set is a warm-up", () => {
    const sets = [extraSet(ADDED_EXERCISE_ID, 1, { set_type: "warmup" })];

    const exercises = sessionExercises(null, sets, [ADDED_EXERCISE_ID]);

    expect(exercises.map(stateAndNumber)).toStrictEqual([["done:0"]]);
  });

  it("should ignore an added exercise that the plan already lists", () => {
    const exercises = sessionExercises(legs, [], [SQUAT_ID]);

    expect(exercises.map((exercise) => exercise.exerciseId)).toStrictEqual([
      SQUAT_ID,
      ROMANIAN_DEADLIFT_ID,
      LEG_PRESS_ID,
      SEATED_LEG_CURL_ID,
      STANDING_CALF_RAISE_ID,
    ]);
    expect(stateAndNumber(exercises[0] ?? { rows: [] })).toStrictEqual([
      "next:1",
      "todo:2",
      "todo:3",
    ]);
  });

  it("should list an exercise added twice once", () => {
    const exercises = sessionExercises(null, [], [ADDED_EXERCISE_ID, ADDED_EXERCISE_ID]);

    expect(exercises.map(stateAndNumber)).toStrictEqual([["next:1"]]);
  });

  it("should list the same exercises as before when nothing is added", () => {
    expect(sessionExercises(legs, goldenLegsSets, [])).toStrictEqual(
      sessionExercises(legs, goldenLegsSets),
    );
  });

  it("should give the row the numbers the next set is opened with", () => {
    const [added] = sessionExercises(null, [], [ADDED_EXERCISE_ID]);
    if (added === undefined) {
      throw new Error("The added exercise is listed");
    }
    const previousSets = [lastTimeSet(0, { reps: 12, load_kg: 22.5 })];

    const [row] = exerciseSetRows(added, [], previousSets);

    expect(row?.entry).toStrictEqual({ state: "ready", loadKg: 22.5, reps: 12 });
  });
});

describe("sessionExercises for another plan", () => {
  it("should plan the Pull day's first exercise as the next with no sets logged", () => {
    const [first] = sessionExercises(scaffoldSession(goldenPullDay), []);

    expect(first?.rows[0]?.state).toBe("next");
  });
});

/** A working set of the session before, 8 reps of 45 kg unless overridden. */
const lastTimeSet = (
  position: number,
  overrides: Partial<LastPerformanceSet> = {},
): LastPerformanceSet => ({
  id: rowId(6, 3000 + position),
  position,
  set_type: "working",
  reps: 8,
  load_kg: 45,
  rir: 3,
  rpe: null,
  performed_at: `2026-10-08T18:${String(10 + position).padStart(2, "0")}:00Z`,
  deleted_at: null,
  ...overrides,
});

const LEG_PRESS_LAST_TIME: LastPerformanceSet[] = [
  lastTimeSet(0, { reps: 12, load_kg: 170 }),
  lastTimeSet(1, { reps: 11, load_kg: 170 }),
  lastTimeSet(2, { reps: 10, load_kg: 170 }),
];

const legPressRows = (previousSets: readonly LastPerformanceSet[]) => {
  const legPress = sessionExercises(legs, goldenLegsSets)[2];
  if (legPress === undefined) {
    throw new Error("The golden Legs day plans the leg press third");
  }
  return exerciseSetRows(legPress, goldenLegsSets, previousSets);
};

describe("exerciseSetRows for the golden leg press", () => {
  it("should give done rows their logged numbers, and the next row the numbers its entry opens with", () => {
    expect(legPressRows(LEG_PRESS_LAST_TIME).map((row) => row.entry)).toStrictEqual([
      { state: "logged", loadKg: 180, reps: 12, rir: 1 },
      { state: "logged", loadKg: 180, reps: 11, rir: 1 },
      { state: "ready", loadKg: 180, reps: 11 },
    ]);
  });

  it("should give each row the same set of the session before as its previous", () => {
    expect(legPressRows(LEG_PRESS_LAST_TIME).map((row) => row.previous)).toStrictEqual([
      { loadKg: 170, reps: 12 },
      { loadKg: 170, reps: 11 },
      { loadKg: 170, reps: 10 },
    ]);
  });

  it("should give no previous when there is no earlier session", () => {
    expect(legPressRows([]).map((row) => row.previous)).toStrictEqual([null, null, null]);
  });

  it("should give a set past the earlier session's sets no previous", () => {
    expect(legPressRows(LEG_PRESS_LAST_TIME.slice(0, 2)).map((row) => row.previous)).toStrictEqual([
      { loadKg: 170, reps: 12 },
      { loadKg: 170, reps: 11 },
      null,
    ]);
  });

  it("should carry each row's state, type and number through", () => {
    expect(
      legPressRows([]).map(({ state, setType, setNumber }) => ({ state, setType, setNumber })),
    ).toStrictEqual([
      { state: "done", setType: "working", setNumber: 1 },
      { state: "done", setType: "working", setNumber: 2 },
      { state: "next", setType: "working", setNumber: 3 },
    ]);
  });
});

describe("exerciseSetRows ids", () => {
  it("should name the logged set of a done row, and no set for the rows still to come", () => {
    const loggedIds = goldenLegsSets
      .filter((set) => set.exercise_id === LEG_PRESS_ID)
      .map((set) => set.id);

    expect(legPressRows([]).map((row) => row.setId)).toStrictEqual([...loggedIds, null]);
  });
});

describe("exerciseSetRows for rows still to come", () => {
  const rowsOf = (index: number, previousSets: readonly LastPerformanceSet[]) => {
    const exercise = sessionExercises(legs, goldenLegsSets)[index];
    if (exercise === undefined) {
      throw new Error("The golden Legs day plans five exercises");
    }
    return exerciseSetRows(exercise, goldenLegsSets, previousSets);
  };

  it("should give a row to do an empty entry", () => {
    expect(rowsOf(3, []).map((row) => row.entry)).toStrictEqual([
      { state: "empty" },
      { state: "empty" },
      { state: "empty" },
    ]);
  });

  it("should open the next row of an exercise with no set yet on the earlier session's first set", () => {
    const squatOnly = goldenLegsSets.filter((set) => set.exercise_id === SQUAT_ID);
    const exercise = sessionExercises(legs, squatOnly)[1];
    if (exercise === undefined) {
      throw new Error("The golden Legs day plans five exercises");
    }

    const [next] = exerciseSetRows(exercise, squatOnly, [
      lastTimeSet(0, { reps: 10, load_kg: 87.5 }),
    ]);

    expect(next?.entry).toStrictEqual({ state: "ready", loadKg: 87.5, reps: 10 });
  });

  it("should open the next row empty when there is nothing to open it with", () => {
    const [first] = sessionExercises(legs, []);
    if (first === undefined) {
      throw new Error("The golden Legs day plans five exercises");
    }

    const [next] = exerciseSetRows(first, [], []);

    expect(next).toMatchObject({ state: "next", entry: { state: "empty" } });
  });
});

describe("exerciseSetRows with a warm-up among the earlier session's sets", () => {
  it("should leave the warm-up out when it numbers the sets, so set 1 takes the first working set", () => {
    const squat = sessionExercises(legs, goldenLegsSets)[0];
    if (squat === undefined) {
      throw new Error("The golden Legs day plans the squat first");
    }
    const earlierSets = [
      lastTimeSet(0, { set_type: "warmup", reps: 5, load_kg: 40 }),
      lastTimeSet(1, { reps: 8, load_kg: 95 }),
      lastTimeSet(2, { reps: 7, load_kg: 95 }),
    ];

    const rows = exerciseSetRows(squat, goldenLegsSets, earlierSets);

    expect(rows.map((row) => row.previous)).toStrictEqual([
      null,
      null,
      { loadKg: 95, reps: 8 },
      { loadKg: 95, reps: 7 },
      null,
    ]);
  });
});

describe("exerciseSetRows for warm-ups", () => {
  it("should give a warm-up row no previous, since the earlier session's sets are working sets", () => {
    const squat = sessionExercises(legs, goldenLegsSets)[0];
    if (squat === undefined) {
      throw new Error("The golden Legs day plans the squat first");
    }

    const rows = exerciseSetRows(squat, goldenLegsSets, [lastTimeSet(0, { reps: 8, load_kg: 95 })]);

    expect(rows.map((row) => row.previous)).toStrictEqual([
      null,
      null,
      { loadKg: 95, reps: 8 },
      null,
      null,
    ]);
  });

  it("should give a warm-up row no RIR and keep its type", () => {
    const squat = sessionExercises(legs, goldenLegsSets)[0];
    if (squat === undefined) {
      throw new Error("The golden Legs day plans the squat first");
    }

    const [warmup] = exerciseSetRows(squat, goldenLegsSets, []);

    expect(warmup).toMatchObject({
      setType: "warmup",
      entry: { state: "logged", loadKg: 60, reps: 8, rir: null },
    });
  });
});
