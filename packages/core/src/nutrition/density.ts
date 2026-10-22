import type { Food } from "../schemas/food";

/*
 * Density estimates for turning millilitres and spoons into grams.
 *
 * `estimateDensity` answers with the first rule that applies, and says which one it was in `basis`:
 *   "food"      the food's own `density_g_per_ml`. A value a user entered is never overridden.
 *   "override"  a per-food entry in COFID_DENSITY_OVERRIDES, keyed by CoFID food code, for a food whose
 *               density is known and differs from its group.
 *   "group"     the entry for the food's CoFID food group, found by the longest matching prefix of the
 *               group code (BAH, else BA, else B). Only CoFID foods get one.
 * It returns null when none applies: measuring this food by volume is not sensible (a chicken breast, a
 * banana), or its group is too mixed for one honest number. Null does not mean the food cannot be measured
 * in millilitres: a food whose nutrient basis is per_100ml (CoFID group Q, the alcoholic drinks) is
 * measured in millilitres without a density, so a caller checks the basis before reading null as "no
 * volume measure".
 *
 * An estimate is approximate. A liquid's is usually within a few percent; a powder's can be 20 percent
 * off, because a spoonful weighs less when loose than when packed.
 *
 * The tables are versioned by this file's git history only. A density already frozen into a diary
 * snapshot is never recomputed from a newer table.
 *
 * Every CoFID group code is listed, with a density or with the reason it has none, so a code missing from
 * the table is a mistake the db unit test names. A group listed without a density also stops the prefix
 * search, so it does not borrow its parent's number. No value is a guess: a group with no citable source
 * has no estimate. CoFID's specific gravity is relative to water, which is 0.9982 g/ml at 20 degrees C,
 * so it is used here as g/ml.
 */

export type DensityBasis = "food" | "override" | "group";

export type DensityEstimate = { gPerMl: number; basis: DensityBasis };

type DensityEntry = { gPerMl: number; source: string };
type NoVolumeMeasureEntry = { gPerMl: null; reason: string };
type CofidGroupEntry = DensityEntry | NoVolumeMeasureEntry;

const COFID_SPECIFIC_GRAVITY =
  "CoFID 2021 sheet 1.2 Factors, specific gravity (column factors_specific_gravity of packages/db/data/cofid/cofid-2021.normalised.csv)";
const FAO_VEGETABLE_OIL_RELATIVE_DENSITY =
  "FAO https://www.fao.org/4/y2774e/y2774e04.htm, relative density from Codex Stan 210-1999 Appendix Table 2 and Codex Stan 33-1981 section 3.1.2.1";
const KING_ARTHUR_WEIGHT_CHART =
  "King Arthur Baking ingredient weight chart https://www.kingarthurbaking.com/learn/ingredient-weight-chart";
const FAO_HONEY_SPECIFIC_GRAVITY =
  "FAO Value-added products from beekeeping, chapter 2 Honey, Table 2.4 (White, 1975): true specific gravity at 20 C is 1.4237 at 17 percent water and 1.4171 at 18 percent";

const USDA_FDC_SR_LEGACY = "USDA FoodData Central SR Legacy https://fdc.nal.usda.gov";

/** The US customary measures USDA weighs its household portions in, in millilitres. */
const US_MEASURES = {
  tsp: { name: "teaspoon", ml: 4.92892 },
  tbsp: { name: "tablespoon", ml: 14.7868 },
  cup: { name: "cup", ml: 236.588 },
} as const;

type UsMeasure = keyof typeof US_MEASURES;

/**
 * A density worked out from one USDA portion row: grams per US measure, divided by that measure's
 * millilitres, to 3 significant figures. USDA rounds its weights to 0.1 g or 1 g, so the portion with the
 * most grams has the least rounding error, and the rest are cross-checks in `detail`. `qualifier` is the
 * text USDA adds to the measure, such as ", ground". The app's own spoons are 5 and 15 ml, a little larger
 * than the US ones, so a spoon logged here weighs about 1.4 percent more than USDA's.
 */
