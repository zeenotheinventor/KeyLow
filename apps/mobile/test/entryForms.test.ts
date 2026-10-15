import { breastEntry, chickenEntry, crispsEntry } from "./support/entries";
import { foodEntryForm, quickEntryValues } from "../lib/entryForms";

// What the entry screen hands the forms: the picker for a logged food, drawn from its own snapshot, and the
// values of a logged quick add.

describe("foodEntryForm", () => {
  it("should draw the food as it was logged, from the snapshot", () => {
    const { food } = foodEntryForm(chickenEntry());

    expect(food).toMatchObject({
      name: "Chicken breast, grilled",
      kcal: 148,
      protein_g: 32,
      fat_g: 2.2,
      carbs_g: 0,
      basis: "per_100g",
    });
  });

  it("should offer no portion and start at the grams for an entry logged in grams", () => {
    const { portions, initialAmount } = foodEntryForm(chickenEntry());

    expect(portions).toEqual([]);
    expect(initialAmount).toEqual({ unit: "g", quantity: 150 });
  });

  it("should offer the portion the entry was logged with, and start at the count of it", () => {
    const { portions, initialAmount } = foodEntryForm(breastEntry());

    expect(portions).toHaveLength(1);
    expect(portions[0]).toMatchObject({ label: "1 breast", grams: 150, ml: null });
    expect(initialAmount).toEqual({ unit: "portion", quantity: 2, portion: portions[0] });
  });

  it("should give that portion the id the entry holds, so the chip is the portion", () => {
    const entry = breastEntry();
    const { portions } = foodEntryForm(entry);

    expect(portions[0]?.id).toBe(entry.portion_id);
  });

  it("should still offer the portion when it was replaced after the entry was logged", () => {
    const { portions } = foodEntryForm(breastEntry({ portion_id: null }));

    expect(portions).toHaveLength(1);
    expect(portions[0]?.id).not.toBe("");
  });

  it("should show an entry logged in ounces in grams, the units the picker has", () => {
    const entry = chickenEntry({
      unit: "oz",
      quantity: 5,
      snapshot: { ...chickenEntry().snapshot, unit: "oz", quantity: 5 },
    });

    expect(foodEntryForm(entry).initialAmount).toEqual({ unit: "g", quantity: 141.7 });
  });
});

describe("quickEntryValues", () => {
  it("should write the saved numbers and label as the form's text", () => {
    expect(quickEntryValues(crispsEntry())).toEqual({
      kcal: "130",
      protein: "2",
      carbs: "15",
      fat: "7",
      label: "Meal deal crisps",
    });
  });

  it("should leave a macro the quick add never had, and a label it never had, blank", () => {
    const entry = crispsEntry({
      nutrients: { kcal: 300, protein_g: null, fat_g: null, carbs_g: null, fibre_g: null },
      snapshot: { v: 1, kind: "quick", label: null },
    });

    expect(quickEntryValues(entry)).toEqual({
      kcal: "300",
      protein: "",
      carbs: "",
      fat: "",
      label: "",
    });
  });

  it("should write a 0 g macro as 0, which is given, not blank", () => {
    const entry = crispsEntry({
      nutrients: { kcal: 130, protein_g: 0, fat_g: 7, carbs_g: 15, fibre_g: null },
    });

    expect(quickEntryValues(entry).protein).toBe("0");
  });
});
