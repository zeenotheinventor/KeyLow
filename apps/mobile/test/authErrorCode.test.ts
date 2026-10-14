import { AuthApiError, AuthRetryableFetchError } from "@supabase/supabase-js";

import { authErrorCode } from "../lib/authErrorCode";

describe("authErrorCode", () => {
  it("should give the code Supabase put on the error", () => {
    const error = new AuthApiError("Invalid login credentials", 400, "invalid_credentials");

    expect(authErrorCode(error)).toBe("invalid_credentials");
  });

  it("should call a failed fetch a network failure, because it carries no code of its own", () => {
    const error = new AuthRetryableFetchError("Failed to fetch", 0);

    expect(authErrorCode(error)).toBe("network");
  });

  it("should give nothing when the error has no code", () => {
    const error = new AuthApiError("Something odd", 500, undefined);

    expect(authErrorCode(error)).toBeUndefined();
  });
});
