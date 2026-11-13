import { act, renderHook } from "@testing-library/react-native";

import { useStableCallback } from "../lib/useStableCallback";

describe("useStableCallback", () => {
  it("should give the same function on every render", async () => {
    const { result, rerender } = await renderHook(
      ({ count }: { count: number }) => useStableCallback(() => count),
      { initialProps: { count: 1 } },
    );
    const first = result.current;

    await rerender({ count: 2 });

    expect(result.current).toBe(first);
  });

  it("should call what the latest render gave it", async () => {
    const { result, rerender } = await renderHook(
      ({ count }: { count: number }) => useStableCallback(() => count),
      { initialProps: { count: 1 } },
    );
    const first = result.current;

    await rerender({ count: 2 });

    await act(() => {
      expect(first()).toBe(2);
    });
  });
});
