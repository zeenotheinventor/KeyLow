import { onlineManager } from "@tanstack/react-query";
import { act, render, screen, userEvent } from "@testing-library/react-native";
import { ExpoRoot, Slot, useLocalSearchParams } from "expo-router";
import { getMockContext } from "expo-router/testing-library";
import { useEffect } from "react";
import { Text } from "react-native";

import TabsLayout from "../app/(tabs)/_layout";
import { ThemeProvider } from "../lib/theme";
import { setViewedDay } from "../lib/viewedDay";

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
      <Slot />
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

  return <Text role="heading">Diary</Text>;
}

function SearchStandIn() {
  const { day, time } = useLocalSearchParams<{ day?: string; time?: string }>();

  return <Text>{`Search sheet day=${day ?? "none"} time=${time ?? "none"}`}</Text>;
}

const standIn = (text: string) =>
  function StandIn() {
    return <Text role="heading">{text}</Text>;
  };

const routes = {
  _layout: Providers,
  "(tabs)/_layout": TabsLayout,
  "(tabs)/dashboard": standIn("Dashboard screen"),
  "(tabs)/diary": DiaryStandIn,
  "(tabs)/recipes": standIn("Recipes screen"),
  "(tabs)/more": standIn("More screen"),
  "foods/index": SearchStandIn,
  "foods/scan": standIn("Scan screen"),
};

async function renderApp(location: string) {
  await render(<ExpoRoot context={getMockContext(routes)} location={location} />);
}

describe("the tab bar's routes into food search", () => {
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
});
