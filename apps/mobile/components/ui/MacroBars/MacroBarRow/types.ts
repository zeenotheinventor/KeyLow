import type { MacroAmount } from "../types";

export type MacroName = "protein" | "carbs" | "fat";

export type MacroBarRowProps = MacroAmount & {
  macro: MacroName;
  /** Its place in the stagger, so the bars whip in one after another. */
  index: number;
  compact: boolean;
};
