import {
  describeSets,
  describeWeekdayName,
  describeWeekdayShortName,
  describeWeekRange,
  joinInWords,
} from "./bodyMap";
import { describeCount } from "./counts";
import { describeDateInWords } from "./diary";
import { MUSCLE_NAMES, NAME_NUMBER } from "./muscleNames";
import { dayNumber } from "../dates/calendarDay";

import type { MuscleId } from "../training/muscles";
import type { MadeUpDay, NextPlannedDay, TodayCard } from "../training/todayCard";
import type { PlannedDay, WeekCaption, WeekPlanDay, WeekSession } from "../training/weekPlanDays";

/*
 * The words of the Train home, the session bar and the Train tab states, as the boards `train · *` and
 * `TrainScreen` draw them (KEY-336, canvas version 30). Data in, sentence out: every count, minute, name
 * and date in a sentence comes from the input. A name in a sentence is never logged, so none of these
 * throws with one in its message.
 */

/** The fixed words of the Train screen: the tab, the title, its two links and the section names. */
export const TRAIN_HOME = {
  tabLabel: "Train",
  title: "Train",
  historyLink: "History",
  routinesLink: "Routines",
  todaySectionName: "Today",
  weekSectionName: "This week",
  /** The name of the bar that fills as the day's sets are logged. */
  setsProgressName: "Sets logged",
} as const;

/** The fixed words of the Today card. */
export const TRAIN_TODAY_CARD = {
  restTitle: "Rest day",
  inProgressLabel: "In progress",
  doneLabel: "Done",
  viewSessionAction: "View session",
  /** The action on the Done card that starts another session the same day (KEY-492). No board draws it. */
  logAnotherAction: "Log another session",
  /** The action on the rest-day card that starts a free session (KEY-492). No board draws it. */
  logSessionAction: "Log a session",
  /** The name of a session that follows no routine day. */
  sessionName: "Session",
  /** The action on the card of a session that follows no routine day. */
  resumeSessionAction: "Resume session",
} as const;

/**
 * The fixed words of Pick day, which starts a session of any day of the routine: the button on the Today
 * card, the sheet it opens and the sheet's close control. No board draws them (Zee ruled the button on
 * 2026-10-20), so they are an undrawn design request.
 */
export const TRAIN_PICK_DAY = {
  action: "Pick day",
  sheetTitle: "Pick a day",
  closeName: "Close",
} as const;

const ANY_WEEKDAY_LABEL = "Any day";

export type PickDayRowInput = Readonly<{
  /** The routine day's name, as the routine stores it. */
  name: string;
  /** The date of the day this week, `YYYY-MM-DD`, or null for a day with no weekday. */
  date: string | null;
  exerciseCount: number;
  setCount: number;
}>;

export type PickDayRowCopy = {
  /** "Legs". */
  title: string;
  /** "5 exercises · 16 sets". */
  meta: string;
  /** The weekday: "Thursday", or "Any day" for a day with no weekday. */
  weekdayLabel: string;
};

/** The words of one routine day in the Pick day sheet. */
export const describePickDayRow = ({
  name,
  date,
  exerciseCount,
  setCount,
}: PickDayRowInput): PickDayRowCopy => ({
  title: name,
  meta: [describeCount(exerciseCount, "exercise", "exercises"), describeSets(setCount)].join(" · "),
  weekdayLabel: date === null ? ANY_WEEKDAY_LABEL : describeWeekdayName(date),
});

/** The card shown when there is no routine yet. */
export const TRAIN_NO_ROUTINE = {
  sectionName: "No routine",
  title: "No routine yet",
  body: "Plan your training days and Ki-Lo shows where your week is heading. You can still log any session.",
  createAction: "Create routine",
  logAction: "Log a session anyway",
} as const;

