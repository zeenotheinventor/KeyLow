import { describe, expect, it } from "vitest";

import { mapHealthBodyFatSamples, mapHealthLeanMassSamples } from "../../src/weight";

import type { HealthBodyFatSample, HealthLeanMassSample, HealthMassUnit } from "../../src/weight";

const LONDON = { timeZone: "Europe/London" };

function bodyFat(overrides: Partial<HealthBodyFatSample> = {}): HealthBodyFatSample {
  return { sampleId: "hc-fat-1", measuredAt: "2026-10-15T07:30:00Z", value: 22.4, ...overrides };
}

function leanMass(overrides: Partial<HealthLeanMassSample> = {}): HealthLeanMassSample {
  return {
    sampleId: "hc-lean-1",
    measuredAt: "2026-10-15T07:30:00Z",
    value: 63,
    unit: "kilograms",
    ...overrides,
  };
}

const bodyFatValueOf = (value: number): number | undefined =>
  mapHealthBodyFatSamples([bodyFat({ value })], LONDON).rows[0]?.value;

const leanMassValueOf = (overrides: Partial<HealthLeanMassSample>): number | undefined =>
  mapHealthLeanMassSamples([leanMass(overrides)], LONDON).rows[0]?.value;

/** The two kinds share every rule except the value, so these cases run once for each. */
const kinds = [
  {
    name: "body fat",
    kind: "body_fat_pct",
    map: (overrides: { sampleId?: string; measuredAt?: string }) =>
      mapHealthBodyFatSamples([bodyFat(overrides)], LONDON),
  },
  {
    name: "lean mass",
    kind: "lean_mass_kg",
    map: (overrides: { sampleId?: string; measuredAt?: string }) =>
      mapHealthLeanMassSamples([leanMass(overrides)], LONDON),
  },
] as const;

describe.each(kinds)("mapping $name samples", ({ kind, map }) => {
  it("should return the import insert shape", () => {
    const { rows, skipped } = map({});

    expect(skipped).toBe(0);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      kind,
      measured_at: "2026-10-15T07:30:00.000Z",
      local_date: "2026-10-15",
      tz: "Europe/London",
      source: "health_connect",
    });
  });

  it.each([
    "2026-10-15T07:30:00",
    "2026-10-15T07:30",
    "2026-10-15",
    "not a time",
    "",
    "2026-02-30T07:30:00Z",
    "2026-10-15T07:30:00+25:00",
  ])("should skip the time %j, which is unparseable or has no offset", (measuredAt) => {
    expect(map({ measuredAt })).toStrictEqual({ rows: [], skipped: 1 });
  });

  it.each([
    ["2026-10-15T08:30:00+01:00", "2026-10-15T07:30:00.000Z"],
    ["2026-10-15T02:30:00-05:00", "2026-10-15T07:30:00.000Z"],
    ["2026-10-15T07:30:00.123456Z", "2026-10-15T07:30:00.123Z"],
  ])("should read %s as the instant %s", (measuredAt, instant) => {
    expect(map({ measuredAt }).rows[0]?.measured_at).toBe(instant);
  });

  it("should skip a sample id of 0 characters and one of 201", () => {
    expect(map({ sampleId: "" }).skipped).toBe(1);
    expect(map({ sampleId: "a".repeat(201) }).skipped).toBe(1);
  });

  it("should keep sample ids of 1 and 200 characters", () => {
    expect(map({ sampleId: "a" }).rows[0]?.external_id).toBe("a");
    expect(map({ sampleId: "a".repeat(200) }).rows[0]?.external_id).toBe("a".repeat(200));
  });

  it("should count a sample id in characters, so an emoji is one", () => {
    expect(map({ sampleId: "\u{1F4AA}".repeat(200) }).skipped).toBe(0);
    expect(map({ sampleId: "\u{1F4AA}".repeat(201) }).skipped).toBe(1);
  });

  describe("local_date in the profile zone", () => {
    it("should keep 23:30 UTC on 28 March 2026 on the same date in London", () => {
      expect(map({ measuredAt: "2026-03-28T23:30:00Z" }).rows[0]?.local_date).toBe("2026-03-28");
    });

    it("should move 23:30 UTC on 29 March 2026 to 30 March in London, as the clocks go forward", () => {
      expect(map({ measuredAt: "2026-03-29T23:30:00Z" }).rows[0]?.local_date).toBe("2026-03-30");
    });

    it("should not take the date from the offset of the sample", () => {
      const { rows } = map({ measuredAt: "2026-03-29T19:30:00-05:00" });

      expect(rows[0]?.local_date).toBe("2026-03-30");
      expect(rows[0]?.tz).toBe("Europe/London");
    });
  });
});

