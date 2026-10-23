export type TrendExplainerSheetProps = {
  open: boolean;
  /** Done, the dim, a drag down, the screen reader's escape or the back button. */
  onClose: () => void;
  /**
   * The accepted readings on the trend's last point while the trend is still settling, which draws the
   * warning banner and the progress bar. Leave it out for a settled trend or no weigh-ins.
   */
  settlingObservationCount?: number | undefined;
};
