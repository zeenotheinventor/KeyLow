export type CountingNumeralProps = {
  /** The figure in whole kilocalories the numeral ends on. */
  value: number;
  /**
   * Where the count starts from, read when the numeral is mounted so a later draw never makes it jump back. Null
   * means nothing arrived: the figure is shown as it is and nothing moves.
   */
  from: number | null;
  /** The numeral's size and weight, which the screen sets from its board. */
  className: string;
};
