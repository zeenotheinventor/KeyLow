import { recentWeeksOf } from "@keylow/core";

import type { WeekRecord } from "@keylow/core";

const TODAY = "2026-11-19";

const week = (weekStart: string, achieved: number, required: number): WeekRecord => ({
  weekStart,
  achieved,
  required,
});

// Board 4's training streak: five weeks kept, W3 to W7, two before them not, and 2 of 4 this week.
const keptWeeks = ["2026-10-12", "2026-10-19", "2026-10-26", "2026-11-02", "2026-11-09"].map(
  (weekStart) => week(weekStart, 4, 4),
);

export const boardTraining = recentWeeksOf([...keptWeeks, week("2026-11-16", 2, 4)], TODAY, 8);

export const trainingWeekDone = recentWeeksOf([...keptWeeks, week("2026-11-16", 4, 4)], TODAY, 8);
