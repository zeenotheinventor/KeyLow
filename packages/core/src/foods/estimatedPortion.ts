import type { OffPortionInput } from "./offRules";
import type { NutrientBasis } from "../schemas/food";

// Every figure in this file is an uncited editorial estimate, chosen by the tech lead for a typical
// portion. None of them comes from a source, so none may be attributed to one. They are what a food
// opens on when its data gives no serving and no natural unit, so the label always says "typical" and
// the weight is always shown as "about".

const ESTIMATE_WORD = "typical";
const ESTIMATE_LABEL_PATTERN = /^1 typical /;
/** The noun of an estimate no category row names. */
export const ESTIMATE_GENERIC_NOUN = "serving";
const GENERIC_NOUN = ESTIMATE_GENERIC_NOUN;

/** The label of an estimate for a noun: "1 typical serving". Everything that writes one goes through here. */
export function estimatedPortionLabel(noun: string): string {
  return `1 ${ESTIMATE_WORD} ${noun}`;
}

/** The estimate is labelled "1 typical <noun>", and this is the only place that tests for the word. */
export function isEstimatedPortion(label: string): boolean {
  return ESTIMATE_LABEL_PATTERN.test(label);
}

/** At or above this energy per 100 g or ml a row with a dry and a cooked size uses the dry one. */
export const ESTIMATE_DRY_KCAL_PER_100 = 250;

export type EstimateSize = number | { dry: number; cooked: number };

export type EstimateCategoryRow = {
  /** OFF category tags. Any one of them in the product's tags matches the row. */
  tags: readonly string[];
  /** CoFID food groups. Any one of them equal to the first two letters of the food's group matches. */
  groups: readonly string[];
  noun: string;
  /** In the food's own basis: grams per 100 g, millilitres per 100 ml. */
  size: EstimateSize;
};

/** First match wins, so `en:hamburgers` comes before `en:sandwiches` and a Big Mac is a burger. */
export const ESTIMATE_CATEGORY_ROWS: readonly EstimateCategoryRow[] = [
  { tags: ["en:hamburgers"], groups: ["MB"], noun: "burger", size: 200 },
  { tags: ["en:sandwiches"], groups: ["AB"], noun: "sandwich", size: 200 },
  { tags: ["en:pizzas"], groups: ["AE"], noun: GENERIC_NOUN, size: 150 },
  { tags: [], groups: ["AG"], noun: "roll", size: 60 },
  { tags: ["en:breads"], groups: ["AF"], noun: GENERIC_NOUN, size: 50 },
  { tags: ["en:biscuits"], groups: ["AM", "AK"], noun: "biscuit", size: 15 },
  { tags: ["en:breakfast-cereals"], groups: ["AI"], noun: GENERIC_NOUN, size: 40 },
  {
    tags: ["en:rices", "en:pastas"],
    groups: ["AC", "AD", "AT"],
    noun: GENERIC_NOUN,
    size: { dry: 75, cooked: 180 },
  },
  { tags: ["en:flours"], groups: ["AA"], noun: GENERIC_NOUN, size: 30 },
  { tags: [], groups: ["AN"], noun: GENERIC_NOUN, size: 70 },
  { tags: [], groups: ["AS", "BR"], noun: GENERIC_NOUN, size: 120 },
  { tags: [], groups: ["AP", "AO"], noun: GENERIC_NOUN, size: 60 },
  { tags: ["en:milks"], groups: ["BA", "BC", "BH"], noun: "glass", size: 200 },
  { tags: [], groups: ["BJ"], noun: GENERIC_NOUN, size: 30 },
  { tags: ["en:cheeses"], groups: ["BL"], noun: GENERIC_NOUN, size: 30 },
  { tags: ["en:yogurts"], groups: ["BN"], noun: GENERIC_NOUN, size: 125 },
  { tags: [], groups: ["BP"], noun: GENERIC_NOUN, size: 75 },
  { tags: [], groups: ["BV", "CD"], noun: GENERIC_NOUN, size: 150 },
  { tags: [], groups: ["DA"], noun: GENERIC_NOUN, size: 180 },
  {
    tags: ["en:legumes"],
    groups: ["DB"],
    noun: GENERIC_NOUN,
    size: { dry: 60, cooked: 120 },
  },
  { tags: [], groups: ["DF", "DG", "F", "FA"], noun: GENERIC_NOUN, size: 80 },
  { tags: [], groups: ["DI"], noun: GENERIC_NOUN, size: 20 },
  { tags: [], groups: ["DR"], noun: GENERIC_NOUN, size: 250 },
  { tags: [], groups: ["FC", "PC", "PE"], noun: "glass", size: 200 },
  { tags: ["en:nuts"], groups: ["G", "GA"], noun: GENERIC_NOUN, size: 30 },
  { tags: ["en:spices", "en:herbs"], groups: ["H"], noun: GENERIC_NOUN, size: 2 },
  { tags: [], groups: ["J", "JA", "JC", "JR"], noun: GENERIC_NOUN, size: 140 },
  { tags: [], groups: ["JK", "JM"], noun: GENERIC_NOUN, size: 80 },
  { tags: [], groups: ["MA", "MC", "ME", "MG"], noun: GENERIC_NOUN, size: 150 },
  { tags: ["en:sausages"], groups: ["MI"], noun: GENERIC_NOUN, size: 100 },
  { tags: [], groups: ["MR"], noun: GENERIC_NOUN, size: 300 },
  {
    tags: ["en:vegetable-oils", "en:fats"],
    groups: ["OA", "OB", "OC", "OE", "OF", "BT"],
    noun: GENERIC_NOUN,
    size: 10,
  },
  { tags: [], groups: ["P", "PA"], noun: "cup", size: 200 },
  { tags: [], groups: ["QA", "QC", "Q"], noun: "glass", size: 330 },
  { tags: [], groups: ["QE"], noun: "glass", size: 175 },
  { tags: [], groups: ["QF", "QG"], noun: "glass", size: 50 },
  { tags: [], groups: ["QI", "QK"], noun: GENERIC_NOUN, size: 25 },
  {
    tags: ["en:jams", "en:honeys", "en:sugars"],
    groups: ["S", "SC"],
    noun: GENERIC_NOUN,
    size: 15,
  },
  { tags: ["en:chocolates"], groups: ["SE"], noun: GENERIC_NOUN, size: 40 },
  { tags: ["en:crisps"], groups: ["SN"], noun: GENERIC_NOUN, size: 30 },
  { tags: ["en:soups"], groups: ["WA"], noun: GENERIC_NOUN, size: 300 },
  { tags: ["en:sauces", "en:condiments"], groups: ["WC", "WE"], noun: GENERIC_NOUN, size: 20 },
  { tags: [], groups: ["WY"], noun: GENERIC_NOUN, size: 5 },
];

