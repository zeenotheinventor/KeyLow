import { describe, expect, it } from "vitest";

import { RESEND_WAIT_SECONDS, resendSecondsLeft } from "../../src/accounts";

const sentAt = 1_795_000_000_000;

describe("resendSecondsLeft", () => {
  it("should wait 60 seconds", () => {
    expect(RESEND_WAIT_SECONDS).toBe(60);
  });

  it("should read 60 the moment the link is sent", () => {
    expect(resendSecondsLeft(sentAt, sentAt)).toBe(60);
  });

  it("should count down in whole seconds", () => {
    expect(resendSecondsLeft(sentAt, sentAt + 18_000)).toBe(42);
  });

  it("should round up so Send again never unlocks early", () => {
    expect(resendSecondsLeft(sentAt, sentAt + 18_001)).toBe(42);
    expect(resendSecondsLeft(sentAt, sentAt + 59_999)).toBe(1);
  });

  it("should read 0 at exactly 60 seconds and after", () => {
    expect(resendSecondsLeft(sentAt, sentAt + 60_000)).toBe(0);
    expect(resendSecondsLeft(sentAt, sentAt + 600_000)).toBe(0);
  });

  it("should not wait longer than 60 seconds when the clock moved back", () => {
    expect(resendSecondsLeft(sentAt, sentAt - 30_000)).toBe(60);
  });
});
