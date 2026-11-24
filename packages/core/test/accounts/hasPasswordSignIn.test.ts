import { describe, expect, it } from "vitest";

import { hasPasswordSignIn } from "../../src/accounts";

describe("hasPasswordSignIn", () => {
  it.each([
    ["an email account", { provider: "email", providers: ["email"] }],
    ["an email and Google account", { provider: "email", providers: ["email", "google"] }],
    ["providers without provider", { providers: ["email"] }],
    ["provider only, email", { provider: "email" }],
  ])("should be true for %s", (_name, appMetadata) => {
    expect(hasPasswordSignIn(appMetadata)).toBe(true);
  });

  it.each([
    ["a Google-only account", { provider: "google", providers: ["google"] }],
    ["provider only, google", { provider: "google" }],
    [
      "providers that exclude email, even if provider says email",
      { provider: "email", providers: ["google"] },
    ],
    ["providers not an array", { providers: "email" }],
    ["providers not an array, provider email", { provider: "email", providers: "email" }],
    ["an empty object", {}],
    ["null", null],
    ["undefined", undefined],
    ["a string", "email"],
    ["a number", 1],
    ["an array", ["email"]],
  ])("should be false for %s", (_name, appMetadata) => {
    expect(hasPasswordSignIn(appMetadata)).toBe(false);
  });
});
