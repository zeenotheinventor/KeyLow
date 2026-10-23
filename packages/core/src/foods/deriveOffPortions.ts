import { naturalUnitsFor } from "./naturalUnits";
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
 * The portions of an OFF product, in this order: the serving, the whole pack, then the natural units the
 * product borrows (`naturalUnitsFor`). The pack is left out when it cannot be read or when the serving is
 * the same amount or has the same label. A borrowed unit is left out when its label is already on the list,
 * ignoring case.
 *
 * The serving is the default when there is one. Without a serving the borrowed entry's cited default is
 * the default (an egg box opens on "1 large"). The pack is never the default. There is at most one default,
 * because `store_off_product` refuses a second one.
 */
export function deriveOffPortions(input: {
  servingSize: string | undefined;
  servingQuantity: number | undefined;
  quantity: string | undefined;
  basis: NutrientBasis;
  packagingTags: readonly string[] | undefined;
  categoriesTags: readonly string[] | undefined;
  /** Energy in kcal per 100 g (or per 100 ml) as resolved from the nutrients, or null when unknown. */
  kcal: number | null;
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
  const servingIsDefault = serving !== null;
  const borrowed = naturalUnitsFor({
    categoriesTags: input.categoriesTags,
    basis: input.basis,
    kcal: input.kcal,
  });
  const taken = new Set(portions.map((portion) => portion.label.toLowerCase()));
  for (const unit of borrowed) {
    if (!taken.has(unit.label.toLowerCase())) {
      portions.push({
        label: unit.label,
        grams: unit.grams,
        ml: null,
        isDefault: unit.isDefault && !servingIsDefault,
      });
    }
  }
  return portions;
}
