import { describe, expect, it } from "vitest";

import { mapHealthSample, mapHealthSamples } from "../../src/weight";

import type { HealthMassUnit, HealthWeightSample } from "../../src/weight";

const LONDON = { timeZone: "Europe/London" };

function sample(overrides: Partial<HealthWeightSample> = {}): HealthWeightSample {
  return {
    sampleId: "hc-record-1",
    measuredAt: "2026-10-15T07:30:00Z",
    value: 80,
    unit: "kilograms",
    ...overrides,
  };
}

function weightOf(overrides: Partial<HealthWeightSample>): number | undefined {
  return mapHealthSample(sample(overrides), LONDON)?.weight_kg;
}

describe("mapHealthSample", () => {
  it("should return the import insert shape", () => {
    expect(mapHealthSample(sample(), LONDON)).toEqual({
      weight_kg: 80,
      measured_at: "2026-10-15T07:30:00.000Z",
      local_date: "2026-10-15",
      tz: "Europe/London",
      source: "health_connect",
      external_id: "hc-record-1",
      note: null,
    });
  });

  describe("unit conversion", () => {
    it.each<[HealthMassUnit, number]>([
      ["kilograms", 80],
      ["grams", 80_000],
      ["milligrams", 80_000_000],
      ["micrograms", 80_000_000_000],
      ["pounds", 176.37],
      ["ounces", 2821.9],
    ])("should read %s of %s as 80 kg within a gram", (unit, value) => {
      expect(weightOf({ unit, value })).toBeCloseTo(80, 3);
    });

    it("should convert a pound with 0.45359237 and an ounce with 0.028349523125", () => {
      expect(weightOf({ unit: "pounds", value: 100 })).toBe(45.359);
      expect(weightOf({ unit: "ounces", value: 1000 })).toBe(28.35);
    });

    it("should skip a unit it does not know", () => {
      // A sample comes from a native module, so a unit outside the list is possible at runtime.
      const unknownUnit = { ...sample(), unit: "stones" };

      expect(mapHealthSample(unknownUnit as unknown as HealthWeightSample, LONDON)).toBeNull();
    });
  });

  describe("rounding to the column", () => {
    it("should round to 3 decimals, and keep 19.9996 as 20.000", () => {
      expect(weightOf({ value: 19.9996 })).toBe(20);
      expect(weightOf({ value: 81.4126 })).toBe(81.413);
    });

    it.each([19.9994, 400.0006])("should skip %s kg, which rounds outside 20 to 400", (value) => {
      expect(mapHealthSample(sample({ value }), LONDON)).toBeNull();
    });

    it("should keep 400.0004 as 400.000", () => {
      expect(weightOf({ value: 400.0004 })).toBe(400);
    });

    it("should round a half the way the column does", () => {
      expect(weightOf({ value: 32.0025 })).toBe(32.003);
    });

    it("should check the range after the conversion, not before", () => {
      expect(weightOf({ unit: "grams", value: 19_999.6 })).toBe(20);
      expect(mapHealthSample(sample({ unit: "grams", value: 19_999.4 }), LONDON)).toBeNull();
    });
  });

  describe("a sample that cannot be used", () => {
    it.each([
      19.99,
      400.01,
      0,
      -80,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
    ])("should return null for the value %s", (value) => {
      expect(mapHealthSample(sample({ value }), LONDON)).toBeNull();
    });

    it.each([20, 400])("should keep %s kg", (value) => {
      expect(weightOf({ value })).toBe(value);
    });

    it.each([
      "2026-10-15T07:30:00",
      "2026-10-15T07:30",
      "2026-10-15",
      "2026-10-15 07:30:00Z",
      "15/10/2026 07:30",
      "not a time",
      "",
      "2026-02-30T07:30:00Z",
      "2026-13-01T07:30:00Z",
      "2026-10-15T24:00:00Z",
      "2026-10-15T07:60:00Z",
      "2026-10-15T07:30:00+25:00",
    ])(
      "should return null for the time %j, which is unparseable or has no offset",
      (measuredAt) => {
        expect(mapHealthSample(sample({ measuredAt }), LONDON)).toBeNull();
      },
    );

    it.each([undefined, null, 42])(
      "should return null, and not throw, for the sample id %s that a native module might give",
      (sampleId) => {
        const record = { ...sample(), sampleId };

        expect(mapHealthSample(record as unknown as HealthWeightSample, LONDON)).toBeNull();
      },
    );

    it("should return null for a sample id of 0 characters", () => {
      expect(mapHealthSample(sample({ sampleId: "" }), LONDON)).toBeNull();
    });

    it("should return null for a sample id of 201 characters", () => {
      expect(mapHealthSample(sample({ sampleId: "a".repeat(201) }), LONDON)).toBeNull();
    });

    it("should keep sample ids of 1 and 200 characters", () => {
      expect(mapHealthSample(sample({ sampleId: "a" }), LONDON)?.external_id).toBe("a");
      expect(mapHealthSample(sample({ sampleId: "a".repeat(200) }), LONDON)?.external_id).toBe(
        "a".repeat(200),
      );
    });

    it("should count a sample id in characters as the database does, so an emoji is one", () => {
      expect(mapHealthSample(sample({ sampleId: "\u{1F4AA}".repeat(200) }), LONDON)).not.toBeNull();
      expect(mapHealthSample(sample({ sampleId: "\u{1F4AA}".repeat(201) }), LONDON)).toBeNull();
    });
  });

  describe("time", () => {
    it.each([
      ["2026-10-15T07:30:00Z", "2026-10-15T07:30:00.000Z"],
      ["2026-10-15T08:30:00+01:00", "2026-10-15T07:30:00.000Z"],
      ["2026-10-15T08:30:00+0100", "2026-10-15T07:30:00.000Z"],
      ["2026-10-15T02:30:00-05:00", "2026-10-15T07:30:00.000Z"],
      ["2026-10-15T07:30:00.123Z", "2026-10-15T07:30:00.123Z"],
      ["2026-10-15T07:30:00.123456Z", "2026-10-15T07:30:00.123Z"],
      ["2026-10-15T07:30Z", "2026-10-15T07:30:00.000Z"],
      ["2028-02-29T12:00:00Z", "2028-02-29T12:00:00.000Z"],
    ])("should read %s as the instant %s", (measuredAt, instant) => {
      expect(mapHealthSample(sample({ measuredAt }), LONDON)?.measured_at).toBe(instant);
    });

    it("should take local_date in the profile zone, not from the offset of the sample", () => {
      // 19:30 at -05:00 on the 29th is 00:30 UTC on the 30th, and 01:30 on the 30th in London after the clocks go forward.
      const row = mapHealthSample(sample({ measuredAt: "2026-03-29T19:30:00-05:00" }), LONDON);

      expect(row?.local_date).toBe("2026-03-30");
      expect(row?.tz).toBe("Europe/London");
    });

    it("should put 23:30 UTC either side of the clock change on the right date", () => {
      expect(
        mapHealthSample(sample({ measuredAt: "2026-03-28T23:30:00Z" }), LONDON)?.local_date,
      ).toBe("2026-03-28");
      expect(
        mapHealthSample(sample({ measuredAt: "2026-03-29T23:30:00Z" }), LONDON)?.local_date,
      ).toBe("2026-03-30");
    });
  });

  describe("what it keeps", () => {
    it("should keep only the value, the timestamp and the sample id", () => {
      // Real records carry more. The wider object is built apart so that the type check lets it through.
      const record = {
        ...sample(),
        metadata: { clientRecordId: "abc", recordingMethod: 3 },
        device: { manufacturer: "Withings", model: "Body+" },
        dataOrigin: "com.withings.wiscale2",
        note: "after a run",
        bodyFat: 18.2,
      };

      const row = mapHealthSample(record, LONDON);

      expect(Object.keys(row ?? {}).sort()).toEqual([
        "external_id",
        "local_date",
        "measured_at",
        "note",
        "source",
        "tz",
        "weight_kg",
      ]);
      expect(row?.note).toBeNull();
      expect(JSON.stringify(row)).not.toMatch(/Withings|wiscale2|clientRecordId|after a run/);
    });

    it("should give the same row for the same sample, so the import key is stable", () => {
      expect(mapHealthSample(sample(), LONDON)).toEqual(mapHealthSample(sample(), LONDON));
    });

    it("should not change the sample it is given", () => {
      const input = sample({ unit: "pounds", value: 176.37 });
      const copy = { ...input };

      mapHealthSample(input, LONDON);

      expect(input).toEqual(copy);
    });
  });
});

