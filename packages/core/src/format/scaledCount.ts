import { groupThousands } from "./numbers";

/**
 * A count of servings, portions or spoons: rounded to 2 decimals, trailing zeros dropped, a thousands
 * separator from 1,000. `formatGrams` keeps one decimal under 10, so it would write a quarter (0.25) as 0.3.
 */
export const formatScaledCount = (count: number): string => {
  const [whole = "", fraction] = String(Math.round(count * 100) / 100).split(".");

  return fraction === undefined ? groupThousands(whole) : `${groupThousands(whole)}.${fraction}`;
};
