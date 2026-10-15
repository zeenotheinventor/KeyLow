import { customFoodInputSchema } from "@keylow/core/schemas";

import { emptyFoodFormValues } from "../../components/FoodForm";
import { mapIssuesToErrors } from "../../components/FoodForm/mapIssuesToErrors";
import { toRawInput } from "../../components/FoodForm/toRawInput";

import type { FoodFormValues } from "../../components/FoodForm";
import type { KeyedFoodFormValues } from "../../components/FoodForm/mapIssuesToErrors";

// The folder's index also loads the form, which reads the theme from storage.
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

const validValues: FoodFormValues = {
  ...emptyFoodFormValues,
  name: "Oat bar",
  kcal: "420",
  protein_g: "8.5",
  fat_g: "14",
  carbs_g: "62",
};

function errorsFor(values: FoodFormValues, rawInput: Record<string, unknown> = toRawInput(values)) {
  const keyed: KeyedFoodFormValues = {
    ...values,
    portions: values.portions.map((portion, index) => ({
      ...portion,
      key: `portion-${index + 1}`,
    })),
  };
  const result = customFoodInputSchema.safeParse(rawInput);
  return result.success ? {} : mapIssuesToErrors(result.error.issues, keyed);
}

describe("mapIssuesToErrors", () => {
  it("should say Energy is required, as the board draws it, for a blank energy", () => {
    expect(errorsFor({ ...validValues, kcal: "" })).toStrictEqual({ kcal: "Energy is required" });
  });

  it.each([
    ["protein_g", "Protein is required"],
    ["fat_g", "Fat is required"],
    ["carbs_g", "Carbohydrate is required"],
  ] as const)("should require %s", (field, sentence) => {
    expect(errorsFor({ ...validValues, [field]: "" })).toStrictEqual({ [field]: sentence });
  });

  it("should not require fibre", () => {
    expect(errorsFor({ ...validValues, fibre_g: "" })).toStrictEqual({});
  });

  it("should say a negative nutrient cannot be negative", () => {
    expect(errorsFor({ ...validValues, fat_g: "-2" })).toStrictEqual({
      fat_g: "Fat cannot be negative",
    });
  });

  it("should say a nutrient that is not a number must be a number", () => {
    expect(errorsFor({ ...validValues, kcal: "lots" })).toStrictEqual({
      kcal: "Energy must be a number",
    });
  });

  it("should say the name is required, or too long", () => {
    expect(errorsFor({ ...validValues, name: "  " })).toStrictEqual({ name: "Name is required" });
    expect(errorsFor({ ...validValues, name: "a".repeat(201) })).toStrictEqual({
      name: "Name must be 200 characters or fewer",
    });
  });

  it("should say what is wrong with a barcode", () => {
    expect(errorsFor({ ...validValues, barcode: "5012345678901" })).toStrictEqual({
      barcode: "Barcode check digit is wrong",
    });
  });

  it("should give a portion's label and amount their own sentences, keyed by the portion", () => {
    const values = {
      ...validValues,
      portions: [{ label: "", amount: "0", isDefault: false }],
    };

    expect(errorsFor(values)).toStrictEqual({
      "portion-1.label": "Portion 1 needs a label",
      "portion-1.amount": "Portion 1 needs an amount above 0",
    });
  });

  it("should say at most one portion can be the default, in the sentence from core's copy", () => {
    const values = {
      ...validValues,
      portions: [
        { label: "A", amount: "10", isDefault: true },
        { label: "B", amount: "20", isDefault: true },
      ],
    };

    expect(errorsFor(values)).toStrictEqual({
      portions: "At most one portion can be the default",
    });
  });

  it("should never pass an issue's own message through for a problem that maps to no field", () => {
    const errors = errorsFor(validValues, { ...toRawInput(validValues), basis: "per_100oz" });

    expect(errors).toStrictEqual({ form: "Check the fields marked below and try again." });
  });
});
