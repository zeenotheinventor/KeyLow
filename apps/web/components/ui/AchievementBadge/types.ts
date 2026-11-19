import type { AchievementId, BadgeState } from "@keylow/core";

export type AchievementBadgeProps = {
  id: AchievementId;
  /** Defaults to `earned`. A hidden badge is a grey plain ring with "???", whatever the badge's tier. */
  state?: BadgeState;
  /** The width and height in pixels. The drawing is the same at any size, from a 64 by 64 view box. */
  size: number;
  /** How far a locked badge has got, in the words the screen already uses, such as "12 of 30 days". */
  progress?: string;
  /** Hides the badge from assistive technology, for a row whose own text already names it. Defaults to false. */
  decorative?: boolean;
};
