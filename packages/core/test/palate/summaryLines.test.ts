import { describe, expect, it } from "vitest";

import { boardFoods, boardOptions, boardPreferences, boardStats, rowOf } from "./boardData";
import { buildPalateProfile, summaryLines } from "../../src/palate";

import type { PalatePreference, PalateFoodStat } from "../../src/palate";

const notUsual = (
  id: string,
  reference: { foodId?: string; label?: string },
): PalatePreference => ({
  id,
  kind: "not_usual",
  foodId: reference.foodId ?? null,
  recipeId: null,
  label: reference.label ?? null,
});

describe("summaryLines", () => {
  it("should write the lines of the board kitchen · palate from the board's diary", () => {
    const profile = buildPalateProfile(boardStats, boardPreferences, boardOptions);
    expect(summaryLines(profile)).toEqual([
      "You eat apples, broccoli, eggs and bread on most days.",
      "Yogurt, porridge oats, chicken and rice come up most weeks.",
      "You rarely or never log legumes and nuts, sweets and snacks, or drinks.",
      "You avoid peanuts (allergy), mushrooms and coriander.",
    ]);
  });

  it("should leave a corrected item out, as the board kitchen · palate-corrected does", () => {
    const profile = buildPalateProfile(
      boardStats,
      [
        ...boardPreferences,
        notUsual("p-eggs", { foodId: "eggs" }),
        notUsual("p-drinks", { label: "drinks" }),
      ],
      boardOptions,
    );
    expect(summaryLines(profile)).toEqual([
      "You eat apples, broccoli and bread on most days.",
      "Yogurt, porridge oats, chicken and rice come up most weeks.",
      "You rarely or never log legumes and nuts, or sweets and snacks.",
      "You avoid peanuts (allergy), mushrooms and coriander.",
    ]);
  });

  it("should give only the avoid line when there are too few logged days, as kitchen · palate-empty has", () => {
    const profile = buildPalateProfile(boardStats, boardPreferences, {
      ...boardOptions,
      loggedDays: 2,
    });
    expect(summaryLines(profile)).toEqual([
      "You avoid peanuts (allergy), mushrooms and coriander.",
    ]);
  });

  it("should give no lines at all when there is nothing to say", () => {
    const profile = buildPalateProfile([], [], { ...boardOptions, loggedDays: 0 });
    expect(summaryLines(profile)).toEqual([]);
  });

  it("should leave a line out when it has no items", () => {
    const stats = boardStats.filter(({ foodId }) => ["apples", "bread"].includes(foodId ?? ""));
    const profile = buildPalateProfile(stats, [], { ...boardOptions, recipes: [] });
    const lines = summaryLines(profile);
    expect(lines[0]).toBe("You eat apples and bread on most days.");
    expect(lines.some((line) => line.includes("come up most weeks"))).toBe(false);
  });

  it("should name a dislike that has a food a person logs often only in the avoid line", () => {
    const profile = buildPalateProfile(
      boardStats,
      [{ id: "d", kind: "dislike", label: "apples", foodId: null, recipeId: null }],
      boardOptions,
    );
    expect(summaryLines(profile)).toEqual([
      "You eat broccoli, eggs and bread on most days.",
      "Yogurt, porridge oats, chicken and rice come up most weeks.",
      "You rarely or never log legumes and nuts, sweets and snacks, or drinks.",
      "You avoid apples.",
    ]);
  });

  it("should name at most 4 foods on a line and each short name once", () => {
    const foods = [
      ...boardFoods,
      {
        id: "chicken-thigh",
        name: "Chicken, thigh, roasted",
        source: "cofid" as const,
        food_group: "MCA",
      },
    ];
    const stats: PalateFoodStat[] = [
      ...boardStats,
      { ...rowOf("apples"), foodId: "chicken-thigh", distinctDays: 12 },
    ];
    const lines = summaryLines(buildPalateProfile(stats, [], { ...boardOptions, foods }));
    expect(lines[1]).toBe("Yogurt, porridge oats, chicken and rice come up most weeks.");
  });

  it("should name at most 4 groups as rarely or never logged", () => {
    const stats = boardStats.filter(({ foodId }) => ["apples", "bread"].includes(foodId ?? ""));
    const lines = summaryLines(buildPalateProfile(stats, [], { ...boardOptions, recipes: [] }));
    expect(lines.find((line) => line.startsWith("You rarely"))).toBe(
      "You rarely or never log meat, fish, eggs, or dairy.",
    );
  });

  it("should use the singular verb for a single food", () => {
    const stats = boardStats.filter(({ foodId }) => foodId === "salmon");
    const lines = summaryLines(buildPalateProfile(stats, [], { ...boardOptions, recipes: [] }));
    expect(lines[0]).toBe("You eat salmon most weeks.");
  });
});
