import "./support/gestureHandler";

import { UPDATING_LABEL } from "@keylow/core/copy";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
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
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
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
    const updateScreen = () => screen.getByTestId("update-screen");

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

    it("should show the update screen, and keep the splash screen until it has been laid out", async () => {
      await renderWithUpdateFound();

      expect(screen.getByRole("progressbar", { name: UPDATING_LABEL })).toBeOnTheScreen();
      expect(hideSplashScreen).not.toHaveBeenCalled();
    });

    it("should hide the screens behind the update screen from a screen reader, and show them again after", async () => {
      const { settleCheck } = await renderWithUpdateFound();

      expect(screen.queryByText("Screens")).not.toBeOnTheScreen();
      expect(screen.getByText("Screens", { includeHiddenElements: true })).toBeOnTheScreen();

      await settleCheck("stalled");

      expect(screen.getByText("Screens")).toBeOnTheScreen();
    });

    it("should hide the splash screen once the update screen has been laid out", async () => {
      await renderWithUpdateFound();

      await fireEvent(updateScreen(), "layout", {
        nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 844 } },
      });

      expect(hideSplashScreen).toHaveBeenCalledTimes(1);
    });

    it("should follow the download with the bar", async () => {
      const { callbacks } = await renderWithUpdateFound();

      await act(() => {
        callbacks().onProgress?.(0.4);
        return Promise.resolve();
      });

      expect(screen.getByRole("progressbar", { name: UPDATING_LABEL })).toHaveAccessibilityValue({
        now: 40,
      });
    });

    it.each<UpdateOutcome>(["stalled", "failed"])(
      "should remove the update screen and carry on with the app when the update ends as %s",
      async (outcome) => {
        const { settleCheck } = await renderWithUpdateFound();

        await settleCheck(outcome);

        expect(screen.queryByRole("progressbar")).not.toBeOnTheScreen();
        expect(screen.getByText("Screens")).toBeOnTheScreen();
        expect(hideSplashScreen).toHaveBeenCalledTimes(1);
      },
    );

    it("should keep the update screen and the splash screen's hand-off while the app reloads", async () => {
      const { settleCheck } = await renderWithUpdateFound();
      await fireEvent(updateScreen(), "layout", {
        nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 844 } },
      });

      await settleCheck("reloading");

      expect(screen.getByRole("progressbar", { name: UPDATING_LABEL })).toBeOnTheScreen();
      expect(hideSplashScreen).toHaveBeenCalledTimes(1);
    });
  });
});
