import * as copy from "../../../src/copy";

// Every function `src/copy/remindersScreen.ts` exports, called with representative arguments. The voice
// test fails when a function has no row, so no sentence escapes the sweep.
export const samples: Record<string, () => string[]> = {
  streakNudgeNotification: () =>
    [1, 12].flatMap((days) => {
      const { title, body } = copy.streakNudgeNotification(days);
      return [title, body];
    }),
};
