export type UpdateScreenProps = {
  /**
   * How much of the update has downloaded, from 0 to 1. Without it, or while it is 0, the bar is
   * indeterminate, as a build that reports no progress would leave it.
   */
  progress?: number | undefined;
  /** Called when the screen has been laid out, which is when the native splash screen can be let go. */
  onLayout?: () => void;
};
