import * as copy from "../../../src/copy";

// The sentences each function of the weekly exercise trend copy can print, for the voice test's sweep.
export const samples: Record<string, () => string[]> = {
  describeTrendValue: () => [
    copy.describeTrendValue({ loadKg: 62.5, reps: 6 }, "kg"),
    copy.describeTrendValue({ loadKg: 62.5, reps: 6 }, "lb"),
    copy.describeTrendValue({ loadKg: null, reps: 12 }, "kg"),
  ],
  describeTrendChange: () => [
    copy.describeTrendChange(null, "kg"),
    copy.describeTrendChange({ kind: "first" }, "kg"),
    copy.describeTrendChange({ kind: "same" }, "kg"),
    copy.describeTrendChange({ kind: "reps", repsChange: 2 }, "kg"),
    copy.describeTrendChange({ kind: "reps", repsChange: -1 }, "kg"),
    copy.describeTrendChange(
      { kind: "load", previousLoadKg: 60, latestLoadKg: 62.5, repsChange: 0 },
      "kg",
    ),
    copy.describeTrendChange(
      { kind: "load", previousLoadKg: 62.5, latestLoadKg: 60, repsChange: 0 },
      "lb",
    ),
  ],
  describeTrendMovement: () =>
    [
      copy.describeTrendMovement({ kind: "reps", repsChange: 2 }, "kg"),
      copy.describeTrendMovement(
        { kind: "load", previousLoadKg: 62.5, latestLoadKg: 60, repsChange: 0 },
        "lb",
      ),
    ].flatMap((movement) => (movement === null ? [] : [movement.amount])),
};
