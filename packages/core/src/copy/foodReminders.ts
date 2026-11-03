/*
 * The words of the food reminder (KEY-811). It shows on the lock screen, so it is generic: no food, number,
 * unit or calorie is named (the health data rule), and the diary waits inside the app. The tone is kind and
 * never guilty, because a day with nothing logged is not a failure.
 */

export type FoodReminderCopy = Readonly<{ title: string; body: string }>;

/** A body of the reminder and its id. The id is kept once a body is used, so editing the copy never remaps it. */
export type FoodReminderVariant = Readonly<{ id: string; body: string }>;

/** One title. The variety is in the bodies. */
export const FOOD_REMINDER_TITLE = "Log your food";

/**
 * The bodies of the reminder. The planner picks one by the fire date and never repeats the last one used.
 * Never reuse or change the meaning of an id: add a new body with a new id instead.
 */
export const FOOD_REMINDER_VARIANTS: readonly FoodReminderVariant[] = [
  { id: "food-1", body: "A quick moment to note down what you have eaten today." },
  { id: "food-2", body: "Got a minute? Your diary is ready for today's meals." },
  { id: "food-3", body: "Whenever you are ready, your diary is there." },
  { id: "food-4", body: "A few taps and today is recorded." },
  { id: "food-5", body: "No pressure. Add today's meals when it suits you." },
  { id: "food-6", body: "A tidy diary helps you see the whole picture." },
  { id: "food-7", body: "Take a moment to jot down how today went." },
];

/**
 * The words of one variant of the reminder, by its id. Throws a `RangeError` naming the rule when the id
 * is not one of the variants.
 */
export const describeFoodReminder = (variantId: string): FoodReminderCopy => {
  const variant = FOOD_REMINDER_VARIANTS.find(({ id }) => id === variantId);
  if (variant === undefined) {
    throw new RangeError("A food reminder variant id must be one of the variants");
  }
  return { title: FOOD_REMINDER_TITLE, body: variant.body };
};
