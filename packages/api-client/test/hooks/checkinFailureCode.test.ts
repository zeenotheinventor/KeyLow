import { describe, expect, it } from "vitest";

import { EdgeFunctionError, RateLimitedError } from "../../src/errors";
import { checkinFailureCode } from "../../src/hooks/checkinFailureCode";

/*
 * A check-in failure is reported as a code and nothing else, since a message can quote a health value.
 */
const RECOGNISABLE_TEXT = "a target of 2412.34 was refused";

describe("checkinFailureCode", () => {
  it("should be failed for something that is not an error", () => {
    expect(checkinFailureCode(RECOGNISABLE_TEXT)).toBe("failed");
  });

  it("should be failed for an error with no typed answer and no code", () => {
    expect(checkinFailureCode(new Error(RECOGNISABLE_TEXT))).toBe("failed");
  });

  it("should be the edge error code of a typed answer", () => {
    const failure = new EdgeFunctionError(RECOGNISABLE_TEXT, "internal_error", 500, undefined);

    expect(checkinFailureCode(failure)).toBe("internal_error");
  });

  it("should be rate_limited for a rate limit", () => {
    expect(checkinFailureCode(new RateLimitedError(RECOGNISABLE_TEXT, 20, undefined))).toBe(
      "rate_limited",
    );
  });

  it("should be the database's own code when that is all the failure has", () => {
    const failure = new Error(RECOGNISABLE_TEXT, { cause: { code: "XX000" } });

    expect(checkinFailureCode(failure)).toBe("XX000");
  });

  it("should not take an empty code", () => {
    const failure = new Error(RECOGNISABLE_TEXT, { cause: { code: "" } });

    expect(checkinFailureCode(failure)).toBe("failed");
  });

  it("should not read the message of a cause that has a code", () => {
    const failure = new Error("a weight of 81.4 was refused", {
      cause: { code: "XX000", message: RECOGNISABLE_TEXT },
    });

    expect(checkinFailureCode(failure)).toBe("XX000");
  });

  it("should prefer the edge error code of a typed answer to a code in its cause", () => {
    const failure = new EdgeFunctionError(RECOGNISABLE_TEXT, "internal_error", 500, {
      code: "XX000",
    });

    expect(checkinFailureCode(failure)).toBe("internal_error");
  });
});
