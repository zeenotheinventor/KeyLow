import "../support/gestureHandler";

import { onlineManager } from "@tanstack/react-query";
import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native";
import { ExpoRoot, router } from "expo-router";
import { getMockContext } from "expo-router/testing-library";
import { AccessibilityInfo, BackHandler, Text } from "react-native";

import { profileTimeZone, recentFoods, resetApiClientMock } from "./support/apiClientMock";
import { mockUseFoodByBarcode, resetBarcodeLookupMock } from "./support/barcodeLookupMock";
import { compileFoodSearchStyles } from "./support/foodSearchStyles";
import {
  mockLogEntries,
  recipeSearchResult,
  resetSearchApiClientMock,
  searchResult,
} from "./support/searchApiClientMock";
import TabsLayout from "../../app/(tabs)/_layout";
import DashboardRoute from "../../app/(tabs)/dashboard";
import MoreRoute from "../../app/(tabs)/more";
import RootLayout from "../../app/_layout";
import FoodsLayout from "../../app/foods/_layout";
import FoodSearchRoute from "../../app/foods/index";
import ScanRoute from "../../app/foods/scan";
import { resetCameraMock } from "../support/expoCameraMock";
import { registerAppStyles } from "../support/nativeWindStyles";
import { fakeSession, mockSupabaseClient, resetSupabaseMock } from "../support/supabaseMock";

import type { UseFoodByBarcodeOptions } from "@keylow/api-client";

// Leaving the food sheet with foods on the plate asks "Discard your plate?". The real root, tab and foods
// layouts and the real router carry the sheet, so a close from the scanner, which sits above the search, meets
// the search's guard exactly as it does on a device. Only the camera and the data hooks are mocked.
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

// The diary has its own tests. Here it is a heading, because these tests are about the sheet that closes onto it.
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

const mediumPortionId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const recipeId = "00000000-0000-4000-8000-0000000000b1";

const banana = {
  id: "77777777-7777-4777-8777-777777777777",
  source: "cofid" as const,
  name: "Banana",
  brand: null,
  basis: "per_100g" as const,
  kcal: 95,
  protein_g: 1.2,
  fat_g: 0.1,
  carbs_g: 20.3,
  fibre_g: null,
  quality: {},
  default_portion_id: mediumPortionId,
  default_portion_label: "1 medium",
  default_portion_grams: 150,
  default_portion_ml: null,
  score: 0.9,
};

const chickenAndRice = {
  id: recipeId,
  name: "Chicken and rice",
  servings: 4,
  yield_grams: 1100,
  is_archived: false,
  computed: {
    total: { kcal: 1496.8, protein_g: 126.5, carbs_g: 170.2, fat_g: 32.5, fibre_g: null },
    perServing: { kcal: 374.2, protein_g: 31.625, carbs_g: 42.55, fat_g: 8.125, fibre_g: null },
    per100g: { kcal: 136.1, protein_g: 11.5, carbs_g: 15.5, fat_g: 2.95, fibre_g: null },
    totalGrams: 720,
    effectiveGrams: 1100,
    engineVersion: 1,
  },
};

const addBanana = "Add Banana, 1 medium (150 g), to your plate";
const addRecipe = "Add Chicken and rice, 1 serving (275 g), to your plate";
const logOneFood = "Log food, 1 food on your plate";
const logTwoFoods = "Log foods, 2 foods on your plate";

const dialogTitle = () =>
  screen.queryByRole("heading", { name: "Discard your plate?", includeHiddenElements: true });
// The dialog is a native modal over everything, but the test tree keeps it under the screen that opened it, which
// is hidden while another screen of the sheet is in front. So it is read with hidden elements included.
const dialogButton = (name: "Keep adding" | "Discard") =>
  screen.getByRole("button", { name, includeHiddenElements: true });
const dialogText = (text: string) => screen.getByText(text, { includeHiddenElements: true });
const searchHeading = () => screen.queryByRole("heading", { name: "Log food" });
const scannerHeading = () => screen.queryByRole("heading", { name: "Scan barcode" });

// The handlers the router registered for the Android back button, newest first, as the OS asks them.
const backPressHandlers: Parameters<typeof BackHandler.addEventListener>[1][] = [];

async function pressAndroidBack() {
  await act(() => {
    for (const handler of [...backPressHandlers].reverse()) {
      if (handler({ type: "hardwareBackPress", timeStamp: 0 }) === true) {
        return;
      }
    }
  });
}

async function type(text: string) {
  await fireEvent.changeText(screen.getByRole("searchbox", { name: "Search foods" }), text);
}

async function openSearch(user: ReturnType<typeof userEvent.setup>) {
  await render(<ExpoRoot context={getMockContext(routes)} location="/recipes" />);
  await act(() => {
    router.push("/foods?day=2026-10-15");
  });
  expect(await screen.findByRole("heading", { name: "Log food" })).toBeOnTheScreen();
  return user;
}

