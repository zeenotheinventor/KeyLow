import type { MacroProgressStripSurface } from "../types";
import type { ProgressBar } from "@keylow/core/diary";

export type ProgressColumnProps = {
  bar: ProgressBar;
  /** What the strip sits on, for the over-target outline's gap. */
  surface: MacroProgressStripSurface;
};
