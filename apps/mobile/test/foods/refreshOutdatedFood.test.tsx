import "react-native-gesture-handler/jestSetup";
import { render, screen } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import {
  foodFixture,
  foodQuery,
  mockUseRefreshOutdatedOffFood,
  resetApiClientMock,
  savedFoodId,
} from "./support/apiClientMock";
import FoodDetailRoute from "../../app/foods/[id]/index";
import PortionPickerRoute from "../../app/foods/[id]/log";
import { ToastProvider } from "../../components/ui";
import { PlateProvider } from "../../lib/plate";
import { ThemeProvider } from "../../lib/theme";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";

import type { ReactElement } from "react";

// The two food pages that load a food by id ask for the refresh of a branded food stored before the portion
// rules, and draw nothing of it: the hook has its own tests against the network.

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

const oldBrandedFood = {
  ...foodFixture,
  source: "off",
  source_ref: "5012345678900",
  owner_id: null,
  fetched_at: "2026-10-20T10:00:00+00:00",
} as const;

async function renderScreen(screenElement: ReactElement) {
  await render(
    <ThemeProvider fixedPreference="dark">
      <ToastProvider>
        <PlateProvider>{screenElement}</PlateProvider>
      </ToastProvider>
    </ThemeProvider>,
  );
}

describe.each([
  ["the food page", <FoodDetailRoute key="detail" />],
  ["the portion picker", <PortionPickerRoute key="picker" />],
])("%s", (_name, screenElement) => {
  beforeEach(() => {
    resetRouterMock();
    resetApiClientMock();
    routerMock.searchParams = { id: savedFoodId };
  });

  it("should ask for the refresh of the food it shows", async () => {
    Object.assign(foodQuery, { data: oldBrandedFood });

    await renderScreen(screenElement);

    expect(mockUseRefreshOutdatedOffFood).toHaveBeenLastCalledWith(oldBrandedFood);
  });

  it("should ask for the refresh of no food while the food is still loading", async () => {
    Object.assign(foodQuery, { data: undefined, isPending: true });

    await renderScreen(screenElement);

    expect(mockUseRefreshOutdatedOffFood).toHaveBeenLastCalledWith(undefined);
  });

  it("should ask for the refresh of no food that is not there", async () => {
    Object.assign(foodQuery, { data: null });

    await renderScreen(screenElement);

    expect(mockUseRefreshOutdatedOffFood).toHaveBeenLastCalledWith(undefined);
  });

  it("should still draw the food from the portions it has", async () => {
    Object.assign(foodQuery, { data: oldBrandedFood });

    await renderScreen(screenElement);

    expect(screen.getByRole("heading", { name: oldBrandedFood.name })).toBeOnTheScreen();
  });
});
