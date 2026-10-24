import * as Updates from "expo-updates";

import {
  startOnLatestUpdate,
  updateCheckTimeoutMilliseconds,
  updateStallTimeoutMilliseconds,
} from "../lib/updates";
import {
  availableCheck,
  fakeProgressSource,
  newFetch,
  noUpdateCheck,
  nothingNewFetch,
} from "./support/updatesResults";

type MockUpdatesState = {
  isEnabled: boolean;
  isEmergencyLaunch: boolean;
  updateId: string | null;
};

// The state expo-updates reports, which a test changes. The mock reads it at call time.
const mockUpdatesState: MockUpdatesState = {
  isEnabled: true,
  isEmergencyLaunch: false,
  updateId: "update-running",
};

jest.mock("expo-updates", () => ({
  get isEnabled() {
    return mockUpdatesState.isEnabled;
  },
  get isEmergencyLaunch() {
    return mockUpdatesState.isEmergencyLaunch;
  },
  get updateId() {
    return mockUpdatesState.updateId;
  },
  checkForUpdateAsync: jest.fn(),
  fetchUpdateAsync: jest.fn(),
  reloadAsync: jest.fn(),
  addUpdatesStateChangeListener: jest.fn(),
}));

const checkForUpdateAsync = jest.mocked(Updates.checkForUpdateAsync);
const fetchUpdateAsync = jest.mocked(Updates.fetchUpdateAsync);
const reloadAsync = jest.mocked(Updates.reloadAsync);
const addUpdatesStateChangeListener = jest.mocked(Updates.addUpdatesStateChangeListener);
// Made new for each test, so a test that leaves its download open leaves no listener for the next.
let progressSource = fakeProgressSource();

// React Native declares the flag as a constant, so Jest's own global is set by name.
function setDevelopmentFlag(isDevelopment: boolean) {
  Reflect.set(globalThis, "__DEV__", isDevelopment);
}

const newerUpdateId = "update-newer";

function reportNewerUpdateAvailable() {
  checkForUpdateAsync.mockResolvedValue(availableCheck(newerUpdateId));
}

function reportNoUpdateAvailable() {
  checkForUpdateAsync.mockResolvedValue(noUpdateCheck());
}

function reportFetchedUpdateIsNew(isNew: boolean) {
  fetchUpdateAsync.mockResolvedValue(isNew ? newFetch(newerUpdateId) : nothingNewFetch());
}

function expectNoUpdatesCalls() {
  expect(checkForUpdateAsync).not.toHaveBeenCalled();
  expect(fetchUpdateAsync).not.toHaveBeenCalled();
  expect(reloadAsync).not.toHaveBeenCalled();
}

// A fetch that stays open until the test finishes it, so progress can be reported while it runs.
function holdFetchOpen() {
  let finish: () => void = () => {};
  fetchUpdateAsync.mockReturnValue(
    new Promise((resolve) => {
      finish = () => {
        resolve(newFetch(newerUpdateId));
      };
    }),
  );

  return finish;
}

function makeCallbacks() {
  return { onUpdateFound: jest.fn() };
}

