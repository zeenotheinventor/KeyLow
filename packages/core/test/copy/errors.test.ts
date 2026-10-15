import { describe, expect, it } from "vitest";

import { GENERIC_ERROR, RETRY_LABEL, describeEdgeError, describeRateLimit } from "../../src/copy";
import { edgeErrorCodeSchema } from "../../src/schemas";

describe("describeRateLimit", () => {
  it.each([
    [30, "Try again in 30 seconds."],
    [2, "Try again in 2 seconds."],
    [1, "Try again in 1 second."],
    [90, "Try again in 90 seconds."],
  ])("should write %s seconds as %s", (seconds, expected) => {
    expect(describeRateLimit(seconds)).toBe(expected);
  });

  it("should round a fraction of a second up, so the user never retries early", () => {
    expect(describeRateLimit(1.2)).toBe("Try again in 2 seconds.");
  });

  it.each([undefined, 0, -3, Number.NaN, Number.POSITIVE_INFINITY, 0.4])(
    "should say a moment when the time is %s",
    (seconds) => {
      expect(describeRateLimit(seconds)).toBe("Try again in a moment.");
    },
  );
});

describe("describeEdgeError", () => {
  const codes = edgeErrorCodeSchema.options;

  it("should pin the generic sentence", () => {
    expect(GENERIC_ERROR).toBe("Something went wrong. Try again.");
  });

  it("should pin the retry button's label", () => {
    expect(RETRY_LABEL).toBe("Try again");
  });

  it("should have its own sentence for each of the six edge error codes", () => {
    expect(codes).toHaveLength(6);
    const sentences = codes.map((code) => describeEdgeError(code));

    expect(new Set(sentences).size).toBe(6);
    for (const sentence of sentences) {
      expect(sentence).not.toBe(GENERIC_ERROR);
    }
  });

  it("should give the generic sentence when the kind is unknown", () => {
    expect(describeEdgeError(undefined)).toBe(GENERIC_ERROR);
  });

  it.each(codes)("should not show the raw code %s, an exclamation mark or an em dash", (code) => {
    const sentence = describeEdgeError(code);

    expect(sentence).not.toContain(code);
    expect(sentence).not.toContain("_");
    expect(sentence).not.toContain("!");
    expect(sentence).not.toContain("—");
  });

  it.each(codes)("should say what to do or what is wrong in a full sentence for %s", (code) => {
    expect(describeEdgeError(code)).toMatch(/^[A-Z].*\.$/);
  });

  it("should pin the sentences", () => {
    expect(describeEdgeError("not_found")).toBe(
      "Open Food Facts no longer has this product. Search again, or create the food yourself.",
    );
    expect(describeEdgeError("rate_limited")).toBe(
      "Open Food Facts is busy. Try again in a moment.",
    );
  });
});
