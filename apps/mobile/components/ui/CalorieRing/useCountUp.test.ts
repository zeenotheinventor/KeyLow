import { act, renderHook } from "@testing-library/react-native";

import { useCountUp } from "./useCountUp";

type Props = { target: number; isReducedMotion: boolean };

describe("useCountUp", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should start at the target", async () => {
    const { result } = await renderHook(() => useCountUp(1161, false));

    expect(result.current.value).toBe(1161);
  });

  it("should jump to a new target with reduced motion, and never count", async () => {
    const { result, rerender } = await renderHook(
      ({ target, isReducedMotion }: Props) => useCountUp(target, isReducedMotion),
      { initialProps: { target: 1161, isReducedMotion: true } },
    );

    await rerender({ target: 561, isReducedMotion: true });

    expect(result.current.value).toBe(561);
    expect(result.current.arrivals).toBe(0);
  });

  it("should not keep an old number when reduced motion is switched off after the target changed", async () => {
    const { result, rerender } = await renderHook(
      ({ target, isReducedMotion }: Props) => useCountUp(target, isReducedMotion),
      { initialProps: { target: 1161, isReducedMotion: true } },
    );
    await rerender({ target: 561, isReducedMotion: true });

    await rerender({ target: 561, isReducedMotion: false });
    await act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(result.current.value).toBe(561);
  });

  it("should hold the target for the first frames after reduced motion is switched off, with no flash of the old number", async () => {
    const { result, rerender } = await renderHook(
      ({ target, isReducedMotion }: Props) => useCountUp(target, isReducedMotion),
      { initialProps: { target: 1161, isReducedMotion: true } },
    );
    await rerender({ target: 700, isReducedMotion: true });

    await rerender({ target: 700, isReducedMotion: false });
    await act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(result.current.value).toBe(700);
    expect(result.current.arrivals).toBe(0);
  });

  it("should not throw when the target is not a number with reduced motion on", async () => {
    const { result, rerender } = await renderHook(
      ({ target, isReducedMotion }: Props) => useCountUp(target, isReducedMotion),
      { initialProps: { target: 1161, isReducedMotion: true } },
    );

    await rerender({ target: Number.NaN, isReducedMotion: true });
    await rerender({ target: Number.NaN, isReducedMotion: true });

    expect(result.current.value).toBeNaN();
  });
});
