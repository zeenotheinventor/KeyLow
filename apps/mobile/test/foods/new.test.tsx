import { FoodsPartialWriteError } from "@keylow/api-client";
import { fireEvent, render, screen, userEvent } from "@testing-library/react-native";

import {
  foodFixture,
  mockCreateFood,
  mockUpdateFood,
  resetApiClientMock,
  savedFoodId,
} from "./support/apiClientMock";
import NewFoodRoute from "../../app/foods/new";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";

jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("../support/expoRouterMock").mockExpoRouter,
);
jest.mock(
  "@keylow/api-client",
  () => jest.requireActual<{ mockApiClient: unknown }>("./support/apiClientMock").mockApiClient,
);

type User = ReturnType<typeof userEvent.setup>;

async function fillRequiredFields(user: User) {
  await user.type(screen.getByLabelText("Name"), "Oat bar");
  await user.type(screen.getByLabelText("Energy (kcal)"), "420");
  await user.type(screen.getByLabelText("Protein (g)"), "8.5");
  await user.type(screen.getByLabelText("Fat (g)"), "14");
  await user.type(screen.getByLabelText("Carbohydrate (g)"), "62");
}

async function renderForm() {
  const user = userEvent.setup();
  await render(<NewFoodRoute />);
  return user;
}

// A native switch has no press to simulate, so the test raises its value change directly.
async function setDefault(position: number, isDefault: boolean) {
  await fireEvent(
    screen.getByRole("switch", { name: `Portion ${position} default` }),
    "valueChange",
    isDefault,
  );
}

async function save(user: User) {
  await user.press(screen.getByRole("button", { name: "Create food" }));
}

