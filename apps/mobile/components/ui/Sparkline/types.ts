export type SparklineTone = "neutral" | "positive" | "negative";

/** `default` is 64 by 20 points and `wide` is 128 by 40. */
export type SparklineSize = "default" | "wide";

export type SparklineProps = {
  /**
   * One value for each week, oldest first. A `null` is a skipped week: the line breaks there and the week has no point.
   * A series of days works the same way, and padding its front with `null` for the days before the first reading places
   * the line by date and does not stretch it across the width.
   */
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
  /**
   * `wide` is 128 by 40 points with a 4 point inset, a 2 point line and a 3.5 point dot ringed in the surface
   * colour, as a card with a labelled value draws it. Defaults to `default`.
   */
  size?: SparklineSize;
};
