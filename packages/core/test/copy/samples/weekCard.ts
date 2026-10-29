import * as copy from "../../../src/copy";

// Every function `src/copy/weekCard.ts` exports, called with representative arguments. The voice test fails when
// a function has no row, so no sentence escapes the sweep.
const sampleWeek = {
  daysSoFar: 4,
  daysComplete: 2,
  isFirstDay: false,
  daysLogged: 3,
  averageKcal: 1895.33,
  targetKcal: 2200,
};

export const samples: Record<string, () => string[]> = {
  describeDaysComplete: () => [copy.describeDaysComplete(2, 4), copy.describeDaysComplete(1, 1)],
  describeWeekAverageBasis: () => [
    copy.describeWeekAverageBasis(4),
    copy.describeWeekAverageBasis(1),
  ],
  describeOverTargetKcal: () => [copy.describeOverTargetKcal(250)],
  describeWeekAverageValue: () => [
    copy.describeWeekAverageValue(1681.25, 2200),
    copy.describeWeekAverageValue(1681.25, null),
  ],
  describeThisWeekCard: () => [
    copy.describeThisWeekCard(sampleWeek, "diary"),
    copy.describeThisWeekCard(sampleWeek, "week"),
    copy.describeThisWeekCard(sampleWeek, "averages"),
    copy.describeThisWeekCard({ ...sampleWeek, targetKcal: null }, "diary"),
    copy.describeThisWeekCard({ ...sampleWeek, daysLogged: 0, averageKcal: null }, "averages"),
    copy.describeThisWeekCard(
      { ...sampleWeek, daysSoFar: 1, isFirstDay: true, daysLogged: 0, averageKcal: null },
      "averages",
    ),
  ],
};
