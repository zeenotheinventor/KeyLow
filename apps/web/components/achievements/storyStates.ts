import { ACHIEVEMENTS, levelFor } from "@keylow/core";
import { webAchievementCatalogue } from "@keylow/core/copy";

import type {
  AchievementCategory,
  AchievementResult,
  CalendarDayState,
  DayState,
} from "@keylow/core";

// The sample of the boards: First Bite to Saved by the Snow earned in a few series, the rest part of the way.
const EARNED_IDS: ReadonlySet<string> = new Set([
  "first-bite",
  "on-the-scales",
  "jotter",
  "notebook",
  "hat-trick",
  "full-week",
  "fortnight",
  "back-on-track",
  "saved-by-the-snow",
  "routine-builder",
  "warmed-up",
  "ten-down",
  "regular-at-the-rack",
  "set-counter",
  "leap-of-faith",
]);

const PROGRESS_SHARE = 0.4;

/** Every achievement of the catalogue, the sample earned and the rest 40 percent of the way. */
export const sampleResults: readonly AchievementResult[] = ACHIEVEMENTS.map(
  ({ id, target }): AchievementResult =>
    EARNED_IDS.has(id)
      ? { id, earned: true }
      : { id, earned: false, progress: { current: Math.floor(target * PROGRESS_SHARE), target } },
);

/** Nothing earned and nothing started, as a new user sees the page. */
export const nothingEarnedResults: readonly AchievementResult[] = ACHIEVEMENTS.map(
  ({ id, target }): AchievementResult => ({
    id,
    earned: false,
    progress: { current: 0, target },
  }),
);

export const sampleLevel = levelFor(1180);

const DAY_STATES: readonly DayState[] = [
  "complete",
  "complete",
  "missed",
  "complete",
  "complete",
  "complete",
  "complete",
  "complete",
  "complete",
  "frozen",
  "complete",
  "complete",
  "complete",
  "at_risk",
];

/** Fourteen days up to 19 November 2026, with one of every state the strip draws but a day still to come. */
export const sampleCalendar: CalendarDayState[] = DAY_STATES.map((state, index) => ({
  localDate: `2026-11-${String(6 + index).padStart(2, "0")}`,
  state,
}));

export const sampleStreaks = {
  daily: {
    current: 12,
    longest: 31,
    today: "at_risk",
    yesterdayCompletable: false,
    calendar: sampleCalendar,
    freezesHeld: 3,
    freezesUsed: 1,
    backOnTrack: true,
    weekendRun: { current: 1, longest: 2 },
  },
  training: { current: 6, longest: 8, thisWeek: "complete" },
  weighIn: { current: 9, longest: 9, thisWeek: "complete" },
} as const;

export const sampleHeld = [
  { id: "first-bite", unlockedAt: "2026-11-06T12:00:00.000Z" },
  { id: "fortnight", unlockedAt: "2026-11-06T12:00:00.000Z" },
];

export const sampleCatalogue = webAchievementCatalogue(sampleResults);

export const sampleCategory = (name: AchievementCategory) => {
  const found = sampleCatalogue.find(({ category }) => category === name);
  if (found === undefined) {
    throw new RangeError("That category is not in the catalogue.");
  }
  return found;
};
