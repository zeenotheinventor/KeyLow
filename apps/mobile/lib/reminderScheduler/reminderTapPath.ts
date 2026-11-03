import { routinesPath, trainPath } from "../routineRoutes";

import type { ReminderType } from "../notifications";

/**
 * Where a tap on a reminder goes: the Train tab (for "Time to train" and the missed day one), the
 * Routines page (whose Progress section follows its list, so "See your progress" lands on it, and where
 * the plan can be changed after a check in), the body map, and the Diary tab for the food reminder. The
 * address names nothing of the person's.
 */
export const reminderTapPath = (type: ReminderType): string => {
  switch (type) {
    case "train":
    case "missed":
      return trainPath();
    case "progress":
    case "checkin":
      return routinesPath();
    case "ease":
      return "/body-map";
    case "food":
      return "/diary";
  }
};
