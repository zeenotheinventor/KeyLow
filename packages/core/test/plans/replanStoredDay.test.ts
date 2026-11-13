import { describe, expect, it } from "vitest";

import { RULES } from "./pools";
import { stewFoods, stewWeek, STEW } from "./storedPlan";
import { dayFingerprint, replanDay, replanStoredDay } from "../../src/plans";

import type { ReplanStoredDayInput } from "../../src/plans";

const { plan, stored, rows } = stewWeek(3);
const cookDay = plan.days.find((day) =>
  day.items.some((item) => item.leftoverOf === null && item.kind === "recipe"),
);
const cookStored = stored.days.find((day) => day.localDate === cookDay?.localDate);

const inputFor = (
  dayId: string,
  overrides: Partial<ReplanStoredDayInput> = {},
): ReplanStoredDayInput => ({
  plan: stored,
  dayId,
  recipes: [STEW],
  foods: stewFoods,
  maxRepeats: 2,
  ranking: null,
  ...rows,
  ...overrides,
});

describe("replanStoredDay", () => {
  it("should plan the day again from its own target and number its items from 0", () => {
    const day = stored.days[1];
    const result = replanStoredDay(inputFor(day?.id ?? "", { recipes: [], ranking: null }));

    expect(result.status).toBe("replanned");
    if (result.status !== "replanned") {
      return;
    }
    expect(result.localDate).toBe("2026-11-17");
    expect(result.day.target).toEqual({ kcal: 1300, protein_g: 90 });
    expect(result.items.map(({ position }) => position)).toEqual(
      result.day.items.map((_, position) => position),
    );
    expect(result.fingerprint).toBe(dayFingerprint(result.items));
  });

  it("should reuse the stored ranking when the person gave no new words", () => {
    const day = stored.days[2];
    const result = replanStoredDay(inputFor(day?.id ?? "", { recipes: [] }));

    const direct = replanDay(plan, "2026-11-18", {
      recipes: [],
      foods: stewFoods,
      ranking: ["stew"],
      rules: RULES,
    }).plan.days[2];
    expect(result.status === "replanned" ? result.day : null).toEqual(direct);
  });

  it("should plan only what the new words ranked", () => {
    const day = stored.days[1];
    const result = replanStoredDay(
      inputFor(day?.id ?? "", { recipes: [], ranking: ["rice", "chicken"] }),
    );

    expect(result.status).toBe("replanned");
    if (result.status === "replanned") {
      expect(result.wishesKept).toBe(true);
      const ids = result.day.items.flatMap((item) => (item.kind === "food" ? [item.foodId] : []));
      expect(new Set(ids)).toEqual(new Set(["rice", "chicken"]));
    }
  });

  it("should use the whole kitchen and say so when the ranked items place nothing", () => {
    const day = stored.days[1];
    const result = replanStoredDay(inputFor(day?.id ?? "", { recipes: [], ranking: ["nothing"] }));

    expect(result.status === "replanned" ? result.wishesKept : null).toBe(false);
    expect(result.status === "replanned" ? result.day.items.length : 0).toBeGreaterThan(0);
  });

  it("should keep a cook whose leftovers other days eat, as it was stored, and relink those days", () => {
    const result = replanStoredDay(inputFor(cookStored?.id ?? ""));

    expect(result.status).toBe("replanned");
    if (result.status !== "replanned") {
      return;
    }
    const cook = cookStored?.items.find((item) => item.kind === "recipe");
    expect(result.kept).toEqual([cookDay?.items.find((item) => item.kind === "recipe")?.key]);
    const keptItem = result.items.find((item) => item.kind === "recipe");
    expect(keptItem?.snapshot).toEqual(cook?.snapshot);
    const newPosition = keptItem?.position;
    expect(result.relinks.length).toBeGreaterThan(0);
    for (const relinked of result.relinks) {
      expect(relinked.items.filter((item) => item.leftoverOf !== undefined)[0]?.leftoverOf).toEqual(
        {
          localDate: cookDay?.localDate,
          position: newPosition,
        },
      );
    }
    expect(result.relinks.map(({ localDate }) => localDate)).toEqual(
      [...result.relinks.map(({ localDate }) => localDate)].sort(),
    );
  });

  it("should keep each relinked day's items as they were, and hand them back for Undo", () => {
    const result = replanStoredDay(inputFor(cookStored?.id ?? ""));

    expect(result.status).toBe("replanned");
    if (result.status !== "replanned") {
      return;
    }
    expect(result.previous.relinked.map(({ dayId }) => dayId)).toEqual(
      result.relinks.map(({ dayId }) => dayId),
    );
    for (const [at, relinked] of result.relinks.entries()) {
      const before = result.previous.relinked[at]?.items ?? [];
      expect(relinked.items.map(({ position, snapshot }) => [position, snapshot])).toEqual(
        before.map(({ position, snapshot }) => [position, snapshot]),
      );
    }
    expect(result.previous.items.length).toBe(cookStored?.items.length);
  });

  it("should not write a confirmed day that eats a kept cook's leftovers", () => {
    const confirmed = {
      ...stored,
      days: stored.days.map((day) =>
        day.localDate === cookDay?.localDate
          ? day
          : { ...day, confirmedAt: "2026-11-17T12:00:00Z" },
      ),
    };

    const result = replanStoredDay(inputFor(cookStored?.id ?? "", { plan: confirmed }));

    expect(result.status === "replanned" ? result.relinks : null).toEqual([]);
    expect(result.status === "replanned" ? result.skippedRelinks : null).toBeGreaterThan(0);
  });

  it("should not write a day that holds an item it could not put back", () => {
    const broken = {
      ...stored,
      days: stored.days.map((day) =>
        day.localDate === cookDay?.localDate
          ? day
          : {
              ...day,
              items: day.items.map((item, at) =>
                at === 0 && item.kind === "food" ? { ...item, foodId: null } : item,
              ),
            },
      ),
    };

    const result = replanStoredDay(inputFor(cookStored?.id ?? "", { plan: broken }));

    expect(result.status === "replanned" ? result.relinks : null).toEqual([]);
    expect(result.status === "replanned" ? result.skippedRelinks : null).toBeGreaterThan(0);
  });

  it("should count nothing skipped when every eating day could be written", () => {
    const result = replanStoredDay(inputFor(cookStored?.id ?? ""));

    expect(result.status === "replanned" ? result.skippedRelinks : null).toBe(0);
  });

  it("should use the whole kitchen and say the wishes were not kept when the new words ranked nothing", () => {
    const result = replanStoredDay(
      inputFor(stored.days[1]?.id ?? "", { recipes: [], ranking: [] }),
    );

    expect(result.status === "replanned" ? result.wishesKept : null).toBe(false);
    expect(result.status === "replanned" ? result.day.items.length : 0).toBeGreaterThan(0);
  });

  it("should keep a cook whose recipe is no longer offered, as stored, with no recipe row for it", () => {
    const result = replanStoredDay(
      inputFor(cookStored?.id ?? "", { recipes: [], recipeRows: new Map() }),
    );

    expect(result.status).toBe("replanned");
    if (result.status === "replanned") {
      const cook = cookStored?.items.find((item) => item.kind === "recipe");
      expect(result.items.find((item) => item.kind === "recipe")?.snapshot).toEqual(cook?.snapshot);
    }
  });

  it("should say the day is unreadable when its target has no calories", () => {
    const damaged = {
      ...stored,
      days: stored.days.map((day) =>
        day.localDate === "2026-11-17" ? { ...day, target: {} } : day,
      ),
    };

    expect(replanStoredDay(inputFor(stored.days[1]?.id ?? "", { plan: damaged }))).toEqual({
      status: "unreadable_day",
    });
  });

  it("should place nothing when there is nothing to plan from", () => {
    const result = replanStoredDay(inputFor(stored.days[1]?.id ?? "", { recipes: [], foods: [] }));

    expect(result).toEqual({ status: "no_items" });
  });

  describe("a chain of leftovers over three days", () => {
    const nutrients = { kcal: 500, protein_g: 30, fat_g: 10, carbs_g: 50, fibre_g: 2 };
    const recipeItem = (
      id: string,
      position: number,
      recipeId: string,
      slotTime: string,
      leftoverOf: string | null,
    ) => ({
      id,
      position,
      slotTime,
      nutrients,
      snapshot: {},
      leftoverOf,
      kind: "recipe" as const,
      recipeId,
      servings: 1,
    });
    const day = (id: string, localDate: string, items: ReturnType<typeof recipeItem>[]) => ({
      id,
      localDate,
      target: { kcal: 1300 },
      confirmedAt: null,
      items,
    });
    // Monday cooks K. Tuesday eats K and cooks C. Wednesday eats C.
    const chain = {
      rules: {},
      days: [
        day("mon", "2026-11-16", [recipeItem("k", 0, "stew", "19:00:00", null)]),
        day("tue", "2026-11-17", [
          recipeItem("e", 0, "stew", "19:00:00", "k"),
          recipeItem("c", 1, "curry", "12:30:00", null),
        ]),
        day("wed", "2026-11-18", [recipeItem("f", 0, "curry", "12:30:00", "c")]),
      ],
    };

    it("should write the day that cooks for a day that eats the kept cook, so Wednesday keeps its link", () => {
      const result = replanStoredDay(
        inputFor("mon", { plan: chain, recipes: [], foods: stewFoods }),
      );

      expect(result.status).toBe("replanned");
      if (result.status !== "replanned") {
        return;
      }
      expect(result.relinks.map(({ localDate }) => localDate)).toEqual([
        "2026-11-17",
        "2026-11-18",
      ]);
      const keptPosition = result.items.find((item) => item.kind === "recipe")?.position;
      expect(result.relinks[0]?.items[0]?.leftoverOf).toEqual({
        localDate: "2026-11-16",
        position: keptPosition,
      });
      expect(result.relinks[1]?.items[0]?.leftoverOf).toEqual({
        localDate: "2026-11-17",
        position: 1,
      });
      expect(result.skippedRelinks).toBe(0);
    });

    it("should stop at a confirmed day and count it, so the days after it are not touched", () => {
      const confirmed = {
        ...chain,
        days: chain.days.map((each) =>
          each.id === "tue" ? { ...each, confirmedAt: "2026-11-17T12:00:00Z" } : each,
        ),
      };

      const result = replanStoredDay(
        inputFor("mon", { plan: confirmed, recipes: [], foods: stewFoods }),
      );

      expect(result.status === "replanned" ? result.relinks : null).toEqual([]);
      expect(result.status === "replanned" ? result.skippedRelinks : null).toBe(1);
    });
  });
});
