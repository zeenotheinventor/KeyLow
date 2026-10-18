import { describe, expect, it } from "vitest";

import { routine as goldenRoutine } from "./goldenWeekInputs";
import {
  deriveMusclePriority,
  GOAL_PRESETS_V1,
  PRIORITY_GROUP_VOLUME_STATUS,
  summarisePriorities,
} from "../../src/training";

import type { GoalAnswers, PlanExercise, PlanRoutine } from "../../src/training";

/*
 * The data behind "Your priorities" (KEY-399), from the goal presets v1 that Zee agreed on 2026-10-18
 * (Linear document "Goal presets and golden suggestions", on KEY-396, tables 1.3 and 1.4). The expected
 * muscle lists are copied from those tables as literals. "First" is priority 3, "kept up" is every other
 * muscle that is targeted (the routine trains it or the goal ranks it above 0), and "not targeted" is
 * every muscle that is not.
 */

const fullGym = [
  "barbell",
  "dumbbell",
  "kettlebell",
  "cable",
  "machine",
  "smith_machine",
  "ez_bar",
  "band",
  "bodyweight",
] as const;

const vTaperAnswers: GoalAnswers = {
  goal: "aesthetic",
  focus: ["v_taper"],
  days_per_week: 4,
  session_minutes: 60,
  equipment: [...fullGym],
  experience: "intermediate",
};

const strengthAnswers: GoalAnswers = { ...vTaperAnswers, goal: "strength", focus: [] };

const summaryFor = (answers: GoalAnswers, routine?: PlanRoutine) =>
  summarisePriorities(answers, deriveMusclePriority(answers, GOAL_PRESETS_V1), routine);

// The golden routine with an abs exercise added to its first day, so the routine trains abs.
const crunch: PlanExercise = {
  id: "00000000-0000-4000-8000-0000000000a1",
  position: 99,
  exercise_id: "00000000-0000-4000-8000-0000000000a2",
  target_sets: 3,
  target_rir: 2,
  exercise: {
    id: "00000000-0000-4000-8000-0000000000a2",
    name: "Cable Crunch",
    equipment: "cable",
    mechanic: "isolation",
  },
  muscles: [{ muscle_id: "abs", role: "primary", weight: 1 }],
};

const routineTrainingAbs: PlanRoutine = {
  days: goldenRoutine.days.map((day, index) =>
    index === 0 ? { ...day, exercises: [...day.exercises, crunch] } : day,
  ),
};

describe("summarisePriorities for the golden V-taper answers", () => {
  it("should put side delts, lats and upper chest first, in the order of the muscle list", () => {
    expect(summaryFor(vTaperAnswers, goldenRoutine).first).toStrictEqual([
      "chest_upper",
      "delt_side",
      "lats",
    ]);
  });

  it("should keep up the other twelve muscles the golden routine trains", () => {
    expect(summaryFor(vTaperAnswers, goldenRoutine).keptUp).toStrictEqual([
      "chest_lower",
      "delt_front",
      "delt_rear",
      "traps_mid",
      "lower_back",
      "biceps",
      "triceps",
      "forearms",
      "glute_max",
      "quads",
      "hamstrings",
      "calves",
    ]);
  });

  it("should leave obliques, abs and the other five not targeted", () => {
    expect(summaryFor(vTaperAnswers, goldenRoutine).notTargeted).toStrictEqual([
      "traps_upper",
      "abs",
      "obliques",
      "glute_med",
      "adductors",
      "tibialis",
      "neck",
    ]);
  });

  it("should give the same groups with no routine, because the goal ranks the same fifteen", () => {
    expect(summaryFor(vTaperAnswers)).toStrictEqual(summaryFor(vTaperAnswers, goldenRoutine));
  });

  it("should treat a routine of null as no routine", () => {
    const priority = deriveMusclePriority(vTaperAnswers, GOAL_PRESETS_V1);

    expect(summarisePriorities(vTaperAnswers, priority, null)).toStrictEqual(
      summaryFor(vTaperAnswers),
    );
  });
});

