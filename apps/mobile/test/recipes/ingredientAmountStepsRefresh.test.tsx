import "react-native-gesture-handler/jestSetup";

import { KeyLowProvider, keys } from "@keylow/api-client";
import { buildRecipeIngredient } from "@keylow/core/recipes";
import { buildFood, buildFoodPortion } from "@keylow/core/testing";
import { QueryClient } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import { AddIngredientAmountStep } from "../../components/AddIngredientAmountStep";
import { IngredientAmountStep } from "../../components/IngredientAmountStep";
import { ThemeProvider } from "../../lib/theme";
import { entryBackend, entryClient, resetEntryBackend } from "../support/entryBackend";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { Food, FoodPortion } from "@keylow/core/schemas";
import type { ReactElement } from "react";

// The two amount steps of the recipe editor ask for the refresh of a branded food stored before the portion
// rules, as the diary's picker does, through the real hook and its real caches over the fake database. The
// chips follow the answer on the open screen, with no spinner and no message. The ingredient's own values
// never move.

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);

setUpTests();

const BARCODE = "5012345678900";
const oldFood: Food = buildFood({
  id: "11111111-1111-4111-8111-111111111111",
  source: "off",
  source_ref: BARCODE,
  owner_id: null,
  name: "Oat bar",
  kcal: 420,
  protein_g: 8.5,
  fat_g: 14,
  carbs_g: 62,
  fetched_at: "2026-10-20T10:00:00+00:00",
});
const oldPortion: FoodPortion = buildFoodPortion({
  id: "22222222-2222-4222-8222-222222222222",
  food_id: oldFood.id,
  owner_id: null,
  label: "1 bar",
  grams: 45,
  is_default: true,
  position: 0,
});
const refreshedFood: Food = { ...oldFood, fetched_at: "2026-10-24T10:00:00+00:00" };
const refreshedPortions: FoodPortion[] = [
  { ...oldPortion, id: "33333333-3333-4333-8333-333333333333" },
  buildFoodPortion({
    id: "44444444-4444-4444-8444-444444444444",
    food_id: oldFood.id,
    owner_id: null,
    label: "1 can",
    grams: 330,
    position: 1,
  }),
];

let queryClient: QueryClient;

/** Holds the answer of `off-product` until the returned function is called, so the screen can be looked at before it lands. */
function holdOffProduct(): () => void {
  let release: () => void = () => undefined;
  entryBackend.offProductHeldUntil = new Promise<void>((resolve) => {
    release = resolve;
  });

  return release;
}

/** The food and its portions as the app already holds them, so the step opens at once, as it does from a search. */
function renderStep(step: ReactElement) {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity, staleTime: Infinity } },
  });
  queryClient.setQueryData(keys.foods.detail(oldFood.id), oldFood);
  queryClient.setQueryData(keys.foods.portions(oldFood.id), [oldPortion]);

  return render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={entryClient} queryClient={queryClient}>
        {step}
      </KeyLowProvider>
    </ThemeProvider>,
  );
}

const addStep = (
  <AddIngredientAmountStep foodId={oldFood.id} onAdd={jest.fn()} onBack={jest.fn()} />
);
const editStep = (
  <IngredientAmountStep
    ingredient={buildRecipeIngredient(oldFood, {
      quantity: 2,
      unit: "portion",
      portion: oldPortion,
    })}
    onBack={jest.fn()}
    onRemove={jest.fn()}
    onSave={jest.fn()}
  />
);

describe.each([
  ["the add step", addStep],
  ["the edit step", editStep],
])("%s", (_name, step) => {
  let kitStyles: string;
  let consoleSpies: jest.SpyInstance[];

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/AddIngredientAmountStep",
      "components/IngredientAmountStep",
      "components/PortionPicker",
      "components/FoodLoadState",
    ]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetEntryBackend();
    entryBackend.foods = [oldFood];
    entryBackend.foodPortions = [oldPortion];
    entryBackend.offProduct = { food: refreshedFood, portions: refreshedPortions };
    consoleSpies = (["log", "info", "warn", "error"] as const).map((method) =>
      jest.spyOn(console, method).mockImplementation(() => undefined),
    );
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await cleanup();
    await act(() => {
      queryClient.clear();
    });
  });

  it("should offer the new portion once the refresh lands, without a spinner or a message", async () => {
    const releaseAnswer = holdOffProduct();
    await renderStep(step);
    await waitFor(() => {
      expect(entryBackend.offProductCodes).toEqual([BARCODE]);
    });
    expect(screen.getByRole("radio", { name: "1 bar" })).toBeOnTheScreen();
    expect(screen.queryByRole("radio", { name: "1 can" })).not.toBeOnTheScreen();

    await act(() => {
      releaseAnswer();
    });

    expect(await screen.findByRole("radio", { name: "1 can" })).toBeOnTheScreen();

    expect(entryBackend.offProductCodes).toEqual([BARCODE]);
    expect(screen.queryByRole("status")).not.toBeOnTheScreen();
    expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
    consoleSpies.forEach((spy) => {
      expect(spy).not.toHaveBeenCalled();
    });
  });

  it("should keep the chips it has, and say nothing, when Open Food Facts does not know the product", async () => {
    entryBackend.offProduct = null;

    await renderStep(step);
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));

    expect(entryBackend.offProductCodes).toEqual([BARCODE]);
    expect(screen.getByRole("radio", { name: "1 bar" })).toBeOnTheScreen();
    expect(screen.queryByRole("radio", { name: "1 can" })).not.toBeOnTheScreen();
    expect(screen.queryByRole("status")).not.toBeOnTheScreen();
    expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
    consoleSpies.forEach((spy) => {
      expect(spy).not.toHaveBeenCalled();
    });
  });
});

describe("the edit step after a refresh", () => {
  beforeAll(async () => {
    registerAppStyles(
      await compileKitStyles("", [
        "components/IngredientAmountStep",
        "components/PortionPicker",
        "components/FoodLoadState",
      ]),
    );
  });

  beforeEach(() => {
    resetEntryBackend();
    entryBackend.foods = [oldFood];
    entryBackend.foodPortions = [oldPortion];
    entryBackend.offProduct = {
      food: { ...refreshedFood, kcal: 999 },
      portions: refreshedPortions,
    };
  });

  afterEach(async () => {
    await cleanup();
    await act(() => {
      queryClient.clear();
    });
  });

  it("should keep the ingredient's own values and amount, whatever the refreshed food says", async () => {
    await renderStep(editStep);
    await screen.findByRole("radio", { name: "1 can" });

    const list = screen.getByLabelText("Per 100 g");
    expect(within(list).getByLabelText("Energy, 420 kcal")).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Amount/)).toHaveDisplayValue("2");
    expect(screen.getByRole("radio", { name: "1 bar", checked: true })).toBeOnTheScreen();
  });
});
