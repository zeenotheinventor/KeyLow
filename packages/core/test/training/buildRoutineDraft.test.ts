import { describe, expect, it } from "vitest";

import {
  buildRoutineDraft,
  estimateSessionMinutes,
  GOAL_PRESETS_V1,
  MAX_DAYS_PER_ROUTINE,
  SESSION_TIME_PARAMS_V1,
  summariseBuiltRoutine,
  SUGGEST_PARAMS_V2,
  validateRoutineDraft,
} from "../../src/training";

import type { ExerciseMechanic, ExperienceLevel, TrainingGoal } from "../../src/training";

const SQUAT = "00000000-0000-4000-8000-000000000001";
const CURL = "00000000-0000-4000-8000-000000000002";
const PRESS = "00000000-0000-4000-8000-000000000003";
const NOT_IN_LIBRARY = "00000000-0000-4000-8000-0000000000ff";

const EXERCISES: ReadonlyMap<string, { mechanic: ExerciseMechanic }> = new Map([
  [SQUAT, { mechanic: "compound" }],
  [CURL, { mechanic: "isolation" }],
  [PRESS, { mechanic: "compound" }],
]);

const HYBRID_INTERMEDIATE: { goal: TrainingGoal; experience: ExperienceLevel } = {
  goal: "hybrid",
  experience: "intermediate",
};

const build = (
  days: { name: string; weekday: number | null; exerciseIds: string[] }[],
  name = "Upper lower",
  goal = HYBRID_INTERMEDIATE,
) => buildRoutineDraft({ name, days }, EXERCISES, goal, GOAL_PRESETS_V1);

const dayOf = (exerciseIds: string[], weekday: number | null = null, name = "Day") => ({
  name,
  weekday,
  exerciseIds,
});

