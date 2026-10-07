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

function typeInto(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function fillRequiredFields() {
  typeInto("Name", "Oat cakes");
  typeInto("Energy (kcal)", "430");
  typeInto("Protein (g)", "10");
  typeInto("Fat (g)", "18");
  typeInto("Carbohydrate (g)", "56");
}

function save() {
  fireEvent.click(screen.getByRole("button", { name: "Save food" }));
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

      for (const name of ["Name", "Brand (optional)", "Barcode (optional)"]) {
        expect(screen.getByRole("textbox", { name })).toBeTruthy();
      }
      for (const name of [
        "Energy (kcal)",
        "Protein (g)",
        "Fat (g)",
        "Carbohydrate (g)",
        "Fibre (g, optional)",
      ]) {
        expect(screen.getByRole("spinbutton", { name })).toBeTruthy();
      }
      expect(screen.getByRole("combobox", { name: "Basis" })).toBeTruthy();
    });

    it("should not offer a density field", () => {
      renderForm();

      expect(screen.queryByLabelText(/density/i)).toBeNull();
    });

    it("should start with no portions", () => {
      renderForm();

      expect(screen.queryByLabelText(/Portion 1/)).toBeNull();
    });
  });

  describe("validation", () => {
    it("should not save and should explain every missing required field when the form is empty", () => {
      renderForm();

      save();

      expect(createFood).not.toHaveBeenCalled();
      expect(
        screen.getByRole("textbox", { name: "Name", description: "Enter a name" }),
      ).toBeTruthy();
      expect(
        screen.getByRole("spinbutton", {
          name: "Energy (kcal)",
          description: "Enter the energy in kcal",
        }),
      ).toBeTruthy();
      expect(
        screen.getByRole("spinbutton", {
          name: "Protein (g)",
          description: "Enter the protein in g",
        }),
      ).toBeTruthy();
      expect(
        screen.getByRole("spinbutton", { name: "Fat (g)", description: "Enter the fat in g" }),
      ).toBeTruthy();
      expect(
        screen.getByRole("spinbutton", {
          name: "Carbohydrate (g)",
          description: "Enter the carbohydrate in g",
        }),
      ).toBeTruthy();
    });

    it("should mark invalid inputs with aria-invalid and leave valid ones unmarked", () => {
      renderForm();
      typeInto("Name", "Oat cakes");

      save();

      expect(screen.getByLabelText("Name").getAttribute("aria-invalid")).toBe("false");
      expect(screen.getByLabelText("Energy (kcal)").getAttribute("aria-invalid")).toBe("true");
    });

    it("should summarise the problem in an alert", () => {
      renderForm();

      save();

      expect(screen.getByRole("alert").textContent).toContain("Check the fields marked below");
    });

    it("should treat a blank required number as a required-field error rather than zero", () => {
      renderForm();
      fillRequiredFields();
      typeInto("Fat (g)", "");

      save();

      expect(createFood).not.toHaveBeenCalled();
      expect(
        screen.getByRole("spinbutton", { name: "Fat (g)", description: "Enter the fat in g" }),
      ).toBeTruthy();
    });

    it("should reject a negative amount", () => {
      renderForm();
      fillRequiredFields();
      typeInto("Protein (g)", "-1");

      save();

      expect(createFood).not.toHaveBeenCalled();
      expect(
        screen.getByRole("spinbutton", { name: "Protein (g)", description: "Must be 0 or more" }),
      ).toBeTruthy();
    });

    it("should reject a name that is only spaces", () => {
      renderForm();
      fillRequiredFields();
      typeInto("Name", "   ");

      save();

      expect(createFood).not.toHaveBeenCalled();
      expect(
        screen.getByRole("textbox", { name: "Name", description: "Enter a name" }),
      ).toBeTruthy();
    });

    it("should reject a name longer than 200 characters", () => {
      renderForm();
      fillRequiredFields();
      typeInto("Name", "a".repeat(201));

      save();

      expect(
        screen.getByRole("textbox", { name: "Name", description: "Use 200 characters or fewer" }),
      ).toBeTruthy();
    });

    it("should explain a barcode whose check digit is wrong", () => {
      renderForm();
      fillRequiredFields();
      typeInto("Barcode (optional)", "5000159484696");

      save();

      expect(createFood).not.toHaveBeenCalled();
      expect(
        screen.getByRole("textbox", {
          name: "Barcode (optional)",
          description: "The check digit is wrong, so check the digits and try again",
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
      expect(screen.getByLabelText("Name").getAttribute("aria-invalid")).toBe("false");
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
      typeInto("Brand (optional)", "  Nairn's ");
      typeInto("Barcode (optional)", "5000159484695");
      typeInto("Fibre (g, optional)", "7.5");

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
      fireEvent.change(screen.getByRole("combobox", { name: "Basis" }), {
        target: { value: "per_100ml" },
      });

      save();

      await waitFor(() => {
        expect(createFood).toHaveBeenCalledTimes(1);
      });
      expect(createFood).toHaveBeenCalledWith(expect.objectContaining({ basis: "per_100ml" }));
    });

    it("should not save a second time while the first save is running", async () => {
      createFood.mockReturnValue(new Promise(() => undefined));
      renderForm();
      fillRequiredFields();

      save();

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Saving" }).hasAttribute("disabled")).toBe(true);
      });
      fireEvent.click(screen.getByRole("button", { name: "Saving" }));
      expect(createFood).toHaveBeenCalledTimes(1);
    });
  });

  describe("scanned barcode", () => {
    it("should pre-fill the barcode, make it read-only and say where it came from", () => {
      renderForm({ scannedBarcode: "5000159484695" });

      const barcode = screen.getByRole("textbox", {
        name: "Barcode (optional)",
        description: "This barcode came from the scan and cannot be changed here",
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

      const barcode = screen.getByLabelText("Barcode (optional)");
      expect(barcode).toHaveProperty("value", "5000159484696");
      expect(barcode).toHaveProperty("readOnly", false);
      expect(screen.queryByText(/came from the scan/)).toBeNull();
    });

    it("should show the barcode error on submit when the scanned barcode is not valid", () => {
      renderForm({ scannedBarcode: "5000159484696" });
      fillRequiredFields();

      save();

      expect(createFood).not.toHaveBeenCalled();
      expect(
        screen.getByRole("textbox", {
          name: "Barcode (optional)",
          description: "The check digit is wrong, so check the digits and try again",
        }),
      ).toBeTruthy();
    });

    it("should leave the barcode editable when nothing was scanned", () => {
      renderForm();

      expect(screen.getByLabelText("Barcode (optional)")).toHaveProperty("readOnly", false);
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
        name: "Barcode (optional)",
        description: "This barcode belongs to the food you are copying and cannot be changed here",
      });
      expect(barcode).toHaveProperty("value", "5000159484695");
      expect(barcode).toHaveProperty("readOnly", true);
    });

    it("should leave a barcode that is not valid editable so the user can fix it", () => {
      renderForm({ copyOf: { ...copyOf, food: makeFood({ barcode: "5000159484696" }) } });

      expect(screen.getByLabelText("Barcode (optional)")).toHaveProperty("readOnly", false);
    });

    it("should leave the barcode empty and editable when the food has none", () => {
      renderForm({ copyOf: { ...copyOf, food: makeFood({ barcode: null }) } });

      const barcode = screen.getByLabelText("Barcode (optional)");
      expect(barcode).toHaveProperty("value", "");
      expect(barcode).toHaveProperty("readOnly", false);
    });

    it("should create a new food and carry the density through, never updating the original", async () => {
      renderForm({ copyOf });
      typeInto("Protein (g)", "1");

      save();

      await waitFor(() => {
        expect(createFood).toHaveBeenCalledTimes(1);
      });
      expect(createFood).toHaveBeenCalledWith(
        expect.objectContaining({ density_g_per_ml: 1.03, basis: "per_100ml" }),
      );
      expect(updateFood).not.toHaveBeenCalled();
    });
  });

  describe("portions", () => {
    it("should add a portion with its own labelled fields", () => {
      renderForm();

      fireEvent.click(screen.getByRole("button", { name: "Add portion" }));

      expect(screen.getByRole("textbox", { name: "Portion 1 label" })).toBeTruthy();
      expect(screen.getByRole("spinbutton", { name: "Portion 1 amount (g)" })).toBeTruthy();
      expect(screen.getByRole("checkbox", { name: "Portion 1 is the default" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Remove portion 1" })).toBeTruthy();
    });

    it("should follow the basis for the amount unit", () => {
      renderForm();
      fireEvent.click(screen.getByRole("button", { name: "Add portion" }));

      fireEvent.change(screen.getByRole("combobox", { name: "Basis" }), {
        target: { value: "per_100ml" },
      });

      expect(screen.getByRole("spinbutton", { name: "Portion 1 amount (ml)" })).toBeTruthy();
      expect(screen.queryByRole("spinbutton", { name: "Portion 1 amount (g)" })).toBeNull();
    });

    it("should send portions in grams under a per 100 g basis", async () => {
      renderForm();
      fillRequiredFields();
      fireEvent.click(screen.getByRole("button", { name: "Add portion" }));
      typeInto("Portion 1 label", "1 biscuit");
      typeInto("Portion 1 amount (g)", "13");
      fireEvent.click(screen.getByRole("button", { name: "Add portion" }));
      typeInto("Portion 2 label", "Pack");
      typeInto("Portion 2 amount (g)", "200");
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
      fireEvent.change(screen.getByRole("combobox", { name: "Basis" }), {
        target: { value: "per_100ml" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Add portion" }));
      typeInto("Portion 1 label", "Glass");
      typeInto("Portion 1 amount (ml)", "250");

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
      fireEvent.click(screen.getByRole("button", { name: "Add portion" }));
      fireEvent.click(screen.getByRole("button", { name: "Add portion" }));

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
      fireEvent.click(screen.getByRole("button", { name: "Add portion" }));
      fireEvent.click(screen.getByRole("button", { name: "Add portion" }));
      typeInto("Portion 1 label", "First");
      typeInto("Portion 2 label", "Second");

      fireEvent.click(screen.getByRole("button", { name: "Remove portion 1" }));

      expect(screen.getByRole("textbox", { name: "Portion 1 label" })).toHaveProperty(
        "value",
        "Second",
      );
      expect(screen.queryByRole("textbox", { name: "Portion 2 label" })).toBeNull();
    });

    it("should explain a portion with no label and no amount, and not save", () => {
      renderForm();
      fillRequiredFields();
      fireEvent.click(screen.getByRole("button", { name: "Add portion" }));

      save();

      expect(createFood).not.toHaveBeenCalled();
      expect(
        screen.getByRole("textbox", { name: "Portion 1 label", description: "Enter a label" }),
      ).toBeTruthy();
      expect(
        screen.getByRole("spinbutton", {
          name: "Portion 1 amount (g)",
          description: "Enter an amount in g",
        }),
      ).toBeTruthy();
    });

    it("should reject a portion amount of zero", () => {
      renderForm();
      fillRequiredFields();
      fireEvent.click(screen.getByRole("button", { name: "Add portion" }));
      typeInto("Portion 1 label", "Slice");
      typeInto("Portion 1 amount (g)", "0");

      save();

      expect(createFood).not.toHaveBeenCalled();
      expect(
        screen.getByRole("spinbutton", {
          name: "Portion 1 amount (g)",
          description: "Must be more than 0",
        }),
      ).toBeTruthy();
    });
  });

  describe("when saving fails", () => {
    it("should show the error in the alert and let the user try again", async () => {
      createFood.mockRejectedValueOnce(new Error("Could not create the food: network down"));
      renderForm();
      fillRequiredFields();

      save();

      expect((await screen.findByRole("alert")).textContent).toContain(
        "Could not create the food: network down",
      );
      expect(replace).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "Save food" }).hasAttribute("disabled")).toBe(
        false,
      );
    });

    it("should say the food was saved but its portions were not, and stop a duplicate create", async () => {
      createFood.mockRejectedValueOnce(
        new FoodsPartialWriteError(CREATED_FOOD_ID, "portions failed", new Error("boom")),
      );
      renderForm();
      fillRequiredFields();

      save();

      const alert = await screen.findByRole("alert");
      expect(alert.textContent).toContain("Your food was saved, but its portions were not");
      expect(within(alert).getByRole("link", { name: "Edit the food" }).getAttribute("href")).toBe(
        `/foods/${CREATED_FOOD_ID}/edit`,
      );
      expect(screen.getByRole("button", { name: "Save food" }).hasAttribute("disabled")).toBe(true);
      expect(replace).not.toHaveBeenCalled();
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

      expect(screen.getByLabelText("Name")).toHaveProperty("value", "Porridge oats");
      expect(screen.getByLabelText("Brand (optional)")).toHaveProperty("value", "Scott's");
      expect(screen.getByLabelText("Barcode (optional)")).toHaveProperty("value", "5000159484695");
      expect(screen.getByLabelText("Basis")).toHaveProperty("value", "per_100ml");
      expect(screen.getByLabelText("Energy (kcal)")).toHaveProperty("value", "120");
      expect(screen.getByLabelText("Fibre (g, optional)")).toHaveProperty("value", "3");
      expect(screen.getByLabelText("Portion 1 label")).toHaveProperty("value", "Bowl");
      expect(screen.getByLabelText("Portion 1 amount (ml)")).toHaveProperty("value", "250");
      expect(screen.getByRole("checkbox", { name: "Portion 1 is the default" })).toHaveProperty(
        "checked",
        true,
      );
      expect(screen.getByLabelText("Portion 2 amount (ml)")).toHaveProperty("value", "150");
    });

    it("should keep an edit-mode barcode editable because it did not come from a scan", () => {
      renderForm({ existing });

      expect(screen.getByLabelText("Barcode (optional)")).toHaveProperty("readOnly", false);
    });

    it("should call the update mutation once with the food id and go back to the food", async () => {
      renderForm({ existing });
      typeInto("Name", "Jumbo porridge oats");

      save();

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

    it("should carry the stored density through unchanged because the form does not show it", async () => {
      renderForm({ existing });

      save();

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
      typeInto("Brand (optional)", "");
      typeInto("Fibre (g, optional)", "");

      save();

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

      save();

      const alert = await screen.findByRole("alert");
      expect(alert.textContent).toContain(
        "Your changes to the food were saved, but its portions were not",
      );
      expect(screen.getByRole("button", { name: "Save food" }).hasAttribute("disabled")).toBe(
        false,
      );
      expect(replace).not.toHaveBeenCalled();
    });
  });
});
