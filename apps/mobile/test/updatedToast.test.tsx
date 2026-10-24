import { UPDATED_TOAST } from "@keylow/core/copy";
import { act, renderHook, screen } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";

import { useUpdatedToast } from "../components/RootNavigator/useUpdatedToast";
import { ToastProvider } from "../components/ui";
import { ThemeProvider } from "../lib/theme";
import { lastSeenUpdateIdStorageKey } from "../lib/updates/lastSeenUpdateId";

import type { ReactNode } from "react";

type MockUpdatesState = {
  isEnabled: boolean;
  isEmbeddedLaunch: boolean;
  isEmergencyLaunch: boolean;
  updateId: string | null;
};

// The state expo-updates reports, which a test changes. The mock reads it at call time.
const mockUpdatesState: MockUpdatesState = {
  isEnabled: true,
  isEmbeddedLaunch: false,
  isEmergencyLaunch: false,
  updateId: "update-new",
};

jest.mock("expo-updates", () => ({
  get isEnabled() {
    return mockUpdatesState.isEnabled;
  },
  get isEmbeddedLaunch() {
    return mockUpdatesState.isEmbeddedLaunch;
  },
  get isEmergencyLaunch() {
    return mockUpdatesState.isEmergencyLaunch;
  },
  get updateId() {
    return mockUpdatesState.updateId;
  },
}));

// The phone's small store, held in memory. A test can make a read or a write fail.
const mockStore = new Map<string, string>();
const mockStoreFailures = { read: false, write: false };

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: (key: string) =>
      mockStoreFailures.read
        ? Promise.reject(new Error("read failed"))
        : Promise.resolve(mockStore.get(key) ?? null),
    setItem: (key: string, value: string) => {
      if (mockStoreFailures.write) {
        return Promise.reject(new Error("write failed"));
      }
      mockStore.set(key, value);

      return Promise.resolve();
    },
  },
}));
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);

// React Native declares the flag as a constant, so Jest's own global is set by name.
function setDevelopmentFlag(isDevelopment: boolean) {
  Reflect.set(globalThis, "__DEV__", isDevelopment);
}

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <ToastProvider>{children}</ToastProvider>
    </ThemeProvider>
  );
}

function renderToastHook(isSplashScreenGone: boolean) {
  return renderHook(
    ({ isGone }: { isGone: boolean }) => {
      useUpdatedToast(isGone);
    },
    { wrapper: Wrapper, initialProps: { isGone: isSplashScreenGone } },
  );
}

// Lets the read and the write of the store finish.
function settleStore() {
  return act(() => Promise.resolve());
}

