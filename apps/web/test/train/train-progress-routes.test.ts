import { describe, expect, it } from "vitest";

import { trainExerciseProgressPath } from "@/lib/trainRoutes";

describe("trainExerciseProgressPath", () => {
  it("should carry the exercise's id in the path and nothing else", () => {
    expect(trainExerciseProgressPath("00000007-0000-4000-8000-000000000001")).toBe(
      "/train/progress/00000007-0000-4000-8000-000000000001",
    );
  });
});
