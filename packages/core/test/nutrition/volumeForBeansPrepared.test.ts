import { describe, expect, it } from "vitest";

import { buildLogEntry } from "../../src/diary/buildLogEntry";
import { COFID_DENSITY_OVERRIDES } from "../../src/nutrition/density";
import {
  ML_PER_TBSP,
  SPOON_PORTIONS,
  canMeasureByVolume,
  densityForLogging,
} from "../../src/nutrition/volume";
import { buildFood } from "../../src/testing";

const [, tablespoon] = SPOON_PORTIONS;
if (tablespoon === undefined) {
  throw new Error("The spoon portions must include a tablespoon");
}

// The US cup USDA FoodData Central weighs its household portions in, in millilitres.
const US_CUP_ML = 236.588;

/** Canned, fresh and prepared beans, sprouts, soya products and houmous are all in CoFID food group DB. */
const BEANS_AND_PREPARED_FOOD_GROUP = "DB";

/** A CoFID food as the importer stores it: no density of its own, in the given food group. */
const cofidFood = (sourceRef: string, foodGroup = BEANS_AND_PREPARED_FOOD_GROUP) =>
  buildFood({
    source: "cofid",
    source_ref: sourceRef,
    food_group: foodGroup,
    basis: "per_100g",
    density_g_per_ml: null,
  });

// [CoFID code, name, grams in 1 US cup as USDA FoodData Central SR Legacy weighs it, the SR Legacy row cited].
// Each food takes the SR Legacy row in its own state: canned and drained, the whole can, raw, boiled or stir-fried.
const foodsWithCitedCup: readonly (readonly [string, string, number, string])[] = [
  [
    "13-670",
    "Beans, chick peas, canned, re-heated, drained",
    152,
    "FDC 173801 (Chickpeas (garbanzo beans, bengal gram), mature seeds, canned, drained, rinsed in tap water)",
  ],
  [
    "13-532",
    "Baked beans, canned in tomato sauce",
    254,
    "FDC 175182 (Beans, baked, canned, plain or vegetarian)",
  ],
  [
    "13-535",
    "Baked beans, canned in tomato sauce, reduced sugar, reduced salt",
    253,
    "FDC 168128 (Beans, baked, canned, no salt added)",
  ],
  [
    "13-515",
    "Beans, green, boiled in unsalted water",
    125,
    "FDC 169141 (Beans, snap, green, cooked, boiled, drained, without salt)",
  ],
  ["13-064", "Beans, broad, whole, raw", 109, "FDC 170377 (Broadbeans, immature seeds, raw)"],
  [
    "13-667",
    "Beans, edamame, frozen, boiled in unsalted water",
    155,
    "FDC 168411 (Edamame, frozen, prepared)",
  ],
  ["13-426", "Beansprouts, mung, raw", 104, "FDC 169957 (Mung beans, mature seeds, sprouted, raw)"],
  [
    "13-580",
    "Beansprouts, mung, boiled in unsalted water",
    124,
    "FDC 169137 (Mung beans, mature seeds, sprouted, cooked, boiled, drained, without salt)",
  ],
  [
    "13-567",
    "Beansprouts, mung, stir-fried in rapeseed oil",
    124,
    "FDC 169138 (Mung beans, mature seeds, sprouted, cooked, stir-fried)",
  ],
  [
    "13-570",
    "Tofu, soya bean, steamed",
    248,
    "FDC 172476 (Tofu, raw, regular, prepared with calcium sulfate)",
  ],
  ["13-118", "Tempeh", 166, "FDC 174272 (Tempeh)"],
  ["13-556", "Houmous", 246, "FDC 174289 (Hummus, commercial)"],
];

