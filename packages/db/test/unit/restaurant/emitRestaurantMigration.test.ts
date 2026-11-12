import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { emitRestaurantMigration } from "../../../scripts/restaurant/emitRestaurantMigration";
import { renderRestaurantMigration } from "../../../scripts/restaurant/renderRestaurantMigration";
import { testBurger, restaurantCsvOf } from "../../support/restaurantCsv";

const csv = restaurantCsvOf(testBurger);

function setUp(): { csvPath: string; outputPath: string } {
  const directory = mkdtempSync(join(tmpdir(), "emit-restaurant-"));
  const csvPath = join(directory, "restaurant-foods.csv");
  writeFileSync(csvPath, csv);
  return { csvPath, outputPath: join(directory, "20261111010000_restaurant_foods.sql") };
}

describe("emitRestaurantMigration", () => {
  it("should write the migration the CSV renders for the wave", () => {
    const { csvPath, outputPath } = setUp();

    emitRestaurantMigration({ csvPath, outputPath, wave: 1 });

    expect(readFileSync(outputPath, "utf8")).toBe(renderRestaurantMigration(csv, 1));
  });

  it("should refuse a path that holds a file already, and leave that file as it was", () => {
    const { csvPath, outputPath } = setUp();
    writeFileSync(outputPath, "applied");

    expect(() => {
      emitRestaurantMigration({ csvPath, outputPath, wave: 1 });
    }).toThrow("An applied migration is never regenerated");
    expect(readFileSync(outputPath, "utf8")).toBe("applied");
  });
});
