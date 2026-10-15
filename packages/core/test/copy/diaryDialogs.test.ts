import { describe, expect, it } from "vitest";

import {
  ADD_FOOD_DIALOG,
  EDIT_ENTRY_DIALOG,
  QUICK_ADD_DIALOG,
  TIME_FIELD,
  TIME_ROW_LABEL,
} from "../../src/copy";

describe("the time field's wording", () => {
  it("should pin the words the web boards draw", () => {
    expect(TIME_FIELD.nowHelper).toBe("Now");
    expect(TIME_FIELD.pickerName).toBe("Choose a time");
    expect(TIME_FIELD.hours).toBe("Hours");
    expect(TIME_FIELD.minutes).toBe("Minutes");
    expect(TIME_FIELD.done).toBe("Done");
    expect(TIME_ROW_LABEL).toBe("Time");
  });
});

describe("the add food dialog's wording", () => {
  it("should pin the drawn words", () => {
    expect(ADD_FOOD_DIALOG).toEqual({
      title: "Add food",
      searchLabel: "Search foods",
      backToResults: "Results",
      cancel: "Cancel",
    });
  });
});

describe("the edit entry dialog's wording", () => {
  it("should pin the drawn words", () => {
    expect(EDIT_ENTRY_DIALOG).toEqual({
      title: "Edit entry",
      save: "Save",
      cancel: "Cancel",
      delete: "Delete",
    });
  });
});

describe("the quick add dialog's wording", () => {
  it("should pin the drawn words, with the macros in the order protein, carbohydrate, fat", () => {
    expect(QUICK_ADD_DIALOG).toEqual({
      title: "Quick add",
      calories: "Calories",
      protein: "Protein",
      carbs: "Carbohydrate",
      fat: "Fat",
      label: "Label (optional)",
      add: "Add",
      cancel: "Cancel",
    });
  });
});
