import { describe, expect, it } from "vitest";

import {
  edgeErrorCodeSchema,
  edgeErrorSchema,
  offCandidateSchema,
  offProductRequestSchema,
  offProductResponseSchema,
  offSearchRequestSchema,
  offSearchResponseSchema,
} from "../../src/schemas/off";

const goldenCandidate = {
  code: "5000159407236",
  name: "Milk Chocolate Bar",
  brand: "Cadbury",
  basis: "per_100g",
  kcal: 534,
  protein_g: 7.3,
  fat_g: 30,
  carbs_g: 56,
  fibre_g: 1.9,
  quality: { kcal_derived: false },
};

const goldenFoodRow = {
  id: "0b1b6f0e-6c1c-4f3e-9d3b-2c1d5a8f7e10",
  source: "off",
  source_ref: "5000159407236",
  owner_id: null,
  name: "Milk Chocolate Bar",
  brand: "Cadbury",
  barcode: "5000159407236",
  basis: "per_100g",
  density_g_per_ml: null,
  kcal: 534,
  protein_g: 7.3,
  fat_g: 30,
  sat_fat_g: null,
  carbs_g: 56,
  sugars_g: null,
  fibre_g: 1.9,
  salt_g: null,
  micros: {},
  quality: {},
  food_group: null,
  fetched_at: "2026-10-07T12:30:45+00:00",
  deleted_at: null,
  created_at: "2026-10-07T12:30:45+00:00",
};

const goldenPortion = {
  id: "7d2a1c52-0f3b-4a5e-8f64-5b3a9c1e2d40",
  food_id: goldenFoodRow.id,
  owner_id: null,
  label: "1 bar",
  grams: 45,
  ml: null,
  is_default: true,
  position: 0,
  created_at: "2026-10-07T12:30:45+00:00",
};

describe("offSearchRequestSchema", () => {
  it("should parse a query", () => {
    expect(offSearchRequestSchema.parse({ q: "chocolate" })).toEqual({ q: "chocolate" });
  });

  it("should trim the query", () => {
    expect(offSearchRequestSchema.parse({ q: "  chocolate  " })).toEqual({ q: "chocolate" });
  });

  it("should reject a 1-character query", () => {
    expect(offSearchRequestSchema.safeParse({ q: "a" }).success).toBe(false);
  });

  it("should reject a query that is 1 character once trimmed", () => {
    expect(offSearchRequestSchema.safeParse({ q: " a " }).success).toBe(false);
  });

  it("should accept a 2-character query", () => {
    expect(offSearchRequestSchema.safeParse({ q: "ab" }).success).toBe(true);
  });

  it("should accept a 100-character query", () => {
    expect(offSearchRequestSchema.safeParse({ q: "a".repeat(100) }).success).toBe(true);
  });

  it("should reject a 101-character query", () => {
    expect(offSearchRequestSchema.safeParse({ q: "a".repeat(101) }).success).toBe(false);
  });

  it("should reject a missing query", () => {
    expect(offSearchRequestSchema.safeParse({}).success).toBe(false);
  });
});

describe("offCandidateSchema", () => {
  it("should parse a golden candidate", () => {
    expect(offCandidateSchema.parse(goldenCandidate)).toEqual(goldenCandidate);
  });

  it("should parse a candidate with a null brand and null nutrient previews", () => {
    const sparse = {
      ...goldenCandidate,
      brand: null,
      kcal: null,
      protein_g: null,
      fat_g: null,
      carbs_g: null,
      fibre_g: null,
      quality: { suspect: true, fields_missing: ["kcal"] },
    };
    expect(offCandidateSchema.parse(sparse)).toEqual(sparse);
  });

  it("should reject a code that is not digits", () => {
    expect(offCandidateSchema.safeParse({ ...goldenCandidate, code: "abc" }).success).toBe(false);
  });

  it("should reject a negative nutrient preview", () => {
    expect(offCandidateSchema.safeParse({ ...goldenCandidate, fat_g: -1 }).success).toBe(false);
  });

  it("should reject an unknown basis", () => {
    expect(offCandidateSchema.safeParse({ ...goldenCandidate, basis: "per_cup" }).success).toBe(
      false,
    );
  });
});

