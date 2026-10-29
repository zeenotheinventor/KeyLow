import "../support/gestureHandler";

import { KeyLowProvider } from "@keylow/api-client";
import { act, cleanup, render, screen, userEvent, waitFor } from "@testing-library/react-native";
import { ExpoRoot, Slot, router } from "expo-router";
import { getMockContext } from "expo-router/testing-library";
import { Text } from "react-native";

import TabsLayout from "../../app/(tabs)/_layout";
import MoreLayout from "../../app/(tabs)/more/_layout";
import WeightLayout from "../../app/(tabs)/more/weight/_layout";
import WeighInEntryRoute from "../../app/(tabs)/more/weight/entry";
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

// The router's test library replaces the animation library with a mock the bottom sheet cannot run on, so the
// sheet is a stand-in here. The sheet itself is tested in weighInSheetAdd and weighInSheetDateTime.
jest.mock("../../components/WeighInSheet", () => {
  const {
    Pressable,
    Text: NativeText,
    View,
  } = jest.requireActual<typeof import("react-native")>("react-native");
  return {
    WeighInSheet: ({ onClose }: { onClose: () => void }) => (
      <View aria-label="Add weigh-in" role="dialog">
        <NativeText role="heading">Add weigh-in</NativeText>
        <Pressable role="button" onPress={onClose}>
          <NativeText>Cancel</NativeText>
        </Pressable>
      </View>
    ),
  };
});

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
  "(tabs)/train": standIn("Train"),
  "(tabs)/more/_layout": MoreLayout,
  "(tabs)/more/index": standIn("More"),
  "(tabs)/more/weight/_layout": WeightLayout,
  "(tabs)/more/weight/index": WeightRoute,
  "(tabs)/more/weight/entry": WeighInEntryRoute,
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
    expect(screen.getAllByRole("tab")).toHaveLength(4);
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

describe("the weigh-in entry route", () => {
  beforeEach(() => {
    resetWeightBackend();
    queryClient = createWeightQueryClient();
  });

  afterEach(async () => {
    await cleanup();
    queryClient.clear();
  });

  it("should open the add sheet over the Weight screen from the header's Add weigh-in, and close back to it with Cancel", async () => {
    const user = userEvent.setup();
    await renderApp("/more/weight");
    await screen.findByRole("heading", { name: "No weigh-ins yet" });
    const [headerAdd] = screen.getAllByRole("button", { name: "Add weigh-in" });
    if (headerAdd === undefined) {
      throw new Error("The screen needs the header's Add weigh-in button");
    }
    await user.press(headerAdd);

    expect(await screen.findByLabelText("Add weigh-in", { exact: true })).toHaveProp(
      "role",
      "dialog",
    );

    await user.press(screen.getByRole("button", { name: "Cancel" }));

    expect(await screen.findByRole("heading", { name: "Weight" })).toBeOnTheScreen();
    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Add weigh-in" })).not.toBeOnTheScreen();
    });
  });

  it("should open the add sheet from the empty state's Add weigh-in", async () => {
    const user = userEvent.setup();
    await renderApp("/more/weight");
    await screen.findByRole("heading", { name: "No weigh-ins yet" });
    const [headerAdd, emptyStateAdd] = screen.getAllByRole("button", { name: "Add weigh-in" });
    if (headerAdd === undefined || emptyStateAdd === undefined) {
      throw new Error("The screen needs both Add weigh-in buttons");
    }

    await user.press(emptyStateAdd);

    expect(await screen.findByRole("heading", { name: "Add weigh-in" })).toBeOnTheScreen();
  });

  it("should open the sheet on its own address too, for a link", async () => {
    await renderApp("/more/weight/entry");

    expect(await screen.findByRole("heading", { name: "Add weigh-in" })).toBeOnTheScreen();
  });

  it("should go to the Weight screen, and not throw, when Cancel is pressed on a link that opened the sheet cold", async () => {
    const user = userEvent.setup();
    await renderApp("/more/weight/entry");
    await user.press(await screen.findByRole("button", { name: "Cancel" }));

    expect(await screen.findByRole("heading", { name: "Weight" })).toBeOnTheScreen();
    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Add weigh-in" })).not.toBeOnTheScreen();
    });
  });
});
