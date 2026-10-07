import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDebouncedValue } from "../../src/hooks/useDebouncedValue";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("useDebouncedValue", () => {
  it("should return the first value straight away", () => {
    const { result } = renderHook(() => useDebouncedValue("chicken", 250));

    expect(result.current).toBe("chicken");
  });

  it("should keep the old value until the delay has passed", () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 250), {
      initialProps: { value: "c" },
    });

    rerender({ value: "ch" });
    act(() => {
      vi.advanceTimersByTime(249);
    });

    expect(result.current).toBe("c");

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(result.current).toBe("ch");
  });

  it("should restart the delay on every change and settle on the last value", () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 250), {
      initialProps: { value: "c" },
    });

    for (const value of ["ch", "chi", "chic", "chick"]) {
      rerender({ value });
      act(() => {
        vi.advanceTimersByTime(100);
      });
    }

    expect(result.current).toBe("c");

    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(result.current).toBe("chick");
  });

  it("should honour a different delay", () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 1000), {
      initialProps: { value: "a" },
    });

    rerender({ value: "b" });
    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(result.current).toBe("a");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe("b");
  });

  it("should not update after it has been unmounted", () => {
    const { rerender, unmount } = renderHook(({ value }) => useDebouncedValue(value, 250), {
      initialProps: { value: "a" },
    });

    rerender({ value: "b" });
    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});
