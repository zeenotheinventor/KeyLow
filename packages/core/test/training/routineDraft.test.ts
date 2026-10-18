import { describe, expect, it } from "vitest";

import { goldenRoutineDraft } from "./routines";
import { validateRoutineDraft } from "../../src/training";

import type { RoutineDraft, RoutineDraftDay, RoutineDraftExercise } from "../../src/training";

const exercise = (overrides: Partial<RoutineDraftExercise> = {}): RoutineDraftExercise => ({
  exercise_id: "00000001-0000-4000-8000-000000000001",
  target_sets: 3,
  rep_min: 8,
  rep_max: 12,
  target_rir: 2,
  ...overrides,
});

const day = (overrides: Partial<RoutineDraftDay> = {}): RoutineDraftDay => ({
  id: null,
  weekday: null,
  name: "Push",
  exercises: [exercise()],
  ...overrides,
});

const draft = (overrides: Partial<RoutineDraft> = {}): RoutineDraft => ({
  name: "Push Pull Legs",
  days: [day()],
  ...overrides,
});

/** The issues of a draft, or a failure when the draft was accepted. */
const issuesOf = (routineDraft: RoutineDraft) => {
  const result = validateRoutineDraft(routineDraft);
  if (result.ok) {
    throw new Error("The draft was accepted");
  }
  return result.problems;
};

const withExercise = (overrides: Partial<RoutineDraftExercise>): RoutineDraft =>
  draft({ days: [day({ exercises: [exercise(overrides)] })] });