const usdaPortionDensity = (
  foods: string,
  measure: UsMeasure,
  grams: number,
  qualifier = "",
  detail = "",
): DensityEntry => {
  const { name, ml } = US_MEASURES[measure];
  return {
    gPerMl: Number((grams / ml).toPrecision(3)),
    source: `${USDA_FDC_SR_LEGACY}, ${foods}: 1 ${measure}${qualifier} weighs ${grams} g, over the US ${name} of ${ml} ml${detail}`,
  };
};

const milkDensity: DensityEntry = {
  gPerMl: 1.03,
  source: `${COFID_SPECIFIC_GRAVITY}: 1.03 for 12-313, 12-314, 12-418 and 12-419 (semi-skimmed), 12-320 (whole UHT) and 12-554 (skimmed UHT)`,
};
const yogurtDensity: DensityEntry = {
  gPerMl: 1.04,
  source: `${COFID_SPECIFIC_GRAVITY}: median of 11 foods in BN (yogurts, fromage frais, lassi), range 1.02 to 1.08`,
};

const NOT_MEASURED_BY_VOLUME = "A solid food that is weighed or counted, not measured by volume.";
const DRY_AND_PREPARED = "Dry and prepared forms share the group, so densities differ widely.";
const MIXED_DISHES = "Mixed dishes of differing composition and texture.";
const SOLID_FAT = "Solid fats vary in air and water content, and no source was found.";
const NO_SOURCE = "Members differ and no citable density was found for a typical one.";
const PER_100_ML = "Measured per 100 ml already, so no density is needed to log it in millilitres.";

const noVolumeMeasure = (reason: string): NoVolumeMeasureEntry => ({ gPerMl: null, reason });

const sharedEntry = (
  codes: readonly string[],
  entry: CofidGroupEntry,
): [string, CofidGroupEntry][] => codes.map((code): [string, CofidGroupEntry] => [code, entry]);

