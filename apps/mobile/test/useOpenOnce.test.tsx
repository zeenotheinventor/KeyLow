import { act, renderHook } from "@testing-library/react-native";

import { useOpenOnce } from "../lib/useOpenOnce";
import { resetRouterMock, routerMock } from "./support/expoRouterMock";

jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("./support/expoRouterMock").mockExpoRouter,
);

// The guard that keeps a second tap from opening a screen twice.

describe("opening a screen once", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetRouterMock();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should open on the first tap and ignore the taps that follow at once", async () => {
    const open = jest.fn();
    const { result } = await renderHook(() => useOpenOnce());

    result.current(open);
    result.current(open);

    expect(open).toHaveBeenCalledTimes(1);
  });

  it("should open again when the screen comes back into focus", async () => {
    const open = jest.fn();
    const { result, rerender } = await renderHook(() => useOpenOnce());
    result.current(open);

    routerMock.isFocused = false;
    await rerender({});
    routerMock.isFocused = true;
    await rerender({});
    result.current(open);

    expect(open).toHaveBeenCalledTimes(2);
  });

  it("should open again when the first open threw, and let the error through", async () => {
    const { result } = await renderHook(() => useOpenOnce());
    const open = jest.fn();

    expect(() => {
      result.current(() => {
        throw new Error("The push failed");
      });
    }).toThrow("The push failed");
    result.current(open);

    expect(open).toHaveBeenCalledTimes(1);
  });

  it("should open again after a second, so a push that never happened leaves no dead control", async () => {
    const open = jest.fn();
    const { result } = await renderHook(() => useOpenOnce());
    result.current(open);

    await act(() => {
      jest.advanceTimersByTime(999);
    });
    result.current(open);
    expect(open).toHaveBeenCalledTimes(1);
    await act(() => {
      jest.advanceTimersByTime(1);
    });
    result.current(open);

    expect(open).toHaveBeenCalledTimes(2);
  });
});
