import { crispsEntry } from "./support/entries";
import { quickEntryValues } from "../lib/entryForms";

// What the entry screen hands the quick add form: the values of a logged quick add.

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