// [CoFID code, name, why it has no density]: SR Legacy has no row in the food's own state and form.
const foodsWithoutCitedRow: readonly (readonly [string, string, string])[] = [
  [
    "13-660",
    "Beans, red kidney, canned in water, re-heated, drained",
    "drained rinsed row only, no can to check it",
  ],
  [
    "13-665",
    "Beans, haricot, canned, re-heated, drained",
    "SR canned white beans are solids and liquids",
  ],
  [
    "13-666",
    "Beans, cannellini, canned, re-heated, drained",
    "SR canned white beans are solids and liquids",
  ],
  [
    "13-559",
    "Beans, butter, canned, re-heated, drained",
    "SR canned lima beans are solids and liquids",
  ],
  ["13-578", "Baked beans, canned in barbecue sauce", "no barbecue sauce row"],
  ["13-579", "Baked beans, canned in tomato sauce, with pork sausages", "no pork sausage row"],
  ["13-108", "Beans, pinto, re-fried beans", "no single matching SR refried row"],
  ["13-514", "Beans, green, raw", "SR raw row is for 1/2 inch pieces, which CoFID does not say"],
  ["13-112", "Beans, runner, raw", "SR Legacy has no runner beans"],
  ["13-654", "Beans, runner, boiled in unsalted water", "SR Legacy has no runner beans"],
  ["13-648", "Beans, broad, whole, boiled in unsalted water", "SR boiled immature row has no cup"],
  ["13-049", "Beans, balor, ends trimmed, raw", "SR Legacy has no balor beans"],
  ["13-080", "Beans, cluster, raw", "SR Legacy has no cluster beans"],
  ["13-100", "Beans, papri, raw", "SR Legacy has no papri beans"],
  ["13-117", "Beans, sword, raw", "SR Legacy has no sword beans"],
  ["13-571", "Tofu, soya bean, steamed, fried", "SR fried tofu has only a piece row"],
  ["13-484", "Dahl, mixed, homemade", "a homemade dish with no single SR match"],
];

const citedDensity = (citedGrams: number) => Number((citedGrams / US_CUP_ML).toPrecision(3));

describe("volume measures for canned, fresh and prepared beans, sprouts, soya products and houmous", () => {
  it.each(foodsWithCitedCup)("should let %s (%s) be measured by volume", (code) => {
    expect(canMeasureByVolume(cofidFood(code))).toBe(true);
  });

  it.each(foodsWithCitedCup)(
    "should give %s (%s) the density of its cited cup, to 3 significant figures",
    (code, _name, citedGrams) => {
      expect(densityForLogging(cofidFood(code))).toBe(citedDensity(citedGrams));
    },
  );

  it.each(foodsWithCitedCup)(
    "should resolve 1 tbsp of %s (%s) to 15 ml at its density",
    (code, _name, citedGrams) => {
      const entry = buildLogEntry({
        food: cofidFood(code),
        quantity: 1,
        unit: "portion",
        portion: tablespoon,
        localDate: "2026-10-28",
        loggedAt: "2026-10-28T12:30:00+01:00",
      });

      expect(entry.resolved_grams).toBeCloseTo(citedDensity(citedGrams) * ML_PER_TBSP, 10);
    },
  );

  it.each(foodsWithCitedCup)(
    "should cite the SR Legacy row in the state of %s (%s)",
    (code, _name, citedGrams, citedRow) => {
      const source = COFID_DENSITY_OVERRIDES[code]?.source;

      expect(source).toContain(`${citedRow}: 1 cup`);
      expect(source).toContain(`weighs ${citedGrams} g`);
    },
  );

  it("should weigh raw mung beansprouts at 104 g a cup and boiled ones at 124 g a cup", () => {
    expect(densityForLogging(cofidFood("13-426"))).toBe(0.44);
    expect(densityForLogging(cofidFood("13-580"))).toBe(0.524);
  });

  it.each(foodsWithoutCitedRow)("should keep %s (%s) off the volume measures: %s", (code) => {
    expect(canMeasureByVolume(cofidFood(code))).toBe(false);
  });

  it("should keep dried green beans (13-608) off the volume measures, as SR Legacy has no dried snap beans", () => {
    expect(canMeasureByVolume(cofidFood("13-608", "DI"))).toBe(false);
  });
});
