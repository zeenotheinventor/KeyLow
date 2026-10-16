import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { changedQuickValues } from "../../src/diary";

// The saved crisps: 130 kcal, P 2, C 15, F 7, "Meal deal crisps".
const crisps = {
  nutrients: { kcal: 130, protein_g: 2, carbs_g: 15, fat_g: 7 },
  snapshot: { label: "Meal deal crisps" },
};
const asLogged = { kcal: 130, protein_g: 2, carbs_g: 15, fat_g: 7, label: "Meal deal crisps" };

describe("changedQuickValues", () => {
  it("should be nothing when the values are as logged", () => {
    expect(changedQuickValues(crisps, asLogged)).toBeUndefined();
  });

  it.each([
    ["calories", { kcal: 140 }],
    ["protein", { protein_g: 3 }],
    ["carbohydrate", { carbs_g: 16 }],
    ["fat", { fat_g: 8 }],
    ["a macro cleared", { protein_g: null }],
    ["a macro set to 0", { fat_g: 0 }],
    ["the label", { label: "Crisps" }],
    ["the label cleared", { label: null }],
  ])("should hand over all five values when the %s changed", (_name, changes) => {
    expect(changedQuickValues(crisps, { ...asLogged, ...changes })).toEqual({
      ...asLogged,
      ...changes,
    });
  });

  it("should tell a macro never given from one given as 0", () => {
    const entry = { ...crisps, nutrients: { ...crisps.nutrients, protein_g: null } };

    expect(changedQuickValues(entry, { ...asLogged, protein_g: null })).toBeUndefined();
    expect(changedQuickValues(entry, { ...asLogged, protein_g: 0 })).toEqual({
      ...asLogged,
      protein_g: 0,
    });
  });

  it("should not hand over anything the form added to the values", () => {
    const submitted = { ...asLogged, kcal: 140, time: "12:45", isNow: false };

    expect(changedQuickValues(crisps, submitted)).toEqual({ ...asLogged, kcal: 140 });
  });

  it("should be nothing exactly when the values handed in are the ones logged", () => {
    const macro = fc.option(fc.integer({ min: 0, max: 500 }), { nil: null });
    const label = fc.option(fc.string({ minLength: 1 }), { nil: null });

    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5000 }),
        macro,
        macro,
        macro,
        label,
        (kcal, protein_g, carbs_g, fat_g, text) => {
          const logged = { kcal, protein_g, carbs_g, fat_g };
          const entry = { nutrients: logged, snapshot: { label: text } };

          expect(changedQuickValues(entry, { ...logged, label: text })).toBeUndefined();
          expect(changedQuickValues(entry, { ...logged, kcal: kcal + 1, label: text })).toEqual({
            ...logged,
            kcal: kcal + 1,
            label: text,
          });
        },
      ),
    );
  });
});
