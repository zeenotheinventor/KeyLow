import { describe, expect, it } from "vitest";

import {
  PLAN_STATUS_BADGE,
  planDayViewsOf,
  plannedDayRowOf,
  planOpeningDayOf,
  planProgressTargetsOf,
  planShortBannerOf,
  planStripMarkOf,
  planWeekViewOf,
} from "../../src/plans";

import type { PlanDayRow, PlanItemRow, PlanRow } from "../../src/plans";

const PORRIDGE = {
  v: 1,
  kind: "recipe",
  ref: "r1",
  name: "Eval porridge bowl",
  servings: 1,
  yieldGrams: 340,
  effectiveGrams: 340,
  total: { kcal: 389 },
};

const recipeItem = (
  id: string,
  slotTime: string,
  kcal: number,
  protein: number,
  extra: {
    leftoverOf?: string | null;
    snapshot?: Record<string, unknown>;
    nutrients?: Record<string, unknown>;
  } = {},
): PlanItemRow => ({
  kind: "recipe",
  id,
  position: 0,
  slotTime,
  recipeId: "r1",
  servings: 1,
  nutrients: { kcal, protein_g: protein, carbs_g: 10, fat_g: 5 },
  leftoverOf: null,
  snapshot: PORRIDGE,
  ...extra,
});

const foodItem = (
  id: string,
  slotTime: string,
  name: string,
  grams: number,
  kcal: number,
  protein: number,
): PlanItemRow => ({
  kind: "food",
  id,
  position: 1,
  slotTime,
  foodId: `f-${id}`,
  grams,
  nutrients: { kcal, protein_g: protein },
  leftoverOf: null,
  snapshot: { name },
});

const day = (
  id: string,
  localDate: string,
  items: PlanItemRow[],
  extra: Partial<PlanDayRow> = {},
): PlanDayRow => ({
  id,
  localDate,
  target: { kcal: 1300, protein_g: 90 },
  confirmedAt: null,
  items,
  ...extra,
});

const plan = (
  id: string,
  createdAt: string,
  days: PlanDayRow[],
  startDate = "2026-11-16",
  dayCount = 7,
): PlanRow => ({ id, startDate, dayCount, createdAt, days });