describe("validateRoutineDraft", () => {
  describe("a draft that is fine", () => {
    it("should accept the golden routine and return it as it is", () => {
      const result = validateRoutineDraft(goldenRoutineDraft);

      expect(result).toStrictEqual({ ok: true, value: goldenRoutineDraft });
    });

    it("should accept a routine with no days, and a day with no exercises", () => {
      expect(validateRoutineDraft(draft({ days: [] })).ok).toBe(true);
      expect(validateRoutineDraft(draft({ days: [day({ exercises: [] })] })).ok).toBe(true);
    });

    it("should trim the routine name and the day names", () => {
      const result = validateRoutineDraft(
        draft({ name: "  Push Pull Legs ", days: [day({ name: " Push  " })] }),
      );

      expect(result).toStrictEqual({
        ok: true,
        value: draft({ name: "Push Pull Legs", days: [day({ name: "Push" })] }),
      });
    });

    it("should keep the id of a day that has one and leave a new day without", () => {
      const result = validateRoutineDraft(
        draft({
          days: [
            day({ id: "00000003-0000-4000-8000-000000000001", weekday: 0 }),
            day({ id: null, weekday: 2 }),
          ],
        }),
      );

      expect(result.ok && result.value.days.map((cleaned) => cleaned.id)).toStrictEqual([
        "00000003-0000-4000-8000-000000000001",
        null,
      ]);
    });

    it("should not change the draft it is given", () => {
      const untidy = draft({ name: " Push Pull Legs " });

      validateRoutineDraft(untidy);

      expect(untidy.name).toBe(" Push Pull Legs ");
    });
  });

  describe("every problem at once", () => {
    it("should return exactly four issues for two Tuesdays, a blank name, 0 sets and reps the wrong way round", () => {
      const problems = issuesOf(
        draft({
          name: "   ",
          days: [
            day({ name: "Push", weekday: 1 }),
            day({
              name: "Pull",
              weekday: 1,
              exercises: [exercise({ target_sets: 0, rep_min: 12, rep_max: 10 })],
            }),
          ],
        }),
      );

      expect(problems).toStrictEqual([
        { path: ["name"], rule: "routine_name_blank" },
        { path: ["days", 1, "weekday"], rule: "weekday_repeated" },
        { path: ["days", 1, "exercises", 0, "target_sets"], rule: "target_sets_invalid" },
        { path: ["days", 1, "exercises", 0, "rep_max"], rule: "rep_range_inverted" },
      ]);
    });

    it("should name the day and the exercise of each problem, in the order they are drawn", () => {
      const problems = issuesOf(
        draft({
          days: [
            day({ exercises: [exercise(), exercise({ target_rir: 11 })] }),
            day({ name: "", exercises: [exercise({ rep_min: 0 }), exercise({ target_sets: 21 })] }),
          ],
        }),
      );

      expect(problems).toStrictEqual([
        { path: ["days", 0, "exercises", 1, "target_rir"], rule: "target_rir_invalid" },
        { path: ["days", 1, "name"], rule: "day_name_blank" },
        { path: ["days", 1, "exercises", 0, "rep_min"], rule: "rep_min_invalid" },
        { path: ["days", 1, "exercises", 1, "target_sets"], rule: "target_sets_invalid" },
      ]);
    });

    it("should carry no name or number from the draft in any issue", () => {
      const problems = issuesOf(
        draft({
          name: "x".repeat(201),
          days: [
            day({
              name: "Secret day name",
              weekday: 9,
              exercises: [
                exercise({ target_sets: 777, rep_min: 555, rep_max: 444, target_rir: 99 }),
              ],
            }),
          ],
        }),
      );

      const text = JSON.stringify(problems);
      expect(problems.length).toBeGreaterThan(0);
      expect(text).not.toContain("Secret");
      expect(text).not.toContain("xxxx");
      for (const value of ["201", "777", "555", "444", "99"]) {
        expect(text).not.toContain(value);
      }
      for (const problem of problems) {
        expect(Object.keys(problem)).toStrictEqual(["path", "rule"]);
      }
    });
  });

  describe("the routine name", () => {
    it.each(["", "   ", "\t\n"])("should refuse a blank name (%j)", (name) => {
      expect(issuesOf(draft({ name }))).toStrictEqual([
        { path: ["name"], rule: "routine_name_blank" },
      ]);
    });

    it("should accept 200 characters and refuse 201", () => {
      expect(validateRoutineDraft(draft({ name: "n".repeat(200) })).ok).toBe(true);
      expect(issuesOf(draft({ name: "n".repeat(201) }))).toStrictEqual([
        { path: ["name"], rule: "routine_name_too_long" },
      ]);
    });

    it("should count characters the way the database does, so an emoji is one", () => {
      expect(validateRoutineDraft(draft({ name: "💪".repeat(200) })).ok).toBe(true);
    });

    it("should count the name as it will be saved, without the spaces around it", () => {
      expect(validateRoutineDraft(draft({ name: ` ${"n".repeat(200)} ` })).ok).toBe(true);
    });
  });

  describe("the days", () => {
    it("should accept 7 days and refuse 8", () => {
      const days = (count: number) =>
        Array.from({ length: count }, (_, index) => day({ weekday: index < 7 ? index : null }));

      expect(validateRoutineDraft(draft({ days: days(7) })).ok).toBe(true);
      expect(issuesOf(draft({ days: days(8) }))).toStrictEqual([
        { path: ["days"], rule: "days_too_many" },
      ]);
    });

    it.each([-1, 7, 1.5, Number.NaN])("should refuse the weekday %s", (weekday) => {
      expect(issuesOf(draft({ days: [day({ weekday })] }))).toStrictEqual([
        { path: ["days", 0, "weekday"], rule: "weekday_invalid" },
      ]);
    });

    it("should accept every weekday from Monday (0) to Sunday (6)", () => {
      const days = [0, 1, 2, 3, 4, 5, 6].map((weekday) => day({ weekday }));

      expect(validateRoutineDraft(draft({ days })).ok).toBe(true);
    });

    it("should refuse a second day on the same weekday and name that second day", () => {
      expect(
        issuesOf(draft({ days: [day({ weekday: 1 }), day({ weekday: 3 }), day({ weekday: 1 })] })),
      ).toStrictEqual([{ path: ["days", 2, "weekday"], rule: "weekday_repeated" }]);
    });

    it("should name every later day when three share a weekday", () => {
      expect(
        issuesOf(draft({ days: [day({ weekday: 4 }), day({ weekday: 4 }), day({ weekday: 4 })] })),
      ).toStrictEqual([
        { path: ["days", 1, "weekday"], rule: "weekday_repeated" },
        { path: ["days", 2, "weekday"], rule: "weekday_repeated" },
      ]);
    });

    it("should allow any number of days with no weekday", () => {
      const days = [day(), day(), day(), day({ weekday: 2 })];

      expect(validateRoutineDraft(draft({ days })).ok).toBe(true);
    });

    it("should not call a day with an invalid weekday a repeat", () => {
      expect(issuesOf(draft({ days: [day({ weekday: 9 }), day({ weekday: 9 })] }))).toStrictEqual([
        { path: ["days", 0, "weekday"], rule: "weekday_invalid" },
        { path: ["days", 1, "weekday"], rule: "weekday_invalid" },
      ]);
    });

    it("should refuse a blank day name", () => {
      expect(issuesOf(draft({ days: [day({ name: "  " })] }))).toStrictEqual([
        { path: ["days", 0, "name"], rule: "day_name_blank" },
      ]);
    });

    it("should accept a day name of 100 characters and refuse 101", () => {
      expect(validateRoutineDraft(draft({ days: [day({ name: "d".repeat(100) })] })).ok).toBe(true);
      expect(issuesOf(draft({ days: [day({ name: "d".repeat(101) })] }))).toStrictEqual([
        { path: ["days", 0, "name"], rule: "day_name_too_long" },
      ]);
    });
  });

  describe("the exercises of a day", () => {
    it("should accept 30 exercises and refuse 31", () => {
      const exercises = (count: number) => Array.from({ length: count }, () => exercise());

      expect(validateRoutineDraft(draft({ days: [day({ exercises: exercises(30) })] })).ok).toBe(
        true,
      );
      expect(issuesOf(draft({ days: [day({ exercises: exercises(31) })] }))).toStrictEqual([
        { path: ["days", 0, "exercises"], rule: "exercises_too_many" },
      ]);
    });

    it.each([1, 20])("should accept %s target sets", (targetSets) => {
      expect(validateRoutineDraft(withExercise({ target_sets: targetSets })).ok).toBe(true);
    });

    it.each([0, 21, 2.5, -3, Number.NaN])("should refuse %s target sets", (targetSets) => {
      expect(issuesOf(withExercise({ target_sets: targetSets }))).toStrictEqual([
        { path: ["days", 0, "exercises", 0, "target_sets"], rule: "target_sets_invalid" },
      ]);
    });

    it.each([1, 100])("should accept a rep minimum and maximum of %s", (reps) => {
      expect(validateRoutineDraft(withExercise({ rep_min: reps, rep_max: 100 })).ok).toBe(true);
      expect(validateRoutineDraft(withExercise({ rep_min: 1, rep_max: reps })).ok).toBe(true);
    });

    it.each([0, 101, 8.5, Number.NaN])("should refuse a rep minimum of %s", (repMin) => {
      expect(issuesOf(withExercise({ rep_min: repMin, rep_max: 100 }))).toStrictEqual([
        { path: ["days", 0, "exercises", 0, "rep_min"], rule: "rep_min_invalid" },
      ]);
    });

    it.each([0, 101, 8.5, Number.NaN])("should refuse a rep maximum of %s", (repMax) => {
      expect(issuesOf(withExercise({ rep_min: 1, rep_max: repMax }))).toStrictEqual([
        { path: ["days", 0, "exercises", 0, "rep_max"], rule: "rep_max_invalid" },
      ]);
    });

    it("should refuse a rep minimum above the maximum and mark the maximum", () => {
      expect(issuesOf(withExercise({ rep_min: 12, rep_max: 10 }))).toStrictEqual([
        { path: ["days", 0, "exercises", 0, "rep_max"], rule: "rep_range_inverted" },
      ]);
    });

    it("should accept a rep minimum equal to the maximum", () => {
      expect(validateRoutineDraft(withExercise({ rep_min: 10, rep_max: 10 })).ok).toBe(true);
    });

    it("should not compare reps that are out of range, so each field says what is wrong", () => {
      expect(issuesOf(withExercise({ rep_min: 0, rep_max: 0 }))).toStrictEqual([
        { path: ["days", 0, "exercises", 0, "rep_min"], rule: "rep_min_invalid" },
        { path: ["days", 0, "exercises", 0, "rep_max"], rule: "rep_max_invalid" },
      ]);
    });

    it.each([0, 10, null])("should accept a target RIR of %s", (targetRir) => {
      expect(validateRoutineDraft(withExercise({ target_rir: targetRir })).ok).toBe(true);
    });

    it.each([-1, 11, 1.5, Number.NaN])("should refuse a target RIR of %s", (targetRir) => {
      expect(issuesOf(withExercise({ target_rir: targetRir }))).toStrictEqual([
        { path: ["days", 0, "exercises", 0, "target_rir"], rule: "target_rir_invalid" },
      ]);
    });
  });
});
