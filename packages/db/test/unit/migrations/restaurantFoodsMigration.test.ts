import { readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { renderRestaurantMigration } from "../../../scripts/restaurant/renderRestaurantMigration";
import { parseRestaurantCsv } from "../../../scripts/restaurant/restaurantFoodsCsv";

const packageUrl = new URL("../../../", import.meta.url);
const migrationsUrl = new URL("supabase/migrations/", packageUrl);

// Migrations are named by timestamp, so the last in name order is the newest, and it holds every row up to its wave.
const newestName = readdirSync(migrationsUrl)
  .filter((fileName) => fileName.endsWith("_restaurant_foods.sql"))
  .sort()
  .at(-1);
const newestSql =
  newestName === undefined ? "" : readFileSync(new URL(newestName, migrationsUrl), "utf8");
const waveOfNewest = Number(/import:restaurant emit-migration --wave (\d+) /.exec(newestSql)?.[1]);

describe("the committed restaurant foods migration", () => {
  it("should exist", () => {
    expect(newestName).toBeDefined();
  });

  it("should be what the CSV renders for its wave, so the migration cannot drift from the CSV", () => {
    const csv = readFileSync(new URL("data/restaurants/restaurant-foods.csv", packageUrl), "utf8");

    // Compared as a boolean so a mismatch does not print two long strings.
    const isUpToDate = renderRestaurantMigration(csv, waveOfNewest) === newestSql;
    expect(
      isUpToDate,
      "the restaurant CSV changed: generate a new migration as docs/runbooks/local-dev.md describes, and never edit an applied one",
    ).toBe(true);
  });

  it("should hold a food per portion for every row of the CSV up to its wave that has no weight", () => {
    const csv = readFileSync(new URL("data/restaurants/restaurant-foods.csv", packageUrl), "utf8");
    const rowsWithoutWeightUpToWave = parseRestaurantCsv(csv).filter(
      (row) => row.wave <= waveOfNewest && row.weight_basis === "none",
    );

    expect(rowsWithoutWeightUpToWave.length).toBeGreaterThan(0);
    expect(newestSql.split("'per_portion'")).toHaveLength(rowsWithoutWeightUpToWave.length + 1);
  });
});