describe("mapHealthBodyFatSamples", () => {
  it("should map 22.4 to 22.4", () => {
    expect(bodyFatValueOf(22.4)).toBe(22.4);
  });

  it.each([0.999, 75.0006, 0, -5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "should skip the value %s",
    (value) => {
      expect(mapHealthBodyFatSamples([bodyFat({ value })], LONDON)).toStrictEqual({
        rows: [],
        skipped: 1,
      });
    },
  );

  it("should keep 0.9996 as 1.000, because the bound is checked after rounding", () => {
    expect(bodyFatValueOf(0.9996)).toBe(1);
  });

  it("should keep 75.0004 as 75.000", () => {
    expect(bodyFatValueOf(75.0004)).toBe(75);
  });

  it("should round to 3 decimals, half away from zero", () => {
    expect(bodyFatValueOf(32.0025)).toBe(32.003);
  });

  it("should keep 1 and 75 exactly", () => {
    expect([bodyFatValueOf(1), bodyFatValueOf(75)]).toStrictEqual([1, 75]);
  });
});

describe("mapHealthLeanMassSamples", () => {
  it.each<[HealthMassUnit, number]>([
    ["kilograms", 63],
    ["grams", 63_000],
    ["pounds", 138.8912],
    ["ounces", 2222.2646],
    ["milligrams", 63_000_000],
    ["micrograms", 63_000_000_000],
  ])("should read %s of %s as 63 kg within a gram", (unit, value) => {
    expect(leanMassValueOf({ unit, value })).toBeCloseTo(63, 3);
  });

  it.each([9.99, 300.01, 0, -63, Number.NaN, Number.POSITIVE_INFINITY])(
    "should skip %s kg",
    (value) => {
      expect(mapHealthLeanMassSamples([leanMass({ value })], LONDON)).toStrictEqual({
        rows: [],
        skipped: 1,
      });
    },
  );

  it("should keep 9.9996 as 10.000 and 300.0004 as 300.000", () => {
    expect(leanMassValueOf({ value: 9.9996 })).toBe(10);
    expect(leanMassValueOf({ value: 300.0004 })).toBe(300);
  });

  it("should check the bounds after the conversion, not before", () => {
    expect(leanMassValueOf({ unit: "grams", value: 9_999.6 })).toBe(10);
    expect(
      mapHealthLeanMassSamples([leanMass({ unit: "grams", value: 9_999.4 })], LONDON).skipped,
    ).toBe(1);
    expect(
      mapHealthLeanMassSamples([leanMass({ unit: "pounds", value: 700 })], LONDON).skipped,
    ).toBe(1);
  });

  it("should convert with the same constants as weight, a pound is 0.45359237 kg", () => {
    expect(leanMassValueOf({ unit: "pounds", value: 100 })).toBe(45.359);
  });

  it("should skip a unit it does not know", () => {
    // A sample comes from a native module, so a unit outside the list is possible at runtime.
    const record = { ...leanMass(), unit: "stones" as HealthMassUnit };

    expect(mapHealthLeanMassSamples([record], LONDON).skipped).toBe(1);
  });
});

describe("what a mapper keeps", () => {
  const sevenKeys = ["external_id", "kind", "local_date", "measured_at", "source", "tz", "value"];

  it("should keep only the seven columns of a body fat insert, whatever else the record carries", () => {
    const record = {
      ...bodyFat(),
      metadata: { clientRecordId: "abc", recordingMethod: 3 },
      device: { manufacturer: "Withings", model: "Body+" },
      dataOrigin: "com.withings.wiscale2",
    };

    const row = mapHealthBodyFatSamples([record], LONDON).rows[0];

    expect(Object.keys(row ?? {}).sort()).toStrictEqual(sevenKeys);
    expect(JSON.stringify(row)).not.toMatch(/Withings|wiscale2|clientRecordId/);
  });

  it("should keep only the seven columns of a lean mass insert, whatever else the record carries", () => {
    const record = {
      ...leanMass(),
      metadata: { clientRecordId: "abc", recordingMethod: 3 },
      device: { manufacturer: "Withings", model: "Body+" },
      dataOrigin: "com.withings.wiscale2",
    };

    const row = mapHealthLeanMassSamples([record], LONDON).rows[0];

    expect(Object.keys(row ?? {}).sort()).toStrictEqual(sevenKeys);
    expect(JSON.stringify(row)).not.toMatch(/Withings|wiscale2|clientRecordId/);
  });

  it("should give the same rows for the same samples, so the import key is stable", () => {
    expect(mapHealthBodyFatSamples([bodyFat()], LONDON)).toStrictEqual(
      mapHealthBodyFatSamples([bodyFat()], LONDON),
    );
    expect(mapHealthLeanMassSamples([leanMass()], LONDON)).toStrictEqual(
      mapHealthLeanMassSamples([leanMass()], LONDON),
    );
  });

  it("should not change the samples it is given", () => {
    const input = [bodyFat({ value: 22.4567 })];
    const copy = structuredClone(input);

    mapHealthBodyFatSamples(input, LONDON);

    expect(input).toStrictEqual(copy);
  });
});

describe("a batch", () => {
  it("should return 3 rows and skipped 2 for 3 good samples and 2 bad ones, body fat", () => {
    const result = mapHealthBodyFatSamples(
      [
        bodyFat({ sampleId: "a", value: 20 }),
        bodyFat({ sampleId: "b", value: 0.5 }),
        bodyFat({ sampleId: "c", value: 21 }),
        bodyFat({ sampleId: "", value: 22 }),
        bodyFat({ sampleId: "d", value: 23 }),
      ],
      LONDON,
    );

    expect(result.rows.map((row) => row.external_id)).toStrictEqual(["a", "c", "d"]);
    expect(result.skipped).toBe(2);
  });

  it("should return 3 rows and skipped 2 for 3 good samples and 2 bad ones, lean mass", () => {
    const result = mapHealthLeanMassSamples(
      [
        leanMass({ sampleId: "a", value: 60 }),
        leanMass({ sampleId: "b", value: 9.99 }),
        leanMass({ sampleId: "c", value: 61 }),
        leanMass({ measuredAt: "2026-10-15T07:30:00", value: 62 }),
        leanMass({ sampleId: "d", value: 63 }),
      ],
      LONDON,
    );

    expect(result.rows.map((row) => row.external_id)).toStrictEqual(["a", "c", "d"]);
    expect(result.skipped).toBe(2);
  });

  it("should return nothing and skip nothing for no samples", () => {
    expect(mapHealthBodyFatSamples([], LONDON)).toStrictEqual({ rows: [], skipped: 0 });
    expect(mapHealthLeanMassSamples([], LONDON)).toStrictEqual({ rows: [], skipped: 0 });
  });

  it("should return only rows and a count, with nothing about the skipped samples", () => {
    const result = mapHealthBodyFatSamples(
      [bodyFat({ sampleId: "secret-id", value: 0.1 })],
      LONDON,
    );

    expect(Object.keys(result).sort()).toStrictEqual(["rows", "skipped"]);
    expect(JSON.stringify(result)).not.toMatch(/secret-id/);
  });
});
