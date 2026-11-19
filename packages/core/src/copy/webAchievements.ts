import { ACHIEVEMENT_TIER_NAMES, HIDDEN_BADGE_LABEL } from "./achievementBadge";
import { ACHIEVEMENT_CATEGORY_NAMES, ACHIEVEMENT_COPY } from "./achievements";
import { describeFreezeBonus } from "./achievementsScreen";
import {
  ACHIEVEMENT_CATEGORIES,
  ACHIEVEMENTS,
  TIER_POINTS,
  freezesForBadge,
} from "../achievements";

import type {
  AchievementCategory,
  AchievementId,
  AchievementResult,
  BadgeState,
  LevelStanding,
  RuleKey,
} from "../achievements";

/*
 * The words and the small decisions of the web Achievements page (KEY-1092), from board 7 and the dialog of
 * board 2. A hidden badge that is not earned keeps its name and tier secret. Every number is health data, so
 * nothing here is logged.
 */

export const WEB_ACHIEVEMENTS = {
  pageTitle: "Achievements",
  loadingLabel: "Loading achievements",
  loadFailedTitle: "Couldn't load your achievements",
  loadFailedBody: "Check your connection and try again.",
  levelCaptionPrefix: "Level",
  dailyStreakCaption: "Daily streak",
  badgesCaption: "Badges",
  levelProgressName: "Progress to the next level",
  streakStripName: "Last 14 days",
  doneLabel: "Done",
  closeLabel: "Close",
} as const;

/** What a day of the strip says to a screen reader, by the state of the day. */
export const WEB_DAY_STATE_NAMES = {
  complete: "Complete",
  frozen: "Frozen",
  missed: "Missed",
  at_risk: "At risk",
  future: "Still to come",
} as const;

const HIDDEN_DESCRIPTION =
  "Some badges stay secret until you earn them. Keep using Ki-Lo and you might stumble on this one.";
const HIDDEN_TITLE = "A hidden badge";
const HIDDEN_TIER_LINE = ACHIEVEMENT_CATEGORY_NAMES["hidden-and-seasonal"];

const formatCount = (count: number): string => count.toLocaleString("en-GB");

const plural = (count: number, singular: string, pluralWord: string): string =>
  `${count} ${count === 1 ? singular : pluralWord}`;

/** Level six, Sapling: "1,180 points. 220 to level 7". */
export const describeWebLevelPoints = ({ level, totalPoints, progress }: LevelStanding): string =>
  `${formatCount(totalPoints)} points. ${formatCount(progress.target - progress.current)} to level ${level + 1}`;

export const describeWebLevelCaption = (level: number): string =>
  `${WEB_ACHIEVEMENTS.levelCaptionPrefix} ${level}`;

export const describeWebDailyStreak = (days: number): string => plural(days, "day", "days");

/** The line under the strip: "Longest 31. 3 freezes held". */
export const describeWebStreakFacts = (longest: number, freezesHeld: number): string =>
  `Longest ${longest}. ${plural(freezesHeld, "freeze", "freezes")} held`;

/** The badges card's line: "Training streak 6 weeks. Weigh-in streak 9 weeks." */
export const describeWebWeeklyStreaks = (training: number, weighIn: number): string =>
  `Training streak ${plural(training, "week", "weeks")}. Weigh-in streak ${plural(weighIn, "week", "weeks")}.`;

export const describeWebBadgeCount = (earned: number, total: number): string =>
  `${formatCount(earned)} of ${formatCount(total)}`;

