import { ACHIEVEMENTS } from "./catalogue";
import { evaluateAchievements } from "./evaluate";
import { freezeGrantsOf } from "./freezeGrants";
import { buildNotification } from "./notification";
import { levelFor, totalPoints } from "./points";
import { streakDaysOf, trainingWeeksOf, weighInWeeksOf } from "./streakInputs";
import { dailyStreak, freezeEventsDue, weeklyStreak } from "./streaks";
import { addCalendarDays, toLocalDate } from "../dates";

import type { AchievementId, AchievementTier } from "./catalogue";
import type { AchievementResult } from "./evaluate";
import type { LevelUp, UnlockNotificationPayload } from "./notification";
import type { LevelStanding } from "./points";
import type { AchievementStats, DeviceInputs, StoredAchievementStats } from "./stats";
import type { StreakInput } from "./streakInput";
import type {
  CalendarDayState,
  CalendarRange,
  DailyStreak,
  FreezeRow,
  WeeklyStreak,
} from "./streaks";

const DEFAULT_CALENDAR_DAYS = 42;
const TIER_ORDER: readonly AchievementTier[] = ["platinum", "gold", "silver", "bronze"];

export type RunInput = Readonly<{
  stats: StoredAchievementStats;
  /** The local date of every weigh-in. The stored stats only count them, and the weigh-in streak needs the weeks. */
  weighInDates: readonly string[];
  /** The ids of the achievements already held. An id the catalogue does not know is ignored. */
  held: readonly string[];
  /** Every row of the freeze ledger already written. */
  ledger: readonly FreezeRow[];
  device: DeviceInputs;
  now: Date;
  /** The first run of an existing user, which earns quietly and sends no notification. */
  isBackfill: boolean;
  /** The days the calendar describes. Defaults to the 42 days up to today. */
  calendarRange?: CalendarRange;
}>;

export type RunResult = Readonly<{
  /** Earned in this run and not held before, highest tier first, the catalogue's order within a tier. */
  newUnlocks: AchievementId[];
  /** The ledger rows to append: freezes earned and freezes used. Rows already written are left out. */
  freezeEventsToWrite: FreezeRow[];
  streaks: Readonly<{ daily: DailyStreak; training: WeeklyStreak; weighIn: WeeklyStreak }>;
  calendar: CalendarDayState[];
  points: number;
  level: LevelStanding;
  /** Set when this run carried the person to a new level. */
  levelUp: LevelUp | null;
  /** Every achievement, earned or locked with its progress. Held ones stay earned. */
  perAchievementProgress: readonly AchievementResult[];
  /** One payload at most, and none on a backfill run. */
  notification: UnlockNotificationPayload | null;
  /** On a backfill run, how many achievements were unlocked quietly for the one summary card. */
  backfillSummary: number | null;
}>;

const KNOWN_IDS: ReadonlySet<string> = new Set(ACHIEVEMENTS.map(({ id }) => id));

const pointsOf = (ids: ReadonlySet<string>): number =>
  totalPoints(ACHIEVEMENTS.filter(({ id }) => ids.has(id)).map(({ tier }) => tier));

/**
 * One pass over the loop of the feature: the earned badges give points, points give levels, levels and
 * Gold or Platinum give freezes, freezes keep the streak, and the streak gives badges. `earned` is
 * what is known so far, and the pass returns it widened by what the new freezes and streaks earn.
 */
const settle = (input: RunInput, earned: ReadonlySet<string>) => {
  const { stats, now } = input;
  const zone = stats.timeZone;
  const today = toLocalDate(now, zone);
  const fullStats: AchievementStats = { ...stats, ...input.device };
  const days = streakDaysOf(stats);
  const trainingWeeks = trainingWeeksOf(stats);
  const weighInWeeks = weighInWeeksOf(input.weighInDates);
  const ledger = [...input.ledger];

  const grants = freezeGrantsOf({
    earnedIds: earned,
    level: levelFor(pointsOf(earned)).level,
    stats: fullStats,
    today,
    now,
    zone,
  });
  const freezeEventsToWrite = freezeEventsDue({
    days,
    ledger,
    grants,
    trainingWeeks,
    weighInWeeks,
    today,
    now,
    zone,
  });
  const calendarRange = input.calendarRange ?? {
    from: addCalendarDays(today, 1 - DEFAULT_CALENDAR_DAYS),
    to: today,
  };
  const daily = dailyStreak(
    days,
    [...ledger, ...freezeEventsToWrite],
    today,
    now,
    zone,
    calendarRange,
  );
  const training = weeklyStreak(trainingWeeks, today);
  const weighIn = weeklyStreak(weighInWeeks, today);
  const streaks: StreakInput = {
    daily: { current: daily.current, longest: daily.longest },
    training: { current: training.current, longest: training.longest },
    weighIn: { current: weighIn.current, longest: weighIn.longest },
    freezesHeld: daily.freezesHeld,
    freezesUsed: daily.freezesUsed,
    backOnTrack: daily.backOnTrack,
    weekendRun: daily.weekendRun.longest,
  };
  const results = evaluateAchievements(fullStats, streaks, now);

  return {
    freezeEventsToWrite,
    daily,
    training,
    weighIn,
    results,
    earned: new Set([...earned, ...results.filter((r) => r.earned).map(({ id }) => id)]),
  };
};

/**
 * Everything one run of the achievements engine decides, from the stats snapshot to the notification.
 * Earning a badge can raise the points, the level and the freezes, and those can earn another badge, so
 * the pass is repeated until nothing new is earned. Earned badges are only ever added and the catalogue
 * is finite, so it ends within one pass for each achievement. Pure: the clock is an argument.
 */
export const runAchievements = (input: RunInput): RunResult => {
  const held = new Set(input.held.filter((id) => KNOWN_IDS.has(id)));
  let earned: ReadonlySet<string> = held;

  for (let pass = 0; pass <= ACHIEVEMENTS.length; pass += 1) {
    const state = settle(input, earned);
    if (state.earned.size === earned.size) {
      return resultOf(input, held, state);
    }
    earned = state.earned;
  }
  throw new Error("The achievements did not settle.");
};

const resultOf = (
  input: RunInput,
  held: ReadonlySet<string>,
  state: ReturnType<typeof settle>,
): RunResult => {
  const newUnlocks = ACHIEVEMENTS.filter(({ id }) => state.earned.has(id) && !held.has(id))
    .sort((first, second) => TIER_ORDER.indexOf(first.tier) - TIER_ORDER.indexOf(second.tier))
    .map(({ id }) => id);
  const points = pointsOf(state.earned);
  const level = levelFor(points);
  const levelBefore = levelFor(pointsOf(held));
  const levelUp: LevelUp | null =
    level.level > levelBefore.level
      ? { from: levelBefore.level, to: level.level, name: level.name }
      : null;
  const freezes = state.freezeEventsToWrite
    .filter((row) => row.kind === "earned")
    .reduce((sum, row) => sum + row.count, 0);

  return {
    newUnlocks,
    freezeEventsToWrite: state.freezeEventsToWrite,
    streaks: { daily: state.daily, training: state.training, weighIn: state.weighIn },
    calendar: state.daily.calendar,
    points,
    level,
    levelUp,
    perAchievementProgress: state.results.map((result) =>
      state.earned.has(result.id) ? { id: result.id, earned: true } : result,
    ),
    notification: input.isBackfill ? null : buildNotification({ newUnlocks, freezes, levelUp }),
    backfillSummary: input.isBackfill ? newUnlocks.length : null,
  };
};
