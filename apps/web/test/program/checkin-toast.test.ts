import { afterEach, describe, expect, it, vi } from "vitest";

import {
  announceNewTargets,
  hasNewTargets,
  subscribeToNewTargets,
  takeNewTargets,
} from "@/lib/checkinToast";

afterEach(() => {
  takeNewTargets();
});

describe("the new targets signal", () => {
  it("should be quiet until a check-in announces new targets", () => {
    expect(hasNewTargets()).toBe(false);
    expect(takeNewTargets()).toBe(false);
  });

  it("should wait once announced, however many times it is announced", () => {
    announceNewTargets();
    announceNewTargets();

    expect(hasNewTargets()).toBe(true);
    expect(takeNewTargets()).toBe(true);
    expect(takeNewTargets()).toBe(false);
  });

  it("should tell a listener when it is announced and when it is used up, until it stops listening", () => {
    const listener = vi.fn();
    const stop = subscribeToNewTargets(listener);

    announceNewTargets();
    takeNewTargets();
    stop();
    announceNewTargets();

    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("should not tell a listener again when it is announced while it already waits", () => {
    const listener = vi.fn();
    const stop = subscribeToNewTargets(listener);

    announceNewTargets();
    announceNewTargets();
    stop();

    expect(listener).toHaveBeenCalledTimes(1);
  });
});
