import { ACHIEVEMENTS } from "./catalogue";
import { judgeDay } from "./rules/targets";
import { isBeforeDayCompleteCutoff } from "./streaks";
import { dayNumber } from "../dates/calendarDay";

import type { AchievementDefinition } from "./catalogue";
import type { AchievementStats } from "./stats";
import type { FreezeGrant } from "./streaks";

export const LEVEL_REACHED_REASON = "level_reached";
export const GOLD_REASON = "achievement_gold";
export const PLATINUM_REASON = "achievement_platinum";
export const FIRST_USE_REASON = "first_use";
export const PERFECT_WEEK_REASON = "perfect_week";

const PLATINUM_FREEZES = 3;
const DAYS_PER_PERFECT_WEEK = 7;

export type FreezeGrantsInput = Readonly<{
  earnedIds: ReadonlySet<string>;
  /** The level the earned points have reached. */
  level: number;
  stats: AchievementStats;
  today: string;
  now: Date;
  zone: string;
}>;

/** The freezes one badge brings when it is earned: one for Gold, three for Platinum, one for a Getting started badge. */
export const freezesForBadge = ({
  tier,
  category,
}: Pick<AchievementDefinition, "tier" | "category">): number =>
  (tier === "gold" ? 1 : 0) +
  (tier === "platinum" ? PLATINUM_FREEZES : 0) +
  (category === "getting-started" ? 1 : 0);

/** The days with calories and protein both on target, one calendar day each, oldest first. */
const onTargetDays = (stats: AchievementStats): string[] =>
  [
    ...new Set(
      stats.days
        .filter((day) => {
          const judgement = judgeDay(stats, day);
          return judgement.calories && judgement.protein;
        })
        .map((day) => day.localDate),
    ),
  ].sort();

/**
 * A freeze for every full seven days in a row on target, dated and keyed by the seventh day. A run of
 * fourteen gives two, and a day off starts the count again. Like the daily streak's freeze, it is only granted once the seventh day
 * is settled (past 12:00 the next local day), so a week that stops being perfect before then mints nothing.
 */
const perfectWeekGrants = (stats: AchievementStats, now: Date, zone: string): FreezeGrant[] => {
  const grants: FreezeGrant[] = [];
  let runStart: string | undefined;
  let previous: string | undefined;
  for (const localDate of onTargetDays(stats)) {
    const continues = previous !== undefined && dayNumber(localDate) === dayNumber(previous) + 1;
    runStart = continues && runStart !== undefined ? runStart : localDate;
    previous = localDate;
    const runLength = dayNumber(localDate) - dayNumber(runStart) + 1;
    if (
      runLength % DAYS_PER_PERFECT_WEEK === 0 &&
      !isBeforeDayCompleteCutoff(now.getTime(), localDate, zone)
    ) {
      grants.push({ reason: PERFECT_WEEK_REASON, reference: localDate, date: localDate, count: 1 });
    }
  }
  return grants;
};

/**
 * The freezes earned somewhere the streak maths cannot see: every level reached, one per Gold badge,
 * three per Platinum, the first use of each Getting started feature (its badge) and every Perfect Week.
 * Each is keyed by what earned it, so a grant that is already in the ledger is never written twice. A
 * grant that is found today is dated today, so it can only cover a day missed from today on.
 */
export const freezeGrantsOf = ({
  earnedIds,
  level,
  stats,
  today,
  now,
  zone,
}: FreezeGrantsInput): FreezeGrant[] => {
  const levelGrants = Array.from({ length: level }, (_, index) => ({
    reason: LEVEL_REACHED_REASON,
    reference: `level-${index + 1}`,
    date: today,
    count: 1,
  }));
  const achievementGrants = ACHIEVEMENTS.filter(({ id }) => earnedIds.has(id)).flatMap(
    ({ id, tier, category }): FreezeGrant[] => [
      ...(tier === "gold" ? [{ reason: GOLD_REASON, reference: id, date: today, count: 1 }] : []),
      ...(tier === "platinum"
        ? [{ reason: PLATINUM_REASON, reference: id, date: today, count: PLATINUM_FREEZES }]
        : []),
      ...(category === "getting-started"
        ? [{ reason: FIRST_USE_REASON, reference: id, date: today, count: 1 }]
        : []),
    ],
  );
  return [...levelGrants, ...achievementGrants, ...perfectWeekGrants(stats, now, zone)];
};
