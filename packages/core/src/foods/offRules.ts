import type { FoodQuality, NutrientBasis } from "../schemas/food";

/** One portion of an OFF food. Exactly one of `grams` and `ml` is set, matching `food_portions`. */
export type OffPortionInput = {
  label: string;
  grams: number | null;
  ml: number | null;
  isDefault: boolean;
};

/** Per 100 g (or per 100 ml) amounts keyed by OFF base name, for example `proteins` or `energy-kj`. */
export type Per100Amounts = Readonly<Record<string, number>>;

export type CarbsConvention = NonNullable<FoodQuality["carbs_convention"]>;

type Macros = {
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  fibre: number | null;
};

/** Open Food Facts stores energy in kilojoules, and one kilocalorie is 4.184 kJ. */
export const KILOJOULES_PER_KILOCALORIE = 4.184;

const SALT_GRAMS_PER_SODIUM_GRAM = 2.5;
const KCAL_PER_GRAM_PROTEIN = 4;
const KCAL_PER_GRAM_FAT = 9;
const KCAL_PER_GRAM_CARBS = 4;
const KCAL_PER_GRAM_FIBRE = 2;

const PER_100_SUFFIX = "_100g";
const PER_SERVING_SUFFIX = "_serving";

const NUMERIC_STRING = /^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;

/**
 * Reads a finite number of at least 0 from a number or a numeric string, because OFF mixes both.
 * Anything else (blank, a word, a negative, NaN, Infinity) reads as missing, never as 0.
 */
