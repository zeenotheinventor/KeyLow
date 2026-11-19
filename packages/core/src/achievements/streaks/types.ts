/** One diary day as the streak reads it. `completedAt` is the ISO timestamp `day_logs.completed_at` holds. */
export type StreakDay = {
  /** The `YYYY-MM-DD` the diary already uses, so travelling never breaks a streak. */
  localDate: string;
  isComplete: boolean;
  completedAt: string | null;
  /** How many diary entries the day has. A day needs at least one to count. */
  entryCount: number;
};

/** What a calendar cell shows for one day of the daily streak. */
export type DayState = "complete" | "frozen" | "missed" | "at_risk" | "future";

export type CalendarDayState = { localDate: string; state: DayState };

/** An inclusive range of `YYYY-MM-DD` days to describe on the calendar. */
export type CalendarRange = { from: string; to: string };

export type FreezeKind = "earned" | "used";

/**
 * One row of the append-only freeze ledger. `date` is the local day the row took effect. `count` is
 * how many freezes an earned row adds (a Platinum achievement adds three), and it is 1 for a used row.
 */
export type FreezeRow = {
  kind: FreezeKind;
  reason: string;
  reference: string;
  date: string;
  count: number;
};

/** A freeze earned somewhere the streak maths cannot see: a level, a Gold or Platinum badge, a Perfect Week, a first use. */
export type FreezeGrant = { reason: string; reference: string; date: string; count: number };

/** One Monday to Sunday week of a weekly streak. `required` is how many it takes for the week to count. */
export type WeekRecord = { weekStart: string; achieved: number; required: number };

export type WeekState = "complete" | "at_risk" | "missed";

export type DailyStreak = {
  current: number;
  longest: number;
  /** `at_risk` until local midnight, when the day is not yet complete. */
  today: "complete" | "at_risk";
  /** Yesterday is not complete yet but can still be completed, until 12:00 today. */
  yesterdayCompletable: boolean;
  calendar: CalendarDayState[];
  freezesHeld: number;
  freezesUsed: number;
  /** A completed day after 3 or more days off, at any time in the history. */
  backOnTrack: boolean;
  /** Consecutive weekends with both days counted. */
  weekendRun: { current: number; longest: number };
};

export type WeeklyStreak = {
  current: number;
  longest: number;
  /** `at_risk` until Sunday ends, when this week has not reached its count yet. */
  thisWeek: "complete" | "at_risk";
};
