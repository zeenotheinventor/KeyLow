import type { ExpenditureHeroArrival } from "../types";

export type CountingNumeralProps = {
  /** The estimate in kilocalories a day, which the numeral ends on. */
  muKcal: number;
  /** Set on the first open after a new check-in, and null otherwise. */
  arrival: ExpenditureHeroArrival | null;
};
