import { describe, expect, it } from "vitest";

import {
  goalExitPath,
  goalPath,
  goalQuestionPath,
  goalRowPath,
  goalSummaryPath,
  readGoalStep,
} from "@/lib/goalRoutes";

describe("where the goal questionnaire leads", () => {
  it("should open the flow at /goal", () => {
    expect(goalPath()).toBe("/goal");
  });

  it("should address each question under the flow by its number", () => {
    expect(goalQuestionPath(1)).toBe("/goal/1");
    expect(goalQuestionPath(6)).toBe("/goal/6");
  });
});

describe("where the last question and the Goal row lead", () => {
  it("should address the summary under the flow, beside the questions", () => {
    expect(goalSummaryPath()).toBe("/goal/summary");
  });

  it("should open the flow from the Goal row of More for now", () => {
    expect(goalRowPath()).toBe("/goal");
  });
});

describe("where the goal questionnaire leaves to", () => {
  it("should leave to More, which is where its row is", () => {
    expect(goalExitPath()).toBe("/more");
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
