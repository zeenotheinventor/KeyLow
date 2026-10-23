import { act, renderHook, waitFor } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";

import { useScreenReaderEnabled } from "../../lib/screenReader";

type ScreenReaderListener = (isEnabled: boolean) => void;

const mockRemoveSubscription = jest.fn();
let announceScreenReaderChange: ScreenReaderListener | undefined;

function setScreenReader(isEnabled: boolean): void {
  jest.spyOn(AccessibilityInfo, "isScreenReaderEnabled").mockResolvedValue(isEnabled);
}

describe("useScreenReaderEnabled", () => {
  beforeEach(() => {
    announceScreenReaderChange = undefined;
    mockRemoveSubscription.mockClear();
    setScreenReader(false);
    // addEventListener is overloaded by event name and a spy sees only the last overload, so this
    // stand-in is typed by hand and cast to it. The cast is safe because the hook only ever asks for
    // `screenReaderChanged`, which the stand-in answers, and uses the one method of the subscription it returns.
    const addEventListener = (eventName: string, listener: ScreenReaderListener) => {
      if (eventName === "screenReaderChanged") {
        announceScreenReaderChange = listener;
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

  it("should be false when no screen reader is running", async () => {
    const { result } = await renderHook(() => useScreenReaderEnabled());

    expect(result.current).toBe(false);
  });

  it("should be true when a screen reader is running", async () => {
    setScreenReader(true);

    const { result } = await renderHook(() => useScreenReaderEnabled());

    await waitFor(() => {
      expect(result.current).toBe(true);
    });
  });

  it("should follow the setting while the app runs", async () => {
    const { result } = await renderHook(() => useScreenReaderEnabled());

    await act(() => {
      announceScreenReaderChange?.(true);
    });
    expect(result.current).toBe(true);

    await act(() => {
      announceScreenReaderChange?.(false);
    });
    expect(result.current).toBe(false);
  });

  it("should be false when the setting cannot be read", async () => {
    jest.spyOn(AccessibilityInfo, "isScreenReaderEnabled").mockRejectedValue(new Error("no"));

    const { result } = await renderHook(() => useScreenReaderEnabled());

    expect(result.current).toBe(false);
  });

  it("should stop listening once the last component leaves", async () => {
    const { unmount } = await renderHook(() => useScreenReaderEnabled());

    await unmount();

    expect(mockRemoveSubscription).toHaveBeenCalledTimes(1);
  });
});
