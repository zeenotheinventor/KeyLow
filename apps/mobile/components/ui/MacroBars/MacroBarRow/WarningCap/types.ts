import type { MacroName } from "../types";

export type WarningCapProps = {
  macro: MacroName;
  /** How much of the bar the cap covers, from 0 to 0.35. */
  capFraction: number;
  /** The bar's height, which is also the stripes' length. */
  barHeight: number;
};