export type EnergyBand = {
  /** The band holds energies from this up to the next band's `from`. Plain numbers, so the list survives JSON. */
  from: number;
  size: number;
};

/** Used when no category row matches. Sizes are in grams. */
export const ESTIMATE_ENERGY_BANDS_PER_100G: readonly EnergyBand[] = [
  { from: 0, size: 5 },
  { from: 5, size: 80 },
  { from: 60, size: 150 },
  { from: 150, size: 100 },
  { from: 300, size: 40 },
  { from: 450, size: 30 },
  { from: 700, size: 15 },
];

/** Used when no category row matches. Sizes are in millilitres. */
export const ESTIMATE_ENERGY_BANDS_PER_100ML: readonly EnergyBand[] = [
  { from: 0, size: 200 },
  { from: 100, size: 30 },
  { from: 500, size: 15 },
];

/** The size when the energy is unknown, in the food's own basis. */
export const ESTIMATE_UNKNOWN_ENERGY_SIZE = 100;

const GROUP_LETTERS = /^[A-Z]{1,2}/;

function groupOf(foodGroup: string | undefined): string | undefined {
  return GROUP_LETTERS.exec(foodGroup?.trim().toUpperCase() ?? "")?.[0];
}

function sizeOf(size: EstimateSize, kcal: number | null): number {
  if (typeof size === "number") {
    return size;
  }
  return kcal !== null && kcal >= ESTIMATE_DRY_KCAL_PER_100 ? size.dry : size.cooked;
}

function sizeFromEnergy(basis: NutrientBasis, kcal: number | null): number {
  if (kcal === null) {
    return ESTIMATE_UNKNOWN_ENERGY_SIZE;
  }
  const bands =
    basis === "per_100ml" ? ESTIMATE_ENERGY_BANDS_PER_100ML : ESTIMATE_ENERGY_BANDS_PER_100G;
  return bands.filter((band) => kcal >= band.from).at(-1)?.size ?? ESTIMATE_UNKNOWN_ENERGY_SIZE;
}

/**
 * A portion for a food whose data gives no serving and no natural unit, so every food opens on something
 * other than grams. It is always the default and always reads "1 typical <noun>". The size is in the food's
 * own basis, so 1 g is never counted as 1 ml. A category row decides first (an OFF tag, or the first two
 * letters of the CoFID group), then the energy, then 100 g or 100 ml when the energy is unknown.
 */
export function estimatedPortion(input: {
  basis: NutrientBasis;
  kcal: number | null;
  categoriesTags?: readonly string[] | undefined;
  foodGroup?: string | undefined;
}): OffPortionInput {
  const tags = input.categoriesTags ?? [];
  const group = groupOf(input.foodGroup);
  const row = ESTIMATE_CATEGORY_ROWS.find(
    (candidate) =>
      candidate.tags.some((tag) => tags.includes(tag)) ||
      (group !== undefined && candidate.groups.includes(group)),
  );
  const size =
    row === undefined ? sizeFromEnergy(input.basis, input.kcal) : sizeOf(row.size, input.kcal);
  return {
    label: estimatedPortionLabel(row?.noun ?? GENERIC_NOUN),
    grams: input.basis === "per_100g" ? size : null,
    ml: input.basis === "per_100ml" ? size : null,
    isDefault: true,
  };
}
