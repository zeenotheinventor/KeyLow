import { tabBarHeight } from "@keylow/tokens";
import { onlineManager } from "@tanstack/react-query";
import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native";
import { ExpoRoot, Slot, useLocalSearchParams } from "expo-router";
import { getMockContext } from "expo-router/testing-library";
import { useEffect } from "react";
import { Pressable, Text } from "react-native";

import TabsLayout from "../app/(tabs)/_layout";
import { ToastProvider, useToast } from "../components/ui";
import { ThemeProvider } from "../lib/theme";
import { setViewedDay } from "../lib/viewedDay";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);

function Providers() {
  return (
    <ThemeProvider fixedPreference="dark">
      <ToastProvider>
        <Slot />
      </ToastProvider>
    </ThemeProvider>
  );
}

// The diary tells the tab bar which day it shows, as the real one does once it knows its zone.
function DiaryStandIn() {
  useEffect(() => {
    setViewedDay("2026-10-14");

    return () => {
      setViewedDay(null);
    };
  }, []);

  return (
    <>
      <Text role="heading">Diary</Text>
      <RaiseToast />
    </>
  );
}

// A screen above the tabs raises a toast, as the portion picker does when it saves and goes back.
function RaiseToast() {
  const { show } = useToast();

  return (
    <Pressable
      role="button"
      onPress={() => {
        show({ message: "Entry deleted" });
      }}
    >
      <Text>Raise a toast</Text>
    </Pressable>
  );
}

function SearchStandIn() {
  const { day, time } = useLocalSearchParams<{ day?: string; time?: string }>();

  return <Text>{`Search sheet day=${day ?? "none"} time=${time ?? "none"}`}</Text>;
}

const standIn = (text: string) =>
  function StandIn() {
    return <Text role="heading">{text}</Text>;
  };

function MoreStandIn() {
  return (
    <>
      <Text role="heading">More screen</Text>
      <RaiseToast />
    </>
  );
}

const routes = {
  _layout: Providers,
  "(tabs)/_layout": TabsLayout,
  "(tabs)/dashboard": standIn("Dashboard screen"),
  "(tabs)/diary": DiaryStandIn,
  "(tabs)/recipes": standIn("Recipes screen"),
  "(tabs)/more": MoreStandIn,
  "foods/index": SearchStandIn,
  "foods/scan": standIn("Scan screen"),
};

async function renderApp(location: string) {
  await render(<ExpoRoot context={getMockContext(routes)} location={location} />);
}

describe("the tab bar's routes into food search", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
  });

  afterEach(async () => {
    await act(() => {
      onlineManager.setOnline(true);
    });
  });

  it("should open search for the day on view from the centre plus on the diary", async () => {
    const user = userEvent.setup();
    await renderApp("/diary");

    await user.press(await screen.findByRole("button", { name: "Find food" }));

    expect(await screen.findByText("Search sheet day=2026-10-14 time=none")).toBeOnTheScreen();
  });

  it("should open search for the day on view from the search dock on the diary, with no time", async () => {
    const user = userEvent.setup();
    await renderApp("/diary");

    await user.press(await screen.findByRole("button", { name: "Search for a food" }));

    expect(await screen.findByText("Search sheet day=2026-10-14 time=none")).toBeOnTheScreen();
  });

  it("should open the plain search from the centre plus on any other tab, which means now", async () => {
    const user = userEvent.setup();
    await renderApp("/dashboard");

    await user.press(await screen.findByRole("button", { name: "Find food" }));

    expect(await screen.findByText("Search sheet day=none time=none")).toBeOnTheScreen();
  });

  it("should open the plain search from the centre plus on More, even after the diary was on view", async () => {
    const user = userEvent.setup();
    await renderApp("/diary");
    await user.press(await screen.findByRole("tab", { name: "More" }));
    await screen.findByRole("heading", { name: "More screen" });

    await user.press(screen.getByRole("button", { name: "Find food" }));

    expect(await screen.findByText("Search sheet day=none time=none")).toBeOnTheScreen();
  });

  describe("offline", () => {
    it("should dim and disable the centre plus and the search dock, and open nothing", async () => {
      const user = userEvent.setup();
      await renderApp("/diary");
      await screen.findByRole("heading", { name: "Diary" });
      await act(() => {
        onlineManager.setOnline(false);
      });

      const plus = screen.getByRole("button", { name: "Find food" });
      const dock = screen.getByRole("button", { name: "Search for a food" });
      await user.press(plus);
      await user.press(dock);

      expect(plus).toBeDisabled();
      expect(dock).toBeDisabled();
      expect(screen.queryByText(/^Search sheet/)).not.toBeOnTheScreen();
      expect(screen.getByRole("heading", { name: "Diary" })).toBeOnTheScreen();
    });
  });

  describe("the toast clearance", () => {
    // The dock is 57 points on the board. The tab bar measures it, so no number is written in the app.
    const dockHeight = 57;
    const clearedBottom = tabBarHeight + 12 + dockHeight;

    async function measureDock() {
      await fireEvent(screen.getByRole("button", { name: "Search for a food" }), "layout", {
        nativeEvent: { layout: { x: 0, y: 0, width: 390, height: dockHeight } },
      });
    }

    it("should raise a toast above the search dock by the dock's measured height on the diary", async () => {
      const user = userEvent.setup();
      await renderApp("/diary");
      await screen.findByRole("button", { name: "Search for a food" });
      await measureDock();

      await user.press(screen.getByRole("button", { name: "Raise a toast" }));

      expect(screen.getByTestId("toast")).toHaveStyle({ bottom: clearedBottom });
    });

    it("should raise it on the dashboard too, which has the dock", async () => {
      const user = userEvent.setup();
      await renderApp("/dashboard");
      await screen.findByRole("button", { name: "Search for a food" });
      await measureDock();
      await user.press(await screen.findByRole("tab", { name: "Diary" }));
      await user.press(await screen.findByRole("button", { name: "Raise a toast" }));

      expect(screen.getByTestId("toast")).toHaveStyle({ bottom: clearedBottom });
    });

    it("should leave a toast at the default height on a tab with no dock", async () => {
      const user = userEvent.setup();
      await renderApp("/diary");
      await screen.findByRole("button", { name: "Search for a food" });
      await measureDock();
      await user.press(screen.getByRole("tab", { name: "More" }));
      await screen.findByRole("heading", { name: "More screen" });

      await user.press(screen.getByRole("button", { name: "Raise a toast" }));

      expect(screen.getByTestId("toast")).toHaveStyle({ bottom: tabBarHeight + 12 });
    });

    it("should leave a toast at the default height until the dock has been measured", async () => {
      const user = userEvent.setup();
      await renderApp("/diary");
      await screen.findByRole("button", { name: "Search for a food" });

      await user.press(screen.getByRole("button", { name: "Raise a toast" }));

      expect(screen.getByTestId("toast")).toHaveStyle({ bottom: tabBarHeight + 12 });
    });
  });
});
