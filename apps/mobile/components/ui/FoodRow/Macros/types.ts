import type { FoodRowMacros } from "../types";

export type MacrosProps = {
  macros: FoodRowMacros;
  /** What the macros are per, when it is not 100 g. */
  basis?: string | undefined;
};
