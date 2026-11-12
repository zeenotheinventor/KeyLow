import { assertEquals } from "@std/assert";

import { foodView } from "./foodView.ts";

const food = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Chicken stir fry",
  brand: null,
  source: "off",
  basis: "per_100g" as const,
  kcal: 400,
  protein_g: 20,
  fat_g: 10,
  carbs_g: 30,
  fibre_g: 2,
};

const portionRow = (label: string, grams: number, overrides: Record<string, unknown> = {}) => ({
  id: "00000000-0000-4000-8000-000000000501",
  food_id: food.id,
  owner_id: null,
  label,
  grams,
  ml: null,
  is_default: true,
  position: 0,
  created_at: "2026-11-10T10:00:00+00:00",
  ...overrides,
});

// 400 kcal per 100 g is in the 300 kcal band, so the app's own estimate is 40 g.
const generatedEstimate = portionRow("1 typical serving", 40);

Deno.test("foodView marks the estimate the app generated as estimated", () => {
  const view = foodView(food, [generatedEstimate]);

  assertEquals(view.portions, [
    { id: generatedEstimate.id, label: "1 typical serving", grams: 40, ml: null, estimated: true },
  ]);
});

Deno.test("foodView leaves a measured portion without an estimated field", () => {
  const view = foodView(food, [portionRow("1 pack", 250)]);

  assertEquals(view.portions, [
    { id: generatedEstimate.id, label: "1 pack", grams: 250, ml: null },
  ]);
});

const person = "00000000-0000-4000-8000-0000000000a1";

Deno.test(
  "foodView does not mark a portion the person typed, even when it starts 1 typical",
  () => {
    const view = foodView(food, [portionRow("1 typical slice", 35, { owner_id: person })]);

    assertEquals(view.portions, [
      { id: generatedEstimate.id, label: "1 typical slice", grams: 35, ml: null },
    ]);
  },
);

Deno.test("foodView marks the person's own portion when it is the one the app generated", () => {
  const view = foodView(food, [portionRow("1 typical serving", 40, { owner_id: person })]);

  assertEquals(
    view.portions?.map((portion) => "estimated" in portion),
    [true],
  );
});

Deno.test("foodView marks a shared estimate that sits beside a pack chip", () => {
  const view = foodView(food, [
    portionRow("1 typical serving", 75),
    portionRow("1 bag", 2000, { is_default: false, position: 1 }),
  ]);

  assertEquals(
    view.portions?.map((portion) => "estimated" in portion),
    [true, false],
  );
});

Deno.test("foodView marks a shared category estimate such as 1 typical burger", () => {
  const view = foodView(food, [portionRow("1 typical burger", 200)]);

  assertEquals(
    view.portions?.map((portion) => "estimated" in portion),
    [true],
  );
});

Deno.test("foodView keeps portions null when they were not looked up", () => {
  assertEquals(foodView(food, null).portions, null);
});
