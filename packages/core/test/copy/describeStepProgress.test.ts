import { describe, expect, it } from "vitest";

import { describeStepProgress } from "../../src/copy";

describe("describeStepProgress", () => {
  it("should read Step 1 of 8 and fill a ninth of the bar on the sex step", () => {
    const progress = describeStepProgress({}, "sex");

    expect(progress.subtitle).toBe("Step 1 of 8");
    expect(progress.progressName).toBe("Step 1 of 8");
    expect(progress.percent).toBeCloseTo(11.11, 2);
  });

  it("should read Step 2 of 8 and fill two ninths on the birth date step", () => {
    const progress = describeStepProgress({}, "birthDate");

    expect(progress.subtitle).toBe("Step 2 of 8");
    expect(progress.percent).toBeCloseTo(22.22, 2);
  });

  it("should read Step 5 of 8 on the goal step when the goal is lose", () => {
    expect(describeStepProgress({ goal: "lose" }, "goal").subtitle).toBe("Step 5 of 8");
  });

  it("should read Step 5 of 7 on the goal step when the goal is maintain", () => {
    const progress = describeStepProgress({ goal: "maintain" }, "goal");

    expect(progress.subtitle).toBe("Step 5 of 7");
    expect(progress.percent).toBe(62.5);
  });

  it("should name the bar Setup complete, with no step line, on the estimate", () => {
    const progress = describeStepProgress({}, "estimate");

    expect(progress.subtitle).toBeUndefined();
    expect(progress.progressName).toBe("Setup complete");
    expect(progress.percent).toBe(100);
  });
});
