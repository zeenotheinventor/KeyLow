import { LOADED_HEAT_PERCENT } from "./bodyMapValues";
import { heatPercentOf } from "./heatReadout";
import { muscleState, parseMoment } from "./muscleState";
import { TRAINING_PARAMS_V2 } from "./params";
import { weekPlanDays } from "./weekPlanDays";
import {
  describeTrainingReminder,
  MISSED_MERGED_REMINDER_VARIANTS,
  NAMED_TRAIN_REMINDER_VARIANTS,
  TRAIN_REMINDER_NAMES_ROUTINE_DAY,
  TRAINING_REMINDER_VARIANTS,
} from "../copy/trainingReminders";
import { addCalendarDays, dayNumber, daysSinceMonday } from "../dates/calendarDay";
import { parseClockTime } from "../dates/clockTime";
import { instantAtLocalTime } from "../dates/instantAtLocalTime";
import { isValidTimeZone } from "../dates/isValidTimeZone";
import { toLocalDate } from "../dates/toLocalDate";

import type { ExerciseTrend } from "./exerciseTrend";
import type { MuscleId } from "./muscles";
import type { HeatSet } from "./muscleState";
import type { TrainingParams } from "./params";
import type { WeekDayStatus, WeekRoutine, WeekSession } from "./weekPlanDays";
import type { TrainingReminderType } from "../copy/trainingReminders";
import type { ExerciseMuscleEntry } from "../schemas/training";

/*
 * The training reminders (KEY-509, Zee's rulings of 2026-10-22): which notifications to schedule for the
 * next seven days, and the words on each. Pure under the ADR 0002 rule: `now` and the zone are
 * arguments, nothing reads the clock, and no device API is touched. The app schedules what comes back
 * and plans again whenever it opens, so a week it could not know in advance is covered by the next open.
 */

export type TrainingReminderSettings = Readonly<{
  trainEnabled: boolean;
  progressEnabled: boolean;
  easeEnabled: boolean;
  /** "HH:MM", 24 hours, in the person's zone. */
  trainTime: string;
  /** "A fresh start", the morning after a planned day went by with no session. Left out, off. */
  missedEnabled?: boolean;
  /** "Checking in", after `CHECKIN_STREAK_DAYS` planned days in a row went by. Left out, off. */
  checkinEnabled?: boolean;
}>;

export const DEFAULT_TRAINING_REMINDER_SETTINGS: TrainingReminderSettings = {
  trainEnabled: false,
  progressEnabled: false,
  easeEnabled: false,
  trainTime: "17:30",
  missedEnabled: false,
  checkinEnabled: false,
};

/**
 * A routine day as the reminders read it. A `PlanRoutine` day fits. A null weekday means any day, which
 * has no date to remind on, so it is never reminded. The `name` is the routine day's own, and only
 * "Time to train" says it, behind `TRAIN_REMINDER_NAMES_ROUTINE_DAY`. It is read to build the body and is
 * never stored with the plan (ADR 0005, health data).
 */
export type TrainingReminderRoutineDay = Readonly<{
  /**
   * The day's id and place in the routine, as `weekPlanDays` reads them: a session names the day it did by
   * `routine_day_id`, which is how a late make-up (KEY-531) is found. Left out, the day cannot be made up.
   */
  id?: string;
  position?: number;
  weekday: number | null;
  name?: string;
  exercises: readonly Readonly<{
    muscles: readonly Pick<ExerciseMuscleEntry, "muscle_id" | "role">[];
  }>[];
}>;

/**
 * The fields of a session the reminders read. A `WeekSession` fits. The id, the start and the routine day
 * are read by the missed day rules only, to find a day made up late; left out, no session makes one up.
 */
export type TrainingReminderSession = Pick<WeekSession, "local_date" | "ended_at" | "deleted_at"> &
  Partial<Pick<WeekSession, "id" | "started_at" | "routine_day_id">>;

