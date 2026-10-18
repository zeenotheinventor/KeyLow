import { describe, expect, it } from "vitest";

import { buildSetSnapshot } from "../../src/training";

import type { ExerciseMuscleEntry, ExerciseMuscleRow } from "../../src/schemas";
import type { SnapshotExercise } from "../../src/training";

const exercise: SnapshotExercise = {
  id: "6f1c2b9e-0000-4000-8000-000000000002",
  name: "Barbell bench press",
  equipment: "barbell",
  mechanic: "compound",
};

const benchPress: ExerciseMuscleEntry[] = [
  { muscle_id: "triceps", role: "secondary", weight: 0.5 },
  { muscle_id: "chest_lower", role: "primary", weight: 1 },
  { muscle_id: "delt_front", role: "secondary", weight: 0.5 },
  { muscle_id: "chest_upper", role: "secondary", weight: 0.6 },
];

describe("buildSetSnapshot", () => {
  it("should freeze the exercise against the current versions", () => {
    expect(buildSetSnapshot(exercise, benchPress)).toMatchObject({
      version: 1,
      kind: "exercise",
      ref: exercise.id,
      name: "Barbell bench press",
      equipment: "barbell",
      mechanic: "compound",
      muscleListVersion: 1,
    });
  });

  it("should keep the muscles in the order of the muscle list", () => {
    expect(
      buildSetSnapshot(exercise, benchPress).muscles.map((muscle) => muscle.muscle_id),
    ).toEqual(["chest_upper", "chest_lower", "delt_front", "triceps"]);
  });

  it("should give the same snapshot whatever order the map was read in", () => {
    expect(buildSetSnapshot(exercise, [...benchPress].reverse())).toStrictEqual(
      buildSetSnapshot(exercise, benchPress),
    );
  });

  it("should leave the map it was given untouched", () => {
    const muscles = [...benchPress];

    buildSetSnapshot(exercise, muscles);

    expect(muscles).toEqual(benchPress);
  });

  it("should carry only the id, role and weight of a stored row", () => {
    const rows: ExerciseMuscleRow[] = benchPress.map((muscle, index) => ({
      id: `00000000-0000-4000-8000-00000000000${index}`,
      exercise_id: exercise.id,
      owner_id: null,
      created_at: "2026-10-18T08:00:00+00:00",
      ...muscle,
    }));

    for (const muscle of buildSetSnapshot(exercise, rows).muscles) {
      expect(Object.keys(muscle)).toEqual(["muscle_id", "role", "weight"]);
    }
  });

  it("should not change when the exercise's map is edited later", () => {
    const muscles = benchPress.map((muscle) => ({ ...muscle }));
    const snapshot = buildSetSnapshot(exercise, muscles);

    for (const muscle of muscles) {
      muscle.weight = 0.2;
    }

    expect(snapshot.muscles.find((muscle) => muscle.muscle_id === "chest_lower")?.weight).toBe(1);
  });

  it("should throw a RangeError for a map without a primary muscle", () => {
    expect(() =>
      buildSetSnapshot(exercise, [{ muscle_id: "triceps", role: "secondary", weight: 0.5 }]),
    ).toThrow(new RangeError("An exercise needs at least one primary muscle"));
  });

  it("should throw a RangeError for a muscle listed twice", () => {
    expect(() =>
      buildSetSnapshot(exercise, [
        ...benchPress,
        { muscle_id: "triceps", role: "stabiliser", weight: 0.1 },
      ]),
    ).toThrow(new RangeError("An exercise lists each muscle at most once"));
  });

  it("should throw a RangeError for a weight out of range", () => {
    expect(() =>
      buildSetSnapshot(exercise, [{ muscle_id: "chest_lower", role: "primary", weight: 0 }]),
    ).toThrow(RangeError);
  });
});
