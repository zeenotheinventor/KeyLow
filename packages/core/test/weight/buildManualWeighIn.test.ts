import { describe, expect, it } from "vitest";

import { buildManualWeighIn } from "../../src/weight";

const MEASURED_AT = new Date("2026-10-15T07:30:00Z");

function build(overrides: Partial<Parameters<typeof buildManualWeighIn>[0]> = {}) {
  return buildManualWeighIn({
    weightKg: 81.4,
    measuredAt: MEASURED_AT,
    note: null,
    timeZone: "Europe/London",
    ...overrides,
  });
}

function messageOf(action: () => unknown): string {
  try {
    action();
  } catch (error) {
    return error instanceof Error ? error.message : "";
  }
  return "did not throw";
}

describe("buildManualWeighIn", () => {
  it("should return the insert shape of a manual weigh-in", () => {
    expect(build({ note: "after a run" })).toEqual({
      weight_kg: 81.4,
      measured_at: "2026-10-15T07:30:00.000Z",
      local_date: "2026-10-15",
      tz: "Europe/London",
      source: "manual",
      external_id: null,
      note: "after a run",
    });
  });

  it("should send exactly the seven columns", () => {
    expect(Object.keys(build()).sort()).toEqual([
      "external_id",
      "local_date",
      "measured_at",
      "note",
      "source",
      "tz",
      "weight_kg",
    ]);
  });

  it("should keep 23:30 UTC on 28 March 2026 on the same date in London, which is on GMT", () => {
    const row = build({ measuredAt: new Date("2026-03-28T23:30:00Z") });

    expect(row.local_date).toBe("2026-03-28");
  });

  it("should move 23:30 UTC on 29 March 2026 to the 30th in London, after the clocks go forward", () => {
    const row = build({ measuredAt: new Date("2026-03-29T23:30:00Z") });

    expect(row.local_date).toBe("2026-03-30");
  });

  it("should use the time zone it is given, not the offset of the instant", () => {
    const row = build({ measuredAt: new Date("2026-10-15T23:30:00Z"), timeZone: "Asia/Tokyo" });

    expect(row.local_date).toBe("2026-10-16");
    expect(row.tz).toBe("Asia/Tokyo");
  });

  it("should trim the note and store a blank one as null", () => {
    expect(build({ note: "  fasted  " }).note).toBe("fasted");
    expect(build({ note: "   " }).note).toBeNull();
  });

  it("should round the weight to 3 decimals before it checks the bounds", () => {
    expect(build({ weightKg: 19.9996 }).weight_kg).toBe(20);
    expect(build({ weightKg: 400.0004 }).weight_kg).toBe(400);
    expect(build({ weightKg: 81.4126 }).weight_kg).toBe(81.413);
  });

  it.each([19.9994, 400.0006, 19.9, 400.1, 0, -5, Number.NaN, Number.POSITIVE_INFINITY])(
    "should throw a RangeError for the weight %s",
    (weightKg) => {
      expect(() => build({ weightKg })).toThrow(RangeError);
    },
  );

  it.each([20, 400])("should accept the bound %s kg", (weightKg) => {
    expect(build({ weightKg }).weight_kg).toBe(weightKg);
  });

  it("should accept a note of 200 characters and throw a RangeError for 201", () => {
    expect(build({ note: "a".repeat(200) }).note).toBe("a".repeat(200));
    expect(() => build({ note: "a".repeat(201) })).toThrow(RangeError);
  });

  it("should not put the weight or the note in the text of an error", () => {
    const weightMessage = messageOf(() => build({ weightKg: 814.123 }));
    const noteMessage = messageOf(() => build({ note: `secret ${"a".repeat(200)}` }));

    expect(weightMessage).not.toMatch(/814/);
    expect(weightMessage).toMatch(/20/);
    expect(noteMessage).not.toMatch(/secret/);
    expect(noteMessage).toMatch(/200/);
  });
});
