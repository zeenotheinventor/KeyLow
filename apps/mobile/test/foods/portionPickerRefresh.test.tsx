import "react-native-gesture-handler/jestSetup";
import { buildFoodPortion } from "@keylow/core/testing";
import { render, screen, userEvent } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import {
  portionFixtures,
  portionsQuery,
  resetApiClientMock,
  savedFoodId,
} from "./support/apiClientMock";
import PortionPickerRoute from "../../app/foods/[id]/log";
import { ToastProvider } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { FoodPortion } from "@keylow/core/schemas";

// A refresh of a branded food gives every portion a new id while the picker is open. The picker keeps
// the chip the user was on and the amount typed, by the chip's label, and moves to the default only when the
// label is gone.

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

const withNewIds = (portions: FoodPortion[]): FoodPortion[] =>
  portions.map((portion, index) => ({
    ...portion,
    id: `99999999-9999-4999-8999-99999999999${index}`,
  }));

// A new element each time, so a rerender is not skipped as unchanged.
const pickerTree = () => (
  <ThemeProvider fixedPreference="dark">
    <ToastProvider>
      <PortionPickerRoute />
    </ToastProvider>
  </ThemeProvider>
);

const amountField = () => screen.getByLabelText(/^Amount/);

describe("the portion picker when the portions are replaced under it", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetRouterMock();
    resetApiClientMock();
    routerMock.searchParams = { id: savedFoodId };
  });

  it("should keep the chip with the same label checked and Add enabled when the ids are new", async () => {
    await render(pickerTree());
    expect(screen.getByRole("radio", { name: "1 bar", checked: true })).toBeOnTheScreen();

    Object.assign(portionsQuery, { data: withNewIds(portionFixtures) });
    await screen.rerender(pickerTree());

    expect(screen.getByRole("radio", { name: "1 bar", checked: true })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Add" })).toBeEnabled();
  });

  it("should keep the amount the user typed", async () => {
    const user = userEvent.setup();
    await render(pickerTree());
    await user.clear(amountField());
    await user.type(amountField(), "2.5");

    Object.assign(portionsQuery, { data: withNewIds(portionFixtures) });
    await screen.rerender(pickerTree());

    expect(amountField()).toHaveDisplayValue("2.5");
    expect(screen.getByRole("radio", { name: "1 bar", checked: true })).toBeOnTheScreen();
  });

  it("should keep a chip the user chose, not go back to the default", async () => {
    const user = userEvent.setup();
    await render(pickerTree());
    await user.press(screen.getByRole("radio", { name: "Box of 6" }));

    Object.assign(portionsQuery, { data: withNewIds(portionFixtures) });
    await screen.rerender(pickerTree());

    expect(screen.getByRole("radio", { name: "Box of 6", checked: true })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Add" })).toBeEnabled();
  });

  it("should not show the old id as the unit of the amount", async () => {
    await render(pickerTree());

    Object.assign(portionsQuery, { data: withNewIds(portionFixtures) });
    await screen.rerender(pickerTree());

    expect(screen.queryByText(/33333333/)).not.toBeOnTheScreen();
  });

  it("should move to the new default and start the amount again when the label is gone", async () => {
    const user = userEvent.setup();
    await render(pickerTree());
    await user.clear(amountField());
    await user.type(amountField(), "3");

    Object.assign(portionsQuery, {
      data: [
        buildFoodPortion({
          id: "88888888-8888-4888-8888-888888888880",
          food_id: savedFoodId,
          label: "1 can",
          grams: 330,
          is_default: true,
          position: 0,
        }),
      ],
    });
    await screen.rerender(pickerTree());

    expect(screen.getByRole("radio", { name: "1 can", checked: true })).toBeOnTheScreen();
    expect(amountField()).toHaveDisplayValue("1");
    expect(screen.getByRole("button", { name: "Add" })).toBeEnabled();
  });

  it("should fall back to g with 100 when the label is gone and there is no default portion", async () => {
    await render(pickerTree());

    Object.assign(portionsQuery, { data: [] });
    await screen.rerender(pickerTree());

    expect(screen.getByRole("radio", { name: "g", checked: true })).toBeOnTheScreen();
    expect(amountField()).toHaveDisplayValue("100");
    expect(screen.getByRole("button", { name: "Add" })).toBeEnabled();
  });
});
