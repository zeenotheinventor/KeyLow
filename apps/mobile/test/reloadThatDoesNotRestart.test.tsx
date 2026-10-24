import { act, render, renderHook } from "@testing-library/react-native";
import * as SplashScreen from "expo-splash-screen";
import * as Updates from "expo-updates";

import { reloadFailsafeMilliseconds, useHideSplashAfterUpdateCheck } from "../lib/updates";
import { availableCheck, newFetch } from "./support/updatesResults";

jest.mock("expo-splash-screen", () => ({ hideAsync: jest.fn(() => Promise.resolve()) }));
jest.mock("expo-updates", () => ({
  isEnabled: true,
  isEmergencyLaunch: false,
  updateId: "update-running",
  checkForUpdateAsync: jest.fn(),
  fetchUpdateAsync: jest.fn(),
  reloadAsync: jest.fn(),
  addUpdatesStateChangeListener: jest.fn(() => ({ remove: jest.fn() })),
}));

const hideAsync = jest.mocked(SplashScreen.hideAsync);

// The hook sets state from its timers, so the time passes inside act.
function advance(milliseconds: number) {
  return act(() => jest.advanceTimersByTimeAsync(milliseconds));
}

function Probe() {
  useHideSplashAfterUpdateCheck();

  return null;
}

describe("an update reload that leaves the app running", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    Reflect.set(globalThis, "__DEV__", false);
    jest.mocked(Updates.checkForUpdateAsync).mockResolvedValue(availableCheck("update-newer"));
    jest.mocked(Updates.fetchUpdateAsync).mockResolvedValue(newFetch("update-newer"));
    // Resolves and does nothing, so the JavaScript carries on.
    jest.mocked(Updates.reloadAsync).mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    Reflect.set(globalThis, "__DEV__", true);
  });

  it("should keep the splash screen up while the reload gets going", async () => {
    await render(<Probe />);
    await advance(reloadFailsafeMilliseconds - 1);

    expect(Updates.reloadAsync).toHaveBeenCalledTimes(1);
    expect(hideAsync).not.toHaveBeenCalled();
  });

  it("should say the splash screen has gone after the failsafe, and not before", async () => {
    const { result } = await renderHook(() => useHideSplashAfterUpdateCheck());

    await advance(reloadFailsafeMilliseconds - 1);
    expect(result.current).toBe(false);
    await advance(1);

    expect(result.current).toBe(true);
  });

  it("should not hide the splash screen from the failsafe once the hook is gone", async () => {
    const { unmount } = await render(<Probe />);
    await advance(0);

    await unmount();
    await advance(reloadFailsafeMilliseconds);

    expect(hideAsync).not.toHaveBeenCalled();
  });

  it("should hide the splash screen when the app is still running after the failsafe", async () => {
    await render(<Probe />);

    await advance(reloadFailsafeMilliseconds);

    expect(hideAsync).toHaveBeenCalledTimes(1);
  });
});
