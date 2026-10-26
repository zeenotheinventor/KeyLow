import { describe, expect, it } from "vitest";

import * as core from "../../src";
import * as plate from "../../src/plate";

describe("the plate module", () => {
  it("should be re-exported by the package root", () => {
    for (const [name, value] of Object.entries(plate)) {
      expect(core).toHaveProperty(name, value);
    }
  });

  it("should export its public surface", () => {
    expect(Object.keys(plate).sort()).toEqual([
      "addToPlate",
      "canLogPlate",
      "clearPlate",
      "isPlateItemValid",
      "plateFoodAmount",
      "plateItemName",
      "plateItemOfHit",
      "plateItemOfPickedFood",
      "plateItemOfRecent",
      "plateItemOfRecipe",
      "plateItemValues",
      "plateTotals",
      "plateUnitWord",
      "plateUnitWords",
      "removePlateItem",
      "replacePlateItem",
      "restorePlate",
      "setPlateQuantity",
    ]);
  });
});