export type TrainingReminderInput = Readonly<{
  /** The moment to plan from, an ISO timestamp with a zone. */
  now: string;
  /** The person's IANA zone. It places every fire time and every day. */
  timeZone: string;
  settings: TrainingReminderSettings;
  /**
   * The active routine, or null when there is none. `activeFrom` is the local calendar day it was made
   * active, `YYYY-MM-DD`, as in `PlanRoutine`: no day before it is ever missed. Left out, the whole of the
   * lookback is planned. The missed day rules need `activeFrom`, and the `id` of each day, passed:
   * without them days before the routine began are judged missed.
   */
  plan: Readonly<{ days: readonly TrainingReminderRoutineDay[]; activeFrom?: string }> | null;
  /**
   * Sessions near today. Only the finished ones, and their `local_date`, are read for "Time to train". The
   * missed day rules look back `MISSED_LOOKBACK_DAYS`, so the caller passes three weeks and more, with the
   * `id`, `started_at` and `routine_day_id` of each: without them a late make-up goes unseen and the day
   * reads missed.
   */
  sessions: readonly TrainingReminderSession[];
  /**
   * The logged sets of the heat window (14 days before `now`), from which the heat of a muscle is worked
   * out for the morning of today and of tomorrow. A set after `now` has not happened yet and is left out.
   */
  heatSets: readonly HeatSet[];
  /** The training params the heat is worked out with. Left out, v1. */
  params?: TrainingParams;
  /** Whether an exercise went up in the week of `now`. See `hasExerciseGainThisWeek`. */
  weeklyGain: boolean;
  /** The id of the variant last delivered for each type, or null (or left out) when none has been. */
  lastVariantIds: Readonly<Partial<Record<TrainingReminderType, string | null>>>;
  /**
   * The fire time of the last check-in that was delivered, an ISO timestamp with a zone, or null (or left
   * out) when none has been. A streak that began on or before that day has had its check-in.
   */
  lastCheckInAt?: string | null;
  /**
   * Whether "Time to train" names the routine day. Left out, `TRAIN_REMINDER_NAMES_ROUTINE_DAY`. The app
   * leaves it out, so the one constant is the switch. A test sets it to see both sides of the switch.
   */
  namesRoutineDay?: boolean;
}>;

export type PlannedTrainingReminder = Readonly<{
  type: TrainingReminderType;
  /** An ISO timestamp in UTC. */
  fireAt: string;
  /** The id of the variant of the type's copy that the body is from. */
  variantId: string;
  title: string;
  body: string;
}>;

const REMINDER_WINDOW_DAYS = 7;
/**
 * "Take it easy" is judged for today and tomorrow only. This is deliberate: a day is loaded at 60 % heat or
 * more, and beyond tomorrow the heat of what is logged has decayed too far to stay that high, while the
 * sessions planned in between are not known to have happened.
 */
const EASE_JUDGED_DAYS = 2;
/** When "Take it easy" fires, and the moment of the day the heat is judged at. The Reminders screen's words say it. */
export const EASE_REMINDER_TIME = { hour: 8, minute: 0 };
/** When "See your progress" fires, on a Sunday. The Reminders screen's words say it. */
export const PROGRESS_REMINDER_TIME = { hour: 19, minute: 0 };
/** When "A fresh start" and "Checking in" fire on a day with no "Time to train". The Reminders screen's words say it. */
export const MISSED_REMINDER_TIME = { hour: 9, minute: 0 };
/** How many planned days in a row must go by before the next missed reminder is a check-in. */
export const CHECKIN_STREAK_DAYS = 3;
/** How many days back a streak is followed. A streak older than this is read as beginning at its edge. */
export const MISSED_LOOKBACK_DAYS = 21;
const SUNDAY = 6;
const DAYS_PER_WEEK = 7;