describe("new food screen", () => {
  beforeEach(() => {
    resetRouterMock();
    resetApiClientMock();
  });

  describe("required fields", () => {
    it("should announce an error for each missing required field and not save", async () => {
      const user = await renderForm();

      await save(user);

      expect(await screen.findByRole("alert", { name: "Name is required" })).toBeOnTheScreen();
      expect(screen.getByRole("alert", { name: "Energy (kcal) is required" })).toBeOnTheScreen();
      expect(screen.getByRole("alert", { name: "Protein is required" })).toBeOnTheScreen();
      expect(screen.getByRole("alert", { name: "Fat is required" })).toBeOnTheScreen();
      expect(screen.getByRole("alert", { name: "Carbohydrate is required" })).toBeOnTheScreen();
      expect(mockCreateFood).not.toHaveBeenCalled();
    });

    it("should attach the error to its input as the accessibility hint", async () => {
      const user = await renderForm();

      await save(user);

      expect(await screen.findByLabelText("Name")).toHaveProp(
        "accessibilityHint",
        "Name is required",
      );
    });

    it("should not require the brand, barcode or fibre", async () => {
      const user = await renderForm();

      await save(user);

      expect(await screen.findByRole("alert", { name: "Name is required" })).toBeOnTheScreen();
      expect(screen.getAllByRole("alert")).toHaveLength(5);
    });

    it("should treat whitespace in the name as missing", async () => {
      const user = await renderForm();
      await user.type(screen.getByLabelText("Name"), "   ");

      await save(user);

      expect(await screen.findByRole("alert", { name: "Name is required" })).toBeOnTheScreen();
    });

    it("should reject a number field that is not a number", async () => {
      const user = await renderForm();
      await fillRequiredFields(user);
      await user.clear(screen.getByLabelText("Protein (g)"));
      await user.type(screen.getByLabelText("Protein (g)"), "lots");

      await save(user);

      expect(
        await screen.findByRole("alert", { name: "Protein must be a number" }),
      ).toBeOnTheScreen();
      expect(mockCreateFood).not.toHaveBeenCalled();
    });

    it("should reject a negative number", async () => {
      const user = await renderForm();
      await fillRequiredFields(user);
      await user.clear(screen.getByLabelText("Fat (g)"));
      await user.type(screen.getByLabelText("Fat (g)"), "-2");

      await save(user);

      expect(
        await screen.findByRole("alert", { name: "Fat cannot be negative" }),
      ).toBeOnTheScreen();
    });

    it("should reject a barcode that is not a valid product code", async () => {
      const user = await renderForm();
      await fillRequiredFields(user);
      await user.type(screen.getByLabelText("Barcode"), "5012345678901");

      await save(user);

      expect(
        await screen.findByRole("alert", { name: "Barcode check digit is wrong" }),
      ).toBeOnTheScreen();
      expect(mockCreateFood).not.toHaveBeenCalled();
    });

    it("should clear a field error once the user edits that field", async () => {
      const user = await renderForm();
      await save(user);
      await screen.findByRole("alert", { name: "Name is required" });

      await user.type(screen.getByLabelText("Name"), "O");

      expect(screen.queryByRole("alert", { name: "Name is required" })).not.toBeOnTheScreen();
    });
  });

  describe("saving", () => {
    it("should create the food once with the parsed input and open it", async () => {
      mockCreateFood.mockResolvedValue({
        food: { ...foodFixture, id: savedFoodId },
        portions: [],
      });
      const user = await renderForm();
      await fillRequiredFields(user);
      await user.type(screen.getByLabelText("Brand"), "  Acme ");
      await user.type(screen.getByLabelText("Barcode"), "5012345678900");
      await user.type(screen.getByLabelText("Fibre (g)"), "6.5");
      await user.press(screen.getByRole("button", { name: "Add portion" }));
      await user.type(screen.getByLabelText("Portion 1 label"), "1 bar");
      await user.type(screen.getByLabelText("Portion 1 amount (g)"), "45");
      await setDefault(1, true);

      await save(user);

      expect(mockCreateFood).toHaveBeenCalledTimes(1);
      expect(mockCreateFood).toHaveBeenCalledWith({
        name: "Oat bar",
        brand: "Acme",
        barcode: "5012345678900",
        basis: "per_100g",
        kcal: 420,
        protein_g: 8.5,
        fat_g: 14,
        carbs_g: 62,
        fibre_g: 6.5,
        portions: [{ label: "1 bar", grams: 45, isDefault: true }],
      });
      expect(routerMock.replace).toHaveBeenCalledWith(`/foods/${savedFoodId}`);
    });

    it("should leave blank optional fields out rather than send zero or an empty string", async () => {
      const user = await renderForm();
      await fillRequiredFields(user);

      await save(user);

      expect(mockCreateFood.mock.calls).toStrictEqual([
        [
          {
            name: "Oat bar",
            basis: "per_100g",
            kcal: 420,
            protein_g: 8.5,
            fat_g: 14,
            carbs_g: 62,
            portions: [],
          },
        ],
      ]);
    });

    it("should accept a decimal comma", async () => {
      const user = await renderForm();
      await fillRequiredFields(user);
      await user.clear(screen.getByLabelText("Protein (g)"));
      await user.type(screen.getByLabelText("Protein (g)"), "8,5");

      await save(user);

      expect(mockCreateFood).toHaveBeenCalledWith(expect.objectContaining({ protein_g: 8.5 }));
    });

    it("should read 12,5 as 12.5", async () => {
      const user = await renderForm();
      await fillRequiredFields(user);
      await user.clear(screen.getByLabelText("Fat (g)"));
      await user.type(screen.getByLabelText("Fat (g)"), "12,5");

      await save(user);

      expect(mockCreateFood).toHaveBeenCalledWith(expect.objectContaining({ fat_g: 12.5 }));
    });

    it.each(["1,000", "1,2,3"])("should reject %s as not a number", async (typed) => {
      const user = await renderForm();
      await fillRequiredFields(user);
      await user.clear(screen.getByLabelText("Fat (g)"));
      await user.type(screen.getByLabelText("Fat (g)"), typed);

      await save(user);

      expect(await screen.findByRole("alert", { name: "Fat must be a number" })).toBeOnTheScreen();
      expect(mockCreateFood).not.toHaveBeenCalled();
    });

    it("should save zero as zero", async () => {
      const user = await renderForm();
      await fillRequiredFields(user);
      await user.clear(screen.getByLabelText("Fat (g)"));
      await user.type(screen.getByLabelText("Fat (g)"), "0");

      await save(user);

      expect(mockCreateFood).toHaveBeenCalledWith(expect.objectContaining({ fat_g: 0 }));
    });

    it("should show the failure and stay on the screen when the save fails", async () => {
      mockCreateFood.mockRejectedValue(new Error("network down"));
      const user = await renderForm();
      await fillRequiredFields(user);

      await save(user);

      expect(
        await screen.findByRole("alert", {
          name: "Your food could not be saved. Check your connection and try again.",
        }),
      ).toBeOnTheScreen();
      expect(routerMock.replace).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "Create food" })).toBeEnabled();
    });

    it("should say the portions were not saved after a partial write", async () => {
      mockCreateFood.mockRejectedValue(
        new FoodsPartialWriteError(savedFoodId, "portions failed", new Error("insert failed")),
      );
      const user = await renderForm();
      await fillRequiredFields(user);

      await save(user);

      expect(
        await screen.findByRole("alert", {
          name: "Your food was saved but its portions were not. Edit the food to add them again.",
        }),
      ).toBeOnTheScreen();
      expect(routerMock.replace).not.toHaveBeenCalled();
    });

    it("should update the saved food rather than create a second one after a partial write", async () => {
      mockCreateFood.mockRejectedValue(
        new FoodsPartialWriteError(savedFoodId, "portions failed", new Error("insert failed")),
      );
      const user = await renderForm();
      await fillRequiredFields(user);
      await save(user);
      await screen.findByRole("alert", {
        name: "Your food was saved but its portions were not. Edit the food to add them again.",
      });

      await user.press(screen.getByRole("button", { name: "Save" }));

      expect(mockCreateFood).toHaveBeenCalledTimes(1);
      expect(mockUpdateFood).toHaveBeenCalledTimes(1);
      expect(mockUpdateFood.mock.calls[0]?.[0].id).toBe(savedFoodId);
      expect(mockUpdateFood.mock.calls[0]?.[0].input).toHaveProperty("name", "Oat bar");
      expect(routerMock.replace).toHaveBeenCalledWith(`/foods/${savedFoodId}`);
    });

    it("should ignore a second press while the first save is running", async () => {
      mockCreateFood.mockReturnValue(new Promise(() => undefined));
      const user = await renderForm();
      await fillRequiredFields(user);

      await save(user);
      await save(user);

      expect(mockCreateFood).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("button", { name: "Create food" })).toBeDisabled();
    });
  });

  describe("barcode from a scan", () => {
    beforeEach(() => {
      routerMock.searchParams = { barcode: "5012345678900" };
    });

    it("should pre-fill the barcode and lock it", async () => {
      await renderForm();

      const barcode = screen.getByLabelText("Barcode");
      expect(barcode).toHaveDisplayValue("5012345678900");
      expect(barcode).toHaveProp("editable", false);
      expect(barcode).toBeDisabled();
      expect(screen.getByText("Filled in from the barcode you scanned")).toBeOnTheScreen();
    });

    it("should save the scanned barcode with the food", async () => {
      const user = await renderForm();
      await fillRequiredFields(user);

      await save(user);

      expect(mockCreateFood).toHaveBeenCalledWith(
        expect.objectContaining({ barcode: "5012345678900" }),
      );
    });

    it("should leave the barcode editable when the screen opens without a scan", async () => {
      routerMock.searchParams = {};

      await renderForm();

      expect(screen.getByLabelText("Barcode")).toHaveProp("editable", true);
      expect(screen.getByLabelText("Barcode")).toHaveDisplayValue("");
    });

    it("should use the first value when the barcode parameter is repeated", async () => {
      routerMock.searchParams = { barcode: ["5012345678900", "4006381333931"] };

      await renderForm();

      expect(screen.getByLabelText("Barcode")).toHaveDisplayValue("5012345678900");
      expect(screen.getByLabelText("Barcode")).toHaveProp("editable", false);
    });

    it("should treat an empty barcode parameter as no scan", async () => {
      routerMock.searchParams = { barcode: "" };

      await renderForm();

      expect(screen.getByLabelText("Barcode")).toHaveProp("editable", true);
    });
  });

  describe("basis", () => {
    it("should default to per 100 g", async () => {
      await renderForm();

      expect(screen.getByRole("radio", { name: "Per 100 g" })).toBeChecked();
      expect(screen.getByRole("radio", { name: "Per 100 ml" })).not.toBeChecked();
    });

    it("should offer the two bases in a labelled radio group", async () => {
      await renderForm();

      // A radio group is a container rather than an accessibility element, so it is found by its label.
      expect(screen.getByLabelText("Nutrition basis")).toHaveProp(
        "accessibilityRole",
        "radiogroup",
      );
    });

    it("should switch portion amounts to millilitres and save them as ml", async () => {
      const user = await renderForm();
      await fillRequiredFields(user);
      await user.press(screen.getByRole("radio", { name: "Per 100 ml" }));
      await user.press(screen.getByRole("button", { name: "Add portion" }));
      await user.type(screen.getByLabelText("Portion 1 label"), "1 glass");
      await user.type(screen.getByLabelText("Portion 1 amount (ml)"), "250");

      await save(user);

      expect(screen.getByRole("radio", { name: "Per 100 ml" })).toBeChecked();
      expect(mockCreateFood).toHaveBeenCalledWith(
        expect.objectContaining({
          basis: "per_100ml",
          portions: [{ label: "1 glass", ml: 250, isDefault: false }],
        }),
      );
    });
  });

  describe("portions", () => {
    it("should start with no portions", async () => {
      await renderForm();

      expect(screen.queryByLabelText("Portion 1 label")).not.toBeOnTheScreen();
    });

    it("should add and remove portions", async () => {
      const user = await renderForm();

      await user.press(screen.getByRole("button", { name: "Add portion" }));
      await user.press(screen.getByRole("button", { name: "Add portion" }));
      await user.type(screen.getByLabelText("Portion 1 label"), "Slice");
      await user.type(screen.getByLabelText("Portion 2 label"), "Loaf");
      expect(screen.getByLabelText("Portion 2 label")).toBeOnTheScreen();

      await user.press(screen.getByRole("button", { name: "Remove portion Slice" }));

      expect(screen.queryByLabelText("Portion 2 label")).not.toBeOnTheScreen();
      expect(screen.getByLabelText("Portion 1 label")).toHaveDisplayValue("Loaf");
    });

    it("should name the remove button by position while the label is empty", async () => {
      const user = await renderForm();

      await user.press(screen.getByRole("button", { name: "Add portion" }));

      expect(screen.getByRole("button", { name: "Remove portion 1" })).toBeOnTheScreen();
    });

    it("should keep at most one default portion", async () => {
      const user = await renderForm();
      await user.press(screen.getByRole("button", { name: "Add portion" }));
      await user.press(screen.getByRole("button", { name: "Add portion" }));

      await setDefault(1, true);
      await setDefault(2, true);

      expect(screen.getByRole("switch", { name: "Portion 1 default" })).not.toBeChecked();
      expect(screen.getByRole("switch", { name: "Portion 2 default" })).toBeChecked();
    });

    it("should let the default be switched off again", async () => {
      const user = await renderForm();
      await user.press(screen.getByRole("button", { name: "Add portion" }));

      await setDefault(1, true);
      await setDefault(1, false);

      expect(screen.getByRole("switch", { name: "Portion 1 default" })).not.toBeChecked();
    });

    it("should announce a portion that has no label or amount", async () => {
      const user = await renderForm();
      await fillRequiredFields(user);
      await user.press(screen.getByRole("button", { name: "Add portion" }));

      await save(user);

      expect(
        await screen.findByRole("alert", { name: "Portion 1 needs a label" }),
      ).toBeOnTheScreen();
      expect(
        screen.getByRole("alert", { name: "Portion 1 needs an amount above 0" }),
      ).toBeOnTheScreen();
      expect(mockCreateFood).not.toHaveBeenCalled();
    });

    it("should reject a portion amount of zero", async () => {
      const user = await renderForm();
      await fillRequiredFields(user);
      await user.press(screen.getByRole("button", { name: "Add portion" }));
      await user.type(screen.getByLabelText("Portion 1 label"), "Slice");
      await user.type(screen.getByLabelText("Portion 1 amount (g)"), "0");

      await save(user);

      expect(
        await screen.findByRole("alert", { name: "Portion 1 needs an amount above 0" }),
      ).toBeOnTheScreen();
    });
  });
});
