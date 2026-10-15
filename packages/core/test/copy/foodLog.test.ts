import { describe, expect, it } from "vitest";

import {
  CURRENT_HOUR_LABEL,
  DIARY_LOADING_LABEL,
  DIARY_VIEW,
  UNDO_LABEL,
  describeFoodsAtHour,
} from "../../src/copy";

describe("the food log's words", () => {
  it("should name the card of an hour's foods", () => {
    expect(describeFoodsAtHour("08:00")).toBe("Foods at 08:00");
  });

  it("should name the current hour's dot", () => {
    expect(CURRENT_HOUR_LABEL).toBe("Current hour");
  });

  it("should name the undo action, the Day and Week control and the loading diary", () => {
    expect(UNDO_LABEL).toBe("Undo");
    expect(DIARY_VIEW).toEqual({ label: "View", day: "Day", week: "Week" });
    expect(DIARY_LOADING_LABEL).toBe("Loading your diary");
  });
});
