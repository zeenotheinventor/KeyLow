import { describe, expect, it } from "vitest";

import {
  EXERCISE_TREND,
  describeTrendChange,
  describeTrendMovement,
  describeTrendValue,
} from "../../src/copy";

describe("EXERCISE_TREND", () => {
  it("should hold the words of the states with no number", () => {
    expect(EXERCISE_TREND).toEqual({
      noChange: "No change",
      firstWeek: "First week",
      notTrainedYet: "Not trained yet",
    });
  });
});

describe("describeTrendValue", () => {
  it("should print a load in kilograms without a trailing .0", () => {
    expect(describeTrendValue({ loadKg: 15, reps: 8 }, "kg")).toBe("15 kg");
    expect(describeTrendValue({ loadKg: 62.5, reps: 8 }, "kg")).toBe("62.5 kg");
  });

  it("should print a load in pounds from the stored kilograms, to one decimal", () => {
    expect(describeTrendValue({ loadKg: 100, reps: 5 }, "lb")).toBe("220.5 lb");
  });

  it("should print reps only for a week with no load, singular for one", () => {
    expect(describeTrendValue({ loadKg: null, reps: 14 }, "kg")).toBe("14 reps");
    expect(describeTrendValue({ loadKg: null, reps: 1 }, "lb")).toBe("1 rep");
  });
});

describe("describeTrendChange", () => {
  it("should say not trained yet, first week, and no change", () => {
    expect(describeTrendChange(null, "kg")).toBe("Not trained yet");
    expect(describeTrendChange({ kind: "first" }, "kg")).toBe("First week");
    expect(describeTrendChange({ kind: "same" }, "kg")).toBe("No change");
  });

  it("should show a load gain with a plus and a loss with the true minus sign", () => {
    const change = (previousLoadKg: number, latestLoadKg: number) =>
      ({ kind: "load", previousLoadKg, latestLoadKg, repsChange: 0 }) as const;

    expect(describeTrendChange(change(60, 65), "kg")).toBe("+5 kg");
    expect(describeTrendChange(change(65, 60), "kg")).toBe("−5 kg");
    expect(describeTrendChange(change(60, 62.5), "kg")).toBe("+2.5 kg");
  });

  it("should show the load change first even when the reps changed too", () => {
    expect(
      describeTrendChange(
        { kind: "load", previousLoadKg: 60, latestLoadKg: 65, repsChange: -3 },
        "kg",
      ),
    ).toBe("+5 kg");
  });

  it("should show the reps change when the load is equal, singular for one", () => {
    expect(describeTrendChange({ kind: "reps", repsChange: 2 }, "kg")).toBe("+2 reps");
    expect(describeTrendChange({ kind: "reps", repsChange: 1 }, "kg")).toBe("+1 rep");
    expect(describeTrendChange({ kind: "reps", repsChange: -3 }, "kg")).toBe("−3 reps");
  });

  it("should work the pound change out from the converted values, so it matches the numbers shown", () => {
    // 100 kg shows as 220.5 lb and 100.5 kg as 221.6 lb, so the change is 1.1 lb, not 1.1023.
    const change = {
      kind: "load",
      previousLoadKg: 100,
      latestLoadKg: 100.5,
      repsChange: 0,
    } as const;

    expect(describeTrendChange(change, "lb")).toBe("+1.1 lb");
  });

  it("should show the difference of the two values shown, not the rounded difference of the kilograms", () => {
    // 50 kg shows as 110.2 lb and 50.1 kg as 110.5 lb, so the change reads +0.3 lb. Converting the 0.1 kg
    // difference alone would give +0.2 lb, which the two numbers on screen would contradict.
    const change = { kind: "load", previousLoadKg: 50, latestLoadKg: 50.1, repsChange: 0 } as const;

    expect(describeTrendValue({ loadKg: 50, reps: 1 }, "lb")).toBe("110.2 lb");
    expect(describeTrendValue({ loadKg: 50.1, reps: 1 }, "lb")).toBe("110.5 lb");
    expect(describeTrendChange(change, "lb")).toBe("+0.3 lb");
  });

  it("should fall back to the reps change when the load change is 0 once converted", () => {
    // 60 kg and 60.04 kg both show as 60 kg.
    const change = {
      kind: "load",
      previousLoadKg: 60,
      latestLoadKg: 60.04,
      repsChange: 2,
    } as const;

    expect(describeTrendChange(change, "kg")).toBe("+2 reps");
    expect(describeTrendChange({ ...change, repsChange: 0 }, "kg")).toBe("No change");
  });

  it("should read no load as 0 when the move is to or from bodyweight", () => {
    expect(
      describeTrendChange(
        { kind: "load", previousLoadKg: null, latestLoadKg: 10, repsChange: -4 },
        "kg",
      ),
    ).toBe("+10 kg");
    expect(
      describeTrendChange(
        { kind: "load", previousLoadKg: 10, latestLoadKg: null, repsChange: 4 },
        "kg",
      ),
    ).toBe("−10 kg");
  });
});

describe("describeTrendMovement", () => {
  it("should say nothing moved for a state with no change, a same week and a first week", () => {
    expect(describeTrendMovement(null, "kg")).toBeNull();
    expect(describeTrendMovement({ kind: "first" }, "kg")).toBeNull();
    expect(describeTrendMovement({ kind: "same" }, "kg")).toBeNull();
    expect(describeTrendMovement({ kind: "reps", repsChange: 0 }, "kg")).toBeNull();
  });

  it("should give the direction and the amount of a load change, without a sign", () => {
    const load = (previousLoadKg: number, latestLoadKg: number) =>
      ({ kind: "load", previousLoadKg, latestLoadKg, repsChange: 0 }) as const;

    expect(describeTrendMovement(load(60, 65), "kg")).toEqual({ direction: "up", amount: "5 kg" });
    expect(describeTrendMovement(load(65, 60), "kg")).toEqual({
      direction: "down",
      amount: "5 kg",
    });
  });

  it("should give the amount in pounds as the difference of the two values shown", () => {
    expect(
      describeTrendMovement(
        { kind: "load", previousLoadKg: 50, latestLoadKg: 50.1, repsChange: 0 },
        "lb",
      ),
    ).toEqual({ direction: "up", amount: "0.3 lb" });
  });

  it("should give the reps when the load is equal, or when the load change shows as nothing", () => {
    expect(describeTrendMovement({ kind: "reps", repsChange: 2 }, "kg")).toEqual({
      direction: "up",
      amount: "2 reps",
    });
    expect(describeTrendMovement({ kind: "reps", repsChange: -1 }, "kg")).toEqual({
      direction: "down",
      amount: "1 rep",
    });
    expect(
      describeTrendMovement(
        { kind: "load", previousLoadKg: 60, latestLoadKg: 60.04, repsChange: -2 },
        "kg",
      ),
    ).toEqual({ direction: "down", amount: "2 reps" });
  });
});