describe("summarisePriorities when the routine trains a muscle the goal does not rank", () => {
  it("should not leave abs not targeted once the routine trains them, and keep them up instead", () => {
    const summary = summaryFor(vTaperAnswers, routineTrainingAbs);

    expect(summary.notTargeted).toStrictEqual([
      "traps_upper",
      "obliques",
      "glute_med",
      "adductors",
      "tibialis",
      "neck",
    ]);
    expect(summary.keptUp).toContain("abs");
    expect(summary.first).toStrictEqual(["chest_upper", "delt_side", "lats"]);
  });

  it("should keep a muscle the goal ranks 1 or 2 up even when the routine does not train it", () => {
    const summary = summaryFor(strengthAnswers, goldenRoutine);

    expect(summary.keptUp).toContain("traps_upper");
    expect(summary.notTargeted).not.toContain("traps_upper");
  });
});

describe("summarisePriorities for strength with no focus", () => {
  it("should put the muscles of the squat, bench, deadlift and overhead press first", () => {
    expect(summaryFor(strengthAnswers).first).toStrictEqual([
      "chest_lower",
      "delt_front",
      "lower_back",
      "glute_max",
      "quads",
      "hamstrings",
    ]);
  });

  it("should keep up the nine muscles the lifts only assist, and leave seven not targeted", () => {
    const summary = summaryFor(strengthAnswers);

    expect(summary.keptUp).toStrictEqual([
      "chest_upper",
      "delt_side",
      "delt_rear",
      "lats",
      "traps_upper",
      "traps_mid",
      "biceps",
      "triceps",
      "forearms",
    ]);
    expect(summary.notTargeted).toStrictEqual([
      "abs",
      "obliques",
      "glute_med",
      "adductors",
      "calves",
      "tibialis",
      "neck",
    ]);
  });

  it("should read calves as kept up when the routine trains them", () => {
    const summary = summaryFor(strengthAnswers, goldenRoutine);

    expect(summary.keptUp).toContain("calves");
    expect(summary.notTargeted).not.toContain("calves");
  });
});

describe("summarisePriorities for aesthetic with the overall focus", () => {
  it("should put no muscle first", () => {
    expect(summaryFor({ ...vTaperAnswers, focus: ["overall"] }).first).toStrictEqual([]);
  });
});

describe("summarisePriorities answers", () => {
  it("should restate the answers", () => {
    expect(summaryFor(vTaperAnswers).answers).toStrictEqual(vTaperAnswers);
  });

  it("should list the focuses in the order of the focus list, whatever order they were chosen in", () => {
    const answers: GoalAnswers = { ...vTaperAnswers, focus: ["legs", "v_taper", "chest"] };

    expect(summaryFor(answers).answers.focus).toStrictEqual(["v_taper", "chest", "legs"]);
  });

  it("should not change the answers it was given", () => {
    const answers: GoalAnswers = { ...vTaperAnswers, focus: ["legs", "v_taper"] };

    summaryFor(answers);

    expect(answers.focus).toStrictEqual(["legs", "v_taper"]);
  });
});

describe("PRIORITY_GROUP_VOLUME_STATUS", () => {
  it("should read first as productive, kept up as maintaining and not targeted as not targeted", () => {
    expect(PRIORITY_GROUP_VOLUME_STATUS).toStrictEqual({
      first: "productive",
      keptUp: "maintaining",
      notTargeted: "not_targeted",
    });
  });
});

describe("summarisePriorities answers that fail the questionnaire rules", () => {
  it("should throw a RangeError stating the rule", () => {
    const answers = { ...vTaperAnswers, focus: ["v_taper" as const, "v_taper" as const] };

    expect(() => summaryFor(answers)).toThrow(RangeError);
    expect(() => summaryFor(answers)).toThrow("A focus can be chosen at most once");
  });

  it("should never quote the offending value, because a goal answer is health data", () => {
    const answers = { ...vTaperAnswers, session_minutes: 123456 };

    expect(() => summaryFor(answers)).toThrow(RangeError);
    expect(() => summaryFor(answers)).not.toThrow("123456");
  });
});
