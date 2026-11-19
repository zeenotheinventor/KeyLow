import * as copy from "../../../src/copy";

import type { AchievementResult } from "../../../src/achievements";

// The sentences each function of the web achievements copy can print, for the voice test's sweep.
const locked = (
  id: AchievementResult["id"],
  current: number,
  target: number,
): AchievementResult => ({
  id,
  earned: false,
  progress: { current, target },
});

const detailLines = (input: Parameters<typeof copy.webBadgeDetail>[0]): string[] => {
  const detail = copy.webBadgeDetail(input);
  return [
    detail.title,
    detail.tierLine,
    detail.description,
    ...(detail.progress === undefined ? [] : [detail.progress.words, detail.progress.remaining]),
    ...detail.facts.flatMap(({ label, value }) => [label, value]),
  ];
};

export const samples: Record<string, () => string[]> = {
  describeWebLevelPoints: () => [
    copy.describeWebLevelPoints({
      level: 6,
      name: "Sapling",
      totalPoints: 1180,
      progress: { current: 280, target: 500 },
    }),
  ],
  describeWebLevelCaption: () => [copy.describeWebLevelCaption(6)],
  describeWebDailyStreak: () => [copy.describeWebDailyStreak(1), copy.describeWebDailyStreak(12)],
  describeWebStreakFacts: () => [
    copy.describeWebStreakFacts(31, 3),
    copy.describeWebStreakFacts(1, 1),
  ],
  describeWebWeeklyStreaks: () => [
    copy.describeWebWeeklyStreaks(6, 9),
    copy.describeWebWeeklyStreaks(1, 1),
  ],
  describeWebBadgeCount: () => [copy.describeWebBadgeCount(41, 130)],
  webAchievementCatalogue: () =>
    copy
      .webAchievementCatalogue([locked("habit-forming", 12, 21), { id: "hat-trick", earned: true }])
      .flatMap(({ heading, countLabel, badges }) => [
        heading,
        countLabel,
        ...badges.flatMap(({ name, subLine }) => [name, subLine]),
      ]),
  webBadgeDetail: () => [
    ...detailLines({
      id: "fortnight",
      result: { id: "fortnight", earned: true },
      unlockedAt: "2026-11-06T12:00:00.000Z",
    }),
    ...detailLines({
      id: "month-strong",
      result: locked("month-strong", 12, 30),
      unlockedAt: undefined,
    }),
    ...detailLines({
      id: "leap-of-faith",
      result: locked("leap-of-faith", 0, 1),
      unlockedAt: undefined,
    }),
  ],
};
