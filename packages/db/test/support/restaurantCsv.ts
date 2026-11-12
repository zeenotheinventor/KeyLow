import { formatCsv } from "../../scripts/cofid/csv";
import { RESTAURANT_COLUMNS } from "../../scripts/restaurant/restaurantFoodsCsv";

export type RestaurantCsvCells = Readonly<Record<(typeof RESTAURANT_COLUMNS)[number], string>>;

/** A hand written row in the shape of restaurant-foods.csv: a chain that publishes the weight. */
export const testBurger: RestaurantCsvCells = {
  ref: "testchain-gb:test-burger",
  wave: "1",
  chain: "Test Chain",
  name: "Test Burger",
  portion_label: "1 burger",
  portion_grams: "215",
  weight_basis: "published",
  kcal: "500",
  protein_g: "26",
  fat_g: "25",
  sat_fat_g: "10",
  carbs_g: "45",
  sugars_g: "9",
  fibre_g: "3.5",
  salt_g: "2.1",
  published_kcal_per_100g: "232.6",
  source_url: "https://www.testchain.example/nutrition",
  retrieved_on: "2026-11-10",
};

/** A chain that publishes no weight: its figures stay per portion. It belongs to a later wave. */
export const testBucket: RestaurantCsvCells = {
  ...testBurger,
  ref: "otherchain-gb:test-bucket",
  wave: "2",
  chain: "Other Chain",
  name: "Test Bucket",
  portion_label: "1 bucket",
  portion_grams: "",
  weight_basis: "none",
  published_kcal_per_100g: "",
  source_url: "https://www.otherchain.example/nutrition",
};

/** Nando's publishes energy only, so its protein, fat and the rest are estimated from the ingredients. */
export const testNandosDish: RestaurantCsvCells = {
  ...testBucket,
  ref: "nandos-gb:test-dish",
  wave: "4",
  chain: "Nando's",
  name: "Test Dish",
  portion_label: "1 dish",
  source_url: "https://www.nandos.co.uk/food/menu",
};

export const restaurantCsvOf = (...rows: readonly RestaurantCsvCells[]): string =>
  formatCsv([
    [...RESTAURANT_COLUMNS],
    ...rows.map((row) => RESTAURANT_COLUMNS.map((column) => row[column])),
  ]);