/** What a locked badge's progress counts, as the plural noun after "12 of 30". */
export const WEB_PROGRESS_UNITS: Readonly<Record<RuleKey, string>> = {
  "entries-logged": "entries",
  "setup-completed": "steps",
  "weigh-ins": "weigh-ins",
  "weigh-in-days": "days",
  "barcodes-scanned": "barcodes",
  "recipes-saved": "recipes",
  "favourites-saved": "favourites",
  "workouts-finished": "workouts",
  "planned-days": "days",
  "assistant-questions": "questions",
  "reminder-enabled": "reminders",
  "body-composition-readings": "readings",
  "days-completed": "days",
  "days-logged": "days",
  "daily-streak": "days",
  "back-on-track": "days",
  "freezes-used": "freezes",
  "weekend-run": "weekends",
  "freezes-held": "freezes",
  "protein-days": "days",
  "calorie-days": "days",
  "balanced-days": "days",
  "perfect-week-run": "days",
  "fibre-days": "days",
  "morning-log-days": "days",
  "distinct-foods": "foods",
  "new-foods-in-a-week": "foods",
  "favourite-repeats": "times",
  "own-recipe-entries": "times",
  "recipe-days": "days",
  "longest-plan-days": "days",
  "shopping-list-items": "items",
  "shopping-items-ticked": "items",
  "routines-created": "routines",
  "working-sets": "sets",
  "tonnage-kg": "kg",
  "most-sets-in-session": "sets",
  "training-streak": "weeks",
  "early-workouts": "workouts",
  "late-workouts": "workouts",
  "personal-records": "records",
  "full-body-week": "weeks",
  "leg-sessions": "workouts",
  "distinct-exercises": "exercises",
  "exercise-demos-watched": "demos",
  "weigh-in-streak": "weeks",
  "early-weigh-ins": "weigh-ins",
  "programme-weeks": "weeks",
  "check-ins": "check-ins",
  "check-ins-on-one-programme": "check-ins",
  "targets-edited": "edits",
  "assistant-conversations": "conversations",
  "assistant-logged-meals": "meals",
  "assistant-saved-recipes": "recipes",
  "data-exports": "exports",
  "feature-requests": "requests",
  "favourite-logs": "times",
  "week-view-opens": "times",
  "logged-on-new-year": "days",
  "logged-on-christmas": "days",
  "logged-on-halloween": "days",
  "logged-on-leap-day": "days",
  "midnight-log": "times",
  anniversary: "days",
  "achievements-earned": "badges",
};

const definitionOf = (id: AchievementId) => {
  const definition = ACHIEVEMENTS.find((entry) => entry.id === id);
  if (definition === undefined) {
    throw new RangeError("That achievement is not in the catalogue.");
  }
  return definition;
};

/** A one-off badge has a target of one, so it has no progress worth drawing. */
const hasProgress = (target: number): boolean => target > 1;

const upperFirst = (text: string): string => `${text.charAt(0).toUpperCase()}${text.slice(1)}`;

const earnedBadgeState = (hidden: boolean, earned: boolean): BadgeState =>
  earned ? "earned" : hidden ? "hidden" : "locked";

export type WebCatalogueBadge = Readonly<{
  id: AchievementId;
  name: string;
  state: BadgeState;
  /** Under the name: the tier of an earned badge, "12 of 21" for a locked one, "Secret" for a hidden one. */
  subLine: string;
  /** The words `AchievementBadge` gives a locked badge, such as "12 of 30 days". */
  progressWords: string | undefined;
}>;

export type WebCatalogueCategory = Readonly<{
  category: AchievementCategory;
  heading: string;
  /** "6 of 14". */
  countLabel: string;
  badges: readonly WebCatalogueBadge[];
}>;

const progressWordsOf = (result: AchievementResult, rule: RuleKey): string | undefined =>
  result.earned || !hasProgress(result.progress.target)
    ? undefined
    : `${formatCount(result.progress.current)} of ${formatCount(result.progress.target)} ${WEB_PROGRESS_UNITS[rule]}`;

const subLineOf = (state: BadgeState, tier: string, result: AchievementResult): string => {
  if (state === "earned") {
    return tier;
  }
  if (state === "hidden") {
    return "Secret";
  }
  return !result.earned && hasProgress(result.progress.target)
    ? `${formatCount(result.progress.current)} of ${formatCount(result.progress.target)}`
    : "Locked";
};