describe("mapHealthSamples", () => {
  it("should return the rows of the good samples and a count of the skipped ones", () => {
    const result = mapHealthSamples(
      [
        sample({ sampleId: "a", value: 80 }),
        sample({ sampleId: "b", value: 19.99 }),
        sample({ sampleId: "c", value: 81 }),
        sample({ sampleId: "", value: 82 }),
        sample({ sampleId: "d", value: 83 }),
      ],
      LONDON,
    );

    expect(result.rows.map((row) => row.external_id)).toEqual(["a", "c", "d"]);
    expect(result.skipped).toBe(2);
  });

  it("should return nothing and skip nothing for no samples", () => {
    expect(mapHealthSamples([], LONDON)).toEqual({ rows: [], skipped: 0 });
  });

  it("should skip every sample when none can be used", () => {
    const result = mapHealthSamples([sample({ value: 0 }), sample({ sampleId: "" })], LONDON);

    expect(result).toEqual({ rows: [], skipped: 2 });
  });

  it("should return only rows and a count, with nothing about the skipped samples", () => {
    const result = mapHealthSamples([sample({ sampleId: "secret-id", value: 5 })], LONDON);

    expect(Object.keys(result).sort()).toEqual(["rows", "skipped"]);
    expect(JSON.stringify(result)).not.toMatch(/secret-id/);
  });
});
