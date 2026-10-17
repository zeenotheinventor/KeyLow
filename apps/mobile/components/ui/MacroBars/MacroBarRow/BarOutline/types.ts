import type { MacroName } from "../types";

export type BarOutlineProps = {
  /** The bar's colour: a macro, or `calories` for the bar that is not a macro's, such as the dashboard's week average. */
  macro: MacroName | "calories";
};
