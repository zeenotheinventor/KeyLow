import { ACHIEVEMENT_COPY } from "./achievements";
import { achievementTierOf } from "../achievements/art";

import type { BadgeState } from "../achievements/art";
import type { AchievementId, AchievementTier } from "../achievements/catalogue";

/*
 * What a screen reader says for a badge (KEY-1098): the name, the tier and the state, as board 8 names them.
 * A hidden badge says only that it is hidden, so neither its name nor its tier is given away.
 */

export const ACHIEVEMENT_TIER_NAMES: Readonly<Record<AchievementTier, string>> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  platinum: "Platinum",
};

export const HIDDEN_BADGE_LABEL = "Hidden badge";

export type AchievementBadgeLabelInput = Readonly<{
  id: AchievementId;
  state: BadgeState;
  /** How far a locked badge has got, in the words the screen already uses, such as "12 of 30 days". */
  progress?: string | undefined;
}>;

export function achievementBadgeLabel({ id, state, progress }: AchievementBadgeLabelInput): string {
  if (state === "hidden") {
    return HIDDEN_BADGE_LABEL;
  }
  const tier = achievementTierOf(id);
  const named = `${ACHIEVEMENT_COPY[id].name}, ${ACHIEVEMENT_TIER_NAMES[tier]}, ${state}`;
  return state === "locked" && progress !== undefined ? `${named}, ${progress}` : named;
}
