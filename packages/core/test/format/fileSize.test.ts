import { describe, expect, it } from "vitest";

import { formatFileSize } from "../../src/format";

describe("formatFileSize", () => {
  it.each([
    [0, "1 KB"],
    [1, "1 KB"],
    [999, "1 KB"],
    [1_000, "1 KB"],
    [1_999, "1 KB"],
    [640_400, "640 KB"],
    [999_999, "999 KB"],
  ])("should write %s bytes under a megabyte as whole kilobytes, %s", (bytes, expected) => {
    expect(formatFileSize(bytes)).toBe(expected);
  });

  it.each([
    [1_000_000, "1.0 MB"],
    [1_849_999, "1.8 MB"],
    [1_850_000, "1.8 MB"],
    [12_345_678, "12.3 MB"],
  ])("should write %s bytes from a megabyte as megabytes to one decimal, %s", (bytes, expected) => {
    expect(formatFileSize(bytes)).toBe(expected);
  });

  it("should count a megabyte as 1,000,000 bytes, as the Android Files app does", () => {
    expect(formatFileSize(1_048_576)).toBe("1.0 MB");
  });
});
