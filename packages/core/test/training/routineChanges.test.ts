import { describe, expect, it } from "vitest";

import {
  applyRoutineChanges,
  draftOfStoredRoutine,
  routineFingerprint,
  routinePayload,
  validateRoutineDraft,
} from "../../src/training";

import type {
  RoutineChange,
  RoutineDraft,
  RoutineDraftDay,
  RoutineDraftExercise,
} from "../../src/training";

const BENCH = "00000001-0000-4000-8000-000000000001";
const FLY = "00000001-0000-4000-8000-000000000002";
const ROW = "00000001-0000-4000-8000-000000000003";
const SQUAT = "00000001-0000-4000-8000-000000000004";
const PUSH_DAY = "00000003-0000-4000-8000-000000000001";
const PULL_DAY = "00000003-0000-4000-8000-000000000002";

const exercise = (overrides: Partial<RoutineDraftExercise> = {}): RoutineDraftExercise => ({
  exercise_id: BENCH,
  target_sets: 3,
  rep_min: 8,
  rep_max: 12,
  target_rir: 2,
  ...overrides,
});

const day = (overrides: Partial<RoutineDraftDay> = {}): RoutineDraftDay => ({
  id: PUSH_DAY,
  weekday: 0,
  name: "Push",
  exercises: [exercise(), exercise({ exercise_id: FLY, target_sets: 4, target_rir: null })],
  ...overrides,
});

const routine = (): RoutineDraft => ({
  name: "Push Pull",
  days: [
    day(),
    day({
      id: PULL_DAY,
      weekday: 2,
      name: "Pull",
      exercises: [exercise({ exercise_id: ROW, target_sets: 5, rep_min: 6, rep_max: 8 })],
    }),
  ],
});

const add = (overrides: Partial<Extract<RoutineChange, { op: "add" }>> = {}): RoutineChange => ({
  op: "add",
  dayId: PUSH_DAY,
  exerciseId: SQUAT,
  position: null,
  sets: 3,
  repMin: 5,
  repMax: 8,
  targetRir: 1,
  ...overrides,
});

const addDay = (
  overrides: Partial<Extract<RoutineChange, { op: "add_day" }>> = {},
): RoutineChange => ({
  op: "add_day",
  dayRef: "legs",
  name: "Legs",
  weekday: 4,
  position: null,
  ...overrides,
});

const updateDay = (
  overrides: Partial<Extract<RoutineChange, { op: "update_day" }>> = {},
): RoutineChange => ({
  op: "update_day",
  dayId: PUSH_DAY,
  name: null,
  weekday: null,
  position: null,
  ...overrides,
});

const setTargets = (
  overrides: Partial<Extract<RoutineChange, { op: "set_targets" }>> = {},
): RoutineChange => ({
  op: "set_targets",
  dayId: PUSH_DAY,
  exerciseId: BENCH,
  sets: null,
  repMin: null,
  repMax: null,
  targetRir: null,
  ...overrides,
});

const appliedDraft = (draft: RoutineDraft, changes: readonly RoutineChange[]): RoutineDraft => {
  const result = applyRoutineChanges(draft, changes);
  if (!result.ok) {
    throw new Error(`The changes were refused: ${JSON.stringify(result.problems)}`);
  }
  return result.draft;
};

const problemsOf = (draft: RoutineDraft, changes: readonly RoutineChange[]) => {
  const result = applyRoutineChanges(draft, changes);
  if (result.ok) {
    throw new Error("The changes were accepted");
  }
  return result.problems;
};

const exerciseIdsOf = (draft: RoutineDraft, dayIndex: number): string[] =>
  (draft.days[dayIndex]?.exercises ?? []).map((planned) => planned.exercise_id);

