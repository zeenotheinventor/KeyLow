export type SparklineTone = "neutral" | "positive" | "negative";

export type SparklineProps = {
  /** One value for each week, oldest first. A `null` is a skipped week: the line breaks there and the week has no point. */
  points: readonly (number | null)[];
  /** What a screen reader says for the line, such as "Barbell row, up 5 kg in 8 weeks". */
  label: string;
  /** Hides the line from screen readers, for a row whose own text already says what it shows. Defaults to false. */
  decorative?: boolean;
  /**
   * The colour the row gives the line: neutral is the chart's own, positive is the success green and negative
   * the danger red. The direction is never carried by colour alone. Defaults to neutral.
   */
  tone?: SparklineTone;
};
