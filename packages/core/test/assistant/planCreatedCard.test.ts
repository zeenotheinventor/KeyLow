import { describe, expect, it } from "vitest";

import { assistantCardSchema, buildPlanCreatedCard, withActionIds } from "../../src/assistant";
import { describeRepeatLimitNote, describeShortDayNote } from "../../src/copy";
import { planMeals } from "../../src/plans";
import { EVAL_FOODS, EVAL_RECIPES } from "../plans/evalKitchen";

import type { PlanCreatedCardInput } from "../../src/assistant";
import type { Plan, PlanDay } from "../../src/plans";

const actionIds: [string, ...string[]] = ["00000000-0000-4000-8000-0000000000d1"];

const plan: Plan = planMeals({
  recipes: EVAL_RECIPES,
  foods: EVAL_FOODS,
  ranking: [],
  rules: { maxRepeats: 2, leftovers: true, slots: ["morning", "midday", "evening"] },
  days: [0, 1, 2, 3, 4, 5, 6].map((offset) => ({
    localDate: `2026-11-${16 + offset}`,
    target: { kcal: 1300, protein_g: 90 },
  })),
});

const input: PlanCreatedCardInput = {
  plan,
  repeatLimit: { maxRepeats: 2, source: "default" },
  recipes: new Map([
    ["porridge-bowl", { name: "Eval porridge bowl", servings: 1, effectiveGrams: 340 }],
    ["chicken-and-rice", { name: "Eval chicken and rice", servings: 2, effectiveGrams: 700 }],
  ]),
  foodNames: new Map(EVAL_FOODS.map(({ id }) => [id, `${id}, whole, boiled`])),
};

const shortDay = (day: PlanDay, reason: "work_limit" | "ingredient_bounds"): PlanDay => ({
  ...day,
  status: "short",
  shortfalls: [{ nutrient: "protein_g", target: 90, achieved: 68, reason }],
});

describe("buildPlanCreatedCard", () => {
  const card = buildPlanCreatedCard(input);

  it("should be a card the contract accepts", () => {
    expect(() => assistantCardSchema.parse(withActionIds(card, actionIds))).not.toThrow();
  });

  it("should title the plan with its dates and its length", () => {
    expect(card.title).toBe("Planned 7 days, Mon 16 to Sun 22 Nov");
    expect(card.changeDetail).toBe("7 days");
  });

  it("should write each day from core's own totals against the day's target", () => {
    const monday = plan.days[0];
    const kcal = Math.round(monday?.totals.kcal ?? 0).toLocaleString("en-GB");

    expect(card.days?.[0]?.name).toBe(`Monday 16 · ${kcal} of 1,300 kcal`);
    expect(card.days?.[0]?.summary).toMatch(/^\d+ items · P \d+ of 90 g$/);
    expect(card.days).toHaveLength(7);
  });

  it("should list a day's items with their band, time and amount", () => {
    const details = card.days?.[0]?.exercises.map(({ detail }) => detail) ?? [];

    expect(details.length).toBe(plan.days[0]?.items.length);
    expect(details[0]).toMatch(/^Morning 07:30 · /);
  });

  it("should name a recipe in full, with its serving weight, and a food by the part before the comma", () => {
    const names = card.days?.flatMap(({ exercises }) => exercises.map(({ name }) => name)) ?? [];

    expect(names).toContain("Eval porridge bowl");
    expect(names).toContain("Oats");
    expect(card.days?.flatMap(({ exercises }) => exercises.map(({ detail }) => detail))).toContain(
      "Morning 07:30 · 1 serving · 340 g",
    );
  });

  it("should mark a leftover", () => {
    const details =
      card.days?.flatMap(({ exercises }) => exercises.map(({ detail }) => detail)) ?? [];

    expect(details.some((detail) => detail.endsWith(" · leftover"))).toBe(true);
  });

  it("should say the starting limit applied and where to change it", () => {
    expect(card.note).toBe("Recipes repeat up to twice a week. Change it in plan settings.");
  });

  it("should undo to a line that names the dates, and have no link yet", () => {
    expect(card.undoneSub).toBe("Removed the plan for Mon 16 to Sun 22 Nov");
    expect(card.undo).toBe("available");
    expect(card.link).toBeNull();
  });

  it("should say a short day's miss first, from core's figures", () => {
    const [first, ...rest] = plan.days;
    if (first === undefined) {
      throw new Error("no day");
    }

    const short = buildPlanCreatedCard({
      ...input,
      plan: { days: [shortDay(first, "ingredient_bounds"), ...rest] },
    });

    expect(short.note).toBe(
      "Mon 16 Nov is 22 g short on protein. Recipes repeat up to twice a week. Change it in plan settings.",
    );
  });
});

describe("describeShortDayNote", () => {
  it("should give a work limit its own words and never say it is the closest the plan gets", () => {
    const note = describeShortDayNote("2026-11-19", [
      { nutrient: "protein_g", target: 90, achieved: 68, reason: "work_limit" },
    ]);

    expect(note).toBe(
      "Thu 19 Nov was not fully worked out, so it may not be as close as it can get. Ask me to replan it.",
    );
    expect(note).not.toMatch(/closest the plan gets/i);
  });

  it("should say calories under and over as figures", () => {
    expect(
      describeShortDayNote("2026-11-19", [
        { nutrient: "kcal", target: 1300, achieved: 1120, reason: "ingredient_bounds" },
        { nutrient: "protein_g", target: 90, achieved: 95, reason: "ingredient_bounds" },
      ]),
    ).toBe("Thu 19 Nov is 180 kcal under and 5 g over on protein.");
  });

  it("should say so when a day has no figure for a nutrient", () => {
    expect(
      describeShortDayNote("2026-11-19", [
        { nutrient: "protein_g", target: 90, achieved: null, reason: "no_data" },
      ]),
    ).toBe("Thu 19 Nov is missing a protein figure.");
  });
});

describe("describeRepeatLimitNote", () => {
  it.each([
    [1, "default", "Recipes repeat up to once a week. Change it in plan settings."],
    [3, "profile", "Recipes repeat up to 3 times a week, as set in plan settings."],
    [7, "request", "Recipes repeat up to 7 times a week, as you asked."],
  ] as const)("should say limit %s from the %s", (limit, source, note) => {
    expect(describeRepeatLimitNote(limit, source)).toBe(note);
  });

  it("should say nothing for no limit, as the board does", () => {
    expect(describeRepeatLimitNote(null, "profile")).toBeNull();
  });
});