describe("planDayViewsOf", () => {
  it("should show the newest live plan's day for a date two plans both cover", () => {
    const older = plan("p-old", "2026-11-12T10:00:00Z", [
      day("d-old", "2026-11-18", [recipeItem("a", "07:30:00", 400, 20)]),
    ]);
    const newer = plan("p-new", "2026-11-13T10:00:00Z", [
      day("d-new", "2026-11-18", [recipeItem("b", "07:30:00", 1300, 90)]),
    ]);

    const [only, ...rest] = planDayViewsOf([newer, older]);

    expect(rest).toEqual([]);
    expect(only?.dayId).toBe("d-new");
    expect(only?.planId).toBe("p-new");
  });

  it("should keep each plan's days for the dates the other does not cover, in date order", () => {
    const older = plan("p-old", "2026-11-12T10:00:00Z", [
      day("d-17", "2026-11-17", []),
      day("d-18", "2026-11-18", []),
    ]);
    const newer = plan("p-new", "2026-11-13T10:00:00Z", [day("d-18-new", "2026-11-18", [])]);

    expect(planDayViewsOf([older, newer]).map(({ dayId }) => dayId)).toEqual(["d-17", "d-18-new"]);
  });

  it("should break a tie of creation time by the greater plan id, whatever order the plans arrive in", () => {
    const first = plan("p-a", "2026-11-13T10:00:00Z", [day("d-a", "2026-11-18", [])]);
    const second = plan("p-b", "2026-11-13T10:00:00Z", [day("d-b", "2026-11-18", [])]);

    expect(planDayViewsOf([first, second])[0]?.planId).toBe("p-b");
    expect(planDayViewsOf([second, first])[0]?.planId).toBe("p-b");
  });

  it("should sum a day's items in core and judge it against its own target", () => {
    const view = planDayViewsOf([
      plan("p", "2026-11-13T10:00:00Z", [
        day("d", "2026-11-18", [
          recipeItem("a", "07:30:00", 389, 13),
          foodItem("b", "12:30:00", "Eggs, chicken, whole, boiled", 120, 905, 80),
        ]),
      ]),
    ])[0];

    expect(view?.totals).toMatchObject({ kcal: 1294, protein_g: 93 });
    expect(view?.status).toBe("within");
    expect(view?.shortfalls).toEqual([]);
  });

  it("should call a day short when protein is more than 5 g under, and say by how much", () => {
    const view = planDayViewsOf([
      plan("p", "2026-11-13T10:00:00Z", [
        day("d", "2026-11-19", [
          recipeItem("a", "07:30:00", 1292, 68, {
            nutrients: { kcal: 1292, protein_g: 68 },
          }),
        ]),
      ]),
    ])[0];

    expect(view?.status).toBe("short");
    expect(view?.shortfalls).toEqual([{ nutrient: "protein_g", target: 90, achieved: 68 }]);
  });

  it("should allow 5 % on calories and 5 g on protein as Zee ruled", () => {
    const edge = (kcal: number, protein: number) =>
      planDayViewsOf([
        plan("p", "2026-11-13T10:00:00Z", [
          day("d", "2026-11-19", [
            recipeItem("a", "07:30:00", kcal, protein, { nutrients: { kcal, protein_g: protein } }),
          ]),
        ]),
      ])[0]?.status;

    expect(edge(1365, 85)).toBe("within");
    expect(edge(1366, 90)).toBe("short");
    expect(edge(1300, 84.9)).toBe("short");
  });

  it("should call a confirmed day confirmed, whatever its figures", () => {
    const view = planDayViewsOf([
      plan("p", "2026-11-13T10:00:00Z", [
        day("d", "2026-11-16", [recipeItem("a", "07:30:00", 100, 1)], {
          confirmedAt: "2026-11-16T09:00:00Z",
        }),
      ]),
    ])[0];

    expect(view?.status).toBe("confirmed");
    expect(view?.isConfirmed).toBe(true);
  });

  it("should leave a figure that no item has a value for unknown and never zero", () => {
    const view = planDayViewsOf([
      plan("p", "2026-11-13T10:00:00Z", [
        day("d", "2026-11-18", [
          recipeItem("a", "07:30:00", 1300, 0, { nutrients: { kcal: 1300 } }),
        ]),
      ]),
    ])[0];

    expect(view?.totals.protein_g).toBeNull();
    expect(view?.status).toBe("short");
    expect(view?.shortfalls).toEqual([{ nutrient: "protein_g", target: 90, achieved: null }]);
  });

  it("should group items into the bands by their time, with each band's own figures", () => {
    const view = planDayViewsOf([
      plan("p", "2026-11-13T10:00:00Z", [
        day("d", "2026-11-18", [
          foodItem("c", "19:00:00", "Salmon, farmed, flesh only, grilled", 100, 239, 22),
          recipeItem("a", "07:30:00", 389, 13),
          foodItem("b", "12:30:00", "Chicken, breast, grilled", 130, 192, 41),
          foodItem("d", "12:30:00", "Rice, white, long grain, boiled", 180, 236, 5),
        ]),
      ]),
    ])[0];

    expect(view?.bands.map(({ band, time, summary }) => [band, time, summary])).toEqual([
      ["morning", "07:30", "389 kcal · P 13 g"],
      ["midday", "12:30", "428 kcal · P 46 g"],
      ["evening", "19:00", "239 kcal · P 22 g"],
    ]);
    expect(view?.itemCount).toBe(4);
  });

  it("should split the bands at 11:00 and 16:00", () => {
    const bandOf = (slotTime: string) =>
      planDayViewsOf([
        plan("p", "2026-11-13T10:00:00Z", [
          day("d", "2026-11-18", [foodItem("a", slotTime, "Eggs", 50, 100, 5)]),
        ]),
      ])[0]?.bands[0]?.band;

    expect(bandOf("10:59:00")).toBe("morning");
    expect(bandOf("11:00:00")).toBe("midday");
    expect(bandOf("15:59:00")).toBe("midday");
    expect(bandOf("16:00:00")).toBe("evening");
  });

  it("should name a recipe in full and a food as logged, with their amounts and calories", () => {
    const view = planDayViewsOf([
      plan("p", "2026-11-13T10:00:00Z", [
        day("d", "2026-11-18", [
          recipeItem("a", "07:30:00", 389, 13),
          foodItem("b", "12:30:00", "Eggs, chicken, whole, boiled", 120, 172, 15),
        ]),
      ]),
    ])[0];

    expect(view?.bands[0]?.items[0]).toMatchObject({
      name: "Eval porridge bowl",
      detail: "1 serving · 340 g",
      kcalText: "389 kcal",
    });
    expect(view?.bands[1]?.items[0]).toMatchObject({
      name: "Eggs, chicken, whole, boiled",
      detail: "120 g",
      kcalText: "172 kcal",
    });
  });

  it("should write a band's line for the week card with a food as the part of its name before the comma", () => {
    const view = planDayViewsOf([
      plan("p", "2026-11-13T10:00:00Z", [
        day("d", "2026-11-18", [
          foodItem("a", "12:30:00", "Chicken, breast, grilled", 130, 192, 41),
          foodItem("b", "12:30:00", "Rice, white, long grain", 180, 236, 5),
          recipeItem("c", "19:00:00", 300, 10, {
            snapshot: { ...PORRIDGE, name: "Eval chicken and rice" },
          }),
        ]),
      ]),
    ])[0];

    expect(view?.bands.map(({ line }) => line)).toEqual(["Chicken, Rice", "Eval chicken and rice"]);
  });

  it("should badge a recipe that leaves a serving for the next day, and the leftover itself", () => {
    const cook = recipeItem("cook", "19:00:00", 518, 49);
    const leftover = recipeItem("left", "12:30:00", 518, 49, { leftoverOf: "cook" });
    const views = planDayViewsOf([
      plan("p", "2026-11-13T10:00:00Z", [
        day("d1", "2026-11-16", [cook]),
        day("d2", "2026-11-17", [leftover]),
      ]),
    ]);

    expect(views[0]?.bands[0]?.items[0]?.badge).toBe("Makes 2, 1 for tomorrow");
    expect(views[1]?.bands[0]?.items[0]?.badge).toBe("Leftover");
  });

  it("should say later when the leftovers are not all on the next day", () => {
    const cook = recipeItem("cook", "19:00:00", 518, 49);
    const views = planDayViewsOf([
      plan("p", "2026-11-13T10:00:00Z", [
        day("d1", "2026-11-16", [cook]),
        day("d2", "2026-11-17", [recipeItem("l1", "12:30:00", 518, 49, { leftoverOf: "cook" })]),
        day("d3", "2026-11-18", [recipeItem("l2", "12:30:00", 518, 49, { leftoverOf: "cook" })]),
      ]),
    ]);

    expect(views[0]?.bands[0]?.items[0]?.badge).toBe("Makes 3, 2 for later");
  });

  it("should carry the plan's own run of dates for the day's subtitle", () => {
    const view = planDayViewsOf([
      plan("p", "2026-11-13T10:00:00Z", [day("d", "2026-11-18", [])], "2026-11-18", 5),
    ])[0];

    expect(view?.planStart).toBe("2026-11-18");
    expect(view?.planEnd).toBe("2026-11-22");
  });

  it("should read a stored target for the figures the day was planned to, and no others", () => {
    const view = planDayViewsOf([
      plan("p", "2026-11-13T10:00:00Z", [
        day("d", "2026-11-18", [], { target: { kcal: 1550, protein_g: 90, junk: "x" } }),
      ]),
    ])[0];

    expect(view?.target).toEqual({ kcal: 1550, protein_g: 90, carbs_g: null, fat_g: null });
  });

  it("should fall back to a plain name when an item's snapshot cannot be read", () => {
    const view = planDayViewsOf([
      plan("p", "2026-11-13T10:00:00Z", [
        day("d", "2026-11-18", [
          { ...foodItem("a", "12:30:00", "x", 100, 100, 5), snapshot: {} },
          { ...recipeItem("b", "07:30:00", 100, 5), snapshot: { name: 5 } },
        ]),
      ]),
    ])[0];

    expect(view?.bands.flatMap(({ items }) => items.map(({ name }) => name))).toEqual([
      "Recipe",
      "Food",
    ]);
  });
});

