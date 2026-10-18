import "../support/gestureHandler";

import { act, render, screen, userEvent } from "@testing-library/react-native";
import { ExpoRoot, router } from "expo-router";
import { getMockContext } from "expo-router/testing-library";
import { Text } from "react-native";

import { resetApiClientMock } from "./support/apiClientMock";
import { mockUseFoodByBarcode, resetBarcodeLookupMock } from "./support/barcodeLookupMock";
import { resetSearchApiClientMock } from "./support/searchApiClientMock";
import TabsLayout from "../../app/(tabs)/_layout";
import DashboardRoute from "../../app/(tabs)/dashboard";
import MoreRoute from "../../app/(tabs)/more";
import RootLayout from "../../app/_layout";
import FoodsLayout from "../../app/foods/_layout";
import FoodSearchRoute from "../../app/foods/index";
import ScanRoute from "../../app/foods/scan";
import { resetCameraMock } from "../support/expoCameraMock";
import { fakeSession, mockSupabaseClient, resetSupabaseMock } from "../support/supabaseMock";

import type { UseFoodByBarcodeOptions } from "@keylow/api-client";

// The real root, tab and foods layouts, the real search sheet and the real scan route are navigated by the
// real router, with only the camera and the data hooks mocked. This test is about how the scanner is left.
jest.mock("../../global.css", () => ({}));
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock("../../lib/supabase", () => ({
  supabase: jest.requireActual<{ mockSupabaseClient: unknown }>("../support/supabaseMock")
    .mockSupabaseClient,
}));
jest.mock("@keylow/api-client", () => ({
  ...jest.requireActual<{ mockSearchApiClient: object }>("./support/searchApiClientMock")
    .mockSearchApiClient,
  useFoodByBarcode: (rawCode: string, options?: UseFoodByBarcodeOptions) =>
    jest
      .requireActual<{ mockUseFoodByBarcode: typeof mockUseFoodByBarcode }>(
        "./support/barcodeLookupMock",
      )
      .mockUseFoodByBarcode(rawCode, options),
}));
jest.mock(
  "expo-camera",
  () => jest.requireActual<{ mockExpoCamera: unknown }>("../support/expoCameraMock").mockExpoCamera,
);
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);
jest.mock("expo-status-bar", () => ({ StatusBar: () => null }));

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
  "(tabs)/train": standIn("Train screen"),
  "(tabs)/more": MoreRoute,
  "(tabs)/recipes": standIn("Recipes screen"),
  "(tabs)/weight": standIn("Weight screen"),
  "(tabs)/settings": standIn("Settings screen"),
  "foods/_layout": FoodsLayout,
  "foods/index": FoodSearchRoute,
  "foods/new": standIn("New food screen"),
  "foods/scan": ScanRoute,
  "foods/[id]/index": standIn("Food screen"),
  "foods/[id]/edit": standIn("Edit food screen"),
};

async function renderApp(location: string) {
  await render(<ExpoRoot context={getMockContext(routes)} location={location} />);
}

function headerConfigs() {
  return screen.root?.queryAll((node) => node.type === "RNSScreenStackHeaderConfig") ?? [];
}

const scannerHeading = () => screen.queryByRole("heading", { name: "Scan barcode" });
const searchHeading = () => screen.queryByRole("heading", { name: "Find food" });

describe("leaving the scanner", () => {
  beforeEach(() => {
    resetSupabaseMock();
    resetApiClientMock();
    resetSearchApiClientMock();
    resetCameraMock();
    resetBarcodeLookupMock();
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: fakeSession },
      error: null,
    });
  });

  it("should draw its own header and no native one", async () => {
    await renderApp("/diary");
    await act(() => {
      router.push("/foods/scan");
    });

    expect(await screen.findByRole("heading", { name: "Scan barcode" })).toBeOnTheScreen();
    expect(headerConfigs().every((config) => config.props.hidden === true)).toBe(true);
  });

  describe("when opened from the search sheet", () => {
    async function openScannerFromSearch() {
      const user = userEvent.setup();
      await renderApp("/recipes");
      await act(() => {
        router.push("/foods");
      });
      await user.press(await screen.findByRole("button", { name: "Scan barcode" }));
      expect(await screen.findByRole("heading", { name: "Scan barcode" })).toBeOnTheScreen();
      return user;
    }

    it("should return to the search on back", async () => {
      const user = await openScannerFromSearch();

      await user.press(screen.getByRole("button", { name: "Back to search" }));

      expect(await screen.findByRole("heading", { name: "Find food" })).toBeOnTheScreen();
      expect(scannerHeading()).not.toBeOnTheScreen();
    });

    it("should dismiss the whole sheet on close, back to where it was opened", async () => {
      const user = await openScannerFromSearch();

      await user.press(screen.getByRole("button", { name: "Close" }));

      expect(await screen.findByText("Recipes screen")).toBeOnTheScreen();
      expect(scannerHeading()).not.toBeOnTheScreen();
      expect(searchHeading()).not.toBeOnTheScreen();
    });
  });

  describe("when opened straight from the search bar above the tab bar", () => {
    async function openScannerFromLauncher() {
      const user = userEvent.setup();
      await renderApp("/recipes");
      await act(() => {
        router.push("/foods/scan");
      });
      expect(await screen.findByRole("heading", { name: "Scan barcode" })).toBeOnTheScreen();
      return user;
    }

    it("should dismiss the sheet on close, back to where it was opened", async () => {
      const user = await openScannerFromLauncher();

      await user.press(screen.getByRole("button", { name: "Close" }));

      expect(await screen.findByText("Recipes screen")).toBeOnTheScreen();
      expect(scannerHeading()).not.toBeOnTheScreen();
    });

    it("should leave the sheet on back too, since there is no search under it", async () => {
      const user = await openScannerFromLauncher();

      await user.press(screen.getByRole("button", { name: "Back to search" }));

      expect(await screen.findByText("Recipes screen")).toBeOnTheScreen();
      expect(scannerHeading()).not.toBeOnTheScreen();
    });
  });

  describe("when opened by a cold link, with nothing under the sheet", () => {
    it("should go to the dashboard on close", async () => {
      const user = userEvent.setup();
      await renderApp("/foods/scan");
      expect(await screen.findByRole("heading", { name: "Scan barcode" })).toBeOnTheScreen();

      await user.press(screen.getByRole("button", { name: "Close" }));

      expect(await screen.findByRole("button", { name: "Find food" })).toBeOnTheScreen();
      expect(scannerHeading()).not.toBeOnTheScreen();
    });
  });
});
