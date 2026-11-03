import { describe, expect, it } from "vitest";

import { describeFoodReminder, FOOD_REMINDER_TITLE, FOOD_REMINDER_VARIANTS } from "../../src/copy";

describe("the food reminder copy", () => {
  it("should have one title", () => {
    expect(FOOD_REMINDER_TITLE).toBe("Log your food");
  });

  it("should have 6 to 8 different variants", () => {
    expect(FOOD_REMINDER_VARIANTS.length).toBeGreaterThanOrEqual(6);
    expect(FOOD_REMINDER_VARIANTS.length).toBeLessThanOrEqual(8);
    expect(new Set(FOOD_REMINDER_VARIANTS.map(({ body }) => body)).size).toBe(
      FOOD_REMINDER_VARIANTS.length,
    );
  });

  it("should give each variant a stable id of its number", () => {
    expect(FOOD_REMINDER_VARIANTS.map(({ id }) => id)).toEqual(
      FOOD_REMINDER_VARIANTS.map((_, index) => `food-${index + 1}`),
    );
  });

  it("should read a variant by its id", () => {
    expect(describeFoodReminder("food-1")).toEqual({
      title: FOOD_REMINDER_TITLE,
      body: FOOD_REMINDER_VARIANTS[0]?.body,
    });
    expect(describeFoodReminder("food-3").body).toBe(FOOD_REMINDER_VARIANTS[2]?.body);
  });

  it("should throw a RangeError for an id that is not a variant", () => {
    expect(() => describeFoodReminder("")).toThrow(RangeError);
    expect(() => describeFoodReminder("train-1")).toThrow(RangeError);
    expect(() => describeFoodReminder("food-99")).toThrow(RangeError);
  });

  it("should carry no number, unit or calorie word on the lock screen", () => {
    const sentences = [FOOD_REMINDER_TITLE, ...FOOD_REMINDER_VARIANTS.map(({ body }) => body)];

    for (const sentence of sentences) {
      expect(sentence).not.toMatch(/\d/);
      expect(sentence).not.toMatch(
        /\b(kcal|cals?|calor\w*|kj|kg|g|grams?|mg|ml|litres?|oz|lbs?|macros?|protein|carbs?|fat)\b/i,
      );
    }
  });
});