describe("plannedDayRowOf", () => {
  const views = planDayViewsOf([
    plan("p", "2026-11-13T10:00:00Z", [
      day("d1", "2026-11-18", [
        recipeItem("a", "07:30:00", 389, 13),
        foodItem("b", "12:30:00", "Eggs", 120, 905, 80),
        foodItem("c", "19:00:00", "Salmon", 100, 0, 0),
      ]),
      day("d2", "2026-11-16", [recipeItem("z", "07:30:00", 100, 1)], {
        confirmedAt: "2026-11-16T09:00:00Z",
      }),
    ]),
  ]);

  it("should say what is planned for today, in meals and figures, and not confirmed", () => {
    expect(plannedDayRowOf(views, "2026-11-18", "2026-11-18")).toEqual({
      dayId: "d1",
      title: "Planned for today",
      caption: "3 meals · 1,294 kcal · P 93 g · not confirmed",
    });
  });

  it("should name the day when it is not today", () => {
    expect(plannedDayRowOf(views, "2026-11-18", "2026-11-17")?.title).toBe(
      "Planned for Wed 18 Nov",
    );
  });

  it("should draw no row on a confirmed day, where the entries are already in the log", () => {
    expect(plannedDayRowOf(views, "2026-11-16", "2026-11-18")).toBeNull();
  });

  it("should draw no row on a day with no plan", () => {
    expect(plannedDayRowOf(views, "2026-11-20", "2026-11-18")).toBeNull();
  });

  it("should count meals as the bands that hold something", () => {
    const one = planDayViewsOf([
      plan("p", "2026-11-13T10:00:00Z", [
        day("d", "2026-11-18", [foodItem("a", "12:30:00", "Eggs", 120, 172, 15)]),
      ]),
    ]);

    expect(plannedDayRowOf(one, "2026-11-18", "2026-11-18")?.caption).toBe(
      "1 meal · 172 kcal · P 15 g · not confirmed",
    );
  });
});

