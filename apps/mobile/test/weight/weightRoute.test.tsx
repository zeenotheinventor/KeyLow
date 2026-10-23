import "../support/gestureHandler";

import { KeyLowProvider } from "@keylow/api-client";
import { act, cleanup, render, screen, userEvent } from "@testing-library/react-native";
import { ExpoRoot, Slot, router } from "expo-router";
import { getMockContext } from "expo-router/testing-library";
import { Text } from "react-native";

import TabsLayout from "../../app/(tabs)/_layout";
import MoreLayout from "../../app/(tabs)/more/_layout";
import WeightLayout from "../../app/(tabs)/more/weight/_layout";
import WeightRoute from "../../app/(tabs)/more/weight/index";
import { ToastProvider } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import {
  createWeightQueryClient,
  resetWeightBackend,
  weightClient,
} from "../support/weightBackend";

import type { QueryClient } from "@tanstack/react-query";

// The real tab layout, the More tab's stack and the Weight screen under the real router, with the kit's tab
// bar in it. The screens that are not the subject are stand-ins.
jest.mock("../../global.css", () => ({}));
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);

let queryClient: QueryClient;

function Providers() {
  return (
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={weightClient} queryClient={queryClient}>
        <ToastProvider>
          <Slot />
        </ToastProvider>
      </KeyLowProvider>
    </ThemeProvider>
  );
}

const standIn = (text: string) =>
  function StandIn() {
    return <Text role="heading">{text}</Text>;
  };

const routes = {
  _layout: Providers,
  "(tabs)/_layout": TabsLayout,
  "(tabs)/dashboard": standIn("Dashboard"),
  "(tabs)/diary": standIn("Diary"),
  "(tabs)/recipes": standIn("Recipes"),
  "(tabs)/train": standIn("Train"),
  "(tabs)/more/_layout": MoreLayout,
  "(tabs)/more/index": standIn("More"),
  "(tabs)/more/weight/_layout": WeightLayout,
  "(tabs)/more/weight/index": WeightRoute,
  "foods/index": standIn("Search"),
};

async function renderApp(location: string) {
  await render(<ExpoRoot context={getMockContext(routes)} location={location} />);
}

describe("the Weight route", () => {
  beforeEach(() => {
    resetWeightBackend();
    queryClient = createWeightQueryClient();
  });

  afterEach(async () => {
    await cleanup();
    queryClient.clear();
  });

  it("should keep the tab bar, with More selected, on the Weight screen pushed inside the More tab", async () => {
    await renderApp("/more/weight");

    expect(await screen.findByRole("heading", { name: "Weight" })).toBeOnTheScreen();
    expect(screen.getAllByRole("tab")).toHaveLength(5);
    expect(screen.getByRole("tab", { name: "More", selected: true })).toBeOnTheScreen();
  });

  it("should open from the More screen and go back to it with Back to More", async () => {
    const user = userEvent.setup();
    await renderApp("/more");
    await screen.findByRole("heading", { name: "More" });
    await act(() => {
      router.push("/more/weight");
    });
    expect(await screen.findByRole("heading", { name: "Weight" })).toBeOnTheScreen();

    await user.press(screen.getByRole("button", { name: "Back to More" }));

    expect(await screen.findByRole("heading", { name: "More" })).toBeOnTheScreen();
    expect(screen.getByRole("tab", { name: "More", selected: true })).toBeOnTheScreen();
  });
});