describe("startOnLatestUpdate", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockUpdatesState.isEnabled = true;
    mockUpdatesState.isEmergencyLaunch = false;
    mockUpdatesState.updateId = "update-running";
    // Jest runs with the development flag on, and a release build has it off.
    setDevelopmentFlag(false);
    reloadAsync.mockResolvedValue(undefined);
    progressSource = fakeProgressSource();
    addUpdatesStateChangeListener.mockImplementation(progressSource.subscribe);
  });

  afterEach(() => {
    jest.useRealTimers();
    setDevelopmentFlag(true);
  });

  describe("when a newer update is available", () => {
    beforeEach(() => {
      reportNewerUpdateAvailable();
      reportFetchedUpdateIsNew(true);
    });

    it("should fetch the update and then reload onto it", async () => {
      const calls: string[] = [];
      fetchUpdateAsync.mockImplementation(() => {
        calls.push("fetch");
        return Promise.resolve(newFetch(newerUpdateId));
      });
      reloadAsync.mockImplementation(() => {
        calls.push("reload");
        return Promise.resolve();
      });

      const outcome = await startOnLatestUpdate();

      expect(calls).toEqual(["fetch", "reload"]);
      expect(outcome).toBe("reloading");
    });

    it("should not reload when the fetch brought nothing new", async () => {
      reportFetchedUpdateIsNew(false);

      const outcome = await startOnLatestUpdate();

      expect(reloadAsync).not.toHaveBeenCalled();
      expect(outcome).toBe("up-to-date");
    });

    it("should not fetch or reload when the available update is the one already running", async () => {
      mockUpdatesState.updateId = newerUpdateId;
      const callbacks = makeCallbacks();

      const outcome = await startOnLatestUpdate(callbacks);

      expect(callbacks.onUpdateFound).not.toHaveBeenCalled();
      expect(fetchUpdateAsync).not.toHaveBeenCalled();
      expect(reloadAsync).not.toHaveBeenCalled();
      expect(outcome).toBe("up-to-date");
    });

    it("should treat an update id that differs only in letter case as the running update", async () => {
      mockUpdatesState.updateId = newerUpdateId.toUpperCase();
      const callbacks = makeCallbacks();

      const outcome = await startOnLatestUpdate(callbacks);

      expect(callbacks.onUpdateFound).not.toHaveBeenCalled();
      expect(fetchUpdateAsync).not.toHaveBeenCalled();
      expect(reloadAsync).not.toHaveBeenCalled();
      expect(outcome).toBe("up-to-date");
    });

    it("should carry on when the reload fails", async () => {
      reloadAsync.mockRejectedValue(new Error("reload failed"));

      await expect(startOnLatestUpdate()).resolves.toBe("failed");
    });
  });

  describe("when no update is available", () => {
    it("should continue without fetching or reloading", async () => {
      reportNoUpdateAvailable();

      const outcome = await startOnLatestUpdate();

      expect(checkForUpdateAsync).toHaveBeenCalledTimes(1);
      expect(fetchUpdateAsync).not.toHaveBeenCalled();
      expect(reloadAsync).not.toHaveBeenCalled();
      expect(outcome).toBe("up-to-date");
    });

    it("should not say an update was found", async () => {
      reportNoUpdateAvailable();
      const callbacks = makeCallbacks();

      await startOnLatestUpdate(callbacks);

      expect(callbacks.onUpdateFound).not.toHaveBeenCalled();
    });
  });

  describe("when the check or the fetch throws", () => {
    it("should continue when the check throws", async () => {
      checkForUpdateAsync.mockRejectedValue(new Error("offline"));

      const outcome = await startOnLatestUpdate();

      expect(reloadAsync).not.toHaveBeenCalled();
      expect(outcome).toBe("failed");
    });

    it("should continue without reloading when the fetch throws", async () => {
      reportNewerUpdateAvailable();
      fetchUpdateAsync.mockRejectedValue(new Error("download failed"));

      const outcome = await startOnLatestUpdate();

      expect(reloadAsync).not.toHaveBeenCalled();
      expect(outcome).toBe("failed");
    });
  });

  describe("when the check takes too long", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    it("should continue once the time is up", async () => {
      checkForUpdateAsync.mockReturnValue(new Promise(() => {}));
      const callbacks = makeCallbacks();

      const pending = startOnLatestUpdate(callbacks);
      await jest.advanceTimersByTimeAsync(updateCheckTimeoutMilliseconds);

      await expect(pending).resolves.toBe("timed-out");
      expect(callbacks.onUpdateFound).not.toHaveBeenCalled();
    });

    it("should not reload onto, or show, an update that is found after the time is up", async () => {
      let finishCheck: () => void = () => {};
      checkForUpdateAsync.mockReturnValue(
        new Promise((resolve) => {
          finishCheck = () => {
            resolve(availableCheck(newerUpdateId));
          };
        }),
      );
      const finishFetch = holdFetchOpen();
      const callbacks = makeCallbacks();

      const pending = startOnLatestUpdate(callbacks);
      await jest.advanceTimersByTimeAsync(updateCheckTimeoutMilliseconds);
      await expect(pending).resolves.toBe("timed-out");
      finishCheck();
      await jest.advanceTimersByTimeAsync(0);
      finishFetch();
      await jest.advanceTimersByTimeAsync(0);

      expect(fetchUpdateAsync).toHaveBeenCalledTimes(1);
      expect(callbacks.onUpdateFound).not.toHaveBeenCalled();
      expect(reloadAsync).not.toHaveBeenCalled();
    });

    it("should not wait the full time when the check settles first", async () => {
      reportNoUpdateAvailable();

      await expect(startOnLatestUpdate()).resolves.toBe("up-to-date");
      expect(jest.getTimerCount()).toBe(0);
    });
  });

  describe("while an update downloads", () => {
    beforeEach(() => {
      jest.useFakeTimers();
      reportNewerUpdateAvailable();
    });

    it("should say an update was found once, before the fetch starts", async () => {
      const calls: string[] = [];
      const callbacks = { onUpdateFound: jest.fn(() => calls.push("found")) };
      fetchUpdateAsync.mockImplementation(() => {
        calls.push("fetch");
        return new Promise(() => {});
      });

      void startOnLatestUpdate(callbacks);
      await jest.advanceTimersByTimeAsync(0);

      expect(calls).toEqual(["found", "fetch"]);
      expect(callbacks.onUpdateFound).toHaveBeenCalledTimes(1);
    });

    it("should not restart the stall time for a state change that is not a download", async () => {
      holdFetchOpen();

      const pending = startOnLatestUpdate();
      await jest.advanceTimersByTimeAsync(10_000);
      progressSource.report(0.4, false);
      await jest.advanceTimersByTimeAsync(5000);

      await expect(pending).resolves.toBe("stalled");
    });

    it("should not stop the download because it takes longer than the time for the check", async () => {
      holdFetchOpen();

      const pending = startOnLatestUpdate();
      await jest.advanceTimersByTimeAsync(updateCheckTimeoutMilliseconds * 2);
      progressSource.report(0.5);
      await jest.advanceTimersByTimeAsync(updateCheckTimeoutMilliseconds * 2);

      expect(reloadAsync).not.toHaveBeenCalled();
      let outcome: string | undefined;
      void pending.then((value) => {
        outcome = value;
      });
      await jest.advanceTimersByTimeAsync(0);
      expect(outcome).toBeUndefined();
    });

    it("should keep going while the progress keeps changing, however long the download takes", async () => {
      const finishFetch = holdFetchOpen();

      const pending = startOnLatestUpdate();
      await jest.advanceTimersByTimeAsync(0);
      for (const progress of [0.1, 0.3, 0.5, 0.8]) {
        await jest.advanceTimersByTimeAsync(10_000);
        progressSource.report(progress);
      }
      await jest.advanceTimersByTimeAsync(5000);
      finishFetch();

      await expect(pending).resolves.toBe("reloading");
      expect(reloadAsync).toHaveBeenCalledTimes(1);
    });

    describe("when the progress stops", () => {
      it("should carry on with the current bundle once it has not changed for the stall time", async () => {
        holdFetchOpen();

        const pending = startOnLatestUpdate();
        await jest.advanceTimersByTimeAsync(10_000);
        progressSource.report(0.2);
        await jest.advanceTimersByTimeAsync(updateStallTimeoutMilliseconds);

        await expect(pending).resolves.toBe("stalled");
        expect(reloadAsync).not.toHaveBeenCalled();
      });

      it("should not stall one millisecond before the stall time", async () => {
        holdFetchOpen();
        let outcome: string | undefined;

        void startOnLatestUpdate().then((value) => {
          outcome = value;
        });
        await jest.advanceTimersByTimeAsync(updateStallTimeoutMilliseconds - 1);

        expect(outcome).toBeUndefined();
      });

      it("should stall when no progress is reported at all, counting the fetch as a whole", async () => {
        holdFetchOpen();

        const pending = startOnLatestUpdate();
        await jest.advanceTimersByTimeAsync(updateStallTimeoutMilliseconds);

        await expect(pending).resolves.toBe("stalled");
      });

      it("should not restart the stall time for a progress that has not changed", async () => {
        holdFetchOpen();

        const pending = startOnLatestUpdate();
        await jest.advanceTimersByTimeAsync(10_000);
        progressSource.report(0.2);
        await jest.advanceTimersByTimeAsync(10_000);
        progressSource.report(0.2);
        await jest.advanceTimersByTimeAsync(5000);

        await expect(pending).resolves.toBe("stalled");
      });

      it("should not reload onto an update that finishes after the stall", async () => {
        const finishFetch = holdFetchOpen();
        const pending = startOnLatestUpdate();
        await jest.advanceTimersByTimeAsync(updateStallTimeoutMilliseconds);
        await expect(pending).resolves.toBe("stalled");

        finishFetch();
        await jest.advanceTimersByTimeAsync(0);

        expect(reloadAsync).not.toHaveBeenCalled();
      });

      it("should stop listening and leave no timer behind", async () => {
        holdFetchOpen();

        const pending = startOnLatestUpdate();
        await jest.advanceTimersByTimeAsync(updateStallTimeoutMilliseconds);
        await pending;

        expect(progressSource.listenerCount()).toBe(0);
        expect(jest.getTimerCount()).toBe(0);
      });
    });

    describe("when the reload starts long after the last progress", () => {
      // The fetch returns 14 s after the last change in progress, so the stall timer has 1 s left, and the
      // reload is held open.
      async function startReloadAfterSlowFetch() {
        const finishFetch = holdFetchOpen();
        let finishReload: () => void = () => {};
        reloadAsync.mockReturnValue(
          new Promise((resolve) => {
            finishReload = () => {
              resolve(undefined);
            };
          }),
        );
        let outcome: string | undefined;

        void startOnLatestUpdate().then((value) => {
          outcome = value;
        });
        await jest.advanceTimersByTimeAsync(0);
        progressSource.report(0.9);
        await jest.advanceTimersByTimeAsync(updateStallTimeoutMilliseconds - 1000);
        finishFetch();
        await jest.advanceTimersByTimeAsync(0);

        return { finishReload, outcome: () => outcome };
      }

      it("should not call the reload a stall while it gets going", async () => {
        const { finishReload, outcome } = await startReloadAfterSlowFetch();

        await jest.advanceTimersByTimeAsync(2000);
        expect(outcome()).toBeUndefined();
        finishReload();
        await jest.advanceTimersByTimeAsync(0);

        expect(outcome()).toBe("reloading");
        expect(reloadAsync).toHaveBeenCalledTimes(1);
      });

      it("should still stall when the reload never returns, so the screen cannot be held for ever", async () => {
        const { outcome } = await startReloadAfterSlowFetch();

        await jest.advanceTimersByTimeAsync(updateStallTimeoutMilliseconds);

        expect(outcome()).toBe("stalled");
      });
    });

    describe("when the progress listener cannot be added", () => {
      it("should carry on with the download and reload, without progress", async () => {
        addUpdatesStateChangeListener.mockImplementation(() => {
          throw new Error("not available");
        });
        fetchUpdateAsync.mockResolvedValue(newFetch(newerUpdateId));
        const callbacks = makeCallbacks();

        const outcome = await startOnLatestUpdate(callbacks);

        expect(outcome).toBe("reloading");
        expect(callbacks.onUpdateFound).toHaveBeenCalledTimes(1);
        expect(reloadAsync).toHaveBeenCalledTimes(1);
      });

      it("should still stall when the download does not finish, counting the fetch as a whole", async () => {
        addUpdatesStateChangeListener.mockImplementation(() => {
          throw new Error("not available");
        });
        holdFetchOpen();

        const pending = startOnLatestUpdate();
        await jest.advanceTimersByTimeAsync(updateStallTimeoutMilliseconds);

        await expect(pending).resolves.toBe("stalled");
      });
    });

    describe("when the fetch fails", () => {
      it("should carry on at once, without waiting for the stall time", async () => {
        fetchUpdateAsync.mockRejectedValue(new Error("download failed"));
        const callbacks = makeCallbacks();

        const outcome = await startOnLatestUpdate(callbacks);

        expect(outcome).toBe("failed");
        expect(callbacks.onUpdateFound).toHaveBeenCalledTimes(1);
        expect(reloadAsync).not.toHaveBeenCalled();
        expect(progressSource.listenerCount()).toBe(0);
        expect(jest.getTimerCount()).toBe(0);
      });
    });

    describe("when the download finishes", () => {
      it("should reload exactly once", async () => {
        fetchUpdateAsync.mockResolvedValue(newFetch(newerUpdateId));

        const outcome = await startOnLatestUpdate();

        expect(reloadAsync).toHaveBeenCalledTimes(1);
        expect(outcome).toBe("reloading");
      });

      it("should stop listening and leave no timer behind", async () => {
        fetchUpdateAsync.mockResolvedValue(newFetch(newerUpdateId));

        await startOnLatestUpdate();

        expect(progressSource.listenerCount()).toBe(0);
        expect(jest.getTimerCount()).toBe(0);
      });
    });
  });

  describe("when updates are not to be used", () => {
    it("should skip in development, with no calls", async () => {
      setDevelopmentFlag(true);
      const callbacks = makeCallbacks();

      const outcome = await startOnLatestUpdate(callbacks);

      expectNoUpdatesCalls();
      expect(callbacks.onUpdateFound).not.toHaveBeenCalled();
      expect(addUpdatesStateChangeListener).not.toHaveBeenCalled();
      expect(outcome).toBe("skipped");
    });

    it("should skip when updates are not enabled, with no calls", async () => {
      mockUpdatesState.isEnabled = false;
      const callbacks = makeCallbacks();

      const outcome = await startOnLatestUpdate(callbacks);

      expectNoUpdatesCalls();
      expect(callbacks.onUpdateFound).not.toHaveBeenCalled();
      expect(addUpdatesStateChangeListener).not.toHaveBeenCalled();
      expect(outcome).toBe("skipped");
    });

    it("should skip after an emergency launch, so it cannot reload in a loop", async () => {
      mockUpdatesState.isEmergencyLaunch = true;
      const callbacks = makeCallbacks();

      const outcome = await startOnLatestUpdate(callbacks);

      expectNoUpdatesCalls();
      expect(callbacks.onUpdateFound).not.toHaveBeenCalled();
      expect(addUpdatesStateChangeListener).not.toHaveBeenCalled();
      expect(outcome).toBe("skipped");
    });
  });
});
