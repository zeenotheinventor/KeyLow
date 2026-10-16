import { breastEntry, chickenEntry, crispsEntry, oilEntry, tablespoon } from "./support/entries";
import { foodEntryChange, quickEntryChange } from "../lib/entryChange";

import type { PortionSelection } from "../components/PortionPicker";
import type { QuickAddSubmission } from "../components/QuickAddForm";
import type { SpoonPortion } from "@keylow/core/nutrition";

// What Save writes: only what the person changed, so a save that changes nothing writes nothing and an edit of
// the amount never moves the time (an entry's seconds keep it in its place among those at the same minute).

const London = "Europe/London";

function selection({
  quantity = 150,
  time = "12:40",
}: { quantity?: number; time?: string } = {}): PortionSelection {
  return { unit: "g", quantity, time, isNow: false };
}

describe("foodEntryChange", () => {
  it("should be nothing at all when the amount and the time are as logged", () => {
    expect(foodEntryChange(chickenEntry(), selection(), London)).toBeNull();
  });

  it("should change the amount alone when only the amount changed", () => {
    expect(foodEntryChange(chickenEntry(), selection({ quantity: 200 }), London)).toEqual({
      amount: { quantity: 200, unit: "g" },
    });
  });

  it("should change the unit with the amount", () => {
    expect(foodEntryChange(breastEntry(), selection({ quantity: 300 }), London)).toEqual({
      amount: { quantity: 300, unit: "g" },
    });
  });

  it("should keep the entry's own portion when the count of it changed", () => {
    const portion = breastEntry();
    const update = foodEntryChange(
      portion,
      {
        unit: "portion",
        quantity: 3,
        // The picker names the entry's own portion by the id core gives it on the entry screen.
        portion: { id: "snapshot-portion", label: "1 breast", grams: 150, ml: null },
        time: "12:40",
        isNow: false,
      },
      London,
    );

    expect(update).toEqual({ amount: { quantity: 3, unit: "portion" } });
  });

  it("should change the time alone when only the time changed, on the entry's own day, in the profile's zone", () => {
    expect(foodEntryChange(chickenEntry(), selection({ time: "08:30" }), London)).toEqual({
      time: { loggedAt: "2026-10-15T07:30:00.000Z", timeZone: London },
    });
  });

  it("should change both when both changed", () => {
    expect(
      foodEntryChange(chickenEntry(), selection({ quantity: 175, time: "13:05" }), London),
    ).toEqual({
      amount: { quantity: 175, unit: "g" },
      time: { loggedAt: "2026-10-15T12:05:00.000Z", timeZone: London },
    });
  });

  it("should write no meal field, ever", () => {
    const update = foodEntryChange(
      chickenEntry(),
      selection({ quantity: 175, time: "13:05" }),
      London,
    );

    expect(Object.keys(update ?? {}).sort()).toEqual(["amount", "time"]);
  });

  it("should leave an entry logged in ounces alone when the picker's grams are as it showed them", () => {
    const entry = chickenEntry({
      unit: "oz",
      quantity: 5,
      snapshot: { ...chickenEntry().snapshot, unit: "oz", quantity: 5 },
    });

    expect(foodEntryChange(entry, selection({ quantity: 141.7 }), London)).toBeNull();
  });
});

describe("foodEntryChange for an entry logged in spoons", () => {
  const teaspoon: SpoonPortion = { id: "spoon-tsp", label: "1 tsp", grams: null, ml: 5 };
  const spoonSelection = (spoon: SpoonPortion, quantity: number): PortionSelection => ({
    unit: "portion",
    quantity,
    portion: spoon,
    time: "12:40",
    isNow: false,
  });

  it("should be nothing at all when the spoon and the count are as logged", () => {
    expect(foodEntryChange(oilEntry(), spoonSelection(tablespoon, 2), London)).toBeNull();
  });

  it("should write a changed count as the spoon's snapshot portion with no link to a portion", () => {
    expect(foodEntryChange(oilEntry(), spoonSelection(tablespoon, 3), London)).toEqual({
      amount: { quantity: 3, unit: "portion", portion: { label: "1 tbsp", ml: 15 } },
    });
  });

  it("should write the other spoon when the count stays and the spoon changes", () => {
    expect(foodEntryChange(oilEntry(), spoonSelection(teaspoon, 2), London)).toEqual({
      amount: { quantity: 2, unit: "portion", portion: { label: "1 tsp", ml: 5 } },
    });
  });

  it("should write grams when the person switches to g", () => {
    expect(foodEntryChange(oilEntry(), selection({ quantity: 20 }), London)).toEqual({
      amount: { quantity: 20, unit: "g" },
    });
  });
});

describe("quickEntryChange", () => {
  // The saved crisps: 130 kcal, P 2, C 15, F 7, "Meal deal crisps" at 12:45.
  function submission(changes: Partial<QuickAddSubmission> = {}): QuickAddSubmission {
    return {
      kcal: 130,
      protein_g: 2,
      carbs_g: 15,
      fat_g: 7,
      label: "Meal deal crisps",
      time: "12:45",
      isNow: false,
      ...changes,
    };
  }

  it("should be nothing when the values and the time are as logged", () => {
    expect(quickEntryChange(crispsEntry(), submission(), London)).toBeNull();
  });

  it("should change the time alone when only the time changed", () => {
    expect(quickEntryChange(crispsEntry(), submission({ time: "13:15" }), London)).toEqual({
      time: { loggedAt: "2026-10-15T12:15:00.000Z", timeZone: London },
    });
  });

  it("should change the values alone when a value changed", () => {
    const update = quickEntryChange(crispsEntry(), submission({ fat_g: 8 }), London);

    expect(update).toEqual({ quick: expect.objectContaining({ fat_g: 8 }) as unknown });
    expect(update).not.toHaveProperty("time");
  });

  it("should hand over all the values, not only the one that changed, and no time", () => {
    expect(quickEntryChange(crispsEntry(), submission({ kcal: 140 }), London)).toEqual({
      quick: { kcal: 140, protein_g: 2, carbs_g: 15, fat_g: 7, label: "Meal deal crisps" },
    });
  });

  it("should change the values and the time together", () => {
    expect(
      quickEntryChange(crispsEntry(), submission({ kcal: 140, time: "13:15" }), London),
    ).toEqual({
      quick: { kcal: 140, protein_g: 2, carbs_g: 15, fat_g: 7, label: "Meal deal crisps" },
      time: { loggedAt: "2026-10-15T12:15:00.000Z", timeZone: London },
    });
  });
});