describe("applyRoutineChanges", () => {
  describe("add", () => {
    it("should put the exercise at the end of the day when it has no position", () => {
      const result = appliedDraft(routine(), [add()]);

      expect(exerciseIdsOf(result, 0)).toStrictEqual([BENCH, FLY, SQUAT]);
    });

    it("should put the exercise where its position says, pushing the others down", () => {
      const result = appliedDraft(routine(), [add({ position: 1 })]);

      expect(exerciseIdsOf(result, 0)).toStrictEqual([BENCH, SQUAT, FLY]);
    });

    it("should plan it with the sets, reps and target RIR of the change", () => {
      const result = appliedDraft(routine(), [
        add({ sets: 4, repMin: 6, repMax: 10, targetRir: 0 }),
      ]);

      expect(result.days[0]?.exercises[2]).toStrictEqual({
        exercise_id: SQUAT,
        target_sets: 4,
        rep_min: 6,
        rep_max: 10,
        target_rir: 0,
      });
    });

    it("should plan no target RIR when the change has none", () => {
      const result = appliedDraft(routine(), [add({ targetRir: null })]);

      expect(result.days[0]?.exercises[2]?.target_rir).toBeNull();
    });

    it("should refuse a position past the end of the day", () => {
      expect(problemsOf(routine(), [add({ position: 3 })])).toStrictEqual([
        { index: 0, rule: "position_invalid" },
      ]);
    });

    it("should refuse a negative position", () => {
      expect(problemsOf(routine(), [add({ position: -1 })])).toStrictEqual([
        { index: 0, rule: "position_invalid" },
      ]);
    });
  });

  describe("swap", () => {
    it("should put the new exercise in the same place, keeping the sets, reps and target RIR", () => {
      const result = appliedDraft(routine(), [
        { op: "swap", dayId: PUSH_DAY, exerciseId: FLY, newExerciseId: ROW },
      ]);

      expect(result.days[0]?.exercises).toStrictEqual([
        exercise(),
        exercise({ exercise_id: ROW, target_sets: 4, target_rir: null }),
      ]);
    });
  });

  describe("remove", () => {
    it("should take the exercise out and leave the others in order", () => {
      const result = appliedDraft(routine(), [
        { op: "remove", dayId: PUSH_DAY, exerciseId: BENCH },
      ]);

      expect(exerciseIdsOf(result, 0)).toStrictEqual([FLY]);
    });

    it("should keep a day that is left with no exercises", () => {
      const result = appliedDraft(routine(), [{ op: "remove", dayId: PULL_DAY, exerciseId: ROW }]);

      expect(result.days[1]).toStrictEqual(
        day({ id: PULL_DAY, weekday: 2, name: "Pull", exercises: [] }),
      );
    });
  });

  describe("set_targets", () => {
    it("should change the targets it names and keep the rest", () => {
      const result = appliedDraft(routine(), [setTargets({ sets: 5, targetRir: 0 })]);

      expect(result.days[0]?.exercises[0]).toStrictEqual(
        exercise({ target_sets: 5, target_rir: 0 }),
      );
    });

    it("should change the reps together", () => {
      const result = appliedDraft(routine(), [setTargets({ repMin: 3, repMax: 5 })]);

      expect(result.days[0]?.exercises[0]).toStrictEqual(exercise({ rep_min: 3, rep_max: 5 }));
    });

    it("should leave everything alone when it names nothing", () => {
      const result = appliedDraft(routine(), [setTargets()]);

      expect(result).toStrictEqual(routine());
    });
  });

  describe("add_day", () => {
    it("should add an empty day with no id at the end", () => {
      const result = appliedDraft(routine(), [addDay()]);

      expect(result.days[2]).toStrictEqual({
        id: null,
        weekday: 4,
        name: "Legs",
        exercises: [],
      });
    });

    it("should add the day where its position says", () => {
      const result = appliedDraft(routine(), [addDay({ position: 1 })]);

      expect(result.days.map((planned) => planned.name)).toStrictEqual(["Push", "Legs", "Pull"]);
    });

    it("should keep a new day that is left empty, and save_routine can take it", () => {
      const result = appliedDraft(routine(), [addDay()]);
      const validated = validateRoutineDraft(result);

      expect(validated.ok && routinePayload(validated.value).p_days[2]).toStrictEqual({
        id: null,
        weekday: 4,
        name: "Legs",
        exercises: [],
      });
    });

    it("should let a later add use the dayRef as its dayId", () => {
      const result = appliedDraft(routine(), [addDay(), add({ dayId: "legs" })]);

      expect(result.days[2]?.exercises).toStrictEqual([
        { exercise_id: SQUAT, target_sets: 3, rep_min: 5, rep_max: 8, target_rir: 1 },
      ]);
    });

    it("should let a later change use the dayRef after the day has moved", () => {
      const result = appliedDraft(routine(), [
        addDay(),
        updateDay({ dayId: "legs", position: 0 }),
        add({ dayId: "legs" }),
      ]);

      expect(result.days[0]?.exercises.map((planned) => planned.exercise_id)).toStrictEqual([
        SQUAT,
      ]);
    });

    it("should refuse a dayRef used twice", () => {
      expect(
        problemsOf(routine(), [addDay(), addDay({ name: "Legs 2", weekday: 5 })]),
      ).toStrictEqual([{ index: 1, rule: "day_ref_taken" }]);
    });

    it("should refuse a dayRef that is the id of a day the routine has", () => {
      expect(problemsOf(routine(), [addDay({ dayRef: PUSH_DAY })])).toStrictEqual([
        { index: 0, rule: "day_ref_taken" },
      ]);
    });

    it("should refuse a position past the end", () => {
      expect(problemsOf(routine(), [addDay({ position: 3 })])).toStrictEqual([
        { index: 0, rule: "position_invalid" },
      ]);
    });

    it("should refuse a day that would be the eighth", () => {
      const sevenDays: RoutineDraft = {
        name: "Every day",
        days: Array.from({ length: 7 }, (_, index) =>
          day({
            id: `00000003-0000-4000-8000-00000000010${index}`,
            weekday: index,
            name: `Day ${index}`,
          }),
        ),
      };

      expect(problemsOf(sevenDays, [addDay({ weekday: null })])).toStrictEqual([
        { index: 0, rule: "days_too_many" },
      ]);
    });
  });

  describe("update_day", () => {
    it("should rename the day and keep its weekday, place and exercises", () => {
      const result = appliedDraft(routine(), [updateDay({ name: "Chest day" })]);

      expect(result.days[0]).toStrictEqual(day({ name: "Chest day" }));
    });

    it("should move the day to another weekday", () => {
      const result = appliedDraft(routine(), [updateDay({ weekday: 3 })]);

      expect(result.days[0]?.weekday).toBe(3);
    });

    it("should move the day to the place its position says", () => {
      const result = appliedDraft(routine(), [updateDay({ position: 1 })]);

      expect(result.days.map((planned) => planned.name)).toStrictEqual(["Pull", "Push"]);
    });

    it("should keep a weekday when the change names none", () => {
      const result = appliedDraft(routine(), [updateDay({ name: "Chest day" })]);

      expect(result.days[0]?.weekday).toBe(0);
    });

    it("should refuse a position past the last day", () => {
      expect(problemsOf(routine(), [updateDay({ position: 2 })])).toStrictEqual([
        { index: 0, rule: "position_invalid" },
      ]);
    });
  });

  describe("every existing day keeps its id", () => {
    it("should keep the ids of the existing days through add_day and update_day, in their new order", () => {
      const result = appliedDraft(routine(), [
        addDay({ position: 0 }),
        updateDay({ dayId: PULL_DAY, name: "Back", position: 0 }),
        updateDay({ weekday: 5 }),
      ]);

      expect(result.days.map((planned) => planned.id)).toStrictEqual([PULL_DAY, null, PUSH_DAY]);
    });
  });

  describe("a day or exercise the routine does not have", () => {
    it("should refuse an unknown day with its rule and index and no value", () => {
      const problems = problemsOf(routine(), [add({ dayId: "no-such-day" })]);

      expect(problems).toStrictEqual([{ index: 0, rule: "day_not_found" }]);
    });

    it("should refuse an unknown day on every op that names one", () => {
      const changes: RoutineChange[] = [
        { op: "swap", dayId: "x", exerciseId: BENCH, newExerciseId: ROW },
        { op: "remove", dayId: "x", exerciseId: BENCH },
        setTargets({ dayId: "x" }),
        updateDay({ dayId: "x" }),
      ];

      expect(problemsOf(routine(), changes).map((problem) => problem.rule)).toStrictEqual([
        "day_not_found",
        "day_not_found",
        "day_not_found",
        "day_not_found",
      ]);
    });

    it("should refuse an exercise the day does not plan", () => {
      const problems = problemsOf(routine(), [{ op: "remove", dayId: PUSH_DAY, exerciseId: ROW }]);

      expect(problems).toStrictEqual([{ index: 0, rule: "exercise_not_found" }]);
    });

    it("should not carry an id, a name or a value in any problem", () => {
      const problems = problemsOf(routine(), [
        add({ dayId: "no-such-day" }),
        { op: "remove", dayId: PUSH_DAY, exerciseId: ROW },
      ]);

      expect(JSON.stringify(problems)).not.toMatch(/no-such-day|00000001|Push/);
    });
  });

  describe("an exercise a day plans twice", () => {
    const twice = (): RoutineDraft => ({
      name: "Push",
      days: [
        day({
          exercises: [
            exercise({ target_sets: 3 }),
            exercise({ exercise_id: FLY, target_sets: 4 }),
            exercise({ target_sets: 5 }),
          ],
        }),
      ],
    });

    it("should refuse a remove that does not say which", () => {
      expect(
        problemsOf(twice(), [{ op: "remove", dayId: PUSH_DAY, exerciseId: BENCH }]),
      ).toStrictEqual([{ index: 0, rule: "exercise_ambiguous" }]);
    });

    it("should refuse a swap and set_targets that do not say which", () => {
      const problems = problemsOf(twice(), [
        { op: "swap", dayId: PUSH_DAY, exerciseId: BENCH, newExerciseId: ROW },
        setTargets({ sets: 4 }),
      ]);

      expect(problems).toStrictEqual([
        { index: 0, rule: "exercise_ambiguous" },
        { index: 1, rule: "exercise_ambiguous" },
      ]);
    });

    it("should take the one the position names", () => {
      const result = appliedDraft(twice(), [
        { op: "remove", dayId: PUSH_DAY, exerciseId: BENCH, position: 2 },
      ]);

      expect(result.days[0]?.exercises.map((planned) => planned.target_sets)).toStrictEqual([3, 4]);
    });

    it("should change the targets of the one the position names", () => {
      const result = appliedDraft(twice(), [setTargets({ sets: 6, position: 0 })]);

      expect(result.days[0]?.exercises.map((planned) => planned.target_sets)).toStrictEqual([
        6, 4, 5,
      ]);
    });

    it("should refuse a position that holds another exercise", () => {
      const problems = problemsOf(twice(), [
        { op: "remove", dayId: PUSH_DAY, exerciseId: BENCH, position: 1 },
      ]);

      expect(problems).toStrictEqual([{ index: 0, rule: "exercise_not_found" }]);
    });

    it("should refuse a position past the end of the day", () => {
      const problems = problemsOf(twice(), [
        { op: "remove", dayId: PUSH_DAY, exerciseId: BENCH, position: 9 },
      ]);

      expect(problems).toStrictEqual([{ index: 0, rule: "exercise_not_found" }]);
    });
  });

  describe("a change that breaks a draft rule", () => {
    it("should refuse sets above the limit, naming the change that did it", () => {
      expect(
        problemsOf(routine(), [
          setTargets({ repMin: 13 }),
          setTargets({ dayId: PULL_DAY, exerciseId: ROW, sets: 99 }),
        ]),
      ).toStrictEqual([
        { index: 0, rule: "rep_range_inverted" },
        { index: 1, rule: "target_sets_invalid" },
      ]);
    });

    it("should refuse a weekday another day has", () => {
      expect(problemsOf(routine(), [updateDay({ weekday: 2 })])).toStrictEqual([
        { index: 0, rule: "weekday_repeated" },
      ]);
    });

    it("should refuse a blank name for a new day", () => {
      expect(problemsOf(routine(), [addDay({ name: "  " })])).toStrictEqual([
        { index: 0, rule: "day_name_blank" },
      ]);
    });

    it("should accept a weekday that is free by the end of the list, whatever the order it passed through", () => {
      const result = appliedDraft(routine(), [
        updateDay({ weekday: 2 }),
        updateDay({ dayId: PULL_DAY, weekday: 4 }),
      ]);

      expect(result.days.map((planned) => planned.weekday)).toStrictEqual([2, 4]);
    });
  });

  describe("all or nothing", () => {
    it("should return every problem and no draft when any change is refused", () => {
      const result = applyRoutineChanges(routine(), [
        add(),
        add({ dayId: "no-such-day" }),
        { op: "remove", dayId: PUSH_DAY, exerciseId: ROW },
      ]);

      expect(result).toStrictEqual({
        ok: false,
        problems: [
          { index: 1, rule: "day_not_found" },
          { index: 2, rule: "exercise_not_found" },
        ],
      });
    });

    it("should not change the draft it is given", () => {
      const original = routine();

      applyRoutineChanges(original, [add(), addDay(), updateDay({ name: "Other", position: 1 })]);

      expect(original).toStrictEqual(routine());
    });
  });

  describe("order of several changes", () => {
    it("should apply them one after the other", () => {
      const result = appliedDraft(routine(), [
        add({ position: 0 }),
        { op: "swap", dayId: PUSH_DAY, exerciseId: SQUAT, newExerciseId: ROW },
        setTargets({ exerciseId: ROW, sets: 6 }),
      ]);

      expect(result.days[0]?.exercises[0]).toStrictEqual({
        exercise_id: ROW,
        target_sets: 6,
        rep_min: 5,
        rep_max: 8,
        target_rir: 1,
      });
    });

    it("should refuse a change that names an exercise a later change adds", () => {
      const problems = problemsOf(routine(), [
        { op: "remove", dayId: PUSH_DAY, exerciseId: SQUAT },
        add(),
      ]);

      expect(problems).toStrictEqual([{ index: 0, rule: "exercise_not_found" }]);
    });

    it("should read a position against the draft as the earlier changes left it", () => {
      const result = appliedDraft(routine(), [
        { op: "remove", dayId: PUSH_DAY, exerciseId: BENCH },
        add({ position: 1 }),
      ]);

      expect(exerciseIdsOf(result, 0)).toStrictEqual([FLY, SQUAT]);
    });

    it("should return the draft as validateRoutineDraft cleans it", () => {
      const result = appliedDraft(routine(), [addDay({ name: "  Legs  " })]);

      expect(result.days[2]?.name).toBe("Legs");
    });
  });
});

