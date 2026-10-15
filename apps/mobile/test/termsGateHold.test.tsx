import { act, renderHook } from "@testing-library/react-native";

import { TERMS_GATE_HOLD_LIMIT_MS, holdTermsGate, useIsTermsGateHeld } from "../lib/termsGateHold";

describe("the terms gate hold", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("should be held from the moment it is taken until it is released", async () => {
    const { result } = await renderHook(useIsTermsGateHeld);
    expect(result.current).toBe(false);

    let release: () => void = () => undefined;
    await act(() => {
      release = holdTermsGate();
    });
    expect(result.current).toBe(true);

    await act(() => {
      release();
    });
    expect(result.current).toBe(false);
  });

  it("should stay held until every overlapping hold is released", async () => {
    const { result } = await renderHook(useIsTermsGateHeld);
    let releaseFirst: () => void = () => undefined;
    let releaseSecond: () => void = () => undefined;
    await act(() => {
      releaseFirst = holdTermsGate();
      releaseSecond = holdTermsGate();
    });

    await act(() => {
      releaseFirst();
    });
    expect(result.current).toBe(true);

    await act(() => {
      releaseSecond();
    });
    expect(result.current).toBe(false);
  });

  it("should count a hold released twice only once", async () => {
    const { result } = await renderHook(useIsTermsGateHeld);
    let releaseFirst: () => void = () => undefined;
    let releaseSecond: () => void = () => undefined;
    await act(() => {
      releaseFirst = holdTermsGate();
      releaseSecond = holdTermsGate();
    });

    await act(() => {
      releaseFirst();
      releaseFirst();
    });
    expect(result.current).toBe(true);

    await act(() => {
      releaseSecond();
    });
  });

  it("should let go by itself once the time limit passes", async () => {
    jest.useFakeTimers();
    const { result } = await renderHook(useIsTermsGateHeld);
    await act(() => {
      holdTermsGate();
    });

    await act(() => {
      jest.advanceTimersByTime(TERMS_GATE_HOLD_LIMIT_MS - 1);
    });
    expect(result.current).toBe(true);

    await act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current).toBe(false);
  });
});
