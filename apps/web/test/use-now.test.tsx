import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useNow } from "@/lib/useNow";

describe("useNow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-15T11:59:30Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should start at the time it was first used", () => {
    const { result } = renderHook(() => useNow());

    expect(result.current.toISOString()).toBe("2026-10-15T11:59:30.000Z");
  });

  it("should move on with the clock, a minute at a time", () => {
    const { result } = renderHook(() => useNow());

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(result.current.toISOString()).toBe("2026-10-15T12:00:30.000Z");
  });

  it("should move on at the step a screen asks for, such as a clock that shows seconds", () => {
    const { result } = renderHook(() => useNow(1000));

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current.toISOString()).toBe("2026-10-15T11:59:33.000Z");
  });

  it("should stop ticking when it is no longer used", () => {
    const { unmount } = renderHook(() => useNow());

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});
