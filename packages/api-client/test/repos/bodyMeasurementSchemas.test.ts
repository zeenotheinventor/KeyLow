import { describe, expect, it } from "vitest";

import { bodyMeasurementSchema } from "../../src/repos/bodyMeasurementSchemas";

const row = {
  id: "55555555-5555-4555-8555-000000000001",
  kind: "body_fat_pct",
  measured_at: "2026-10-15T07:30:00+00:00",
  local_date: "2026-10-15",
  tz: "Europe/London",
  value: 23.456,
  source: "health_connect",
};

const failureOf = (candidate: unknown) => {
  const result = bodyMeasurementSchema.safeParse(candidate);
  return result.success ? null : result.error;
};

describe("bodyMeasurementSchema", () => {
  it("should accept a row as the list reads it", () => {
    expect(bodyMeasurementSchema.parse(row)).toEqual(row);
  });

  it.each([
    ["body_fat_pct", 1],
    ["body_fat_pct", 75],
    ["lean_mass_kg", 10],
    ["lean_mass_kg", 300],
  ])("should accept %s at its bound %d", (kind, value) => {
    expect(bodyMeasurementSchema.safeParse({ ...row, kind, value }).success).toBe(true);
  });

  it.each([
    ["body_fat_pct", 0.999],
    ["body_fat_pct", 75.001],
    ["lean_mass_kg", 9.999],
    ["lean_mass_kg", 300.001],
  ])("should refuse %s outside its bound at %d", (kind, value) => {
    expect(failureOf({ ...row, kind, value })?.issues.map(({ path }) => path)).toEqual([["value"]]);
  });

  it("should check a value against its own kind, so 5 is body fat and not lean mass", () => {
    expect(
      bodyMeasurementSchema.safeParse({ ...row, kind: "body_fat_pct", value: 5 }).success,
    ).toBe(true);
    expect(
      bodyMeasurementSchema.safeParse({ ...row, kind: "lean_mass_kg", value: 5 }).success,
    ).toBe(false);
  });

  it("should refuse an unknown kind and an unknown source", () => {
    expect(bodyMeasurementSchema.safeParse({ ...row, kind: "muscle" }).success).toBe(false);
    expect(bodyMeasurementSchema.safeParse({ ...row, source: "guess" }).success).toBe(false);
  });

  it("should drop the user, the sample id and the dates the list does not select", () => {
    const parsed = bodyMeasurementSchema.parse({
      ...row,
      user_id: "u",
      external_id: "key571-sample",
      deleted_at: null,
      created_at: "2026-10-15T07:30:00+00:00",
    });

    expect(parsed).toEqual(row);
  });
});
