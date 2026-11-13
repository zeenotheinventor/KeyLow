import { describe, expect, it } from "vitest";

import {
  daysToClear,
  daysToRestore,
  isPlanUndoable,
  planDatesAround,
  plansToArchive,
  restorableItemsOfDay,
} from "../../src/plans";

import type { LivePlan, StoredPlan, StoredPlanItem } from "../../src/plans";

const day = (id: string, localDate: string, itemCount = 3, isConfirmed = false) => ({
  id,
  localDate,
  itemCount,
  isConfirmed,
});

const week = ["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19"];

describe("planDatesAround", () => {
  it("should plan every date when none is confirmed", () => {
    expect(planDatesAround(week, [])).toEqual({ dates: week, leftOut: [] });
  });

  it("should leave out confirmed dates at the start", () => {
    const plans: LivePlan[] = [{ id: "p", days: [day("d1", "2026-11-16", 2, true)] }];

    expect(planDatesAround(week, plans)).toEqual({
      dates: week.slice(1),
      leftOut: ["2026-11-16"],
    });
  });

  it("should stop before a confirmed date that follows a free one, and leave out the rest", () => {
    const plans: LivePlan[] = [{ id: "p", days: [day("d3", "2026-11-18", 2, true)] }];

    expect(planDatesAround(week, plans)).toEqual({
      dates: ["2026-11-16", "2026-11-17"],
      leftOut: ["2026-11-18", "2026-11-19"],
    });
  });

  it("should plan nothing when every date is confirmed, in any live plan", () => {
    const plans: LivePlan[] = [
      { id: "a", days: [day("d1", "2026-11-16", 2, true), day("d2", "2026-11-17", 2, true)] },
      { id: "b", days: [day("d3", "2026-11-18", 2, true), day("d4", "2026-11-19", 2, true)] },
    ];

    expect(planDatesAround(week, plans)).toEqual({ dates: [], leftOut: week });
  });
});

describe("daysToClear", () => {
  const plans: LivePlan[] = [
    {
      id: "old",
      days: [
        day("d1", "2026-11-15"),
        day("d2", "2026-11-16"),
        day("d3", "2026-11-17", 0),
        day("d4", "2026-11-18", 2, true),
      ],
    },
  ];

  it("should pick the unconfirmed days with items that the new dates cover", () => {
    expect(daysToClear(plans, week)).toEqual([
      { planId: "old", dayId: "d2", localDate: "2026-11-16" },
    ]);
  });
});

describe("plansToArchive", () => {
  it("should archive a plan whose days were all cleared or were empty", () => {
    const plans: LivePlan[] = [
      { id: "old", days: [day("d1", "2026-11-16"), day("d2", "2026-11-17", 0)] },
    ];

    expect(plansToArchive(plans, new Set(["d1"]))).toEqual(["old"]);
  });

  it("should keep a plan that still has a day with items, or a confirmed day", () => {
    const plans: LivePlan[] = [
      { id: "kept", days: [day("d1", "2026-11-16"), day("d2", "2026-11-17")] },
      { id: "confirmed", days: [day("d3", "2026-11-18"), day("d4", "2026-11-19", 2, true)] },
    ];

    expect(plansToArchive(plans, new Set(["d1", "d3"]))).toEqual([]);
  });

  it("should keep a plan whose confirmed day has no items", () => {
    const plans: LivePlan[] = [
      { id: "confirmed", days: [day("d1", "2026-11-16"), day("d2", "2026-11-17", 0, true)] },
    ];

    expect(plansToArchive(plans, new Set(["d1"]))).toEqual([]);
  });

  it("should not touch a plan nothing was cleared from", () => {
    expect(plansToArchive([{ id: "x", days: [day("d1", "2026-11-16", 0)] }], new Set())).toEqual(
      [],
    );
  });
});