async function putFoodsOnThePlate(user: ReturnType<typeof userEvent.setup>) {
  await type("chicken");
  await user.press(screen.getByRole("button", { name: addRecipe }));
  await type("ba");
  await user.press(screen.getByRole("button", { name: addBanana }));
  expect(await screen.findByRole("button", { name: logTwoFoods })).toBeOnTheScreen();
}

describe("leaving the food sheet with foods on the plate", () => {
  let styles: string;

  beforeAll(async () => {
    styles = await compileFoodSearchStyles();
  });

  beforeEach(() => {
    registerAppStyles(styles);
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
    jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockReturnValue();
    backPressHandlers.length = 0;
    jest.spyOn(BackHandler, "addEventListener").mockImplementation((_eventName, handler) => {
      backPressHandlers.push(handler);
      return { remove: () => undefined };
    });
    resetSupabaseMock();
    resetApiClientMock();
    resetSearchApiClientMock();
    resetCameraMock();
    resetBarcodeLookupMock();
    onlineManager.setOnline(true);
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: fakeSession },
      error: null,
    });
    profileTimeZone.current = { data: "Europe/London", isPending: false, isError: false };
    recentFoods.current = { data: [], isPending: false, isError: false };
    searchResult.local = [banana];
    recipeSearchResult.recipes = [chickenAndRice];
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("the header's Close", () => {
    it("should leave at once, with no question, while the plate is empty", async () => {
      const user = await openSearch(userEvent.setup());

      await user.press(screen.getByRole("button", { name: "Close" }));

      expect(await screen.findByText("Recipes screen")).toBeOnTheScreen();
      expect(dialogTitle()).not.toBeOnTheScreen();
    });

    it("should ask 'Discard your plate?' and say how many foods will not be logged", async () => {
      const user = await openSearch(userEvent.setup());
      await putFoodsOnThePlate(user);

      await user.press(screen.getByRole("button", { name: "Close" }));

      expect(dialogTitle()).toBeOnTheScreen();
      expect(dialogText("The 2 foods on it won't be logged.")).toBeOnTheScreen();
      expect(screen.queryByText("Recipes screen")).not.toBeOnTheScreen();
    });

    it("should say 'The 1 food on it won't be logged.' for one food", async () => {
      const user = await openSearch(userEvent.setup());
      await type("chicken");
      await user.press(screen.getByRole("button", { name: addRecipe }));

      await user.press(screen.getByRole("button", { name: "Close" }));

      expect(dialogText("The 1 food on it won't be logged.")).toBeOnTheScreen();
    });

    it("should keep the sheet and the plate when Keep adding is pressed", async () => {
      const user = await openSearch(userEvent.setup());
      await putFoodsOnThePlate(user);
      await user.press(screen.getByRole("button", { name: "Close" }));

      await user.press(dialogButton("Keep adding"));

      expect(dialogTitle()).not.toBeOnTheScreen();
      expect(searchHeading()).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: logTwoFoods })).toBeOnTheScreen();
    });

    it("should ask again on the next Close after Keep adding", async () => {
      const user = await openSearch(userEvent.setup());
      await putFoodsOnThePlate(user);
      await user.press(screen.getByRole("button", { name: "Close" }));
      await user.press(dialogButton("Keep adding"));

      await user.press(screen.getByRole("button", { name: "Close" }));

      expect(dialogTitle()).toBeOnTheScreen();
    });

    it("should leave the sheet, back to where it was opened, when Discard is pressed", async () => {
      const user = await openSearch(userEvent.setup());
      await putFoodsOnThePlate(user);
      await user.press(screen.getByRole("button", { name: "Close" }));

      await user.press(dialogButton("Discard"));

      expect(await screen.findByText("Recipes screen")).toBeOnTheScreen();
      expect(searchHeading()).not.toBeOnTheScreen();
      expect(dialogTitle()).not.toBeOnTheScreen();
      expect(mockLogEntries).not.toHaveBeenCalled();
    });

    it("should start a new sheet with an empty plate after Discard", async () => {
      const user = await openSearch(userEvent.setup());
      await putFoodsOnThePlate(user);
      await user.press(screen.getByRole("button", { name: "Close" }));
      await user.press(dialogButton("Discard"));
      expect(await screen.findByText("Recipes screen")).toBeOnTheScreen();

      await act(() => {
        router.push("/foods?day=2026-10-15");
      });

      expect(await screen.findByRole("heading", { name: "Log food" })).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: /^Log foods?\b/ })).not.toBeOnTheScreen();
    });
  });

  describe("the Android back button on the search", () => {
    it("should leave at once while the plate is empty", async () => {
      await openSearch(userEvent.setup());

      await pressAndroidBack();

      expect(await screen.findByText("Recipes screen")).toBeOnTheScreen();
      expect(dialogTitle()).not.toBeOnTheScreen();
    });

    it("should ask, and keep the sheet on Keep adding, with foods on the plate", async () => {
      const user = await openSearch(userEvent.setup());
      await putFoodsOnThePlate(user);

      await pressAndroidBack();
      expect(dialogTitle()).toBeOnTheScreen();
      await user.press(dialogButton("Keep adding"));

      expect(searchHeading()).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: logTwoFoods })).toBeOnTheScreen();
    });

    it("should leave the sheet when Discard is pressed", async () => {
      const user = await openSearch(userEvent.setup());
      await putFoodsOnThePlate(user);
      await pressAndroidBack();

      await user.press(dialogButton("Discard"));

      expect(await screen.findByText("Recipes screen")).toBeOnTheScreen();
    });
  });

  describe("the scanner", () => {
    async function openScannerWithFoodsOnThePlate() {
      const user = await openSearch(userEvent.setup());
      await putFoodsOnThePlate(user);
      await user.press(screen.getByRole("button", { name: "Scan barcode" }));
      expect(await screen.findByRole("heading", { name: "Scan barcode" })).toBeOnTheScreen();
      return user;
    }

    it("should ask on Close, which closes the whole sheet", async () => {
      const user = await openScannerWithFoodsOnThePlate();

      await user.press(screen.getByRole("button", { name: "Close" }));

      expect(dialogTitle()).toBeOnTheScreen();
      expect(dialogText("The 2 foods on it won't be logged.")).toBeOnTheScreen();
      expect(screen.queryByText("Recipes screen")).not.toBeOnTheScreen();
    });

    it("should stay on the scanner, with the plate, on Keep adding", async () => {
      const user = await openScannerWithFoodsOnThePlate();
      await user.press(screen.getByRole("button", { name: "Close" }));

      await user.press(dialogButton("Keep adding"));

      expect(dialogTitle()).not.toBeOnTheScreen();
      expect(scannerHeading()).toBeOnTheScreen();
    });

    it("should close the whole sheet on Discard", async () => {
      const user = await openScannerWithFoodsOnThePlate();
      await user.press(screen.getByRole("button", { name: "Close" }));

      await user.press(dialogButton("Discard"));

      expect(await screen.findByText("Recipes screen")).toBeOnTheScreen();
      expect(scannerHeading()).not.toBeOnTheScreen();
      expect(searchHeading()).not.toBeOnTheScreen();
    });

    it("should never ask on Back to search: the plate is kept", async () => {
      const user = await openScannerWithFoodsOnThePlate();

      await user.press(screen.getByRole("button", { name: "Back to search" }));

      expect(await screen.findByRole("heading", { name: "Log food" })).toBeOnTheScreen();
      expect(dialogTitle()).not.toBeOnTheScreen();
      expect(screen.getByRole("button", { name: logTwoFoods })).toBeOnTheScreen();
    });

    it("should never ask on the Android back button inside the sheet", async () => {
      await openScannerWithFoodsOnThePlate();

      await pressAndroidBack();

      expect(await screen.findByRole("heading", { name: "Log food" })).toBeOnTheScreen();
      expect(dialogTitle()).not.toBeOnTheScreen();
    });

    it("should close the sheet with no question while the plate is empty", async () => {
      const user = await openSearch(userEvent.setup());
      await user.press(screen.getByRole("button", { name: "Scan barcode" }));
      expect(await screen.findByRole("heading", { name: "Scan barcode" })).toBeOnTheScreen();

      await user.press(screen.getByRole("button", { name: "Close" }));

      expect(await screen.findByText("Recipes screen")).toBeOnTheScreen();
      expect(dialogTitle()).not.toBeOnTheScreen();
    });
  });

  describe("logging the plate", () => {
    async function plateWithARecipe() {
      const user = await openSearch(userEvent.setup());
      await type("chicken");
      await user.press(screen.getByRole("button", { name: addRecipe }));
      return user;
    }

    it("should close the sheet onto the diary with no question after a successful log", async () => {
      const user = await plateWithARecipe();

      await user.press(screen.getByRole("button", { name: logOneFood }));

      expect(await screen.findByRole("heading", { name: "Diary" })).toBeOnTheScreen();
      expect(mockLogEntries).toHaveBeenCalledTimes(1);
      expect(dialogTitle()).not.toBeOnTheScreen();
      expect(searchHeading()).not.toBeOnTheScreen();
    });

    it("should ask on Close again when the log failed and the plate is still there", async () => {
      mockLogEntries.mockRejectedValue(new Error("network down"));
      const user = await plateWithARecipe();
      await user.press(screen.getByRole("button", { name: logOneFood }));
      expect(
        await screen.findByText("Not logged. Check your connection and try again."),
      ).toBeOnTheScreen();

      await user.press(screen.getByRole("button", { name: "Close" }));

      expect(dialogTitle()).toBeOnTheScreen();
    });
  });

  it("should not ask in 'Your foods', which has no plate", async () => {
    const user = userEvent.setup();
    await render(<ExpoRoot context={getMockContext(routes)} location="/recipes" />);
    await act(() => {
      router.push("/foods?scope=own");
    });
    await user.press(await screen.findByRole("button", { name: "Close" }));

    expect(await screen.findByText("Recipes screen")).toBeOnTheScreen();
    expect(dialogTitle()).not.toBeOnTheScreen();
  });
});
