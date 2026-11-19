import { achievementTierOf } from "./art";
import { ACHIEVEMENTS, ACHIEVEMENT_CATEGORIES } from "./catalogue";
import { freezesForBadge } from "./freezeGrants";
import { TIER_POINTS } from "./points";
import {
  ACHIEVEMENT_TIER_NAMES,
  HIDDEN_BADGE_LABEL,
  achievementBadgeLabel,
} from "../copy/achievementBadge";
import { ACHIEVEMENT_COPY, ACHIEVEMENT_CATEGORY_NAMES } from "../copy/achievements";
import {
  ACHIEVEMENTS_SCREEN,
  describeBadgeCount,
  describeCategoryCount,
  describeEarnedOn,
  describeFreezeBonus,
  describeFreezeCaption,
  describeLevelLabel,
  describeLevelPoints,
  describeNextLevelProgressLabel,
  describePointsEarned,
  describePointsToNextLevel,
  describePointsWorth,
  describeProgress,
  describeToGo,
} from "../copy/achievementsScreen";
import { toLocalDate } from "../dates/toLocalDate";

import type { BadgeState } from "./art";
import type { AchievementCategory, AchievementId, AchievementTier } from "./catalogue";
import type { AchievementResult } from "./evaluate";
import type { LevelStanding } from "./points";

const PERCENT = 100;

const percentOf = (current: number, target: number): number =>
  Math.min(PERCENT, Math.max(0, Math.round((current / target) * PERCENT)));

const upperFirst = (text: string): string => `${text.charAt(0).toUpperCase()}${text.slice(1)}`;

const definitionOf = (id: AchievementId) => {
  const definition = ACHIEVEMENTS.find((achievement) => achievement.id === id);
  if (definition === undefined) {
    throw new Error(`The catalogue has no badge ${id}`);
  }
  return definition;
};

/** A badge shown a locked or hidden way, from whether it is earned and whether the catalogue hides it. */
const stateOf = (id: AchievementId, result: AchievementResult): BadgeState => {
  if (result.earned) {
    return "earned";
  }
  return definitionOf(id).hidden ? "hidden" : "locked";
};

export type OverviewBadge = Readonly<{
  id: AchievementId;
  state: BadgeState;
  /** The badge's name, or "???" while it is hidden. */
  name: string;
  /** What is written under the name: the tier of an earned badge, nothing otherwise. */
  caption: string | null;
  /** A locked badge's progress line, such as "12 of 30 days". */
  progressText: string | null;
  progressPercent: number | null;
  /** What a screen reader says for the badge. */
  label: string;
}>;

export type OverviewCategory = Readonly<{
  category: AchievementCategory;
  title: string;
  countText: string;
  badges: readonly OverviewBadge[];
}>;

export type AchievementsOverviewInput = Readonly<{
  results: readonly AchievementResult[];
  level: LevelStanding;
  streakDays: number;
  freezes: number;
}>;

export type AchievementsOverview = Readonly<{
  level: Readonly<{
    label: string;
    name: string;
    points: string;
    pointsToNext: string;
    progressLabel: string;
    progressPercent: number;
  }>;
  tiles: Readonly<{
    streak: Readonly<{ value: string; caption: string }>;
    freezes: Readonly<{ value: string; caption: string }>;
    badges: Readonly<{ value: string; caption: string }>;
  }>;
  categories: readonly OverviewCategory[];
}>;

const badgeOf = (result: AchievementResult): OverviewBadge => {
  const { id } = result;
  const state = stateOf(id, result);
  const progressText =
    state === "locked" && !result.earned
      ? describeProgress(definitionOf(id).rule, result.progress.current, result.progress.target)
      : null;
  return {
    id,
    state,
    name: state === "hidden" ? ACHIEVEMENTS_SCREEN.hiddenBadge.name : ACHIEVEMENT_COPY[id].name,
    caption: state === "earned" ? ACHIEVEMENT_TIER_NAMES[achievementTierOf(id)] : null,
    progressText,
    progressPercent:
      state === "locked" && !result.earned
        ? percentOf(result.progress.current, result.progress.target)
        : null,
    label: achievementBadgeLabel({ id, state, progress: progressText ?? undefined }),
  };
};

/** Everything the Achievements screen shows, from the engine's results. */
export const achievementsOverview = ({
  results,
  level,
  streakDays,
  freezes,
}: AchievementsOverviewInput): AchievementsOverview => {
  const badgeById = new Map(results.map((result) => [result.id, badgeOf(result)]));
  const categories = ACHIEVEMENT_CATEGORIES.map((category): OverviewCategory => {
    const badges = ACHIEVEMENTS.filter((achievement) => achievement.category === category).flatMap(
      ({ id }) => badgeById.get(id) ?? [],
    );
    return {
      category,
      title: ACHIEVEMENT_CATEGORY_NAMES[category],
      countText: describeCategoryCount(
        badges.filter(({ state }) => state === "earned").length,
        badges.length,
      ),
      badges,
    };
  });
  const earnedCount = results.filter(({ earned }) => earned).length;
  const nextLevel = level.level + 1;

  return {
    level: {
      label: describeLevelLabel(level.level),
      name: level.name,
      points: describeLevelPoints(level.totalPoints),
      pointsToNext: describePointsToNextLevel(
        level.progress.target - level.progress.current,
        nextLevel,
      ),
      progressLabel: describeNextLevelProgressLabel(nextLevel),
      progressPercent: percentOf(level.progress.current, level.progress.target),
    },
    tiles: {
      streak: { value: String(streakDays), caption: ACHIEVEMENTS_SCREEN.streakCaption },
      freezes: { value: String(freezes), caption: describeFreezeCaption(freezes) },
      badges: { value: String(earnedCount), caption: describeBadgeCount(ACHIEVEMENTS.length) },
    },
    categories,
  };
};