describe("useUpdatedToast", () => {
  beforeEach(() => {
    mockStore.clear();
    mockStoreFailures.read = false;
    mockStoreFailures.write = false;
    mockUpdatesState.isEnabled = true;
    mockUpdatesState.isEmbeddedLaunch = false;
    mockUpdatesState.isEmergencyLaunch = false;
    mockUpdatesState.updateId = "update-new";
    mockStore.set(lastSeenUpdateIdStorageKey, "update-old");
    // Jest runs with the development flag on, and a release build has it off.
    setDevelopmentFlag(false);
  });

  afterEach(() => {
    setDevelopmentFlag(true);
  });

  describe("when the app runs an update it has not run before", () => {
    it("should show the toast once the splash screen has gone", async () => {
      await renderToastHook(true);
      await settleStore();

      expect(await screen.findByRole("status")).toHaveTextContent(UPDATED_TOAST);
      expect(UPDATED_TOAST).toBe("Ki-Lo has been updated!");
    });

    it("should not show the toast while the splash screen is up", async () => {
      await renderToastHook(false);
      await settleStore();

      expect(screen.queryByRole("status")).not.toBeOnTheScreen();
      expect(mockStore.get(lastSeenUpdateIdStorageKey)).toBe("update-old");
    });

    it("should wait for the splash screen to go, and then show it", async () => {
      const { rerender } = await renderToastHook(false);
      await settleStore();

      await rerender({ isGone: true });
      await settleStore();

      expect(await screen.findByRole("status")).toHaveTextContent(UPDATED_TOAST);
    });

    it("should store the new update id", async () => {
      await renderToastHook(true);
      await settleStore();

      expect(mockStore.get(lastSeenUpdateIdStorageKey)).toBe("update-new");
    });

    it("should show the toast only once, however often the screen renders", async () => {
      const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility");
      // The preset already makes this a mock, which keeps the calls of the tests before.
      announce.mockClear();
      const { rerender } = await renderToastHook(true);
      await settleStore();
      await rerender({ isGone: true });
      await settleStore();

      expect(announce).toHaveBeenCalledTimes(1);
      expect(announce).toHaveBeenCalledWith(UPDATED_TOAST);
    });

    it("should show nothing the next time the app starts on the same update", async () => {
      const first = await renderToastHook(true);
      await settleStore();
      await first.unmount();

      await renderToastHook(true);
      await settleStore();

      expect(screen.queryByRole("status")).not.toBeOnTheScreen();
    });

    it("should still show the toast when the id cannot be stored", async () => {
      mockStoreFailures.write = true;

      await renderToastHook(true);
      await settleStore();

      expect(await screen.findByRole("status")).toHaveTextContent(UPDATED_TOAST);
    });
  });

  describe("when there is nothing to tell", () => {
    it("should show nothing on a first install, and store the id so the next update is told", async () => {
      mockStore.clear();

      await renderToastHook(true);
      await settleStore();

      expect(screen.queryByRole("status")).not.toBeOnTheScreen();
      expect(mockStore.get(lastSeenUpdateIdStorageKey)).toBe("update-new");
    });

    it("should show nothing when the update is the one already seen", async () => {
      mockStore.set(lastSeenUpdateIdStorageKey, "update-new");

      await renderToastHook(true);
      await settleStore();

      expect(screen.queryByRole("status")).not.toBeOnTheScreen();
    });

    it("should show nothing, and store nothing, when there is no update id", async () => {
      mockUpdatesState.updateId = null;

      await renderToastHook(true);
      await settleStore();

      expect(screen.queryByRole("status")).not.toBeOnTheScreen();
      expect(mockStore.get(lastSeenUpdateIdStorageKey)).toBe("update-old");
    });

    it("should show nothing on the bundle built into the app, and store its id so the first update is told", async () => {
      mockUpdatesState.isEmbeddedLaunch = true;
      mockUpdatesState.updateId = "update-embedded";

      await renderToastHook(true);
      await settleStore();

      expect(screen.queryByRole("status")).not.toBeOnTheScreen();
      expect(mockStore.get(lastSeenUpdateIdStorageKey)).toBe("update-embedded");
    });

    it("should show nothing in development, and store nothing", async () => {
      setDevelopmentFlag(true);

      await renderToastHook(true);
      await settleStore();

      expect(screen.queryByRole("status")).not.toBeOnTheScreen();
      expect(mockStore.get(lastSeenUpdateIdStorageKey)).toBe("update-old");
    });

    it("should show nothing, and store nothing, when updates are not enabled", async () => {
      mockUpdatesState.isEnabled = false;

      await renderToastHook(true);
      await settleStore();

      expect(screen.queryByRole("status")).not.toBeOnTheScreen();
      expect(mockStore.get(lastSeenUpdateIdStorageKey)).toBe("update-old");
    });

    it("should show nothing, and store nothing, after an emergency launch", async () => {
      mockUpdatesState.isEmergencyLaunch = true;

      await renderToastHook(true);
      await settleStore();

      expect(screen.queryByRole("status")).not.toBeOnTheScreen();
      expect(mockStore.get(lastSeenUpdateIdStorageKey)).toBe("update-old");
    });

    it("should show nothing, and store nothing, when the stored id cannot be read", async () => {
      mockStoreFailures.read = true;

      await renderToastHook(true);
      await settleStore();
      mockStoreFailures.read = false;

      expect(screen.queryByRole("status")).not.toBeOnTheScreen();
      expect(mockStore.get(lastSeenUpdateIdStorageKey)).toBe("update-old");
    });
  });
});
