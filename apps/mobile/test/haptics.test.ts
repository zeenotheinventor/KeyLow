import { impactAsync, notificationAsync } from "expo-haptics";
import { AccessibilityInfo } from "react-native";

import { haptic } from "../lib/haptics";

// expo-haptics is replaced for every test by test/support/expoHapticsMock.ts.
const mockImpact = jest.mocked(impactAsync);
const mockNotification = jest.mocked(notificationAsync);

function setReduceMotion(isEnabled: boolean): void {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(isEnabled);
}

describe("haptic", () => {
  beforeEach(() => {
    mockImpact.mockReset().mockResolvedValue();
    mockNotification.mockReset().mockResolvedValue();
    setReduceMotion(false);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should map select to a light impact, the --haptic-select token", async () => {
    await haptic.select();

    expect(mockImpact).toHaveBeenCalledWith("light");
  });

  it("should map confirm to a medium impact, the --haptic-confirm token", async () => {
    await haptic.confirm();

    expect(mockImpact).toHaveBeenCalledWith("medium");
  });

  it("should map complete to two heavy impacts, the --haptic-complete token", async () => {
    await haptic.complete();

    expect(mockImpact).toHaveBeenCalledTimes(2);
    expect(mockImpact).toHaveBeenNthCalledWith(1, "heavy");
    expect(mockImpact).toHaveBeenNthCalledWith(2, "heavy");
  });

  it("should map warning to a warning notification, the --haptic-warning token", async () => {
    await haptic.warning();

    expect(mockNotification).toHaveBeenCalledWith("warning");
  });

  it("should map error to an error notification, the --haptic-error token", async () => {
    await haptic.error();

    expect(mockNotification).toHaveBeenCalledWith("error");
  });

  it("should do nothing when the user has reduced motion on", async () => {
    setReduceMotion(true);

    await haptic.select();
    await haptic.confirm();
    await haptic.complete();
    await haptic.warning();
    await haptic.error();

    expect(mockImpact).not.toHaveBeenCalled();
    expect(mockNotification).not.toHaveBeenCalled();
  });

  it("should read the reduce-motion setting on every call, so a change while the app runs counts", async () => {
    setReduceMotion(true);
    await haptic.select();
    setReduceMotion(false);
    await haptic.select();

    expect(mockImpact).toHaveBeenCalledTimes(1);
  });

  it("should not reject, or play, when the reduce-motion setting cannot be read", async () => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockRejectedValue(new Error("no"));

    await expect(haptic.select()).resolves.toBeUndefined();
    expect(mockImpact).not.toHaveBeenCalled();
  });

  it("should not reject when the device has no haptics", async () => {
    mockImpact.mockRejectedValue(new Error("The Haptic.impactAsync method is not available"));
    mockNotification.mockRejectedValue(
      new Error("The Haptic.notificationAsync method is not available"),
    );

    await expect(haptic.select()).resolves.toBeUndefined();
    await expect(haptic.error()).resolves.toBeUndefined();
  });
});
