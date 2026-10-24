import { describe, expect, it } from "vitest";

import {
  edgeErrorCodeSchema,
  runCheckinRecomputeResponseSchema,
  runCheckinRequestSchema,
  runCheckinResponseSchema,
} from "../../src/schemas";

describe("runCheckinRequestSchema", () => {
  it("should accept the due mode", () => {
    expect(runCheckinRequestSchema.parse({ mode: "due" })).toEqual({ mode: "due" });
  });

  it("should accept a body with no mode, because due is the default", () => {
    expect(runCheckinRequestSchema.parse({})).toEqual({});
  });

  it("should accept the recompute mode", () => {
    expect(runCheckinRequestSchema.parse({ mode: "recompute" })).toEqual({ mode: "recompute" });
  });

  it.each(["backstop", "", 7, null])("should reject the mode %j", (mode) => {
    expect(runCheckinRequestSchema.safeParse({ mode }).success).toBe(false);
  });

  it.each([null, "due", 3, []])("should reject a body that is not an object (%j)", (body) => {
    expect(runCheckinRequestSchema.safeParse(body).success).toBe(false);
  });
});

describe("runCheckinResponseSchema", () => {
  it("should accept a count of check-ins and the next check-in date", () => {
    const body = { ran: 3, nextCheckinDate: "2026-10-25" };
    expect(runCheckinResponseSchema.parse(body)).toEqual(body);
  });

  it("should accept no check-ins and no next date", () => {
    const body = { ran: 0, nextCheckinDate: null };
    expect(runCheckinResponseSchema.parse(body)).toEqual(body);
  });

  it.each([-1, 1.5, "3"])("should reject %j as the count of check-ins", (ran) => {
    expect(runCheckinResponseSchema.safeParse({ ran, nextCheckinDate: null }).success).toBe(false);
  });

  it.each(["2026-13-01", "25 October", ""])("should reject %j as a date", (nextCheckinDate) => {
    expect(runCheckinResponseSchema.safeParse({ ran: 0, nextCheckinDate }).success).toBe(false);
  });

  it("should reject a body without the next date", () => {
    expect(runCheckinResponseSchema.safeParse({ ran: 0 }).success).toBe(false);
  });
});

describe("runCheckinRecomputeResponseSchema", () => {
  it("should accept the id of the new targets row", () => {
    const body = { targetsId: "0c5f8d4e-6b1a-4c3e-9d2f-7a8b9c0d1e2f" };
    expect(runCheckinRecomputeResponseSchema.parse(body)).toEqual(body);
  });

  it.each([{}, { targetsId: "not-an-id" }, { targetsId: null }, { ran: 0, nextCheckinDate: null }])(
    "should reject %j",
    (body) => {
      expect(runCheckinRecomputeResponseSchema.safeParse(body).success).toBe(false);
    },
  );
});

describe("the error codes run-checkin sends", () => {
  it.each(["bad_mode", "no_program", "missing_stats"])(
    "should be in the shared edge error schema: %s",
    (code) => {
      expect(edgeErrorCodeSchema.parse(code)).toBe(code);
    },
  );
});
