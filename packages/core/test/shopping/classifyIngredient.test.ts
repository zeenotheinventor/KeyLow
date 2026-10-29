import { describe, expect, it } from "vitest";

import { classifyIngredient } from "../../src/shopping";

import type { IngredientClass } from "../../src/shopping";

const kindOf = (name: string, food_group: string | null): IngredientClass["kind"] =>
  classifyIngredient({ name, food_group }).kind;

describe("classifyIngredient", () => {
  it.each([
    ["Thyme, fresh", "H"],
    ["Rosemary, fresh", "H"],
    ["Pepper, capsicum, red, raw", "DG"],
    ["Peppers, capsicum, chilli, red, raw", "DG"],
    ["Rice, white, basmati", "AC"],
    ["Potatoes, old, raw", "DG"],
    ["Cabbage, green", "DG"],
    ["Beef, silverside, salted", "MAA"],
    ["Cashew nuts, roasted and salted", "GA"],
    ["Ginger, fresh", "H"],
    ["Onions, raw", "DG"],
    ["Garlic, raw", "DG"],
    ["Butter, salted", "OB"],
    ["Milk, semi-skimmed", "MAE"],
    ["Tomatoes, canned, whole contents", "DG"],
    ["Lentils, red, dried, raw", "DB"],
    ["Pasta, white, dried, raw", "AC"],
    ["Apricots, dried", "FA"],
    ["Tuna, canned in sunflower oil, drained", "JR"],
    ["Sugar snap peas", null],
    ["fresh rosemary", null],
    ["Chicken thighs", null],
  ])("should keep %s (group %s) as an item to buy", (name, group) => {
    expect(kindOf(name, group)).toBe("item");
  });

  it.each([
    ["Thyme, dried, ground", "H"],
    ["Basil, dried, ground", "H"],
    ["Pepper, black", "H"],
    ["Pepper, white", "H"],
    ["Chilli powder", "H"],
    ["Chilli powder", null],
    ["Cumin seeds", "H"],
    ["Saffron", "H"],
    ["Soy sauce, light and dark varieties", "WCN"],
    ["Soy sauce", null],
    ["Salt", "WY"],
    ["Sea salt flakes", null],
    ["Stock cubes, chicken", "WY"],
    ["Stock, chicken, ready made, retail", "WY"],
    ["Oil, olive", "OC"],
    ["Olive oil", null],
    ["Vinegar", "WY"],
    ["Worcestershire sauce", "WCN"],
    ["Tomato ketchup", "WCN"],
    ["Flour, wheat, white, plain", "AF"],
    ["Sugar, white", "SC"],
    ["Baking powder", "WY"],
    ["Bicarbonate of soda", "WY"],
    ["Yeast, dried", "WY"],
    ["Mustard, wholegrain", "WY"],
    ["Water, distilled", "WY"],
    ["black pepper", null],
    ["Paprika", null],
  ])("should leave %s (group %s) out as a store cupboard staple", (name, group) => {
    expect(kindOf(name, group)).toBe("staple");
  });

  it("should say which rule decided", () => {
    expect(classifyIngredient({ name: "Thyme, fresh", food_group: "H" })).toEqual({
      kind: "item",
      rule: "fresh",
    });
    expect(classifyIngredient({ name: "Thyme, dried, ground", food_group: "H" })).toEqual({
      kind: "staple",
      rule: "dried",
    });
    expect(classifyIngredient({ name: "Salt", food_group: null })).toEqual({
      kind: "staple",
      rule: "staple_name",
    });
    expect(classifyIngredient({ name: "Asafoetida powder blend", food_group: "H" })).toEqual({
      kind: "staple",
      rule: "dried",
    });
    expect(classifyIngredient({ name: "Pesto, green", food_group: "WC" })).toEqual({
      kind: "staple",
      rule: "food_group",
    });
    expect(classifyIngredient({ name: "Tamarind pulp, flesh only", food_group: "H" })).toEqual({
      kind: "staple",
      rule: "food_group",
    });
    expect(classifyIngredient({ name: "Cabbage, green", food_group: "DG" })).toEqual({
      kind: "item",
      rule: "default",
    });
  });

  it("should count only a dried word in group H, so a dried fruit or pulse is still bought", () => {
    expect(kindOf("Mixed herbs, dried", "H")).toBe("staple");
    expect(kindOf("Mixed herbs, dried", null)).toBe("item");
    expect(kindOf("Figs, dried", "FA")).toBe("item");
  });

  it("should read a staple name from the first part of the name only", () => {
    expect(kindOf("Oil, sunflower", null)).toBe("staple");
    expect(kindOf("Sardines, canned in oil", null)).toBe("item");
    expect(kindOf("Peppers, red", null)).toBe("item");
  });

  it("should read the group without minding its case or spaces", () => {
    expect(kindOf("Bay leaf", " h ")).toBe("staple");
    expect(kindOf("Bay leaf", null)).toBe("item");
  });

  it("should keep an empty or unknown name as an item", () => {
    expect(kindOf("", null)).toBe("item");
    expect(kindOf(",,,", "ZZ")).toBe("item");
  });
});
