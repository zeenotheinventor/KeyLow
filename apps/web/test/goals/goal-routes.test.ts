import { describe, expect, it } from "vitest";

import {
  goalExitPath,
  goalFromTrainPath,
  goalLeavePath,
  goalPath,
  goalQuestionPath,
  goalRowPath,
  goalSummaryPath,
  isOpenedFromTrain,
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

  it("should open the Goal page from the Goal row of More", () => {
    expect(goalRowPath()).toBe("/goal");
  });
});

describe("where the goal questionnaire leaves to", () => {
  it("should leave to More, which is where its row is", () => {
    expect(goalExitPath()).toBe("/more");
  });
});

describe("where a saved or closed flow leaves to", () => {
  it("should leave for the Goal page when a goal was stored, so the new answers show", () => {
    expect(goalLeavePath(true)).toBe("/goal");
  });

  it("should leave for More when the first goal is being set", () => {
    expect(goalLeavePath(false)).toBe("/more");
  });
});

describe("where a flow Train opened leaves to", () => {
  it("should leave for Train when the first goal is being set", () => {
    expect(goalLeavePath(false, { fromTrain: true })).toBe("/train");
  });

  it("should leave for the Goal page as Train opens it when a goal was stored, so its Back returns to Train", () => {
    expect(goalLeavePath(true, { fromTrain: true })).toBe(goalFromTrainPath());
    expect(goalFromTrainPath()).toBe("/goal?from=train");
  });
});

describe("the addresses that carry Train as the origin", () => {
  it("should carry the origin on a question, beside the Goal page flag", () => {
    expect(goalQuestionPath(2, { fromTrain: true })).toBe("/goal/2?origin=train");
    expect(goalQuestionPath(2, { fromGoalPage: true, fromTrain: true })).toBe(
      "/goal/2?from=goal&origin=train",
    );
  });

  it("should carry the origin on the summary", () => {
    expect(goalSummaryPath({ fromTrain: true })).toBe("/goal/summary?origin=train");
  });

  it("should say Train opened the flow only when the origin parameter says so", () => {
    expect(isOpenedFromTrain("train")).toBe(true);
    expect(isOpenedFromTrain(undefined)).toBe(false);
    expect(isOpenedFromTrain("more")).toBe(false);
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