describe("offSearchResponseSchema", () => {
  it("should parse a response with candidates", () => {
    expect(offSearchResponseSchema.parse({ candidates: [goldenCandidate] })).toEqual({
      candidates: [goldenCandidate],
    });
  });

  it("should parse a response with no candidates", () => {
    expect(offSearchResponseSchema.parse({ candidates: [] })).toEqual({ candidates: [] });
  });

  it("should reject a response whose candidate is invalid", () => {
    expect(
      offSearchResponseSchema.safeParse({ candidates: [{ ...goldenCandidate, name: 1 }] }).success,
    ).toBe(false);
  });
});

describe("offProductRequestSchema", () => {
  it("should parse a code", () => {
    expect(offProductRequestSchema.parse({ code: "5000159407236" })).toEqual({
      code: "5000159407236",
    });
  });

  it("should reject a non-digit code", () => {
    expect(offProductRequestSchema.safeParse({ code: "50001594072xx" }).success).toBe(false);
  });

  it("should reject a code shorter than 8 digits", () => {
    expect(offProductRequestSchema.safeParse({ code: "1234567" }).success).toBe(false);
  });

  it("should reject a code longer than 14 digits", () => {
    expect(offProductRequestSchema.safeParse({ code: "123456789012345" }).success).toBe(false);
  });

  it("should reject a missing code", () => {
    expect(offProductRequestSchema.safeParse({}).success).toBe(false);
  });
});

describe("offProductResponseSchema", () => {
  it("should parse a food row with its portions", () => {
    const response = { food: goldenFoodRow, portions: [goldenPortion] };
    expect(offProductResponseSchema.parse(response)).toEqual(response);
  });

  it("should parse a food row with no portions", () => {
    const response = { food: goldenFoodRow, portions: [] };
    expect(offProductResponseSchema.parse(response)).toEqual(response);
  });

  it("should reject a portion with both grams and ml", () => {
    expect(
      offProductResponseSchema.safeParse({
        food: goldenFoodRow,
        portions: [{ ...goldenPortion, ml: 10 }],
      }).success,
    ).toBe(false);
  });

  it("should reject a response without a food", () => {
    expect(offProductResponseSchema.safeParse({ portions: [] }).success).toBe(false);
  });
});

describe("edgeErrorCodeSchema", () => {
  const allCodes = [
    "not_found",
    "rate_limited",
    "upstream_error",
    "invalid_request",
    "unauthorized",
    "internal_error",
  ];

  it.each(allCodes)("should accept %s", (code) => {
    expect(edgeErrorCodeSchema.parse(code)).toBe(code);
  });

  it("should have exactly the six documented codes", () => {
    expect([...edgeErrorCodeSchema.options].sort()).toEqual([...allCodes].sort());
  });

  it("should reject an unknown code", () => {
    expect(edgeErrorCodeSchema.safeParse("teapot").success).toBe(false);
  });
});

describe("edgeErrorSchema", () => {
  it("should parse an error without a retry delay", () => {
    const body = { error: { code: "not_found", message: "No such product" } };
    expect(edgeErrorSchema.parse(body)).toEqual(body);
  });

  it("should parse a rate limit error with its retry delay", () => {
    const body = {
      error: { code: "rate_limited", message: "Slow down", retryAfterSeconds: 42 },
    };
    expect(edgeErrorSchema.parse(body)).toEqual(body);
  });

  it("should reject a retry delay of zero", () => {
    expect(
      edgeErrorSchema.safeParse({
        error: { code: "rate_limited", message: "Slow down", retryAfterSeconds: 0 },
      }).success,
    ).toBe(false);
  });

  it("should reject a fractional retry delay", () => {
    expect(
      edgeErrorSchema.safeParse({
        error: { code: "rate_limited", message: "Slow down", retryAfterSeconds: 1.5 },
      }).success,
    ).toBe(false);
  });

  it("should reject an unknown error code", () => {
    expect(edgeErrorSchema.safeParse({ error: { code: "teapot", message: "x" } }).success).toBe(
      false,
    );
  });

  it("should reject a body without the error envelope", () => {
    expect(edgeErrorSchema.safeParse({ code: "not_found", message: "x" }).success).toBe(false);
  });

  it("should reject a missing message", () => {
    expect(edgeErrorSchema.safeParse({ error: { code: "not_found" } }).success).toBe(false);
  });
});
