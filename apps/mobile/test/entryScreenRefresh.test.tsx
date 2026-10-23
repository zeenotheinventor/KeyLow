import "react-native-gesture-handler/jestSetup";

import { KeyLowProvider } from "@keylow/api-client";
import { buildFood, buildFoodPortion } from "@keylow/core/testing";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import EntryRoute from "../app/entry/[id]";
import { ToastProvider } from "../components/ui";
import { ThemeProvider } from "../lib/theme";
import { createDiaryQueryClient, diaryBackend, sampleDay } from "./support/diaryBackend";
import { entryBackend, entryClient, resetEntryBackend } from "./support/entryBackend";
import { resetRouterMock, routerMock } from "./support/expoRouterMock";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";

import type { Food } from "@keylow/core/schemas";
import type { QueryClient } from "@tanstack/react-query";

// The entry screen of a food entry whose food is a branded product stored before the portion rules: opening
// it asks `off-product` once, and the new portions appear as chips with nothing else on the screen changing.
// The network is the fake database of `entryBackend`.

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("./support/expoRouterMock").mockExpoRouter,
);
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);

setUpTests();

const CHICKEN_INDEX = 3;
const FOOD_ID = "22222222-2222-4222-8222-222222222222";
const BARCODE = "5012345678900";
const OLD_FETCH = "2026-10-20T10:00:00+00:00";
const NEW_FETCH = "2026-10-24T10:00:00+00:00";

const brandedFood = (fetchedAt: string): Food =>
  buildFood({
    id: FOOD_ID,
    name: "Chicken breast, grilled",
    kcal: 148,
    protein_g: 32,
    fat_g: 2.2,
    carbs_g: 0,
    source: "off",
    source_ref: BARCODE,
    owner_id: null,
    fetched_at: fetchedAt,
  });

const can = buildFoodPortion({ food_id: FOOD_ID, label: "1 can", grams: 330 });

let queryClient: QueryClient;

async function renderEntry() {
  routerMock.searchParams = { id: String(diaryBackend.entries[CHICKEN_INDEX]?.["id"]) };
  queryClient = createDiaryQueryClient();
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={entryClient} queryClient={queryClient}>
        <ToastProvider>
          <EntryRoute />
        </ToastProvider>
      </KeyLowProvider>
    </ThemeProvider>,
  );
  await screen.findByRole("heading", { name: "Chicken breast, grilled" });
}

describe("the entry screen of a branded food stored before the portion rules", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/QuickAddForm",
      "components/EntryScreen",
      "components/PortionPicker",
    ]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetRouterMock();
    resetEntryBackend();
    diaryBackend.entries = sampleDay();
  });

  afterEach(async () => {
    await cleanup();
    queryClient.clear();
  });

  it("should ask off-product once for the food's code and show the portions it answers with", async () => {
    entryBackend.foods = [brandedFood(OLD_FETCH)];
    entryBackend.offProduct = { food: brandedFood(NEW_FETCH), portions: [can] };

    await renderEntry();

    expect(await screen.findByRole("radio", { name: "1 can" })).toBeOnTheScreen();
    expect(entryBackend.offProductCodes).toEqual([BARCODE]);
  });

  it("should leave the logged amount and its unit as they were when the portions arrive", async () => {
    entryBackend.foods = [brandedFood(OLD_FETCH)];
    entryBackend.offProduct = { food: brandedFood(NEW_FETCH), portions: [can] };

    await renderEntry();
    await screen.findByRole("radio", { name: "1 can" });

    expect(screen.getByRole("radio", { name: "g", checked: true })).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Amount/)).toHaveDisplayValue("150");
  });

  it("should keep the screen as it was when off-product fails", async () => {
    entryBackend.foods = [brandedFood(OLD_FETCH)];
    entryBackend.offProduct = null;

    await renderEntry();
    await waitFor(() => {
      expect(entryBackend.offProductCodes).toEqual([BARCODE]);
    });
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));

    expect(screen.getByRole("heading", { name: "Chicken breast, grilled" })).toBeOnTheScreen();
    expect(screen.queryByRole("radio", { name: "1 can" })).not.toBeOnTheScreen();
    expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
  });

  it("should not ask off-product for a food fetched since the rules", async () => {
    entryBackend.foods = [brandedFood(NEW_FETCH)];
    entryBackend.offProduct = { food: brandedFood(NEW_FETCH), portions: [can] };

    await renderEntry();
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));

    expect(entryBackend.offProductCodes).toEqual([]);
    expect(screen.queryByRole("radio", { name: "1 can" })).not.toBeOnTheScreen();
  });
});
