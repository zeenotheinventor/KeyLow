import * as copy from "../../../src/copy";

// The sentences each function of the streak copy can print, for the voice test's sweep.
export const samples: Record<string, () => string[]> = {
  describeStreakChip: () =>
    (["none", "active", "at_risk", "freeze_used"] as const).flatMap((state) => {
      const { text, accessibleName } = copy.describeStreakChip(state, 12);
      return [text, accessibleName];
    }),
  describeStreakMonth: () => [copy.describeStreakMonth("2026-11-19")],
  describeCalendarDay: () =>
    (["complete", "frozen", "missed", "at_risk", "future"] as const).map((state) =>
      copy.describeCalendarDay("2026-11-14", state),
    ),
  describeWeekBarLabels: () => copy.describeWeekBarLabels(8),
  describeWeekBar: () =>
    (["complete", "missed", "at_risk"] as const).map((state) => copy.describeWeekBar("W3", state)),
  describeWeekBars: () =>
    copy
      .describeWeekBars([
        { weekStart: "2026-11-09", state: "complete" },
        { weekStart: "2026-11-16", state: "at_risk" },
      ])
      .flatMap((bar) => [bar.label, bar.name]),
  describeTrainingStreak: () =>
    [
      { current: 6, longest: 9, achieved: 2, required: 4 },
      { current: 7, longest: 9, achieved: 4, required: 4 },
      { current: 0, longest: 0, achieved: 0, required: 1 },
    ].flatMap((input) =>
      Object.values(copy.describeTrainingStreak(input)).filter((line) => line !== null),
    ),
  describeWeighInStreak: () =>
    (["complete", "at_risk"] as const).flatMap((thisWeek) =>
      Object.values(copy.describeWeighInStreak({ current: 9, longest: 14, thisWeek })),
    ),
};
