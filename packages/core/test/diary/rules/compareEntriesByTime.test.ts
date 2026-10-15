import { describe, expect, it } from "vitest";

import { compareEntriesByTime } from "../../../src/diary/rules";

const entry = (loggedAt: string, createdAt: string, id: string) => ({
  logged_at: loggedAt,
  created_at: createdAt,
  id,
});

describe("compareEntriesByTime", () => {
  it("should put the earlier logged_at first", () => {
    const earlier = entry("2026-10-15T07:05:00+00:00", "2026-10-15T20:00:00Z", "z");
    const later = entry("2026-10-15T11:40:00+00:00", "2026-10-15T06:00:00Z", "a");

    expect(compareEntriesByTime(earlier, later)).toBeLessThan(0);
    expect(compareEntriesByTime(later, earlier)).toBeGreaterThan(0);
  });

  it("should compare the instants, not the text, when the offsets differ", () => {
    // 12:00 in Paris is 10:00 UTC, which is before 11:00 UTC although "12" sorts after "11".
    const inParis = entry("2026-10-15T12:00:00+02:00", "2026-10-15T09:00:00Z", "a");
    const inUtc = entry("2026-10-15T11:00:00+00:00", "2026-10-15T09:00:00Z", "b");

    expect(compareEntriesByTime(inParis, inUtc)).toBeLessThan(0);
  });

  it("should put the earlier created_at first when logged_at is the same", () => {
    const saveFirst = entry("2026-10-15T11:40:00Z", "2026-10-15T11:41:00Z", "z");
    const saveSecond = entry("2026-10-15T11:40:00Z", "2026-10-15T11:42:00Z", "a");

    expect(compareEntriesByTime(saveFirst, saveSecond)).toBeLessThan(0);
    expect(compareEntriesByTime(saveSecond, saveFirst)).toBeGreaterThan(0);
  });

  it("should put the smaller id first when logged_at and created_at are the same", () => {
    const smaller = entry("2026-10-15T11:40:00Z", "2026-10-15T11:41:00Z", "0b1c");
    const larger = entry("2026-10-15T11:40:00Z", "2026-10-15T11:41:00Z", "9f2e");

    expect(compareEntriesByTime(smaller, larger)).toBeLessThan(0);
    expect(compareEntriesByTime(larger, smaller)).toBeGreaterThan(0);
  });

  it("should order PostgREST six-digit fractional timestamps by the instant (parsed on Node)", () => {
    // Postgres writes microseconds, which JavaScript reads down to the millisecond.
    const earlier = entry(
      "2026-10-15T11:40:00.123456+00:00",
      "2026-10-15T11:41:00.000001+00:00",
      "b",
    );
    const later = entry(
      "2026-10-15T11:40:00.124001+00:00",
      "2026-10-15T11:41:00.000001+00:00",
      "a",
    );

    expect(compareEntriesByTime(earlier, later)).toBeLessThan(0);
    expect(compareEntriesByTime(later, earlier)).toBeGreaterThan(0);
  });

  it("should fall through to created_at when logged_at differs only below a millisecond", () => {
    // 00.123456 and 00.123999 are the same millisecond once read, so the next key decides.
    const saveFirst = entry("2026-10-15T11:40:00.123999+00:00", "2026-10-15T11:41:00+00:00", "z");
    const saveSecond = entry("2026-10-15T11:40:00.123456+00:00", "2026-10-15T11:42:00+00:00", "a");

    expect(compareEntriesByTime(saveFirst, saveSecond)).toBeLessThan(0);
  });

  it("should call two identical entries equal", () => {
    const one = entry("2026-10-15T11:40:00Z", "2026-10-15T11:41:00Z", "0b1c");

    expect(compareEntriesByTime(one, { ...one })).toBe(0);
  });

  it("should sort a list with Array.sort", () => {
    const third = entry("2026-10-15T11:40:00Z", "2026-10-15T11:42:00Z", "a");
    const second = entry("2026-10-15T11:40:00Z", "2026-10-15T11:41:00Z", "z");
    const first = entry("2026-10-15T07:05:00Z", "2026-10-15T20:00:00Z", "m");

    expect([third, second, first].sort(compareEntriesByTime)).toEqual([first, second, third]);
  });

  it("should throw a RangeError when a timestamp is not a time", () => {
    const broken = entry("not a time", "2026-10-15T11:41:00Z", "a");
    const fine = entry("2026-10-15T11:40:00Z", "2026-10-15T11:41:00Z", "b");

    expect(() => compareEntriesByTime(broken, fine)).toThrow(RangeError);
  });
});
