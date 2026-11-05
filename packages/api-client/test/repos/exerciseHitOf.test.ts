import { describe, expect, it } from "vitest";

import { exerciseHitOf } from "../../src/repos/exercises";

import type { ExerciseDetail } from "../../src/repos/exercises";

const saved: ExerciseDetail = {
  id: "0000000a-0000-4000-8000-000000000001",
  name: "Lean-away cable raise",
  equipment: "cable",
  mechanic: "isolation",
  source: "user",
  muscles: [
    { muscle_id: "delt_side", role: "primary", weight: 1 },
    { muscle_id: "traps_upper", role: "secondary", weight: 0.5 },
    { muscle_id: "forearms", role: "stabiliser", weight: 0.2 },
  ],
};

describe("exerciseHitOf", () => {
  it("should list the primary and secondary muscles in the order of the muscle map", () => {
    expect(exerciseHitOf(saved)).toMatchObject({
      primary_muscles: ["delt_side"],
      secondary_muscles: ["traps_upper"],
    });
  });

  it("should leave the assisting muscles out and the muscle map off the hit", () => {
    const hit = exerciseHitOf(saved);

    expect(JSON.stringify(hit)).not.toContain("forearms");
    expect("muscles" in hit).toBe(false);
  });

  it("should keep the exercise's own columns", () => {
    expect(exerciseHitOf(saved)).toMatchObject({
      id: saved.id,
      name: "Lean-away cable raise",
      equipment: "cable",
      mechanic: "isolation",
      source: "user",
    });
  });
});
