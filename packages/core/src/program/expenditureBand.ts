import type { ExpenditureBelief } from "../engine";

/**
 * The z of an 80% range of a normal belief: 10% of the belief lies below `mu - z * sd` and 10% above
 * `mu + z * sd` (ADR 0002, Amendment 2, Q6).
 */
const BAND_Z_80_PERCENT = 1.2816;

const DISPLAY_STEP_KCAL = 10;

export type ExpenditureBand = Readonly<{
  /** The belief's mean, unrounded: the screens show it in whole kilocalories. */
  muKcal: number;
  /** The low end of the likely range, rounded to the nearest 10. */
  lowKcal: number;
  /** The high end of the likely range, rounded to the nearest 10. */
  highKcal: number;
}>;

const roundToDisplayStep = (kcal: number): number =>
  Math.round(kcal / DISPLAY_STEP_KCAL) * DISPLAY_STEP_KCAL;

/**
 * The likely range of the expenditure estimate: `mu` plus or minus 1.2816 standard deviations. Only
 * the two ends of the range are rounded, to 10, and only for display. Pass any snapshot or belief.
 */
export function expenditureBand({ muKcal, varKcal2 }: ExpenditureBelief): ExpenditureBand {
  const halfWidthKcal = BAND_Z_80_PERCENT * Math.sqrt(varKcal2);
  return {
    muKcal,
    lowKcal: roundToDisplayStep(muKcal - halfWidthKcal),
    highKcal: roundToDisplayStep(muKcal + halfWidthKcal),
  };
}
