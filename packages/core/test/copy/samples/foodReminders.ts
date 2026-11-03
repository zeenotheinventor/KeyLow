import * as copy from "../../../src/copy";

// Every function `src/copy/foodReminders.ts` exports, called with representative arguments. The voice
// test fails when a function has no row, so no sentence escapes the sweep.
export const samples: Record<string, () => string[]> = {
  describeFoodReminder: () =>
    copy.FOOD_REMINDER_VARIANTS.flatMap(({ id }) => {
      const { title, body } = copy.describeFoodReminder(id);
      return [title, body];
    }),
};
