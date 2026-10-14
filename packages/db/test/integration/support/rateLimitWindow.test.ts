import { describe, expect, it } from "vitest";

import { millisecondsToWaitForFreshWindow } from "./rateLimitWindow";

const windowMilliseconds = 60_000;
const neededMilliseconds = 10_000;

const wait = (secondsIntoMinute: number) =>
  millisecondsToWaitForFreshWindow({
    serverTimeMilliseconds: Date.UTC(2026, 9, 14, 0, 51, secondsIntoMinute),
    windowMilliseconds,
    neededMilliseconds,
  });

describe("millisecondsToWaitForFreshWindow", () => {
  it("does not wait at the start of a window", () => {
    expect(wait(0)).toBe(0);
  });

  it("does not wait while at least the needed time is left in the window", () => {
    expect(wait(50)).toBe(0);
  });

  it("waits for the next window once less than the needed time is left", () => {
    expect(wait(51)).toBe(9_000 + 1_000);
  });

  it("waits a whole second and a margin just before the window ends", () => {
    expect(wait(59)).toBe(1_000 + 1_000);
  });
});
