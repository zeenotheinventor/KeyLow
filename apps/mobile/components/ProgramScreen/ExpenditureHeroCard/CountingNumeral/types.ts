import type { ExpenditureHeroArrival } from "../types";

export type CountingNumeralProps = {
  /** The estimate in kilocalories a day, which the numeral shows when it is done. */
  muKcal: number;
  /** Set when a check-in has just arrived. It is read when the numeral is mounted. */
  arrival: ExpenditureHeroArrival | null;
};
