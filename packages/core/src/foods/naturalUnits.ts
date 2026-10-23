import type { NutrientBasis } from "../schemas/food";

/** One borrowed portion. Always grams, because every cited row is a weight. */
export type NaturalUnitPortion = {
  label: string;
  grams: number;
  isDefault: boolean;
};

/** One allowlisted item type whose real size barely varies between brands. */
export type NaturalUnitType = {
  type: string;
  /** The CoFID food code of the row in `cofid-portions.csv` the portions are copied from. */
  cofidFoodCode: string;
  /**
   * OFF category tags, one of which must be in the product's `categories_tags`. OFF lists every
   * ancestor of a product's categories there, so a tag here also matches all of its descendants,
   * and `excludeTags` is what rules out the descendants that are another food.
   */
  includeTags: readonly string[];
  /** Tags that rule this type out on top of `NATURAL_UNIT_PROCESSED_TAGS`. */
  excludeTags: readonly string[];
  /**
   * Energy in kcal per 100 g from CoFID 2021, sheet 1.3 Proximates, column "Energy (kcal)" (column
   * `proximates_energy_kcal_kcal` of `packages/db/data/cofid/cofid-2021.normalised.csv`).
   */
  referenceKcalPer100g: number;
  portions: readonly NaturalUnitPortion[];
  /** The USDA FoodData Central id and the rows of `packages/db/data/portions/cofid-portions.csv`. */
  source: string;
};

/**
 * Item types a branded product may borrow natural units from. Every portion is a row of
 * `packages/db/data/portions/cofid-portions.csv` (USDA FoodData Central, SR Legacy, release April
 * 2018), and a test pins each entry to that file, so no number here is new.
 *
 * Never add items sold by a variable cut or slice: bread slices, chicken or other meat cuts, fish
 * fillets, cakes and pastries, sausages. Their size varies too much for a borrowed weight to be honest.
 *
 * Every tag below was checked against the OFF categories taxonomy (static.openfoodfacts.org, file
 * modified 2026-10-21). Residual false positives that no tag can rule out are accepted: diced or
 * spreadable avocado, pre-sliced apples, garlic in oil, and products OFF has tagged wrongly.
 */
