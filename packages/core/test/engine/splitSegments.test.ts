import { describe, expect, it } from "vitest";

import { splitSegments } from "../../src/engine/splitSegments";

const day = (date: string) => ({ date, rawKg: 80 });

describe("splitSegments", () => {
  it("should return nothing for no days", () => {
    expect(splitSegments([], 30)).toStrictEqual([]);
  });

  it("should keep consecutive days in one segment", () => {
    const segments = splitSegments([day("2026-10-15"), day("2026-10-16"), day("2026-10-18")], 30);

    expect(segments).toHaveLength(1);
    expect(segments[0]).toHaveLength(3);
  });

  it("should keep a gap of exactly 30 days in one segment", () => {
    const segments = splitSegments([day("2026-09-01"), day("2026-10-01")], 30);

    expect(segments).toHaveLength(1);
  });

  it("should start a new segment after a gap of 31 days", () => {
    const segments = splitSegments([day("2026-09-01"), day("2026-10-02")], 30);

    expect(segments.map((segment) => segment.map((reading) => reading.date))).toStrictEqual([
      ["2026-09-01"],
      ["2026-10-02"],
    ]);
  });

  it("should count the gap across a month, a year end and a leap day", () => {
    expect(splitSegments([day("2027-12-01"), day("2028-01-01")], 30)).toHaveLength(2);
    expect(splitSegments([day("2028-01-30"), day("2028-02-29")], 30)).toHaveLength(1);
    expect(splitSegments([day("2028-01-30"), day("2028-03-01")], 30)).toHaveLength(2);
  });

  it("should use the gap it is given", () => {
    expect(splitSegments([day("2026-10-01"), day("2026-10-04")], 2)).toHaveLength(2);
    expect(splitSegments([day("2026-10-01"), day("2026-10-03")], 2)).toHaveLength(1);
  });

  it("should split on every long gap", () => {
    const segments = splitSegments(
      [day("2026-01-01"), day("2026-03-01"), day("2026-03-02"), day("2026-06-01")],
      30,
    );

    expect(segments.map((segment) => segment.length)).toStrictEqual([1, 2, 1]);
  });
});
