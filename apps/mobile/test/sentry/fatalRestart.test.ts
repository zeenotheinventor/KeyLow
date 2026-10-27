import AsyncStorage from "@react-native-async-storage/async-storage";
import { addBreadcrumb } from "@sentry/react-native";
import * as Updates from "expo-updates";

import {
  fatalRestartArmedWindowMilliseconds,
  fatalRestartFailsafeMilliseconds,
  fatalRestartPeriodMilliseconds,
  fatalRestartStorageKey,
  installFatalRestart,
} from "../../lib/sentry/fatalRestart";

type GlobalHandler = (error: unknown, isFatal?: boolean) => void;

type MockUpdatesState = { isEnabled: boolean };

// What expo-updates reports, which a test changes. The mock reads it at call time.
const mockUpdatesState: MockUpdatesState = { isEnabled: true };

jest.mock("expo-updates", () => ({
  get isEnabled() {
    return mockUpdatesState.isEnabled;
  },
  reloadAsync: jest.fn(() => Promise.resolve()),
}));

// The phone's small store, held in memory. A test can make a read or a write fail, or a write never finish.
const mockStore = new Map<string, string>();
const mockStoreFailures = { read: false, write: false, writeNeverFinishes: false };

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn((key: string) =>
      mockStoreFailures.read
        ? Promise.reject(new Error("read failed"))
        : Promise.resolve(mockStore.get(key) ?? null),
    ),
    setItem: jest.fn((key: string, value: string) => {
      if (mockStoreFailures.writeNeverFinishes) {
        return new Promise(() => undefined);
      }
      if (mockStoreFailures.write) {
        return Promise.reject(new Error("write failed"));
      }
      mockStore.set(key, value);

      return Promise.resolve();
    }),
  },
}));

const NOW = 1_800_000_000_000;
const FATAL_ERROR = new Error("boom");
const ARMED = fatalRestartArmedWindowMilliseconds;
const PERIOD = fatalRestartPeriodMilliseconds;

// React Native declares the flag as a constant, so Jest's own global is set by name.
function setDevelopmentFlag(isDevelopment: boolean) {
  Reflect.set(globalThis, "__DEV__", isDevelopment);
}

// Lets the reads and writes of the small store, and the reload after them, finish.
async function settle() {
  for (let turn = 0; turn < 10; turn += 1) {
    await Promise.resolve();
  }
}

function storeRestartTimes(times: number[]) {
  mockStore.set(fatalRestartStorageKey, JSON.stringify(times));
}

