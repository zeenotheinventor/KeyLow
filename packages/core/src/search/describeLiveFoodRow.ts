import { describeFoodRow } from "./describeFoodRow";
import { describeMacros } from "./describeMacros";
import { servingOfCandidate } from "./servingOfSearchHit";
import { formatCalories } from "../format/numbers";

import type { FoodRowDescription } from "./describeFoodRow";
import type { OffCandidate } from "../schemas/off";

export type LiveFoodRowDescription = FoodRowDescription & {
  /** The serving the values are for, such as "1 burger (240 g)". Left out when the row is per 100 g. */
  caption?: string;
};

const MACRO_NOT_GIVEN = "-";

/**
 * Whether a live Open Food Facts row can show the serving the product opens on: the candidate carries
 * a default portion and an energy to scale. One from a function or a stored answer that predates the
 * portion, or one with no energy, is drawn as the browse rows are.
 */
export const liveRowShowsServing = (candidate: OffCandidate): boolean =>
  candidate.default_portion != null && candidate.kcal !== null;

/**
 * What a live Open Food Facts row of the search shows. In a search that shows servings it is the
 * serving the product will open on, with its caption and values (the same `servingOfCandidate` the
 * stored food's row would draw), and otherwise, or when the candidate has no serving to show, the
 * per 100 g description of `describeFoodRow`.
 */
export function describeLiveFoodRow(
  candidate: OffCandidate,
  query: string,
  options: { showsServings: boolean },
): LiveFoodRowDescription {
  const perHundred = describeFoodRow(candidate, query);
  if (!options.showsServings || !liveRowShowsServing(candidate)) {
    return perHundred;
  }

  const serving = servingOfCandidate(candidate);
  const macros = describeMacros(serving);
  return {
    nameSegments: perHundred.nameSegments,
    ...(candidate.brand === null ? {} : { brand: candidate.brand }),
    caption: serving.caption,
    ...(serving.kcal === null ? {} : { energy: formatCalories(serving.kcal) }),
    macros: {
      protein: macros.protein ?? MACRO_NOT_GIVEN,
      carbs: macros.carbs ?? MACRO_NOT_GIVEN,
      fat: macros.fat ?? MACRO_NOT_GIVEN,
      description: macros.accessibleDescription,
    },
  };
}
