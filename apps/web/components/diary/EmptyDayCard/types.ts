export type EmptyDayCardProps = {
  /** The app can reach the server. Offline, the button is dimmed and does not copy. */
  isOnline: boolean;
  /** Yesterday has nothing to copy: the button is dimmed and the card says why. */
  isYesterdayEmpty: boolean;
  /** A copy is on its way. */
  isCopying: boolean;
  /** The last copy failed: the card says so. */
  hasCopyFailed: boolean;
  onCopyYesterday: () => void;
};