describe("planShortBannerOf", () => {
  const shortView = (kcal: number, protein: number) => {
    const [view] = planDayViewsOf([
      plan("p", "2026-11-13T10:00:00Z", [
        day("d", "2026-11-19", [
          recipeItem("a", "07:30:00", kcal, protein, { nutrients: { kcal, protein_g: protein } }),
        ]),
      ]),
    ]);
    if (view === undefined) {
      throw new Error("no view");
    }
    return view;
  };

  it("should say the protein gap and the closest the plan gets, as plan · day-short draws it", () => {
    expect(planShortBannerOf(shortView(1292, 68))).toEqual({
      title: "22 g short on protein",
      body: "The closest the plan gets is 68 g of 90 g, with calories within 5 %. Confirm it as it is, or regenerate the day with other words.",
    });
  });

  it("should say the calorie gap with protein within 5 g", () => {
    expect(planShortBannerOf(shortView(1120, 90))).toEqual({
      title: "180 kcal under",
      body: "The closest the plan gets is 1,120 kcal of 1,300 kcal, with protein within 5 g. Confirm it as it is, or regenerate the day with other words.",
    });
  });

  it("should name both when both miss", () => {
    expect(planShortBannerOf(shortView(1120, 68))?.title).toBe(
      "22 g short on protein and 180 kcal under",
    );
  });

  it("should draw no banner on a day within target", () => {
    expect(planShortBannerOf(shortView(1300, 90))).toBeNull();
  });
});

describe("planWeekViewOf", () => {
  const views = planDayViewsOf([
    plan("p", "2026-11-13T10:00:00Z", [
      day("d18", "2026-11-18", []),
      day("d19", "2026-11-19", []),
      day("d25", "2026-11-25", []),
    ]),
  ]);

  it("should list the seven days of the anchor's week with the plan's day for each", () => {
    const week = planWeekViewOf(views, "2026-11-18");

    expect(week.weekStart).toBe("2026-11-16");
    expect(week.days.map(({ localDate }) => localDate)).toEqual([
      "2026-11-16",
      "2026-11-17",
      "2026-11-18",
      "2026-11-19",
      "2026-11-20",
      "2026-11-21",
      "2026-11-22",
    ]);
    expect(week.planned.map(({ dayId }) => dayId)).toEqual(["d18", "d19"]);
  });

  it("should have nothing planned in a week the plans do not reach", () => {
    expect(planWeekViewOf(views, "2026-12-30").planned).toEqual([]);
  });
});

