import { describe, expect, it } from "vitest";

import {
  EdgeFunctionError,
  EntryNotFoundError,
  RateLimitedError,
  toEdgeErrorKind,
} from "../src/errors";

describe("toEdgeErrorKind", () => {
  it("should name a rate limit rate_limited", () => {
    expect(toEdgeErrorKind(new RateLimitedError("Slow down", 20, undefined))).toBe("rate_limited");
  });

  it.each([
    "not_found",
    "rate_limited",
    "upstream_error",
    "invalid_request",
    "unauthorized",
    "internal_error",
  ] as const)("should name an edge error with the code %s by that code", (code) => {
    expect(toEdgeErrorKind(new EdgeFunctionError("Some sentence", code, 500, undefined))).toBe(
      code,
    );
  });

  it("should name any other error failed", () => {
    expect(toEdgeErrorKind(new Error("fetch failed"))).toBe("failed");
  });
});

describe("EntryNotFoundError", () => {
  it("should say the entry was not found without naming it", () => {
    const error = new EntryNotFoundError();

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("EntryNotFoundError");
    expect(error.message).toBe("The entry was not found");
  });
});
