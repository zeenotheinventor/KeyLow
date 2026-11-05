import { describe, expect, it } from "vitest";

import { draftOfStoredRoutine, exerciseNamesOfStoredRoutine } from "../../src/training";

const stored = {
  name: "Push Pull Legs",
  days: [
    {
      id: "day-1",
      position: 0,
      weekday: 0,
      name: "Push",
      exercises: [
        {
          id: "planned-1",
          position: 0,
          exercise_id: "exercise-1",
          target_sets: 3,
          rep_min: 6,
          rep_max: 8,
          target_rir: 2,
          exercise: { id: "exercise-1", name: "Barbell bench press", equipment: "barbell" },
        },
      ],
    },
    {
      id: "day-2",
      position: 1,
      weekday: null,
      name: "Pull",
      exercises: [
        {
          id: "planned-2",
          position: 0,
          exercise_id: "exercise-2",
          target_sets: 4,
          rep_min: 10,
          rep_max: 10,
          target_rir: null,
          exercise: { id: "exercise-2", name: "Pullups", equipment: "body only" },
        },
      ],
    },
  ],
};

describe("draftOfStoredRoutine", () => {
  it("should keep the name, the days in order, their ids and only the columns a draft holds", () => {
    expect(draftOfStoredRoutine(stored)).toStrictEqual({
      name: "Push Pull Legs",
      days: [
        {
          id: "day-1",
          weekday: 0,
          name: "Push",
          exercises: [
            { exercise_id: "exercise-1", target_sets: 3, rep_min: 6, rep_max: 8, target_rir: 2 },
          ],
        },
        {
          id: "day-2",
          weekday: null,
          name: "Pull",
          exercises: [
            {
              exercise_id: "exercise-2",
              target_sets: 4,
              rep_min: 10,
              rep_max: 10,
              target_rir: null,
            },
          ],
        },
      ],
    });
  });
});

describe("exerciseNamesOfStoredRoutine", () => {
  it("should give each exercise's name by its id across the days", () => {
    expect(exerciseNamesOfStoredRoutine(stored)).toStrictEqual({
      "exercise-1": "Barbell bench press",
      "exercise-2": "Pullups",
    });
  });
});
