import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, render, screen, userEvent } from "@testing-library/react-native";
import { Text } from "react-native";

import RootLayout, { ErrorBoundary } from "../app/_layout";
import { RootErrorScreen } from "../components/RootErrorScreen";
import { useToast } from "../components/ui";
import { startBodyFigureRead } from "../lib/bodyFigure";
import { feedFocusManager } from "../lib/connectivity";
import { resetRouterMock } from "./support/expoRouterMock";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import { resetSupabaseMock } from "./support/supabaseMock";
import { DIARY_CACHE_STORAGE_KEY } from "../lib/diaryCache/constants";
import { initSentry } from "../lib/sentry/init";

import type { ReactNode } from "react";

// Metro compiles the stylesheet. Jest cannot read it.
jest.mock("../global.css", () => ({}));
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: () => Promise.resolve(),
    removeItem: () => Promise.resolve(),
  },
}));
jest.mock("expo-status-bar", () => ({ StatusBar: () => null }));
jest.mock("react-native-gesture-handler", () => {
  const { View: GestureView } = jest.requireActual<typeof import("react-native")>("react-native");

  return {
    // Marks where the gesture root is, which draws nothing of its own.
    GestureHandlerRootView: ({ children }: { children: ReactNode }) => (
      <GestureView accessible aria-label="Gesture root">
        {children}
      </GestureView>
    ),
  };
});
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);

// Stands for the navigator and for a screen in it, which shows a toast when asked.
function ScreenThatShowsAToast() {
  const toast = useToast();

  return (
    <Text
      role="button"
      onPress={() => {
        toast.show({ message: "Targets saved" });
      }}
    >
      Show toast
    </Text>
  );
}
function MockStack() {
  return <ScreenThatShowsAToast />;
}
MockStack.Screen = function MockScreen() {
  return null;
};

jest.mock("expo-router", () => ({
  ...jest.requireActual<{ mockExpoRouter: object }>("./support/expoRouterMock").mockExpoRouter,
  Stack: MockStack,
}));
// Whether the layout turns it on is what is asked. What it does once on is proved with the connectivity tests.
jest.mock("../lib/connectivity", () => ({
  ...jest.requireActual<typeof import("../lib/connectivity")>("../lib/connectivity"),
  feedFocusManager: jest.fn(),
}));
// Whether the layout starts reading the figure setting is what is asked. What it reads is proved with the figure tests.
jest.mock("../lib/bodyFigure", () => ({
  ...jest.requireActual<typeof import("../lib/bodyFigure")>("../lib/bodyFigure"),
  startBodyFigureRead: jest.fn(),
}));
// Whether the layout starts Sentry is what is asked. What it starts with is proved with the Sentry tests.
jest.mock("../lib/sentry/init", () => ({ initSentry: jest.fn() }));
jest.mock("../lib/supabase", () => ({
  supabase: jest.requireActual<{ mockSupabaseClient: unknown }>("./support/supabaseMock")
    .mockSupabaseClient,
}));

describe("the app root", () => {
  let styles: string;

  beforeAll(async () => {
    styles = await compileKitStyles("", ["components/RootNavigator"]);
  });

  beforeEach(() => {
    registerAppStyles(styles);
    resetRouterMock();
    resetSupabaseMock();
  });

  it("should export the root error screen as the layout's error boundary, so a failing route shows it", () => {
    expect(ErrorBoundary).toBe(RootErrorScreen);
  });

  it("should tell React Query when the app is in the foreground, as the layout loads, so a stale diary refetches on return", () => {
    expect(feedFocusManager).toHaveBeenCalledTimes(1);
  });

  it("should start reading the figure setting as the layout loads, so a screen finds it read", () => {
    expect(startBodyFigureRead).toHaveBeenCalledTimes(1);
  });

  it("should start error reporting as the layout loads, so an error while the app starts is reported", () => {
    expect(initSentry).toHaveBeenCalledTimes(1);
  });

  it("should show a toast that a screen asks for, because the toast provider is mounted", async () => {
    const user = userEvent.setup();
    await render(<RootLayout />);

    await user.press(await screen.findByRole("button", { name: "Show toast" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Targets saved");
  });

  it("should read the stored diary cache, so the screens find it", async () => {
    await render(<RootLayout />);

    await screen.findByRole("button", { name: "Show toast" });

    expect(AsyncStorage.getItem).toHaveBeenCalledWith(DIARY_CACHE_STORAGE_KEY);
  });

  it("should put the screens inside the gesture root, so a drag on a sheet is heard", async () => {
    await render(<RootLayout />);

    const screenButton = await screen.findByRole("button", { name: "Show toast" });

    expect(screen.getByLabelText("Gesture root")).toContainElement(screenButton);
  });

  it("should let the toast go after its wait", async () => {
    jest.useFakeTimers();
    try {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      await render(<RootLayout />);
      await user.press(await screen.findByRole("button", { name: "Show toast" }));
      expect(await screen.findByRole("status")).toBeOnTheScreen();

      await act(async () => {
        await jest.advanceTimersByTimeAsync(5000);
      });

      expect(screen.queryByRole("status")).not.toBeOnTheScreen();
    } finally {
      jest.useRealTimers();
    }
  });
});
