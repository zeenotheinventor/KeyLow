import { describe, expect, it } from "vitest";

import { goldenRoutineDraft, goldenRoutineName } from "./routines";
import { routinePayload } from "../../src/training";

import type { RoutineDraft } from "../../src/training";

/*
 * `save_routine(p_routine_id, p_routine, p_days)` reads (header comment of the function in
 * 20261018130000_training_sessions_routines_goals.sql): p_routine is an object with name. p_days is an
 * array of objects in the order the days are to be listed, each with id (a uuid, or null or missing for
 * a new day), weekday (0 to 6, or null for any day), name and exercises, an array of objects with
 * exercise_id, target_sets, rep_min, rep_max and target_rir (which may be null), in the order they are to
 * be listed. It ignores user_id, routine_id, position, is_active, is_archived, created_at and
 * routine_day_id, and a position is the index in its array.
 */

describe("routinePayload", () => {
  const payload = routinePayload(goldenRoutineDraft);

  it("should send the routine as an object with its name and nothing else", () => {
    expect(payload.p_routine).toStrictEqual({ name: goldenRoutineName });
  });

  it("should send the 4 days of the golden routine in order, with their weekdays and names", () => {
    expect(payload.p_days.map((day) => [day.name, day.weekday])).toStrictEqual([
      ["Push", 0],
      ["Pull", 1],
      ["Legs", 3],
      ["Push", 5],
    ]);
  });

  it("should send each day with exactly the keys the function reads", () => {
    for (const day of payload.p_days) {
      expect(Object.keys(day).sort()).toStrictEqual(["exercises", "id", "name", "weekday"]);
    }
  });

  it("should send each exercise with exactly the keys the function reads", () => {
    for (const day of payload.p_days) {
      for (const exercise of day.exercises) {
        expect(Object.keys(exercise).sort()).toStrictEqual([
          "exercise_id",
          "rep_max",
          "rep_min",
          "target_rir",
          "target_sets",
        ]);
      }
    }
  });

  it("should send the first and last exercise of Legs field by field", () => {
    const legs = payload.p_days[2];

    expect(legs?.exercises).toHaveLength(5);
    expect(legs?.exercises[0]).toStrictEqual({
      exercise_id: "00000001-0000-4000-8000-000000000011",
      target_sets: 3,
      rep_min: 5,
      rep_max: 8,
      target_rir: 2,
    });
    expect(legs?.exercises[4]).toStrictEqual({
      exercise_id: "00000001-0000-4000-8000-000000000015",
      target_sets: 4,
      rep_min: 10,
      rep_max: 15,
      target_rir: 1,
    });
  });

  it("should keep the id of every day that has one, so a logged session's link survives an edit", () => {
    expect(payload.p_days.map((day) => day.id)).toStrictEqual([
      "00000003-0000-4000-8000-000000000001",
      "00000003-0000-4000-8000-000000000002",
      "00000003-0000-4000-8000-000000000003",
      "00000003-0000-4000-8000-000000000004",
    ]);
  });

  it("should send a day with no id as a new day, with a null id", () => {
    const draft: RoutineDraft = {
      name: "Full body",
      days: [{ id: null, weekday: null, name: "Day A", exercises: [] }],
    };

    expect(routinePayload(draft).p_days).toStrictEqual([
      { id: null, weekday: null, name: "Day A", exercises: [] },
    ]);
  });

  it("should send a null target RIR as null and not leave it out", () => {
    const draft: RoutineDraft = {
      name: "Full body",
      days: [
        {
          id: null,
          weekday: 2,
          name: "Day A",
          exercises: [
            {
              exercise_id: "00000001-0000-4000-8000-000000000001",
              target_sets: 3,
              rep_min: 8,
              rep_max: 12,
              target_rir: null,
            },
          ],
        },
      ],
    };

    expect(routinePayload(draft).p_days[0]?.exercises[0]).toHaveProperty("target_rir", null);
  });

  it("should list days and exercises in the order of the draft, as the index is the position", () => {
    const reversed: RoutineDraft = {
      ...goldenRoutineDraft,
      days: [...goldenRoutineDraft.days].reverse().map((day) => ({
        ...day,
        exercises: [...day.exercises].reverse(),
      })),
    };

    const sent = routinePayload(reversed);

    expect(sent.p_days.map((day) => day.id)).toStrictEqual([
      "00000003-0000-4000-8000-000000000004",
      "00000003-0000-4000-8000-000000000003",
      "00000003-0000-4000-8000-000000000002",
      "00000003-0000-4000-8000-000000000001",
    ]);
    expect(sent.p_days[1]?.exercises.map((exercise) => exercise.exercise_id)).toStrictEqual([
      "00000001-0000-4000-8000-000000000015",
      "00000001-0000-4000-8000-000000000014",
      "00000001-0000-4000-8000-000000000013",
      "00000001-0000-4000-8000-000000000012",
      "00000001-0000-4000-8000-000000000011",
    ]);
  });

  it("should not send keys the function ignores, even when the draft was built from stored rows", () => {
    const storedExercise = {
      id: "00000002-0000-4000-8000-000000000001",
      user_id: "a-user",
      routine_day_id: "00000003-0000-4000-8000-000000000001",
      position: 0,
      created_at: "2026-10-18T10:00:00Z",
      exercise_id: "00000001-0000-4000-8000-000000000001",
      target_sets: 3,
      rep_min: 6,
      rep_max: 8,
      target_rir: 2,
    };
    const storedDay = {
      id: "00000003-0000-4000-8000-000000000001",
      routine_id: "a-routine",
      user_id: "a-user",
      position: 0,
      created_at: "2026-10-18T10:00:00Z",
      weekday: 0,
      name: "Push",
      exercises: [storedExercise],
    };
    const storedRoutine = {
      name: "Push Pull Legs",
      is_active: true,
      is_archived: false,
      user_id: "a-user",
      days: [storedDay],
    };

    expect(routinePayload(storedRoutine)).toStrictEqual({
      p_routine: { name: "Push Pull Legs" },
      p_days: [
        {
          id: "00000003-0000-4000-8000-000000000001",
          weekday: 0,
          name: "Push",
          exercises: [
            {
              exercise_id: "00000001-0000-4000-8000-000000000001",
              target_sets: 3,
              rep_min: 6,
              rep_max: 8,
              target_rir: 2,
            },
          ],
        },
      ],
    });
  });

  it("should be plain JSON, so it travels to the function unchanged", () => {
    expect(JSON.parse(JSON.stringify(payload))).toStrictEqual(payload);
  });
});
