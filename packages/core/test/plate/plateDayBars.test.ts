import { describe, expect, it } from "vitest";

import { banana, chickenAndRice, greekYoghurt, semiSkimmedMilk } from "./sample";
import {
  plateDayBars,
  plateItemOfHit,
  plateItemOfRecipe,
  plateTotals,
  setPlateQuantity,
} from "../../src/plate";

import type { PlateHit, PlateItem } from "../../src/plate";

const noPortion = {
  default_portion_id: null,
  default_portion_label: null,
  default_portion_grams: null,
  default_portion_ml: null,
} as const;

// The over plate's two extra foods, per 100 g with no portion so one is 100 g: 430 and 130 kcal.
const naan: PlateHit = {
  id: "00000000-0000-4000-8000-0000000000f1",
  name: "Naan bread",
  basis: "per_100g",
  kcal: 430,
  protein_g: 12,
  carbs_g: 72,
  fat_g: 8.5,
  ...noPortion,
};
const crisps: PlateHit = {
  id: "00000000-0000-4000-8000-0000000000f3",
  name: "Meal deal crisps",
  basis: "per_100g",
  kcal: 130,
  protein_g: 2,
  carbs_g: 15,
  fat_g: 7,
  ...noPortion,
};

// The plate boards' day: 1,039 kcal, P 86, C 129, F 19 eaten against 2,200, 160, 220 and 70.
const day = [
  {
    nutrients: {
      kcal: 1039,
      protein_g: 86,
      carbs_g: 129,
      fat_g: 19,
      fibre_g: null,
      sugar_g: null,
      sat_fat_g: null,
      salt_g: null,
    },
  },
];
const targets = { kcal: 2200, protein_g: 160, carbs_g: 220, fat_g: 70 };
const now = new Date("2026-10-15T19:20:00.000Z");

const evening: PlateItem[] = setPlateQuantity(
  [
    plateItemOfRecipe({ key: "recipe", recipe: chickenAndRice }),
    plateItemOfHit("yoghurt", greekYoghurt),
    plateItemOfHit("banana", banana),
    plateItemOfHit("milk", semiSkimmedMilk),
  ],
  "milk",
  "200",
);

const bars = (
  items: readonly PlateItem[],
  overrides: { day?: string; timeZone?: string | null } = {},
) =>
  plateDayBars({
    entries: day,
    targets,
    totals: plateTotals(items),
    day: overrides.day ?? "2026-10-15",
    timeZone: overrides.timeZone === undefined ? "Europe/London" : overrides.timeZone,
    now,
  });

describe("plateDayBars", () => {
  it("should carry the plate's share after what was eaten, and stay within the targets", () => {
    const { bars: result } = bars(evening);
    const [calories] = result;

    expect(calories?.eaten).toBe(1039);
    expect(Math.round((calories?.plate ?? 0) + (calories?.eaten ?? 0))).toBe(1697);
    expect(result.some((bar) => bar.isOver)).toBe(false);
  });

  it("should go over calories and carbs when the naan joins the plate", () => {
    const over = [...evening, plateItemOfHit("naan", naan), plateItemOfHit("crisps", crisps)];
    const { bars: result } = bars(over);

    expect(result.filter((bar) => bar.isOver).map((bar) => bar.key)).toEqual(["calories", "carbs"]);
  });

  it("should show the day alone when the plate is empty", () => {
    const { bars: result } = bars([]);

    expect(result.map((bar) => bar.plate)).toEqual([0, 0, 0, 0]);
  });

  it("should title today, yesterday and an older day", () => {
    expect(bars([]).dayTitle).toBe("Today");
    expect(bars([], { day: "2026-10-14" }).dayTitle).toBe("Yesterday");
    expect(bars([], { day: "2026-10-07" }).dayTitle).toBe("Wed 7 Oct");
  });

  it("should read the day in UTC when the profile has no time zone", () => {
    const lateNow = new Date("2026-10-15T23:30:00.000Z");
    const result = plateDayBars({
      entries: day,
      targets,
      totals: plateTotals([]),
      day: "2026-10-16",
      timeZone: null,
      now: lateNow,
    });

    // 23:30 UTC is already the 16th in London, but with no zone the day is UTC's, so the 16th is tomorrow.
    expect(result.dayTitle).toBe("Tomorrow");
  });
});
