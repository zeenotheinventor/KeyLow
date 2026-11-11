import { describe, expect, it } from "vitest";

import { buildLogEntry } from "../../src/diary/buildLogEntry";
import {
  PORTION_ESTIMATE_BOWLS,
  PORTION_ESTIMATE_PLATES,
  estimatePortions,
} from "../../src/foods/portionEstimate";
import { buildFood } from "../../src/testing";

import type {
  PortionEstimateFoodType,
  PortionEstimateInput,
  PortionEstimateItemInput,
} from "../../src/foods/portionEstimate";
import type { Food } from "../../src/schemas/food";

const foodOf = (id: string, overrides: Partial<Food> = {}): Food =>
  buildFood({ id, name: `Food ${id}`, ...overrides });

const itemOf = (
  food: Food | null,
  overrides: Partial<PortionEstimateItemInput> = {},
): PortionEstimateItemInput => ({
  food_id: food?.id ?? "missing",
  food,
  food_type: "vegetables",
  share_percent: 100,
  kcal: null,
  ...overrides,
});

const inputOf = (
  items: PortionEstimateItemInput[],
  overrides: Partial<PortionEstimateInput> = {},
): PortionEstimateInput => ({
  container: "plate",
  diameter_cm: null,
  radius_cm: null,
  depth_cm: null,
  fill: null,
  items,
  ...overrides,
});

function amountsOf(input: PortionEstimateInput) {
  const result = estimatePortions(input);
  if (result.status !== "ok") {
    throw new Error(`Expected ok, got ${result.status}`);
  }
  return result;
}

function onlyItemOf(input: PortionEstimateInput) {
  const [item] = amountsOf(input).items;
  if (item === undefined || item.status !== "ok") {
    throw new Error("Expected one estimated item");
  }
  return item;
}

describe("the default containers", () => {
  it("states the plate wells the ticket lists", () => {
    expect(PORTION_ESTIMATE_PLATES.small_plate.wellAreaSquareCm).toBeCloseTo(201, 0);
    expect(PORTION_ESTIMATE_PLATES.plate.wellAreaSquareCm).toBeCloseTo(340, 0);
    expect(PORTION_ESTIMATE_PLATES.large_plate.wellAreaSquareCm).toBeCloseTo(452, 0);
  });

  it("states the bowl volumes the ticket lists", () => {
    expect(PORTION_ESTIMATE_BOWLS.small_bowl.volumeMl).toBeCloseTo(348, 0);
    expect(PORTION_ESTIMATE_BOWLS.bowl.volumeMl).toBeCloseTo(510, 0);
    expect(PORTION_ESTIMATE_BOWLS.large_bowl.volumeMl).toBeCloseTo(1070, 0);
  });

  it("uses each default plate for a share of 100 % of a food of 1 g per cm2", () => {
    const flat = foodOf("a");
    const grams = (container: "small_plate" | "plate" | "large_plate") =>
      onlyItemOf(inputOf([itemOf(flat, { food_type: "curry_stew_sauce" })], { container })).amount;
    // curry is 2.0 g per cm2 covered, rounded to 5 g
    expect(grams("small_plate")).toBe(400);
    expect(grams("plate")).toBe(680);
    expect(grams("large_plate")).toBe(905);
  });

  it("uses each default bowl at the default fill of 75 %", () => {
    const soup = foodOf("a");
    const grams = (container: "small_bowl" | "bowl" | "large_bowl") =>
      onlyItemOf(inputOf([itemOf(soup, { food_type: "soup_liquid" })], { container })).amount;
    expect(grams("small_bowl")).toBe(260);
    expect(grams("bowl")).toBe(385);
    expect(grams("large_bowl")).toBe(805);
  });
});

