import * as copy from "../../../src/copy";

// Every function `src/copy/trainingReminders.ts` exports, called with representative arguments. The voice
// test fails when a function has no row, so no sentence escapes the sweep.
export const samples: Record<string, () => string[]> = {
  describeTrainingReminder: () =>
    copy.TRAINING_REMINDER_TYPES.flatMap((type) =>
      copy.TRAINING_REMINDER_VARIANTS[type].flatMap(({ id }) => {
        const { title, body } = copy.describeTrainingReminder(type, id);
        return [title, body];
      }),
    ),
};
