import { act, render, screen, userEvent } from "@testing-library/react-native";
import { ExpoRoot, router } from "expo-router";
import { getMockContext } from "expo-router/testing-library";
import { Text } from "react-native";

import { resetApiClientMock } from "./foods/support/apiClientMock";
import { resetSearchApiClientMock } from "./foods/support/searchApiClientMock";
import { fakeSession, mockSupabaseClient, resetSupabaseMock } from "./support/supabaseMock";
import TabsLayout from "../app/(tabs)/_layout";
import DashboardRoute from "../app/(tabs)/dashboard";
import DiaryRoute from "../app/(tabs)/diary";
import MoreRoute from "../app/(tabs)/more";
import RecipesRoute from "../app/(tabs)/recipes";
import SettingsRoute from "../app/(tabs)/settings";
import WeightRoute from "../app/(tabs)/weight";
import RootLayout from "../app/_layout";
import FoodsLayout from "../app/foods/_layout";
import FoodSearchRoute from "../app/foods/index";
import IndexRoute from "../app/index";

import type { ComponentType } from "react";

// The real root layout, tab layout, foods layout and tab screens are navigated by the real router, with the
// kit's tab bar in it. The screens the sheet opens are stand-ins, because this test is about the shell.
jest.mock("../global.css", () => ({}));
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock("../lib/supabase", () => ({
  supabase: jest.requireActual<{ mockSupabaseClient: unknown }>("./support/supabaseMock")
    .mockSupabaseClient,
}));
jest.mock(
  "@keylow/api-client",
  () =>
    jest.requireActual<{ mockSearchApiClient: unknown }>("./foods/support/searchApiClientMock")
      .mockSearchApiClient,
);
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);
jest.mock("expo-status-bar", () => {
  const { Text: StatusText } = jest.requireActual<{ Text: ComponentType<{ children: string }> }>(
    "react-native",
  );

  return { StatusBar: () => <StatusText>Status bar</StatusText> };
});

const standIn = (text: string) =>
  function StandIn() {
    return <Text>{text}</Text>;
  };

const routes = {
  _layout: RootLayout,
  index: IndexRoute,
  "(auth)/sign-in": standIn("Sign in screen"),
  "(tabs)/_layout": TabsLayout,
  "(tabs)/dashboard": DashboardRoute,
  "(tabs)/diary": DiaryRoute,
  "(tabs)/recipes": RecipesRoute,
  "(tabs)/more": MoreRoute,
  "(tabs)/weight": WeightRoute,
  "(tabs)/settings": SettingsRoute,
  "foods/_layout": FoodsLayout,
  "foods/index": FoodSearchRoute,
  "foods/new": standIn("New food screen"),
  "foods/scan": standIn("Scan screen"),
  "foods/[id]/index": standIn("Food screen"),
  "foods/[id]/edit": standIn("Edit food screen"),
};

async function renderApp(location: string) {
  await render(<ExpoRoot context={getMockContext(routes)} location={location} />);
}

// What React Navigation does when the Android back key is pressed. The device run presses the real key.
async function goBack() {
  await act(() => {
    router.back();
  });
}

const tabNames = ["Dashboard", "Diary", "Recipes", "More"];
const launcher = () => screen.queryByRole("button", { name: "Search for a food" });
const sheetHeading = () => screen.queryByRole("heading", { name: "Find food" });
const selectedTabs = (options: { hidden?: boolean } = {}) =>
  screen.queryAllByRole("tab", { selected: true, ...options });