describe("installFatalRestart", () => {
  const previousHandler = jest.fn<undefined, Parameters<GlobalHandler>>();
  let installedHandler: GlobalHandler | undefined;

  // The handler the app installed, read once it has been installed and the start-up read has finished.
  async function startApp(): Promise<GlobalHandler> {
    installFatalRestart();
    await settle();
    if (installedHandler === undefined) {
      throw new Error("No global handler was installed");
    }

    return installedHandler;
  }

  // An app that has run for longer than the window expo-updates watches.
  async function startAppPastTheArmedWindow(): Promise<GlobalHandler> {
    const handler = await startApp();
    jest.advanceTimersByTime(ARMED);

    return handler;
  }

  beforeEach(() => {
    jest.useFakeTimers({ now: NOW });
    setDevelopmentFlag(false);
    mockUpdatesState.isEnabled = true;
    mockStore.clear();
    mockStoreFailures.read = false;
    mockStoreFailures.write = false;
    mockStoreFailures.writeNeverFinishes = false;
    jest.clearAllMocks();
    jest.mocked(Updates.reloadAsync).mockImplementation(() => Promise.resolve());
    installedHandler = undefined;
    Reflect.set(globalThis, "ErrorUtils", {
      getGlobalHandler: () => previousHandler,
      setGlobalHandler: (handler: GlobalHandler) => {
        installedHandler = handler;
      },
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    Reflect.deleteProperty(globalThis, "ErrorUtils");
    setDevelopmentFlag(true);
  });

  describe("a fatal error in a release build", () => {
    it("should restart the app and leave the previous handler alone", async () => {
      const handler = await startAppPastTheArmedWindow();

      handler(FATAL_ERROR, true);
      await settle();

      expect(Updates.reloadAsync).toHaveBeenCalledTimes(1);
      expect(previousHandler).not.toHaveBeenCalled();
    });

    it("should store when it restarted before it restarts", async () => {
      const handler = await startAppPastTheArmedWindow();

      handler(FATAL_ERROR, true);
      await settle();

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        fatalRestartStorageKey,
        JSON.stringify([NOW + ARMED]),
      );
      const [storedAt] = jest.mocked(AsyncStorage.setItem).mock.invocationCallOrder;
      const [reloadedAt] = jest.mocked(Updates.reloadAsync).mock.invocationCallOrder;
      expect(storedAt).toBeLessThan(reloadedAt ?? 0);
    });

    it("should ignore a second fatal error while the first is restarting", async () => {
      const handler = await startAppPastTheArmedWindow();

      handler(FATAL_ERROR, true);
      handler(new Error("follow-on"), true);
      await settle();

      expect(Updates.reloadAsync).toHaveBeenCalledTimes(1);
      expect(previousHandler).not.toHaveBeenCalled();
    });
  });

  describe("an error that is not a fatal one", () => {
    it("should pass a non-fatal error to the previous handler and not restart", async () => {
      const handler = await startAppPastTheArmedWindow();

      handler(FATAL_ERROR, false);
      handler(FATAL_ERROR);
      await settle();

      expect(previousHandler).toHaveBeenCalledTimes(2);
      expect(previousHandler).toHaveBeenCalledWith(FATAL_ERROR, false);
      expect(Updates.reloadAsync).not.toHaveBeenCalled();
    });

    it("should pass a non-fatal error on while a restart is under way", async () => {
      const handler = await startAppPastTheArmedWindow();

      handler(FATAL_ERROR, true);
      handler(FATAL_ERROR, false);

      expect(previousHandler).toHaveBeenCalledWith(FATAL_ERROR, false);
    });
  });

  describe("a development build", () => {
    it("should pass a fatal error to the previous handler and not restart", async () => {
      setDevelopmentFlag(true);
      const handler = await startAppPastTheArmedWindow();

      handler(FATAL_ERROR, true);
      await settle();

      expect(previousHandler).toHaveBeenCalledWith(FATAL_ERROR, true);
      expect(Updates.reloadAsync).not.toHaveBeenCalled();
    });
  });

  describe("the window expo-updates watches", () => {
    it("should leave a fatal error to the previous handler just before the window ends", async () => {
      const handler = await startApp();

      jest.advanceTimersByTime(ARMED - 1);
      handler(FATAL_ERROR, true);
      await settle();

      expect(previousHandler).toHaveBeenCalledTimes(1);
      expect(previousHandler).toHaveBeenCalledWith(FATAL_ERROR, true);
      expect(Updates.reloadAsync).not.toHaveBeenCalled();
    });

    it("should restart for a fatal error when the window ends", async () => {
      const handler = await startApp();

      jest.advanceTimersByTime(ARMED);
      handler(FATAL_ERROR, true);
      await settle();

      expect(Updates.reloadAsync).toHaveBeenCalledTimes(1);
      expect(previousHandler).not.toHaveBeenCalled();
    });

    it("should leave a fatal error to the previous handler in the window of a start that followed a restart", async () => {
      storeRestartTimes([NOW - 2_000]);
      const handler = await startApp();

      jest.advanceTimersByTime(ARMED - 1);
      handler(FATAL_ERROR, true);
      await settle();

      expect(previousHandler).toHaveBeenCalledWith(FATAL_ERROR, true);
      expect(Updates.reloadAsync).not.toHaveBeenCalled();
    });
  });

  describe("the limit on restarts", () => {
    it("should allow two restarts in ten minutes and pass the third to the previous handler", async () => {
      for (let restart = 1; restart <= 2; restart += 1) {
        const handler = await startAppPastTheArmedWindow();
        handler(FATAL_ERROR, true);
        await settle();
        expect(Updates.reloadAsync).toHaveBeenCalledTimes(restart);
        // A real reload ends the JavaScript, and the failsafe timer with it.
        jest.clearAllTimers();
      }

      const handler = await startAppPastTheArmedWindow();
      handler(FATAL_ERROR, true);
      await settle();

      expect(Updates.reloadAsync).toHaveBeenCalledTimes(2);
      expect(previousHandler).toHaveBeenCalledTimes(1);
      expect(previousHandler).toHaveBeenCalledWith(FATAL_ERROR, true);
    });

    it("should still count a restart that is just inside the ten minutes", async () => {
      storeRestartTimes([NOW + ARMED - PERIOD + 1, NOW + ARMED - PERIOD + 2]);
      const handler = await startAppPastTheArmedWindow();

      handler(FATAL_ERROR, true);
      await settle();

      expect(previousHandler).toHaveBeenCalledWith(FATAL_ERROR, true);
      expect(Updates.reloadAsync).not.toHaveBeenCalled();
    });

    it("should restart again once the older restart is ten minutes old, and keep only recent times", async () => {
      storeRestartTimes([NOW + ARMED - PERIOD, NOW + ARMED - PERIOD + 2]);
      const handler = await startAppPastTheArmedWindow();

      handler(FATAL_ERROR, true);
      await settle();

      expect(Updates.reloadAsync).toHaveBeenCalledTimes(1);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        fatalRestartStorageKey,
        JSON.stringify([NOW + ARMED - PERIOD + 2, NOW + ARMED]),
      );
    });

    it("should not count stored times in the future, as when the clock was set back, and drop them", async () => {
      storeRestartTimes([NOW + ARMED + 1_000, NOW + ARMED + 2_000]);
      const handler = await startAppPastTheArmedWindow();

      handler(FATAL_ERROR, true);
      await settle();

      expect(Updates.reloadAsync).toHaveBeenCalledTimes(1);
      expect(previousHandler).not.toHaveBeenCalled();
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        fatalRestartStorageKey,
        JSON.stringify([NOW + ARMED]),
      );
    });

    it("should not restart before the stored times have been read", () => {
      installFatalRestart();
      jest.advanceTimersByTime(ARMED);

      installedHandler?.(FATAL_ERROR, true);

      expect(previousHandler).toHaveBeenCalledWith(FATAL_ERROR, true);
      expect(Updates.reloadAsync).not.toHaveBeenCalled();
    });

    it.each([
      ["is not JSON", "not json"],
      ["is not a list", '{"a":1}'],
      ["holds something other than times", '[1,"two"]'],
    ])("should not restart when the store %s", async (_description, stored) => {
      mockStore.set(fatalRestartStorageKey, stored);
      const handler = await startAppPastTheArmedWindow();

      handler(FATAL_ERROR, true);
      await settle();

      expect(previousHandler).toHaveBeenCalledWith(FATAL_ERROR, true);
      expect(Updates.reloadAsync).not.toHaveBeenCalled();
    });
  });

  describe("the note in the trail", () => {
    it("should note the restart once the app has started again", async () => {
      storeRestartTimes([NOW - 2_000]);

      await startApp();

      expect(addBreadcrumb).toHaveBeenCalledWith({
        category: "app.restart",
        data: { reason: "fatal" },
      });
    });

    it("should note a restart that is just inside a minute old", async () => {
      storeRestartTimes([NOW - 59_999]);

      await startApp();

      expect(addBreadcrumb).toHaveBeenCalledTimes(1);
    });

    it("should not note a restart a minute old", async () => {
      storeRestartTimes([NOW - 60_000]);

      await startApp();

      expect(addBreadcrumb).not.toHaveBeenCalled();
    });

    it("should leave the trail alone when the app did not start from a restart", async () => {
      await startApp();

      expect(addBreadcrumb).not.toHaveBeenCalled();
    });
  });

  describe("when the restart cannot be made", () => {
    it("should fall back to the previous handler when expo-updates is not enabled", async () => {
      mockUpdatesState.isEnabled = false;
      const handler = await startAppPastTheArmedWindow();

      handler(FATAL_ERROR, true);
      await settle();

      expect(previousHandler).toHaveBeenCalledWith(FATAL_ERROR, true);
      expect(Updates.reloadAsync).not.toHaveBeenCalled();
    });

    it("should fall back to the previous handler when the reload throws", async () => {
      jest.mocked(Updates.reloadAsync).mockRejectedValueOnce(new Error("reload failed"));
      const handler = await startAppPastTheArmedWindow();

      handler(FATAL_ERROR, true);
      await settle();

      expect(Updates.reloadAsync).toHaveBeenCalledTimes(1);
      expect(previousHandler).toHaveBeenCalledTimes(1);
      expect(previousHandler).toHaveBeenCalledWith(FATAL_ERROR, true);
    });

    it("should fall back to the previous handler when the stored times cannot be read", async () => {
      mockStoreFailures.read = true;
      const handler = await startAppPastTheArmedWindow();

      handler(FATAL_ERROR, true);
      await settle();

      expect(previousHandler).toHaveBeenCalledWith(FATAL_ERROR, true);
      expect(Updates.reloadAsync).not.toHaveBeenCalled();
    });

    it("should fall back to the previous handler when the times cannot be stored", async () => {
      mockStoreFailures.write = true;
      const handler = await startAppPastTheArmedWindow();

      handler(FATAL_ERROR, true);
      await settle();

      expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
      expect(Updates.reloadAsync).not.toHaveBeenCalled();
      expect(previousHandler).toHaveBeenCalledWith(FATAL_ERROR, true);
    });

    it("should leave the handler alone when the app has no global error handling", () => {
      Reflect.deleteProperty(globalThis, "ErrorUtils");

      expect(() => {
        installFatalRestart();
      }).not.toThrow();
    });
  });

  describe("a restart that does not finish", () => {
    it("should pass the error to the previous handler after the failsafe when the reload never settles", async () => {
      jest.mocked(Updates.reloadAsync).mockImplementationOnce(() => new Promise(() => undefined));
      const handler = await startAppPastTheArmedWindow();

      handler(FATAL_ERROR, true);
      await settle();
      jest.advanceTimersByTime(fatalRestartFailsafeMilliseconds - 1);
      expect(previousHandler).not.toHaveBeenCalled();
      jest.advanceTimersByTime(1);

      expect(previousHandler).toHaveBeenCalledTimes(1);
      expect(previousHandler).toHaveBeenCalledWith(FATAL_ERROR, true);
    });

    it("should pass the error to the previous handler after the failsafe when the store never answers", async () => {
      mockStoreFailures.writeNeverFinishes = true;
      const handler = await startAppPastTheArmedWindow();

      handler(FATAL_ERROR, true);
      await settle();
      jest.advanceTimersByTime(fatalRestartFailsafeMilliseconds - 1);
      expect(previousHandler).not.toHaveBeenCalled();
      jest.advanceTimersByTime(1);

      expect(previousHandler).toHaveBeenCalledTimes(1);
      expect(Updates.reloadAsync).not.toHaveBeenCalled();
    });

    it("should handle a fatal error that arrives after the failsafe fired, and restart if the limit allows", async () => {
      jest.mocked(Updates.reloadAsync).mockImplementationOnce(() => new Promise(() => undefined));
      const handler = await startAppPastTheArmedWindow();
      handler(FATAL_ERROR, true);
      await settle();
      jest.advanceTimersByTime(fatalRestartFailsafeMilliseconds);
      expect(previousHandler).toHaveBeenCalledTimes(1);

      handler(FATAL_ERROR, true);
      await settle();

      expect(Updates.reloadAsync).toHaveBeenCalledTimes(2);
      expect(previousHandler).toHaveBeenCalledTimes(1);
    });

    it("should count an attempt that gave up, so two attempts in a session reach the limit without reading the store again", async () => {
      jest.mocked(Updates.reloadAsync).mockImplementation(() => new Promise(() => undefined));
      const handler = await startAppPastTheArmedWindow();
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        handler(FATAL_ERROR, true);
        await settle();
        jest.advanceTimersByTime(fatalRestartFailsafeMilliseconds);
        expect(Updates.reloadAsync).toHaveBeenCalledTimes(attempt);
      }

      handler(FATAL_ERROR, true);
      await settle();

      expect(Updates.reloadAsync).toHaveBeenCalledTimes(2);
      expect(previousHandler).toHaveBeenCalledTimes(3);
    });

    it("should not call the previous handler a second time when the reload fails after the failsafe", async () => {
      let failReload: (reason: Error) => void = () => undefined;
      jest.mocked(Updates.reloadAsync).mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            failReload = reject;
          }),
      );
      const handler = await startAppPastTheArmedWindow();
      handler(FATAL_ERROR, true);
      await settle();
      jest.advanceTimersByTime(fatalRestartFailsafeMilliseconds);

      failReload(new Error("late"));
      await settle();

      expect(previousHandler).toHaveBeenCalledTimes(1);
    });

    it("should pass the error to the previous handler after the failsafe when the reload resolved but the app never restarted", async () => {
      const handler = await startAppPastTheArmedWindow();

      handler(FATAL_ERROR, true);
      await settle();
      expect(Updates.reloadAsync).toHaveBeenCalledTimes(1);
      jest.advanceTimersByTime(fatalRestartFailsafeMilliseconds - 1);
      expect(previousHandler).not.toHaveBeenCalled();
      jest.advanceTimersByTime(1);

      expect(previousHandler).toHaveBeenCalledTimes(1);
      expect(previousHandler).toHaveBeenCalledWith(FATAL_ERROR, true);
    });
  });
});
