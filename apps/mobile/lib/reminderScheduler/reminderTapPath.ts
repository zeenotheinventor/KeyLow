import { routinesPath, trainPath } from "../routineRoutes";

import type { ReminderType } from "../notifications";

/**
 * Where a tap on a reminder goes: the Train tab, the Routines page (whose Progress section follows its
 * list, so "See your progress" lands on it), and the body map. The address names nothing of the person's.
 */
export const reminderTapPath = (type: ReminderType): string => {
  switch (type) {
    case "train":
      return trainPath();
    case "progress":
      return routinesPath();
    case "ease":
      return "/body-map";
  }
};
