import { describe, expect, it } from "vitest";

import { GOAL_PRESETS_V1, trainingGoalsPayload } from "../../src/training";

import type { GoalAnswers } from "../../src/training";

/*
 * The p_goals argument of `save_training_goals` (migration 20261018130000, KEY-348, and ADR 0005,
 * Amendment 1). `acceptedBySaveTrainingGoals` restates the rules of that function's header comment, with
 * the value lists written out, so a payload core builds is checked against what the database documents
 * rather than against core's own lists.
 */

const GOALS = ["aesthetic", "strength", "hybrid"];
const FOCUSES = ["v_taper", "chest", "arms", "glutes", "legs", "overall"];
const EQUIPMENT = [
  "barbell",
  "dumbbell",
  "kettlebell",
  "cable",
  "machine",
  "smith_machine",
  "ez_bar",
  "band",
  "bodyweight",
  "other",
];
const EXPERIENCE_LEVELS = ["beginner", "intermediate", "advanced"];
const MUSCLES = [
  "chest_upper",
  "chest_lower",
  "delt_front",
  "delt_side",
  "delt_rear",
  "lats",
  "traps_upper",
  "traps_mid",
  "lower_back",
  "biceps",
  "triceps",
  "forearms",
  "abs",
  "obliques",
  "glute_max",
  "glute_med",
  "quads",
  "hamstrings",
  "adductors",
  "calves",
  "tibialis",
  "neck",
];
// The keys the function reads. It ignores id, user_id, effective_from, effective_to and created_at, which
// a payload built here must not carry.
const DOCUMENTED_KEYS = [
  "goal",
  "focus",
  "days_per_week",
  "session_minutes",
  "equipment",
  "experience",
  "muscle_priority",
  "params_version",
];

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isListOf = (value: unknown, allowed: readonly string[]): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string" && allowed.includes(item));

const isWholeBetween = (value: unknown, minimum: number, maximum: number): boolean =>
  typeof value === "number" && Number.isInteger(value) && value >= minimum && value <= maximum;

/** The rules the header comment of `save_training_goals` documents, as a list of the ones a payload breaks. */
const documentedProblems = (payload: unknown): string[] => {
  if (!isObject(payload)) {
    return ["p_goals must be a JSON object"];
  }
  const problems: string[] = [];
  const { focus, equipment, muscle_priority: priority, params_version: version } = payload;
  if (typeof payload.goal !== "string" || !GOALS.includes(payload.goal)) {
    problems.push("goal must be one of training_goal");
  }
  if (!isListOf(focus, FOCUSES) || new Set(focus).size !== focus.length) {
    problems.push("focus must be an array of the focus list, each at most once");
  }
  if (!isWholeBetween(payload.days_per_week, 1, 7)) {
    problems.push("days_per_week must be a whole number from 1 to 7");
  }
  if (!isWholeBetween(payload.session_minutes, 15, 180)) {
    problems.push("session_minutes must be a whole number from 15 to 180");
  }
  if (!isListOf(equipment, EQUIPMENT)) {
    problems.push("equipment must be an array of the equipment list");
  }
  if (typeof payload.experience !== "string" || !EXPERIENCE_LEVELS.includes(payload.experience)) {
    problems.push("experience must be one of experience_level");
  }
  if (
    !isObject(priority) ||
    !Object.entries(priority).every(
      ([muscle, value]) => MUSCLES.includes(muscle) && typeof value === "number",
    )
  ) {
    problems.push("muscle_priority must be an object from muscle id to a number");
  }
  if (typeof version !== "string" || version.length === 0) {
    problems.push("params_version must be non-empty text");
  }
  return problems;
};

const goldenAnswers: GoalAnswers = {
  goal: "aesthetic",
  focus: ["v_taper"],
  days_per_week: 4,
  session_minutes: 60,
  equipment: [
    "barbell",
    "dumbbell",
    "kettlebell",
    "cable",
    "machine",
    "smith_machine",
    "ez_bar",
    "band",
    "bodyweight",
  ],
  experience: "intermediate",
};

describe("trainingGoalsPayload", () => {
  it("should build, for the golden V-taper answers, exactly the documented keys", () => {
    expect(Object.keys(trainingGoalsPayload(goldenAnswers, GOAL_PRESETS_V1)).sort()).toStrictEqual(
      [...DOCUMENTED_KEYS].sort(),
    );
  });

  it("should be accepted field by field by the documented input of save_training_goals", () => {
    expect(documentedProblems(trainingGoalsPayload(goldenAnswers, GOAL_PRESETS_V1))).toStrictEqual(
      [],
    );
  });

  it("should carry the params version keylow-training-v1", () => {
    expect(trainingGoalsPayload(goldenAnswers, GOAL_PRESETS_V1).params_version).toBe(
      "keylow-training-v1",
    );
  });

  it("should carry the answers as given and all 22 muscles of the agreed aesthetic V-taper table", () => {
    expect(trainingGoalsPayload(goldenAnswers, GOAL_PRESETS_V1)).toStrictEqual({
      goal: "aesthetic",
      focus: ["v_taper"],
      days_per_week: 4,
      session_minutes: 60,
      equipment: [
        "barbell",
        "dumbbell",
        "kettlebell",
        "cable",
        "machine",
        "smith_machine",
        "ez_bar",
        "band",
        "bodyweight",
      ],
      experience: "intermediate",
      muscle_priority: {
        chest_upper: 3,
        chest_lower: 2,
        delt_front: 1,
        delt_side: 3,
        delt_rear: 2,
        lats: 3,
        traps_upper: 0,
        traps_mid: 2,
        lower_back: 1,
        biceps: 2,
        triceps: 2,
        forearms: 1,
        abs: 0,
        obliques: 0,
        glute_max: 2,
        glute_med: 0,
        quads: 2,
        hamstrings: 2,
        adductors: 0,
        calves: 1,
        tibialis: 0,
        neck: 0,
      },
      params_version: "keylow-training-v1",
    });
  });

  it("should accept an empty focus, as a strength user with no focus has", () => {
    const payload = trainingGoalsPayload(
      { ...goldenAnswers, goal: "strength", focus: [] },
      GOAL_PRESETS_V1,
    );

    expect(documentedProblems(payload)).toStrictEqual([]);
    expect(payload.focus).toStrictEqual([]);
  });

  it("should not change the answers it was given", () => {
    const answers: GoalAnswers = structuredClone(goldenAnswers);

    trainingGoalsPayload(answers, GOAL_PRESETS_V1);

    expect(answers).toStrictEqual(goldenAnswers);
  });

  describe("the documented-input check", () => {
    it("should refuse a payload that breaks a documented rule", () => {
      const broken = { ...trainingGoalsPayload(goldenAnswers, GOAL_PRESETS_V1), days_per_week: 8 };

      expect(documentedProblems(broken)).toStrictEqual([
        "days_per_week must be a whole number from 1 to 7",
      ]);
    });
  });
});
