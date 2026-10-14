import { act, renderHook } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";

import { useTabTransitionOptions } from "../../components/ui";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

function setReduceMotion(isEnabled: boolean): void {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(isEnabled);
}

describe("useTabTransitionOptions", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should change tab with the plain quick fade, over the design's quick duration", async () => {
    setReduceMotion(false);

    const { result } = await renderHook(() => useTabTransitionOptions());
    await act(() => Promise.resolve());

    expect(result.current).toEqual({
      animation: "fade",
      transitionSpec: { animation: "timing", config: { duration: 160 } },
    });
  });

  it("should change tab with no animation when the user has reduced motion on", async () => {
    setReduceMotion(true);

    const { result } = await renderHook(() => useTabTransitionOptions());
    await act(() => Promise.resolve());

    expect(result.current).toEqual({ animation: "none" });
  });
});
