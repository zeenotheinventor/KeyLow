import { describe, expect, it } from "vitest";

import { assistantCardSchema, buildPlanDayReplannedCard, withActionIds } from "../../src/assistant";
import { describeKeptCooksNote, describeReplannedDayNote } from "../../src/copy";
import { replanDay } from "../../src/plans";
import { stewWeek } from "../plans/storedPlan";

import type { PlanDay } from "../../src/plans";

const actionIds: [string, ...string[]] = ["00000000-0000-4000-8000-0000000000d1"];
const { plan, pool } = stewWeek(3);
const cookDate =
  plan.days.find((day) => day.items.some((item) => item.leftoverOf === null))?.localDate ?? "";
const replanned = replanDay(plan, cookDate, pool);
const day = replanned.plan.days.find((candidate) => candidate.localDate === cookDate) as PlanDay;
const names = {
  recipeNames: new Map([["stew", "Eval stew"]]),
  foodNames: new Map([
    ["oats", "Oats, rolled"],
    ["chicken", "Chicken, grilled"],
    ["rice", "Rice, boiled"],
  ]),
};
const shortDay = (reason: "work_limit" | "ingredient_bounds"): PlanDay => ({
  ...day,
  status: "short",
  shortfalls: [{ nutrient: "protein_g", target: 90, achieved: 68, reason }],
});

describe("buildPlanDayReplannedCard", () => {
  const card = buildPlanDayReplannedCard({ day, kept: replanned.kept, ...names });

  it("should be a card the contract accepts", () => {
    expect(() => assistantCardSchema.parse(withActionIds(card, actionIds))).not.toThrow();
  });

  it("should be titled with the day and say its figures against the day's own target", () => {
    const kcal = Math.round(day.totals.kcal ?? 0).toLocaleString("en-GB");

    expect(card.kind).toBe("plan_day_replanned");
    expect(card.title).toBe("Replanned Mon 16 Nov");
    expect(card.sub).toMatch(new RegExp(`^${kcal} of 1,300 kcal · P \\d+ of 90 g$`));
  });

  it("should draw a row for each band with the item names and the band's calories", () => {
    expect(card.rows.map(({ name }) => name)).toEqual([
      "Morning 07:30",
      "Midday 12:30",
      "Evening 19:00",
    ]);
    expect(card.rows.every(({ kcalText }) => /^[\d,]+ kcal$/.test(kcalText ?? ""))).toBe(true);
    expect(card.rows.flatMap(({ amountText }) => amountText ?? "").join(" ")).toContain(
      "Eval stew",
    );
  });

  it("should say a kept cook was kept because other days eat its leftovers", () => {
    expect(card.note).toBe("Kept Eval stew on this day because other days eat its leftovers.");
  });

  it("should put the day back on Undo, and have no link yet", () => {
    expect(card.undo).toBe("available");
    expect(card.undoneSub).toBe("Put Mon 16 Nov back as it was");
    expect(card.link).toBeNull();
  });

  it("should have no note for a day within tolerance that kept nothing", () => {
    const quiet = buildPlanDayReplannedCard({ day, kept: [], ...names });

    expect(quiet.note).toBeNull();
  });

  it("should say a short day's miss as the board does", () => {
    const short = buildPlanDayReplannedCard({
      day: shortDay("ingredient_bounds"),
      kept: [],
      ...names,
    });

    expect(short.note).toBe(
      "22 g short on protein. This is the closest the plan gets with calories within 5 %.",
    );
  });

  it("should never call a work limit the closest the plan gets", () => {
    const limited = buildPlanDayReplannedCard({ day: shortDay("work_limit"), kept: [], ...names });

    expect(limited.note).toBe(
      "It was not fully worked out, so it may not be as close as it can get. Ask me to replan it.",
    );
    expect(limited.note).not.toMatch(/closest the plan gets/i);
  });
});

describe("describeReplannedDayNote", () => {
  it("should not claim calories are within tolerance when calories missed", () => {
    expect(
      describeReplannedDayNote([
        { nutrient: "kcal", target: 1300, achieved: 1120, reason: "ingredient_bounds" },
      ]),
    ).toBe("180 kcal under.");
  });

  it("should say a missing figure without the closest line", () => {
    expect(
      describeReplannedDayNote([
        { nutrient: "protein_g", target: 90, achieved: null, reason: "no_data" },
      ]),
    ).toBe("Missing a protein figure.");
  });

  it("should say a proven miss and an unproven one together without the closest line", () => {
    expect(
      describeReplannedDayNote([
        { nutrient: "protein_g", target: 90, achieved: 68, reason: "ingredient_bounds" },
        { nutrient: "carbs_g", target: 150, achieved: 100, reason: "work_limit" },
      ]),
    ).toBe(
      "22 g short on protein. It was not fully worked out, so it may not be as close as it can get. Ask me to replan it.",
    );
  });
});

describe("describeKeptCooksNote", () => {
  it("should name two cooks and say their leftovers", () => {
    expect(describeKeptCooksNote(["Stew", "Curry", "Stew"])).toBe(
      "Kept Stew and Curry on this day because other days eat their leftovers.",
    );
  });
});
