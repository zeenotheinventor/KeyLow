import { screen, userEvent } from "@testing-library/react-native";
import { Tabs } from "expo-router/js-tabs";
import { renderRouter } from "expo-router/testing-library";
import { Text } from "react-native";

import { RouterTabBar, useTabTransitionOptions } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";

import type { BottomTabBarProps } from "expo-router/js-tabs";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

async function userPress(role: "tab" | "button", name: string) {
  await userEvent
    .setup({ advanceTimers: jest.advanceTimersByTime })
    .press(screen.getByRole(role, { name }));
}

// The real Expo Router, with the kit's bar in the place of its own, as the app's tab layout will do.
async function renderTabs(
  extraScreens: Record<string, () => React.JSX.Element> = {},
  // The Train screen between Diary and More: shown, as the app has it, or hidden from the bar with a null href.
  train: "hidden" | "shown" = "shown",
) {
  const onAddPress = jest.fn();
  // The listener a screen can put on its own tab press, to take it over, as a screen scrolling to top would.
  const onDiaryTabPress = jest.fn<undefined, [{ preventDefault: () => void }]>();
  const seen: { descriptors?: BottomTabBarProps["descriptors"] } = {};

  function Layout() {
    const transition = useTabTransitionOptions();

    return (
      <ThemeProvider fixedPreference="dark">
        <Tabs
          screenOptions={{ headerShown: false, ...transition }}
          tabBar={(props) => {
            seen.descriptors = props.descriptors;
            return (
              <RouterTabBar {...props} addLabel="Find food" label="Main" onAddPress={onAddPress} />
            );
          }}
        >
          <Tabs.Screen name="dashboard" options={{ title: "Dashboard" }} />
          <Tabs.Screen
            listeners={{
              tabPress: (event) => {
                onDiaryTabPress(event);
              },
            }}
            name="diary"
            options={{ title: "Diary" }}
          />
          {train === "hidden" ? (
            <Tabs.Screen name="train" options={{ title: "Train", href: null }} />
          ) : null}
          {train === "shown" ? <Tabs.Screen name="train" options={{ title: "Train" }} /> : null}
          <Tabs.Screen name="more" options={{ title: "More" }} />
        </Tabs>
      </ThemeProvider>
    );
  }

  // renderRouter hangs its path readers on the promise that render now returns, so it is kept.
  const view = renderRouter(
    {
      _layout: Layout,
      dashboard: () => <Text>Dashboard screen</Text>,
      diary: () => <Text>Diary screen</Text>,
      train: () => <Text>Train screen</Text>,
      more: () => <Text>More screen</Text>,
      ...extraScreens,
    },
    { initialUrl: "/dashboard" },
  );
  await view;

  return { onAddPress, onDiaryTabPress, seen, view };
}

