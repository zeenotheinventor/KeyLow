import { describe, expect, it } from "vitest";

import { sampleSnapshot } from "./sampleSnapshot";
import {
  parseWidgetSnapshot,
  pendingUndoSchema,
  SIGNED_OUT_SOURCE,
  WidgetError,
} from "../../src/widgets";

describe("parseWidgetSnapshot", () => {
  it("should read a snapshot of the known version", () => {
    expect(parseWidgetSnapshot(sampleSnapshot())).toEqual({
      status: "ready",
      snapshot: sampleSnapshot(),
    });
  });

  it("should read the JSON text the app stored", () => {
    expect(parseWidgetSnapshot(JSON.stringify(sampleSnapshot()))).toEqual({
      status: "ready",
      snapshot: sampleSnapshot(),
    });
  });

  it("should read a snapshot of an unknown version as no data yet", () => {
    expect(parseWidgetSnapshot({ ...sampleSnapshot(), version: 2 })).toEqual({
      status: "no_data",
    });
  });

  it("should read nothing stored as no data yet", () => {
    expect(parseWidgetSnapshot(null)).toEqual({ status: "no_data" });
  });

  it("should read text that is not JSON as no data yet", () => {
    expect(parseWidgetSnapshot("{ not json")).toEqual({ status: "no_data" });
  });

  it("should not read a snapshot loosely when it holds a field the contract does not name", () => {
    expect(parseWidgetSnapshot({ ...sampleSnapshot(), email: "someone@example.com" })).toEqual({
      status: "no_data",
    });
  });

  it("should refuse a week that does not run Monday to Sunday", () => {
    const snapshot = sampleSnapshot();
    const shifted = { ...snapshot, week: [...snapshot.week].reverse() };

    expect(parseWidgetSnapshot(shifted)).toEqual({ status: "no_data" });
  });

  it("should refuse a week that does not hold today", () => {
    expect(parseWidgetSnapshot({ ...sampleSnapshot(), today: "2026-11-10" })).toEqual({
      status: "no_data",
    });
  });

  it("should refuse more recent foods than the widget lists", () => {
    const snapshot = sampleSnapshot();
    const [first] = snapshot.recentFoods;

    expect(
      parseWidgetSnapshot({ ...snapshot, recentFoods: [...snapshot.recentFoods, first] }),
    ).toEqual({ status: "no_data" });
  });

  it("should refuse four exercise names", () => {
    const snapshot = sampleSnapshot();
    const plan = { ...snapshot.training.plan, exerciseNames: ["A", "B", "C", "D"] };

    expect(parseWidgetSnapshot({ ...snapshot, training: { ...snapshot.training, plan } })).toEqual({
      status: "no_data",
    });
  });

  it("should refuse a time zone that does not exist", () => {
    expect(parseWidgetSnapshot({ ...sampleSnapshot(), timeZone: "Mars/Olympus" })).toEqual({
      status: "no_data",
    });
  });

  it("should refuse a contiguous week that starts on a Tuesday", () => {
    const days = [
      "2026-11-03",
      "2026-11-04",
      "2026-11-05",
      "2026-11-06",
      "2026-11-07",
      "2026-11-08",
      "2026-11-09",
    ];
    const week = days.map((localDate) => ({ localDate, isComplete: false, totals: null }));

    expect(parseWidgetSnapshot({ ...sampleSnapshot(), week })).toEqual({ status: "no_data" });
  });

  it("should refuse a nonce shorter than 16 characters", () => {
    expect(parseWidgetSnapshot({ ...sampleSnapshot(), nonce: "0123456789abcdef" })).toEqual({
      status: "ready",
      snapshot: { ...sampleSnapshot(), nonce: "0123456789abcdef" },
    });
    expect(parseWidgetSnapshot({ ...sampleSnapshot(), nonce: "0123456789abcde" })).toEqual({
      status: "no_data",
    });
  });

  it("should name the signed-out state for the app to choose", () => {
    expect(SIGNED_OUT_SOURCE).toEqual({ status: "signed_out" });
  });
});

describe("WidgetError", () => {
  it("should carry the action and the code and no value in its message", () => {
    const error = new WidgetError("view_model", "invalid_now");

    expect(error).toMatchObject({ action: "view_model", code: "invalid_now" });
    expect(error.message).toBe("Widget view_model failed: invalid_now");
  });
});

describe("pendingUndoSchema", () => {
  const record = {
    action: "log_again",
    rowId: "44444444-4444-4444-8444-444444444444",
    at: "2026-11-03T11:55:00Z",
  };

  it("should accept a valid record", () => {
    expect(pendingUndoSchema.safeParse(record).success).toBe(true);
  });

  it("should accept the recent food entry the tap repeated", () => {
    const sourceEntryId = "11111111-1111-4111-8111-111111111111";

    expect(pendingUndoSchema.parse({ ...record, sourceEntryId })).toMatchObject({ sourceEntryId });
  });

  it("should refuse a source entry id that is not a guid", () => {
    expect(pendingUndoSchema.safeParse({ ...record, sourceEntryId: "oats" }).success).toBe(false);
  });

  it("should refuse a record with no row id", () => {
    expect(pendingUndoSchema.safeParse({ action: record.action, at: record.at }).success).toBe(
      false,
    );
  });

  it("should refuse a row id that is not a guid", () => {
    expect(pendingUndoSchema.safeParse({ ...record, rowId: "row-1" }).success).toBe(false);
  });

  it("should refuse a field the contract does not name", () => {
    expect(pendingUndoSchema.safeParse({ ...record, name: "Overnight oats" }).success).toBe(false);
  });

  it("should refuse an action other than log_again or log_set", () => {
    expect(pendingUndoSchema.safeParse({ ...record, action: "weigh_in" }).success).toBe(false);
  });
});
