import { describeCount } from "./counts";
import { MONTH_NAMES_LONG } from "./diaryDay";
import { parseCalendarDay } from "../dates/calendarDay";

import type {
  DayState,
  StreakChipState,
  WeekBar,
  WeekState,
  WeeklyStreak,
} from "../achievements/streaks";

/*
 * The words of the streak surfaces (KEY-1089), as `docs/design/achievements/streaks` board 4 has them:
 * the Dashboard chip, the calendar sheet and the weekly streak cards on the Train tab and the Weight
 * screen.
 */

const OPEN_CALENDAR = "Open streak calendar";

const CHIP_ACCESSIBLE_STATE: Record<Exclude<StreakChipState, "none">, string> = {
  active: "",
  at_risk: ", not complete today",
  freeze_used: ", freeze used",
};

const CHIP_VISIBLE_SUFFIX: Record<Exclude<StreakChipState, "none">, string> = {
  active: "",
  at_risk: " · Complete today",
  freeze_used: " · Freeze used",
};

/** The chip's words: what it shows, and its name for a screen reader, which also says it opens the calendar. */
export const describeStreakChip = (
  state: StreakChipState,
  current: number,
): { text: string; accessibleName: string } => {
  if (state === "none") {
    return { text: "Start a streak", accessibleName: `Start a streak. ${OPEN_CALENDAR}` };
  }
  return {
    text: `${current}${CHIP_VISIBLE_SUFFIX[state]}`,
    accessibleName: `${current} day streak${CHIP_ACCESSIBLE_STATE[state]}. ${OPEN_CALENDAR}`,
  };
};

export const STREAK_CALENDAR = {
  title: "Your streak",
  subtitle: "Complete a day in the Diary to keep it going.",
  currentLabel: "current days",
  longestLabel: "longest",
  freezesLabel: "freezes held",
  weekStartNote: "Mon to Sun",
  weekdayLetters: ["M", "T", "W", "T", "F", "S", "S"],
  legend: {
    complete: "Complete",
    frozen: "Frozen",
    missed: "Missed",
    atRisk: "Today, at risk",
  },
  freezeExplanation:
    "You earn a freeze for every 7 days in a row, and from Gold and Platinum badges, level-ups and more. There is no limit to how many you hold.",
} as const;

/** The month heading, such as "November 2026". */
export const describeStreakMonth = (localDate: string): string => {
  const { year, month } = parseCalendarDay(localDate);

  return `${MONTH_NAMES_LONG[month - 1]} ${year}`;
};

const CALENDAR_DAY_STATE: Record<DayState, string> = {
  complete: ", complete",
  frozen: ", frozen",
  missed: ", missed",
  at_risk: ", today, not complete yet",
  future: "",
};

/** A day's name for a screen reader: the day of the month and what the cell shows, so colour is never the only signal. */
export const describeCalendarDay = (localDate: string, state: DayState): string =>
  `${parseCalendarDay(localDate).day}${CALENDAR_DAY_STATE[state]}`;

export const STREAK_WEEKS = {
  barsName: (count: number): string => `Last ${count} weeks`,
} as const;

/** The labels under the bars, oldest first: W1 and on, then Now for this week. */
export const describeWeekBarLabels = (count: number): string[] =>
  Array.from({ length: count }, (_, index) => (index === count - 1 ? "Now" : `W${index + 1}`));

const WEEK_STATE_WORDS: Record<WeekState, string> = {
  complete: "complete",
  missed: "missed",
  at_risk: "at risk",
};

export const describeWeekBar = (label: string, state: WeekState): string =>
  `${label}, ${WEEK_STATE_WORDS[state]}`;

const SESSIONS_THIS_WEEK = (achieved: number, required: number): string =>
  `${achieved} of ${describeCount(required, "session", "sessions")} this week.`;

/** The training streak card: its title, its best, and how this week is going. */
export const describeTrainingStreak = ({
  current,
  longest,
  achieved,
  required,
}: {
  current: number;
  longest: number;
  achieved: number;
  required: number;
}): { title: string; best: string | null; progress: string } => {
  const remaining = Math.max(required - achieved, 0);

  return {
    title: current === 0 ? "Start a training streak this week" : `${current}-week training streak`,
    best: longest === 0 ? null : `Best ${longest}`,
    progress:
      remaining === 0
        ? SESSIONS_THIS_WEEK(achieved, required)
        : `${SESSIONS_THIS_WEEK(achieved, required)} ${remaining} more by Sunday to keep it.`,
  };
};

/** The weigh-in streak card: its title, and whether this week has a weigh-in, with the best once there is one. It names no weight. */
export const describeWeighInStreak = ({
  current,
  longest,
  thisWeek,
}: Pick<WeeklyStreak, "current" | "longest" | "thisWeek">): { title: string; detail: string } => {
  const week = thisWeek === "complete" ? "Weighed in this week." : "Weigh in by Sunday to keep it.";

  return {
    title: current === 0 ? "Start a weigh-in streak this week" : `${current}-week weigh-in streak`,
    detail: longest === 0 ? week : `${week} Best ${describeCount(longest, "week", "weeks")}.`,
  };
};

/** Each bar with its label (W1 and on, then Now) and its name for a screen reader, oldest first. */
export const describeWeekBars = (
  bars: readonly WeekBar[],
): { weekStart: string; state: WeekState; label: string; name: string }[] =>
  bars.map((bar, index) => {
    const label = index === bars.length - 1 ? "Now" : `W${index + 1}`;

    return {
      weekStart: bar.weekStart,
      state: bar.state,
      label,
      name: describeWeekBar(label, bar.state),
    };
  });
