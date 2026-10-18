import { describe, expect, it } from "vitest";

import * as training from "../../src/training";
import {
  EQUIPMENT,
  EXERCISE_MECHANICS,
  EXERCISE_SOURCES,
  EXPERIENCE_LEVELS,
  MUSCLE_ROLES,
  SET_TYPES,
  TRAINING_FOCUSES,
  TRAINING_GOALS,
} from "../../src/training";

/* ADR 0005, Amendment 1, "The numbers" and the column definitions, one constant per bound. */
const numbers = {
  MAX_EXERCISE_NAME_LENGTH: 200,
  MAX_ROUTINE_NAME_LENGTH: 200,
  MAX_ROUTINE_DAY_NAME_LENGTH: 100,
  MAX_SESSION_NOTE_LENGTH: 1000,
  MAX_SESSION_TIME_ZONE_LENGTH: 64,
  MAX_MUSCLE_WEIGHT: 1,
  MAX_MUSCLES_PER_EXERCISE: 22,
  MIN_REPS: 1,
  MAX_REPS: 100,
  MAX_LOAD_KG: 1000,
  MIN_RIR: 0,
  MAX_RIR: 10,
  MIN_RPE: 1,
  MAX_RPE: 10,
  RPE_STEP: 0.5,
  MAX_SETS_PER_SESSION: 200,
  MAX_DAYS_PER_ROUTINE: 7,
  MAX_EXERCISES_PER_ROUTINE_DAY: 30,
  MIN_TARGET_SETS: 1,
  MAX_TARGET_SETS: 20,
  MIN_TARGET_REPS: 1,
  MAX_TARGET_REPS: 100,
  MIN_DAYS_PER_WEEK: 1,
  MAX_DAYS_PER_WEEK: 7,
  MIN_SESSION_MINUTES: 15,
  MAX_SESSION_MINUTES: 180,
  MIN_WEEKDAY: 0,
  MAX_WEEKDAY: 6,
} as const;

describe("training bounds", () => {
  it.each(Object.entries(numbers))("should set %s to %d", (name, value) => {
    expect(training[name as keyof typeof numbers]).toBe(value);
  });

  it("should let an exercise list every muscle once and no more", () => {
    expect(training.MAX_MUSCLES_PER_EXERCISE).toBe(training.MUSCLE_IDS.length);
  });
});

describe("training enums", () => {
  it.each([
    [
      "equipment",
      EQUIPMENT,
      [
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
      ],
    ],
    ["exercise_source", EXERCISE_SOURCES, ["free_exercise_db", "user"]],
    ["exercise_mechanic", EXERCISE_MECHANICS, ["compound", "isolation"]],
    ["muscle_role", MUSCLE_ROLES, ["primary", "secondary", "stabiliser"]],
    ["set_type", SET_TYPES, ["warmup", "working", "drop", "failure"]],
    ["training_goal", TRAINING_GOALS, ["aesthetic", "strength", "hybrid"]],
    ["experience_level", EXPERIENCE_LEVELS, ["beginner", "intermediate", "advanced"]],
    ["focus", TRAINING_FOCUSES, ["v_taper", "chest", "arms", "glutes", "legs", "overall"]],
  ])("should hold the %s values of Amendment 1 in order", (_name, values, expected) => {
    expect(values).toEqual(expected);
  });
});
