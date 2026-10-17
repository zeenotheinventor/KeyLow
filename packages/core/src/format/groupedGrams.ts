import { formatGrams, groupThousands } from "./numbers";

/**
 * Grams as `formatGrams` writes them, with a thousands separator from 1,000, so a recipe's cooked weight
 * reads `1,100 g`. `formatGrams` stays without one, because a number typed into an amount field must not
 * gain a comma.
 */
export const formatGroupedGrams = (grams: number): string => groupThousands(formatGrams(grams));
