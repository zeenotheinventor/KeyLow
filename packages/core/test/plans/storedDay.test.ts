import { describe, expect, it } from "vitest";

import { stewWeek } from "./storedPlan";
import {
  dayFingerprint,
  dayToReplan,
  relinkedDaysToRestore,
  replanUndoState,
} from "../../src/plans";

import type { FingerprintItem, LivePlan } from "../../src/plans";

const live = (
  days: { id: string; localDate: string; itemCount?: number; isConfirmed?: boolean }[],
  id = "plan",
): LivePlan => ({
  id,
  days: days.map((day) => ({ itemCount: 3, isConfirmed: false, ...day })),
});

describe("dayToReplan", () => {
  it("should find the day with items on that date", () => {
    expect(dayToReplan([live([{ id: "d1", localDate: "2026-11-19" }])], "2026-11-19")).toEqual({
      status: "found",
      planId: "plan",
      dayId: "d1",
    });
  });

  it("should say a date in no plan, or a day left empty, is not planned", () => {
    expect(dayToReplan([live([{ id: "d1", localDate: "2026-11-19" }])], "2026-11-20")).toEqual({
      status: "not_planned",
    });
    expect(
      dayToReplan([live([{ id: "d1", localDate: "2026-11-19", itemCount: 0 }])], "2026-11-19"),
    ).toEqual({ status: "not_planned" });
  });

  it("should refuse a confirmed day", () => {
    expect(
      dayToReplan([live([{ id: "d1", localDate: "2026-11-19", isConfirmed: true }])], "2026-11-19"),
    ).toEqual({ status: "confirmed" });
  });

  it("should take the plan that holds the date when an older plan left it empty", () => {
    const older = live([{ id: "old", localDate: "2026-11-19", itemCount: 0 }], "older");
    const newer = live([{ id: "new", localDate: "2026-11-19" }], "newer");

    expect(dayToReplan([older, newer], "2026-11-19")).toEqual({
      status: "found",
      planId: "newer",
      dayId: "new",
    });
  });
});

const recipeItem = (
  over: Partial<Extract<FingerprintItem, { kind: "recipe" }>> = {},
): FingerprintItem => ({
  position: 0,
  slotTime: "12:30",
  kind: "recipe",
  recipeId: "stew",
  servings: 1,
  ...over,
});

describe("dayFingerprint", () => {
  it("should read a stored day and the items written to it the same", () => {
    const { stored } = stewWeek(2);
    const day = stored.days[0];
    const written = (day?.items ?? []).map((item) => ({
      ...item,
      slotTime: item.slotTime?.slice(0, 5) ?? null,
    }));

    expect(dayFingerprint(day?.items ?? [])).toBe(dayFingerprint(written));
  });

  it("should change with an amount, a food or a time", () => {
    const base = dayFingerprint([recipeItem()]);

    expect(dayFingerprint([recipeItem({ servings: 2 })])).not.toBe(base);
    expect(dayFingerprint([recipeItem({ recipeId: "bowl" })])).not.toBe(base);
    expect(dayFingerprint([recipeItem({ slotTime: "19:00" })])).not.toBe(base);
  });

  it("should not depend on the order the items are given in", () => {
    const first = recipeItem();
    const second = recipeItem({ position: 1, recipeId: "bowl" });

    expect(dayFingerprint([second, first])).toBe(dayFingerprint([first, second]));
  });
});

describe("replanUndoState", () => {
  const items = [recipeItem()];
  const fingerprint = dayFingerprint(items);

  it("should be ready when the day holds what the replan left", () => {
    expect(replanUndoState({ id: "d", isConfirmed: false, items }, fingerprint)).toBe("ready");
  });

  it.each([
    ["gone", undefined],
    ["confirmed", { id: "d", isConfirmed: true, items }],
    ["changed", { id: "d", isConfirmed: false, items: [recipeItem({ servings: 2 })] }],
  ] as const)("should be %s", (state, day) => {
    expect(replanUndoState(day, fingerprint)).toBe(state);
  });
});

describe("relinkedDaysToRestore", () => {
  const items = [recipeItem()];
  const saved = [
    { dayId: "a", items },
    { dayId: "b", items },
    { dayId: "c", items },
  ];

  it("should leave out a day that is confirmed, changed or gone", () => {
    const current = [
      { id: "a", isConfirmed: false, items },
      { id: "b", isConfirmed: true, items },
      { id: "c", isConfirmed: false, items: [recipeItem({ servings: 3 })] },
    ];

    expect(relinkedDaysToRestore(saved, current).map(({ dayId }) => dayId)).toEqual(["a"]);
  });
});
