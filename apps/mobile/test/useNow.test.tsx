import { act, renderHook } from "@testing-library/react-native";

import { useNow } from "../lib/useNow";

describe("useNow", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-10-15T18:00:00Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should move on every minute by default", async () => {
    const { result } = await renderHook(() => useNow());

    await act(() => {
      jest.advanceTimersByTime(59_000);
    });
    expect(result.current.toISOString()).toBe("2026-10-15T18:00:00.000Z");

    await act(() => {
      jest.advanceTimersByTime(1_000);
    });
    expect(result.current.toISOString()).toBe("2026-10-15T18:01:00.000Z");
  });

  it("should move on every second when asked to", async () => {
    const { result } = await renderHook(() => useNow(1_000));

    await act(() => {
      jest.advanceTimersByTime(3_000);
    });

    expect(result.current.toISOString()).toBe("2026-10-15T18:00:03.000Z");
  });
});