describe("planProgressTargetsOf", () => {
  const [view] = planDayViewsOf([
    plan("p", "2026-11-13T10:00:00Z", [
      day("d", "2026-11-18", [], { target: { kcal: 1550, protein_g: 90 } }),
    ]),
  ]);

  it("should judge calories and protein by the plan's own target, and the rest by the person's", () => {
    if (view === undefined) {
      throw new Error("no view");
    }

    expect(
      planProgressTargetsOf(view, { kcal: 2000, protein_g: 100, carbs_g: 150, fat_g: 50 }),
    ).toEqual({ kcal: 1550, protein_g: 90, carbs_g: 150, fat_g: 50 });
  });

  it("should leave a figure with no target at all unknown", () => {
    if (view === undefined) {
      throw new Error("no view");
    }

    expect(planProgressTargetsOf(view, null)).toEqual({
      kcal: 1550,
      protein_g: 90,
      carbs_g: null,
      fat_g: null,
    });
  });
});

describe("planStripMarkOf", () => {
  const viewWith = (confirmedAt: string | null, protein: number) => {
    const [view] = planDayViewsOf([
      plan("p", "2026-11-13T10:00:00Z", [
        day(
          "d",
          "2026-11-18",
          [
            recipeItem("a", "07:30:00", 1300, protein, {
              nutrients: { kcal: 1300, protein_g: protein },
            }),
          ],
          { confirmedAt },
        ),
      ]),
    ]);
    return view ?? null;
  };

  it("should mark a confirmed day with a tick and a short day with a warning", () => {
    expect(planStripMarkOf(viewWith("2026-11-18T09:00:00Z", 90))).toEqual({
      tone: "success",
      label: "confirmed",
    });
    expect(planStripMarkOf(viewWith(null, 60))).toEqual({ tone: "warning", label: "short" });
  });

  it("should mark nothing for a day within target or with no plan", () => {
    expect(planStripMarkOf(viewWith(null, 90))).toBeUndefined();
    expect(planStripMarkOf(null)).toBeUndefined();
  });
});

describe("an empty day", () => {
  const emptyViews = planDayViewsOf([
    plan("p", "2026-11-13T10:00:00Z", [day("d", "2026-11-18", [])]),
  ]);

  it("should be empty, not short, and have no shortfalls to banner", () => {
    expect(emptyViews[0]?.status).toBe("empty");
    expect(emptyViews[0]?.shortfalls).toEqual([]);
    expect(emptyViews[0] === undefined ? null : planShortBannerOf(emptyViews[0])).toBeNull();
    expect(planStripMarkOf(emptyViews[0] ?? null)).toBeUndefined();
  });

  it("should draw no Diary row", () => {
    expect(plannedDayRowOf(emptyViews, "2026-11-18", "2026-11-18")).toBeNull();
  });

  it("should be badged as nothing planned", () => {
    expect(PLAN_STATUS_BADGE.empty.label).toBe("Nothing planned");
  });
});

describe("planOpeningDayOf", () => {
  const sundayPlan = planDayViewsOf([
    plan(
      "p",
      "2026-11-13T10:00:00Z",
      [day("d22", "2026-11-22", []), day("d23", "2026-11-23", []), day("d28", "2026-11-28", [])],
      "2026-11-22",
      7,
    ),
  ]);

  it("should open on today when today's week has a planned day", () => {
    expect(planOpeningDayOf(sundayPlan, "2026-11-22")).toBe("2026-11-22");
  });

  it("should open on the first planned day of a later week when this week has none, so a plan wholly next week is found", () => {
    expect(planOpeningDayOf(sundayPlan, "2026-11-18")).toBe("2026-11-18");
    const nextWeekOnly = planDayViewsOf([
      plan("p", "2026-11-13T10:00:00Z", [day("d24", "2026-11-24", [])], "2026-11-24", 3),
    ]);

    expect(planOpeningDayOf(nextWeekOnly, "2026-11-18")).toBe("2026-11-24");
  });

  it("should let a Sunday plan reach Monday to Saturday of the week after, which the week view lists", () => {
    const week = planWeekViewOf(sundayPlan, "2026-11-23");

    expect(week.weekStart).toBe("2026-11-23");
    expect(week.planned.map(({ localDate }) => localDate)).toEqual(["2026-11-23", "2026-11-28"]);
  });

  it("should stay on today with nothing planned anywhere, and on a linked day when one is given", () => {
    expect(planOpeningDayOf([], "2026-11-18")).toBe("2026-11-18");
    expect(planOpeningDayOf(sundayPlan, "2026-11-18", "2026-11-25")).toBe("2026-11-25");
  });
});
