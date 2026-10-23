export type ProgressBarProps = {
  /** The accessible name, as a screen reader says it. The bar has no visible text. */
  label: string;
  /**
   * How far along it is, as a percentage from 0 to 100. A value outside that range is held to it, and
   * a fraction is rounded to a whole percentage. Without a value the bar is indeterminate: a segment sweeps
   * across the track, and the bar says no value.
   */
  value?: number | undefined;
};
