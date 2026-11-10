import { estimatedPortion } from "./estimatedPortion";
import { naturalUnitsFor } from "./naturalUnits";
import { servingPortion } from "./offRules";
import { GENERIC_PACK_NOUN, portionOfPack, readPackDetails } from "./packPortion";

import type { OffPortionInput } from "./offRules";
import type { PackDetails } from "./packPortion";
import type { NutrientBasis } from "../schemas/food";

// A pack within this share of the serving is the same amount, so it is not offered twice ("1 bar (45 g)").
// A pack with the same words as the serving ("1 can") would be two chips that read the same.
const SAME_AMOUNT_SHARE = 0.01;

// Heuristic, retune here. A serving of exactly this much (g or ml) is how Open Food Facts records "no
// real serving": in a 2026-11-10 sample of 393 UK products, 69 of 297 servings were exactly 100, mostly
// "1 serving (100 g)" on jam, crisps and spreads.
const PLACEHOLDER_SERVING_AMOUNT = 100;

// Heuristic, retune here. A pack opens as the default only when it is plausibly one thing eaten by one
// person: at most this much, at most this much energy, and a small item when the food is energy dense.
// That keeps sharing bags of crisps, 200 g chocolate bars and bags of nuts off the default.
const MAX_ITEM_GRAMS = 450;
const MAX_ITEM_MILLILITRES = 500;
const MAX_ITEM_KCAL = 700;
const ENERGY_DENSE_KCAL_PER_100 = 400;
const MAX_ENERGY_DENSE_ITEM_AMOUNT = 100;

// OFF category tags whose products are used a spoonful at a time, so their pack is never one serving.
// Each was checked against the OFF categories taxonomy on 2026-11-10.
const NEVER_A_SINGLE_ITEM_TAGS: ReadonlySet<string> = new Set([
  "en:condiments",
  "en:sauces",
  "en:spreads",
  "en:jams",
  "en:honeys",
  "en:spices",
  "en:herbs",
  "en:condiment-pastes",
  "en:vinegars",
  "en:fats",
  "en:vegetable-oils",
  "en:teas",
  "en:coffees",
  "en:sugars",
  "en:sweeteners",
  "en:salts",
  "en:cooking-helpers",
  "en:flours",
]);

// A serving that is only a measure ("240 g", "30g", "5 oz"): it says nothing a person would call the food.
const MEASURE_ONLY =
  /^~?\s*\d+(?:[.,]\d+)?\s*(?:kgs?|mgs?|g|gr|grm|grs|grms|gm|gms|grams?|grammes?|ml|mls|cl|dl|l|ltr|litres?|liters?|oz|fl\.?\s?oz)\.?\s*$/i;

const SERVING_WORD = "1 serving";

function amountOf(portion: OffPortionInput): number {
  return portion.grams ?? portion.ml ?? 0;
}

function isSameAmount(first: OffPortionInput, second: OffPortionInput): boolean {
  return Math.abs(amountOf(first) - amountOf(second)) <= amountOf(second) * SAME_AMOUNT_SHARE;
}

function repeatsServing(serving: OffPortionInput, pack: OffPortionInput): boolean {
  return isSameAmount(serving, pack) || serving.label.toLowerCase() === pack.label.toLowerCase();
}

// A serving of exactly 100 g or ml is the placeholder OFF uses, so it is not a serving at all.
function realServing(input: {
  servingSize: string | undefined;
  servingQuantity: number | undefined;
  basis: NutrientBasis;
}): OffPortionInput | null {
  const serving = servingPortion(input);
  return serving !== null && amountOf(serving) === PLACEHOLDER_SERVING_AMOUNT ? null : serving;
}

// A serving labelled only with a measure reads as words: the pack's noun when the pack is the same amount
// and has a real noun ("1 burger"), else "1 serving". The size still shows in the caption.
function wordedServing(
  serving: OffPortionInput,
  pack: { portion: OffPortionInput; details: PackDetails } | null,
): OffPortionInput {
  if (!MEASURE_ONLY.test(serving.label)) {
    return serving;
  }
  const namesTheServing =
    pack !== null && !pack.details.isGenericNoun && isSameAmount(serving, pack.portion);
  return { ...serving, label: namesTheServing ? pack.portion.label : SERVING_WORD };
}