describe("a size the person gave", () => {
  const curry = (overrides: Partial<PortionEstimateInput>) =>
    onlyItemOf(inputOf([itemOf(foodOf("a"), { food_type: "curry_stew_sauce" })], overrides)).amount;

  it("takes a plate diameter in place of the default", () => {
    // radius 13.5, well radius 10.8, area 366.4 cm2, curry 2 g per cm2
    expect(curry({ diameter_cm: 27 })).toBe(735);
  });

  it("takes a plate radius in place of the default", () => {
    expect(curry({ radius_cm: 13.5 })).toBe(735);
  });

  it("lets a diameter win over a radius", () => {
    expect(curry({ diameter_cm: 27, radius_cm: 5 })).toBe(735);
  });

  it("takes a bowl diameter and keeps the default depth", () => {
    const soup = (overrides: Partial<PortionEstimateInput>) =>
      onlyItemOf(
        inputOf([itemOf(foodOf("a"), { food_type: "soup_liquid" })], {
          container: "bowl",
          ...overrides,
        }),
      ).amount;
    // a = 8, h = 5.5: V = pi 5.5 (192 + 30.25) / 6 = 640 ml, 75 % is 480
    expect(soup({ diameter_cm: 16 })).toBe(480);
  });

  it("takes a bowl depth", () => {
    const soup = onlyItemOf(
      inputOf([itemOf(foodOf("a"), { food_type: "soup_liquid" })], {
        container: "bowl",
        depth_cm: 8,
      }),
    ).amount;
    // a = 7, h = 8: V = pi 8 (147 + 64) / 6 = 883.8 ml, 75 % is 662.8
    expect(soup).toBe(665);
  });
});

describe("the bowl fill", () => {
  const soup = (fill: "half" | "most" | "full" | null) =>
    onlyItemOf(
      inputOf([itemOf(foodOf("a"), { food_type: "soup_liquid" })], { container: "bowl", fill }),
    ).amount;

  it("is 50 % for half, 75 % for most and 90 % for full", () => {
    expect(soup("half")).toBe(255);
    expect(soup("most")).toBe(385);
    expect(soup("full")).toBe(460);
  });

  it("defaults to most", () => {
    expect(soup(null)).toBe(soup("most"));
  });
});

describe("each food type", () => {
  const plateGramsPerSquareCm: [PortionEstimateFoodType, number][] = [
    ["leafy_salad", 0.3],
    ["vegetables", 1.2],
    ["rice_grains_pasta", 1.75],
    ["potatoes", 1.95],
    ["curry_stew_sauce", 2],
    ["meat_fish", 1.7],
    ["bread_bakery", 1.2],
    ["dessert", 2.1],
    ["cereal_dry", 0.6],
    ["yogurt_porridge", 2.1],
    ["other", 1.6],
  ];
  const bowlDensity: [PortionEstimateFoodType, number][] = [
    ["leafy_salad", 0.1],
    ["vegetables", 0.6],
    ["rice_grains_pasta", 0.7],
    ["potatoes", 0.65],
    ["curry_stew_sauce", 1],
    ["meat_fish", 0.85],
    ["bread_bakery", 0.3],
    ["dessert", 0.6],
    ["soup_liquid", 1],
    ["cereal_dry", 0.3],
    ["yogurt_porridge", 1.05],
    ["other", 0.8],
  ];
  const roundedTo5 = (value: number) => Math.max(5, Math.round(value / 5) * 5);

  for (const [foodType, perSquareCm] of plateGramsPerSquareCm) {
    it(`puts ${foodType} on a plate at ${perSquareCm} g per cm2`, () => {
      const item = onlyItemOf(
        inputOf([itemOf(foodOf("a"), { food_type: foodType, share_percent: 50 })]),
      );
      const wellArea = PORTION_ESTIMATE_PLATES.plate.wellAreaSquareCm;
      expect(item.amount).toBe(roundedTo5(wellArea * 0.5 * perSquareCm));
    });
  }

  for (const [foodType, density] of bowlDensity) {
    it(`puts ${foodType} in a bowl at ${density} g per ml`, () => {
      const item = onlyItemOf(
        inputOf([itemOf(foodOf("a"), { food_type: foodType, share_percent: 50 })], {
          container: "bowl",
        }),
      );
      expect(item.amount).toBe(
        roundedTo5(PORTION_ESTIMATE_BOWLS.bowl.volumeMl * 0.75 * 0.5 * density),
      );
    });
  }

  it("refuses soup on a plate", () => {
    const [item] = amountsOf(inputOf([itemOf(foodOf("a"), { food_type: "soup_liquid" })])).items;
    expect(item).toMatchObject({ status: "error", code: "bowl_only" });
  });
});