type Candidate = {
  type: TrainingReminderType;
  date: string;
  fireAt: Date;
  /** The routine day's name, set for "Time to train" only. */
  dayName?: string | undefined;
  /** Set for "A fresh start" only: it stands in for "Time to train" and says both. */
  merged?: boolean | undefined;
};

/**
 * Whether an exercise of the week of the latest trained week went up: a heavier load (no load counts as
 * 0 kg) or more reps at the same load, against the last week trained. The week of `now` is the last week
 * of each trend, so a caller passes trends made with `now` and reads them as they are, for instance the
 * exercises of `routineTrendsByDay`. A first trained week has nothing to beat, and a week not trained has
 * no value.
 */
export const hasExerciseGainThisWeek = (trends: readonly ExerciseTrend[]): boolean =>
  trends.some(({ weeks }) => {
    const change = weeks.at(-1)?.change;
    if (change === undefined || change === null) {
      return false;
    }
    if (change.kind === "load") {
      return (change.latestLoadKg ?? 0) > (change.previousLoadKg ?? 0);
    }
    return change.kind === "reps" && change.repsChange > 0;
  });

const primaryMusclesOf = (day: TrainingReminderRoutineDay): MuscleId[] =>
  day.exercises.flatMap(({ muscles }) =>
    muscles.filter(({ role }) => role === "primary").map(({ muscle_id }) => muscle_id),
  );

/**
 * The name to say in "Time to train": the routine day's, trimmed. Undefined when the naming is off or the
 * name is missing or blank, which sends the reminder to the generic variants.
 */
const spokenDayName = (
  day: TrainingReminderRoutineDay,
  namesRoutineDay: boolean,
): string | undefined => {
  const name = day.name?.trim();
  return namesRoutineDay && name !== undefined && name !== "" ? name : undefined;
};

/** The routine as `weekPlanDays` reads it. The exercises are left out: only the days, weekdays and ids decide a status. */
const weekRoutineOf = (plan: NonNullable<TrainingReminderInput["plan"]>): WeekRoutine => ({
  name: "",
  days: plan.days.map((day, index) => ({
    id: day.id ?? `day-${index}`,
    name: day.name ?? "",
    position: day.position ?? index,
    weekday: day.weekday,
    exercises: [],
  })),
  ...(plan.activeFrom === undefined ? {} : { activeFrom: plan.activeFrom }),
});

/** A session as `weekPlanDays` reads it. A start left out is the end, and an open session's is never read. */
const weekSessionOf = (session: TrainingReminderSession, index: number): WeekSession => ({
  id: session.id ?? `session-${index}`,
  local_date: session.local_date,
  started_at: session.started_at ?? session.ended_at ?? session.local_date,
  ended_at: session.ended_at,
  routine_day_id: session.routine_day_id ?? null,
  deleted_at: session.deleted_at,
  sets: [],
});

/** The id of the variant for a fire date: the date's own, moved on by one when it is the one used just before. */
const variantFor = (
  { type, dayName, merged }: Pick<Candidate, "type" | "dayName" | "merged">,
  date: string,
  previousId: string | null,
): string => {
  const variants = merged
    ? MISSED_MERGED_REMINDER_VARIANTS
    : type === "train" && dayName !== undefined
      ? NAMED_TRAIN_REMINDER_VARIANTS
      : TRAINING_REMINDER_VARIANTS[type];
  const byDate = dayNumber(date) % variants.length;
  const byDateVariant = variants[byDate];
  const chosen =
    byDateVariant?.id === previousId ? variants[(byDate + 1) % variants.length] : byDateVariant;
  if (chosen === undefined) {
    throw new Error(`The ${type} reminder has no variants`);
  }
  return chosen.id;
};

