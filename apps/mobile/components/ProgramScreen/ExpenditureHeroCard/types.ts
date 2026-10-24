import type { ExpenditureHeroView } from "../types";

/** A check-in has just arrived: the numeral counts up from the estimate before it. */
export type ExpenditureHeroArrival = {
  /** The estimate before the check-in, in kilocalories a day. */
  fromKcal: number;
};

export type ExpenditureHeroCardProps = {
  view: ExpenditureHeroView;
  /** Set on the first open after a new check-in, and null otherwise. */
  arrival: ExpenditureHeroArrival | null;
};
