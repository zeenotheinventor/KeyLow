import { FoodsPartialWriteError } from "@keylow/api-client";
import { render, screen, userEvent } from "@testing-library/react-native";

import {
  foodFixture,
  foodQuery,
  mockCreateFood,
  mockUpdateFood,
  mockUseFoodWithPortions,
  portionFixtures,
  portionsQuery,
  resetApiClientMock,
  savedFoodId,
} from "./support/apiClientMock";
import EditFoodRoute from "../../app/foods/[id]/edit";
import { ThemeProvider } from "../../lib/theme";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";

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

async function renderEditor() {
  const user = userEvent.setup();
  await render(
    <ThemeProvider fixedPreference="dark">
      <EditFoodRoute />
    </ThemeProvider>,
  );
  return user;
}

async function save(user: Awaited<ReturnType<typeof renderEditor>>) {
  await user.press(screen.getByRole("button", { name: "Save changes" }));
}

describe("edit food screen", () => {
  beforeEach(() => {
    resetRouterMock();
    resetApiClientMock();
    routerMock.searchParams = { id: savedFoodId };
  });

  it("should load the food and its portions by the id in the route", async () => {
    await renderEditor();

    expect(mockUseFoodWithPortions).toHaveBeenCalledWith(savedFoodId);
  });

  describe("header", () => {
    it("should be headed Edit food, with Back and Close", async () => {
      await renderEditor();

      expect(screen.getByRole("heading", { name: "Edit food" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Back" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Close" })).toBeOnTheScreen();
    });

    it("should go back on Back without saving, whatever has been changed", async () => {
      const user = await renderEditor();
      await user.type(screen.getByLabelText("Name"), " extra");

      await user.press(screen.getByRole("button", { name: "Back" }));

      expect(routerMock.back).toHaveBeenCalledTimes(1);
      expect(mockUpdateFood).not.toHaveBeenCalled();
    });

    it("should close the whole sheet on Close without saving, whatever has been changed", async () => {
      const user = await renderEditor();
      await user.type(screen.getByLabelText("Name"), " extra");

      await user.press(screen.getByRole("button", { name: "Close" }));

      expect(routerMock.parentGoBack).toHaveBeenCalledTimes(1);
      expect(routerMock.back).not.toHaveBeenCalled();
      expect(mockUpdateFood).not.toHaveBeenCalled();
      expect(mockCreateFood).not.toHaveBeenCalled();
    });
  });

  describe("states", () => {
    // The food boards draw the loading, failed and not found states of a food, under their own header.
    function expectFoodHeader() {
      expect(screen.getByText("Food")).toBeOnTheScreen();
      expect(screen.queryByRole("heading", { name: "Food" })).not.toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Back" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Close" })).toBeOnTheScreen();
    }

    it("should show the loading board while the food loads", async () => {
      Object.assign(foodQuery, { data: undefined, isPending: true });

      await renderEditor();

      expect(screen.getByRole("status", { name: "Loading food" })).toBeOnTheScreen();
      expect(screen.getByText("Loading food")).toBeOnTheScreen();
      expectFoodHeader();
      expect(screen.queryByLabelText("Name")).not.toBeOnTheScreen();
    });

    it("should show the loading board while the portions load", async () => {
      Object.assign(portionsQuery, { data: undefined, isPending: true });

      await renderEditor();

      expect(screen.getByRole("status", { name: "Loading food" })).toBeOnTheScreen();
    });

    it("should keep the form when a later refresh of the food or portions fails", async () => {
      Object.assign(foodQuery, { isError: true });
      Object.assign(portionsQuery, { isError: true });

      await renderEditor();

      expect(screen.getByLabelText("Name")).toHaveDisplayValue("Oat bar");
      expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
    });

    it("should show the not found board when the user cannot see the food", async () => {
      Object.assign(foodQuery, { data: null });

      await renderEditor();

      expect(screen.getByRole("heading", { name: "Food not found" })).toBeOnTheScreen();
      expect(screen.getByText("This food does not exist, or you cannot see it.")).toBeOnTheScreen();
      expectFoodHeader();
      expect(screen.queryByLabelText("Name")).not.toBeOnTheScreen();
    });

    it("should show the not found board for an id that is not a food id, without asking for it", async () => {
      routerMock.searchParams = { id: "not-a-food-id" };

      await renderEditor();

      expect(screen.getByRole("heading", { name: "Food not found" })).toBeOnTheScreen();
      expectFoodHeader();
      expect(mockUseFoodWithPortions).not.toHaveBeenCalledWith("not-a-food-id");
    });

    it("should say a shared food cannot be edited, under the Edit food header, and show no form", async () => {
      Object.assign(foodQuery, {
        data: { ...foodFixture, source: "cofid", source_ref: "13-123", owner_id: null },
      });

      await renderEditor();

      expect(screen.getByRole("heading", { name: "Edit food" })).toBeOnTheScreen();
      expect(screen.getByRole("heading", { name: "Cannot edit this food" })).toBeOnTheScreen();
      expect(
        screen.getByText("This food comes from a shared database and cannot be edited."),
      ).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Back" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Close" })).toBeOnTheScreen();
      expect(screen.queryByLabelText("Name")).not.toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeOnTheScreen();
    });

    it("should show the failed board when the food fails to load, with a fixed sentence", async () => {
      Object.assign(foodQuery, { data: undefined, isPending: false, isError: true });

      await renderEditor();

      expect(
        screen.getByRole("alert", {
          name: "Food not loaded The food could not be loaded. Try again later.",
        }),
      ).toBeOnTheScreen();
      expectFoodHeader();
      expect(screen.queryByText(/The food query failed/)).not.toBeOnTheScreen();
    });

    it("should show the failed board when the portions fail to load", async () => {
      Object.assign(portionsQuery, { data: undefined, isPending: false, isError: true });

      await renderEditor();

      expect(
        screen.getByRole("alert", {
          name: "Food not loaded The food could not be loaded. Try again later.",
        }),
      ).toBeOnTheScreen();
    });
  });

  describe("pre-fill", () => {
    it("should fill every field from the food", async () => {
      await renderEditor();

      expect(screen.getByLabelText("Name")).toHaveDisplayValue("Oat bar");
      expect(screen.getByLabelText("Brand")).toHaveDisplayValue("Acme");
      expect(screen.getByLabelText("Barcode")).toHaveDisplayValue("5012345678900");
      expect(screen.getByLabelText("Energy (kcal)")).toHaveDisplayValue("420");
      expect(screen.getByLabelText("Protein (g)")).toHaveDisplayValue("8.5");
      expect(screen.getByLabelText("Fat (g)")).toHaveDisplayValue("14");
      expect(screen.getByLabelText("Carbohydrate (g)")).toHaveDisplayValue("62");
      expect(screen.getByLabelText("Fibre (optional) (g)")).toHaveDisplayValue("6.5");
      expect(screen.getByRole("radio", { name: "Per 100 g" })).toBeChecked();
    });

    it("should fill the portions in their stored order with the default switched on", async () => {
      await renderEditor();

      expect(screen.getByLabelText("Portion label, portion 1")).toHaveDisplayValue("1 bar");
      expect(screen.getByLabelText("Amount for portion 1 (g)")).toHaveDisplayValue("45");
      expect(screen.getByRole("switch", { name: "Portion 1 is the default" })).toBeChecked();
      expect(screen.getByLabelText("Portion label, portion 2")).toHaveDisplayValue("Box of 6");
      expect(screen.getByLabelText("Amount for portion 2 (g)")).toHaveDisplayValue("270");
      expect(screen.getByRole("switch", { name: "Portion 2 is the default" })).not.toBeChecked();
    });

    it("should leave the optional fields blank when the food has no value for them", async () => {
      Object.assign(foodQuery, {
        data: { ...foodFixture, brand: null, barcode: null, fibre_g: null },
      });

      await renderEditor();

      expect(screen.getByLabelText("Brand")).toHaveDisplayValue("");
      expect(screen.getByLabelText("Barcode")).toHaveDisplayValue("");
      expect(screen.getByLabelText("Fibre (optional) (g)")).toHaveDisplayValue("");
    });

    it("should keep the barcode editable", async () => {
      await renderEditor();

      expect(screen.getByLabelText("Barcode")).toHaveProp("editable", true);
    });

    it("should show ml portions for a per 100 ml food", async () => {
      Object.assign(foodQuery, { data: { ...foodFixture, basis: "per_100ml" } });
      Object.assign(portionsQuery, {
        data: [{ ...portionFixtures[0], label: "1 glass", grams: null, ml: 250 }],
      });

      await renderEditor();

      expect(screen.getByRole("radio", { name: "Per 100 ml" })).toBeChecked();
      expect(screen.getByLabelText("Amount for portion 1 (ml)")).toHaveDisplayValue("250");
    });
  });

  describe("saving", () => {
    it("should update the food once with the edited input and open it", async () => {
      const user = await renderEditor();
      await user.clear(screen.getByLabelText("Name"));
      await user.type(screen.getByLabelText("Name"), "Big oat bar");
      await user.press(screen.getByRole("button", { name: "Remove portion Box of 6" }));

      await save(user);

      expect(mockUpdateFood).toHaveBeenCalledTimes(1);
      expect(mockUpdateFood).toHaveBeenCalledWith({
        id: savedFoodId,
        input: {
          name: "Big oat bar",
          brand: "Acme",
          barcode: "5012345678900",
          basis: "per_100g",
          kcal: 420,
          protein_g: 8.5,
          fat_g: 14,
          carbs_g: 62,
          fibre_g: 6.5,
          portions: [{ label: "1 bar", grams: 45, isDefault: true }],
        },
      });
      expect(routerMock.replace).toHaveBeenCalledWith(`/foods/${savedFoodId}`);
    });

    it("should send no saturated fat, sugars or salt, so an update never touches them", async () => {
      Object.assign(foodQuery, {
        data: { ...foodFixture, sat_fat_g: 1, sugars_g: 2, salt_g: 0.1 },
      });
      const user = await renderEditor();

      await save(user);

      expect(mockUpdateFood).toHaveBeenCalledTimes(1);
      for (const key of ["sat_fat_g", "sugars_g", "salt_g"]) {
        expect(mockUpdateFood.mock.calls[0]?.[0].input).not.toHaveProperty(key);
      }
    });

    it("should carry an existing density through so saving does not clear it", async () => {
      Object.assign(foodQuery, { data: { ...foodFixture, density_g_per_ml: 1.03 } });
      const user = await renderEditor();

      await save(user);

      expect(mockUpdateFood.mock.calls[0]?.[0].input).toHaveProperty("density_g_per_ml", 1.03);
    });

    it("should clear the brand when the user empties it", async () => {
      const user = await renderEditor();
      await user.clear(screen.getByLabelText("Brand"));

      await save(user);

      expect(mockUpdateFood.mock.calls[0]?.[0].input).not.toHaveProperty("brand");
    });

    it("should not update when a required field has been emptied", async () => {
      const user = await renderEditor();
      await user.clear(screen.getByLabelText("Energy (kcal)"));

      await save(user);

      expect(await screen.findByRole("alert", { name: "Energy is required" })).toBeOnTheScreen();
      expect(mockUpdateFood).not.toHaveBeenCalled();
    });

    it("should say at most one portion can be the default when stored portions have more than one", async () => {
      Object.assign(portionsQuery, {
        data: portionFixtures.map((portion) => ({ ...portion, is_default: true })),
      });
      const user = await renderEditor();

      await save(user);

      expect(
        await screen.findByRole("alert", { name: "At most one portion can be the default" }),
      ).toBeOnTheScreen();
      expect(mockUpdateFood).not.toHaveBeenCalled();
    });

    it("should show the failure and stay on the screen when the update fails", async () => {
      mockUpdateFood.mockRejectedValue(new Error("not allowed"));
      const user = await renderEditor();

      await save(user);

      expect(
        await screen.findByRole("alert", {
          name: "Your food could not be saved Check your connection and try again.",
        }),
      ).toBeOnTheScreen();
      expect(routerMock.replace).not.toHaveBeenCalled();
    });

    it("should say the portions were not saved after a partial write", async () => {
      mockUpdateFood.mockRejectedValue(
        new FoodsPartialWriteError(savedFoodId, "portions failed", new Error("insert failed")),
      );
      const user = await renderEditor();

      await save(user);

      expect(
        await screen.findByRole("alert", {
          name: "Portions not saved Your food was saved but its portions were not. Save again to add them.",
        }),
      ).toBeOnTheScreen();
    });
  });
});
