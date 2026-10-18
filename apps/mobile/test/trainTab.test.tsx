import { TAB_TITLES, TRAIN_HOME } from "@keylow/core/copy";
import { render, screen } from "@testing-library/react-native";
import { ExpoRoot, Slot } from "expo-router";
import { Tabs } from "expo-router/js-tabs";
import { getMockContext } from "expo-router/testing-library";
import { Text } from "react-native";

import TabsLayout from "../app/(tabs)/_layout";
import TrainLayout from "../app/(tabs)/train/_layout";
import { MainTabBar } from "../components/MainTabBar";
import { ToastProvider, useTabTransitionOptions } from "../components/ui";
import { ThemeProvider } from "../lib/theme";
import { resetApiClientMock } from "./foods/support/apiClientMock";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
// Only the hooks the tab bar reads are replaced, as the other tab bar tests do.
jest.mock(
  "@keylow/api-client",
  () =>
    jest.requireActual<{ mockApiClient: unknown }>("./foods/support/apiClientMock").mockApiClient,
);
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

const standIn = (text: string) =>
  function StandIn() {
    return <Text role="heading">{text}</Text>;
  };

// The Train screen has its own tests. Here it is a heading, because these tests are about the tab bar.
const screens = {
  "(tabs)/dashboard": standIn("Dashboard screen"),
  "(tabs)/diary": standIn("Diary screen"),
  "(tabs)/recipes": standIn("Recipes screen"),
  "(tabs)/train/_layout": TrainLayout,
  "(tabs)/train/index": standIn("Train screen"),
  "(tabs)/more": standIn("More screen"),
};

// The app's tabs layout with the Train tab given an href, which is what the ticket that shows the loop does.
function TabsLayoutWithTrainShown() {
  const transition = useTabTransitionOptions();

  return (
    <Tabs
      screenOptions={{ headerShown: false, ...transition }}
      tabBar={(props) => <MainTabBar {...props} />}
    >
      <Tabs.Screen name="dashboard" options={{ title: TAB_TITLES.dashboard }} />
      <Tabs.Screen name="diary" options={{ title: TAB_TITLES.diary }} />
      <Tabs.Screen name="recipes" options={{ title: TAB_TITLES.recipes }} />
      <Tabs.Screen name="train" options={{ title: TRAIN_HOME.tabLabel }} />
      <Tabs.Screen name="more" options={{ title: TAB_TITLES.more }} />
    </Tabs>
  );
}

async function renderApp(layout: () => React.JSX.Element, location: string) {
  await render(
    <ExpoRoot
      context={getMockContext({ _layout: Providers, "(tabs)/_layout": layout, ...screens })}
      location={location}
    />,
  );
}

describe("the Train tab in the tab shell", () => {
  beforeEach(() => {
    resetApiClientMock();
  });

  describe("while it is hidden, as the app registers it", () => {
    it("should leave the bar as it was: four labelled tabs and the plus", async () => {
      await renderApp(TabsLayout, "/dashboard");
      await screen.findByRole("heading", { name: "Dashboard screen" });

      const tabs = screen.getAllByRole("tab");
      expect(tabs).toHaveLength(4);
      expect(
        ["Dashboard", "Diary", "Recipes", "More"].map((name) =>
          tabs.indexOf(screen.getByRole("tab", { name })),
        ),
      ).toEqual([0, 1, 2, 3]);
      expect(screen.getByRole("button", { name: "Find food" })).toBeOnTheScreen();
    });

    it("should draw no Train tab", async () => {
      await renderApp(TabsLayout, "/dashboard");
      await screen.findByRole("heading", { name: "Dashboard screen" });

      expect(screen.queryByRole("tab", { name: /train/i })).not.toBeOnTheScreen();
    });
  });

  describe("once it has an href", () => {
    it("should show five labelled destinations and the plus, with Train between Recipes and More", async () => {
      await renderApp(TabsLayoutWithTrainShown, "/train");
      await screen.findByRole("heading", { name: "Train screen" });

      const controls = screen.getAllByRole(/^(tab|button)$/);
      const order = ["Dashboard", "Diary", "Find food", "Recipes", "Train", "More"].map((name) =>
        controls.indexOf(screen.getByRole(name === "Find food" ? "button" : "tab", { name })),
      );
      expect(order).toEqual([0, 1, 2, 3, 4, 5]);
    });

    it("should keep the search launcher to the Dashboard and the Diary, so Train has none", async () => {
      await renderApp(TabsLayoutWithTrainShown, "/train");
      await screen.findByRole("heading", { name: "Train screen" });

      expect(screen.queryByRole("button", { name: "Search for a food" })).not.toBeOnTheScreen();
      expect(screen.getByRole("tab", { name: "Train", selected: true })).toBeOnTheScreen();
    });
  });
});