export function toNonNegativeNumber(value: unknown): number | undefined {
  let parsed: number | undefined;
  if (typeof value === "number") {
    parsed = value;
  } else if (typeof value === "string" && NUMERIC_STRING.test(value.trim())) {
    parsed = Number(value);
  }
  return parsed !== undefined && Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

/** Rounds a computed value to 6 decimal places, so float noise such as 0.19999999999999998 is not stored. */
function roundToSixDecimals(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

function isPositiveFinite(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value > 0;
}

/** The nutriments whose key ends in `suffix`, as base name and amount, skipping values that are not numbers. */
function readSuffixedAmounts(
  nutriments: Readonly<Record<string, unknown>>,
  suffix: string,
): [string, number][] {
  return Object.entries(nutriments).flatMap(([key, value]): [string, number][] => {
    const amount = toNonNegativeNumber(value);
    const isSuffixed = key.length > suffix.length && key.endsWith(suffix);
    return isSuffixed && amount !== undefined ? [[key.slice(0, -suffix.length), amount]] : [];
  });
}

/**
 * Reads every `<name>_100g` nutriment under its base name. When the data is per serving, a nutrient
 * with no `_100g` value is taken from `<name>_serving` and rescaled with `x * 100 / servingQuantity`,
 * which needs a positive serving quantity (otherwise the nutrient stays missing).
 * `perServingConverted` is true only when a converted value ended up in `amounts`.
 */
export function resolvePer100Amounts(
  nutriments: Readonly<Record<string, unknown>>,
  serving: { nutritionDataPer: string | undefined; servingQuantity: number | undefined },
): { amounts: Per100Amounts; perServingConverted: boolean } {
  const amounts = new Map(readSuffixedAmounts(nutriments, PER_100_SUFFIX));
  const { nutritionDataPer, servingQuantity } = serving;
  let perServingConverted = false;

  if (nutritionDataPer === "serving" && isPositiveFinite(servingQuantity)) {
    for (const [base, perServing] of readSuffixedAmounts(nutriments, PER_SERVING_SUFFIX)) {
      if (!amounts.has(base)) {
        amounts.set(base, roundToSixDecimals((perServing * 100) / servingQuantity));
        perServingConverted = true;
      }
    }
  }

  return { amounts: Object.fromEntries(amounts), perServingConverted };
}

/** `4P + 9F + 4C + 2 fibre`, only when all four are known, because a partial sum would understate energy. */
export function deriveKcal({ protein, fat, carbs, fibre }: Macros): number | null {
  if (protein === null || fat === null || carbs === null || fibre === null) {
    return null;
  }
  return (
    KCAL_PER_GRAM_PROTEIN * protein +
    KCAL_PER_GRAM_FAT * fat +
    KCAL_PER_GRAM_CARBS * carbs +
    KCAL_PER_GRAM_FIBRE * fibre
  );
}

/**
 * Energy in kcal: `energy-kcal`, else kilojoules (`energy-kj`, then the legacy `energy`, which is
 * also kJ in OFF) divided by 4.184, else derived from the macros (`kcalDerived` is then true).
 * The macros passed in are the stored ones, so carbs is already EU-style when derived.
 */
export function resolveEnergy(
  amounts: Per100Amounts,
  macros: Macros,
): { kcal: number | null; kcalDerived: boolean } {
  const kilocalories = amounts["energy-kcal"];
  if (kilocalories !== undefined) {
    return { kcal: kilocalories, kcalDerived: false };
  }
  const kilojoules = amounts["energy-kj"] ?? amounts["energy"];
  if (kilojoules !== undefined) {
    return {
      kcal: roundToSixDecimals(kilojoules / KILOJOULES_PER_KILOCALORIE),
      kcalDerived: false,
    };
  }
  const derived = deriveKcal(macros);
  return derived === null
    ? { kcal: null, kcalDerived: false }
    : { kcal: derived, kcalDerived: true };
}

// Heuristic, retune here. The quantity decides when it carries a recognised unit: a volume unit (ml, cl,
// dl, l, litre, liter, fl oz) means per 100 ml and a weight unit (mg, g, kg, oz, lb) means per 100 g.
// The serving size is only a fallback when the quantity is absent or has no recognised unit.
// With no recognised unit anywhere the label is per 100 g.
const VOLUME_UNIT = /\d\s*(?:ml|cl|dl|l|litres?|liters?|fl\.?\s*oz)\b/i;
const WEIGHT_UNIT = /\d\s*(?:mg|g|kg|oz|lbs?)\b/i;

function unitKind(text: string | undefined): NutrientBasis | undefined {
  if (text === undefined) {
    return undefined;
  }
  if (VOLUME_UNIT.test(text)) {
    return "per_100ml";
  }
  return WEIGHT_UNIT.test(text) ? "per_100g" : undefined;
}

export function inferBasis(hints: {
  quantity: string | undefined;
  servingSize: string | undefined;
}): NutrientBasis {
  return unitKind(hints.quantity) ?? unitKind(hints.servingSize) ?? "per_100g";
}

// Heuristic, retune here. European, UK, EEA and Swiss labels follow the EU convention (carbohydrate
// excludes fibre), so one of these tags next to the United States means the label is not US-style.
const EUROPEAN_COUNTRY_TAGS: ReadonlySet<string> = new Set([
  "en:austria",
  "en:belgium",
  "en:bulgaria",
  "en:croatia",
  "en:cyprus",
  "en:czech-republic",
  "en:denmark",
  "en:estonia",
  "en:finland",
  "en:france",
  "en:germany",
  "en:greece",
  "en:hungary",
  "en:iceland",
  "en:ireland",
  "en:italy",
  "en:latvia",
  "en:liechtenstein",
  "en:lithuania",
  "en:luxembourg",
  "en:malta",
  "en:netherlands",
  "en:norway",
  "en:poland",
  "en:portugal",
  "en:romania",
  "en:slovakia",
  "en:slovenia",
  "en:spain",
  "en:sweden",
  "en:switzerland",
  "en:united-kingdom",
]);

/** True when the United States is a country of sale and no European or UK country is. */
export function isUsLabelled(countriesTags: readonly string[] | undefined): boolean {
  const tags = countriesTags ?? [];
  return tags.includes("en:united-states") && !tags.some((tag) => EUROPEAN_COUNTRY_TAGS.has(tag));
}

/**
 * Stores carbs EU-style. A US label counts fibre inside carbohydrate, so with fibre known it is
 * subtracted (clamped at 0) and the stored value is `eu`. With fibre unknown the labelled value stays
 * and is `us_total`. The convention is left unset when nothing US-specific happened.
 */
export function resolveCarbs(input: {
  carbs: number | null;
  fibre: number | null;
  usLabelled: boolean;
}): { carbs: number | null; convention: CarbsConvention | undefined } {
  const { carbs, fibre, usLabelled } = input;
  if (carbs === null || !usLabelled) {
    return { carbs, convention: undefined };
  }
  if (fibre === null) {
    return { carbs, convention: "us_total" };
  }
  return { carbs: roundToSixDecimals(Math.max(0, carbs - fibre)), convention: "eu" };
}

/** `salt`, else `sodium * 2.5`, else null. A recorded 0 counts as recorded. */
export function resolveSalt(amounts: Per100Amounts): number | null {
  if (amounts.salt !== undefined) {
    return amounts.salt;
  }
  return amounts.sodium === undefined ? null : amounts.sodium * SALT_GRAMS_PER_SODIUM_GRAM;
}

/** The macros that are still null, in the fixed order `kcal, protein_g, fat_g, carbs_g`. */
export function listMissingMacros(macros: {
  kcal: number | null;
  protein_g: number | null;
  fat_g: number | null;
  carbs_g: number | null;
}): string[] {
  return (["kcal", "protein_g", "fat_g", "carbs_g"] as const).filter(
    (field) => macros[field] === null,
  );
}

/**
 * Builds `foods.quality` with only the notable keys, so a clean product is `{}` (absent booleans
 * read as false, absent arrays as empty). A missing macro or an unconverted US label makes the food
 * suspect, and the latter also lists `fibre_g`.
 */
export function buildQuality(input: {
  kcalDerived: boolean;
  perServingConverted: boolean;
  missingMacros: readonly string[];
  carbsConvention: CarbsConvention | undefined;
}): FoodQuality {
  const { kcalDerived, perServingConverted, missingMacros, carbsConvention } = input;
  const fieldsMissing = [...missingMacros, ...(carbsConvention === "us_total" ? ["fibre_g"] : [])];
  return {
    ...(kcalDerived ? { kcal_derived: true } : {}),
    ...(perServingConverted ? { per_serving_converted: true } : {}),
    ...(fieldsMissing.length > 0 ? { suspect: true, fields_missing: fieldsMissing } : {}),
    ...(carbsConvention === undefined ? {} : { carbs_convention: carbsConvention }),
  };
}

/** The first of the comma-separated brands, trimmed, or null when blank. */
export function pickBrand(brands: string | undefined): string | null {
  const firstBrand = brands?.split(",")[0]?.trim() ?? "";
  return firstBrand === "" ? null : firstBrand;
}

/** The English name when it has text, else the product name, else undefined. */
export function pickName(names: {
  productNameEnglish: string | undefined;
  productName: string | undefined;
}): string | undefined {
  const candidates = [names.productNameEnglish, names.productName].map((name) => name?.trim());
  return candidates.find((name) => name !== undefined && name !== "");
}

const LANGUAGE_PREFIX = /^[a-z]{2,3}:/;

/** The first category tag without its language prefix (`en:breakfast-cereals` becomes `breakfast-cereals`). */
export function pickFoodGroup(categoriesTags: readonly string[] | undefined): string | null {
  const foodGroup = categoriesTags?.[0]?.replace(LANGUAGE_PREFIX, "").trim() ?? "";
  return foodGroup === "" ? null : foodGroup;
}

// The OFF base names that feed a `foods` column, so they are not repeated in `micros`.
const COLUMN_BASE_NAMES: ReadonlySet<string> = new Set([
  "energy-kcal",
  "energy-kj",
  "energy",
  "proteins",
  "fat",
  "saturated-fat",
  "carbohydrates",
  "sugars",
  "fiber",
  "salt",
  "sodium",
]);

/**
 * OFF base names (matched by prefix) that carry a score or footprint rather than a nutrient, for
 * example `nutrition-score-fr` or `carbon-footprint-from-known-ingredients`. They stay out of `micros`.
 */
export const NON_NUTRIENT_BASE_PREFIXES: readonly string[] = [
  "nutrition-score",
  "nova-group",
  "carbon-footprint",
  "ecoscore",
  "environmental-score",
  "nutrient-level",
  "fruits-vegetables-nuts",
  "fruits-vegetables-legumes",
  "energy-from",
];

function isMicro(base: string): boolean {
  return (
    !COLUMN_BASE_NAMES.has(base) &&
    !NON_NUTRIENT_BASE_PREFIXES.some((prefix) => base.startsWith(prefix))
  );
}

/** Every nutrient that is not a column or a score, keyed by its OFF base name, after any per-serving conversion. */
export function collectMicros(amounts: Per100Amounts): Record<string, number> {
  return Object.fromEntries(Object.entries(amounts).filter(([base]) => isMicro(base)));
}

/** The serving as a default portion (grams for per_100g, ml for per_100ml), or null without a sane quantity. */
export function servingPortion(input: {
  servingSize: string | undefined;
  servingQuantity: number | undefined;
  basis: NutrientBasis;
}): OffPortionInput | null {
  const { servingSize, servingQuantity, basis } = input;
  if (!isPositiveFinite(servingQuantity)) {
    return null;
  }
  const trimmedServingSize = servingSize?.trim() ?? "";
  return {
    label: trimmedServingSize === "" ? "1 serving" : trimmedServingSize,
    grams: basis === "per_100g" ? servingQuantity : null,
    ml: basis === "per_100ml" ? servingQuantity : null,
    isDefault: true,
  };
}
