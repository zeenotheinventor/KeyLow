import { act, render, screen } from "@testing-library/react-native";
import * as SplashScreen from "expo-splash-screen";
import { Text } from "react-native";

import RootLayout from "../app/_layout";
import { resetRouterMock } from "./support/expoRouterMock";
import { registerAppStyles } from "./support/nativeWindStyles";
import { resetSupabaseMock } from "./support/supabaseMock";
import { startOnLatestUpdate } from "../lib/updates";

import type { UpdateOutcome } from "../lib/updates";

// Metro compiles the stylesheet. Jest cannot read it.
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

  return (outcome: UpdateOutcome) =>
    act(() => {
      settle(outcome);
      return Promise.resolve();
    });
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
    const settleCheck = holdCheckOpen();
    await render(<RootLayout />);
    await screen.findByText("Screens");

    await settleCheck("up-to-date");

    expect(hideSplashScreen).toHaveBeenCalledTimes(1);
  });
});
