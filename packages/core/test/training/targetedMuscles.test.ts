import { describe, expect, it } from "vitest";

import { arms, bench, benchMuscles, curl, dayId, legs, planExercise, push, routine } from "./plans";
import { MUSCLE_IDS, targetedMuscles } from "../../src/training";

import type { MuscleId, PlanRoutine } from "../../src/training";

const everyMuscle = new Set<MuscleId>(MUSCLE_IDS);

const pushMuscles: MuscleId[] = ["chest_lower", "chest_upper", "triceps"];
const legsMuscles: MuscleId[] = ["quads", "glute_max"];
const pullMuscles: MuscleId[] = ["lats", "biceps"];

describe("targetedMuscles", () => {
  describe("from the routine alone", () => {
    it("should target the muscles of one day's exercises and no others", () => {
      expect(targetedMuscles({ routine: { days: [push] } })).toEqual(new Set(pushMuscles));
    });

    it("should target the muscles of every day, a day with no weekday included", () => {
      expect(targetedMuscles({ routine })).toEqual(
        new Set([...pushMuscles, ...legsMuscles, ...pullMuscles]),
      );
    });

    it("should count a day with no weekday, though the plan places no sets for it", () => {
      expect(arms.weekday).toBeNull();
      expect(targetedMuscles({ routine: { days: [arms] } })).toEqual(new Set(["biceps"]));
    });

    it("should count a muscle of any role", () => {
      // chest_lower is primary and triceps secondary in the bench press map.
      const state = targetedMuscles({ routine: { days: [push] } });

      expect(state.has("chest_lower")).toBe(true);
      expect(state.has("triceps")).toBe(true);
    });

    it("should not count a muscle map entry with no weight", () => {
      const noWeightOnTriceps = planExercise(
        bench,
        benchMuscles.map((entry) =>
          entry.muscle_id === "triceps" ? { ...entry, weight: 0 } : entry,
        ),
        3,
        2,
        0,
      );

      expect(
        targetedMuscles({ routine: { days: [{ ...push, exercises: [noWeightOnTriceps] }] } }),
      ).toEqual(new Set(["chest_lower", "chest_upper"]));
    });

    it("should read the muscle map the plan holds, not the exercise's name or id", () => {
      const curlOnChest = planExercise(curl, benchMuscles, 3, 1, 0);

      expect(
        targetedMuscles({ routine: { days: [{ ...arms, exercises: [curlOnChest] }] } }),
      ).toEqual(new Set(pushMuscles));
    });
  });

  describe("from the goal's priorities alone", () => {
    it("should target the muscles with a priority above 0", () => {
      expect(
        targetedMuscles({ routine: null, priority: { delt_side: 2, lats: 0.5, chest_upper: 1 } }),
      ).toEqual(new Set(["delt_side", "lats", "chest_upper"]));
    });

    it("should not target a muscle with priority 0 or a negative priority", () => {
      expect(
        targetedMuscles({
          routine: null,
          priority: { delt_side: 1, lats: 0, biceps: -1, triceps: -0.5 },
        }),
      ).toEqual(new Set(["delt_side"]));
    });
  });

  describe("from both", () => {
    it("should target the union of the routine's muscles and the ranked ones", () => {
      expect(
        targetedMuscles({ routine: { days: [push] }, priority: { abs: 1, triceps: 3 } }),
      ).toEqual(new Set([...pushMuscles, "abs"]));
    });

    it("should not let a priority of 0 or below remove a muscle the routine trains", () => {
      expect(
        targetedMuscles({ routine: { days: [push] }, priority: { chest_upper: 0, triceps: -2 } }),
      ).toEqual(new Set(pushMuscles));
    });

    it("should not make a muscle targeted by a priority of 0 or below", () => {
      expect(
        targetedMuscles({ routine: { days: [push] }, priority: { abs: 0, neck: -1 } }),
      ).toEqual(new Set(pushMuscles));
    });
  });

  describe("with neither source", () => {
    it("should target all 22 muscles with no routine and no priority", () => {
      expect(targetedMuscles({ routine: null })).toEqual(everyMuscle);
      expect(targetedMuscles({ routine: null, priority: null })).toEqual(everyMuscle);
      expect(targetedMuscles({ routine: null, priority: {} })).toEqual(everyMuscle);
    });

    it("should target all 22 muscles for a routine with no days", () => {
      expect(targetedMuscles({ routine: { days: [] } })).toEqual(everyMuscle);
    });

    it("should target all 22 muscles for a routine whose days have no exercises", () => {
      const emptyDays: PlanRoutine = {
        days: [
          { id: dayId(1), position: 0, weekday: 0, exercises: [] },
          { id: dayId(2), position: 1, weekday: null, exercises: [] },
        ],
      };

      expect(targetedMuscles({ routine: emptyDays })).toEqual(everyMuscle);
    });

    it("should target all 22 muscles when no priority ranks a muscle above 0", () => {
      expect(targetedMuscles({ routine: null, priority: { lats: 0, biceps: -1 } })).toEqual(
        everyMuscle,
      );
    });
  });

  describe("with a priority that breaks a rule", () => {
    it("should refuse a muscle id that is not in the list, stating the rule only", () => {
      // The map is typed by muscle id, so an unknown key can only come from untyped data.
      const unknownMuscle: Record<string, number> = { shins: 1 };

      expect(() => targetedMuscles({ routine: null, priority: unknownMuscle })).toThrow(
        new RangeError("A muscle priority must name a muscle of the list"),
      );
    });

    it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
      "should refuse a priority that is not a finite number (%s), stating the rule only",
      (priority) => {
        expect(() =>
          targetedMuscles({ routine: { days: [push] }, priority: { lats: priority } }),
        ).toThrow(new RangeError("A muscle priority must be a finite number"));
      },
    );
  });

  it("should not change the routine or the priority it is given", () => {
    const priority = { abs: 1 };
    const days = [legs, push];

    targetedMuscles({ routine: { days }, priority });

    expect(days).toEqual([legs, push]);
    expect(priority).toEqual({ abs: 1 });
  });
});
