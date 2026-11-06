import type { WeightRange } from "@keylow/core/weight";

export type BodyCompositionSectionProps = {
  /** The range chosen on the weight chart's range control, which words each card's change and sets its line. */
  range: WeightRange;
  /** Today in the profile's time zone, `YYYY-MM-DD`. */
  today: string;
  /**
   * True while the trend card draws the Composition view above the section. The section then draws only its
   * heading and the cards of the kinds that have readings, since the view draws the loading shape, the error
   * state, the quiet line for no readings and the lean mass caption, so none is drawn twice. With no card it
   * draws nothing, not even its heading. Defaults to false.
   */
  isUnderComposition?: boolean;
};
