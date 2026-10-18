import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  equipmentSchema,
  exerciseMechanicSchema,
  exerciseMuscleEntrySchema,
  setSnapshotSchema,
} from "../../src/schemas";
import { buildSetSnapshot, parseSetSnapshot } from "../../src/training";
import goldenSnapshots from "../fixtures/training/goldenSetV1Snapshots.json";

/*
 * Stored set snapshots at v1, each with the exercise and muscle map it was taken from. They must never
 * change: they prove a set logged today still reads exactly the same when the code is touched later, and
 * that the same exercise still freezes to the same bytes. The first is the example of ADR 0005,
 * Amendment 1, "The set snapshot", which is also copied below so the fixture cannot drift from the ADR.
 */

const fixtureSchema = z.object({
  name: z.string(),
  exercise: z.object({
    id: z.string(),
    name: z.string(),
    equipment: equipmentSchema,
    mechanic: exerciseMechanicSchema,
  }),
  muscles: z.array(exerciseMuscleEntrySchema),
  snapshot: z.unknown(),
});

const fixtures = z.array(fixtureSchema).parse(goldenSnapshots);

const amendmentExample = `{
  "version": 1,
  "kind": "exercise",
  "ref": "6f1c2b9e-0000-4000-8000-000000000001",
  "name": "Dumbbell lateral raise",
  "equipment": "dumbbell",
  "mechanic": "isolation",
  "muscleListVersion": 1,
  "muscles": [
    { "muscle_id": "delt_side", "role": "primary", "weight": 1 },
    { "muscle_id": "traps_upper", "role": "secondary", "weight": 0.3 }
  ]
}`;

describe("golden set v1 snapshots", () => {
  it("should start with the example of Amendment 1, key for key and in its order", () => {
    expect(JSON.stringify(fixtures[0]?.snapshot)).toBe(
      JSON.stringify(JSON.parse(amendmentExample)),
    );
  });

  it.each(fixtures)("should still parse $name", ({ snapshot }) => {
    expect(setSnapshotSchema.parse(snapshot)).toStrictEqual(snapshot);
    expect(parseSetSnapshot(snapshot)).toStrictEqual({ ok: true, snapshot });
  });

  it.each(fixtures)(
    "should build exactly the stored snapshot, in the same key order, for $name",
    ({ exercise, muscles, snapshot }) => {
      const built = buildSetSnapshot(exercise, muscles);

      expect(built).toStrictEqual(snapshot);
      expect(JSON.stringify(built)).toBe(JSON.stringify(snapshot));
    },
  );

  it.each(fixtures)(
    "should come back the same after a round trip through JSON for $name",
    ({ exercise, muscles }) => {
      const built = buildSetSnapshot(exercise, muscles);

      expect(parseSetSnapshot(JSON.parse(JSON.stringify(built)))).toStrictEqual({
        ok: true,
        snapshot: built,
      });
    },
  );
});