/** The first visit: nothing logged, ever. */
export const TRAIN_FIRST_TIME = {
  figureLabel: "Body map at rest",
  title: "Train with Ki-Lo",
  body: "Log your sets and see each muscle warm up as you train and cool as you recover.",
  points: [
    "Log a set in seconds, with last time's numbers ready.",
    "See heat, weekly sets and your plan on the body map.",
    "Get a next session that fits your goal and your week.",
  ],
  goalAction: "Set your goal",
  logAction: "Log a session",
} as const;

/** The name of the loading skeleton for a screen reader. It has nothing else to say. */
export const TRAIN_LOADING_NAME = "Loading your training";

/** The error card. It states the rule and never a value. */
export const TRAIN_ERROR = {
  title: "Your training did not load",
  body: "Your sessions are safe. Check your connection, then try again.",
  action: "Try again",
} as const;

/**
 * The danger toast when a session did not start. It states the rule and never a value. No board draws it
 * (KEY-431): it is the only string the Start flow adds. A toast is one sentence with no full stop.
 */
export const TRAIN_START_FAILED = "Your session did not start, check your connection and try again";

/**
 * The danger toast when a discard did not go through, so the session is still there. It states the rule and
 * never a value. No board draws it (KEY-431).
 */
export const TRAIN_DISCARD_FAILED =
  "Discarding a session needs a connection, your session is still here";

/** The title of the offline banner, which `describeOfflineBanner` completes. */
export const TRAIN_OFFLINE_TITLE = "You're offline";

/** The offline banner's line: "Showing your training as saved at 17:52. ...". The time is the caller's own text. */
export const describeOfflineBanner = (savedAtClockTime: string): string =>
  `Showing your training as saved at ${savedAtClockTime}. Starting a session or logging a set needs a connection.`;

/** The offline banner's line when no training has been saved on the phone yet, so there is no time to name. */
export const TRAIN_OFFLINE_NOTHING_SAVED =
  "Your training will show when you are back online. Starting a session or logging a set needs a connection.";

/** The line above the Today card's title: "Today · Thursday 15 October". */
export const describeTodayHeading = (localDate: string): string =>
  `Today · ${describeDateInWords(localDate)}`;

const MINUTES_ABBREVIATION = "min";
const DAYS_PER_WEEK = 7;

/** The muscles still recovering on a rest day, and the day they were trained. */
export type RecoveringMuscles = Readonly<{
  /** In the order the sentence names them. */
  muscles: readonly MuscleId[];
  /** The calendar day the muscles were last trained, `YYYY-MM-DD`. */
  trainedOn: string;
}>;

export type TodayCardContext = Readonly<{
  /** Today, `YYYY-MM-DD`: the heading names it, and a next day is measured from it. */
  localDate: string;
  /** The exercise of the card's next set, as the catalogue stores it: "Leg Press". */
  nextExerciseName: string | null;
  /** The rest day's muscle sentence, or null for none. */
  recovery: RecoveringMuscles | null;
}>;

/** The kinds of `TodayCard` the Today card draws. `no_routine` and `first_time` have cards of their own. */
export type TodayCardWithSession = Exclude<
  TodayCard,
  Readonly<{ kind: "no_routine" }> | Readonly<{ kind: "first_time" }>
>;

export type TodayCardCopy =
  | Readonly<{
      kind: "planned";
      heading: string;
      title: string;
      /** "Push Pull Legs · day 3 of 4". */
      dayLine: string;
      /** "5 exercises · 16 sets · about 50 min". */
      loadLine: string;
      /** "Start Legs". */
      action: string;
      /** "Push made up for Monday". Present only when today's session made up an earlier day. */
      madeUpLine?: string;
    }>
  | Readonly<{
      kind: "in_progress";
      heading: string;
      title: string;
      statusLabel: string;
      /** "30 min · 8 of 16 sets · next: leg press, set 3". */
      summaryLine: string;
      /** "Resume Legs". */
      action: string;
    }>
  | Readonly<{
      kind: "done";
      heading: string;
      title: string;
      statusLabel: string;
      /** "30 min · 8 of 16 sets · next: Push on Saturday". */
      summaryLine: string;
      /** "View session". */
      action: string;
      /** "Log another session". */
      logAnotherAction: string;
    }>
  | Readonly<{
      kind: "rest";
      heading: string;
      title: string;
      body: string | null;
      /** "Log a session". */
      logSessionAction: string;
      /** "Push made up for Monday". Present only when today's session made up an earlier day. */
      madeUpLine?: string;
    }>;

