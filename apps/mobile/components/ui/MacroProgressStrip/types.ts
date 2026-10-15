import type { ProgressBar } from "@keylow/core/diary";

export type MacroProgressStripProps = {
  /** The four bars from core's `progressBars`: calories, then protein, carbs and fat. */
  bars: readonly ProgressBar[];
  /** The screen's route to Targets. The whole strip is one button. */
  onPress: () => void;
};