describe("RouterTabBar in the real Expo Router Tabs", () => {
  it("should draw a tab for each screen, named by its title, with the open screen selected", async () => {
    await renderTabs();

    expect(screen.getByText("Dashboard screen")).toBeOnTheScreen();
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(4);
    expect(
      ["Dashboard", "Diary", "Train", "More"].map((name) =>
        tabs.indexOf(screen.getByRole("tab", { name })),
      ),
    ).toEqual([0, 1, 2, 3]);
    expect(screen.getByRole("tab", { name: "Dashboard", selected: true })).toBeOnTheScreen();
  });

  it("should open a screen when its tab is pressed, and select that tab", async () => {
    const { view } = await renderTabs();

    await userPress("tab", "More");

    expect(view.getPathname()).toBe("/more");
    expect(screen.getByText("More screen")).toBeOnTheScreen();
    expect(screen.getByRole("tab", { name: "More", selected: true })).toBeOnTheScreen();
    expect(screen.getByRole("tab", { name: "Dashboard", selected: false })).toBeOnTheScreen();
  });

  it("should call the add callback when the plus is pressed, and not change the active tab", async () => {
    const { onAddPress, view } = await renderTabs();
    await userPress("tab", "Diary");

    await userPress("button", "Find food");

    expect(onAddPress).toHaveBeenCalledTimes(1);
    expect(view.getPathname()).toBe("/diary");
    expect(screen.getByText("Diary screen")).toBeOnTheScreen();
    expect(screen.getByRole("tab", { name: "Diary", selected: true })).toBeOnTheScreen();
    expect(screen.getAllByRole("tab", { selected: true })).toHaveLength(1);
  });

  it("should not make the plus a screen of the navigator", async () => {
    const { seen } = await renderTabs();

    expect(Object.keys(seen.descriptors ?? {})).toHaveLength(4);
  });

  it("should leave out a screen that has no place in the bar", async () => {
    await renderTabs({ unlisted: () => <Text>Unlisted screen</Text> });

    expect(screen.getAllByRole("tab")).toHaveLength(4);
    expect(screen.queryByRole("tab", { name: /unlisted/i })).not.toBeOnTheScreen();
  });

  // Recipes left the bar for a row of More, so a screen of that name is one with no place in it.
  it("should draw no Recipes tab, even for a screen named recipes", async () => {
    await renderTabs({ recipes: () => <Text>Recipes screen</Text> });

    expect(screen.getAllByRole("tab")).toHaveLength(4);
    expect(screen.queryByRole("tab", { name: /recipes/i })).not.toBeOnTheScreen();
  });

  describe("the Train screen between Diary and More", () => {
    it("should draw no tab for it while its href is null, so the bar is the other three", async () => {
      await renderTabs({}, "hidden");

      const tabs = screen.getAllByRole("tab");
      expect(tabs).toHaveLength(3);
      expect(screen.queryByRole("tab", { name: "Train" })).not.toBeOnTheScreen();
      expect(
        ["Dashboard", "Diary", "More"].map((name) =>
          tabs.indexOf(screen.getByRole("tab", { name })),
        ),
      ).toEqual([0, 1, 2]);
    });

    it("should draw four labelled tabs and the plus, with Train after the plus, once it has an href", async () => {
      await renderTabs({}, "shown");

      const controls = screen.getAllByRole(/^(tab|button)$/);
      expect(screen.getAllByRole("tab")).toHaveLength(4);
      expect(
        ["Dashboard", "Diary", "Find food", "Train", "More"].map((name) =>
          controls.indexOf(screen.getByRole(name === "Find food" ? "button" : "tab", { name })),
        ),
      ).toEqual([0, 1, 2, 3, 4]);
    });

    it("should open the Train screen and select its tab when it is pressed", async () => {
      const { view } = await renderTabs({}, "shown");

      await userPress("tab", "Train");

      expect(view.getPathname()).toBe("/train");
      expect(screen.getByRole("tab", { name: "Train", selected: true })).toBeOnTheScreen();
    });
  });

  it("should give every screen the quick fade for a tab change", async () => {
    const { seen } = await renderTabs();

    const options = Object.values(seen.descriptors ?? {}).map((descriptor) => descriptor.options);

    expect(options).toHaveLength(4);
    options.forEach((option) => {
      expect(option.animation).toBe("fade");
      expect(option.transitionSpec).toEqual({ animation: "timing", config: { duration: 160 } });
    });
  });

  describe("the tab press event", () => {
    it("should tell the screen's own listener about the press, then open the screen", async () => {
      const { onDiaryTabPress, view } = await renderTabs();

      await userPress("tab", "Diary");

      expect(onDiaryTabPress).toHaveBeenCalledTimes(1);
      expect(view.getPathname()).toBe("/diary");
    });

    it("should leave the tab where it is when the screen's listener prevents the default", async () => {
      const { onDiaryTabPress, view } = await renderTabs();
      onDiaryTabPress.mockImplementation((event) => {
        event.preventDefault();
      });

      await userPress("tab", "Diary");

      expect(onDiaryTabPress).toHaveBeenCalledTimes(1);
      expect(view.getPathname()).toBe("/dashboard");
      expect(screen.getByText("Dashboard screen")).toBeOnTheScreen();
      expect(screen.getByRole("tab", { name: "Dashboard", selected: true })).toBeOnTheScreen();
    });

    it("should still tell the listener when the tab pressed is the one already open, and navigate nowhere", async () => {
      const { onDiaryTabPress, view } = await renderTabs();
      await userPress("tab", "Diary");

      await userPress("tab", "Diary");

      expect(onDiaryTabPress).toHaveBeenCalledTimes(2);
      expect(view.getPathname()).toBe("/diary");
    });

    it("should send no tab press for the plus, because it is not a tab", async () => {
      const { onDiaryTabPress } = await renderTabs();

      await userPress("button", "Find food");

      expect(onDiaryTabPress).not.toHaveBeenCalled();
    });
  });
});