/**
 * The sets logged of the sets planned: "8 of 16 sets". The sets alone when the day plans none, or when more
 * are logged than planned (a second session the same day): "9 sets", never "9 of 6 sets".
 */
const describeSetsOfPlanned = (setsLogged: number, setsPlanned: number): string =>
  setsPlanned === 0 || setsLogged > setsPlanned
    ? describeSets(setsLogged)
    : `${setsLogged} of ${describeSets(setsPlanned)}`;

const describeMinutes = (minutes: number): string => `${minutes} ${MINUTES_ABBREVIATION}`;

/**
 * The day a next session falls on. A day a week or more away names its date, since "Thursday" said on a
 * Thursday would read as today.
 */
const describeNextDate = (nextDate: string, localDate: string): string =>
  dayNumber(nextDate) - dayNumber(localDate) >= DAYS_PER_WEEK
    ? describeDateInWords(nextDate)
    : describeWeekdayName(nextDate);

const describeNextDay = (next: NextPlannedDay, localDate: string): string =>
  `${next.name} on ${describeNextDate(next.date, localDate)}`;

const capitaliseFirst = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

const describeRecovery = ({ muscles, trainedOn }: RecoveringMuscles): string | null => {
  const [first] = muscles;
  if (first === undefined) {
    return null;
  }
  const names = joinInWords(muscles.map((muscle) => MUSCLE_NAMES[muscle].toLowerCase()));
  const verb = muscles.length === 1 && NAME_NUMBER[first] === "one" ? "is" : "are";
  return `${capitaliseFirst(names)} ${verb} still recovering from ${describeWeekdayName(trainedOn)}.`;
};

/**
 * The line under a planned or rest card that says an earlier day was made up today: "Legs made up for
 * Thursday". It is left out when none was.
 */
const madeUpLineOf = (madeUp: readonly MadeUpDay[] | undefined): { madeUpLine?: string } =>
  madeUp === undefined || madeUp.length === 0
    ? {}
    : {
        madeUpLine: joinInWords(
          madeUp.map(({ dayName, date }) => `${dayName} made up for ${describeWeekdayName(date)}`),
        ),
      };

const describeRestBody = (
  next: NextPlannedDay | null,
  { localDate, recovery }: TodayCardContext,
): string | null => {
  const sentences = [
    next === null ? null : `Next: ${describeNextDay(next, localDate)}.`,
    recovery === null ? null : describeRecovery(recovery),
  ].filter((sentence) => sentence !== null);
  return sentences.length === 0 ? null : sentences.join(" ");
};

