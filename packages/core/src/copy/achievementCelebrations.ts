import { ACHIEVEMENT_COPY } from "./achievements";
import { joinInWords } from "./bodyMap";

import type { AchievementId, AchievementTier } from "../achievements/catalogue";

/*
 * The words of the unlock toast and the Gold and Platinum moment (KEY-1088), as board 3 of
 * `docs/design/achievements/` has them. Badge names and their "earn it by" lines stay in `achievements.ts`.
 */

export const ACHIEVEMENT_CELEBRATION = {
  viewAction: "View",
  momentDismiss: "Nice one",
  momentSeeAll: "See all achievements",
} as const;

/** How many badge names the grouped toast lists before it counts the rest. */
export const NAMES_BEFORE_COUNT = 3;

const upperFirst = (text: string): string => `${text.charAt(0).toUpperCase()}${text.slice(1)}`;

const badgeWord = (count: number): string => (count === 1 ? "badge" : "badges");

export const describePoints = (points: number): string => `+${points} points`;

export const describeFreezeChip = (count: number): string =>
  count === 1 ? "+1 freeze" : `+${count} freezes`;

export const describeLevelChip = (levelName: string): string => `You reached ${levelName}`;

export const describeSingleToastTitle = (id: AchievementId): string =>
  `Badge earned: ${ACHIEVEMENT_COPY[id].name}`;

export const describeSingleToastBody = (id: AchievementId, points: number): string =>
  `${upperFirst(ACHIEVEMENT_COPY[id].earnedBy)}. ${describePoints(points)}`;

export const describeGroupedToastTitle = (count: number): string => `${count} badges earned`;

/** Up to three names as a sentence lists them, then the rest as a count: "A, B, C and 11 more". */
export const describeGroupedToastBody = (ids: readonly AchievementId[], points: number): string => {
  const names = ids.map((id) => ACHIEVEMENT_COPY[id].name);
  const shown = names.slice(0, NAMES_BEFORE_COUNT);
  const hiddenCount = names.length - shown.length;
  const namesLine =
    hiddenCount > 0 ? `${shown.join(", ")} and ${hiddenCount} more` : joinInWords(shown);
  return `${namesLine}. ${describePoints(points)}`;
};

export const describeMomentTierLabel = (tier: AchievementTier): string =>
  `${tier.toUpperCase()} BADGE`;

export const describeMomentBody = (id: AchievementId): string =>
  `${upperFirst(ACHIEVEMENT_COPY[id].earnedBy)}.`;

export const describeMomentOthers = (count: number): string =>
  `and ${count} more ${badgeWord(count)}`;

export const describeMomentLabel = (id: AchievementId, tier: AchievementTier): string =>
  `${upperFirst(tier)} badge earned, ${ACHIEVEMENT_COPY[id].name}`;
