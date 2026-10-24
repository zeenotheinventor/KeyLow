import "./support/gestureHandler";

import { UPDATED_TOAST } from "@keylow/core/copy";
import { act, render, screen } from "@testing-library/react-native";
import * as SplashScreen from "expo-splash-screen";
import { Text } from "react-native";

import RootLayout from "../app/_layout";
import { resetRouterMock } from "./support/expoRouterMock";
import { registerAppStyles } from "./support/nativeWindStyles";
import { resetSupabaseMock } from "./support/supabaseMock";
import { startOnLatestUpdate } from "../lib/updates";

import type { UpdateCallbacks, UpdateOutcome } from "../lib/updates";

// Metro compiles the stylesheet. Jest cannot read it.
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);
jest.mock("../global.css", () => ({}));
// The phone's store has seen an older update, so the app starting on a new one has something to say.
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: (key: string) => Promise.resolve(key === "updates.lastSeenId" ? "update-old" : null),
    setItem: () => Promise.resolve(),
  },
}));
jest.mock("expo-updates", () => ({
  isEnabled: true,
  isEmbeddedLaunch: false,
  isEmergencyLaunch: false,
  updateId: "update-new",
}));
jest.mock("expo-status-bar", () => ({ StatusBar: () => null }));
jest.mock("expo-splash-screen", () => ({
  preventAutoHideAsync: jest.fn(() => Promise.resolve(true)),
  hideAsync: jest.fn(() => Promise.resolve()),
}));
jest.mock("../lib/updates/startOnLatestUpdate", () => ({ startOnLatestUpdate: jest.fn() }));
// The navigator and the screens in it, which draw one line to show the app is on screen.
function MockStack() {
  return <Text>Screens</Text>;
}
MockStack.Screen = function MockScreen() {
  return null;
};

jest.mock("expo-router", () => ({
  ...jest.requireActual<{ mockExpoRouter: object }>("./support/expoRouterMock").mockExpoRouter,
  Stack: MockStack,
}));
jest.mock("../lib/supabase", () => ({
  supabase: jest.requireActual<{ mockSupabaseClient: unknown }>("./support/supabaseMock")
    .mockSupabaseClient,
}));

// Counted as the layout module loads, before any test clears the mock.
const holdsWhenLayoutLoaded = jest.mocked(SplashScreen.preventAutoHideAsync).mock.calls.length;
const hideSplashScreen = jest.mocked(SplashScreen.hideAsync);

function holdCheckOpen() {
  let settle: (outcome: UpdateOutcome) => void = () => {};
  jest.mocked(startOnLatestUpdate).mockReturnValue(
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
    // What the layout's hook handed to the check, called as the update goes.
    callbacks: (): UpdateCallbacks => jest.mocked(startOnLatestUpdate).mock.lastCall?.[0] ?? {},
  };
}

describe("the splash screen and the update check", () => {
  beforeEach(() => {
    hideSplashScreen.mockClear();
    registerAppStyles("");
    resetRouterMock();
    resetSupabaseMock();
  });

  it("should be held by the root layout, so the router does not hide it first", () => {
    expect(holdsWhenLayoutLoaded).toBe(1);
  });

  it("should stay up while the check runs, with the app ready behind it", async () => {
    holdCheckOpen();

    await render(<RootLayout />);

    expect(await screen.findByText("Screens")).toBeOnTheScreen();
    expect(hideSplashScreen).not.toHaveBeenCalled();
  });

  it("should hide once the check settles", async () => {
    const { settleCheck } = holdCheckOpen();
    await render(<RootLayout />);
    await screen.findByText("Screens");

    await settleCheck("up-to-date");

    expect(hideSplashScreen).toHaveBeenCalledTimes(1);
  });

  describe("when an update is found", () => {
    async function renderWithUpdateFound() {
      const check = holdCheckOpen();
      await render(<RootLayout />);
      await screen.findByText("Screens");
      await act(() => {
        check.callbacks().onUpdateFound?.();
        return Promise.resolve();
      });

      return check;
    }

    it("should draw nothing but the app behind the splash screen, with no progress bar and no update screen", async () => {
      await renderWithUpdateFound();

      expect(screen.queryByRole("progressbar")).not.toBeOnTheScreen();
      expect(screen.queryByTestId("update-screen")).not.toBeOnTheScreen();
      expect(screen.getByText("Screens")).toBeOnTheScreen();
    });

    it("should keep the splash screen up for the whole download", async () => {
      await renderWithUpdateFound();

      expect(hideSplashScreen).not.toHaveBeenCalled();
    });

    it.each<UpdateOutcome>(["stalled", "failed"])(
      "should hide the splash screen and carry on with the app when the update ends as %s",
      async (outcome) => {
        const { settleCheck } = await renderWithUpdateFound();

        await settleCheck(outcome);

        expect(screen.queryByRole("progressbar")).not.toBeOnTheScreen();
        expect(screen.getByText("Screens")).toBeOnTheScreen();
        expect(hideSplashScreen).toHaveBeenCalledTimes(1);
      },
    );

    it("should keep the splash screen up while the app reloads", async () => {
      const { settleCheck } = await renderWithUpdateFound();

      await settleCheck("reloading");

      expect(hideSplashScreen).not.toHaveBeenCalled();
    });
  });

  describe("the toast that says the app has been updated", () => {
    // A release build has the development flag off, and the toast is not shown without it.
    beforeEach(() => {
      Reflect.set(globalThis, "__DEV__", false);
    });

    afterEach(() => {
      Reflect.set(globalThis, "__DEV__", true);
    });

    it("should not show while the splash screen is up, and show once it has gone", async () => {
      const { settleCheck } = holdCheckOpen();
      await render(<RootLayout />);
      await screen.findByText("Screens");

      expect(screen.queryByRole("status")).not.toBeOnTheScreen();
      await settleCheck("up-to-date");

      expect(await screen.findByRole("status")).toHaveTextContent(UPDATED_TOAST);
    });
  });
});
