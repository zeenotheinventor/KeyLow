import { describe, expect, it } from "vitest";

import { goalPath, goalQuestionPath, readGoalStep } from "@/lib/goalRoutes";

describe("where the goal questionnaire leads", () => {
  it("should open the flow at /goal", () => {
    expect(goalPath()).toBe("/goal");
  });

  it("should address each question under the flow by its number", () => {
    expect(goalQuestionPath(1)).toBe("/goal/1");
    expect(goalQuestionPath(6)).toBe("/goal/6");
  });
});

describe("reading the step an address names", () => {
  it.each([
    ["1", "goal"],
    ["2", "focus"],
    ["3", "days"],
    ["4", "minutes"],
    ["5", "equipment"],
    ["6", "experience"],
  ])("should read %s as the %s question", (segment, step) => {
    expect(readGoalStep(segment)).toBe(step);
  });

  it.each(["", "0", "7", "1.5", "two", "-1", " 2", "01", "summary"])(
    "should read %j as no question",
    (segment) => {
      expect(readGoalStep(segment)).toBeUndefined();
    },
  );
});
