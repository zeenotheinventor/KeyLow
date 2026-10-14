import { act, renderHook, waitFor } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";

import { useReducedMotion } from "../../lib/motion";

type ReduceMotionListener = (isEnabled: boolean) => void;

const mockRemoveSubscription = jest.fn();
let announceReduceMotionChange: ReduceMotionListener | undefined;

function setReduceMotion(isEnabled: boolean): void {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(isEnabled);
}

describe("useReducedMotion", () => {
  beforeEach(() => {
    announceReduceMotionChange = undefined;
    mockRemoveSubscription.mockClear();
    setReduceMotion(false);
    // addEventListener is overloaded by event name and a spy sees only the last overload, so this
    // stand-in is typed by hand. The subscription it returns has the one method the hook calls.
    const addEventListener = (eventName: string, listener: ReduceMotionListener) => {
      if (eventName === "reduceMotionChanged") {
        announceReduceMotionChange = listener;
      }
      return { remove: mockRemoveSubscription };
    };
    jest
      .spyOn(AccessibilityInfo, "addEventListener")
      .mockImplementation(addEventListener as unknown as typeof AccessibilityInfo.addEventListener);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should be false when the user has not asked for reduced motion", async () => {
    const { result } = await renderHook(() => useReducedMotion());

    expect(result.current).toBe(false);
  });

  it("should be true when the user has asked for reduced motion", async () => {
    setReduceMotion(true);

    const { result } = await renderHook(() => useReducedMotion());

    await waitFor(() => {
      expect(result.current).toBe(true);
    });
  });

  it("should follow the setting while the app runs", async () => {
    const { result } = await renderHook(() => useReducedMotion());

    await act(() => {
      announceReduceMotionChange?.(true);
    });
    expect(result.current).toBe(true);

    await act(() => {
      announceReduceMotionChange?.(false);
    });
    expect(result.current).toBe(false);
  });

  it("should stay false when the setting cannot be read", async () => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockRejectedValue(new Error("no"));

    const { result } = await renderHook(() => useReducedMotion());

    expect(result.current).toBe(false);
  });

  it("should stop listening when the component goes away", async () => {
    const { unmount } = await renderHook(() => useReducedMotion());

    await unmount();

    expect(mockRemoveSubscription).toHaveBeenCalledTimes(1);
  });

  describe("with many components using it", () => {
    it("should ask the system and listen once, however many components read the setting", async () => {
      const addEventListener = jest.spyOn(AccessibilityInfo, "addEventListener");
      const isReduceMotionEnabled = jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled");
      addEventListener.mockClear();
      isReduceMotionEnabled.mockClear();

      await renderHook(() => [useReducedMotion(), useReducedMotion()]);
      await renderHook(() => useReducedMotion());

      expect(addEventListener).toHaveBeenCalledTimes(1);
      expect(isReduceMotionEnabled).toHaveBeenCalledTimes(1);
    });

    it("should hand a change to every component at once", async () => {
      const first = await renderHook(() => useReducedMotion());
      const second = await renderHook(() => useReducedMotion());

      await act(() => {
        announceReduceMotionChange?.(true);
      });

      expect(first.result.current).toBe(true);
      expect(second.result.current).toBe(true);
    });

    it("should keep listening until the last component goes away", async () => {
      const first = await renderHook(() => useReducedMotion());
      const second = await renderHook(() => useReducedMotion());

      await first.unmount();
      expect(mockRemoveSubscription).not.toHaveBeenCalled();

      await second.unmount();
      expect(mockRemoveSubscription).toHaveBeenCalledTimes(1);
    });

    it("should keep the last answer for a component that arrives as the last one goes, until the fresh read corrects it", async () => {
      setReduceMotion(true);
      const first = await renderHook(() => useReducedMotion());
      await waitFor(() => {
        expect(first.result.current).toBe(true);
      });
      await first.unmount();
      // The fresh read has not answered yet, so what the component sees first is the last answer.
      jest
        .spyOn(AccessibilityInfo, "isReduceMotionEnabled")
        .mockReturnValue(new Promise(() => undefined));

      const second = await renderHook(() => useReducedMotion());

      expect(second.result.current).toBe(true);
    });

    it("should read the setting afresh when a component arrives after all have gone", async () => {
      setReduceMotion(true);
      const first = await renderHook(() => useReducedMotion());
      await waitFor(() => {
        expect(first.result.current).toBe(true);
      });
      await first.unmount();
      setReduceMotion(false);

      const second = await renderHook(() => useReducedMotion());

      await waitFor(() => {
        expect(second.result.current).toBe(false);
      });
    });
  });
});
