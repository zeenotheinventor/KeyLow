import type { ProgressBar } from "@keylow/core/diary";

export type MacroProgressStripProps = {
  /** The four bars from core's `progressBars`: calories, then protein, carbs and fat. */
  bars: readonly ProgressBar[];
  /**
   * The screen's route to Targets. With it the whole strip is one button. Without it the strip is a
   * status group that only tells, which is how the log search shows it (leaving for Targets would drop the plate).
   */
  onPress?: () => void;
  /** The first words of the strip's name, before the four values. The diary's is "Targets". */
  label?: string;
  /**
   * What the strip sits on. "page" is the diary's and the search's own strip, with its padding and the
   * outline's gap in the background colour. "card" sits inside a card that has the padding and the
   * surface colour, so it has no padding and the gap is the surface colour.
   */
  surface?: "page" | "card";
};
