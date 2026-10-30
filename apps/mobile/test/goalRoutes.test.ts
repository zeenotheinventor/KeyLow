import { goalPath, goalQuestionPath, goalSummaryPath, readGoalStep } from "../lib/goalRoutes";

describe("where the goal questionnaire leads", () => {
  it("should open the flow at /goal", () => {
    expect(goalPath()).toBe("/goal");
  });

  it("should address each question under the flow by its number", () => {
    expect(goalQuestionPath(1)).toBe("/goal/1");
    expect(goalQuestionPath(6)).toBe("/goal/6");
  });

  it("should address the priorities summary under the flow", () => {
    expect(goalSummaryPath()).toBe("/goal/summary");
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
  ])("should read %s as the %s question", (value, step) => {
    expect(readGoalStep(value)).toBe(step);
  });

  it.each([undefined, "", "0", "7", "1.5", "two", "-1", " 2", "01", "summary"])(
    "should read %p as no question",
    (value) => {
      expect(readGoalStep(value)).toBeUndefined();
    },
  );

  it("should read the first of several values, as a repeated parameter gives them", () => {
    expect(readGoalStep(["3", "4"])).toBe("days");
  });
});