function isSingleItem(
  details: PackDetails,
  input: { kcal: number | null; categoriesTags: readonly string[] | undefined },
): boolean {
  const { itemAmount, unit } = details.size;
  const { kcal } = input;
  if (
    kcal === null ||
    (input.categoriesTags ?? []).some((tag) => NEVER_A_SINGLE_ITEM_TAGS.has(tag))
  ) {
    return false;
  }
  const fitsTheLimit = itemAmount <= (unit === "g" ? MAX_ITEM_GRAMS : MAX_ITEM_MILLILITRES);
  const itemKcal = (kcal * itemAmount) / 100;
  const isSmallEnough =
    kcal < ENERGY_DENSE_KCAL_PER_100 || itemAmount <= MAX_ENERGY_DENSE_ITEM_AMOUNT;
  return fitsTheLimit && itemKcal <= MAX_ITEM_KCAL && isSmallEnough;
}

/**
 * The portions of an OFF product, with exactly one default, always. The default is the first of these
 * that applies:
 *
 * 1. The product's own serving. A serving of exactly 100 g or ml counts as none, and one labelled only
 *    with a measure reads as words ("1 burger", else "1 serving").
 * 2. A single-item pack: one item of at most 450 g or 500 ml and 700 kcal, at most 100 g or ml when the
 *    food is 400 kcal per 100 or more, with energy known, no borrowed natural unit and none of the
 *    spoonful-at-a-time category tags. A default pack with no noun of its own reads "1 serving".
 * 3. A cited natural unit the product borrows (`naturalUnitsFor`).
 * 4. An estimate (`estimatedPortion`), so the list is never empty.
 *
 * The other portions stay as chips: the pack (left out when the serving is the same amount or has the
 * same label) and any borrowed units, in that order after the serving. An estimate comes first. A borrowed
 * unit is left out when its label is already on the list, ignoring case. There is never a second default,
 * because `store_off_product` refuses one.
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
  const borrowed = naturalUnitsFor({
    categoriesTags: input.categoriesTags,
    basis: input.basis,
    kcal: input.kcal,
  });
  const details = readPackDetails(input);
  const pack = details === null ? null : { portion: portionOfPack(details), details };
  const rawServing = realServing(input);
  const serving = rawServing === null ? null : wordedServing(rawServing, pack);
  const offeredPack =
    pack === null || (serving !== null && repeatsServing(serving, pack.portion)) ? null : pack;
  const packIsDefault =
    serving === null &&
    offeredPack !== null &&
    borrowed.length === 0 &&
    isSingleItem(offeredPack.details, input);

  const portions: OffPortionInput[] = [];
  if (serving !== null) {
    portions.push(serving);
  }
  if (offeredPack !== null) {
    portions.push(
      packIsDefault
        ? {
            ...offeredPack.portion,
            label:
              offeredPack.details.noun === GENERIC_PACK_NOUN
                ? SERVING_WORD
                : offeredPack.portion.label,
            isDefault: true,
          }
        : offeredPack.portion,
    );
  }
  const taken = new Set(portions.map((portion) => portion.label.toLowerCase()));
  const hasDefaultAlready = serving !== null || packIsDefault;
  for (const unit of borrowed) {
    if (!taken.has(unit.label.toLowerCase())) {
      portions.push({
        label: unit.label,
        grams: unit.grams,
        ml: null,
        isDefault: unit.isDefault && !hasDefaultAlready,
      });
    }
  }
  if (!portions.some((portion) => portion.isDefault)) {
    portions.unshift(
      estimatedPortion({
        basis: input.basis,
        kcal: input.kcal,
        categoriesTags: input.categoriesTags,
      }),
    );
  }
  return portions;
}
