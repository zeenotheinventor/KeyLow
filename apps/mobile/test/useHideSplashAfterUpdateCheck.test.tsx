import { act, renderHook } from "@testing-library/react-native";
import * as SplashScreen from "expo-splash-screen";

import {
  cancelSplashHoldCeiling,
  reloadFailsafeMilliseconds,
  startOnLatestUpdate,
  useHideSplashAfterUpdateCheck,
} from "../lib/updates";

import type { UpdateCallbacks, UpdateOutcome } from "../lib/updates";

jest.mock("expo-splash-screen", () => ({ hideAsync: jest.fn(() => Promise.resolve()) }));
jest.mock("../lib/updates/startOnLatestUpdate", () => ({ startOnLatestUpdate: jest.fn() }));
jest.mock("../lib/updates/holdSplashScreen", () => ({ cancelSplashHoldCeiling: jest.fn() }));

const hideAsync = jest.mocked(SplashScreen.hideAsync);
const checkForLatestUpdate = jest.mocked(startOnLatestUpdate);

// Holds the check open, and gives the test the callbacks the hook handed to it, to call as the update goes.
function holdCheckOpen() {
  let settle: (outcome: UpdateOutcome) => void = () => {};
  checkForLatestUpdate.mockReturnValue(
    new Promise((resolve) => {
      settle = resolve;
    }),
  );

  return {
    settleCheck: (outcome: UpdateOutcome) =>
      act(() => {
        settle(outcome);
        return Promise.resolve();
      }),
    callbacks: (): UpdateCallbacks => checkForLatestUpdate.mock.calls[0]?.[0] ?? {},
  };
}

function renderUpdateHook() {
  return renderHook(() => useHideSplashAfterUpdateCheck());
}

describe("useHideSplashAfterUpdateCheck", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should keep the splash screen while the check is running", async () => {
    holdCheckOpen();

    await renderUpdateHook();

    expect(hideAsync).not.toHaveBeenCalled();
  });

  it("should say the splash screen has not gone while the check is running", async () => {
    holdCheckOpen();

    const { result } = await renderUpdateHook();

    expect(result.current).toBe(false);
  });

  it.each<UpdateOutcome>(["up-to-date", "timed-out", "failed", "skipped"])(
    "should hide the splash screen once the check settles as %s",
    async (outcome) => {
      const { settleCheck } = holdCheckOpen();
      await renderUpdateHook();

      await settleCheck(outcome);

      expect(hideAsync).toHaveBeenCalledTimes(1);
    },
  );

  it.each<UpdateOutcome>(["up-to-date", "timed-out", "failed", "skipped"])(
    "should say the splash screen has gone once it has been hidden after the check settles as %s",
    async (outcome) => {
      const { settleCheck } = holdCheckOpen();
      const { result } = await renderUpdateHook();

      await settleCheck(outcome);

      expect(result.current).toBe(true);
    },
  );

  it("should keep the splash screen up when the app is about to reload", async () => {
    const { settleCheck } = holdCheckOpen();
    await renderUpdateHook();

    await settleCheck("reloading");

    expect(hideAsync).not.toHaveBeenCalled();
  });

  it("should run the check once, however often the screen renders", async () => {
    const { settleCheck } = holdCheckOpen();
    const { rerender } = await renderUpdateHook();

    await rerender({});
    await settleCheck("up-to-date");

    expect(checkForLatestUpdate).toHaveBeenCalledTimes(1);
  });

  describe("when an update is found", () => {
    async function renderWithUpdateFound() {
      const check = holdCheckOpen();
      const rendered = await renderUpdateHook();
      await act(() => {
        check.callbacks().onUpdateFound?.();
        return Promise.resolve();
      });

      return { ...check, ...rendered };
    }

    it("should keep the splash screen up for the whole download, and not say it has gone", async () => {
      const { result } = await renderWithUpdateFound();

      expect(hideAsync).not.toHaveBeenCalled();
      expect(result.current).toBe(false);
    });

    it("should stop the ceiling from hiding the splash screen during the download", async () => {
      await renderWithUpdateFound();

      expect(cancelSplashHoldCeiling).toHaveBeenCalledTimes(1);
    });

    it("should not touch the ceiling when no update is found", async () => {
      const { settleCheck } = holdCheckOpen();
      await renderUpdateHook();

      await settleCheck("up-to-date");

      expect(cancelSplashHoldCeiling).not.toHaveBeenCalled();
    });

    it.each<UpdateOutcome>(["stalled", "failed", "up-to-date"])(
      "should hide the splash screen, once, when the update ends as %s",
      async (outcome) => {
        const { result, settleCheck } = await renderWithUpdateFound();

        await settleCheck(outcome);

        expect(hideAsync).toHaveBeenCalledTimes(1);
        expect(result.current).toBe(true);
      },
    );

    it("should keep the splash screen up while the app reloads", async () => {
      const { result, settleCheck } = await renderWithUpdateFound();

      await settleCheck("reloading");

      expect(hideAsync).not.toHaveBeenCalled();
      expect(result.current).toBe(false);
    });
  });

  describe("when the reload leaves the app running", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should hide the splash screen after the failsafe, and not a moment before", async () => {
      const check = holdCheckOpen();
      const { result } = await renderUpdateHook();
      await act(() => {
        check.callbacks().onUpdateFound?.();
        return Promise.resolve();
      });
      await check.settleCheck("reloading");

      await act(() => jest.advanceTimersByTimeAsync(reloadFailsafeMilliseconds - 1));
      expect(hideAsync).not.toHaveBeenCalled();
      await act(() => jest.advanceTimersByTimeAsync(1));

      expect(hideAsync).toHaveBeenCalledTimes(1);
      expect(result.current).toBe(true);
    });
  });
});
