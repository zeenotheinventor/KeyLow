import { FoodsPartialWriteError } from "@keylow/api-client";
import { render, screen, userEvent } from "@testing-library/react-native";

import {
  foodFixture,
  foodQuery,
  mockCreateFood,
  mockUpdateFood,
  mockUseFood,
  mockUseFoodPortions,
  portionFixtures,
  portionsQuery,
  resetApiClientMock,
  savedFoodId,
} from "./support/apiClientMock";
import NewFoodRoute from "../../app/foods/new";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";

import type { Food } from "@keylow/core/schemas";

jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("../support/expoRouterMock").mockExpoRouter,
);
jest.mock(
  "@keylow/api-client",
  () => jest.requireActual<{ mockApiClient: unknown }>("./support/apiClientMock").mockApiClient,
);

const copiedFoodId = "77777777-7777-4777-8777-777777777777";

// An Open Food Facts product that came without its protein and carbohydrate.
const suspectFood: Food = {
  ...foodFixture,
  source: "off",
  source_ref: "5012345678900",
  owner_id: null,
  name: "Crunchy granola",
  brand: "Nature's Best",
  quality: { suspect: true, fields_missing: ["protein_g", "carbs_g"] },
  protein_g: null,
  carbs_g: null,
};

async function renderCopy() {
  const user = userEvent.setup();
  await render(<NewFoodRoute />);
  return user;
}

async function fillMissingValues(user: Awaited<ReturnType<typeof renderCopy>>) {
  await user.type(screen.getByLabelText("Protein (g)"), "9");
  await user.type(screen.getByLabelText("Carbohydrate (g)"), "60");
}

async function save(user: Awaited<ReturnType<typeof renderCopy>>) {
  await user.press(screen.getByRole("button", { name: "Save as my food" }));
}