export const NATURAL_UNIT_TYPES: readonly NaturalUnitType[] = [
  {
    type: "hen eggs",
    cofidFoodCode: "12-937",
    includeTags: ["en:eggs", "en:chicken-eggs"],
    // Every other child of en:eggs in the taxonomy (other birds, cooked, parts of an egg, powders).
    excludeTags: [
      "en:quail-eggs",
      "en:cooked-quail-eggs",
      "en:duck-eggs",
      "en:goose-eggs",
      "en:ostrich-eggs",
      "en:emu-eggs",
      "en:guineafowl-eggs",
      "en:gull-eggs",
      "en:pheasant-eggs",
      "en:turkey-eggs",
      "en:scotch-eggs",
      "en:boiled-eggs",
      "en:hard-boiled-egg",
      "en:century-egg",
      "en:egg-white",
      "en:egg-white-cooked",
      "en:egg-white-powder",
      "en:egg-yolk",
      "en:egg-yolk-powder",
      "en:egg-powder",
      "en:frozen-chicken-eggs",
      "en:chocolate-eggs",
      "en:egg-noodles",
    ],
    referenceKcalPer100g: 131,
    // Whole egg without shell, the basis of OFF's per 100 g figures. Not the in-shell weight.
    portions: [
      { label: "1 small", grams: 38, isDefault: false },
      { label: "1 medium", grams: 44, isDefault: false },
      { label: "1 large", grams: 50, isDefault: true },
      { label: "1 extra large", grams: 56, isDefault: false },
    ],
    source: "USDA FoodData Central SR Legacy, FDC id 171287, cofid-portions.csv rows for 12-937",
  },
  {
    type: "bananas",
    cofidFoodCode: "14-318",
    includeTags: ["en:bananas"],
    excludeTags: [
      "en:banana-crisps",
      "en:plantain-bananas",
      "en:cooked-plantain-bananas",
      "en:matooke-bananas",
    ],
    referenceKcalPer100g: 81,
    portions: [
      { label: "1 small", grams: 101, isDefault: false },
      { label: "1 medium", grams: 118, isDefault: true },
      { label: "1 large", grams: 136, isDefault: false },
    ],
    source: "USDA FoodData Central SR Legacy, FDC id 173944, cofid-portions.csv rows for 14-318",
  },
  {
    type: "apples",
    cofidFoodCode: "14-319",
    includeTags: ["en:apples"],
    excludeTags: [
      "en:apple-pulp",
      "en:canada-apple-pulp",
      "en:roasted-apple-pulp",
      "en:boiled-apples-without-skin",
    ],
    referenceKcalPer100g: 51,
    portions: [
      { label: "1 small", grams: 149, isDefault: false },
      { label: "1 medium", grams: 182, isDefault: true },
      { label: "1 large", grams: 223, isDefault: false },
    ],
    source: "USDA FoodData Central SR Legacy, FDC id 171688, cofid-portions.csv rows for 14-319",
  },
  {
    type: "pears",
    cofidFoodCode: "14-321",
    includeTags: ["en:pears"],
    excludeTags: [],
    referenceKcalPer100g: 43,
    portions: [
      { label: "1 small", grams: 148, isDefault: false },
      { label: "1 medium", grams: 178, isDefault: true },
      { label: "1 large", grams: 230, isDefault: false },
    ],
    source: "USDA FoodData Central SR Legacy, FDC id 169118, cofid-portions.csv rows for 14-321",
  },
  {
    type: "oranges",
    cofidFoodCode: "14-327",
    includeTags: ["en:oranges"],
    excludeTags: ["en:orange-pulp"],
    referenceKcalPer100g: 36,
    portions: [
      { label: "1 small", grams: 96, isDefault: false },
      { label: "1 medium", grams: 131, isDefault: true },
      { label: "1 large", grams: 184, isDefault: false },
    ],
    source: "USDA FoodData Central SR Legacy, FDC id 169097, cofid-portions.csv rows for 14-327",
  },
  {
    type: "easy peelers",
    cofidFoodCode: "14-326",
    includeTags: ["en:clementines", "en:mandarins"],
    excludeTags: ["en:clementine-pulp", "en:mandarin-pulp"],
    referenceKcalPer100g: 41,
    portions: [{ label: "1 fruit", grams: 74, isDefault: true }],
    source: "USDA FoodData Central SR Legacy, FDC id 168195, cofid-portions.csv rows for 14-326",
  },
  {
    type: "kiwi",
    cofidFoodCode: "14-371",
    includeTags: ["en:kiwifruits"],
    excludeTags: ["en:kiwifruit-pulp-and-seeds"],
    referenceKcalPer100g: 44,
    portions: [{ label: "1 kiwi", grams: 69, isDefault: true }],
    source: "USDA FoodData Central SR Legacy, FDC id 168153, cofid-portions.csv rows for 14-371",
  },
  {
    type: "lemons",
    cofidFoodCode: "14-129",
    includeTags: ["en:lemons"],
    excludeTags: ["en:lemon-curds", "en:lemon-zest", "en:lemon-pulp"],
    referenceKcalPer100g: 14,
    portions: [{ label: "1 lemon", grams: 58, isDefault: true }],
    source: "USDA FoodData Central SR Legacy, FDC id 167746, cofid-portions.csv rows for 14-129",
  },
  {
    type: "limes",
    cofidFoodCode: "14-131",
    includeTags: ["en:limes"],
    excludeTags: ["en:lime-pulp"],
    referenceKcalPer100g: 9,
    portions: [{ label: "1 lime", grams: 67, isDefault: true }],
    source: "USDA FoodData Central SR Legacy, FDC id 168155, cofid-portions.csv rows for 14-131",
  },
  {
    type: "avocados",
    cofidFoodCode: "14-386",
    includeTags: ["en:avocados"],
    excludeTags: ["en:avocado-pulp"],
    referenceKcalPer100g: 171,
    portions: [{ label: "1 avocado", grams: 136, isDefault: true }],
    source: "USDA FoodData Central SR Legacy, FDC id 171706, cofid-portions.csv rows for 14-386",
  },
  {
    type: "fresh garlic",
    cofidFoodCode: "13-244",
    includeTags: ["en:garlics"],
    excludeTags: [
      "en:garlic-powders",
      "en:garlic-breads",
      "en:chopped-garlics",
      "en:dried-garlics",
      "en:black-garlic",
    ],
    referenceKcalPer100g: 98,
    portions: [{ label: "1 clove", grams: 3, isDefault: true }],
    source: "USDA FoodData Central SR Legacy, FDC id 169230, cofid-portions.csv rows for 13-244",
  },
];

