import { motionDuration } from "@keylow/tokens";
import { renderHook, waitFor } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";

import { useLookFadeMilliseconds } from "../../components/ui/Body3D/useLookFadeMilliseconds";

describe("useLookFadeMilliseconds", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should be the standard 220 ms when motion is not reduced", async () => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);

    const { result } = await renderHook(() => useLookFadeMilliseconds());

    expect(result.current).toBe(motionDuration.standard);
    expect(result.current).toBe(220);
  });

  it("should be 0, so the change is instant, once the user has asked for reduced motion", async () => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);

    const { result } = await renderHook(() => useLookFadeMilliseconds());

    await waitFor(() => {
      expect(result.current).toBe(0);
    });
  });
});