describe("the worked plate of the ticket", () => {
  it("gives about 180 g of rice, 205 g of curry, 60 g of carrots and 15 g of lettuce", () => {
    const result = amountsOf(
      inputOf([
        itemOf(foodOf("rice"), { food_type: "rice_grains_pasta", share_percent: 30 }),
        itemOf(foodOf("curry"), { food_type: "curry_stew_sauce", share_percent: 30 }),
        itemOf(foodOf("carrots"), { food_type: "vegetables", share_percent: 15 }),
        itemOf(foodOf("lettuce"), { food_type: "leafy_salad", share_percent: 15 }),
      ]),
    );
    expect(result.sharesScaled).toBe(false);
    expect(result.items.map((item) => (item.status === "ok" ? item.amount : null))).toEqual([
      180, 205, 60, 15,
    ]);
    expect(result.items.every((item) => item.status === "ok" && item.unit === "g")).toBe(true);
  });
});

describe("shares", () => {
  it("scales shares that add up to more than 100 down to 100 and says so", () => {
    const result = amountsOf(
      inputOf([
        itemOf(foodOf("a"), { food_type: "curry_stew_sauce", share_percent: 80 }),
        itemOf(foodOf("b"), { food_type: "curry_stew_sauce", share_percent: 80 }),
      ]),
    );
    expect(result.sharesScaled).toBe(true);
    // each is 50 % of 340 cm2 at 2 g per cm2
    expect(result.items.map((item) => (item.status === "ok" ? item.amount : null))).toEqual([
      340, 340,
    ]);
  });

  it("leaves shares that add up to less than 100 as they are", () => {
    const result = amountsOf(inputOf([itemOf(foodOf("a"), { share_percent: 10 })]));
    expect(result.sharesScaled).toBe(false);
    expect(result.items[0]).toMatchObject({ amount: 40 });
  });

  it("rounds to the nearest 5 g with a minimum of 5 g", () => {
    const tiny = onlyItemOf(
      inputOf([itemOf(foodOf("a"), { food_type: "leafy_salad", share_percent: 1 })]),
    );
    // 340 x 0.01 x 0.3 is 1 g
    expect(tiny.amount).toBe(5);
    const plain = onlyItemOf(inputOf([itemOf(foodOf("a"), { share_percent: 10 })]));
    // 340 x 0.1 x 1.2 is 40.8 g
    expect(plain.amount).toBe(40);
  });

  it("does not count an item with calories against the shares", () => {
    const result = amountsOf(
      inputOf([
        itemOf(foodOf("a"), { food_type: "curry_stew_sauce", share_percent: 100 }),
        itemOf(foodOf("b", { kcal: 100 }), { share_percent: 100, kcal: 50 }),
      ]),
    );
    expect(result.sharesScaled).toBe(false);
  });
});

describe("a food per 100 ml", () => {
  const milk = foodOf("milk", { basis: "per_100ml", kcal: 50 });

  it("answers in ml from the area and heap depth on a plate, with no density", () => {
    const item = onlyItemOf(
      inputOf([itemOf(milk, { food_type: "curry_stew_sauce", share_percent: 50 })]),
    );
    // 340 x 2.0 cm x 0.5
    expect(item).toMatchObject({ unit: "ml", amount: 340 });
  });

  it("answers in ml from the volume, fill and share in a bowl, with no density", () => {
    const item = onlyItemOf(
      inputOf([itemOf(milk, { food_type: "dessert", share_percent: 50 })], { container: "bowl" }),
    );
    // 510 x 0.75 x 0.5 is 191
    expect(item).toMatchObject({ unit: "ml", amount: 190 });
  });

  it("refuses a soup on a plate", () => {
    const [item] = amountsOf(inputOf([itemOf(milk, { food_type: "soup_liquid" })])).items;
    expect(item).toMatchObject({ status: "error", code: "bowl_only" });
  });
});

