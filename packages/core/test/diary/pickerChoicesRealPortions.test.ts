import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { pickerChoices } from "../../src/diary/pickerChoices";
import { startingAmount } from "../../src/diary/startingAmount";
import { buildFood, buildFoodPortion } from "../../src/testing";

// The portions file is read where it lives, so a label changed in it fails here.
const portionsFile = path.join(
  import.meta.dirname,
  "..",
  "..",
  "..",
  "db",
  "data",
  "portions",
  "cofid-portions.csv",
);

// The first six columns of the file never hold a comma or a quote, so a split is enough to read them.
const [, ...fileLines] = readFileSync(portionsFile, "utf8").split("\n").filter(Boolean);
const fileRows = fileLines.map((line) => {
  const [foodCode = "", label = "", grams = "", ml = "", isDefault = "", position = ""] =
    line.split(",");
  return { foodCode, label, grams, ml, isDefault, position };
});

const portionsOf = (foodCode: string) =>
  fileRows
    .filter((row) => row.foodCode === foodCode)
    .map((row) =>
      buildFoodPortion({
        id: `${foodCode}-${row.position}`,
        label: row.label,
        grams: row.grams === "" ? null : Number(row.grams),
        ml: row.ml === "" ? null : Number(row.ml),
        is_default: row.isDefault === "true",
        position: Number(row.position),
      }),
    );

describe("the picker on the portions file", () => {
  it("should open the banana on 1 medium, with its three sizes in order and g last", () => {
    const banana = buildFood({
      source: "cofid",
      source_ref: "14-318",
      food_group: "FA",
      name: "Bananas, flesh only",
    });
    const choices = pickerChoices(banana, [...portionsOf("14-318")].reverse());

    expect(choices.options.map((option) => option.label)).toEqual([
      "1 small",
      "1 medium",
      "1 large",
      "g",
    ]);
    expect(startingAmount(banana, choices.portions)).toEqual({
      quantity: "1",
      unitValue: "14-318-1",
    });
    expect(choices.options.find((option) => option.value === "14-318-1")?.label).toBe("1 medium");
  });

  it("should open the chicken thigh on 1 thigh", () => {
    const thigh = buildFood({
      source: "cofid",
      source_ref: "18-317",
      food_group: "MCA",
      name: "Chicken, thighs, casseroled, meat and skin",
    });
    const choices = pickerChoices(thigh, portionsOf("18-317"));
    const start = startingAmount(thigh, choices.portions);

    expect(start.quantity).toBe("1");
    expect(choices.options.find((option) => option.value === start.unitValue)?.label).toBe(
      "1 thigh",
    );
    expect(choices.options.map((option) => option.label).slice(0, 2)).toEqual(["1 thigh", "g"]);
  });
});
