import { servingPortion } from "./offRules";
import { packPortion } from "./packPortion";

import type { OffPortionInput } from "./offRules";
import type { NutrientBasis } from "../schemas/food";

// A pack within this share of the serving is the same amount, so it is not offered twice ("1 bar (45 g)").
// A pack with the same words as the serving ("1 can") would be two chips that read the same.
const SAME_AMOUNT_SHARE = 0.01;

function amountOf(portion: OffPortionInput): number {
  return portion.grams ?? portion.ml ?? 0;
}

function repeatsServing(serving: OffPortionInput, pack: OffPortionInput): boolean {
  const sameAmount =
    Math.abs(amountOf(serving) - amountOf(pack)) <= amountOf(pack) * SAME_AMOUNT_SHARE;
  return sameAmount || serving.label.toLowerCase() === pack.label.toLowerCase();
}

/**
 * The portions of an OFF product: the serving (the default) then the whole pack, in that order. The pack
 * is left out when it cannot be read or when the serving is the same amount or has the same label. The serving is the only
 * portion that can be the default, because `store_off_product` refuses a second one.
 */
export function deriveOffPortions(input: {
  servingSize: string | undefined;
  servingQuantity: number | undefined;
  quantity: string | undefined;
  basis: NutrientBasis;
  packagingTags: readonly string[] | undefined;
  categoriesTags: readonly string[] | undefined;
}): OffPortionInput[] {
  const serving = servingPortion({
    servingSize: input.servingSize,
    servingQuantity: input.servingQuantity,
    basis: input.basis,
  });
  const pack = packPortion(input);
  const offeredPack =
    pack === null || (serving !== null && repeatsServing(serving, pack)) ? null : pack;
  const portions: OffPortionInput[] = [];
  if (serving !== null) {
    portions.push(serving);
  }
  if (offeredPack !== null) {
    portions.push(offeredPack);
  }
  return portions;
}
