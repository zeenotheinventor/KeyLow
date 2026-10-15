import { FoodsPartialWriteError } from "@keylow/api-client";
import { render, screen, userEvent, within } from "@testing-library/react-native";
import { impactAsync, ImpactFeedbackStyle } from "expo-haptics";

import {
  foodFixture,
  mockCreateFood,
  mockUpdateFood,
  resetApiClientMock,
  savedFoodId,
} from "./support/apiClientMock";
import NewFoodRoute from "../../app/foods/new";
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
  await render(
    <ThemeProvider fixedPreference="dark">
      <NewFoodRoute />
    </ThemeProvider>,
  );
  return user;
}

// A portion's own fields are found inside its group, because every portion has the same two labels.
function portion(position: number) {
  return within(screen.getByLabelText(`Portion ${position}`));
}

const defaultSwitch = (position: number) =>
  screen.getByRole("switch", { name: `Portion ${position} is the default` });

async function save(user: User) {
  await user.press(screen.getByRole("button", { name: /Create food/ }));
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
      expect(screen.getByRole("alert", { name: "Energy is required" })).toBeOnTheScreen();
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
      await user.type(screen.getByLabelText("Fibre (optional) (g)"), "6.5");
      await user.press(screen.getByRole("button", { name: "Add portion" }));
      await user.type(screen.getByLabelText("Portion label, portion 1"), "1 bar");
      await user.type(screen.getByLabelText("Amount for portion 1 (g)"), "45");
      await user.press(defaultSwitch(1));

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

    it("should send no saturated fat, sugars or salt for a plain new food", async () => {
      const user = await renderForm();
      await fillRequiredFields(user);

      await save(user);

      expect(mockCreateFood).toHaveBeenCalledTimes(1);
      for (const key of ["sat_fat_g", "sugars_g", "salt_g"]) {
        expect(mockCreateFood.mock.calls[0]?.[0]).not.toHaveProperty(key);
      }
    });

    it("should save a brand and barcode typed with surrounding spaces trimmed", async () => {
      mockCreateFood.mockResolvedValue({
        food: { ...foodFixture, id: savedFoodId },
        portions: [],
      });
      const user = await renderForm();
      await fillRequiredFields(user);
      await user.type(screen.getByLabelText("Brand"), "  Acme  ");
      await user.type(screen.getByLabelText("Barcode"), "  5012345678900  ");

      await save(user);

      expect(mockCreateFood).toHaveBeenCalledWith(
        expect.objectContaining({ brand: "Acme", barcode: "5012345678900" }),
      );
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
          name: "Your food could not be saved Check your connection and try again.",
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
          name: "Portions not saved Your food was saved but its portions were not. Save again to add them.",
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
        name: "Portions not saved Your food was saved but its portions were not. Save again to add them.",
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
      expect(screen.getByRole("button", { name: /Create food/ })).toBeDisabled();
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

    it("should leave the barcode editable, and say nothing about a scan, when the code is not a valid one", async () => {
      // The check digit of 5012345678900 is 0, so this one is wrong.
      routerMock.searchParams = { barcode: "5012345678901" };

      await renderForm();

      expect(screen.getByLabelText("Barcode")).toHaveDisplayValue("5012345678901");
      expect(screen.getByLabelText("Barcode")).toHaveProp("editable", true);
      expect(screen.queryByText("Filled in from the barcode you scanned")).not.toBeOnTheScreen();
    });

    it("should let the user fix an invalid scanned code and save it", async () => {
      routerMock.searchParams = { barcode: "5012345678901" };
      const user = await renderForm();
      await fillRequiredFields(user);
      await user.clear(screen.getByLabelText("Barcode"));
      await user.type(screen.getByLabelText("Barcode"), "5012345678900");

      await save(user);

      expect(mockCreateFood).toHaveBeenCalledWith(
        expect.objectContaining({ barcode: "5012345678900" }),
      );
    });
  });

  describe("header", () => {
    it("should be headed New food, with Back and Close", async () => {
      await renderForm();

      expect(screen.getByRole("heading", { name: "New food" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Back" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Close" })).toBeOnTheScreen();
    });

    it("should go back one screen on Back without saving, whatever is typed", async () => {
      const user = await renderForm();
      await fillRequiredFields(user);

      await user.press(screen.getByRole("button", { name: "Back" }));

      expect(routerMock.back).toHaveBeenCalledTimes(1);
      expect(mockCreateFood).not.toHaveBeenCalled();
      expect(mockUpdateFood).not.toHaveBeenCalled();
    });

    it("should go to the search when there is no screen to go back to", async () => {
      routerMock.canGoBack.mockReturnValue(false);
      const user = await renderForm();

      await user.press(screen.getByRole("button", { name: "Back" }));

      expect(routerMock.back).not.toHaveBeenCalled();
      expect(routerMock.replace).toHaveBeenCalledWith("/foods");
    });

    it("should close the whole sheet on Close without saving, whatever is typed", async () => {
      const user = await renderForm();
      await fillRequiredFields(user);

      await user.press(screen.getByRole("button", { name: "Close" }));

      expect(routerMock.parentGoBack).toHaveBeenCalledTimes(1);
      expect(routerMock.back).not.toHaveBeenCalled();
      expect(mockCreateFood).not.toHaveBeenCalled();
      expect(mockUpdateFood).not.toHaveBeenCalled();
    });

    it("should keep the header after a partial write, when the next save updates the food", async () => {
      mockCreateFood.mockRejectedValue(
        new FoodsPartialWriteError(savedFoodId, "portions failed", new Error("insert failed")),
      );
      const user = await renderForm();
      await fillRequiredFields(user);

      await save(user);

      expect(await screen.findByRole("button", { name: "Save" })).toBeOnTheScreen();
      expect(screen.getByRole("heading", { name: "New food" })).toBeOnTheScreen();
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
      expect(screen.getByLabelText("Nutrition basis")).toHaveProp("role", "radiogroup");
    });

    it("should switch portion amounts to millilitres and save them as ml", async () => {
      const user = await renderForm();
      await fillRequiredFields(user);
      await user.press(screen.getByRole("radio", { name: "Per 100 ml" }));
      await user.press(screen.getByRole("button", { name: "Add portion" }));
      await user.type(screen.getByLabelText("Portion label, portion 1"), "1 glass");
      await user.type(screen.getByLabelText("Amount for portion 1 (ml)"), "250");

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

      expect(screen.queryByLabelText("Portion 1")).not.toBeOnTheScreen();
    });

    it("should add and remove portions", async () => {
      const user = await renderForm();

      await user.press(screen.getByRole("button", { name: "Add portion" }));
      await user.press(screen.getByRole("button", { name: "Add portion" }));
      await user.type(screen.getByLabelText("Portion label, portion 1"), "Slice");
      await user.type(screen.getByLabelText("Portion label, portion 2"), "Loaf");
      expect(screen.getByLabelText("Portion 2")).toBeOnTheScreen();

      await user.press(screen.getByRole("button", { name: "Remove portion Slice" }));

      expect(screen.queryByLabelText("Portion 2")).not.toBeOnTheScreen();
      expect(screen.getByLabelText("Portion label, portion 1")).toHaveDisplayValue("Loaf");
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

      await user.press(defaultSwitch(1));
      await user.press(defaultSwitch(2));

      expect(defaultSwitch(1)).not.toBeChecked();
      expect(defaultSwitch(2)).toBeChecked();
    });

    it("should let the default be switched off again", async () => {
      const user = await renderForm();
      await user.press(screen.getByRole("button", { name: "Add portion" }));

      await user.press(defaultSwitch(1));
      await user.press(defaultSwitch(1));

      expect(defaultSwitch(1)).not.toBeChecked();
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
      await user.type(screen.getByLabelText("Portion label, portion 1"), "Slice");
      await user.type(screen.getByLabelText("Amount for portion 1 (g)"), "0");

      await save(user);

      expect(
        await screen.findByRole("alert", { name: "Portion 1 needs an amount above 0" }),
      ).toBeOnTheScreen();
    });
  });
  describe("form body", () => {
    it("should mark only the name as required", async () => {
      await renderForm();

      expect(screen.getAllByText("Required")).toHaveLength(1);
    });

    it("should show the placeholders the boards draw", async () => {
      await renderForm();

      expect(screen.getByLabelText("Name")).toHaveProp("placeholder", "e.g. Greek yoghurt");
      expect(screen.getByLabelText("Brand")).toHaveProp("placeholder", "Optional");
      expect(screen.getByLabelText("Barcode")).toHaveProp("placeholder", "Optional");
    });

    it("should head the nutrients with the basis and say which of them are required", async () => {
      await renderForm();

      expect(screen.getByRole("heading", { name: "Nutrition per 100 g" })).toBeOnTheScreen();
      expect(
        screen.getByText("Energy, protein, carbohydrate and fat are required."),
      ).toBeOnTheScreen();
    });

    it("should follow the basis in the nutrition heading and the units of the portions", async () => {
      const user = await renderForm();

      await user.press(screen.getByRole("radio", { name: "Per 100 ml" }));

      expect(screen.getByRole("heading", { name: "Nutrition per 100 ml" })).toBeOnTheScreen();
    });

    it("should run the nutrients in protein, carbohydrate, fat order with fibre marked optional", async () => {
      await renderForm();

      expect(
        screen.getAllByLabelText(/\((g|kcal)\)$/).map((field) => String(field.props["aria-label"])),
      ).toStrictEqual([
        "Energy (kcal)",
        "Protein (g)",
        "Carbohydrate (g)",
        "Fat (g)",
        "Fibre (optional) (g)",
      ]);
      expect(screen.getByText("Fibre (optional)")).toBeOnTheScreen();
    });

    it("should head the portions", async () => {
      await renderForm();

      expect(screen.getByRole("heading", { name: "Portions" })).toBeOnTheScreen();
    });

    it("should leave a nutrient the user has not filled in blank, never 0", async () => {
      await renderForm();

      expect(screen.getByLabelText("Energy (kcal)")).toHaveDisplayValue("");
      expect(screen.getByLabelText("Fibre (optional) (g)")).toHaveDisplayValue("");
    });

    it("should offer the decimal keyboard on every nutrient and the portion amount", async () => {
      const user = await renderForm();
      await user.press(screen.getByRole("button", { name: "Add portion" }));

      expect(screen.getByLabelText("Energy (kcal)")).toHaveProp("keyboardType", "decimal-pad");
      expect(screen.getByLabelText("Fibre (optional) (g)")).toHaveProp(
        "keyboardType",
        "decimal-pad",
      );
      expect(screen.getByLabelText("Amount for portion 1 (g)")).toHaveProp(
        "keyboardType",
        "decimal-pad",
      );
    });

    it("should show a portion's units beside its amount and give it the placeholder the board draws", async () => {
      const user = await renderForm();
      await user.press(screen.getByRole("button", { name: "Add portion" }));

      expect(screen.getByLabelText("Portion label, portion 1")).toHaveProp(
        "placeholder",
        "e.g. 1 slice",
      );
      expect(portion(1).getByText("g", { includeHiddenElements: true })).toBeOnTheScreen();
    });

    it("should say which field a portion error is about with the board's sentences", async () => {
      const user = await renderForm();
      await fillRequiredFields(user);
      await user.press(screen.getByRole("button", { name: "Add portion" }));

      await save(user);

      expect(
        await portion(1).findByRole("alert", { name: "Portion 1 needs a label" }),
      ).toBeOnTheScreen();
      expect(
        portion(1).getByRole("alert", { name: "Portion 1 needs an amount above 0" }),
      ).toBeOnTheScreen();
    });

    it("should clear a portion's error once the user edits that field", async () => {
      const user = await renderForm();
      await fillRequiredFields(user);
      await user.press(screen.getByRole("button", { name: "Add portion" }));
      await save(user);
      await screen.findByRole("alert", { name: "Portion 1 needs a label" });

      await user.type(screen.getByLabelText("Portion label, portion 1"), "S");

      expect(
        screen.queryByRole("alert", { name: "Portion 1 needs a label" }),
      ).not.toBeOnTheScreen();
    });

    it("should draw a portion's amount error once, and still describe the amount field by it", async () => {
      const user = await renderForm();
      await fillRequiredFields(user);
      await user.press(screen.getByRole("button", { name: "Add portion" }));
      await user.type(screen.getByLabelText("Portion label, portion 1"), "Slice");

      await save(user);

      expect(
        await screen.findAllByRole("alert", { name: "Portion 1 needs an amount above 0" }),
      ).toHaveLength(1);
      expect(screen.getByLabelText("Amount for portion 1 (g)")).toHaveProp(
        "accessibilityHint",
        "Portion 1 needs an amount above 0",
      );
    });

    it("should reach a 44 point touch target at each portion's Remove, which is drawn smaller", async () => {
      const user = await renderForm();
      await user.press(screen.getByRole("button", { name: "Add portion" }));

      expect(screen.getByRole("button", { name: "Remove portion 1" })).toHaveProp("hitSlop", {
        top: 4,
        bottom: 4,
      });
    });

    it("should draw a trash icon before Remove, which is decoration and adds nothing to the name", async () => {
      const user = await renderForm();
      // Add portion draws the plus, and nothing else on the empty form is an icon.
      const iconsBefore = screen.root?.queryAll((node) => node.type === "RNSVGSvgView") ?? [];
      await user.press(screen.getByRole("button", { name: "Add portion" }));

      const iconsAfter = screen.root?.queryAll((node) => node.type === "RNSVGSvgView") ?? [];
      expect(iconsAfter).toHaveLength(iconsBefore.length + 1);
      expect(screen.getByRole("button", { name: "Remove portion 1" })).toBeOnTheScreen();
    });

    it("should keep the visible Remove label inside the button's name", async () => {
      const user = await renderForm();
      await user.press(screen.getByRole("button", { name: "Add portion" }));
      await user.type(screen.getByLabelText("Portion label, portion 1"), "Slice");

      expect(screen.getByRole("button", { name: "Remove portion Slice" })).toBeOnTheScreen();
      expect(screen.getByText("Remove")).toBeOnTheScreen();
      expect(screen.getByLabelText("Portion label, portion 1")).toBeOnTheScreen();
      expect(screen.getByText("Portion label")).toBeOnTheScreen();
    });

    it("should name each control in a portion so a row can be told from the next", async () => {
      const user = await renderForm();
      await user.press(screen.getByRole("button", { name: "Add portion" }));
      await user.press(screen.getByRole("button", { name: "Add portion" }));

      expect(screen.getByLabelText("Portion 1")).toBeOnTheScreen();
      expect(screen.getByLabelText("Portion 2")).toBeOnTheScreen();
      expect(screen.getByLabelText("Portion label, portion 1")).toBeOnTheScreen();
      expect(screen.getByLabelText("Portion label, portion 2")).toBeOnTheScreen();
      expect(screen.getByLabelText("Amount for portion 1 (g)")).toBeOnTheScreen();
      expect(screen.getByLabelText("Amount for portion 2 (g)")).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Remove portion 1" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Remove portion 2" })).toBeOnTheScreen();
      expect(defaultSwitch(2)).toBeOnTheScreen();
    });
  });

  describe("the save button", () => {
    it("should be the one primary button, labelled from the screen", async () => {
      await renderForm();

      expect(screen.getByRole("button", { name: "Create food" })).toBeOnTheScreen();
    });

    it("should play the confirm haptic when it is pressed", async () => {
      jest.mocked(impactAsync).mockClear();
      const user = await renderForm();

      await save(user);

      expect(impactAsync).toHaveBeenCalledWith(ImpactFeedbackStyle.Medium);
    });

    it("should show the saving state while the save runs, keeping its label", async () => {
      mockCreateFood.mockReturnValue(new Promise(() => undefined));
      const user = await renderForm();
      await fillRequiredFields(user);

      await save(user);

      expect(screen.getByRole("progressbar", { name: "Loading" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: /Create food/, busy: true })).toBeOnTheScreen();
    });

    it("should not show the saving state before it is pressed", async () => {
      await renderForm();

      expect(screen.queryByRole("progressbar")).not.toBeOnTheScreen();
    });
  });

  describe("what a failed save says", () => {
    it("should show no notice before a save", async () => {
      await renderForm();

      expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
    });

    it("should not render the raw message of the error that failed the save", async () => {
      mockCreateFood.mockRejectedValue(new Error("network down"));
      const user = await renderForm();
      await fillRequiredFields(user);

      await save(user);
      await screen.findByRole("alert");

      expect(screen.queryByText(/network down/)).not.toBeOnTheScreen();
    });
  });
});
