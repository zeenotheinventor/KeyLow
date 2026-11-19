import { achievementTierOf } from "./art";
import { ACHIEVEMENT_TIERS } from "./catalogue";
import { TIER_POINTS } from "./points";
import {
  describeFreezeChip,
  describeGroupedToastBody,
  describeGroupedToastTitle,
  describeMomentBody,
  describeMomentLabel,
  describeMomentOthers,
  describeLevelChip,
  describeMomentTierLabel,
  describePoints,
  describeSingleToastBody,
  describeSingleToastTitle,
} from "../copy/achievementCelebrations";
import { ACHIEVEMENT_COPY } from "../copy/achievements";

import type { AchievementId, AchievementTier } from "./catalogue";
import type { CelebrationEntry, CelebrationExtras } from "./celebrations";

/** A small pill under the words: what the points, a freeze or a new level came to. */
export type CelebrationChip = Readonly<{ kind: "points" | "freeze" | "level"; label: string }>;

/** Everything one drain shows, as words. The toast and the moment only draw it. */
export type CelebrationSummary = Readonly<{
  kind: "toast" | "moment";
  /** The badge the medal shows, and the one View opens. */
  leadId: AchievementId;
  /** The tier of the lead badge. */
  leadTier: AchievementTier;
  /** Every badge in the drain, all of them acknowledged and marked seen once this is shown. */
  ids: AchievementId[];
  title: string;
  body: string;
  chips: CelebrationChip[];
  /** The moment's eyebrow, such as "GOLD BADGE". Null on a toast. */
  tierLabel: string | null;
  /** The moment's line for the other badges of the drain, such as "and 2 more badges". Null when there are none. */
  othersLine: string | null;
  /** Names the moment for a screen reader. Null on a toast. */
  dialogLabel: string | null;
}>;

export type CelebrationSummaryInput = Readonly<{
  /** Everything waiting in the queue, which one celebration takes all of. */
  entries: readonly CelebrationEntry[];
  /** The freezes and the level the run that recorded these badges came with, if any. */
  extras: CelebrationExtras | null;
}>;

const tierRank = (id: AchievementId): number => ACHIEVEMENT_TIERS.indexOf(achievementTierOf(id));

/** The highest tier of the ids, the earliest one on a tie. */
const highestOf = (ids: readonly AchievementId[]): AchievementId | undefined =>
  ids.reduce<AchievementId | undefined>(
    (best, id) => (best === undefined || tierRank(id) > tierRank(best) ? id : best),
    undefined,
  );

const MOMENT_TIERS: readonly AchievementTier[] = ["gold", "platinum"];

const chipsOf = (extras: CelebrationExtras | null): CelebrationChip[] => [
  ...(extras === null || extras.freezes === 0
    ? []
    : [{ kind: "freeze" as const, label: describeFreezeChip(extras.freezes) }]),
  ...(extras?.levelName == null
    ? []
    : [{ kind: "level" as const, label: describeLevelChip(extras.levelName) }]),
];

/**
 * What one drain of the celebration queue shows: exactly one celebration for every waiting entry, never a
 * burst. The big moment is only for a Gold or Platinum that this device's own run recorded (`isNew`), the
 * highest of them, with the rest of the drain in one line under it. Everything else is one toast, single for
 * one badge and grouped for several, and its View opens the highest tier badge. A badge held from before,
 * earned on another device or the web or before this shipped, never leads the moment. Null when nothing is
 * waiting. Pure.
 */
export const summariseCelebrations = ({
  entries,
  extras,
}: CelebrationSummaryInput): CelebrationSummary | null => {
  const ids = entries.map(({ id }) => id);
  const points = ids.reduce((sum, id) => sum + TIER_POINTS[achievementTierOf(id)], 0);
  const chips = chipsOf(extras);
  const momentId = highestOf(
    entries
      .filter(({ id, isNew }) => isNew && MOMENT_TIERS.includes(achievementTierOf(id)))
      .map(({ id }) => id),
  );

  if (momentId !== undefined) {
    const tier = achievementTierOf(momentId);
    const otherCount = ids.length - 1;
    return {
      kind: "moment",
      leadId: momentId,
      leadTier: tier,
      ids,
      title: ACHIEVEMENT_COPY[momentId].name,
      body: describeMomentBody(momentId),
      chips: [{ kind: "points", label: describePoints(points) }, ...chips],
      tierLabel: describeMomentTierLabel(tier),
      othersLine: otherCount === 0 ? null : describeMomentOthers(otherCount),
      dialogLabel: describeMomentLabel(momentId, tier),
    };
  }

  const leadId = highestOf(ids);
  if (leadId === undefined) {
    return null;
  }
  const isSingle = ids.length === 1;
  return {
    kind: "toast",
    leadId,
    leadTier: achievementTierOf(leadId),
    ids,
    title: isSingle ? describeSingleToastTitle(leadId) : describeGroupedToastTitle(ids.length),
    body: isSingle
      ? describeSingleToastBody(leadId, points)
      : describeGroupedToastBody(ids, points),
    chips,
    tierLabel: null,
    othersLine: null,
    dialogLabel: null,
  };
};
