import { buildFood, buildFoodPortion } from "@keylow/core/testing";
import { render, screen, within } from "@testing-library/react-native";

import { foodQuery, portionsQuery, resetApiClientMock, savedFoodId } from "./support/apiClientMock";
import FoodDetailRoute from "../../app/foods/[id]/index";
import { ToastProvider } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";

import type { Food, FoodPortion } from "@keylow/core/schemas";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
// The real provider renders nothing until the device reports its insets.
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);
jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("../support/expoRouterMock").mockExpoRouter,
);
jest.mock(
  "@keylow/api-client",
  () => jest.requireActual<{ mockApiClient: unknown }>("./support/apiClientMock").mockApiClient,
);

const bucket: Food = buildFood({
  id: savedFoodId,
  owner_id: null,
  source: "restaurant",
  name: "Bargain bucket",
  basis: "per_portion",
  kcal: 500,
  protein_g: 40,
  fat_g: 30,
  carbs_g: 20,
  fibre_g: null,
});
const bucketPortion: FoodPortion = buildFoodPortion({
  id: "55555555-5555-4555-8555-555555555555",
  food_id: savedFoodId,
  owner_id: null,
  label: "1 bucket",
  grams: null,
  ml: null,
  is_default: true,
});

function renderDetail() {
  return render(
    <ThemeProvider fixedPreference="dark">
      <ToastProvider>
        <FoodDetailRoute />
      </ToastProvider>
    </ThemeProvider>,
  );
}

describe("the food detail of a food with no published weight", () => {
  beforeEach(() => {
    resetRouterMock();
    resetApiClientMock();
    routerMock.searchParams = { id: savedFoodId };
    Object.assign(foodQuery, { data: bucket });
    Object.assign(portionsQuery, { data: [bucketPortion] });
  });

  it("should say per bucket where it would say per 100 g", async () => {
    await renderDetail();

    expect(screen.getByText("per bucket")).toBeOnTheScreen();
    expect(screen.getByRole("heading", { name: "Nutrition per bucket" })).toBeOnTheScreen();
    expect(screen.queryByText(/100 g/)).not.toBeOnTheScreen();
  });

  it("should list its portion with no size", async () => {
    await renderDetail();

    const portions = screen.getByLabelText("Portions");
    expect(within(portions).getByRole("listitem", { name: "1 bucket, Default" })).toBeOnTheScreen();
    expect(screen.queryByText(/\b0 g\b/)).not.toBeOnTheScreen();
  });

  it("should offer no Copy to your foods when it is missing a value", async () => {
    Object.assign(foodQuery, {
      data: {
        ...bucket,
        protein_g: null,
        quality: { suspect: true, fields_missing: ["protein_g"] },
      },
    });
    await renderDetail();

    expect(screen.getByText("Needs review")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Copy to your foods" })).not.toBeOnTheScreen();
  });
});