describe("buildRoutineDraft", () => {
  it("should give each exercise the sets, reps and RIR of the goal, mechanic and experience", () => {
    const built = build([dayOf([SQUAT, CURL], 0, "Legs")]);

    expect(built).toStrictEqual({
      ok: true,
      draft: {
        name: "Upper lower",
        days: [
          {
            id: null,
            weekday: 0,
            name: "Legs",
            exercises: [
              { exercise_id: SQUAT, target_sets: 3, rep_min: 5, rep_max: 8, target_rir: 2 },
              { exercise_id: CURL, target_sets: 3, rep_min: 10, rep_max: 15, target_rir: 1 },
            ],
          },
        ],
      },
    });
  });

  it("should change the numbers with the goal and the experience", () => {
    const built = build([dayOf([SQUAT])], "Strength", { goal: "strength", experience: "advanced" });

    expect(built).toMatchObject({
      ok: true,
      draft: {
        days: [{ exercises: [{ target_sets: 4, rep_min: 3, rep_max: 5, target_rir: 2 }] }],
      },
    });
  });

  it("should trim the names and keep the days and exercises in the order given", () => {
    const built = build([dayOf([PRESS, SQUAT], 4, " Pull "), dayOf([CURL], 1, "Push")], " Mine ");

    expect(built).toMatchObject({
      ok: true,
      draft: {
        name: "Mine",
        days: [
          { name: "Pull", weekday: 4, exercises: [{ exercise_id: PRESS }, { exercise_id: SQUAT }] },
          { name: "Push", weekday: 1, exercises: [{ exercise_id: CURL }] },
        ],
      },
    });
  });

  it("should produce a draft that passes validateRoutineDraft", () => {
    const built = build([dayOf([SQUAT, CURL], 0), dayOf([PRESS], null)]);

    expect(built.ok && validateRoutineDraft(built.draft).ok).toBe(true);
  });

  describe("refusals", () => {
    it("should refuse an id that is not in the library and give its place and no value", () => {
      const built = build([dayOf([SQUAT]), dayOf([CURL, NOT_IN_LIBRARY])]);

      expect(built).toStrictEqual({
        ok: false,
        problems: [{ path: ["days", 1, "exercises", 1], rule: "exercise_unknown" }],
      });
      expect(JSON.stringify(built)).not.toContain(NOT_IN_LIBRARY);
    });

    it("should refuse a day of 9 exercises and allow one of 8", () => {
      const library = new Map(
        Array.from({ length: 9 }, (_, index) => [
          `00000000-0000-4000-8000-00000000010${index}`,
          { mechanic: "compound" as const },
        ]),
      );
      const buildWith = (count: number) =>
        buildRoutineDraft(
          { name: "Big", days: [dayOf([...library.keys()].slice(0, count))] },
          library,
          HYBRID_INTERMEDIATE,
          GOAL_PRESETS_V1,
        );

      expect(SUGGEST_PARAMS_V2.maxExercises.fresh).toBe(8);
      expect(buildWith(8).ok).toBe(true);
      expect(buildWith(9)).toStrictEqual({
        ok: false,
        problems: [{ path: ["days", 0, "exercises"], rule: "exercises_too_many" }],
      });
    });

    it("should refuse 8 days and allow 7", () => {
      const week = (count: number) =>
        Array.from({ length: count }, (_, index) => dayOf([SQUAT], index < 7 ? index : null));

      expect(MAX_DAYS_PER_ROUTINE).toBe(7);
      expect(build(week(7)).ok).toBe(true);
      expect(build(week(8))).toStrictEqual({
        ok: false,
        problems: [{ path: ["days"], rule: "days_too_many" }],
      });
    });

    it("should refuse no days", () => {
      expect(build([])).toStrictEqual({
        ok: false,
        problems: [{ path: ["days"], rule: "days_none" }],
      });
    });

    it("should refuse a day with no exercise", () => {
      expect(build([dayOf([SQUAT]), dayOf([])])).toStrictEqual({
        ok: false,
        problems: [{ path: ["days", 1, "exercises"], rule: "exercises_none" }],
      });
    });

    it("should refuse an exercise listed twice in a day and mark the second", () => {
      expect(build([dayOf([SQUAT, CURL, SQUAT])])).toStrictEqual({
        ok: false,
        problems: [{ path: ["days", 0, "exercises", 2], rule: "exercise_repeated" }],
      });
    });

    it("should allow the same exercise on two different days", () => {
      expect(build([dayOf([SQUAT], 0), dayOf([SQUAT], 3)]).ok).toBe(true);
    });

    it("should refuse a repeated weekday with the rule of validateRoutineDraft", () => {
      expect(build([dayOf([SQUAT], 2), dayOf([CURL], 2)])).toStrictEqual({
        ok: false,
        problems: [{ path: ["days", 1, "weekday"], rule: "weekday_repeated" }],
      });
    });

    it("should refuse a blank routine name and a blank day name with the rules of validateRoutineDraft", () => {
      expect(build([dayOf([SQUAT], 0, "  ")], " ")).toStrictEqual({
        ok: false,
        problems: [
          { path: ["name"], rule: "routine_name_blank" },
          { path: ["days", 0, "name"], rule: "day_name_blank" },
        ],
      });
    });

    it("should report every problem it finds at once and build nothing", () => {
      const built = build([dayOf([NOT_IN_LIBRARY, SQUAT, SQUAT]), dayOf([])]);

      expect(built).toStrictEqual({
        ok: false,
        problems: [
          { path: ["days", 0, "exercises", 0], rule: "exercise_unknown" },
          { path: ["days", 0, "exercises", 2], rule: "exercise_repeated" },
          { path: ["days", 1, "exercises"], rule: "exercises_none" },
        ],
      });
    });

    it("should carry no name in a problem", () => {
      const built = build([dayOf([SQUAT, SQUAT], null, "Secret day")], "Secret routine");

      expect(JSON.stringify(built)).not.toContain("Secret");
    });
  });
});

describe("summariseBuiltRoutine", () => {
  it("should count each day's exercises and sets and estimate its minutes", () => {
    const built = build([dayOf([SQUAT, CURL], 0, "A"), dayOf([PRESS], 2, "B")]);
    if (!built.ok) {
      throw new Error("The draft should build");
    }

    const summary = summariseBuiltRoutine(built.draft, SESSION_TIME_PARAMS_V1);

    expect(summary).toStrictEqual({
      dayCount: 2,
      setsPerWeek: 9,
      days: [
        {
          weekday: 0,
          exerciseCount: 2,
          setCount: 6,
          minutes: estimateSessionMinutes({ exercises: 2, sets: 6 }, SESSION_TIME_PARAMS_V1),
        },
        {
          weekday: 2,
          exerciseCount: 1,
          setCount: 3,
          minutes: estimateSessionMinutes({ exercises: 1, sets: 3 }, SESSION_TIME_PARAMS_V1),
        },
      ],
    });
  });

  it("should give the minutes 20 for 2 exercises of 3 sets and 10 for 1 exercise of 3 sets", () => {
    const built = build([dayOf([SQUAT, CURL], 0, "A"), dayOf([PRESS], 2, "B")]);
    if (!built.ok) {
      throw new Error("The draft should build");
    }

    expect(
      summariseBuiltRoutine(built.draft, SESSION_TIME_PARAMS_V1).days.map((d) => d.minutes),
    ).toStrictEqual([20, 10]);
  });
});
