import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { FOOD_SEARCH_GROUP_LIMITS, groupFoodSearchResults } from "../../src/search";

import type { FoodSource } from "../../src/schemas";

type Row = { id: string; source: FoodSource };

const row = (id: string, source: FoodSource): Row => ({ id, source });

describe("groupFoodSearchResults", () => {
  it("should split rows into Your foods, Common foods and Branded foods by source", () => {
    const groups = groupFoodSearchResults([row("a", "off"), row("b", "cofid"), row("c", "user")], {
      limit: 5,
    });

    expect(groups.map((group) => group.key)).toEqual(["yours", "common", "branded"]);
    expect(groups.map((group) => group.visibleRows.map((item) => item.id))).toEqual([
      ["c"],
      ["b"],
      ["a"],
    ]);
  });

  it("should keep the rank order of the rows inside each group", () => {
    const groups = groupFoodSearchResults(
      [
        row("c1", "cofid"),
        row("u1", "user"),
        row("c2", "cofid"),
        row("o1", "off"),
        row("c3", "cofid"),
        row("u2", "user"),
      ],
      { limit: 5 },
    );

    expect(
      groups.find((group) => group.key === "common")?.visibleRows.map((item) => item.id),
    ).toEqual(["c1", "c2", "c3"]);
    expect(
      groups.find((group) => group.key === "yours")?.visibleRows.map((item) => item.id),
    ).toEqual(["u1", "u2"]);
  });

  it("should put a USDA row in Common foods after a higher ranked CoFID row, keeping rank order", () => {
    const groups = groupFoodSearchResults(
      [row("c1", "cofid"), row("u1", "usda"), row("o1", "off"), row("c2", "cofid")],
      { limit: 5 },
    );

    expect(groups.map((group) => group.key)).toEqual(["common", "branded"]);
    expect(
      groups.find((group) => group.key === "common")?.visibleRows.map((item) => item.id),
    ).toEqual(["c1", "u1", "c2"]);
  });

  it("should omit a group that has no rows", () => {
    const groups = groupFoodSearchResults([row("c1", "cofid"), row("o1", "off")], { limit: 5 });

    expect(groups.map((group) => group.key)).toEqual(["common", "branded"]);
  });

  it("should return no groups for no rows", () => {
    expect(groupFoodSearchResults([], { limit: 5 })).toEqual([]);
  });

  it("should show only the first rows of a group and count the rest behind See more", () => {
    const common = Array.from({ length: 7 }, (_, index) => row(`c${index}`, "cofid"));

    const [group] = groupFoodSearchResults(common, { limit: 5 });

    expect(group?.visibleRows.map((item) => item.id)).toEqual(["c0", "c1", "c2", "c3", "c4"]);
    expect(group?.hiddenCount).toBe(2);
  });

  it("should report no hidden rows when the group fits the limit", () => {
    const [group] = groupFoodSearchResults([row("c0", "cofid"), row("c1", "cofid")], { limit: 2 });

    expect(group?.hiddenCount).toBe(0);
  });

  it("should apply one limit to every group when the limit is a number", () => {
    const groups = groupFoodSearchResults(
      [row("u0", "user"), row("u1", "user"), row("c0", "cofid"), row("c1", "cofid")],
      { limit: 1 },
    );

    expect(groups.map((group) => [group.key, group.visibleRows.length, group.hiddenCount])).toEqual(
      [
        ["yours", 1, 1],
        ["common", 1, 1],
      ],
    );
  });

  it("should apply a limit per group when the limit is a record", () => {
    const yours = Array.from({ length: 5 }, (_, index) => row(`u${index}`, "user"));
    const common = Array.from({ length: 7 }, (_, index) => row(`c${index}`, "cofid"));

    const groups = groupFoodSearchResults([...yours, ...common], {
      limit: FOOD_SEARCH_GROUP_LIMITS,
    });

    expect(groups.map((group) => [group.key, group.visibleRows.length, group.hiddenCount])).toEqual(
      [
        ["yours", 3, 2],
        ["common", 5, 2],
      ],
    );
  });

  it("should use the limits the brief draws: 3 for Your foods and 5 for the rest", () => {
    expect(FOOD_SEARCH_GROUP_LIMITS).toEqual({ yours: 3, common: 5, branded: 5 });
  });

  it("should keep the row objects it was given, whatever else they carry", () => {
    const original = { id: "c0", source: "cofid", score: 0.8 } as const;

    const [group] = groupFoodSearchResults([original], { limit: 5 });

    expect(group?.visibleRows[0]).toBe(original);
  });

  it.each([-1, 1.5, Number.NaN])("should refuse the limit %s", (limit) => {
    expect(() => groupFoodSearchResults([row("c0", "cofid")], { limit })).toThrow(RangeError);
  });

  it("should neither lose nor duplicate a row", () => {
    const sources: FoodSource[] = ["user", "cofid", "off"];
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(...sources), { maxLength: 40 }),
        fc.integer({ min: 1, max: 10 }),
        (rowSources, limit) => {
          const rows = rowSources.map((source, index) => row(`r${index}`, source));

          const groups = groupFoodSearchResults(rows, { limit });

          const accountedFor = groups.reduce(
            (total, group) => total + group.visibleRows.length + group.hiddenCount,
            0,
          );
          expect(accountedFor).toBe(rows.length);
          for (const group of groups) {
            expect(group.visibleRows.length).toBeLessThanOrEqual(limit);
            expect(group.visibleRows.length).toBeGreaterThan(0);
          }
        },
      ),
    );
  });
});
