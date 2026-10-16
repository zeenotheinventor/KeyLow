import { FoodsPartialWriteError } from "@keylow/api-client";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeFood, makePortion } from "./support";

import type { FoodFormProps } from "@/components/foods/FoodForm";
import type { CreatedFood } from "@keylow/api-client";
import type { Food } from "@keylow/core/schemas";

import { FoodForm } from "@/components/foods/FoodForm";

const { createFood, updateFood, replace } = vi.hoisted(() => ({
  createFood: vi.fn<(input: unknown) => Promise<CreatedFood>>(),
  updateFood: vi.fn<(variables: { id: string; input: unknown }) => Promise<Food>>(),
  replace: vi.fn<(href: string) => void>(),
}));

vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  useCreateFood: () => ({ mutateAsync: createFood }),
  useUpdateFood: () => ({ mutateAsync: updateFood }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

const CREATED_FOOD_ID = "11111111-1111-4111-8111-111111111111";

// A numeric field is named by its label and then its unit. The space between them is optional
// because the test library drops a space that sits next to a hidden-from-sight element.
const numeric = (label: string, unit: string) =>
  new RegExp(`^${label.replaceAll(/[()]/g, "\\$&")}\\s*\\(${unit}\\)$`);

const energy = numeric("Energy", "kcal");
const protein = numeric("Protein", "g");
const carbohydrate = numeric("Carbohydrate", "g");
const fat = numeric("Fat", "g");
const fibre = numeric("Fibre (optional)", "g");
const portionAmount = (position: number, unit = "g") =>
  numeric(`Amount for portion ${String(position)}`, unit);

function typeInto(name: string | RegExp, value: string) {
  fireEvent.change(screen.getByRole("textbox", { name }), { target: { value } });
}

function fillRequiredFields() {
  typeInto("Name", "Oat cakes");
  typeInto(energy, "430");
  typeInto(protein, "10");
  typeInto(carbohydrate, "56");
  typeInto(fat, "18");
}

function save(buttonName = "Create food") {
  fireEvent.click(screen.getByRole("button", { name: buttonName }));
}

function addPortion() {
  fireEvent.click(screen.getByRole("button", { name: "Add portion" }));
}

function chooseBasis(name: "Per 100 g" | "Per 100 ml") {
  fireEvent.click(screen.getByRole("radio", { name }));
}

function renderForm(props: FoodFormProps = {}) {
  return render(<FoodForm {...props} />);
}

describe("FoodForm", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    createFood.mockResolvedValue({ food: makeFood({ id: CREATED_FOOD_ID }), portions: [] });
    updateFood.mockResolvedValue(makeFood());
  });

  afterEach(() => {
    cleanup();
  });

  describe("fields", () => {
    it("should label every food field so each can be found by name", () => {
      renderForm();

      for (const name of ["Name", "Brand", "Barcode"]) {
        expect(screen.getByRole("textbox", { name })).toBeTruthy();
      }
      for (const name of [energy, protein, carbohydrate, fat, fibre]) {
        expect(screen.getByRole("textbox", { name })).toBeTruthy();
      }
    });

    it("should group the fields under a Details, a Nutrition and a Portions section", () => {
      renderForm();

      expect(screen.getByRole("region", { name: "Details" })).toBeTruthy();
      expect(screen.getByRole("region", { name: "Nutrition per 100 g" })).toBeTruthy();
      expect(screen.getByRole("region", { name: "Portions" })).toBeTruthy();
    });

    it("should say the name is required and the brand and barcode are optional", () => {
      renderForm();

      expect(screen.getByRole("textbox", { name: "Name", description: "Required" })).toBeTruthy();
      expect(screen.getByRole("textbox", { name: "Brand" }).getAttribute("placeholder")).toBe(
        "Optional",
      );
      expect(screen.getByRole("textbox", { name: "Barcode" }).getAttribute("placeholder")).toBe(
        "Optional",
      );
    });

    it("should say which nutrients are required", () => {
      renderForm();

      expect(screen.getByText("Energy, protein, carbohydrate and fat are required.")).toBeTruthy();
    });

    it("should mark the fields the schema requires with aria-required", () => {
      renderForm();

      for (const name of ["Name", energy, protein, carbohydrate, fat]) {
        expect(screen.getByRole("textbox", { name }).getAttribute("aria-required")).toBe("true");
      }
      for (const name of ["Brand", "Barcode", fibre]) {
        expect(screen.getByRole("textbox", { name }).hasAttribute("aria-required")).toBe(false);
      }
    });

    it("should offer the basis as a choice of per 100 g or per 100 ml, per 100 g first", () => {
      renderForm();

      const basis = screen.getByRole("radiogroup", { name: "Basis" });

      expect(within(basis).getByRole("radio", { name: "Per 100 g" })).toHaveProperty(
        "checked",
        true,
      );
      expect(within(basis).getByRole("radio", { name: "Per 100 ml" })).toHaveProperty(
        "checked",
        false,
      );
    });

    it("should follow the basis in the Nutrition heading", () => {
      renderForm();

      chooseBasis("Per 100 ml");

      expect(screen.getByRole("region", { name: "Nutrition per 100 ml" })).toBeTruthy();
    });

    it("should not offer a density field", () => {
      renderForm();

      expect(screen.queryByLabelText(/density/i)).toBeNull();
    });

    it("should start with no portions", () => {
      renderForm();

      expect(screen.queryByRole("textbox", { name: /^Portion 1/ })).toBeNull();
      expect(screen.getByText("Each amount is in g, to match the basis.")).toBeTruthy();
    });
  });

  describe("actions", () => {
    it("should offer Create food and a Cancel link back to the foods page for a new food", () => {
      renderForm();

      expect(screen.getByRole("button", { name: "Create food" }).getAttribute("type")).toBe(
        "submit",
      );
      expect(screen.getByRole("link", { name: "Cancel" }).getAttribute("href")).toBe("/foods");
    });

    it("should offer Save changes and a Cancel link back to the food when editing", () => {
      const existing = { food: makeFood(), portions: [] };

      renderForm({ existing });

      expect(screen.getByRole("button", { name: "Save changes" })).toBeTruthy();
      expect(screen.getByRole("link", { name: "Cancel" }).getAttribute("href")).toBe(
        `/foods/${existing.food.id}`,
      );
    });

    it("should offer Save to your foods and a Cancel link back to the food when copying", () => {
      const copyOf = { food: makeFood({ source: "off", owner_id: null }), portions: [] };

      renderForm({ copyOf });

      expect(screen.getByRole("button", { name: "Save to your foods" })).toBeTruthy();
      expect(screen.getByRole("link", { name: "Cancel" }).getAttribute("href")).toBe(
        `/foods/${copyOf.food.id}`,
      );
    });
  });

  describe("validation", () => {
    it("should not save and should say what is wrong with every missing required field", () => {
      renderForm();

      save();

      expect(createFood).not.toHaveBeenCalled();
      expect(
        screen.getByRole("textbox", { name: "Name", description: "Required Name is required" }),
      ).toBeTruthy();
      expect(
        screen.getByRole("textbox", { name: energy, description: "Energy is required" }),
      ).toBeTruthy();
      expect(
        screen.getByRole("textbox", { name: protein, description: "Protein is required" }),
      ).toBeTruthy();
      expect(
        screen.getByRole("textbox", {
          name: carbohydrate,
          description: "Carbohydrate is required",
        }),
      ).toBeTruthy();
      expect(
        screen.getByRole("textbox", { name: fat, description: "Fat is required" }),
      ).toBeTruthy();
    });

    it("should mark invalid inputs with aria-invalid and leave valid ones unmarked", () => {
      renderForm();
      typeInto("Name", "Oat cakes");

      save();

      expect(screen.getByRole("textbox", { name: "Name" }).getAttribute("aria-invalid")).toBe(
        "false",
      );
      expect(screen.getByRole("textbox", { name: energy }).getAttribute("aria-invalid")).toBe(
        "true",
      );
    });

    it("should summarise the problem in an alert", () => {
      renderForm();

      save();

      expect(
        screen
          .getAllByRole("alert")
          .some((alert) => alert.textContent === "Check the fields marked below and try again."),
      ).toBe(true);
    });

    describe("a problem no field can show", () => {
      const bothDefault = [
        makePortion({ label: "Bowl", grams: 250, is_default: true, position: 0 }),
        makePortion({ label: "Cup", grams: 150, is_default: true, position: 1 }),
      ];
      const alerts = () => screen.getAllByRole("alert").map((alert) => alert.textContent);

      it("should say at most one portion can be the default and not save", () => {
        renderForm({ existing: { food: makeFood(), portions: bothDefault } });

        save("Save changes");

        expect(updateFood).not.toHaveBeenCalled();
        expect(alerts()).toEqual(["At most one portion can be the default"]);
      });

      it("should say it alongside the summary when a field failed too", () => {
        renderForm({ existing: { food: makeFood(), portions: bothDefault } });
        typeInto("Name", "");

        save("Save changes");

        expect(alerts()).toContain(
          "Check the fields marked below and try again.At most one portion can be the default",
        );
      });

      it("should give the summary for a problem with a value the form does not show", () => {
        renderForm({ existing: { food: makeFood({ density_g_per_ml: -1 }), portions: [] } });

        save("Save changes");

        expect(updateFood).not.toHaveBeenCalled();
        expect(alerts()).toEqual(["Check the fields marked below and try again."]);
      });
    });

    it("should treat a blank required number as a required-field error rather than zero", () => {
      renderForm();
      fillRequiredFields();
      typeInto(fat, "");

      save();

      expect(createFood).not.toHaveBeenCalled();
      expect(
        screen.getByRole("textbox", { name: fat, description: "Fat is required" }),
      ).toBeTruthy();
    });

    it("should reject a negative amount in the words the mobile form uses", () => {
      renderForm();
      fillRequiredFields();
      typeInto(fat, "-2");

      save();

      expect(createFood).not.toHaveBeenCalled();
      expect(
        screen.getByRole("textbox", { name: fat, description: "Fat cannot be negative" }),
      ).toBeTruthy();
    });

    it("should reject an amount that is not a number", () => {
      renderForm();
      fillRequiredFields();
      typeInto(protein, "lots");

      save();

      expect(createFood).not.toHaveBeenCalled();
      expect(
        screen.getByRole("textbox", { name: protein, description: "Protein must be a number" }),
      ).toBeTruthy();
    });

    it("should reject an exponent, which the form does not read as a number", () => {
      renderForm();
      fillRequiredFields();
      typeInto(energy, "1e3");

      save();

      expect(createFood).not.toHaveBeenCalled();
      expect(
        screen.getByRole("textbox", { name: energy, description: "Energy must be a number" }),
      ).toBeTruthy();
    });

    it("should reject a name that is only spaces", () => {
      renderForm();
      fillRequiredFields();
      typeInto("Name", "   ");

      save();

      expect(createFood).not.toHaveBeenCalled();
      expect(
        screen.getByRole("textbox", { name: "Name", description: "Required Name is required" }),
      ).toBeTruthy();
    });

    it("should reject a name longer than 200 characters", () => {
      renderForm();
      fillRequiredFields();
      typeInto("Name", "a".repeat(201));

      save();

      expect(
        screen.getByRole("textbox", {
          name: "Name",
          description: "Required Name must be 200 characters or fewer",
        }),
      ).toBeTruthy();
    });

    it("should explain a barcode whose check digit is wrong", () => {
      renderForm();
      fillRequiredFields();
      typeInto("Barcode", "5000159484696");

      save();

      expect(createFood).not.toHaveBeenCalled();
      expect(
        screen.getByRole("textbox", {
          name: "Barcode",
          description: "Barcode check digit is wrong",
        }),
      ).toBeTruthy();
    });

    it("should clear the errors once the form is valid and saved", async () => {
      renderForm();
      save();
      fillRequiredFields();

      save();

      await waitFor(() => {
        expect(createFood).toHaveBeenCalledTimes(1);
      });
      expect(screen.queryByRole("alert")).toBeNull();
      expect(screen.getByRole("textbox", { name: "Name" }).getAttribute("aria-invalid")).toBe(
        "false",
      );
    });
  });

  describe("creating a food", () => {
    it("should call the create mutation once with the entered values and go to the new food", async () => {
      renderForm();
      fillRequiredFields();

      save();

      await waitFor(() => {
        expect(replace).toHaveBeenCalledWith(`/foods/${CREATED_FOOD_ID}`);
      });
      expect(createFood).toHaveBeenCalledTimes(1);
      expect(createFood).toHaveBeenCalledWith({
        name: "Oat cakes",
        basis: "per_100g",
        kcal: 430,
        protein_g: 10,
        fat_g: 18,
        carbs_g: 56,
        portions: [],
      });
      expect(updateFood).not.toHaveBeenCalled();
    });

    it("should send no saturated fat, sugars or salt for a plain new food", async () => {
      renderForm();
      fillRequiredFields();

      save();

      await waitFor(() => {
        expect(createFood).toHaveBeenCalledTimes(1);
      });
      const input = createFood.mock.calls[0]?.[0];
      for (const key of ["sat_fat_g", "sugars_g", "salt_g"]) {
        expect(input).not.toHaveProperty(key);
      }
    });

    it('should read a decimal comma as a decimal point, so "12,5" saves 12.5', async () => {
      renderForm();
      fillRequiredFields();
      typeInto(protein, "12,5");
      addPortion();
      typeInto("Portion 1 label", "1 biscuit");
      typeInto(portionAmount(1), "13,5");

      save();

      await waitFor(() => {
        expect(createFood).toHaveBeenCalledTimes(1);
      });
      expect(createFood).toHaveBeenCalledWith(
        expect.objectContaining({
          protein_g: 12.5,
          portions: [{ label: "1 biscuit", grams: 13.5, isDefault: false }],
        }),
      );
    });

    it("should leave blank optional fields out rather than sending empty strings or zero", async () => {
      renderForm();
      fillRequiredFields();

      save();

      await waitFor(() => {
        expect(createFood).toHaveBeenCalledTimes(1);
      });
      const input = createFood.mock.calls[0]?.[0];
      expect(input).not.toHaveProperty("brand");
      expect(input).not.toHaveProperty("barcode");
      expect(input).not.toHaveProperty("fibre_g");
    });

    it("should send the optional fields when they are filled in", async () => {
      renderForm();
      fillRequiredFields();
      typeInto("Brand", "  Nairn's ");
      typeInto("Barcode", "5000159484695");
      typeInto(fibre, "7.5");

      save();

      await waitFor(() => {
        expect(createFood).toHaveBeenCalledTimes(1);
      });
      expect(createFood).toHaveBeenCalledWith(
        expect.objectContaining({ brand: "Nairn's", barcode: "5000159484695", fibre_g: 7.5 }),
      );
    });

    it("should send a basis of per 100 ml when it is chosen", async () => {
      renderForm();
      fillRequiredFields();
      chooseBasis("Per 100 ml");

      save();

      await waitFor(() => {
        expect(createFood).toHaveBeenCalledTimes(1);
      });
      expect(createFood).toHaveBeenCalledWith(expect.objectContaining({ basis: "per_100ml" }));
    });

    it("should show the button as busy and not save a second time while the first save runs", async () => {
      createFood.mockReturnValue(new Promise(() => undefined));
      renderForm();
      fillRequiredFields();

      save();

      const saving = await screen.findByRole("button", { name: "Saving" });
      expect(saving.hasAttribute("disabled")).toBe(true);
      expect(saving.getAttribute("aria-busy")).toBe("true");
      fireEvent.click(saving);
      expect(createFood).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("link", { name: "Cancel" })).toBeTruthy();
    });
  });

  describe("scanned barcode", () => {
    it("should pre-fill the barcode, make it read-only and say where it came from", () => {
      renderForm({ scannedBarcode: "5000159484695" });

      const barcode = screen.getByRole("textbox", {
        name: "Barcode",
        description: "Filled in from the barcode you entered",
      });
      expect(barcode).toHaveProperty("value", "5000159484695");
      expect(barcode).toHaveProperty("readOnly", true);
    });

    it("should save the scanned barcode with the food", async () => {
      renderForm({ scannedBarcode: "5000159484695" });
      fillRequiredFields();

      save();

      await waitFor(() => {
        expect(createFood).toHaveBeenCalledTimes(1);
      });
      expect(createFood).toHaveBeenCalledWith(
        expect.objectContaining({ barcode: "5000159484695" }),
      );
    });

    it("should leave a scanned barcode that is not valid editable so the user can fix it", () => {
      renderForm({ scannedBarcode: "5000159484696" });

      const barcode = screen.getByRole("textbox", { name: "Barcode" });
      expect(barcode).toHaveProperty("value", "5000159484696");
      expect(barcode).toHaveProperty("readOnly", false);
      expect(screen.queryByText("Filled in from the barcode you entered")).toBeNull();
    });

    it("should show the barcode error on submit when the scanned barcode is not valid", () => {
      renderForm({ scannedBarcode: "5000159484696" });
      fillRequiredFields();

      save();

      expect(createFood).not.toHaveBeenCalled();
      expect(
        screen.getByRole("textbox", {
          name: "Barcode",
          description: "Barcode check digit is wrong",
        }),
      ).toBeTruthy();
    });

    it("should leave the barcode editable when nothing was scanned", () => {
      renderForm();

      expect(screen.getByRole("textbox", { name: "Barcode" })).toHaveProperty("readOnly", false);
    });
  });

  describe("copying a food", () => {
    const copyOf = {
      food: makeFood({
        source: "off",
        owner_id: null,
        name: "Oat drink",
        barcode: "5000159484695",
        basis: "per_100ml",
        density_g_per_ml: 1.03,
        kcal: 45,
        protein_g: null,
        fat_g: 1.5,
        carbs_g: 6.7,
      }),
      portions: [makePortion({ label: "Glass", grams: null, ml: 250 })],
    };

    it("should lock the barcode and say it belongs to the food being copied", () => {
      renderForm({ copyOf });

      const barcode = screen.getByRole("textbox", {
        name: "Barcode",
        description: "Kept from the product you are copying",
      });
      expect(barcode).toHaveProperty("value", "5000159484695");
      expect(barcode).toHaveProperty("readOnly", true);
    });

    it("should leave a barcode that is not valid editable so the user can fix it", () => {
      renderForm({ copyOf: { ...copyOf, food: makeFood({ barcode: "5000159484696" }) } });

      expect(screen.getByRole("textbox", { name: "Barcode" })).toHaveProperty("readOnly", false);
    });

    it("should leave the barcode empty and editable when the food has none", () => {
      renderForm({ copyOf: { ...copyOf, food: makeFood({ barcode: null }) } });

      const barcode = screen.getByRole("textbox", { name: "Barcode" });
      expect(barcode).toHaveProperty("value", "");
      expect(barcode).toHaveProperty("readOnly", false);
    });

    it("should say a nutrient the source did not give is not given, and only while it is blank", () => {
      renderForm({ copyOf });

      expect(
        screen.getByRole("textbox", {
          name: protein,
          description: "Not given by the source",
        }),
      ).toBeTruthy();
      expect(screen.getAllByText("Not given by the source")).toHaveLength(1);

      typeInto(protein, "1");

      expect(screen.queryByText("Not given by the source")).toBeNull();
    });

    it("should show the error rather than the note when a blank nutrient is saved", () => {
      renderForm({ copyOf });

      save("Save to your foods");

      expect(
        screen.getByRole("textbox", { name: protein, description: "Protein is required" }),
      ).toBeTruthy();
      expect(screen.queryByText("Not given by the source")).toBeNull();
    });

    it("should say nothing is not given when the source gave every nutrient", () => {
      renderForm({ copyOf: { ...copyOf, food: { ...copyOf.food, protein_g: 3 } } });

      expect(screen.queryByText("Not given by the source")).toBeNull();
    });

    it("should create a new food and carry the density through, never updating the original", async () => {
      renderForm({ copyOf });
      typeInto(protein, "1");

      save("Save to your foods");

      await waitFor(() => {
        expect(createFood).toHaveBeenCalledTimes(1);
      });
      expect(createFood).toHaveBeenCalledWith(
        expect.objectContaining({ density_g_per_ml: 1.03, basis: "per_100ml" }),
      );
      expect(updateFood).not.toHaveBeenCalled();
    });

    describe("the saturated fat, sugars and salt of the source", () => {
      const cofidCopyOf = {
        food: makeFood({
          source: "cofid",
          owner_id: null,
          kcal: 90,
          protein_g: 3,
          fat_g: 10,
          carbs_g: 30,
          sat_fat_g: 3,
          sugars_g: 12,
          salt_g: 0.8,
        }),
        portions: [],
      };

      async function saveCopy(copyOfFood: typeof cofidCopyOf = cofidCopyOf) {
        renderForm({ copyOf: copyOfFood });
        save("Save to your foods");
        await waitFor(() => {
          expect(createFood).toHaveBeenCalledTimes(1);
        });
        return createFood.mock.calls[0]?.[0];
      }

      it("should write all three on the new food without showing a field for them", async () => {
        expect(await saveCopy()).toMatchObject({ sat_fat_g: 3, sugars_g: 12, salt_g: 0.8 });
        for (const name of [/saturated/i, /sugars/i, /salt/i]) {
          expect(screen.queryByRole("textbox", { name })).toBeNull();
        }
      });

      it("should drop the saturated fat when the fat is edited below it", async () => {
        renderForm({ copyOf: cofidCopyOf });
        typeInto(fat, "2.9");

        save("Save to your foods");

        await waitFor(() => {
          expect(createFood).toHaveBeenCalledTimes(1);
        });
        const input = createFood.mock.calls[0]?.[0];
        expect(input).toMatchObject({ sugars_g: 12, salt_g: 0.8 });
        expect(input).not.toHaveProperty("sat_fat_g");
      });

      it("should keep the saturated fat when the fat is edited to equal it", async () => {
        renderForm({ copyOf: cofidCopyOf });
        typeInto(fat, "3");

        save("Save to your foods");

        await waitFor(() => {
          expect(createFood).toHaveBeenCalledTimes(1);
        });
        expect(createFood.mock.calls[0]?.[0]).toMatchObject({ sat_fat_g: 3 });
      });

      it("should drop the sugars when the carbohydrate is edited below them", async () => {
        renderForm({ copyOf: cofidCopyOf });
        typeInto(carbohydrate, "11.9");

        save("Save to your foods");

        await waitFor(() => {
          expect(createFood).toHaveBeenCalledTimes(1);
        });
        const input = createFood.mock.calls[0]?.[0];
        expect(input).toMatchObject({ sat_fat_g: 3, salt_g: 0.8 });
        expect(input).not.toHaveProperty("sugars_g");
      });

      it("should keep the sugars when the carbohydrate is edited to equal them", async () => {
        renderForm({ copyOf: cofidCopyOf });
        typeInto(carbohydrate, "12");

        save("Save to your foods");

        await waitFor(() => {
          expect(createFood).toHaveBeenCalledTimes(1);
        });
        expect(createFood.mock.calls[0]?.[0]).toMatchObject({ sugars_g: 12 });
      });

      it("should carry the salt whatever the fat and carbohydrate are edited to", async () => {
        renderForm({ copyOf: cofidCopyOf });
        typeInto(fat, "0");
        typeInto(carbohydrate, "0");

        save("Save to your foods");

        await waitFor(() => {
          expect(createFood).toHaveBeenCalledTimes(1);
        });
        const input = createFood.mock.calls[0]?.[0];
        expect(input).toMatchObject({ salt_g: 0.8 });
        expect(input).not.toHaveProperty("sat_fat_g");
        expect(input).not.toHaveProperty("sugars_g");
      });

      it("should keep the saturated fat and sugars the source holds above its own fat and carbohydrate when the edit raises them", async () => {
        const mismatchedSource = {
          ...cofidCopyOf,
          food: { ...cofidCopyOf.food, fat_g: 2, sat_fat_g: 3, carbs_g: 5, sugars_g: 8 },
        };
        renderForm({ copyOf: mismatchedSource });
        typeInto(fat, "5");
        typeInto(carbohydrate, "10");

        save("Save to your foods");

        await waitFor(() => {
          expect(createFood).toHaveBeenCalledTimes(1);
        });
        expect(createFood.mock.calls[0]?.[0]).toMatchObject({ sat_fat_g: 3, sugars_g: 8 });
      });

      it("should leave out a value the source does not record, never sending null", async () => {
        const input = await saveCopy({
          ...cofidCopyOf,
          food: { ...cofidCopyOf.food, sat_fat_g: null, sugars_g: null, salt_g: null },
        });

        for (const key of ["sat_fat_g", "sugars_g", "salt_g"]) {
          expect(input).not.toHaveProperty(key);
        }
      });
    });

    describe("when the carbohydrate of the food included fibre", () => {
      const usCopyOf = {
        food: makeFood({
          source: "off",
          owner_id: null,
          kcal: 375,
          protein_g: 8,
          fat_g: 4.5,
          carbs_g: 62,
          fibre_g: null,
          quality: { carbs_convention: "us_total" },
        }),
        portions: [],
      };

      it("should leave the carbohydrate blank, explain why and say it is not given", () => {
        renderForm({ copyOf: usCopyOf });

        expect(
          screen.getByText(
            "This product's carbohydrate included fibre. Enter the carbohydrate without fibre.",
          ),
        ).toBeTruthy();
        expect(
          screen.getByRole("textbox", {
            name: carbohydrate,
            description: "Not given by the source",
          }),
        ).toHaveProperty("value", "");
        expect(screen.getByRole("textbox", { name: fibre }).hasAttribute("aria-describedby")).toBe(
          false,
        );
        expect(screen.getAllByText("Not given by the source")).toHaveLength(1);
      });

      it("should keep the fibre note off a food whose carbohydrate was not a US total", () => {
        renderForm({ copyOf });

        expect(screen.queryByText(/included fibre/)).toBeNull();
      });
    });
  });

  describe("portions", () => {
    it("should add a portion with its own labelled fields", () => {
      renderForm();

      addPortion();

      const portions = screen.getByRole("region", { name: "Portions" });
      expect(within(portions).getByRole("textbox", { name: "Portion 1 label" })).toBeTruthy();
      expect(within(portions).getByRole("textbox", { name: portionAmount(1) })).toBeTruthy();
      expect(
        within(portions).getByRole("checkbox", { name: "Portion 1 is the default" }),
      ).toBeTruthy();
      expect(within(portions).getByRole("button", { name: "Remove portion 1" })).toBeTruthy();
    });

    it("should show the visible labels the board draws for a portion", () => {
      renderForm();

      addPortion();

      expect(screen.getByText("Portion 1 label")).toBeTruthy();
      expect(screen.getByText("Amount")).toBeTruthy();
      expect(screen.getByText("Default")).toBeTruthy();
      expect(screen.getByText("Remove")).toBeTruthy();
      expect(
        screen.getByRole("textbox", { name: "Portion 1 label" }).getAttribute("placeholder"),
      ).toBe("e.g. 1 slice");
    });

    it("should start the Remove button's content at the left when it fills the row", () => {
      renderForm();

      addPortion();

      expect(screen.getByRole("button", { name: "Remove portion 1" }).className).toContain(
        "justify-start",
      );
    });

    it("should mark a portion's label and amount as required", () => {
      renderForm();

      addPortion();

      expect(
        screen.getByRole("textbox", { name: "Portion 1 label" }).getAttribute("aria-required"),
      ).toBe("true");
      expect(
        screen.getByRole("textbox", { name: portionAmount(1) }).getAttribute("aria-required"),
      ).toBe("true");
    });

    it("should follow the basis for the amount unit", () => {
      renderForm();
      addPortion();

      chooseBasis("Per 100 ml");

      expect(screen.getByRole("textbox", { name: portionAmount(1, "ml") })).toBeTruthy();
      expect(screen.queryByRole("textbox", { name: portionAmount(1, "g") })).toBeNull();
      expect(screen.getByText("Each amount is in ml, to match the basis.")).toBeTruthy();
    });

    it("should send portions in grams under a per 100 g basis", async () => {
      renderForm();
      fillRequiredFields();
      addPortion();
      typeInto("Portion 1 label", "1 biscuit");
      typeInto(portionAmount(1), "13");
      addPortion();
      typeInto("Portion 2 label", "Pack");
      typeInto(portionAmount(2), "200");
      fireEvent.click(screen.getByRole("checkbox", { name: "Portion 2 is the default" }));

      save();

      await waitFor(() => {
        expect(createFood).toHaveBeenCalledTimes(1);
      });
      expect(createFood).toHaveBeenCalledWith(
        expect.objectContaining({
          portions: [
            { label: "1 biscuit", grams: 13, isDefault: false },
            { label: "Pack", grams: 200, isDefault: true },
          ],
        }),
      );
    });

    it("should send portions in millilitres under a per 100 ml basis", async () => {
      renderForm();
      fillRequiredFields();
      chooseBasis("Per 100 ml");
      addPortion();
      typeInto("Portion 1 label", "Glass");
      typeInto(portionAmount(1, "ml"), "250");

      save();

      await waitFor(() => {
        expect(createFood).toHaveBeenCalledTimes(1);
      });
      expect(createFood).toHaveBeenCalledWith(
        expect.objectContaining({ portions: [{ label: "Glass", ml: 250, isDefault: false }] }),
      );
    });

    it("should let only one portion be the default by clearing the others", () => {
      renderForm();
      addPortion();
      addPortion();

      fireEvent.click(screen.getByRole("checkbox", { name: "Portion 1 is the default" }));
      fireEvent.click(screen.getByRole("checkbox", { name: "Portion 2 is the default" }));

      expect(screen.getByRole("checkbox", { name: "Portion 1 is the default" })).toHaveProperty(
        "checked",
        false,
      );
      expect(screen.getByRole("checkbox", { name: "Portion 2 is the default" })).toHaveProperty(
        "checked",
        true,
      );
    });

    it("should remove a portion and renumber the rest", () => {
      renderForm();
      addPortion();
      addPortion();
      typeInto("Portion 1 label", "First");
      typeInto("Portion 2 label", "Second");

      fireEvent.click(screen.getByRole("button", { name: "Remove portion 1" }));

      expect(screen.getByRole("textbox", { name: "Portion 1 label" })).toHaveProperty(
        "value",
        "Second",
      );
      expect(screen.queryByRole("textbox", { name: "Portion 2 label" })).toBeNull();
    });

    it("should say a portion with no label and no amount needs both, flag both and not save", () => {
      renderForm();
      fillRequiredFields();
      addPortion();

      save();

      expect(createFood).not.toHaveBeenCalled();
      const message = "Portion 1 needs a label and an amount above 0";
      expect(screen.getAllByRole("alert").map((alert) => alert.textContent)).toContain(message);
      const label = screen.getByRole("textbox", {
        name: "Portion 1 label",
        description: message,
      });
      const amount = screen.getByRole("textbox", { name: portionAmount(1), description: message });
      expect(label.getAttribute("aria-invalid")).toBe("true");
      expect(amount.getAttribute("aria-invalid")).toBe("true");
    });

    it("should say only the label is missing and leave the amount unflagged", () => {
      renderForm();
      fillRequiredFields();
      addPortion();
      typeInto(portionAmount(1), "30");

      save();

      expect(
        screen.getByRole("textbox", {
          name: "Portion 1 label",
          description: "Portion 1 needs a label",
        }),
      ).toBeTruthy();
      expect(
        screen.getByRole("textbox", { name: portionAmount(1) }).getAttribute("aria-invalid"),
      ).toBe("false");
    });

    it("should reject a portion amount of zero and say it needs an amount above 0", () => {
      renderForm();
      fillRequiredFields();
      addPortion();
      typeInto("Portion 1 label", "Slice");
      typeInto(portionAmount(1), "0");

      save();

      expect(createFood).not.toHaveBeenCalled();
      expect(
        screen.getByRole("textbox", {
          name: portionAmount(1),
          description: "Portion 1 needs an amount above 0",
        }),
      ).toBeTruthy();
      expect(
        screen.getByRole("textbox", { name: "Portion 1 label" }).getAttribute("aria-invalid"),
      ).toBe("false");
    });
  });

  describe("telling the page a food was created", () => {
    it("should call onCreated with the new food's id, just before going to the food", async () => {
      const onCreated = vi.fn<(foodId: string) => void>();
      renderForm({ onCreated });
      fillRequiredFields();

      save();

      await waitFor(() => {
        expect(replace).toHaveBeenCalledWith(`/foods/${CREATED_FOOD_ID}`);
      });
      expect(onCreated).toHaveBeenCalledExactlyOnceWith(CREATED_FOOD_ID);
      expect(onCreated.mock.invocationCallOrder[0]).toBeLessThan(
        replace.mock.invocationCallOrder[0] ?? 0,
      );
    });

    it("should not call it when the save fails or only half works", async () => {
      const onCreated = vi.fn<(foodId: string) => void>();
      createFood.mockRejectedValueOnce(
        new FoodsPartialWriteError(CREATED_FOOD_ID, "portions failed", new Error("boom")),
      );
      renderForm({ onCreated });
      fillRequiredFields();

      save();

      await screen.findByRole("alert");
      expect(onCreated).not.toHaveBeenCalled();
      expect(replace).not.toHaveBeenCalled();
    });

    it("should not call it when the form has errors and nothing was saved", () => {
      const onCreated = vi.fn<(foodId: string) => void>();
      renderForm({ onCreated });

      save();

      expect(createFood).not.toHaveBeenCalled();
      expect(onCreated).not.toHaveBeenCalled();
    });
  });

  describe("when saving fails", () => {
    it("should say the food could not be saved, never show the raw error, and let the user try again", async () => {
      createFood.mockRejectedValueOnce(new Error("Could not create the food: network down"));
      renderForm();
      fillRequiredFields();

      save();

      const alert = await screen.findByRole("alert");
      expect(alert.textContent).toBe(
        "Your food could not be saved. Check your connection and try again.",
      );
      expect(screen.queryByText(/network down/)).toBeNull();
      expect(replace).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "Create food" }).hasAttribute("disabled")).toBe(
        false,
      );
    });

    it("should say the food was saved but its portions were not, offer the edit link and stop a duplicate create", async () => {
      createFood.mockRejectedValueOnce(
        new FoodsPartialWriteError(CREATED_FOOD_ID, "portions failed", new Error("boom")),
      );
      renderForm();
      fillRequiredFields();

      save();

      const alert = await screen.findByRole("alert");
      expect(alert.textContent).toContain(
        "Your food was saved, but its portions were not. Edit the food to add them again.",
      );
      expect(within(alert).getByRole("link", { name: "Edit the food" }).getAttribute("href")).toBe(
        `/foods/${CREATED_FOOD_ID}/edit`,
      );
      const create = screen.getByRole("button", { name: "Create food" });
      expect(create.hasAttribute("disabled")).toBe(true);
      expect(create.hasAttribute("aria-busy")).toBe(false);
      expect(screen.queryByText(/boom/)).toBeNull();
      expect(replace).not.toHaveBeenCalled();

      fireEvent.click(create);
      expect(createFood).toHaveBeenCalledTimes(1);
    });
  });

  describe("editing a food", () => {
    const existing = {
      food: makeFood({
        name: "Porridge oats",
        brand: "Scott's",
        barcode: "5000159484695",
        basis: "per_100ml",
        density_g_per_ml: 1.03,
        kcal: 120,
        protein_g: 4,
        fat_g: 2,
        carbs_g: 20,
        fibre_g: 3,
      }),
      portions: [
        makePortion({ label: "Bowl", grams: null, ml: 250, is_default: true, position: 0 }),
        makePortion({ label: "Cup", grams: null, ml: 150, is_default: false, position: 1 }),
      ],
    };

    it("should pre-fill every field from the food and its portions", () => {
      renderForm({ existing });

      expect(screen.getByRole("textbox", { name: "Name" })).toHaveProperty(
        "value",
        "Porridge oats",
      );
      expect(screen.getByRole("textbox", { name: "Brand" })).toHaveProperty("value", "Scott's");
      expect(screen.getByRole("textbox", { name: "Barcode" })).toHaveProperty(
        "value",
        "5000159484695",
      );
      expect(screen.getByRole("radio", { name: "Per 100 ml" })).toHaveProperty("checked", true);
      expect(screen.getByRole("textbox", { name: energy })).toHaveProperty("value", "120");
      expect(screen.getByRole("textbox", { name: fibre })).toHaveProperty("value", "3");
      expect(screen.getByRole("textbox", { name: "Portion 1 label" })).toHaveProperty(
        "value",
        "Bowl",
      );
      expect(screen.getByRole("textbox", { name: portionAmount(1, "ml") })).toHaveProperty(
        "value",
        "250",
      );
      expect(screen.getByRole("checkbox", { name: "Portion 1 is the default" })).toHaveProperty(
        "checked",
        true,
      );
      expect(screen.getByRole("textbox", { name: portionAmount(2, "ml") })).toHaveProperty(
        "value",
        "150",
      );
    });

    it("should keep an edit-mode barcode editable because it did not come from a scan", () => {
      renderForm({ existing });

      expect(screen.getByRole("textbox", { name: "Barcode" })).toHaveProperty("readOnly", false);
    });

    it("should not say any nutrient is not given", () => {
      renderForm({ existing });

      expect(screen.queryByText("Not given by the source")).toBeNull();
    });

    it("should call the update mutation once with the food id and go back to the food", async () => {
      renderForm({ existing });
      typeInto("Name", "Jumbo porridge oats");

      save("Save changes");

      await waitFor(() => {
        expect(replace).toHaveBeenCalledWith(`/foods/${existing.food.id}`);
      });
      expect(updateFood).toHaveBeenCalledTimes(1);
      expect(updateFood.mock.calls[0]?.[0]).toMatchObject({
        id: existing.food.id,
        input: {
          name: "Jumbo porridge oats",
          brand: "Scott's",
          basis: "per_100ml",
          portions: [
            { label: "Bowl", ml: 250, isDefault: true },
            { label: "Cup", ml: 150, isDefault: false },
          ],
        },
      });
      expect(createFood).not.toHaveBeenCalled();
    });

    it("should send no saturated fat, sugars or salt on an edit, so an update never touches them", async () => {
      renderForm({
        existing: {
          food: makeFood({ ...existing.food, sat_fat_g: 1, sugars_g: 2, salt_g: 0.1 }),
          portions: existing.portions,
        },
      });

      save("Save changes");

      await waitFor(() => {
        expect(updateFood).toHaveBeenCalledTimes(1);
      });
      const input = updateFood.mock.calls[0]?.[0].input;
      for (const key of ["sat_fat_g", "sugars_g", "salt_g"]) {
        expect(input).not.toHaveProperty(key);
      }
    });

    it("should carry the stored density through unchanged because the form does not show it", async () => {
      renderForm({ existing });

      save("Save changes");

      await waitFor(() => {
        expect(updateFood).toHaveBeenCalledTimes(1);
      });
      expect(updateFood.mock.calls[0]?.[0]).toMatchObject({
        id: existing.food.id,
        input: { density_g_per_ml: 1.03 },
      });
    });

    it("should let the user clear an optional field", async () => {
      renderForm({ existing });
      typeInto("Brand", "");
      typeInto(fibre, "");

      save("Save changes");

      await waitFor(() => {
        expect(updateFood).toHaveBeenCalledTimes(1);
      });
      const input = updateFood.mock.calls[0]?.[0].input;
      expect(input).not.toHaveProperty("brand");
      expect(input).not.toHaveProperty("fibre_g");
    });

    it("should say the changes were saved but the portions were not, and allow another try", async () => {
      updateFood.mockRejectedValueOnce(
        new FoodsPartialWriteError(existing.food.id, "portions failed", new Error("boom")),
      );
      renderForm({ existing });

      save("Save changes");

      const alert = await screen.findByRole("alert");
      expect(alert.textContent).toBe(
        "Your changes to the food were saved, but its portions were not. Try saving again.",
      );
      expect(within(alert).queryByRole("link")).toBeNull();
      expect(screen.getByRole("button", { name: "Save changes" }).hasAttribute("disabled")).toBe(
        false,
      );
      expect(replace).not.toHaveBeenCalled();
    });
  });
});