export type BadgeDetailInput = Readonly<{
  id: AchievementId;
  result: AchievementResult;
  /** The calendar day the badge was earned in the person's time zone, or null when it is not known. */
  earnedOn: string | null;
}>;

/** How the sheet's pill is coloured: by the badge's tier, and plain for a hidden badge so no tier is given away. */
export type BadgePillStyle = AchievementTier | "hidden";

export type BadgeDetail = Readonly<{
  id: AchievementId;
  state: BadgeState;
  pillStyle: BadgePillStyle;
  /** The tier and the category, such as "Silver · Daily streaks". A hidden badge gives only its category. */
  pill: string;
  title: string;
  /** The sheet's accessible name: "Fortnight badge", "Month Strong badge, locked" or "Hidden badge". */
  sheetLabel: string;
  description: string;
  progress: Readonly<{ percent: number; text: string; remainingText: string }> | null;
  facts: readonly Readonly<{ label: string; value: string }>[];
}>;

/** What the badge detail sheet shows for one badge. A hidden badge keeps its secret. */
export const badgeDetail = ({ id, result, earnedOn }: BadgeDetailInput): BadgeDetail => {
  const definition = definitionOf(id);
  const state = stateOf(id, result);
  const category = ACHIEVEMENT_CATEGORY_NAMES[definition.category];
  const { detail } = ACHIEVEMENTS_SCREEN;

  if (state === "hidden") {
    return {
      id,
      state,
      pillStyle: "hidden",
      pill: category,
      title: ACHIEVEMENTS_SCREEN.hiddenBadge.title,
      sheetLabel: HIDDEN_BADGE_LABEL,
      description: ACHIEVEMENTS_SCREEN.hiddenBadge.body,
      progress: null,
      facts: [],
    };
  }

  const points = TIER_POINTS[definition.tier];
  const freezes = freezesForBadge(definition);
  const base = {
    id,
    state,
    pillStyle: definition.tier,
    pill: `${ACHIEVEMENT_TIER_NAMES[definition.tier]} · ${category}`,
    title: ACHIEVEMENT_COPY[id].name,
    sheetLabel: `${ACHIEVEMENT_COPY[id].name} badge${state === "locked" ? ", locked" : ""}`,
    description: upperFirst(ACHIEVEMENT_COPY[id].earnedBy),
  };

  if (result.earned) {
    return {
      ...base,
      progress: null,
      facts: [
        ...(earnedOn === null ? [] : [{ label: detail.earned, value: describeEarnedOn(earnedOn) }]),
        { label: detail.points, value: describePointsEarned(points) },
      ],
    };
  }

  const { current, target } = result.progress;
  return {
    ...base,
    progress: {
      percent: percentOf(current, target),
      text: describeProgress(definition.rule, current, target),
      remainingText: describeToGo(target - current),
    },
    facts: [
      { label: detail.worth, value: describePointsWorth(points) },
      ...(freezes === 0 ? [] : [{ label: detail.bonus, value: describeFreezeBonus(freezes) }]),
    ],
  };
};

export type BadgeDetailReadInput = Readonly<{
  /** The id the address names, which may be anything. */
  id: string | undefined;
  /** The engine's results, or undefined until they are read. */
  results: readonly AchievementResult[] | undefined;
  /** The held rows, with when each was unlocked. */
  held: readonly Readonly<{ id: string; unlockedAt: string }>[] | undefined;
  isFailed: boolean;
  /** The person's profile time zone, null or undefined while it is not set or not read yet. */
  timeZone: string | null | undefined;
  /** The phone's own time zone, which dates the badge until the profile's is known. */
  deviceTimeZone: string;
}>;

export type BadgeDetailRead =
  | Readonly<{ status: "loading" }>
  | Readonly<{ status: "unavailable" }>
  | Readonly<{ status: "ready"; detail: BadgeDetail }>;

/**
 * What the detail sheet of one badge can show yet. An id the catalogue does not know, or a read that failed,
 * leaves nothing to show, and a read still on its way is loading. The day a badge was earned is in the
 * profile's time zone, or the phone's until that is known. Pure.
 */
export const resolveBadgeDetail = ({
  id,
  results,
  held,
  isFailed,
  timeZone,
  deviceTimeZone,
}: BadgeDetailReadInput): BadgeDetailRead => {
  const knownId = ACHIEVEMENTS.find((achievement) => achievement.id === id)?.id;
  if (knownId === undefined) {
    return { status: "unavailable" };
  }
  if (results === undefined) {
    return isFailed ? { status: "unavailable" } : { status: "loading" };
  }
  const result = results.find((progress) => progress.id === knownId);
  if (result === undefined) {
    return { status: "unavailable" };
  }
  const unlockedAt = held?.find((row) => row.id === knownId)?.unlockedAt;
  const earnedOn =
    unlockedAt === undefined ? null : toLocalDate(new Date(unlockedAt), timeZone ?? deviceTimeZone);

  return { status: "ready", detail: badgeDetail({ id: knownId, result, earnedOn }) };
};
