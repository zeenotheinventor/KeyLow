import type { CelebrationSummary } from "@keylow/core";

export type AchievementMomentProps = {
  /** A summary of the `moment` kind: the tier, the lead badge and the words. */
  summary: CelebrationSummary;
  /** "Nice one". */
  onDismiss: () => void;
  /** "See all achievements". */
  onSeeAll: () => void;
};
