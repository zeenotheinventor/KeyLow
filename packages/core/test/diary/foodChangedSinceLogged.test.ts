import { describe, expect, it } from "vitest";

import { buildFoodSnapshot } from "../../src/diary/buildFoodSnapshot";
import { foodChangedSinceLogged } from "../../src/diary/foodChangedSinceLogged";
import { buildFood, buildFoodPortion } from "../../src/testing";

const chicken = buildFood({
  id: "00000000-0000-4000-8000-0000000000d1",
  name: "Chicken breast, grilled",
  kcal: 148,
  protein_g: 32,
  fat_g: 2.2,
  carbs_g: 0,
});
const loggedSnapshot = buildFoodSnapshot(chicken, { quantity: 150, unit: "g" });

describe("foodChangedSinceLogged", () => {
  it("should say the food is unchanged when it is the one the snapshot was taken from", () => {
    expect(foodChangedSinceLogged(chicken, loggedSnapshot)).toBe(false);
  });

  it("should not look at the amount that was logged", () => {
    const small = buildFoodSnapshot(chicken, { quantity: 20, unit: "g" });

    expect(foodChangedSinceLogged(chicken, small)).toBe(false);
  });

  it("should say it changed when the name changed", () => {
    expect(foodChangedSinceLogged({ ...chicken, name: "Chicken fillet" }, loggedSnapshot)).toBe(
      true,
    );
  });

  it.each([
    ["energy", { kcal: 150 }],
    ["protein", { protein_g: 31 }],
    ["fat", { fat_g: 3 }],
    ["carbohydrate", { carbs_g: 1 }],
    ["fibre", { fibre_g: 1 }],
    ["a value the snapshot did not hold", { salt_g: 0.4 }],
    ["the basis", { basis: "per_100ml" as const, density_g_per_ml: 1 }],
    ["the density", { density_g_per_ml: 1.03 }],
  ])("should say it changed when the %s changed", (_name, change) => {
    expect(foodChangedSinceLogged({ ...chicken, ...change }, loggedSnapshot)).toBe(true);
  });

  it("should say it changed when a value the snapshot held is no longer given", () => {
    const salted = buildFood({ ...chicken, salt_g: 0.4 });
    const snapshot = buildFoodSnapshot(salted, { quantity: 150, unit: "g" });

    expect(foodChangedSinceLogged({ ...salted, salt_g: null }, snapshot)).toBe(true);
  });

  it("should not count what an entry never keeps: the brand, the barcode, the quality flags or the micronutrients", () => {
    const rebranded = {
      ...chicken,
      brand: "Acme",
      barcode: "5012345678900",
      quality: { suspect: true },
      micros: { iron_mg: 1 },
      food_group: "meat",
    };

    expect(foodChangedSinceLogged(rebranded, loggedSnapshot)).toBe(false);
  });

  it("should not count a portion, which the snapshot keeps with the amount that used it", () => {
    const slice = buildFoodPortion({ label: "1 breast", grams: 150 });
    const asPortion = buildFoodSnapshot(chicken, { quantity: 1, unit: "portion", portion: slice });

    expect(foodChangedSinceLogged(chicken, asPortion)).toBe(false);
  });
});