describe("routineFingerprint", () => {
  const stored = (plannedIds: [string, string]) => ({
    name: "Push Pull",
    days: [
      {
        id: PUSH_DAY,
        weekday: 0,
        name: "Push",
        exercises: [
          {
            exercise_id: BENCH,
            target_sets: 3,
            rep_min: 8,
            rep_max: 12,
            target_rir: 2,
            exercise: { name: "Bench press" },
            id: plannedIds[0],
            position: 0,
          },
          {
            exercise_id: FLY,
            target_sets: 4,
            rep_min: 8,
            rep_max: 12,
            target_rir: null,
            exercise: { name: "Fly" },
            id: plannedIds[1],
            position: 1,
          },
        ],
      },
    ],
  });

  it("should be the same for a draft read back after a save with new routine_exercises ids", () => {
    const before = draftOfStoredRoutine(stored(["planned-1", "planned-2"]));
    const after = draftOfStoredRoutine(stored(["planned-9", "planned-8"]));

    expect(routineFingerprint(after)).toBe(routineFingerprint(before));
  });

  it("should be the same for a new day before the save and with its id after", () => {
    const before = appliedDraft(routine(), [addDay()]);
    const after: RoutineDraft = {
      ...before,
      days: before.days.map((planned) =>
        planned.id === null ? { ...planned, id: "00000003-0000-4000-8000-000000000009" } : planned,
      ),
    };

    expect(routineFingerprint(after)).toBe(routineFingerprint(before));
  });

  it("should be the same for the same draft twice", () => {
    expect(routineFingerprint(routine())).toBe(routineFingerprint(routine()));
  });

  it("should be text", () => {
    expect(typeof routineFingerprint(routine())).toBe("string");
  });

  const changed: [string, (draft: RoutineDraft) => RoutineDraft][] = [
    ["the routine name", (draft) => ({ ...draft, name: "Push Pull Legs" })],
    [
      "a day name",
      (draft) => ({
        ...draft,
        days: draft.days.map((planned, i) => (i === 0 ? { ...planned, name: "Chest" } : planned)),
      }),
    ],
    [
      "a weekday",
      (draft) => ({
        ...draft,
        days: draft.days.map((planned, i) => (i === 0 ? { ...planned, weekday: 1 } : planned)),
      }),
    ],
    [
      "a weekday cleared",
      (draft) => ({
        ...draft,
        days: draft.days.map((planned, i) => (i === 0 ? { ...planned, weekday: null } : planned)),
      }),
    ],
    ["the order of the days", (draft) => ({ ...draft, days: [...draft.days].reverse() })],
    ["a day added", (draft) => appliedDraft(draft, [addDay()])],
    ["an exercise added", (draft) => appliedDraft(draft, [add()])],
    [
      "an exercise removed",
      (draft) => appliedDraft(draft, [{ op: "remove", dayId: PUSH_DAY, exerciseId: BENCH }]),
    ],
    [
      "an exercise swapped",
      (draft) =>
        appliedDraft(draft, [
          { op: "swap", dayId: PUSH_DAY, exerciseId: BENCH, newExerciseId: SQUAT },
        ]),
    ],
    [
      "the order of the exercises",
      (draft) => ({
        ...draft,
        days: draft.days.map((planned, i) =>
          i === 0 ? { ...planned, exercises: [...planned.exercises].reverse() } : planned,
        ),
      }),
    ],
    ["the sets", (draft) => appliedDraft(draft, [setTargets({ sets: 4 })])],
    ["the lowest reps", (draft) => appliedDraft(draft, [setTargets({ repMin: 7 })])],
    ["the highest reps", (draft) => appliedDraft(draft, [setTargets({ repMax: 13 })])],
    ["the target RIR", (draft) => appliedDraft(draft, [setTargets({ targetRir: 3 })])],
    [
      "the target RIR cleared",
      (draft) => ({
        ...draft,
        days: draft.days.map((planned, i) =>
          i === 0
            ? {
                ...planned,
                exercises: planned.exercises.map((entry, j) =>
                  j === 0 ? { ...entry, target_rir: null } : entry,
                ),
              }
            : planned,
        ),
      }),
    ],
  ];

  it.each(changed)("should differ after %s changes", (_name, change) => {
    expect(routineFingerprint(change(routine()))).not.toBe(routineFingerprint(routine()));
  });

  it("should not run two fields together", () => {
    const left: RoutineDraft = { name: "ab", days: [day({ name: "c" })] };
    const right: RoutineDraft = { name: "a", days: [day({ name: "bc" })] };

    expect(routineFingerprint(left)).not.toBe(routineFingerprint(right));
  });
});