/** The words of the Today card for the card `todayCard` gives, in each of its states with a card of this kind. */
export const describeTodayCard = (
  card: TodayCardWithSession,
  context: TodayCardContext,
): TodayCardCopy => {
  const heading = describeTodayHeading(context.localDate);
  switch (card.kind) {
    case "planned":
      return {
        kind: "planned",
        heading,
        title: card.dayName,
        dayLine: `${card.routineName} · day ${card.dayNumber} of ${card.dayCount}`,
        loadLine: [
          describeCount(card.exerciseCount, "exercise", "exercises"),
          describeSets(card.setCount),
          `about ${describeMinutes(card.estimatedMinutes)}`,
        ].join(" · "),
        action: `Start ${card.dayName}`,
        ...madeUpLineOf(card.madeUp),
      };
    case "in_progress": {
      const nextSet =
        card.nextSet === null || context.nextExerciseName === null
          ? []
          : [`next: ${context.nextExerciseName}, set ${card.nextSet.setNumber}`];
      return {
        kind: "in_progress",
        heading,
        title: card.dayName ?? TRAIN_TODAY_CARD.sessionName,
        statusLabel: TRAIN_TODAY_CARD.inProgressLabel,
        summaryLine: [
          describeMinutes(card.minutesSoFar),
          describeSetsOfPlanned(card.setsLogged, card.setsPlanned),
          ...nextSet,
        ].join(" · "),
        action:
          card.dayName === null ? TRAIN_TODAY_CARD.resumeSessionAction : `Resume ${card.dayName}`,
      };
    }
    case "done": {
      const next =
        card.next === null ? [] : [`next: ${describeNextDay(card.next, context.localDate)}`];
      return {
        kind: "done",
        heading,
        title: card.dayName ?? TRAIN_TODAY_CARD.sessionName,
        statusLabel: TRAIN_TODAY_CARD.doneLabel,
        summaryLine: [
          describeMinutes(card.minutes),
          describeSetsOfPlanned(card.setsLogged, card.setsPlanned),
          ...next,
        ].join(" · "),
        action: TRAIN_TODAY_CARD.viewSessionAction,
        logAnotherAction: TRAIN_TODAY_CARD.logAnotherAction,
      };
    }
    case "rest":
      return {
        kind: "rest",
        heading,
        title: TRAIN_TODAY_CARD.restTitle,
        body: describeRestBody(card.next, context),
        logSessionAction: TRAIN_TODAY_CARD.logSessionAction,
        ...madeUpLineOf(card.madeUp),
      };
  }
};

/**
 * The week strip's caption: "Mon 12 to Sun 18 Oct · 2 of 4 done", or "Mon 12 to Sun 18 Oct · 2 sessions"
 * when there is no routine. `weekStart` is the Monday, `YYYY-MM-DD`.
 */
export const describeTrainWeekCaption = (weekStart: string, caption: WeekCaption): string =>
  `${describeWeekRange(weekStart)} · ${
    caption.plannedDayCount === 0
      ? describeCount(caption.loggedSessionCount, "session", "sessions")
      : `${caption.loggedDayCount} of ${caption.plannedDayCount} done`
  }`;

/** A day of the week as `weekPlanDays` gives it, which is all the strip reads. */
export type TrainWeekDayInput = Pick<
  WeekPlanDay,
  "date" | "isToday" | "status" | "setsLogged" | "setsPlanned"
> &
  Readonly<{
    plannedDay: Pick<PlannedDay, "name"> | null;
    /** The routine day the date's sessions name, which is the day done when it is not the planned one. */
    sessionDay: Pick<PlannedDay, "name"> | null;
    /** The finished session that makes the day up, when it was missed and done later in the week. */
    madeUpBy: Pick<WeekSession, "local_date"> | null;
  }>;

export type TrainWeekDayCopy = {
  /** The column head: "Mon". */
  weekday: string;
  /** The name under the day's mark: the routine day, "Rest", or the sets of a session that is no part of the plan. Empty for none. */
  label: string;
  /** "Thursday 15 October, today, Legs, planned, 16 sets". */
  accessibleName: string;
};

const REST_LABEL = "Rest";

/**
 * The routine day a cell is named for. A logged or running cell is named for the day actually done, which
 * is not the planned one when a day was picked in its place, and an extra cell for the day picked on a rest
 * day; the others are named for the planned day.
 */
const dayNamedBy = (day: TrainWeekDayInput): Pick<PlannedDay, "name"> | null =>
  day.status === "logged" || day.status === "in_progress" || day.status === "extra"
    ? (day.sessionDay ?? day.plannedDay)
    : day.plannedDay;