/**
 * The notifications to schedule for the next seven days (today and the six after it), by fire time.
 *
 * - "Time to train" fires on each routine day at `trainTime` in `timeZone`. A day is skipped when a
 *   session was finished on it, and so is a time that has passed.
 * - "See your progress" fires on this week's Sunday at 19:00, when `weeklyGain` is true. A later Sunday is
 *   not known yet, so the app plans again on each open and the next week is covered when it comes.
 * - "Take it easy" fires at 08:00 on a routine day when any primary muscle of the day has heat at or above
 *   `LOADED_HEAT_PERCENT` at that day's own 08:00, worked out from the sets of `heatSets` performed by
 *   `now` with the model's own decay. The day is always judged at its own 08:00, even when that has passed,
 *   so planning again later in the day never changes the answer. It replaces "Time to train" that day,
 *   even when 08:00 has passed and it cannot fire any more. Only today and tomorrow are judged, on purpose:
 *   beyond tomorrow the heat cannot stay that high, so a later day only ever gets "Time to train".
 * - "A fresh start" fires the morning after a planned day whose date passed with no finished session
 *   crediting it, as `weekPlanDays` reads it (so a day made up late, and a day before the routine's
 *   `activeFrom`, are not missed). It fires at `trainTime` in place of "Time to train" when that day gets
 *   one, with the merged words, and at 09:00 otherwise. When the day gets "Take it easy", or a session
 *   was already finished on it, nothing is sent: at most one of train, ease, missed and check-in a day.
 * - "Checking in" replaces "A fresh start" when the streak of missed planned days, rest days between
 *   them not breaking it and a finished or open session on a planned day ending it, has reached
 *   `CHECKIN_STREAK_DAYS`. A finished session on a rest day ends the streak too. It is sent once for a
 *   streak: not when `lastCheckInAt` falls on or after the streak's first missed day (or after the edge of
 *   the lookback, for a streak that runs back to it), and not again for a later miss of the same streak,
 *   which gets nothing. This relies on the caller passing `lastCheckInAt` from the stored plan: a check-in
 *   whose time has passed is treated as delivered only through it, so one never delivered is sent on the
 *   next miss morning. A streak that outlasts the lookback and has no check-in inside it is asked about
 *   again, about every `MISSED_LOOKBACK_DAYS`.
 *   With its own switch off, the streak gets "A fresh start" instead.
 * - The days to come are judged as if nothing more is done before them, each at its own fire day, so
 *   tomorrow's missed reminder is already planned today and the next plan after a finished session drops it.
 * - Each variant is picked by the fire date, and never the one delivered last or the one before it in the
 *   plan. A variant is named by its id, which the app stores once it is delivered. "Time to train" on a
 *   day with a name that is not blank picks from the named variants and says the name, while
 *   `TRAIN_REMINDER_NAMES_ROUTINE_DAY` is on. Otherwise it picks from the generic ones.
 *
 * Throws a `RangeError` naming the rule when `now` or `lastCheckInAt` is not an ISO timestamp with a zone,
 * `timeZone` is not an IANA name or `trainTime` is not HH:MM. With "A fresh start" or "Checking in" on, it
 * throws what `weekPlanDays` throws for a routine it cannot read: an `activeFrom` that is not a calendar
 * day, two days on one weekday or a weekday out of range.
 */
