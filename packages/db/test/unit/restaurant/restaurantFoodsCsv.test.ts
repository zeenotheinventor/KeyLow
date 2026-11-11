import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { deriveFood } from "../../../scripts/restaurant/deriveFood";
import {
  parseRestaurantCsv,
  type RestaurantFoodRow,
} from "../../../scripts/restaurant/restaurantFoodsCsv";

const rows = parseRestaurantCsv(
  readFileSync(new URL("../../../data/restaurants/restaurant-foods.csv", import.meta.url), "utf8"),
);

/** The chain's own site. Anything else, a price comparison or a nutrition aggregator, is not a source. */
const CHAIN_DOMAINS: Readonly<Record<string, string>> = {
  "McDonald's": "mcdonalds.com",
  Greggs: "greggs.co.uk",
  "Pret A Manger": "pret.co.uk",
  Subway: "subway.com",
};

const isOnDomain = (url: URL, domain: string): boolean =>
  url.hostname === domain || url.hostname.endsWith(`.${domain}`);

/** What a person would see as no more than a measure: 100 g, 250 ml, 1 pack. */
const BARE_MEASURE =
  /^\s*[\d.]+\s*(g|kg|ml|l|oz|fl oz|cup|cups|tbsp|tsp|pack|packs|portion|portions|serving|servings)\s*$/i;

const kcalFromMacros = (row: RestaurantFoodRow): number =>
  4 * (row.protein_g ?? 0) + 4 * (row.carbs_g ?? 0) + 9 * (row.fat_g ?? 0) + 2 * (row.fibre_g ?? 0);

const rowsWithWeight = rows.filter((row) => row.portion_grams !== null);

describe("restaurant-foods.csv", () => {
  it("should hold foods", () => {
    expect(rows.length).toBeGreaterThan(0);
  });

  it("should give every row a unique ref", () => {
    const refs = rows.map((row) => row.ref);

    expect(new Set(refs).size).toBe(refs.length);
  });

  it("should give no two foods the same name and brand", () => {
    const keys = rows.map((row) => `${row.chain.toLowerCase()}|${row.name.toLowerCase()}`);

    expect(new Set(keys).size).toBe(keys.length);
  });

  it("should know the chain of every row", () => {
    for (const row of rows) {
      expect(Object.keys(CHAIN_DOMAINS), row.ref).toContain(row.chain);
    }
  });

  it("should have a kcal figure for every row", () => {
    for (const row of rows) {
      expect(row.kcal, row.ref).not.toBeNull();
    }
  });

  it("should have a kcal within 15% of what its protein, carbohydrate, fat and fibre add up to", () => {
    for (const row of rows) {
      const expected = kcalFromMacros(row);

      expect(Math.abs((row.kcal ?? 0) - expected) / expected, row.ref).toBeLessThanOrEqual(0.15);
    }
  });

  it("should name a page on the chain's own domain over https as the source", () => {
    for (const row of rows) {
      const url = new URL(row.source_url);
      const domain = CHAIN_DOMAINS[row.chain] ?? "";

      expect(url.protocol, row.ref).toBe("https:");
      expect(isOnDomain(url, domain), `${row.ref}: ${row.source_url}`).toBe(true);
    }
  });

  it("should have a real retrieval date that is not in the future", () => {
    for (const row of rows) {
      const date = new Date(`${row.retrieved_on}T00:00:00Z`);

      expect(row.retrieved_on, row.ref).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(date.toISOString().slice(0, 10), row.ref).toBe(row.retrieved_on);
      expect(date.getTime(), row.ref).toBeLessThanOrEqual(Date.now());
    }
  });

  it("should label every portion by what it is, never by a measure and never as typical", () => {
    for (const row of rows) {
      expect(row.portion_label, row.ref).not.toMatch(BARE_MEASURE);
      expect(row.portion_label.toLowerCase(), row.ref).not.toContain("typical");
      expect(row.portion_label, row.ref).toMatch(/^1 \S/);
    }
  });

  it("should say it has a weight exactly when it has one", () => {
    for (const row of rows) {
      expect(row.weight_basis === "none", row.ref).toBe(row.portion_grams === null);
    }
  });

  it("should hold only foods with a weight in wave 1, because the foods per portion wait for KEY-943", () => {
    for (const row of rows.filter((candidate) => candidate.wave === 1)) {
      expect(row.portion_grams, row.ref).not.toBeNull();
      expect(deriveFood(row).basis, row.ref).toBe("per_100g");
    }
  });

  describe("where a weight exists", () => {
    it("should be between 10 g and 1,500 g", () => {
      for (const row of rowsWithWeight) {
        expect(row.portion_grams, row.ref).toBeGreaterThanOrEqual(10);
        expect(row.portion_grams, row.ref).toBeLessThanOrEqual(1500);
      }
    });

    it("should give a kcal per 100 g within 2% of what the chain publishes per 100 g", () => {
      for (const row of rowsWithWeight) {
        const { published_kcal_per_100g: published } = row;
        if (published === null) {
          continue;
        }

        expect(
          Math.abs((deriveFood(row).nutrients.kcal ?? 0) - published) / published,
          row.ref,
        ).toBeLessThanOrEqual(0.02);
      }
    });
  });
});
