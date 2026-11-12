import type { ProgressBar } from "@keylow/core/diary";

/** What a strip sits on, which is where its over-target outline takes its gap colour from. */
export type MacroProgressStripSurface = "page" | "sheet" | "card";

export type MacroProgressStripProps = {
  /** The four bars from core's `progressBars`: calories, then protein, carbs and fat, with the plate's share when there is a plate. */
  bars: readonly ProgressBar[];
  /**
   * The screen's route to Targets. With it the whole strip is one button. Without it the strip is a status
   * group that only tells, which is how the add dialog shows it (leaving for Targets would drop the plate).
   */
  onPress?: (() => void) | undefined;
  /** The first words of the strip's name, before the four values: "Targets" by default, or `describeStripDay` in the add dialog. */
  label?: string | undefined;
  /**
   * What the strip sits on. "page" is the diary's own strip, with the outline's gap in the background colour.
   * "sheet" sits in a dialog and takes the sheet's surface colour. "card" sits inside a card, takes the card's
   * surface colour and sizes its columns to their numbers, two by two below 1024 px, where the plate is a
   * step of the dialog and four columns would collide at 375.
   */
  surface?: MacroProgressStripSurface | undefined;
  className?: string | undefined;
};
