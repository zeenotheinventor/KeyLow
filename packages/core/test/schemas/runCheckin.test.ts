import { describe, expect, it } from "vitest";

import {
  runCheckinErrorCodeSchema,
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

  it.each(["recompute", "backstop", "", 7, null])("should reject the mode %j", (mode) => {
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

describe("runCheckinErrorCodeSchema", () => {
  it("should hold exactly the three codes only run-checkin sends", () => {
    expect([...runCheckinErrorCodeSchema.options].sort()).toEqual(
      ["bad_mode", "missing_stats", "no_program"].sort(),
    );
  });

  it("should not hold a code the shared edge error schema already has", () => {
    expect(runCheckinErrorCodeSchema.safeParse("internal_error").success).toBe(false);
  });
});