/**
 * Every achievement under its category, in the catalogue's order, as the page's grid draws it. `results` is
 * the engine's `perAchievementProgress`.
 */
export const webAchievementCatalogue = (
  results: readonly AchievementResult[],
): readonly WebCatalogueCategory[] =>
  ACHIEVEMENT_CATEGORIES.map((category) => {
    const badges = ACHIEVEMENTS.filter((entry) => entry.category === category).flatMap(
      (definition): WebCatalogueBadge[] => {
        const result = results.find(({ id }) => id === definition.id);
        if (result === undefined) {
          return [];
        }
        const state = earnedBadgeState(definition.hidden, result.earned);
        return [
          {
            id: result.id,
            name: state === "hidden" ? HIDDEN_BADGE_LABEL : ACHIEVEMENT_COPY[result.id].name,
            state,
            subLine: subLineOf(state, ACHIEVEMENT_TIER_NAMES[definition.tier], result),
            progressWords:
              state === "hidden" ? undefined : progressWordsOf(result, definition.rule),
          },
        ];
      },
    );
    return {
      category,
      heading: ACHIEVEMENT_CATEGORY_NAMES[category],
      countLabel: describeWebBadgeCount(
        badges.filter(({ state }) => state === "earned").length,
        badges.length,
      ),
      badges,
    };
  });

export type WebBadgeDetail = Readonly<{
  /** The dialog's heading. */
  title: string;
  state: BadgeState;
  /** The pill under the badge: "Silver · Daily streaks". */
  tierLine: string;
  description: string;
  /** A locked badge's bar and its words. Absent for an earned, hidden or one-off badge. */
  progress?: Readonly<{ current: number; target: number; words: string; remaining: string }>;
  facts: readonly Readonly<{ label: string; value: string }>[];
}>;

export type WebBadgeDetailInput = Readonly<{
  id: AchievementId;
  result: AchievementResult;
  /** When the database recorded the unlock, if it has. */
  unlockedAt: string | undefined;
}>;

const formatEarnedDate = (unlockedAt: string): string =>
  new Date(unlockedAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

/** What the badge dialog shows: earned with its date and points, locked with its progress, hidden keeping its secret. */
export const webBadgeDetail = ({ id, result, unlockedAt }: WebBadgeDetailInput): WebBadgeDetail => {
  const definition = definitionOf(id);
  const state = earnedBadgeState(definition.hidden, result.earned);
  if (state === "hidden") {
    return {
      title: HIDDEN_TITLE,
      state,
      tierLine: HIDDEN_TIER_LINE,
      description: HIDDEN_DESCRIPTION,
      facts: [],
    };
  }

  const { name, earnedBy } = ACHIEVEMENT_COPY[id];
  const common = {
    title: name,
    state,
    tierLine: `${ACHIEVEMENT_TIER_NAMES[definition.tier]} · ${ACHIEVEMENT_CATEGORY_NAMES[definition.category]}`,
    description: `${upperFirst(earnedBy)}.`,
  };
  const points = TIER_POINTS[definition.tier];

  if (result.earned) {
    return {
      ...common,
      facts: [
        ...(unlockedAt === undefined
          ? []
          : [{ label: "Earned", value: formatEarnedDate(unlockedAt) }]),
        { label: "Points", value: `+${points}` },
      ],
    };
  }

  const freezes = freezesForBadge(definition);
  const { current, target } = result.progress;
  return {
    ...common,
    ...(hasProgress(target)
      ? {
          progress: {
            current,
            target,
            words: `${formatCount(current)} of ${formatCount(target)} ${WEB_PROGRESS_UNITS[definition.rule]}`,
            remaining: `${formatCount(target - current)} to go`,
          },
        }
      : {}),
    facts: [
      { label: "Worth", value: `+${points} points` },
      ...(freezes === 0 ? [] : [{ label: "Bonus", value: describeFreezeBonus(freezes) }]),
    ],
  };
};