describe("new food screen, copying a food with the from parameter", () => {
  beforeEach(() => {
    resetRouterMock();
    resetApiClientMock();
    routerMock.searchParams = { from: savedFoodId };
    Object.assign(foodQuery, { data: suspectFood });
    mockCreateFood.mockResolvedValue({ food: { ...foodFixture, id: copiedFoodId }, portions: [] });
  });

  it("should load the food to copy and its portions by the id in the parameter", async () => {
    await renderCopy();

    expect(mockUseFood).toHaveBeenCalledWith(savedFoodId);
    expect(mockUseFoodPortions).toHaveBeenCalledWith(savedFoodId);
  });

  describe("states", () => {
    it("should show a loading message while the food loads", async () => {
      Object.assign(foodQuery, { data: undefined, isPending: true });

      await renderCopy();

      expect(screen.getByText("Loading food")).toBeOnTheScreen();
      expect(screen.queryByLabelText("Name")).not.toBeOnTheScreen();
    });

    it("should show a loading message while the portions load", async () => {
      Object.assign(portionsQuery, { data: undefined, isPending: true });

      await renderCopy();

      expect(screen.getByText("Loading food")).toBeOnTheScreen();
    });

    it("should show an alert when the food cannot be loaded", async () => {
      Object.assign(foodQuery, { data: undefined, isPending: false, isError: true });

      await renderCopy();

      expect(
        screen.getByRole("alert", { name: "The food could not be loaded. Try again later." }),
      ).toBeOnTheScreen();
      expect(screen.queryByLabelText("Name")).not.toBeOnTheScreen();
    });

    it("should keep the form the user is filling in when a later refresh of the food fails", async () => {
      const user = await renderCopy();
      await user.type(screen.getByLabelText("Protein (g)"), "9");

      Object.assign(foodQuery, { isError: true });
      Object.assign(portionsQuery, { isError: true });
      await user.type(screen.getByLabelText("Carbohydrate (g)"), "60");

      expect(screen.getByLabelText("Protein (g)")).toHaveDisplayValue("9");
      expect(screen.getByLabelText("Carbohydrate (g)")).toHaveDisplayValue("60");
      expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
    });

    it("should show the form when the food and portions have loaded but a refresh failed", async () => {
      Object.assign(foodQuery, { isError: true });
      Object.assign(portionsQuery, { isError: true });

      await renderCopy();

      expect(screen.getByLabelText("Name")).toHaveDisplayValue("Crunchy granola");
      expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
    });

    it("should say the food was not found when it is not visible", async () => {
      Object.assign(foodQuery, { data: null });

      await renderCopy();

      expect(screen.getByRole("header", { name: "Food not found" })).toBeOnTheScreen();
      expect(screen.queryByLabelText("Name")).not.toBeOnTheScreen();
    });
  });

  describe("pre-filling the form", () => {
    it("should fill in the name, brand, basis and every value the food has", async () => {
      await renderCopy();

      expect(screen.getByLabelText("Name")).toHaveDisplayValue("Crunchy granola");
      expect(screen.getByLabelText("Brand")).toHaveDisplayValue("Nature's Best");
      expect(screen.getByRole("radio", { name: "Per 100 g" })).toBeChecked();
      expect(screen.getByLabelText("Energy (kcal)")).toHaveDisplayValue("420");
      expect(screen.getByLabelText("Fat (g)")).toHaveDisplayValue("14");
      expect(screen.getByLabelText("Fibre (g)")).toHaveDisplayValue("6.5");
    });

    it("should fill in the portions with their amounts and the default", async () => {
      await renderCopy();

      expect(screen.getByLabelText("Portion 1 label")).toHaveDisplayValue("1 bar");
      expect(screen.getByLabelText("Portion 1 amount (g)")).toHaveDisplayValue("45");
      expect(screen.getByRole("switch", { name: "Portion 1 default" })).toBeChecked();
      expect(screen.getByLabelText("Portion 2 label")).toHaveDisplayValue("Box of 6");
      expect(screen.getByRole("switch", { name: "Portion 2 default" })).not.toBeChecked();
    });

    it("should keep a liquid's basis and its portion amounts in millilitres", async () => {
      Object.assign(foodQuery, { data: { ...suspectFood, basis: "per_100ml" } });
      Object.assign(portionsQuery, {
        data: [{ ...portionFixtures[0], label: "1 glass", grams: null, ml: 250 }],
      });

      await renderCopy();

      expect(screen.getByRole("radio", { name: "Per 100 ml" })).toBeChecked();
      expect(screen.getByLabelText("Portion 1 amount (ml)")).toHaveDisplayValue("250");
    });

    it("should leave the values the food is missing blank", async () => {
      await renderCopy();

      expect(screen.getByLabelText("Protein (g)")).toHaveDisplayValue("");
      expect(screen.getByLabelText("Carbohydrate (g)")).toHaveDisplayValue("");
    });

    it("should keep a value that is really zero as zero", async () => {
      Object.assign(foodQuery, { data: { ...suspectFood, fat_g: 0 } });

      await renderCopy();

      expect(screen.getByLabelText("Fat (g)")).toHaveDisplayValue("0");
    });
  });

  describe("a food whose carbohydrate includes fibre", () => {
    const usTotalNote =
      "This product's carbohydrate included fibre. Enter the carbohydrate without fibre.";

    beforeEach(() => {
      Object.assign(foodQuery, {
        data: {
          ...suspectFood,
          protein_g: 9,
          carbs_g: 62,
          quality: { carbs_convention: "us_total" as const },
        },
      });
    });

    it("should fill in everything except the carbohydrate", async () => {
      await renderCopy();

      expect(screen.getByLabelText("Name")).toHaveDisplayValue("Crunchy granola");
      expect(screen.getByLabelText("Energy (kcal)")).toHaveDisplayValue("420");
      expect(screen.getByLabelText("Protein (g)")).toHaveDisplayValue("9");
      expect(screen.getByLabelText("Fat (g)")).toHaveDisplayValue("14");
      expect(screen.getByLabelText("Fibre (g)")).toHaveDisplayValue("6.5");
      expect(screen.getByLabelText("Carbohydrate (g)")).toHaveDisplayValue("");
    });

    it("should explain why the carbohydrate is blank", async () => {
      await renderCopy();

      expect(screen.getByText(usTotalNote)).toBeOnTheScreen();
    });

    it("should not save until the carbohydrate is entered", async () => {
      const user = await renderCopy();

      await save(user);

      expect(
        await screen.findByRole("alert", { name: "Carbohydrate is required" }),
      ).toBeOnTheScreen();
      expect(mockCreateFood).not.toHaveBeenCalled();

      await user.type(screen.getByLabelText("Carbohydrate (g)"), "55");
      await save(user);

      expect(mockCreateFood).toHaveBeenCalledTimes(1);
      expect(mockCreateFood).toHaveBeenCalledWith(
        expect.objectContaining({ carbs_g: 55, fibre_g: 6.5 }),
      );
    });

    it("should show no note for a food whose carbohydrate is as labelled", async () => {
      Object.assign(foodQuery, { data: { ...suspectFood, quality: { carbs_convention: "eu" } } });

      await renderCopy();

      expect(screen.queryByText(usTotalNote)).not.toBeOnTheScreen();
    });
  });

  describe("the barcode", () => {
    it("should be filled in from the food and locked when it is a valid barcode", async () => {
      await renderCopy();

      const barcode = screen.getByLabelText("Barcode");
      expect(barcode).toHaveDisplayValue("5012345678900");
      expect(barcode).toHaveProp("editable", false);
      expect(screen.getByText("Kept from the product you are copying")).toBeOnTheScreen();
    });

    it("should stay editable when the food's barcode is not valid", async () => {
      Object.assign(foodQuery, { data: { ...suspectFood, barcode: "5012345678901" } });

      await renderCopy();

      expect(screen.getByLabelText("Barcode")).toHaveDisplayValue("5012345678901");
      expect(screen.getByLabelText("Barcode")).toHaveProp("editable", true);
    });

    it("should be blank and editable when the food has no barcode", async () => {
      Object.assign(foodQuery, { data: { ...suspectFood, barcode: null } });

      await renderCopy();

      expect(screen.getByLabelText("Barcode")).toHaveDisplayValue("");
      expect(screen.getByLabelText("Barcode")).toHaveProp("editable", true);
    });

    it("should come from the food rather than from a barcode parameter", async () => {
      routerMock.searchParams = { from: savedFoodId, barcode: "4006381333931" };

      await renderCopy();

      expect(screen.getByLabelText("Barcode")).toHaveDisplayValue("5012345678900");
    });
  });

  describe("saving", () => {
    it("should require the missing values and not save until they are filled in", async () => {
      const user = await renderCopy();

      await save(user);

      expect(await screen.findByRole("alert", { name: "Protein is required" })).toBeOnTheScreen();
      expect(screen.getByRole("alert", { name: "Carbohydrate is required" })).toBeOnTheScreen();
      expect(screen.getAllByRole("alert")).toHaveLength(2);
      expect(mockCreateFood).not.toHaveBeenCalled();
    });

    it("should create a new food once with the user's values and the kept barcode, and open it", async () => {
      const user = await renderCopy();
      await fillMissingValues(user);

      await save(user);

      expect(mockCreateFood).toHaveBeenCalledTimes(1);
      expect(mockCreateFood).toHaveBeenCalledWith({
        name: "Crunchy granola",
        brand: "Nature's Best",
        barcode: "5012345678900",
        basis: "per_100g",
        kcal: 420,
        protein_g: 9,
        fat_g: 14,
        carbs_g: 60,
        fibre_g: 6.5,
        portions: [
          { label: "1 bar", grams: 45, isDefault: true },
          { label: "Box of 6", grams: 270, isDefault: false },
        ],
      });
      expect(routerMock.replace).toHaveBeenCalledWith(`/foods/${copiedFoodId}`);
    });

    it("should save what the user changed rather than what the food had", async () => {
      const user = await renderCopy();
      await fillMissingValues(user);
      await user.clear(screen.getByLabelText("Energy (kcal)"));
      await user.type(screen.getByLabelText("Energy (kcal)"), "400");

      await save(user);

      expect(mockCreateFood).toHaveBeenCalledWith(expect.objectContaining({ kcal: 400 }));
    });

    it("should never update the food it was copied from", async () => {
      const user = await renderCopy();
      await fillMissingValues(user);

      await save(user);

      expect(mockUpdateFood).not.toHaveBeenCalled();
    });

    it("should carry the density of the food it copies", async () => {
      Object.assign(foodQuery, { data: { ...suspectFood, density_g_per_ml: 1.03 } });
      const user = await renderCopy();
      await fillMissingValues(user);

      await save(user);

      expect(mockCreateFood).toHaveBeenCalledWith(
        expect.objectContaining({ density_g_per_ml: 1.03 }),
      );
    });

    it("should update the copy rather than make a second one after a partial write", async () => {
      mockCreateFood.mockRejectedValue(
        new FoodsPartialWriteError(copiedFoodId, "portions failed", new Error("insert failed")),
      );
      const user = await renderCopy();
      await fillMissingValues(user);
      await save(user);
      await screen.findByRole("alert", {
        name: "Your food was saved but its portions were not. Edit the food to add them again.",
      });

      await user.press(screen.getByRole("button", { name: "Save" }));

      expect(mockCreateFood).toHaveBeenCalledTimes(1);
      expect(mockUpdateFood).toHaveBeenCalledTimes(1);
      expect(mockUpdateFood.mock.calls[0]?.[0].id).toBe(copiedFoodId);
    });
  });

  describe("the parameter", () => {
    it("should use the first value when it is repeated", async () => {
      routerMock.searchParams = { from: [savedFoodId, "other"] };

      await renderCopy();

      expect(mockUseFood).toHaveBeenCalledWith(savedFoodId);
      expect(screen.getByLabelText("Name")).toHaveDisplayValue("Crunchy granola");
    });

    it("should open a blank form when it is empty", async () => {
      routerMock.searchParams = { from: "" };

      await render(<NewFoodRoute />);

      expect(screen.getByLabelText("Name")).toHaveDisplayValue("");
      expect(screen.getByRole("button", { name: "Create food" })).toBeOnTheScreen();
      expect(screen.queryByText("Loading food")).not.toBeOnTheScreen();
    });
  });
});
