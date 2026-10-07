import { FoodsPartialWriteError } from "@keylow/api-client";
import { render, screen, userEvent } from "@testing-library/react-native";

import {
  foodFixture,
  foodQuery,
  mockUpdateFood,
  mockUseFood,
  mockUseFoodPortions,
  portionFixtures,
  portionsQuery,
  resetApiClientMock,
  savedFoodId,
} from "./support/apiClientMock";
import EditFoodRoute from "../../app/foods/[id]/edit";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";

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
  await render(<EditFoodRoute />);
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

    expect(mockUseFood).toHaveBeenCalledWith(savedFoodId);
    expect(mockUseFoodPortions).toHaveBeenCalledWith(savedFoodId);
  });

  describe("states", () => {
    it("should show a loading message while the food loads", async () => {
      Object.assign(foodQuery, { data: undefined, isPending: true });

      await renderEditor();

      expect(screen.getByText("Loading food")).toBeOnTheScreen();
      expect(screen.queryByLabelText("Name")).not.toBeOnTheScreen();
    });

    it("should show a loading message while the portions load", async () => {
      Object.assign(portionsQuery, { data: undefined, isPending: true });

      await renderEditor();

      expect(screen.getByText("Loading food")).toBeOnTheScreen();
    });

    it("should keep the form when a later refresh of the food or portions fails", async () => {
      Object.assign(foodQuery, { isError: true });
      Object.assign(portionsQuery, { isError: true });

      await renderEditor();

      expect(screen.getByLabelText("Name")).toHaveDisplayValue("Oat bar");
      expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
    });

    it("should say the food was not found when the user cannot see it", async () => {
      Object.assign(foodQuery, { data: null });

      await renderEditor();

      expect(screen.getByRole("header", { name: "Food not found" })).toBeOnTheScreen();
      expect(screen.queryByLabelText("Name")).not.toBeOnTheScreen();
    });

    it("should say a shared food cannot be edited and show no form", async () => {
      Object.assign(foodQuery, {
        data: { ...foodFixture, source: "cofid", source_ref: "13-123", owner_id: null },
      });

      await renderEditor();

      expect(
        screen.getByText("This food comes from a shared database and cannot be edited."),
      ).toBeOnTheScreen();
      expect(screen.queryByLabelText("Name")).not.toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeOnTheScreen();
    });

    it("should announce a failure to load the food", async () => {
      Object.assign(foodQuery, { data: undefined, isPending: false, isError: true });

      await renderEditor();

      expect(
        screen.getByRole("alert", { name: "The food could not be loaded. Try again later." }),
      ).toBeOnTheScreen();
    });

    it("should announce a failure to load the portions", async () => {
      Object.assign(portionsQuery, { data: undefined, isPending: false, isError: true });

      await renderEditor();

      expect(
        screen.getByRole("alert", { name: "The food could not be loaded. Try again later." }),
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
      expect(screen.getByLabelText("Fibre (g)")).toHaveDisplayValue("6.5");
      expect(screen.getByRole("radio", { name: "Per 100 g" })).toBeChecked();
    });

    it("should fill the portions in their stored order with the default switched on", async () => {
      await renderEditor();

      expect(screen.getByLabelText("Portion 1 label")).toHaveDisplayValue("1 bar");
      expect(screen.getByLabelText("Portion 1 amount (g)")).toHaveDisplayValue("45");
      expect(screen.getByRole("switch", { name: "Portion 1 default" })).toBeChecked();
      expect(screen.getByLabelText("Portion 2 label")).toHaveDisplayValue("Box of 6");
      expect(screen.getByLabelText("Portion 2 amount (g)")).toHaveDisplayValue("270");
      expect(screen.getByRole("switch", { name: "Portion 2 default" })).not.toBeChecked();
    });

    it("should leave the optional fields blank when the food has no value for them", async () => {
      Object.assign(foodQuery, {
        data: { ...foodFixture, brand: null, barcode: null, fibre_g: null },
      });

      await renderEditor();

      expect(screen.getByLabelText("Brand")).toHaveDisplayValue("");
      expect(screen.getByLabelText("Barcode")).toHaveDisplayValue("");
      expect(screen.getByLabelText("Fibre (g)")).toHaveDisplayValue("");
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
      expect(screen.getByLabelText("Portion 1 amount (ml)")).toHaveDisplayValue("250");
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

      expect(
        await screen.findByRole("alert", { name: "Energy (kcal) is required" }),
      ).toBeOnTheScreen();
      expect(mockUpdateFood).not.toHaveBeenCalled();
    });

    it("should show the schema's message when stored portions have more than one default", async () => {
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
          name: "Your food could not be saved. Check your connection and try again.",
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
          name: "Your food was saved but its portions were not. Edit the food to add them again.",
        }),
      ).toBeOnTheScreen();
    });
  });
});
