export type BackfillCardProps = {
  /** How many badges were earned before the screen existed. */
  badgeCount: number;
  /** The level their points reached. */
  level: number;
  onSeeBadges: () => void;
  onDismiss: () => void;
};