describe("the tab shell", () => {
  beforeEach(() => {
    resetSupabaseMock();
    resetApiClientMock();
    resetSearchApiClientMock();
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: fakeSession },
      error: null,
    });
  });

  describe("the tab bar", () => {
    it("should draw Dashboard, Diary, Recipes and More in that order, and nothing else", async () => {
      await renderApp("/dashboard");

      const tabs = await screen.findAllByRole("tab");
      expect(tabs).toHaveLength(4);
      expect(tabNames.map((name) => tabs.indexOf(screen.getByRole("tab", { name })))).toEqual([
        0, 1, 2, 3,
      ]);
    });

    it("should be named Main for a screen reader", async () => {
      await renderApp("/dashboard");

      expect(await screen.findByLabelText("Main")).toHaveProp("role", "tablist");
    });

    it.each(tabNames)("should select %s, and only it, when that screen is open", async (name) => {
      await renderApp(`/${name.toLowerCase()}`);

      expect(await screen.findByRole("tab", { name, selected: true })).toBeOnTheScreen();
      expect(selectedTabs()).toHaveLength(1);
    });

    it.each(tabNames)("should open %s when its tab is pressed", async (name) => {
      const user = userEvent.setup();
      await renderApp("/dashboard");

      await user.press(await screen.findByRole("tab", { name }));

      expect(await screen.findByRole("heading", { name })).toBeOnTheScreen();
      expect(screen.getByRole("tab", { name, selected: true })).toBeOnTheScreen();
    });

    it("should draw no tab for the weight and settings screens, which More links to", async () => {
      await renderApp("/settings");

      expect(await screen.findByRole("button", { name: "Sign out" })).toBeOnTheScreen();
      expect(screen.getAllByRole("tab")).toHaveLength(4);
      expect(screen.queryByRole("tab", { name: /settings|weight/i })).not.toBeOnTheScreen();
    });
  });

  describe("the centre plus", () => {
    it("should be a button named Find food, which is not a tab", async () => {
      await renderApp("/dashboard");

      expect(await screen.findByRole("button", { name: "Find food" })).toBeOnTheScreen();
      expect(screen.queryByRole("tab", { name: "Find food" })).not.toBeOnTheScreen();
    });

    it.each(tabNames)(
      "should open the search sheet from %s without changing the selected tab",
      async (name) => {
        const user = userEvent.setup();
        await renderApp(`/${name.toLowerCase()}`);

        await user.press(await screen.findByRole("button", { name: "Find food" }));

        expect(await screen.findByRole("heading", { name: "Find food" })).toBeOnTheScreen();
        // The tabs are under the sheet now, so the screen reader is not offered them.
        expect(screen.getByRole("tab", { name, selected: true, hidden: true })).toBeOnTheScreen();
        expect(selectedTabs({ hidden: true })).toHaveLength(1);
      },
    );

    it("should close the sheet back to the tab it was opened from", async () => {
      const user = userEvent.setup();
      await renderApp("/diary");
      await user.press(await screen.findByRole("button", { name: "Find food" }));

      await user.press(await screen.findByRole("button", { name: "Close" }));

      expect(await screen.findByRole("heading", { name: "Diary" })).toBeOnTheScreen();
      expect(screen.getByRole("tab", { name: "Diary", selected: true })).toBeOnTheScreen();
      expect(sheetHeading()).not.toBeOnTheScreen();
    });

    it("should close the sheet back to the tab on the back key", async () => {
      const user = userEvent.setup();
      await renderApp("/recipes");
      await user.press(await screen.findByRole("button", { name: "Find food" }));
      expect(await screen.findByRole("heading", { name: "Find food" })).toBeOnTheScreen();

      await goBack();

      expect(await screen.findByRole("heading", { name: "Recipes" })).toBeOnTheScreen();
      expect(screen.getByRole("tab", { name: "Recipes", selected: true })).toBeOnTheScreen();
    });
  });

  describe("the search launcher", () => {
    it.each(["dashboard", "diary"])("should show on %s", async (route) => {
      await renderApp(`/${route}`);

      expect(await screen.findByRole("button", { name: "Search for a food" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Scan barcode" })).toBeOnTheScreen();
    });

    it.each(["recipes", "more", "settings", "weight"])("should not show on %s", async (route) => {
      await renderApp(`/${route}`);

      expect(await screen.findByLabelText("Main")).toBeOnTheScreen();
      expect(launcher()).not.toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Scan barcode" })).not.toBeOnTheScreen();
    });

    it("should come and go as the tab changes", async () => {
      const user = userEvent.setup();
      await renderApp("/dashboard");
      expect(await screen.findByRole("button", { name: "Search for a food" })).toBeOnTheScreen();

      await user.press(screen.getByRole("tab", { name: "Recipes" }));
      expect(launcher()).not.toBeOnTheScreen();

      await user.press(screen.getByRole("tab", { name: "Diary" }));
      expect(await screen.findByRole("button", { name: "Search for a food" })).toBeOnTheScreen();
    });

    it("should open the search sheet, and the sheet should close back to the tab", async () => {
      const user = userEvent.setup();
      await renderApp("/dashboard");

      await user.press(await screen.findByRole("button", { name: "Search for a food" }));
      expect(await screen.findByRole("heading", { name: "Find food" })).toBeOnTheScreen();
      await user.press(screen.getByRole("button", { name: "Close" }));

      expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeOnTheScreen();
      expect(screen.getByRole("tab", { name: "Dashboard", selected: true })).toBeOnTheScreen();
    });

    it("should open the scanner from its barcode control, and go back to the tab from there", async () => {
      const user = userEvent.setup();
      await renderApp("/diary");

      await user.press(await screen.findByRole("button", { name: "Scan barcode" }));
      expect(await screen.findByText("Scan screen")).toBeOnTheScreen();
      await goBack();

      expect(await screen.findByRole("heading", { name: "Diary" })).toBeOnTheScreen();
      expect(screen.queryByText("Scan screen")).not.toBeOnTheScreen();
    });
  });

  describe("the screens inside the sheet", () => {
    it.each([
      ["/foods/new", "New food screen"],
      ["/foods/scan", "Scan screen"],
      ["/foods/abc", "Food screen"],
      ["/foods/abc/edit", "Edit food screen"],
    ])("should still open %s over the tabs", async (path, text) => {
      await renderApp("/diary");

      await act(() => {
        router.push(path);
      });

      expect(await screen.findByText(text)).toBeOnTheScreen();
    });
  });

  describe("the placeholders", () => {
    it.each([
      ["dashboard", "Your weekly nutrition, weight trend and expenditure will appear here."],
      ["diary", "Your logged foods will appear here, day by day."],
      ["recipes", "Your recipes will appear here."],
    ])("should say what %s will show, under Coming soon", async (route, body) => {
      await renderApp(`/${route}`);

      expect(await screen.findByRole("heading", { name: "Coming soon" })).toBeOnTheScreen();
      expect(screen.getByText(body)).toBeOnTheScreen();
    });

    it("should leave the diary with no Find food button of its own, since the launcher replaces it", async () => {
      await renderApp("/diary");

      await screen.findByRole("heading", { name: "Coming soon" });
      // The one button of that name is the centre plus.
      expect(screen.getAllByRole("button", { name: "Find food" })).toHaveLength(1);
    });
  });

  describe("More", () => {
    it("should open Weight and Settings from its rows", async () => {
      const user = userEvent.setup();
      await renderApp("/more");

      await user.press(await screen.findByRole("button", { name: "Weight" }));
      expect(await screen.findByRole("heading", { name: "Weight" })).toBeOnTheScreen();

      await goBack();
      await user.press(await screen.findByRole("button", { name: "Settings" }));
      expect(await screen.findByRole("heading", { name: "Settings" })).toBeOnTheScreen();
    });

    it("should keep Sign out reachable, and sign the user out", async () => {
      const user = userEvent.setup();
      await renderApp("/more");

      await user.press(await screen.findByRole("button", { name: "Settings" }));
      await user.press(await screen.findByRole("button", { name: "Sign out" }));

      expect(mockSupabaseClient.auth.signOut).toHaveBeenCalledTimes(1);
    });

    it("should go back from Settings to More", async () => {
      const user = userEvent.setup();
      await renderApp("/more");
      await user.press(await screen.findByRole("button", { name: "Settings" }));
      expect(await screen.findByRole("heading", { name: "Settings" })).toBeOnTheScreen();

      await goBack();

      expect(await screen.findByRole("tab", { name: "More", selected: true })).toBeOnTheScreen();
    });
  });

  describe("where the app opens", () => {
    it("should open on the dashboard from the root", async () => {
      await renderApp("/");

      expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeOnTheScreen();
      expect(screen.getByRole("tab", { name: "Dashboard", selected: true })).toBeOnTheScreen();
    });

    it("should open on the dashboard when a signed-in user is on the sign-in screen", async () => {
      await renderApp("/sign-in");

      expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeOnTheScreen();
      expect(screen.queryByText("Sign in screen")).not.toBeOnTheScreen();
    });
  });
});
