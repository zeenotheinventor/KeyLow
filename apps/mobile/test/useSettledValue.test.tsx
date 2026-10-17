import { act, renderHook } from "@testing-library/react-native";

import { useSettledValue } from "../lib/useSettledValue";

describe("useSettledValue", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should give the first value at once", async () => {
    const { result } = await renderHook(() => useSettledValue("4", 500));

    expect(result.current).toBe("4");
  });

  it("should keep the old value until the new one has stood still for the delay", async () => {
    const { result, rerender } = await renderHook(
      (props: { value: string }) => useSettledValue(props.value, 500),
      { initialProps: { value: "4" } },
    );

    await rerender({ value: "5" });
    await act(() => {
      jest.advanceTimersByTime(499);
    });
    expect(result.current).toBe("4");

    await act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current).toBe("5");
  });

  it("should start the wait again when the value changes before it ends", async () => {
    const { result, rerender } = await renderHook(
      (props: { value: string }) => useSettledValue(props.value, 500),
      { initialProps: { value: "4" } },
    );

    await rerender({ value: "5" });
    await act(() => {
      jest.advanceTimersByTime(400);
    });
    await rerender({ value: "50" });
    await act(() => {
      jest.advanceTimersByTime(400);
    });
    expect(result.current).toBe("4");

    await act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(result.current).toBe("50");
  });
});
