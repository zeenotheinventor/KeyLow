import * as copy from "../../../src/copy";

// Every function `src/copy/widgets.ts` exports, called with representative arguments. The voice test fails
// when a function has no row, so no sentence escapes the sweep.
export const samples: Record<string, () => string[]> = {
  describeTodayEyebrow: () => [copy.describeTodayEyebrow("2026-11-03")],
  describeGlanceEyebrow: () => [copy.describeGlanceEyebrow("2026-11-03")],
  describeWeekEyebrow: () => [copy.describeWeekEyebrow("2026-11-02")],
  describeBodyMapEyebrow: () => [
    copy.describeBodyMapEyebrow("heat"),
    copy.describeBodyMapEyebrow("volume"),
  ],
  describeSessionEyebrow: () => [copy.describeSessionEyebrow(32)],
  describeRingCaption: () => [
    copy.describeRingCaption("left"),
    copy.describeRingCaption("over"),
    copy.describeRingCaption("eaten"),
  ],
  describeEatenOfTarget: () => [copy.describeEatenOfTarget(1460, 2200)],
  describeRingName: () => [copy.describeRingName(1460, 2200)],
  describeEatenOfTargetWithUnit: () => [copy.describeEatenOfTargetWithUnit(1460, 2200)],
  describeEatenWithoutTarget: () => [copy.describeEatenWithoutTarget(1460)],
  describeAverageCaption: () => [
    copy.describeAverageCaption(2200),
    copy.describeAverageCaption(null),
  ],
  describeAverageLine: () => [copy.describeAverageLine(2050)],
  describeOfflineStatus: () => [copy.describeOfflineStatus("10:05")],
  describeFoodEnergy: () => [copy.describeFoodEnergy(410)],
  describeLogAgainName: () => [copy.describeLogAgainName("Overnight oats", 410)],
  describeLogged: () => [copy.describeLogged("Overnight oats"), copy.describeLogged(null)],
  describeWeighInAge: () => [
    copy.describeWeighInAge(0),
    copy.describeWeighInAge(1),
    copy.describeWeighInAge(3),
  ],
  describePlanSubtitle: () => [
    copy.describePlanSubtitle(5, ["Rows", "Pull-ups", "Curls"]),
    copy.describePlanSubtitle(1, ["Rows"]),
  ],
  describePlanLine: () => [copy.describePlanLine("Pull day", 5)],
  describeSessionLine: () => [copy.describeSessionLine("Pull day"), copy.describeSessionLine(null)],
  describeHeatChip: () => [copy.describeHeatChip("chest_upper", 5)],
  describeExerciseProgress: () => [copy.describeExerciseProgress(2, 5)],
  describeSetProgress: () => [copy.describeSetProgress(3, 4)],
  describeLastTime: () => [copy.describeLastTime("67.5", 8), copy.describeLastTime(null, 8)],
};
