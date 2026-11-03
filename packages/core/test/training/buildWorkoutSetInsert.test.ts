import { describe, expect, it } from "vitest";

import {
  FULL_SESSION_RULE,
  buildSetSnapshot,
  buildWorkoutSetInsert,
  isFullSessionRefusal,
} from "../../src/training";

import type { ExerciseMuscleEntry } from "../../src/schemas";
import type { SetValues, SnapshotExercise } from "../../src/training";

const squat: SnapshotExercise = {
  id: "6f1c2b9e-0000-4000-8000-000000000003",
  name: "Barbell squat",
  equipment: "barbell",
  mechanic: "compound",
};

const squatMuscles: ExerciseMuscleEntry[] = [
  { muscle_id: "glute_max", role: "secondary", weight: 0.6 },
  { muscle_id: "quads", role: "primary", weight: 1 },
  { muscle_id: "adductors", role: "secondary", weight: 0.3 },
];

const draft: SetValues = { setType: "working", loadKg: 100, reps: 5, rir: 2, rpe: null };

const input = {
  sessionId: "6f1c2b9e-0000-4000-8000-0000000000aa",
  exercise: squat,
  muscles: squatMuscles,
  draft,
  position: 3,
  performedAt: "2026-10-18T10:30:00Z",
  liveSetsInSession: 12,
};

const messageOf = (build: () => unknown): string => {
  try {
    build();
  } catch (error) {
    return error instanceof RangeError ? error.message : "not a RangeError";
  }
  return "did not throw";
};