export const planTrainingReminders = ({
  now,
  timeZone,
  settings,
  plan,
  sessions,
  heatSets,
  params = TRAINING_PARAMS_V2,
  weeklyGain,
  lastVariantIds,
  lastCheckInAt = null,
  namesRoutineDay = TRAIN_REMINDER_NAMES_ROUTINE_DAY,
}: TrainingReminderInput): PlannedTrainingReminder[] => {
  const nowMilliseconds = parseMoment(now);
  if (!isValidTimeZone(timeZone)) {
    throw new RangeError("A reminder's time zone must be an IANA zone name");
  }
  const trainTime = parseClockTime(settings.trainTime);
  if (trainTime === undefined) {
    throw new RangeError("A reminder's train time must be written HH:MM");
  }

  const lastCheckInDate =
    lastCheckInAt === null ? null : toLocalDate(new Date(parseMoment(lastCheckInAt)), timeZone);

  const today = toLocalDate(new Date(nowMilliseconds), timeZone);
  const finishedDates = new Set(
    sessions.flatMap((session) =>
      session.deleted_at === null && session.ended_at !== null ? [session.local_date] : [],
    ),
  );
  const fireTime = (date: string, { hour, minute }: { hour: number; minute: number }): Date =>
    instantAtLocalTime(date, hour, minute, timeZone);

  const isLoaded = (day: TrainingReminderRoutineDay, date: string): boolean => {
    const judgedAt = fireTime(date, EASE_REMINDER_TIME).toISOString();
    const states = muscleState(performedSets, judgedAt, params);
    return primaryMusclesOf(day).some(
      (muscle) => heatPercentOf(states[muscle].heat) >= LOADED_HEAT_PERCENT,
    );
  };

  // A set after now has not happened yet, so it counts for no morning.
  const performedSets = heatSets.filter(
    (set) =>
      parseMoment(set.performed_at, "A set's performed_at must be an ISO timestamp with a zone") <=
      nowMilliseconds,
  );

  const missedOn = settings.missedEnabled ?? false;
  const checkinOn = settings.checkinEnabled ?? false;
  const weekRoutine = plan !== null && (missedOn || checkinOn) ? weekRoutineOf(plan) : null;
  const weekSessions = sessions.map(weekSessionOf);

  /**
   * The status of each day of the lookback before `date`, as the week it is in reads it with `date` as
   * today. Weeks are read one at a time, as `weekPlanDays` does, so a make-up never crosses a Sunday.
   */
  const statusesBefore = (routine: WeekRoutine, date: string): Map<string, WeekDayStatus> => {
    const firstDate = addCalendarDays(date, -MISSED_LOOKBACK_DAYS);
    const lastWeekStart = addCalendarDays(date, -daysSinceMonday(date));
    const statuses = new Map<string, WeekDayStatus>();
    for (
      let weekStart = addCalendarDays(firstDate, -daysSinceMonday(firstDate));
      weekStart <= lastWeekStart;
      weekStart = addCalendarDays(weekStart, DAYS_PER_WEEK)
    ) {
      const week = weekPlanDays({
        routine,
        sessions: weekSessions,
        // Any moment of the day reads the same: the days before it are over, whatever the hour.
        now: fireTime(date, MISSED_REMINDER_TIME).toISOString(),
        tz: timeZone,
        weekStart,
      });
      for (const day of week.days) {
        statuses.set(day.date, day.status);
      }
    }
    return statuses;
  };

  /**
   * The run of missed planned days that ends the day before `date`: null when that day was not missed.
   * Rest days go on through it. A day that was done or is being done ends it, and so does a finished session
   * on a rest day (an extra): someone who is training is not asked how they are. `since` is the day a
   * check-in must be on or after to belong to the streak: its first missed day, or the edge of the lookback
   * when the streak runs back to it, since where such a streak began is not known.
   */
  const missedStreakBefore = (
    routine: WeekRoutine,
    date: string,
  ): { length: number; since: string } | null => {
    const statuses = statusesBefore(routine, date);
    if (statuses.get(addCalendarDays(date, -1)) !== "missed") {
      return null;
    }
    let streak = { length: 0, since: date };
    for (let daysBack = 1; daysBack <= MISSED_LOOKBACK_DAYS; daysBack += 1) {
      const dayBefore = addCalendarDays(date, -daysBack);
      const status = statuses.get(dayBefore);
      if (status === "logged" || status === "in_progress" || status === "extra") {
        return streak;
      }
      streak = {
        length: status === "missed" ? streak.length + 1 : streak.length,
        since: status === "missed" ? dayBefore : streak.since,
      };
    }
    // Nothing ended the streak inside the lookback. It runs back to the edge unless the routine began later.
    const edge = addCalendarDays(date, -MISSED_LOOKBACK_DAYS);
    return plan?.activeFrom !== undefined && plan.activeFrom > edge
      ? streak
      : { ...streak, since: edge };
  };

  // The `since` of each streak that has a check-in scheduled in this plan, so a later miss of it sends none.
  const checkedInStreaks = new Set<string>();
  /**
   * Which of "A fresh start" and "Checking in" the morning of `date` gets, if either, and the streak it
   * belongs to. Dates are judged in order. A check-in whose time has passed is not marked as sent: only the
   * caller's `lastCheckInAt`, from the stored plan, says it was delivered.
   */
  const missedReminderFor = (
    date: string,
  ): { type: "missed" | "checkin"; streakSince: string } | null => {
    const streak = weekRoutine === null ? null : missedStreakBefore(weekRoutine, date);
    if (streak === null) {
      return null;
    }
    const reminder = (type: "missed" | "checkin") => ({ type, streakSince: streak.since });
    if (streak.length < CHECKIN_STREAK_DAYS) {
      return missedOn ? reminder("missed") : null;
    }
    const hasCheckedIn =
      (lastCheckInDate !== null && lastCheckInDate >= streak.since) ||
      checkedInStreaks.has(streak.since);
    if (hasCheckedIn) {
      return null;
    }
    if (checkinOn) {
      return reminder("checkin");
    }
    return missedOn ? reminder("missed") : null;
  };

  const candidates: Candidate[] = [];
  const pushIfAhead = (
    type: TrainingReminderType,
    date: string,
    fireAt: Date,
    options: Pick<Candidate, "dayName" | "merged"> = {},
  ): boolean => {
    const isAhead = fireAt.getTime() > nowMilliseconds;
    if (isAhead) {
      candidates.push({ type, date, fireAt, ...options });
    }
    return isAhead;
  };

  for (let offset = 0; offset < REMINDER_WINDOW_DAYS; offset += 1) {
    const date = addCalendarDays(today, offset);
    const weekday = daysSinceMonday(date);
    const day = plan?.days.find((routineDay) => routineDay.weekday === weekday);

    if (!finishedDates.has(date)) {
      const eased =
        day !== undefined &&
        settings.easeEnabled &&
        offset < EASE_JUDGED_DAYS &&
        isLoaded(day, date);
      const trainDay = settings.trainEnabled ? day : undefined;
      const missedReminder = eased ? null : missedReminderFor(date);
      if (eased) {
        pushIfAhead("ease", date, fireTime(date, EASE_REMINDER_TIME));
      } else if (missedReminder !== null) {
        const { type, streakSince } = missedReminder;
        const fireAt = fireTime(date, trainDay !== undefined ? trainTime : MISSED_REMINDER_TIME);
        const isScheduled = pushIfAhead(type, date, fireAt, {
          merged: trainDay !== undefined && type === "missed",
        });
        if (isScheduled && type === "checkin") {
          checkedInStreaks.add(streakSince);
        }
      } else if (trainDay !== undefined) {
        pushIfAhead("train", date, fireTime(date, trainTime), {
          dayName: spokenDayName(trainDay, namesRoutineDay),
        });
      }
    }
    if (settings.progressEnabled && weeklyGain && weekday === SUNDAY) {
      pushIfAhead("progress", date, fireTime(date, PROGRESS_REMINDER_TIME));
    }
  }

  const lastUsed = { ...lastVariantIds };
  return candidates
    .sort((first, second) => first.fireAt.getTime() - second.fireAt.getTime())
    .map((candidate) => {
      const { type, date, fireAt, dayName } = candidate;
      const variantId = variantFor(candidate, date, lastUsed[type] ?? null);
      lastUsed[type] = variantId;
      const { title, body } = describeTrainingReminder(type, variantId, dayName);
      return { type, fireAt: fireAt.toISOString(), variantId, title, body };
    });
};