/**
 * A product carrying any of these OFF category tags is processed or not a food on its own, so no
 * type is borrowed for it. OFF lists every ancestor too, so each tag also covers its descendants
 * (en:chips-and-fries covers en:crisps and banana crisps, en:beverages covers fruit sodas).
 */
export const NATURAL_UNIT_PROCESSED_TAGS: readonly string[] = [
  "en:dried-products",
  "en:dried-plant-based-foods",
  "en:dried-fruits",
  "en:juices-and-nectars",
  "en:fruit-juices",
  "en:beverages",
  "en:fruit-and-vegetable-preserves",
  "en:jams",
  "en:compotes",
  "en:purees",
  "en:fruits-puree-without-sugar-added",
  "en:fruit-salads",
  "en:candied-fruits",
  "en:fruits-coulis",
  "en:fruit-pastes",
  "en:condiment-pastes",
  "en:sauces",
  "en:canned-foods",
  "en:canned-plant-based-foods",
  "en:canned-fruits",
  "en:frozen-foods",
  "en:frozen-plant-based-foods",
  "en:biscuits-and-cakes",
  "en:cakes",
  "en:pastries",
  "en:chips-and-fries",
  "en:crisps",
  "en:snacks",
  "en:sweet-snacks",
  "en:meals",
  "en:smoothies",
];

/** How far a product's energy may sit from the CoFID reference and still count as the same food. */
const ENERGY_TOLERANCE = 0.2;

function isWithinEnergyTolerance(kcal: number, referenceKcal: number): boolean {
  return (
    Number.isFinite(kcal) &&
    kcal >= 0 &&
    Math.abs(kcal - referenceKcal) <= referenceKcal * ENERGY_TOLERANCE
  );
}

/**
 * The cited natural units a branded product may borrow, or `[]`. All four guards must hold:
 * 1. an allowlisted OFF category tag, or a descendant of it (OFF lists every ancestor), is in the
 *    product's full tag list; a parent such as en:fruits does not count;
 * 2. no processed tag, and none of the type's own exclusion tags, is in that list;
 * 3. the energy per 100 g is known and within 20 percent of the CoFID reference for the type;
 * 4. the basis is per 100 g, and the tags name exactly one type (two types named means none matches).
 */
export function naturalUnitsFor(product: {
  categoriesTags: readonly string[] | undefined;
  basis: NutrientBasis;
  kcal: number | null;
}): readonly NaturalUnitPortion[] {
  if (product.basis !== "per_100g" || product.kcal === null) {
    return [];
  }
  const tags = product.categoriesTags ?? [];
  const named = NATURAL_UNIT_TYPES.filter((entry) =>
    entry.includeTags.some((tag) => tags.includes(tag)),
  );
  const [entry, ...others] = named;
  if (entry === undefined || others.length > 0) {
    return [];
  }
  const isProcessed = [...NATURAL_UNIT_PROCESSED_TAGS, ...entry.excludeTags].some((tag) =>
    tags.includes(tag),
  );
  if (isProcessed || !isWithinEnergyTolerance(product.kcal, entry.referenceKcalPer100g)) {
    return [];
  }
  return entry.portions;
}
