import { describe, expect, it } from "vitest";

import { describeFoodRow, describeLiveFoodRow, liveRowShowsServing } from "../../src/search";
import { buildOffCandidate } from "../../src/testing";

const bigMac = buildOffCandidate({
  name: "Big Mac",
  brand: "McDonald's",
  kcal: 250,
  protein_g: 13,
  fat_g: 12,
  carbs_g: 25,
  default_portion: { label: "1 burger", grams: 240, ml: null },
});

describe("describeLiveFoodRow", () => {
  describe("when the search shows servings", () => {
    it("should name the serving and give the values for it", () => {
      expect(describeLiveFoodRow(bigMac, "mac", { showsServings: true })).toEqual({
        nameSegments: [
          { text: "Big ", matched: false },
          { text: "Mac", matched: true },
        ],
        brand: "McDonald's",
        caption: "1 burger (240 g)",
        energy: "600",
        macros: {
          protein: "31",
          carbs: "60",
          fat: "29",
          description: "protein 31 grams, fat 29 grams, carbohydrate 60 grams",
        },
      });
    });

    it("should say an estimate is about its size", () => {
      const estimate = {
        ...bigMac,
        default_portion: { label: "1 typical serving", grams: 150, ml: null },
      };

      expect(describeLiveFoodRow(estimate, "mac", { showsServings: true }).caption).toBe(
        "1 typical serving (about 150 g)",
      );
    });

    it("should draw a candidate with no default portion per 100 g, as the browse rows are", () => {
      const legacy = buildOffCandidate({ name: "Oat drink", basis: "per_100ml" });

      expect(describeLiveFoodRow(legacy, "oat", { showsServings: true })).toEqual(
        describeFoodRow(legacy, "oat"),
      );
    });

    it("should say the energy is not given rather than scale nothing", () => {
      const noEnergy = { ...bigMac, kcal: null };

      expect(describeLiveFoodRow(noEnergy, "mac", { showsServings: true })).toEqual(
        describeFoodRow(noEnergy, "mac"),
      );
    });
  });

  it("should draw the row per 100 g when the search does not show servings", () => {
    expect(describeLiveFoodRow(bigMac, "mac", { showsServings: false })).toEqual(
      describeFoodRow(bigMac, "mac"),
    );
  });
});

describe("liveRowShowsServing", () => {
  it("should be true for a candidate with a default portion and an energy", () => {
    expect(liveRowShowsServing(bigMac)).toBe(true);
  });

  it.each([
    ["no default portion", buildOffCandidate()],
    ["a null default portion", buildOffCandidate({ default_portion: null })],
    ["no energy", { ...bigMac, kcal: null }],
  ])("should be false for a candidate with %s", (_name, candidate) => {
    expect(liveRowShowsServing(candidate)).toBe(false);
  });
});