/** CoFID food group code to its density, or to the reason it has none. Every group in the CoFID CSV is listed. */
export const COFID_GROUP_DENSITIES: Readonly<Record<string, CofidGroupEntry>> = Object.fromEntries([
  // Cereals and baked foods
  ...sharedEntry(["A", "AC", "AD", "AT"], noVolumeMeasure(DRY_AND_PREPARED)),
  ...sharedEntry(
    ["AA"],
    noVolumeMeasure(
      "Flours, starches and grains pack differently, and the plain wheat flours are overrides.",
    ),
  ),
  ...sharedEntry(
    ["AB", "AE", "AF", "AG", "AK", "AM", "AN", "AO", "AP", "AS"],
    noVolumeMeasure(NOT_MEASURED_BY_VOLUME),
  ),
  ...sharedEntry(
    ["AI"],
    noVolumeMeasure("Breakfast cereals run from dense granola to light flakes and puffs."),
  ),

  // Milk, cream, yogurt, cheese, eggs and dairy fats
  ...sharedEntry(["BA", "BAB", "BAE", "BAH", "BAK"], milkDensity),
  [
    "BAR",
    noVolumeMeasure(
      "Evaporated and condensed milk, dried milk, whitener powder and flavoured milk share the group.",
    ),
  ],
  [
    "BC",
    {
      gPerMl: 1.01,
      source: `${COFID_SPECIFIC_GRAVITY}: soya milks 12-523 (1.03) and 12-524 (0.99), mean 1.01; goat, sheep and human milk have no CoFID value`,
    },
  ],
  ["BH", noVolumeMeasure("Fermented milk drinks and cocoa powder share the group.")],
  [
    "BJC",
    {
      gPerMl: 0.98,
      source: `${COFID_SPECIFIC_GRAVITY}: mean of the 6 creams and cremes fraiches in BJC with a value, 0.94 (double) to 1.01`,
    },
  ],
  ["BJP", noVolumeMeasure("Aerosol cream is mostly air (CoFID specific gravity 0.18 to 0.21).")],
  [
    "BJS",
    noVolumeMeasure(
      "Cream substitutes differ widely (CoFID specific gravity 0.98 single, 1.19 double).",
    ),
  ],
  ["BL", noVolumeMeasure(NOT_MEASURED_BY_VOLUME)],
  ["BN", yogurtDensity],
  ["BNE", yogurtDensity],
  [
    "BNH",
    {
      gPerMl: 1.08,
      source: `${COFID_SPECIFIC_GRAVITY}: 12-904 (1.07) and 12-905 (1.08), flavoured low fat yogurts`,
    },
  ],
  ["BNS", yogurtDensity],
  [
    "BP",
    noVolumeMeasure("Frozen desserts are aerated and melt (CoFID specific gravity 0.57 to 0.87)."),
  ],
  ["BR", noVolumeMeasure(MIXED_DISHES)],
  ["BTM", noVolumeMeasure(SOLID_FAT)],
  ["BV", noVolumeMeasure(MIXED_DISHES)],
  ...sharedEntry(["CA"], noVolumeMeasure("Eggs are counted, not measured by volume.")),
  ...sharedEntry(["CD", "CDE", "CDH"], noVolumeMeasure(MIXED_DISHES)),

  // Vegetables, pulses, fruit, nuts, herbs and spices
  ...sharedEntry(
    ["D", "DA", "DAE", "DAM", "DAP", "DAR", "DG", "F", "FA"],
    noVolumeMeasure(NOT_MEASURED_BY_VOLUME),
  ),
  ...sharedEntry(["DB", "DF", "DI"], noVolumeMeasure(DRY_AND_PREPARED)),
  ["DR", noVolumeMeasure(MIXED_DISHES)],
  ...sharedEntry(["FC", "G", "GA", "H"], noVolumeMeasure(NO_SOURCE)),

  // Fish, meat and their dishes
  ...sharedEntry(
    [
      "J",
      "JA",
      "JC",
      "JK",
      "JM",
      "JR",
      "MAA",
      "MAC",
      "MAE",
      "MAG",
      "MAI",
      "MBG",
      "MCA",
      "MCC",
      "MCE",
      "MCG",
      "MCI",
      "MCK",
      "MCM",
      "MCO",
      "MEA",
      "MEC",
      "MEE",
      "MG",
      "MI",
    ],
    noVolumeMeasure(NOT_MEASURED_BY_VOLUME),
  ),
  ...sharedEntry(["MIG", "MR"], noVolumeMeasure(MIXED_DISHES)),

  // Fats and oils
  ...sharedEntry(["OA", "OB", "OE", "OF"], noVolumeMeasure(SOLID_FAT)),
  [
    "OC",
    {
      gPerMl: 0.92,
      source: `${FAO_VEGETABLE_OIL_RELATIVE_DENSITY}: 0.910 to 0.925 at 20 C for olive, soya, sunflower, rapeseed, maize and groundnut oil; coconut 0.908 to 0.921 at 40 C; palm 0.891 to 0.899 at 50 C`,
    },
  ],

  // Drinks
  ...sharedEntry(["P", "PA", "PCA", "PE"], noVolumeMeasure(NO_SOURCE)),
  ["PAA", noVolumeMeasure(DRY_AND_PREPARED)],
  [
    "PAC",
    {
      gPerMl: 1,
      source:
        "Derived, not a published food table: water is 0.9982 g/ml at 20 C (CRC Handbook of Chemistry and Physics), and the 16 coffee and tea infusions in the group hold 96.8 to 99.7 g water per 100 g (CoFID 2021 sheet 1.3 Proximates). Irish coffee 17-594 is also in the group, at 83.1 percent water with 5 g alcohol, and still falls within 10 percent of 1.00",
    },
  ],
  [
    "PCC",
    noVolumeMeasure("Cordials are listed undiluted and diluted, so densities differ widely."),
  ],
  ...sharedEntry(["Q", "QA", "QC", "QE", "QF", "QG", "QI", "QK"], noVolumeMeasure(PER_100_ML)),

  // Sweets, snacks, sauces and soups
  ["S", noVolumeMeasure(MIXED_DISHES)],
  [
    "SC",
    noVolumeMeasure(
      "Sugars, syrups, jams, spreads and sauces share the group. Honey and other known foods are overrides.",
    ),
  ],
  ...sharedEntry(["SEA", "SEC"], noVolumeMeasure(NOT_MEASURED_BY_VOLUME)),
  ...sharedEntry(["SN", "SNA", "SNC"], noVolumeMeasure(NO_SOURCE)),
  ...sharedEntry(["WA", "WAA", "WAC", "WCD", "WCG", "WCN", "WE"], noVolumeMeasure(NO_SOURCE)),
  ...sharedEntry(["WAE", "WC", "WY"], noVolumeMeasure(DRY_AND_PREPARED)),
]);

