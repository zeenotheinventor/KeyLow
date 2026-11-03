import { NONCE_MINIMUM_LENGTH } from "@keylow/core/widgets";

import { createNonce } from "./createNonce";

describe("createNonce", () => {
  it("should be at least the minimum length", () => {
    expect(createNonce().length).toBeGreaterThanOrEqual(NONCE_MINIMUM_LENGTH);
  });

  it("should be hexadecimal", () => {
    expect(createNonce()).toMatch(/^[0-9a-f]+$/);
  });

  it("should differ from one call to the next", () => {
    expect(createNonce()).not.toBe(createNonce());
  });
});
