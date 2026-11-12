import { SETUP_STEPS } from "@keylow/core/setup";
import { describe, expect, it } from "vitest";

import {
  readSetupMode,
  readSetupStep,
  setupExitPath,
  setupPath,
  stepToRedirectTo,
} from "@/lib/setupRoutes";

const TODAY = "2026-10-23";
const golden = {
  sex: "male",
  birthDate: "1991-03-14",
  heightCm: 180,
  weightKg: 80,
} as const;

describe("the wizard's addresses", () => {
  it("should put the first step at /setup, which keeps /setup?mode=first-run valid for the gate", () => {
    expect(setupPath("sex", "first-run")).toBe("/setup?mode=first-run");
    expect(setupPath("sex", "recalculate")).toBe("/setup?mode=recalculate");
  });

  it("should address every later step by its name, with the mode on it", () => {
    expect(setupPath("birthDate", "first-run")).toBe("/setup/birth-date?mode=first-run");
    expect(setupPath("body", "recalculate")).toBe("/setup/body?mode=recalculate");
    expect(setupPath("estimate", "first-run")).toBe("/setup/estimate?mode=first-run");
  });

  it("should read every address back to its step, apart from the first, which has no segment", () => {
    for (const step of SETUP_STEPS.slice(1)) {
      const segment = setupPath(step, "first-run").split("?")[0]?.split("/").at(-1) ?? "";
      expect(readSetupStep(segment)).toBe(step);
    }
    expect(readSetupStep("sex")).toBeUndefined();
    expect(readSetupStep("2")).toBeUndefined();
    expect(readSetupStep("")).toBeUndefined();
  });

  it("should read only an exact first-run as the first run, so a mistyped mode can never trap the person", () => {
    expect(readSetupMode("first-run")).toBe("first-run");
    expect(readSetupMode("recalculate")).toBe("recalculate");
    expect(readSetupMode(undefined)).toBe("recalculate");
    expect(readSetupMode("first-runs")).toBe("recalculate");
    expect(readSetupMode(["first-run"])).toBe("recalculate");
  });

  it("should leave Close for the Targets page", () => {
    expect(setupExitPath()).toBe("/more/targets");
  });
});

describe("the step an address is sent to", () => {
  it("should leave the first step where it is", () => {
    expect(stepToRedirectTo({}, "sex", TODAY)).toBeUndefined();
  });

  it("should send a step whose earlier steps are unanswered to the first incomplete one", () => {
    expect(stepToRedirectTo({}, "body", TODAY)).toBe("sex");
    expect(stepToRedirectTo({ sex: "male" }, "body", TODAY)).toBe("birthDate");
    expect(stepToRedirectTo({ sex: "male", birthDate: "1991-03-14" }, "activity", TODAY)).toBe(
      "body",
    );
  });

  it("should send the estimate on an empty draft to the first step", () => {
    expect(stepToRedirectTo({}, "estimate", TODAY)).toBe("sex");
  });

  it("should treat a birth date that no longer passes the checks as unanswered", () => {
    expect(stepToRedirectTo({ ...golden, birthDate: "2026-10-24" }, "body", TODAY)).toBe(
      "birthDate",
    );
  });

  it("should let a step through once the steps before it are answered", () => {
    expect(stepToRedirectTo(golden, "activity", TODAY)).toBeUndefined();
    expect(stepToRedirectTo({ ...golden, activity: "light" }, "goal", TODAY)).toBeUndefined();
  });

  it("should ask for the rate when a goal that moves the weight has none", () => {
    const answered = { ...golden, activity: "light", goal: "lose" } as const;

    expect(stepToRedirectTo(answered, "protein", TODAY)).toBe("rate");
    expect(
      stepToRedirectTo({ ...answered, ratePctPerWeek: 0.5 }, "protein", TODAY),
    ).toBeUndefined();
  });

  it("should send the rate address of a Maintain goal on to the step after it", () => {
    const maintaining = { ...golden, activity: "light", goal: "maintain" } as const;

    expect(stepToRedirectTo(maintaining, "rate", TODAY)).toBe("protein");
  });

  it("should not need the rate to reach the estimate with a Maintain goal", () => {
    const maintaining = {
      ...golden,
      activity: "light",
      goal: "maintain",
      proteinPreset: "moderate",
      dietStyle: "balanced",
    } as const;

    expect(stepToRedirectTo(maintaining, "estimate", TODAY)).toBeUndefined();
  });
});