describe("a known calorie figure", () => {
  it("scales a soup of 50 kcal per 100 g to 200 g for 100 kcal", () => {
    const soup = foodOf("soup", { kcal: 50 });
    const item = onlyItemOf(
      inputOf([itemOf(soup, { food_type: "soup_liquid", share_percent: null, kcal: 100 })], {
        container: null,
      }),
    );
    expect(item).toMatchObject({ unit: "g", amount: 200, method: "kcal" });
    expect(item.nutrients.kcal).toBeCloseTo(100, 5);
  });

  it("rounds to the gram and stays within 1 % of the figure for a crumble of 168 kcal", () => {
    const crumble = foodOf("crumble", { kcal: 237 });
    const item = onlyItemOf(
      inputOf([itemOf(crumble, { food_type: "dessert", share_percent: null, kcal: 168 })], {
        container: null,
      }),
    );
    // 168 / 237 x 100 is 70.89 g
    expect(item.amount).toBe(71);
    expect(Math.abs((item.nutrients.kcal ?? 0) - 168) / 168).toBeLessThan(0.01);
  });

  it("answers ml for a food per 100 ml", () => {
    const juice = foodOf("juice", { basis: "per_100ml", kcal: 40 });
    const item = onlyItemOf(
      inputOf([itemOf(juice, { share_percent: null, kcal: 100 })], { container: null }),
    );
    expect(item).toMatchObject({ unit: "ml", amount: 250, method: "kcal" });
  });

  it("wins over a share", () => {
    const item = onlyItemOf(
      inputOf([itemOf(foodOf("a", { kcal: 100 }), { share_percent: 90, kcal: 50 })]),
    );
    expect(item).toMatchObject({ method: "kcal", amount: 50 });
  });

  it("answers no_kcal for a food with no kcal", () => {
    const [item] = amountsOf(
      inputOf([itemOf(foodOf("a", { kcal: null }), { share_percent: null, kcal: 100 })], {
        container: null,
      }),
    ).items;
    expect(item).toMatchObject({ status: "error", code: "no_kcal" });
  });

  it("answers no_kcal for a food of 0 kcal, which no amount can reach", () => {
    const [item] = amountsOf(
      inputOf([itemOf(foodOf("a", { kcal: 0 }), { share_percent: null, kcal: 100 })], {
        container: null,
      }),
    ).items;
    expect(item).toMatchObject({ status: "error", code: "no_kcal" });
  });

  it("still sizes a share of a food with no kcal, and leaves its kcal null", () => {
    const item = onlyItemOf(
      inputOf([itemOf(foodOf("a", { kcal: null, protein_g: null }), { share_percent: 50 })]),
    );
    expect(item.nutrients.kcal).toBeNull();
    expect(item.nutrients.protein_g).toBeNull();
  });

  it("flags an amount of more than twice a bowl", () => {
    const soup = foodOf("soup", { kcal: 10 });
    const big = onlyItemOf(
      inputOf([itemOf(soup, { food_type: "soup_liquid", share_percent: null, kcal: 1100 })], {
        container: "bowl",
      }),
    );
    // 11,000 g against a 510 ml bowl
    expect(big.largerThanContainer).toBe(true);
    const fine = onlyItemOf(
      inputOf([itemOf(soup, { food_type: "soup_liquid", share_percent: null, kcal: 100 })], {
        container: "bowl",
      }),
    );
    expect(fine.largerThanContainer).toBe(false);
  });

  it("flags an amount of more than twice a plate of that food", () => {
    const rice = foodOf("rice", { kcal: 100 });
    const big = onlyItemOf(
      inputOf([itemOf(rice, { food_type: "rice_grains_pasta", share_percent: null, kcal: 1500 })]),
    );
    // 1,500 g against 340 x 1.75 = 595 g
    expect(big.largerThanContainer).toBe(true);
  });

  it("does not flag when no container is given", () => {
    const item = onlyItemOf(
      inputOf([itemOf(foodOf("a", { kcal: 10 }), { share_percent: null, kcal: 1000 })], {
        container: null,
      }),
    );
    expect(item.largerThanContainer).toBe(false);
  });
});

describe("a food per portion", () => {
  it("is refused with counted_food, by calories and by share", () => {
    const meal = foodOf("meal", { basis: "per_portion" });
    const result = amountsOf(
      inputOf([
        itemOf(meal, { share_percent: 50 }),
        itemOf(meal, { share_percent: null, kcal: 300 }),
      ]),
    );
    expect(result.items).toEqual([
      { status: "error", food_id: meal.id, code: "counted_food" },
      { status: "error", food_id: meal.id, code: "counted_food" },
    ]);
  });
});

describe("a food that is not there", () => {
  it("answers not_found for that item and still sizes the rest", () => {
    const result = amountsOf(
      inputOf([itemOf(null, { share_percent: 5 }), itemOf(foodOf("a"), { share_percent: 10 })]),
    );
    expect(result.items[0]).toEqual({ status: "error", food_id: "missing", code: "not_found" });
    expect(result.items[1]).toMatchObject({ status: "ok", amount: 40 });
  });
});

