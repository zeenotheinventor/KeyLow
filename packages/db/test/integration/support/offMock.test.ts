import { describe, expect, it } from "vitest";

import { offMockPort } from "./offMock";
import { requireFunctionEnvironmentValue } from "./testEnvironment";

// Linux gives the source port of an outgoing connection out of 32768 to 60999 (macOS uses 49152 to
// 65535). A listener on a port in that range fails with EADDRINUSE whenever a connection happens to
// hold it, so the mock sits below it.
const lowestEphemeralPort = 32_768;

describe("the OFF mock port", () => {
  it("is outside the range the operating system hands out to outgoing connections", () => {
    expect(offMockPort).toBeLessThan(lowestEphemeralPort);
  });

  it("is the port the functions are told to call in .env.test", () => {
    const baseUrl = new URL(requireFunctionEnvironmentValue("OFF_BASE_URL"));

    expect(Number(baseUrl.port)).toBe(offMockPort);
  });
});
