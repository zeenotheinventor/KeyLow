import { act, renderHook } from "@testing-library/react-native";
import * as SplashScreen from "expo-splash-screen";

import { startOnLatestUpdate, useHideSplashAfterUpdateCheck } from "../lib/updates";

import type { UpdateOutcome } from "../lib/updates";

jest.mock("expo-splash-screen", () => ({ hideAsync: jest.fn(() => Promise.resolve()) }));
jest.mock("../lib/updates/startOnLatestUpdate", () => ({ startOnLatestUpdate: jest.fn() }));

const hideAsync = jest.mocked(SplashScreen.hideAsync);
const checkForLatestUpdate = jest.mocked(startOnLatestUpdate);

function holdCheckOpen() {
  let settle: (outcome: UpdateOutcome) => void = () => {};
  checkForLatestUpdate.mockReturnValue(
    new Promise((resolve) => {
      settle = resolve;
    }),
  );

  return (outcome: UpdateOutcome) =>
    act(() => {
      settle(outcome);
      return Promise.resolve();
    });
}

describe("useHideSplashAfterUpdateCheck", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should keep the splash screen while the check is running", async () => {
    holdCheckOpen();

    await renderHook(() => {
      useHideSplashAfterUpdateCheck();
    });

    expect(hideAsync).not.toHaveBeenCalled();
  });

  it.each<UpdateOutcome>(["up-to-date", "timed-out", "failed", "skipped"])(
    "should hide the splash screen once the check settles as %s",
    async (outcome) => {
      const settleCheck = holdCheckOpen();
      await renderHook(() => {
        useHideSplashAfterUpdateCheck();
      });

      await settleCheck(outcome);

      expect(hideAsync).toHaveBeenCalledTimes(1);
    },
  );

  it("should keep the splash screen up when the app is about to reload", async () => {
    const settleCheck = holdCheckOpen();
    await renderHook(() => {
      useHideSplashAfterUpdateCheck();
    });

    await settleCheck("reloading");

    expect(hideAsync).not.toHaveBeenCalled();
  });

  it("should run the check once, however often the screen renders", async () => {
    const settleCheck = holdCheckOpen();
    const { rerender } = await renderHook(() => {
      useHideSplashAfterUpdateCheck();
    });

    await rerender({});
    await settleCheck("up-to-date");

    expect(checkForLatestUpdate).toHaveBeenCalledTimes(1);
  });
});
