import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { useIsOnline } from "@/lib/useIsOnline";

describe("useIsOnline", () => {
  afterEach(() => {
    cleanup();
    onlineManager.setOnline(true);
  });

  it("should be true while the app can reach the server", () => {
    const { result } = renderHook(() => useIsOnline());

    expect(result.current).toBe(true);
  });

  it("should be false once React Query's online manager says the app is offline", () => {
    const { result } = renderHook(() => useIsOnline());

    act(() => {
      onlineManager.setOnline(false);
    });

    expect(result.current).toBe(false);
  });

  it("should turn true again when the connection comes back", () => {
    onlineManager.setOnline(false);
    const { result } = renderHook(() => useIsOnline());
    expect(result.current).toBe(false);

    act(() => {
      onlineManager.setOnline(true);
    });

    expect(result.current).toBe(true);
  });
});
