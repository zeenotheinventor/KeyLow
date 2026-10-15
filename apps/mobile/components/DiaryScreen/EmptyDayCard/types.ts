export type EmptyDayCardProps = {
  /** Yesterday has nothing to copy: the button is dimmed and a caption says why. */
  isYesterdayEmpty: boolean;
  /** Offline, the button is dimmed and does not respond, because a copy could not be saved. */
  isOnline: boolean;
  /** A copy is under way: the button shows a spinner and does not respond. */
  isCopying: boolean;
  /** Copies yesterday's whole day onto the day on view. */
  onCopyYesterday: () => void;
};