/** CoFID food code to the density of that one food, where it is known and differs from the group's. */
export const COFID_DENSITY_OVERRIDES: Readonly<Record<string, DensityEntry>> = {
  "17-050": {
    gPerMl: 1.42,
    source: `${FAO_HONEY_SPECIFIC_GRAVITY}, and CoFID honey holds 17.5 percent water; King Arthur Baking weight chart agrees at 21 g per US tablespoon (14.787 ml)`,
  },
  // Every entry down to the butter is the King Arthur Baking ingredient weight chart: grams per US cup (236.588 ml), or
  // per half cup (118.294 ml) for butter. The chart states no filling method for flours, so read those as a
  // level spoon of loose flour. Brown sugar is the chart's packed figure and icing sugar its unsifted one.
  // Flours: the plain soft, strong white and self raising rows match a chart entry directly.
  "11-886": {
    gPerMl: 0.51,
    source: `${KING_ARTHUR_WEIGHT_CHART}: all-purpose flour 120 g per US cup, the nearest to plain soft wheat flour`,
  },
  "11-887": {
    gPerMl: 0.51,
    source: `${KING_ARTHUR_WEIGHT_CHART}: bread flour 120 g per US cup`,
  },
  "11-888": {
    gPerMl: 0.48,
    source: `${KING_ARTHUR_WEIGHT_CHART}: self-rising flour 113 g per US cup`,
  },
  "11-889": {
    gPerMl: 0.48,
    source: `${KING_ARTHUR_WEIGHT_CHART}: whole wheat flour 113 g per US cup`,
  },
  "11-890": {
    gPerMl: 0.48,
    source: `${KING_ARTHUR_WEIGHT_CHART}: whole wheat flour 113 g per US cup, for strong wholemeal flour`,
  },
  "11-891": {
    gPerMl: 0.48,
    source: `${KING_ARTHUR_WEIGHT_CHART}: self-rising flour and whole wheat flour are both 113 g per US cup`,
  },
  // Sugars
  "17-063": {
    gPerMl: 0.84,
    source: `${KING_ARTHUR_WEIGHT_CHART}: granulated white sugar 198 g per US cup (0.837), for CoFID's granulated and loaf sugar`,
  },
  "17-060": {
    gPerMl: 0.9,
    source: `${KING_ARTHUR_WEIGHT_CHART}: brown sugar (dark or light), packed, 213 g per US cup`,
  },
  "17-061": {
    gPerMl: 0.93,
    source: `${KING_ARTHUR_WEIGHT_CHART}: Demerara sugar 220 g per US cup`,
  },
  "17-062": {
    gPerMl: 0.48,
    source: `${KING_ARTHUR_WEIGHT_CHART}: confectioners' sugar, unsifted, 113 g per US cup`,
  },
  // Butter
  "17-685": {
    gPerMl: 0.96,
    source: `${KING_ARTHUR_WEIGHT_CHART}: butter 113 g per half US cup (8 tablespoons, 118.294 ml), 0.955`,
  },
  "17-661": {
    gPerMl: 0.96,
    source: `${KING_ARTHUR_WEIGHT_CHART}: butter 113 g per half US cup (8 tablespoons, 118.294 ml), 0.955`,
  },
  // Every entry below is a USDA FoodData Central SR Legacy household portion (a "1 tbsp", "1 tsp" or "1 cup"
  // row of the food), read through the public API. Where a CoFID food has no USDA twin of its own the detail
  // says which USDA food stands in for it. Foods with no row, or rows that disagree, have no entry.
  // Porridge oats, unfortified
  "11-788": usdaPortionDensity(
    "FDC 173904 (Cereals, oats, regular and quick, not fortified, dry)",
    "cup",
    81,
  ),
  // Rice, white, long grain, raw
  "11-861": usdaPortionDensity(
    "FDC 168877 (Rice, white, long-grain, regular, raw, enriched)",
    "cup",
    185,
  ),
  // Cocoa powder
  "12-545": usdaPortionDensity(
    "FDC 169593 (Cocoa, dry powder, unsweetened)",
    "cup",
    86,
    "",
    "; its 1 tbsp row of 5.4 g gives 0.365",
  ),
  // Allspice, ground
  "13-801": usdaPortionDensity("FDC 171315 (Spices, allspice, ground)", "tbsp", 6.0),
  // Anise seeds
  "13-802": usdaPortionDensity("FDC 171316 (Spices, anise seed)", "tbsp", 6.7, ", whole"),
  // Basil, dried, ground
  "13-805": usdaPortionDensity("FDC 171317 (Spices, basil, dried)", "tbsp", 4.5, ", ground"),
  // Caraway seeds
  "13-808": usdaPortionDensity("FDC 170918 (Spices, caraway seed)", "tbsp", 6.7),
  // Cardamom, ground
  "13-809": usdaPortionDensity("FDC 170919 (Spices, cardamom)", "tbsp", 5.8, ", ground"),
  // Celery seeds
  "13-810": usdaPortionDensity("FDC 170920 (Spices, celery seed)", "tbsp", 6.5),
  // Coriander leaves, dried
  "13-818": usdaPortionDensity("FDC 170921 (Spices, coriander leaf, dried)", "tbsp", 1.8),
  // Curry powder, mixed flavours
  "13-823": usdaPortionDensity("FDC 170924 (Spices, curry powder)", "tbsp", 6.3),
  // Dill, dried
  "13-825": usdaPortionDensity("FDC 171322 (Spices, dill weed, dried)", "tbsp", 3.1),
  // Dill seeds
  "13-826": usdaPortionDensity("FDC 170925 (Spices, dill seed)", "tbsp", 6.6),
  // Fennel seeds
  "13-827": usdaPortionDensity("FDC 171323 (Spices, fennel seed)", "tbsp", 5.8, ", whole"),
  // Fenugreek seeds
  "13-828": usdaPortionDensity("FDC 171324 (Spices, fenugreek seed)", "tbsp", 11.1),
  // Garlic powder
  "13-830": usdaPortionDensity("FDC 171325 (Spices, garlic powder)", "tbsp", 9.7),
  // Ginger, ground
  "13-832": usdaPortionDensity("FDC 170926 (Spices, ginger, ground)", "tbsp", 5.2),
  // Marjoram, dried
  "13-835": usdaPortionDensity("FDC 170928 (Spices, marjoram, dried)", "tbsp", 1.7),
  // Mint, dried
  "13-837": usdaPortionDensity(
    "FDC 172239 (Spearmint, dried)",
    "tbsp",
    1.6,
    "",
    "; spearmint stands in for mint",
  ),
  // Parsley, dried
  "13-845": usdaPortionDensity("FDC 170930 (Spices, parsley, dried)", "tbsp", 1.6),
  // Pepper, cayenne, ground
  "13-847": usdaPortionDensity("FDC 170932 (Spices, pepper, red or cayenne)", "tbsp", 5.3),
  // Poppy seeds
  "13-849": usdaPortionDensity("FDC 171330 (Spices, poppy seed)", "tbsp", 8.8),
  // Sage, dried, ground
  "13-854": usdaPortionDensity("FDC 170935 (Spices, sage, ground)", "tbsp", 2.0),
  // Tarragon, dried, ground
  "13-858": usdaPortionDensity("FDC 170937 (Spices, tarragon, dried)", "tbsp", 4.8, ", ground"),
  // Turmeric, ground
  "13-861": usdaPortionDensity("FDC 172231 (Spices, turmeric, ground)", "tbsp", 9.4),
  // Chilli powder
  "13-873": usdaPortionDensity(
    "FDC 171319 (Spices, chili powder)",
    "tbsp",
    8.0,
    "",
    "; USDA chili powder is a seasoned blend, so a pure chilli powder may differ",
  ),
  // Cinnamon, ground
  "13-874": usdaPortionDensity("FDC 171320 (Spices, cinnamon, ground)", "tbsp", 7.8),
  // Coriander seeds
  "13-875": usdaPortionDensity("FDC 170922 (Spices, coriander seed)", "tbsp", 5.0),
  // Curry powder
  "13-876": usdaPortionDensity("FDC 170924 (Spices, curry powder)", "tbsp", 6.3),
  // Nutmeg, ground
  "13-877": usdaPortionDensity("FDC 171326 (Spices, nutmeg, ground)", "tbsp", 7.0),
  // Oregano, dried, ground
  "13-878": usdaPortionDensity(
    "FDC 171328 (Spices, oregano, dried)",
    "tsp",
    1.8,
    ", ground",
    "; USDA lists no tablespoon of ground oregano",
  ),
  // Paprika
  "13-879": usdaPortionDensity("FDC 171329 (Spices, paprika)", "tbsp", 6.8),
  // Pepper, black
  "13-880": usdaPortionDensity("FDC 170931 (Spices, pepper, black)", "tbsp", 6.9, ", ground"),
  // Pepper, white
  "13-881": usdaPortionDensity("FDC 170933 (Spices, pepper, white)", "tbsp", 7.1, ", ground"),
  // Rosemary, dried
  "13-882": usdaPortionDensity("FDC 171333 (Spices, rosemary, dried)", "tbsp", 3.3),
  // Thyme, dried, ground
  "13-883": usdaPortionDensity("FDC 170938 (Spices, thyme, dried)", "tbsp", 4.3, ", ground"),
  // Cumin seeds
  "13-889": usdaPortionDensity("FDC 170923 (Spices, cumin seed)", "tbsp", 6.0, ", whole"),
  // Peanut butter, smooth
  "14-892": usdaPortionDensity(
    "FDC 174266 (Peanut butter, smooth style, with salt) and FDC 172470 (Peanut butter, smooth style, without salt)",
    "cup",
    258,
    "",
    "; both foods weigh the same, and their 2 tbsp row of 32 g gives 1.08",
  ),
  // Syrup, corn, dark
  "17-064": usdaPortionDensity(
    "FDC 168836 (Syrups, corn, dark)",
    "cup",
    328,
    "",
    "; its 1 tbsp row is a whole 20 g, which rounds too coarsely to use",
  ),
  // Vinegar
  "17-339": usdaPortionDensity(
    "FDC 173469 (Vinegar, cider) and FDC 172240 (Vinegar, red wine)",
    "cup",
    239,
    "",
    "; FDC 172237 (Vinegar, distilled) is 238 g, which gives the same figure to 2 places",
  ),
  // Baking powder
  "17-355": usdaPortionDensity(
    "FDC 172803 (Leavening agents, baking powder, double-acting, sodium aluminum sulfate) and FDC 172804 (Leavening agents, baking powder, double-acting, straight phosphate)",
    "tsp",
    4.6,
    "",
    "; both foods weigh the same",
  ),
  // Bicarbonate of soda
  "17-356": usdaPortionDensity("FDC 175040 (Leavening agents, baking soda)", "tsp", 4.6),
  // Cream of tartar
  "17-358": usdaPortionDensity("FDC 175041 (Leavening agents, cream of tartar)", "tsp", 3.0),
  // Mustard powder
  "17-362": usdaPortionDensity(
    "FDC 170929 (Spices, mustard seed, ground)",
    "tbsp",
    6.3,
    "",
    "; mustard powder is ground mustard seed",
  ),
  // Mustard, smooth
  "17-364": usdaPortionDensity(
    "FDC 172234 (Mustard, prepared, yellow)",
    "cup",
    249,
    "",
    "; prepared yellow mustard stands in for smooth mustard",
  ),
  // Salt
  "17-367": usdaPortionDensity(
    "FDC 173468 (Salt, table)",
    "cup",
    292,
    "",
    "; its 1 tbsp row of 18 g gives 1.22",
  ),
  // Yeast, dried
  "17-379": usdaPortionDensity(
    "FDC 175043 (Leavening agents, yeast, baker's, active dry)",
    "tbsp",
    12.0,
  ),
  // Mayonnaise, standard, retail
  "17-654": usdaPortionDensity(
    "FDC 171009 (Salad dressing, mayonnaise, regular)",
    "cup",
    220,
    "",
    "; its 1 tbsp row of 13.8 g gives 0.93",
  ),
  // Soy sauce, light and dark varieties
  "17-721": usdaPortionDensity(
    "FDC 174277 (Soy sauce made from soy and wheat (shoyu))",
    "cup",
    255,
    "",
    "; its 1 tbsp row of 16 g gives 1.08",
  ),
};

