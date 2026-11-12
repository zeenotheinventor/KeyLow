import "react-native-gesture-handler/jestSetup";
import { buildFood, buildFoodPortion } from "@keylow/core/testing";
import { render, screen, userEvent, within } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import {
  foodQuery,
  mockLogFood,
  portionsQuery,
  resetApiClientMock,
  savedFoodId,
} from "./support/apiClientMock";
import PortionPickerRoute from "../../app/foods/[id]/log";
import { ToastProvider } from "../../components/ui";
import { PlateProvider } from "../../lib/plate";
import { ThemeProvider } from "../../lib/theme";
import { trackFieldSelection } from "../support/amountFieldSelection";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { Food } from "@keylow/core/schemas";

// The portion picker on its route, with the data hooks and the router mocked: what the boards draw, the
// amount and unit, the Time row, and what Add logs. The kit parts have their own tests.

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
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

setUpTests();

const openedAt = new Date("2026-10-15T11:40:30Z");

function renderRoute() {
  return render(
    <ThemeProvider fixedPreference="dark">
      <ToastProvider>
        <PlateProvider>
          <PortionPickerRoute />
        </PlateProvider>
      </ToastProvider>
    </ThemeProvider>,
  );
}

async function renderPicker() {
  routerMock.searchParams = { id: savedFoodId };
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  await renderRoute();
  return user;
}

function showFood(food: Food) {
  Object.assign(foodQuery, { data: food });
}

const amountField = () => screen.getByLabelText(/^Amount/);
const hero = (caption: string) => screen.getByLabelText(`Energy and macros, ${caption}`);

const bucket = buildFood({
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
const bucketPortion = buildFoodPortion({
  id: "55555555-5555-4555-8555-555555555555",
  food_id: savedFoodId,
  owner_id: null,
  label: "1 bucket",
  grams: null,
  ml: null,
  is_default: true,
  position: 0,
});

trackFieldSelection();

describe("the portion picker for a food with no published weight", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    jest.useFakeTimers({ now: openedAt });
    registerAppStyles(kitStyles);
    resetRouterMock();
    resetApiClientMock();
    showFood(bucket);
    Object.assign(portionsQuery, { data: [bucketPortion] });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("should open on 1 bucket with the portion as the only chip", async () => {
    await renderPicker();

    expect(amountField()).toHaveDisplayValue("1");
    expect(screen.getAllByRole("radio")).toHaveLength(1);
    expect(screen.getByRole("radio", { name: "1 bucket", checked: true })).toBeOnTheScreen();
    expect(screen.queryByRole("radio", { name: "g" })).not.toBeOnTheScreen();
  });

  it("should caption the hero with no size and list the values per bucket", async () => {
    await renderPicker();

    expect(within(hero("For 1 bucket")).getByText("500")).toBeOnTheScreen();
    expect(
      within(screen.getByLabelText("Per bucket")).getByLabelText("Energy, 500 kcal"),
    ).toBeOnTheScreen();
    expect(screen.queryByText(/100 g/)).not.toBeOnTheScreen();
    expect(screen.queryByLabelText(/per 100/i)).not.toBeOnTheScreen();
  });

  it("should work out 750 kcal for 1.5 portions and log them with no grams", async () => {
    const user = await renderPicker();

    await user.clear(amountField());
    await user.type(amountField(), "1.5");
    await user.press(screen.getByRole("button", { name: "Add" }));

    expect(within(hero("For 1.5 × 1 bucket")).getByText("750")).toBeOnTheScreen();
    expect(mockLogFood).toHaveBeenCalledWith(
      expect.objectContaining({
        food: bucket,
        quantity: 1.5,
        unit: "portion",
        portion: bucketPortion,
      }),
    );
  });

  it("should offer no Copy to your foods even when the food is missing a value", async () => {
    showFood({ ...bucket, fibre_g: null, protein_g: null });
    await renderPicker();

    expect(screen.queryByRole("button", { name: /copy to your foods/i })).not.toBeOnTheScreen();
  });
});
