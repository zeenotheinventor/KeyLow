import { describe, expect, it } from "vitest";

import { nextStep, previousStep, progressFraction, stepCount, stepNumber } from "../../src/setup";

describe("the setup steps", () => {
  describe("for a goal that is not maintain", () => {
    it.each([
      ["sex", "birthDate"],
      ["birthDate", "body"],
      ["body", "activity"],
      ["activity", "goal"],
      ["goal", "rate"],
      ["rate", "protein"],
      ["protein", "diet"],
      ["diet", "estimate"],
    ] as const)("should go from %s to %s", (step, expected) => {
      expect(nextStep({ goal: "lose" }, step)).toBe(expected);
      expect(previousStep({ goal: "lose" }, expected)).toBe(step);
    });

    it("should have nothing after the estimate", () => {
      expect(nextStep({ goal: "gain" }, "estimate")).toBeUndefined();
    });

    it("should have nothing before the sex step", () => {
      expect(previousStep({ goal: "gain" }, "sex")).toBeUndefined();
    });

    it("should count eight questions", () => {
      expect(stepCount({ goal: "lose" })).toBe(8);
      expect(stepCount({ goal: "gain" })).toBe(8);
    });

    it("should number the questions from one", () => {
      expect(stepNumber({ goal: "lose" }, "sex")).toBe(1);
      expect(stepNumber({ goal: "lose" }, "rate")).toBe(6);
      expect(stepNumber({ goal: "lose" }, "diet")).toBe(8);
    });

    it("should leave the estimate unnumbered", () => {
      expect(stepNumber({ goal: "lose" }, "estimate")).toBeUndefined();
    });
  });

  describe("before a goal is chosen", () => {
    it("should keep the rate step", () => {
      expect(nextStep({}, "goal")).toBe("rate");
      expect(stepCount({})).toBe(8);
    });
  });

  describe("for the maintain goal", () => {
    it("should skip the rate step going forward", () => {
      expect(nextStep({ goal: "maintain" }, "goal")).toBe("protein");
    });

    it("should skip the rate step going back", () => {
      expect(previousStep({ goal: "maintain" }, "protein")).toBe("goal");
    });

    it("should count seven questions", () => {
      expect(stepCount({ goal: "maintain" })).toBe(7);
    });

    it("should number the questions after the skipped one one lower", () => {
      expect(stepNumber({ goal: "maintain" }, "goal")).toBe(5);
      expect(stepNumber({ goal: "maintain" }, "protein")).toBe(6);
      expect(stepNumber({ goal: "maintain" }, "diet")).toBe(7);
    });

    it("should give the skipped rate step no number", () => {
      expect(stepNumber({ goal: "maintain" }, "rate")).toBeUndefined();
    });

    it("should leave the estimate unnumbered", () => {
      expect(stepNumber({ goal: "maintain" }, "estimate")).toBeUndefined();
    });

    it("should leave the other steps in place", () => {
      expect(nextStep({ goal: "maintain" }, "sex")).toBe("birthDate");
      expect(nextStep({ goal: "maintain" }, "diet")).toBe("estimate");
    });
  });
});

describe("progressFraction", () => {
  it("should be a ninth at the first question, counting the estimate as the last stop", () => {
    expect(progressFraction({ goal: "lose" }, "sex")).toBe(1 / 9);
  });

  it("should be eight ninths at the last question", () => {
    expect(progressFraction({ goal: "lose" }, "diet")).toBe(8 / 9);
  });

  it("should be seven eighths at the last question when maintain skips the rate", () => {
    expect(progressFraction({ goal: "maintain" }, "diet")).toBe(7 / 8);
  });

  it("should be full at the estimate", () => {
    expect(progressFraction({ goal: "lose" }, "estimate")).toBe(1);
    expect(progressFraction({ goal: "maintain" }, "estimate")).toBe(1);
  });
});