const lookUp = <Entry>(table: Readonly<Record<string, Entry>>, key: string): Entry | undefined =>
  Object.hasOwn(table, key) ? table[key] : undefined;

/** The entry for the longest listed prefix of a CoFID group code, so BAH uses BAH, else BA, else B. */
const findGroupEntry = (groupCode: string): CofidGroupEntry | undefined => {
  for (let length = groupCode.length; length > 0; length -= 1) {
    const entry = lookUp(COFID_GROUP_DENSITIES, groupCode.slice(0, length));
    if (entry !== undefined) {
      return entry;
    }
  }
  return undefined;
};

/**
 * A food's density in grams per millilitre and where it came from, or null when no density applies.
 * Null does not mean the food cannot be measured in millilitres: a food whose nutrient basis is per_100ml
 * (CoFID group Q) is measured in millilitres without a density, so check the basis before treating null as
 * "no volume measure".
 */
export const estimateDensity = (
  food: Pick<Food, "source" | "source_ref" | "food_group" | "density_g_per_ml">,
): DensityEstimate | null => {
  if (food.density_g_per_ml !== null) {
    return { gPerMl: food.density_g_per_ml, basis: "food" };
  }
  if (food.source !== "cofid") {
    return null;
  }
  const override =
    food.source_ref === null ? undefined : lookUp(COFID_DENSITY_OVERRIDES, food.source_ref);
  if (override !== undefined) {
    return { gPerMl: override.gPerMl, basis: "override" };
  }
  const group = food.food_group === null ? undefined : findGroupEntry(food.food_group);
  if (group === undefined || group.gPerMl === null) {
    return null;
  }
  return { gPerMl: group.gPerMl, basis: "group" };
};
