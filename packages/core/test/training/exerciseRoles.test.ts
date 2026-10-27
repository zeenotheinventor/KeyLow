import { describe, expect, it } from "vitest";

import { exerciseRoleValues, musclesByRole, ROLE_FIGURE_VALUES } from "../../src/training";

import type { ExerciseMuscleEntry } from "../../src/schemas";

/** Leg Press as the library writes it, in an order that is not the order of the muscle list. */
const legPress: readonly ExerciseMuscleEntry[] = [
  { muscle_id: "calves", role: "stabiliser", weight: 0.2 },
  { muscle_id: "hamstrings", role: "secondary", weight: 0.5 },
  { muscle_id: "quads", role: "primary", weight: 1 },
  { muscle_id: "glute_max", role: "secondary", weight: 0.5 },
];

describe("the role scale of the figure", () => {
  it("should write stabiliser 1, secondary 2 and primary 3", () => {
    expect(ROLE_FIGURE_VALUES).toStrictEqual({ stabiliser: 1, secondary: 2, primary: 3 });
  });
});

describe("exerciseRoleValues", () => {
  it("should give Leg Press quads 3, glutes 2, hamstrings 2 and calves 1, and no other key", () => {
    expect(exerciseRoleValues(legPress)).toStrictEqual({
      quads: 3,
      glute_max: 2,
      hamstrings: 2,
      calves: 1,
    });
  });

  it("should leave an exercise with no muscles with no key", () => {
    expect(exerciseRoleValues([])).toStrictEqual({});
  });

  it("should keep the stronger role when a muscle appears twice, in either order", () => {
    const secondaryThenPrimary: readonly ExerciseMuscleEntry[] = [
      { muscle_id: "quads", role: "secondary", weight: 0.5 },
      { muscle_id: "quads", role: "primary", weight: 1 },
    ];

    expect(exerciseRoleValues(secondaryThenPrimary)).toStrictEqual({ quads: 3 });
    expect(exerciseRoleValues([...secondaryThenPrimary].reverse())).toStrictEqual({ quads: 3 });
  });

  it("should read a snapshot's muscles the same way", () => {
    expect(exerciseRoleValues([{ muscle_id: "lats", role: "stabiliser" }])).toStrictEqual({
      lats: 1,
    });
  });
});

describe("musclesByRole", () => {
  it("should group Leg Press as primary, secondary, stabiliser, with the muscles in list order", () => {
    expect(musclesByRole(legPress)).toStrictEqual([
      { role: "primary", muscles: ["quads"] },
      { role: "secondary", muscles: ["glute_max", "hamstrings"] },
      { role: "stabiliser", muscles: ["calves"] },
    ]);
  });

  it("should give one group for an exercise with only a primary muscle", () => {
    expect(musclesByRole([{ muscle_id: "biceps", role: "primary" }])).toStrictEqual([
      { role: "primary", muscles: ["biceps"] },
    ]);
  });

  it("should leave out a role with no muscles", () => {
    const groups = musclesByRole([
      { muscle_id: "triceps", role: "stabiliser" },
      { muscle_id: "chest_upper", role: "primary" },
    ]);

    expect(groups.map((group) => group.role)).toStrictEqual(["primary", "stabiliser"]);
  });

  it("should give no group for an exercise with no muscles", () => {
    expect(musclesByRole([])).toStrictEqual([]);
  });

  it("should list a muscle that appears twice once, under its stronger role", () => {
    expect(
      musclesByRole([
        { muscle_id: "quads", role: "stabiliser" },
        { muscle_id: "quads", role: "secondary" },
      ]),
    ).toStrictEqual([{ role: "secondary", muscles: ["quads"] }]);
  });

  it("should not change the map it is given", () => {
    const given = legPress.map((entry) => ({ ...entry }));

    musclesByRole(given);
    exerciseRoleValues(given);

    expect(given).toStrictEqual(legPress);
  });
});
