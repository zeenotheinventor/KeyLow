import "../support/gestureHandler";

import { act, render, screen, userEvent } from "@testing-library/react-native";
import { ExpoRoot, router } from "expo-router";
import { getMockContext } from "expo-router/testing-library";
import { Text } from "react-native";

import { resetApiClientMock } from "./support/apiClientMock";
import { resetSearchApiClientMock } from "./support/searchApiClientMock";
import TabsLayout from "../../app/(tabs)/_layout";
import DashboardRoute from "../../app/(tabs)/dashboard";
import MoreRoute from "../../app/(tabs)/more";
import RootLayout from "../../app/_layout";
import FoodsLayout from "../../app/foods/_layout";
import FoodSearchRoute from "../../app/foods/index";
import { fakeSession, mockSupabaseClient, resetSupabaseMock } from "../support/supabaseMock";

import type { ComponentType } from "react";

// The real root layout, tab layout, foods layout and sheet are navigated by the real router. The screens
// the sheet opens are stand-ins, because this test is about how the sheet is presented and left.
jest.mock("../../global.css", () => ({}));
// The theme preference the app finds in storage, which a test changes to see the light scheme.
let mockStoredPreference: string | null = null;

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: () => Promise.resolve(mockStoredPreference),
    setItem: () => Promise.resolve(),
  },
}));
jest.mock("../../lib/supabase", () => ({
  supabase: jest.requireActual<{ mockSupabaseClient: unknown }>("../support/supabaseMock")
    .mockSupabaseClient,
}));
jest.mock(
  "@keylow/api-client",
  () =>
    jest.requireActual<{ mockSearchApiClient: unknown }>("./support/searchApiClientMock")
      .mockSearchApiClient,
);
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);
// A status bar draws nothing, so the mock says which style it was asked for.
jest.mock("expo-status-bar", () => {
  const { Text: StatusText } = jest.requireActual<{ Text: ComponentType<{ children: string }> }>(
    "react-native",
  );

  return {
    StatusBar: ({ style }: { style?: string }) => (
      <StatusText>{`Status bar ${style ?? "auto"}`}</StatusText>
    ),
  };
});

const standIn = (text: string) =>
  function StandIn() {
    return <Text>{text}</Text>;
  };

// The diary has its own tests. Here it is a heading, because these tests are about the shell around it.
function DiaryStandIn() {
  return <Text role="heading">Diary</Text>;
}

