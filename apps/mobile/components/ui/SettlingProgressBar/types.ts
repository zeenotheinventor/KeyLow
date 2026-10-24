export type SettlingProgressBarProps = {
  /** What is counted, such as "Days with a weigh-in". It is written above the bar, and names it unless `name` is given. */
  label: string;
  /**
   * The words the bar's name starts with, when the label written above it is too long to hear before the count,
   * such as "Days your weigh-ins cover" for the label "Days your weigh-ins cover, first to last". Defaults to the label.
   */
  name?: string;
  /** How many there are so far. Below nothing holds the bar empty, and past the target holds it full. */
  count: number;
  /** How many make the bar full. */
  target: number;
  /**
   * Writes the label and "4 of 8" above the track, and names the bar "Days with a weigh-in, 4 of 8".
   * Defaults to true. A caller whose own words already say the count passes false, and the track stands
   * alone, named by the label.
   */
  hasCaption?: boolean;
};
