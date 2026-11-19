import { MONTH_NAMES_LONG } from "./diaryDay";
import { parseCalendarDay } from "../dates/calendarDay";
import { groupThousands } from "../format/numbers";

import type { RuleKey } from "../achievements/rules";

/*
 * The words of the Achievements screen, the badge detail sheet and the backfill card (KEY-1087). Badge
 * names and their "earn it by" lines stay in `achievements.ts`.
 */

export const ACHIEVEMENTS_SCREEN = {
  title: "Achievements",
  /** The back control's label, as the board draws it: the screen it goes back to. */
  backLabel: "More",
  /** The back control's accessible name. */
  backAccessibilityLabel: "Back to More",
  loadingLabel: "Loading achievements",
  offline: "You are offline. Badges you earn now are saved when Ki-Lo reconnects.",
  error: {
    title: "Your achievements did not load",
    body: "Your badges are safe. Ki-Lo could not reach them just now.",
    retry: "Try again",
  },
  streakCaption: "day streak",
  pointsUnit: "points",
  hiddenBadge: {
    name: "???",
    title: "A hidden badge",
    body: "Some badges stay secret until you earn them. Keep using Ki-Lo and you might stumble on this one.",
  },
  detail: {
    done: "Done",
    earned: "Earned",
    points: "Points",
    worth: "Worth",
    bonus: "Bonus",
  },
  backfill: {
    title: "Achievements are here",
    seeBadges: "See your badges",
    dismiss: "Dismiss",
  },
} as const;

export const describeLevelLabel = (level: number): string => `Level ${level}`;

export const describeLevelPoints = (points: number): string => groupThousands(String(points));

export const describePointsToNextLevel = (points: number, nextLevel: number): string =>
  `${groupThousands(String(points))} ${points === 1 ? "point" : "points"} to level ${nextLevel}`;

export const describeNextLevelProgressLabel = (nextLevel: number): string =>
  `Progress to level ${nextLevel}`;

export const describeFreezeCaption = (freezes: number): string =>
  freezes === 1 ? "freeze" : "freezes";

export const describeBadgeCount = (total: number): string => `of ${total} badges`;

export const describeCategoryCount = (earned: number, total: number): string =>
  `${earned} of ${total}`;

export const describeToGo = (remaining: number): string => `${remaining} to go`;

/** A day in full, as the badge detail writes when a badge was earned: "6 November 2026". */
export const describeEarnedOn = (localDate: string): string => {
  const { year, month, day } = parseCalendarDay(localDate);
  return `${day} ${MONTH_NAMES_LONG[month - 1]} ${year}`;
};

export const describePointsWorth = (points: number): string => `+${points} points`;

export const describePointsEarned = (points: number): string => `+${points}`;

export const describeFreezeBonus = (freezes: number): string =>
  `+${freezes} ${freezes === 1 ? "freeze" : "freezes"}`;

export const describeBackfillCard = (badges: number, level: number): string =>
  `You have already earned ${badges} ${badges === 1 ? "badge" : "badges"} and reached level ${level}.`;

/** What a locked badge counts, singular then plural. A measure that is a yes or no has no unit. */
type ProgressUnit = readonly [singular: string, plural: string] | null;

const DAYS: ProgressUnit = ["day", "days"];
const WEEKS: ProgressUnit = ["week", "weeks"];
const ENTRIES: ProgressUnit = ["entry", "entries"];
const WORKOUTS: ProgressUnit = ["workout", "workouts"];
const WEIGH_INS: ProgressUnit = ["weigh-in", "weigh-ins"];
const CHECK_INS: ProgressUnit = ["check-in", "check-ins"];
const RECIPES: ProgressUnit = ["recipe", "recipes"];
const FOODS: ProgressUnit = ["food", "foods"];
const SETS: ProgressUnit = ["set", "sets"];
const ITEMS: ProgressUnit = ["item", "items"];
const FREEZES: ProgressUnit = ["freeze", "freezes"];
const LOGS: ProgressUnit = ["log", "logs"];

const PROGRESS_UNITS: Readonly<Record<RuleKey, ProgressUnit>> = {
  "entries-logged": ENTRIES,
  "setup-completed": null,
  "weigh-ins": WEIGH_INS,
  "weigh-in-days": DAYS,
  "barcodes-scanned": ["scan", "scans"],
  "recipes-saved": RECIPES,
  "favourites-saved": ["favourite", "favourites"],
  "workouts-finished": WORKOUTS,
  "planned-days": DAYS,
  "assistant-questions": ["question", "questions"],
  "reminder-enabled": null,
  "body-composition-readings": ["reading", "readings"],
  "days-completed": DAYS,
  "days-logged": DAYS,
  "daily-streak": DAYS,
  "back-on-track": null,
  "freezes-used": FREEZES,
  "weekend-run": ["weekend", "weekends"],
  "freezes-held": FREEZES,
  "protein-days": DAYS,
  "calorie-days": DAYS,
  "balanced-days": DAYS,
  "perfect-week-run": DAYS,
  "fibre-days": DAYS,
  "morning-log-days": DAYS,
  "distinct-foods": FOODS,
  "new-foods-in-a-week": FOODS,
  "favourite-repeats": LOGS,
  "own-recipe-entries": ENTRIES,
  "recipe-days": DAYS,
  "longest-plan-days": DAYS,
  "shopping-list-items": ITEMS,
  "shopping-items-ticked": ITEMS,
  "routines-created": ["routine", "routines"],
  "working-sets": SETS,
  "tonnage-kg": ["kg", "kg"],
  "most-sets-in-session": SETS,
  "training-streak": WEEKS,
  "early-workouts": WORKOUTS,
  "late-workouts": WORKOUTS,
  "personal-records": ["record", "records"],
  "full-body-week": null,
  "leg-sessions": ["session", "sessions"],
  "distinct-exercises": ["exercise", "exercises"],
  "exercise-demos-watched": ["demo", "demos"],
  "weigh-in-streak": WEEKS,
  "early-weigh-ins": WEIGH_INS,
  "programme-weeks": WEEKS,
  "check-ins": CHECK_INS,
  "check-ins-on-one-programme": CHECK_INS,
  "targets-edited": ["edit", "edits"],
  "assistant-conversations": ["chat", "chats"],
  "assistant-logged-meals": ["meal", "meals"],
  "assistant-saved-recipes": RECIPES,
  "data-exports": ["export", "exports"],
  "feature-requests": ["request", "requests"],
  "favourite-logs": LOGS,
  "week-view-opens": ["view", "views"],
  "logged-on-new-year": null,
  "logged-on-christmas": null,
  "logged-on-halloween": null,
  "logged-on-leap-day": null,
  "midnight-log": null,
  anniversary: null,
  "achievements-earned": ["badge", "badges"],
};

/** How far a locked badge has got, as the board writes it: "12 of 30 days". */
export const describeProgress = (rule: RuleKey, current: number, target: number): string => {
  const unit = PROGRESS_UNITS[rule];
  const counted = `${current} of ${target}`;
  if (unit === null) {
    return counted;
  }
  return `${counted} ${target === 1 ? unit[0] : unit[1]}`;
};
