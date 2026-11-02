import { describe, expect, it } from "vitest";

import { assistantNoticeSchema } from "../../src/assistant";

describe("assistantNoticeSchema", () => {
  it.each([
    { code: "consent_needed" },
    { code: "day_limit", resetsAt: "2026-10-26T00:00:00Z" },
    { code: "plus" },
    { code: "resting", resumesOn: "2026-11-01" },
    { code: "switched_off" },
    { code: "turn_failed" },
  ])("should parse the $code notice", (notice) => {
    expect(assistantNoticeSchema.parse(notice)).toEqual(notice);
  });

  it("should reject a code the plan does not list", () => {
    expect(assistantNoticeSchema.safeParse({ code: "busy" }).success).toBe(false);
  });

  it("should reject a day limit without the instant it resets at", () => {
    expect(assistantNoticeSchema.safeParse({ code: "day_limit" }).success).toBe(false);
  });

  it("should reject a day limit worded as a time instead of an instant", () => {
    expect(
      assistantNoticeSchema.safeParse({ code: "day_limit", resetsAt: "midnight" }).success,
    ).toBe(false);
  });

  it("should reject resting without the day it resumes on", () => {
    expect(assistantNoticeSchema.safeParse({ code: "resting" }).success).toBe(false);
  });

  it("should reject resting with a resume day that is not YYYY-MM-DD", () => {
    expect(
      assistantNoticeSchema.safeParse({ code: "resting", resumesOn: "1 November" }).success,
    ).toBe(false);
  });

  it("should reject a reset instant on any notice other than the day limit", () => {
    expect(
      assistantNoticeSchema.safeParse({ code: "plus", resetsAt: "2026-10-26T00:00:00Z" }).success,
    ).toBe(false);
  });

  it("should reject a resume day on any notice other than resting", () => {
    expect(
      assistantNoticeSchema.safeParse({ code: "switched_off", resumesOn: "2026-11-01" }).success,
    ).toBe(false);
  });
});