describe("daysToRestore", () => {
  const cleared = [
    { dayId: "a18", localDate: "2026-11-18" },
    { dayId: "a19", localDate: "2026-11-19" },
  ];

  it("should restore every day when nothing else holds the dates", () => {
    const live: LivePlan[] = [
      { id: "b", days: [day("b18", "2026-11-18"), day("b19", "2026-11-19")] },
      { id: "a", days: [day("a18", "2026-11-18", 0), day("a19", "2026-11-19", 0)] },
    ];

    expect(daysToRestore(cleared, live, "b")).toEqual({ restore: cleared, skipped: [] });
  });

  it("should skip a day whose date a later plan now owns, and restore the rest", () => {
    const live: LivePlan[] = [
      { id: "b", days: [day("b18", "2026-11-18"), day("b19", "2026-11-19", 0)] },
      { id: "c", days: [day("c19", "2026-11-19")] },
    ];

    expect(daysToRestore(cleared, live, "b")).toEqual({
      restore: [cleared[0]],
      skipped: [{ ...cleared[1], reason: "date_taken" }],
    });
  });

  it("should skip a day that has items again, because it was edited after it was cleared", () => {
    const live: LivePlan[] = [
      { id: "a", days: [day("a18", "2026-11-18", 2), day("a19", "2026-11-19", 0)] },
    ];

    expect(daysToRestore(cleared, live, "b")).toEqual({
      restore: [cleared[1]],
      skipped: [{ ...cleared[0], reason: "day_edited" }],
    });
  });

  it("should not count the plan being undone as an owner", () => {
    const live: LivePlan[] = [{ id: "b", days: [day("b18", "2026-11-18")] }];

    expect(daysToRestore([cleared[0] as (typeof cleared)[number]], live, "b").skipped).toEqual([]);
  });
});

describe("isPlanUndoable", () => {
  it("should allow a live plan with no confirmed day", () => {
    expect(isPlanUndoable({ days: [{ isConfirmed: false }] })).toBe(true);
  });

  it("should refuse a missing plan and one with a confirmed day", () => {
    expect(isPlanUndoable(undefined)).toBe(false);
    expect(isPlanUndoable({ days: [{ isConfirmed: false }, { isConfirmed: true }] })).toBe(false);
  });
});

const item = (
  id: string,
  position: number,
  overrides: Partial<StoredPlanItem> = {},
): StoredPlanItem =>
  ({
    id,
    position,
    slotTime: "12:30:00",
    nutrients: { kcal: 500 },
    snapshot: { kind: "recipe" },
    leftoverOf: null,
    kind: "recipe",
    recipeId: "r1",
    servings: 1,
    ...overrides,
  }) as StoredPlanItem;

describe("restorableItemsOfDay", () => {
  const plan: StoredPlan = {
    days: [
      {
        id: "d1",
        localDate: "2026-11-16",
        items: [
          item("i1", 0),
          item("i2", 1, { kind: "food", foodId: null, grams: 80, portionId: null }),
        ],
      },
      { id: "d2", localDate: "2026-11-17", items: [item("i3", 0, { leftoverOf: "i1" })] },
    ],
  };

  it("should give a day's items back as the repo takes them, without their ids", () => {
    const [first] = restorableItemsOfDay(plan, "d1");

    expect(first).toEqual({
      position: 0,
      slotTime: "12:30:00",
      nutrients: { kcal: 500 },
      snapshot: { kind: "recipe" },
      kind: "recipe",
      recipeId: "r1",
      servings: 1,
    });
  });

  it("should leave out an item whose food or recipe is gone", () => {
    expect(restorableItemsOfDay(plan, "d1")).toHaveLength(1);
  });

  it("should name a leftover's cook by its day and position", () => {
    expect(restorableItemsOfDay(plan, "d2")[0]?.leftoverOf).toEqual({
      localDate: "2026-11-16",
      position: 0,
    });
  });

  it("should drop the cook link when the cook cannot be put back", () => {
    const broken: StoredPlan = {
      days: [
        { id: "d1", localDate: "2026-11-16", items: [item("i1", 0, { recipeId: null })] },
        { id: "d2", localDate: "2026-11-17", items: [item("i3", 0, { leftoverOf: "i1" })] },
      ],
    };

    expect(restorableItemsOfDay(broken, "d2")[0]?.leftoverOf).toBeUndefined();
  });

  it("should give nothing for a day that is not in the plan", () => {
    expect(restorableItemsOfDay(plan, "nope")).toEqual([]);
  });
});
