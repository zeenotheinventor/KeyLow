import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useSettledValue } from "@/lib/useSettledValue";

describe("useSettledValue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should start with the value it is given", () => {
    const { result } = renderHook(() => useSettledValue("1", 500));

    expect(result.current).toBe("1");
  });

  it("should keep the old value until the new one has stood for the whole wait", () => {
    const { result, rerender } = renderHook(({ value }) => useSettledValue(value, 500), {
      initialProps: { value: "1" },
    });

    rerender({ value: "2" });
    act(() => {
      vi.advanceTimersByTime(499);
    });
    expect(result.current).toBe("1");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe("2");
  });

  it("should start the wait again when the value changes again", () => {
    const { result, rerender } = renderHook(({ value }) => useSettledValue(value, 500), {
      initialProps: { value: "1" },
    });

    rerender({ value: "2" });
    act(() => {
      vi.advanceTimersByTime(400);
    });
    rerender({ value: "3" });
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(result.current).toBe("1");

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe("3");
  });
});
