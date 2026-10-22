import { LOADED_HEAT_PERCENT } from "./bodyMapValues";
import { heatPercentOf } from "./heatReadout";
import { muscleState, parseMoment } from "./muscleState";
import { TRAINING_PARAMS_V1 } from "./params";
import { describeTrainingReminder, TRAINING_REMINDER_VARIANTS } from "../copy/trainingReminders";
import { addCalendarDays, dayNumber, daysSinceMonday } from "../dates/calendarDay";
import { parseClockTime } from "../dates/clockTime";
import { instantAtLocalTime } from "../dates/instantAtLocalTime";
import { isValidTimeZone } from "../dates/isValidTimeZone";
import { toLocalDate } from "../dates/toLocalDate";

import type { ExerciseTrend } from "./exerciseTrend";
import type { MuscleId } from "./muscles";
import type { HeatSet } from "./muscleState";
import type { TrainingParams } from "./params";
import type { WeekSession } from "./weekPlanDays";
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
}>;

export const DEFAULT_TRAINING_REMINDER_SETTINGS: TrainingReminderSettings = {
  trainEnabled: false,
  progressEnabled: false,
  easeEnabled: false,
  trainTime: "17:30",
};

/**
 * A routine day as the reminders read it. A `PlanRoutine` day fits. A null weekday means any day, which
 * has no date to remind on, so it is never reminded.
 */
export type TrainingReminderRoutineDay = Readonly<{
  weekday: number | null;
  exercises: readonly Readonly<{
    muscles: readonly Pick<ExerciseMuscleEntry, "muscle_id" | "role">[];
  }>[];
}>;

/** The fields of a session the reminders read. A `WeekSession` fits. */
export type TrainingReminderSession = Pick<WeekSession, "local_date" | "ended_at" | "deleted_at">;

export type TrainingReminderInput = Readonly<{
  /** The moment to plan from, an ISO timestamp with a zone. */
  now: string;
  /** The person's IANA zone. It places every fire time and every day. */
  timeZone: string;
  settings: TrainingReminderSettings;
  /** The active routine, or null when there is none. */
  plan: Readonly<{ days: readonly TrainingReminderRoutineDay[] }> | null;
  /** Sessions near today. Only the finished ones, and their `local_date`, are read. */
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
  /** The id of the variant last delivered for each type, or null when none has been. */
  lastVariantIds: Readonly<Record<TrainingReminderType, string | null>>;
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
const EASE_TIME = { hour: 8, minute: 0 };
const PROGRESS_TIME = { hour: 19, minute: 0 };
const SUNDAY = 6;

type Candidate = { type: TrainingReminderType; date: string; fireAt: Date };

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

/** The id of the variant for a fire date: the date's own, moved on by one when it is the one used just before. */
const variantFor = (
  type: TrainingReminderType,
  date: string,
  previousId: string | null,
): string => {
  const variants = TRAINING_REMINDER_VARIANTS[type];
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
 * - Each variant is picked by the fire date, and never the one delivered last or the one before it in the
 *   plan. A variant is named by its id, which the app stores once it is delivered.
 *
 * Throws a `RangeError` naming the rule when `now` is not an ISO timestamp with a zone, `timeZone` is not
 * an IANA name or `trainTime` is not HH:MM.
 */
export const planTrainingReminders = ({
  now,
  timeZone,
  settings,
  plan,
  sessions,
  heatSets,
  params = TRAINING_PARAMS_V1,
  weeklyGain,
  lastVariantIds,
}: TrainingReminderInput): PlannedTrainingReminder[] => {
  const nowMilliseconds = parseMoment(now);
  if (!isValidTimeZone(timeZone)) {
    throw new RangeError("A reminder's time zone must be an IANA zone name");
  }
  const trainTime = parseClockTime(settings.trainTime);
  if (trainTime === undefined) {
    throw new RangeError("A reminder's train time must be written HH:MM");
  }

  const today = toLocalDate(new Date(nowMilliseconds), timeZone);
  const finishedDates = new Set(
    sessions.flatMap((session) =>
      session.deleted_at === null && session.ended_at !== null ? [session.local_date] : [],
    ),
  );
  const fireTime = (date: string, { hour, minute }: { hour: number; minute: number }): Date =>
    instantAtLocalTime(date, hour, minute, timeZone);

  const isLoaded = (day: TrainingReminderRoutineDay, date: string): boolean => {
    const judgedAt = fireTime(date, EASE_TIME).toISOString();
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

  const candidates: Candidate[] = [];
  const pushIfAhead = (type: TrainingReminderType, date: string, fireAt: Date): void => {
    if (fireAt.getTime() > nowMilliseconds) {
      candidates.push({ type, date, fireAt });
    }
  };

  for (let offset = 0; offset < REMINDER_WINDOW_DAYS; offset += 1) {
    const date = addCalendarDays(today, offset);
    const weekday = daysSinceMonday(date);
    const day = plan?.days.find((routineDay) => routineDay.weekday === weekday);

    if (day !== undefined && !finishedDates.has(date)) {
      const eased = settings.easeEnabled && offset < EASE_JUDGED_DAYS && isLoaded(day, date);
      if (eased) {
        pushIfAhead("ease", date, fireTime(date, EASE_TIME));
      } else if (settings.trainEnabled) {
        pushIfAhead("train", date, fireTime(date, trainTime));
      }
    }
    if (settings.progressEnabled && weeklyGain && weekday === SUNDAY) {
      pushIfAhead("progress", date, fireTime(date, PROGRESS_TIME));
    }
  }

  const lastUsed = { ...lastVariantIds };
  return candidates
    .sort((first, second) => first.fireAt.getTime() - second.fireAt.getTime())
    .map(({ type, date, fireAt }) => {
      const variantId = variantFor(type, date, lastUsed[type]);
      lastUsed[type] = variantId;
      const { title, body } = describeTrainingReminder(type, variantId);
      return { type, fireAt: fireAt.toISOString(), variantId, title, body };
    });
};