describe("the nutrients", () => {
  const timing = { loggedAt: "2026-11-11T12:00:00+00:00", localDate: "2026-11-11" };

  it("equal what log_entry would snapshot for the same food and grams", () => {
    const food = foodOf("a", {
      kcal: 187,
      protein_g: 6.2,
      fat_g: 3.1,
      carbs_g: 33.3,
      fibre_g: 2.4,
    });
    const item = onlyItemOf(
      inputOf([itemOf(food, { food_type: "rice_grains_pasta", share_percent: 30 })]),
    );
    const entry = buildLogEntry({ food, quantity: item.amount, unit: "g", ...timing });
    expect(item.nutrients).toEqual({
      kcal: entry.nutrients.kcal,
      protein_g: entry.nutrients.protein_g,
      fat_g: entry.nutrients.fat_g,
      carbs_g: entry.nutrients.carbs_g,
    });
  });

  it("equal the snapshot for a food per 100 ml in ml", () => {
    const food = foodOf("a", { basis: "per_100ml", kcal: 45, protein_g: 3.4 });
    const item = onlyItemOf(inputOf([itemOf(food, { share_percent: 50 })], { container: "bowl" }));
    const entry = buildLogEntry({ food, quantity: item.amount, unit: "ml", ...timing });
    expect(item.nutrients.kcal).toBe(entry.nutrients.kcal);
    expect(item.nutrients.protein_g).toBe(entry.nutrients.protein_g);
  });

  it("keeps a null as null", () => {
    const item = onlyItemOf(
      inputOf([itemOf(foodOf("a", { protein_g: null, fat_g: null }), { share_percent: 50 })]),
    );
    expect(item.nutrients.protein_g).toBeNull();
    expect(item.nutrients.fat_g).toBeNull();
  });
});

describe("input that is refused", () => {
  const food = foodOf("a");
  const refused = (input: PortionEstimateInput) => {
    const result = estimatePortions(input);
    return result.status === "invalid_input" ? result.fields : null;
  };

  it("needs a container for a share", () => {
    expect(refused(inputOf([itemOf(food)], { container: null }))).toEqual(["container"]);
  });

  it("needs a share or calories on every item", () => {
    expect(refused(inputOf([itemOf(food, { share_percent: null, kcal: null })]))).toEqual([
      "items",
    ]);
  });

  it("takes 1 to 8 items", () => {
    expect(refused(inputOf([]))).toEqual(["items"]);
    expect(refused(inputOf(Array.from({ length: 9 }, () => itemOf(food))))).toEqual(["items"]);
  });

  it("takes whole-percent shares of 1 to 100", () => {
    for (const share_percent of [0, 101, 12.5, -3]) {
      expect(refused(inputOf([itemOf(food, { share_percent })]))).toEqual(["items"]);
    }
  });

  it("takes calories above 0", () => {
    expect(
      refused(inputOf([itemOf(food, { share_percent: null, kcal: 0 })], { container: null })),
    ).toEqual(["items"]);
  });

  it("takes a plate diameter of 10 to 40 cm", () => {
    expect(refused(inputOf([itemOf(food)], { diameter_cm: 9.9 }))).toEqual(["diameter_cm"]);
    expect(refused(inputOf([itemOf(food)], { diameter_cm: 40.1 }))).toEqual(["diameter_cm"]);
    expect(refused(inputOf([itemOf(food)], { diameter_cm: 10 }))).toBeNull();
    expect(refused(inputOf([itemOf(food)], { diameter_cm: 40 }))).toBeNull();
  });

  it("takes a plate radius of 5 to 20 cm", () => {
    expect(refused(inputOf([itemOf(food)], { radius_cm: 4.9 }))).toEqual(["radius_cm"]);
    expect(refused(inputOf([itemOf(food)], { radius_cm: 20.1 }))).toEqual(["radius_cm"]);
  });

  it("takes a bowl diameter of 8 to 30 cm and a depth of 2 to 15 cm", () => {
    const bowl = { container: "bowl" } as const;
    expect(refused(inputOf([itemOf(food)], { ...bowl, diameter_cm: 7.9 }))).toEqual([
      "diameter_cm",
    ]);
    expect(refused(inputOf([itemOf(food)], { ...bowl, diameter_cm: 30.1 }))).toEqual([
      "diameter_cm",
    ]);
    expect(refused(inputOf([itemOf(food)], { ...bowl, depth_cm: 1.9 }))).toEqual(["depth_cm"]);
    expect(refused(inputOf([itemOf(food)], { ...bowl, depth_cm: 15.1 }))).toEqual(["depth_cm"]);
  });
});
