/**
 * The Reminders screen, reached from More: a switch for each of the three training reminders, the time of
 * the train one, and the notices for a phone that has turned notifications off or a build that cannot
 * show them. No board draws it. The reminders' own words, the ones on the lock screen, are in
 * `trainingReminders`.
 */
export const REMINDERS_SCREEN = {
  title: "Reminders",
  back: "Back",
  /** Names the list of switches for a screen reader. */
  listName: "Reminders",
  /** In the order the screen draws them: train, progress, ease. The times in the helper lines are pinned to the planner's by a test. */
  reminders: [
    {
      type: "train",
      title: "Time to train",
      helper: "On the days your routine plans, at your chosen time.",
    },
    {
      type: "progress",
      title: "See your progress",
      helper: "On Sunday at 7pm, when an exercise went up that week.",
    },
    {
      type: "ease",
      title: "Take it easy",
      helper: "At 8am on a planned day, when your muscles still need rest.",
    },
  ],
  /** The heading over the time field. The field's own name is "Time". */
  timeHeading: "Time to train reminder",
  denied: {
    title: "Notifications are turned off",
    body: "To get reminders, allow notifications for Ki-Lo in your phone's settings.",
    action: "Open settings",
  },
  unavailable: {
    title: "Reminders need a newer version of Ki-Lo",
    body: "Install the latest version of the app to turn them on.",
  },
} as const;
