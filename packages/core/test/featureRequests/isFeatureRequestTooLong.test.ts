import { describe, expect, it } from "vitest";

import { FEATURE_REQUEST_TEXT_MAX, isFeatureRequestTooLong } from "../../src/featureRequests";

describe("isFeatureRequestTooLong", () => {
  it("should accept text of exactly the most a request holds", () => {
    expect(isFeatureRequestTooLong("a".repeat(FEATURE_REQUEST_TEXT_MAX))).toBe(false);
  });

  it("should refuse text one character over", () => {
    expect(isFeatureRequestTooLong("a".repeat(FEATURE_REQUEST_TEXT_MAX + 1))).toBe(true);
  });

  it("should count the trimmed text, as the request is saved", () => {
    expect(isFeatureRequestTooLong(`  ${"a".repeat(FEATURE_REQUEST_TEXT_MAX)}  `)).toBe(false);
  });

  it("should count an emoji as one character", () => {
    expect(isFeatureRequestTooLong("\u{1F600}".repeat(FEATURE_REQUEST_TEXT_MAX))).toBe(false);
  });
});
