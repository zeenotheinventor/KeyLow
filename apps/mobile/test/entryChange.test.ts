import { breastEntry, chickenEntry, crispsEntry } from "./support/entries";
import { foodEntryChange, quickEntryChange } from "../lib/entryChange";

import type { PortionSelection } from "../components/PortionPicker";

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
        portion: {
          id: "33333333-3333-4333-8333-333333333333",
          food_id: "22222222-2222-4222-8222-222222222222",
          owner_id: null,
          label: "1 breast",
          grams: 150,
          ml: null,
          is_default: true,
          position: 0,
          created_at: "2026-10-15T11:40:31+00:00",
        },
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

  it("should read the time in the zone it is given, not London", () => {
    expect(
      foodEntryChange(chickenEntry(), selection({ time: "08:30" }), "America/New_York"),
    ).toEqual({
      time: { loggedAt: "2026-10-15T12:30:00.000Z", timeZone: "America/New_York" },
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

describe("quickEntryChange", () => {
  it("should be nothing when the time is as logged", () => {
    expect(quickEntryChange(crispsEntry(), "12:45", London)).toBeNull();
  });

  it("should change the time alone", () => {
    expect(quickEntryChange(crispsEntry(), "13:15", London)).toEqual({
      time: { loggedAt: "2026-10-15T12:15:00.000Z", timeZone: London },
    });
  });
});
