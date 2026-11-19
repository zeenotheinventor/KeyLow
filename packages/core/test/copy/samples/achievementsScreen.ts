import * as copy from "../../../src/copy";

// The sentences each function of the Achievements screen copy can print, for the voice test's sweep.
export const samples: Record<string, () => string[]> = {
  describeLevelLabel: () => [copy.describeLevelLabel(6)],
  describeLevelPoints: () => [copy.describeLevelPoints(1180)],
  describePointsToNextLevel: () => [
    copy.describePointsToNextLevel(220, 7),
    copy.describePointsToNextLevel(1, 7),
  ],
  describeNextLevelProgressLabel: () => [copy.describeNextLevelProgressLabel(7)],
  describeFreezeCaption: () => [copy.describeFreezeCaption(1), copy.describeFreezeCaption(3)],
  describeBadgeCount: () => [copy.describeBadgeCount(130)],
  describeCategoryCount: () => [copy.describeCategoryCount(6, 14)],
  describeToGo: () => [copy.describeToGo(18)],
  describeEarnedOn: () => [copy.describeEarnedOn("2026-11-06")],
  describePointsWorth: () => [copy.describePointsWorth(50)],
  describePointsEarned: () => [copy.describePointsEarned(25)],
  describeFreezeBonus: () => [copy.describeFreezeBonus(1), copy.describeFreezeBonus(3)],
  describeBackfillCard: () => [copy.describeBackfillCard(23, 4), copy.describeBackfillCard(1, 1)],
  describeProgress: () => [
    copy.describeProgress("daily-streak", 12, 30),
    copy.describeProgress("barcodes-scanned", 0, 1),
    copy.describeProgress("midnight-log", 0, 1),
  ],
};