const routes = {
  _layout: RootLayout,
  "(tabs)/_layout": TabsLayout,
  "(tabs)/dashboard": DashboardRoute,
  "(tabs)/diary": DiaryStandIn,
  "(tabs)/more": MoreRoute,
  "(tabs)/recipes": standIn("Recipes screen"),
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

// A host node's props are loosely typed, so a prop is read with a descriptor.
function propOf(props: object, name: string): unknown {
  return Object.getOwnPropertyDescriptor(props, name)?.value;
}

// Each screen the real native stack keeps is one of these, with the way it is presented.
function presentedScreens() {
  return (
    screen.root?.queryAll((node) => propOf(node.props, "stackPresentation") !== undefined) ?? []
  ).map((node) => ({
    presentation: propOf(node.props, "stackPresentation"),
    animation: propOf(node.props, "stackAnimation"),
  }));
}

function modals() {
  return presentedScreens().filter(({ presentation }) => presentation === "fullScreenModal");
}

function headerConfigs() {
  return screen.root?.queryAll((node) => node.type === "RNSScreenStackHeaderConfig") ?? [];
}

const sheetHeading = () => screen.queryByRole("heading", { name: "Find food" });

// What React Navigation does when the Android back key is pressed. The device run presses the real key.
function goBack() {
  router.back();
}

async function openSheetFrom(location: string, sheetPath = "/foods") {
  await renderApp(location);
  await act(() => {
    router.push(sheetPath);
  });
}

describe("the food search sheet as a route", () => {
  beforeEach(() => {
    mockStoredPreference = null;
    resetSupabaseMock();
    resetApiClientMock();
    resetSearchApiClientMock();
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: fakeSession },
      error: null,
    });
  });

  describe("how it is presented", () => {
    it("should open over the tabs as a full-screen modal that slides up from the bottom", async () => {
      await renderApp("/diary");
      expect(modals()).toHaveLength(0);

      await act(() => {
        router.push("/foods");
      });

      expect(modals()).toEqual([
        { presentation: "fullScreenModal", animation: "slide_from_bottom" },
      ]);
    });

    it("should open from the centre plus on the diary", async () => {
      const user = userEvent.setup();
      await renderApp("/diary");

      await user.press(await screen.findByRole("button", { name: "Find food" }));

      expect(await screen.findByRole("heading", { name: "Find food" })).toBeOnTheScreen();
      expect(modals()).toHaveLength(1);
    });

    it("should draw its own header and no native one", async () => {
      await openSheetFrom("/diary");

      expect(sheetHeading()).toBeOnTheScreen();
      expect(headerConfigs().every((config) => config.props.hidden === true)).toBe(true);
    });

    it("should draw the status bar for the dark scheme within the sheet's stack", async () => {
      await openSheetFrom("/diary");

      // Dark content colours would vanish on the dark sheet, so the bar is light, in the root and in the sheet.
      expect(await screen.findAllByText("Status bar light")).toHaveLength(2);
      expect(screen.queryByText("Status bar dark")).not.toBeOnTheScreen();
    });

    it("should draw the status bar for the light scheme with dark content", async () => {
      mockStoredPreference = "light";
      await openSheetFrom("/diary");

      // The root's bar and the sheet's own.
      expect(await screen.findAllByText("Status bar dark")).toHaveLength(2);
      expect(screen.queryByText("Status bar light")).not.toBeOnTheScreen();
    });

    it("should draw no native header on the food either, which draws its own", async () => {
      await openSheetFrom("/diary", "/foods/11111111-1111-4111-8111-111111111111");

      expect(headerConfigs().every((config) => config.props.hidden === true)).toBe(true);
    });
  });

  describe("leaving it", () => {
    it("should return to the diary when closed from there", async () => {
      const user = userEvent.setup();
      await openSheetFrom("/diary");

      await user.press(screen.getByRole("button", { name: "Close" }));

      expect(await screen.findByRole("button", { name: "Find food" })).toBeOnTheScreen();
      expect(sheetHeading()).not.toBeOnTheScreen();
      expect(modals()).toHaveLength(0);
    });

    it("should return to where it was opened, whichever tab that was", async () => {
      const user = userEvent.setup();
      await openSheetFrom("/recipes");

      await user.press(screen.getByRole("button", { name: "Close" }));

      expect(await screen.findByText("Recipes screen")).toBeOnTheScreen();
      expect(sheetHeading()).not.toBeOnTheScreen();
    });

    it("should return to where it was opened on back", async () => {
      await openSheetFrom("/recipes");

      await act(() => {
        goBack();
      });

      expect(await screen.findByText("Recipes screen")).toBeOnTheScreen();
      expect(sheetHeading()).not.toBeOnTheScreen();
      expect(modals()).toHaveLength(0);
    });

    it("should go back from a screen the sheet opened to the sheet, then to where it began", async () => {
      await openSheetFrom("/diary");
      await act(() => {
        router.push("/foods/new");
      });
      expect(await screen.findByText("New food screen")).toBeOnTheScreen();

      await act(() => {
        goBack();
      });
      expect(sheetHeading()).toBeOnTheScreen();

      await act(() => {
        goBack();
      });
      expect(await screen.findByRole("button", { name: "Find food" })).toBeOnTheScreen();
    });

    it("should go to the diary when the sheet was the first screen, since there is nothing to go back to", async () => {
      const user = userEvent.setup();
      await renderApp("/foods");
      expect(sheetHeading()).toBeOnTheScreen();

      await user.press(screen.getByRole("button", { name: "Close" }));

      expect(await screen.findByRole("button", { name: "Find food" })).toBeOnTheScreen();
    });
  });

  describe("Your foods", () => {
    it("should open the same sheet titled Your foods, and close back to where it was opened", async () => {
      const user = userEvent.setup();
      await openSheetFrom("/more", "/foods?scope=own");

      expect(screen.getByRole("heading", { name: "Your foods" })).toBeOnTheScreen();
      expect(modals()).toHaveLength(1);

      await user.press(screen.getByRole("button", { name: "Close" }));

      expect(await screen.findByRole("heading", { name: "More" })).toBeOnTheScreen();
    });
  });
});
