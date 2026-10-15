import * as SplashScreen from "expo-splash-screen";

import {
  holdSplashScreen,
  reloadFailsafeMilliseconds,
  splashHoldCeilingMilliseconds,
  updateCheckTimeoutMilliseconds,
} from "../lib/updates";

// The setup file swaps this for a version with no timer. This test is of the real one.
jest.unmock("../lib/updates/holdSplashScreen");
jest.mock("expo-splash-screen", () => ({
  preventAutoHideAsync: jest.fn(() => Promise.resolve(true)),
  hideAsync: jest.fn(() => Promise.resolve()),
}));

const preventAutoHideAsync = jest.mocked(SplashScreen.preventAutoHideAsync);
const hideAsync = jest.mocked(SplashScreen.hideAsync);

describe("holdSplashScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should hold the splash screen", () => {
    holdSplashScreen();

    expect(preventAutoHideAsync).toHaveBeenCalledTimes(1);
    expect(hideAsync).not.toHaveBeenCalled();
  });

  it("should let it go at the ceiling, whatever else happens", () => {
    holdSplashScreen();

    jest.advanceTimersByTime(splashHoldCeilingMilliseconds - 1);
    expect(hideAsync).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(hideAsync).toHaveBeenCalledTimes(1);
  });

  it("should allow the check and the reload failsafe to run their course first", () => {
    expect(splashHoldCeilingMilliseconds).toBeGreaterThan(
      updateCheckTimeoutMilliseconds + reloadFailsafeMilliseconds,
    );
  });
});
