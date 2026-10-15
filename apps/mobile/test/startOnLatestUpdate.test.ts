import * as Updates from "expo-updates";

import { startOnLatestUpdate, updateCheckTimeoutMilliseconds } from "../lib/updates";
import { availableCheck, newFetch, noUpdateCheck, nothingNewFetch } from "./support/updatesResults";

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
}));

const checkForUpdateAsync = jest.mocked(Updates.checkForUpdateAsync);
const fetchUpdateAsync = jest.mocked(Updates.fetchUpdateAsync);
const reloadAsync = jest.mocked(Updates.reloadAsync);

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

describe("startOnLatestUpdate", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockUpdatesState.isEnabled = true;
    mockUpdatesState.isEmergencyLaunch = false;
    mockUpdatesState.updateId = "update-running";
    // Jest runs with the development flag on, and a release build has it off.
    setDevelopmentFlag(false);
    reloadAsync.mockResolvedValue(undefined);
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

      const outcome = await startOnLatestUpdate();

      expect(fetchUpdateAsync).not.toHaveBeenCalled();
      expect(reloadAsync).not.toHaveBeenCalled();
      expect(outcome).toBe("up-to-date");
    });

    it("should treat an update id that differs only in letter case as the running update", async () => {
      mockUpdatesState.updateId = newerUpdateId.toUpperCase();

      const outcome = await startOnLatestUpdate();

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

      const pending = startOnLatestUpdate();
      await jest.advanceTimersByTimeAsync(updateCheckTimeoutMilliseconds);

      await expect(pending).resolves.toBe("timed-out");
    });

    it("should not reload onto an update that arrives after the time is up", async () => {
      reportNewerUpdateAvailable();
      let finishFetch: () => void = () => {};
      fetchUpdateAsync.mockReturnValue(
        new Promise((resolve) => {
          finishFetch = () => {
            resolve(newFetch(newerUpdateId));
          };
        }),
      );

      const pending = startOnLatestUpdate();
      await jest.advanceTimersByTimeAsync(updateCheckTimeoutMilliseconds);
      await expect(pending).resolves.toBe("timed-out");
      finishFetch();
      await jest.advanceTimersByTimeAsync(0);

      expect(reloadAsync).not.toHaveBeenCalled();
    });

    it("should not wait the full time when the check settles first", async () => {
      reportNoUpdateAvailable();

      await expect(startOnLatestUpdate()).resolves.toBe("up-to-date");
      expect(jest.getTimerCount()).toBe(0);
    });
  });

  describe("when updates are not to be used", () => {
    it("should skip in development, with no calls", async () => {
      setDevelopmentFlag(true);

      const outcome = await startOnLatestUpdate();

      expectNoUpdatesCalls();
      expect(outcome).toBe("skipped");
    });

    it("should skip when updates are not enabled, with no calls", async () => {
      mockUpdatesState.isEnabled = false;

      const outcome = await startOnLatestUpdate();

      expectNoUpdatesCalls();
      expect(outcome).toBe("skipped");
    });

    it("should skip after an emergency launch, so it cannot reload in a loop", async () => {
      mockUpdatesState.isEmergencyLaunch = true;

      const outcome = await startOnLatestUpdate();

      expectNoUpdatesCalls();
      expect(outcome).toBe("skipped");
    });
  });
});
