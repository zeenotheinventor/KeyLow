import { describe, expect, it } from "vitest";

import { parseSetSnapshot } from "../../src/training";

import type { SetSnapshotProblem } from "../../src/training";

const stored = {
  version: 1,
  kind: "exercise",
  ref: "6f1c2b9e-0000-4000-8000-000000000001",
  name: "Dumbbell lateral raise",
  equipment: "dumbbell",
  mechanic: "isolation",
  muscleListVersion: 1,
  muscles: [
    { muscle_id: "delt_side", role: "primary", weight: 1 },
    { muscle_id: "traps_upper", role: "secondary", weight: 0.3 },
  ],
};

const problemOf = (value: unknown): SetSnapshotProblem | null => {
  const result = parseSetSnapshot(value);
  return result.ok ? null : result.problem;
};

const without = (key: keyof typeof stored): Record<string, unknown> =>
  Object.fromEntries(Object.entries(stored).filter(([name]) => name !== key));

const unknownMuscle = { muscle_id: "rotator_cuff", role: "secondary", weight: 0.2 };

describe("parseSetSnapshot", () => {
  it("should read a stored v1 snapshot", () => {
    expect(parseSetSnapshot(stored)).toStrictEqual({ ok: true, snapshot: stored });
  });

  it.each<[string, unknown]>([
    ["a later snapshot version", { ...stored, version: 2 }],
    ["version 0", { ...stored, version: 0 }],
    ["a version written as text", { ...stored, version: "1" }],
    ["a later muscle list", { ...stored, muscleListVersion: 2 }],
  ])("should report an unknown version for %s", (_case, value) => {
    expect(problemOf(value)).toBe("unknown_version");
  });

  it("should report an unknown version before an unknown muscle, which a later list may have", () => {
    expect(
      problemOf({ ...stored, muscleListVersion: 2, muscles: [...stored.muscles, unknownMuscle] }),
    ).toBe("unknown_version");
  });

  it("should report a muscle id that is not on the list", () => {
    expect(problemOf({ ...stored, muscles: [...stored.muscles, unknownMuscle] })).toBe(
      "unknown_muscle",
    );
  });

  it.each<[string, unknown]>([
    ["null", null],
    ["a string", "snapshot"],
    ["an array", [stored]],
    ["a snapshot without a version", without("version")],
    ["a food snapshot", { ...stored, kind: "food" }],
    ["a snapshot without muscles", without("muscles")],
    ["a map without a primary muscle", { ...stored, muscles: [stored.muscles[1]] }],
    ["a weight above 1", { ...stored, muscles: [{ ...stored.muscles[0], weight: 1.5 }] }],
    ["a key the shape does not have", { ...stored, load_kg: 20 }],
  ])("should report anything else as invalid, such as %s", (_case, value) => {
    expect(problemOf(value)).toBe("invalid");
  });
});