describe("buildWorkoutSetInsert", () => {
  it("should carry exactly the columns authenticated may insert, and leave user_id to its default", () => {
    const insert = buildWorkoutSetInsert(input);

    expect(Object.keys(insert).sort()).toEqual([
      "exercise_id",
      "load_kg",
      "performed_at",
      "position",
      "reps",
      "rir",
      "rpe",
      "session_id",
      "set_type",
      "snapshot",
    ]);
    expect(insert).toMatchObject({
      session_id: "6f1c2b9e-0000-4000-8000-0000000000aa",
      exercise_id: "6f1c2b9e-0000-4000-8000-000000000003",
      position: 3,
      set_type: "working",
      reps: 5,
      load_kg: 100,
      rir: 2,
      rpe: null,
      performed_at: "2026-10-18T10:30:00Z",
    });
  });

  it("should carry the snapshot buildSetSnapshot gives for the same exercise and muscles", () => {
    const insert = buildWorkoutSetInsert(input);

    expect(insert.snapshot).toStrictEqual(buildSetSnapshot(squat, squatMuscles));
    expect(insert.snapshot).toMatchObject({ ref: squat.id, name: "Barbell squat" });
  });

  it("should write an RPE set with no RIR", () => {
    const insert = buildWorkoutSetInsert({ ...input, draft: { ...draft, rir: null, rpe: 6.5 } });

    expect(insert).toMatchObject({ rir: null, rpe: 6.5 });
  });

  it("should take a warm-up with no RIR and no RPE", () => {
    const insert = buildWorkoutSetInsert({
      ...input,
      draft: { ...draft, setType: "warmup", rir: null },
    });

    expect(insert).toMatchObject({ set_type: "warmup", rir: null, rpe: null });
  });

  it("should take an unloaded bodyweight set", () => {
    expect(
      buildWorkoutSetInsert({ ...input, draft: { ...draft, loadKg: null } }).load_kg,
    ).toBeNull();
  });

  it("should store the load in whole grams", () => {
    const insert = buildWorkoutSetInsert({ ...input, draft: { ...draft, loadKg: 97.5555 } });

    expect(insert.load_kg).toBe(97.556);
  });

  it("should accept a zone as an offset", () => {
    expect(
      buildWorkoutSetInsert({ ...input, performedAt: "2026-10-18T11:30:00+01:00" }).performed_at,
    ).toBe("2026-10-18T11:30:00+01:00");
  });

  describe("the session limit", () => {
    it("should take the 200th set of a session", () => {
      expect(() => buildWorkoutSetInsert({ ...input, liveSetsInSession: 199 })).not.toThrow();
    });

    it("should refuse the 201st set of a session, stating the rule", () => {
      const build = () => buildWorkoutSetInsert({ ...input, liveSetsInSession: 200 });

      expect(build).toThrow(RangeError);
      expect(messageOf(build)).toBe("A session holds at most 200 live sets.");
    });
  });

  describe("isFullSessionRefusal", () => {
    it("should be true for the RangeError the limit throws", () => {
      let thrown: unknown;
      try {
        buildWorkoutSetInsert({ ...input, liveSetsInSession: 200 });
      } catch (error) {
        thrown = error;
      }

      expect(isFullSessionRefusal(thrown)).toBe(true);
      expect(messageOf(() => buildWorkoutSetInsert({ ...input, liveSetsInSession: 200 }))).toBe(
        FULL_SESSION_RULE,
      );
    });

    it("should be false for another RangeError, another error and a thrown string", () => {
      expect(
        isFullSessionRefusal(new RangeError("The set breaks the rules: reps_whole_1_to_100.")),
      ).toBe(false);
      expect(isFullSessionRefusal(new Error(FULL_SESSION_RULE))).toBe(false);
      expect(isFullSessionRefusal(FULL_SESSION_RULE)).toBe(false);
    });
  });

  describe("the time", () => {
    it("should refuse a performedAt with no zone, stating the rule", () => {
      const build = () => buildWorkoutSetInsert({ ...input, performedAt: "2026-10-18T10:30:00" });

      expect(build).toThrow(RangeError);
      expect(messageOf(build)).toBe("A set's performed_at must be an ISO timestamp with a zone.");
    });

    it("should refuse text that is not a timestamp", () => {
      expect(() => buildWorkoutSetInsert({ ...input, performedAt: "yesterday" })).toThrow(
        RangeError,
      );
    });
  });

  describe("the draft", () => {
    it("should refuse reps out of range", () => {
      const build = () => buildWorkoutSetInsert({ ...input, draft: { ...draft, reps: 4711 } });

      expect(build).toThrow(RangeError);
      expect(messageOf(build)).toBe("The set breaks the rules: reps_whole_1_to_100.");
    });

    it("should refuse reps that are not whole", () => {
      const build = () => buildWorkoutSetInsert({ ...input, draft: { ...draft, reps: 5.5 } });

      expect(messageOf(build)).toBe("The set breaks the rules: reps_whole_1_to_100.");
    });

    it("should refuse a RIR that is not whole", () => {
      const build = () => buildWorkoutSetInsert({ ...input, draft: { ...draft, rir: 2.5 } });

      expect(messageOf(build)).toBe("The set breaks the rules: rir_whole_0_to_10.");
    });

    it("should refuse a set with both RIR and RPE", () => {
      const build = () => buildWorkoutSetInsert({ ...input, draft: { ...draft, rir: 2, rpe: 8 } });

      expect(messageOf(build)).toBe("The set breaks the rules: effort_one_measure_only.");
    });

    it("should refuse an RPE off the half steps", () => {
      const build = () =>
        buildWorkoutSetInsert({ ...input, draft: { ...draft, rir: null, rpe: 6.3 } });

      expect(messageOf(build)).toBe("The set breaks the rules: rpe_1_to_10_in_halves.");
    });

    it("should refuse a load over 1000 kg without quoting it", () => {
      const build = () => buildWorkoutSetInsert({ ...input, draft: { ...draft, loadKg: 1800 } });

      expect(messageOf(build)).toBe("The set breaks the rules: load_0_to_1000_kg.");
      expect(messageOf(build)).not.toContain("1800");
    });

    it("should name every rule the draft breaks", () => {
      const build = () =>
        buildWorkoutSetInsert({
          ...input,
          draft: { ...draft, loadKg: -1, reps: 0, rir: 11, rpe: null },
        });

      expect(messageOf(build)).toBe(
        "The set breaks the rules: load_0_to_1000_kg, reps_whole_1_to_100, rir_whole_0_to_10.",
      );
    });
  });

  it("should refuse an exercise whose muscle map has no primary muscle", () => {
    const build = () => buildWorkoutSetInsert({ ...input, muscles: [] });

    expect(build).toThrow(RangeError);
  });
});
