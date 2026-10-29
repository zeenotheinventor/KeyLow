import { render, screen } from "@testing-library/react-native";
import { ExpoRoot, Slot } from "expo-router";
import { getMockContext } from "expo-router/testing-library";
import { Text } from "react-native";

import TabsLayout from "../app/(tabs)/_layout";
import TrainLayout from "../app/(tabs)/train/_layout";
import { ToastProvider } from "../components/ui";
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
  "(tabs)/train/_layout": TrainLayout,
  "(tabs)/train/index": standIn("Train screen"),
  "(tabs)/more": standIn("More screen"),
};

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

  it("should show four labelled destinations and the plus, with Train between the plus and More", async () => {
    await renderApp(TabsLayout, "/train");
    await screen.findByRole("heading", { name: "Train screen" });

    const controls = screen.getAllByRole(/^(tab|button)$/);
    const order = ["Dashboard", "Diary", "Find food", "Train", "More"].map((name) =>
      controls.indexOf(screen.getByRole(name === "Find food" ? "button" : "tab", { name })),
    );
    expect(order).toEqual([0, 1, 2, 3, 4]);
    expect(screen.getAllByRole("tab")).toHaveLength(4);
  });

  it("should keep the search launcher to the Dashboard and the Diary, so Train has none", async () => {
    await renderApp(TabsLayout, "/train");
    await screen.findByRole("heading", { name: "Train screen" });

    expect(screen.queryByRole("button", { name: "Search for a food" })).not.toBeOnTheScreen();
    expect(screen.getByRole("tab", { name: "Train", selected: true })).toBeOnTheScreen();
  });
});