const describeWeekDayState = (day: TrainWeekDayInput, hasRoutine: boolean): string[] => {
  const named = dayNamedBy(day);
  const routineDay = named === null ? [] : [named.name];
  switch (day.status) {
    case "logged":
      return [
        ...routineDay,
        day.madeUpBy === null
          ? "logged"
          : `made up on ${describeWeekdayName(day.madeUpBy.local_date)}`,
        describeSets(day.setsLogged),
      ];
    case "in_progress":
      return [...routineDay, "in progress", describeSetsOfPlanned(day.setsLogged, day.setsPlanned)];
    case "today":
    case "planned":
      return [...routineDay, "planned", describeSets(day.setsPlanned)];
    case "missed":
      return [...routineDay, "missed"];
    case "rest":
      return [hasRoutine ? "rest day" : "nothing logged"];
    case "extra":
      return [...routineDay, "session logged", describeSets(day.setsLogged)];
  }
};

/**
 * One day of the week strip. A rest day with no routine says "nothing logged", since the person has
 * planned no rest. `hasRoutine` is whether the week has a routine.
 */
export const describeTrainWeekDay = (
  day: TrainWeekDayInput,
  hasRoutine: boolean,
): TrainWeekDayCopy => {
  const restLabel = hasRoutine ? REST_LABEL : "";
  return {
    weekday: describeWeekdayShortName(day.date),
    label:
      day.status === "rest" ? restLabel : (dayNamedBy(day)?.name ?? describeSets(day.setsLogged)),
    accessibleName: [
      describeDateInWords(day.date),
      ...(day.isToday ? ["today"] : []),
      ...describeWeekDayState(day, hasRoutine),
    ].join(", "),
  };
};

const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;

const padToTwoDigits = (value: number): string => String(value).padStart(2, "0");

/**
 * The session clock as the boards draw it: "30:00". Past an hour it reads "1:02:00", since the boards
 * draw no longer session. `seconds` is `sessionClock`'s answer.
 */
export const describeSessionClock = (seconds: number): string => {
  const wholeSeconds = Math.floor(seconds);
  const wholeMinutes = Math.floor(wholeSeconds / SECONDS_PER_MINUTE);
  const hours = Math.floor(wholeMinutes / MINUTES_PER_HOUR);
  const minutesPastTheHour = padToTwoDigits(wholeMinutes % MINUTES_PER_HOUR);
  const secondsPastTheMinute = padToTwoDigits(wholeSeconds % SECONDS_PER_MINUTE);
  return hours === 0
    ? `${minutesPastTheHour}:${secondsPastTheMinute}`
    : `${hours}:${minutesPastTheHour}:${secondsPastTheMinute}`;
};

export type SessionBarInput = Readonly<{
  /** The routine day the open session follows, or null for none. */
  dayName: string | null;
  /** `sessionClock`'s answer: the whole seconds since the session started. */
  clockSeconds: number;
  setsLogged: number;
  /** 0 when the session follows no routine day. */
  setsPlanned: number;
}>;

export type SessionBarCopy = {
  /** "Legs". */
  name: string;
  /** "30:00 · 8 of 16 sets". */
  detail: string;
  /** "Legs in progress, 30 minutes, 8 of 16 sets. Open session". */
  accessibleName: string;
};

/** The words of the bar that opens the session in progress, which sits above the tab bar. */
export const describeSessionBar = ({
  dayName,
  clockSeconds,
  setsLogged,
  setsPlanned,
}: SessionBarInput): SessionBarCopy => {
  const name = dayName ?? TRAIN_TODAY_CARD.sessionName;
  const progress = describeSetsOfPlanned(setsLogged, setsPlanned);
  const wholeMinutes = Math.floor(clockSeconds / SECONDS_PER_MINUTE);
  const minutes =
    wholeMinutes === 0 ? "under a minute" : describeCount(wholeMinutes, "minute", "minutes");
  return {
    name,
    detail: `${describeSessionClock(clockSeconds)} · ${progress}`,
    accessibleName: `${name} in progress, ${minutes}, ${progress}. Open session`,
  };
};
