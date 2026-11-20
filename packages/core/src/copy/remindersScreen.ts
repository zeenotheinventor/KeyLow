/**
 * The Reminders screen, reached from More: a Training group with a switch for each of the five training
 * reminders and the time of the train one, a Food group with the food reminder's switch and time, an
 * Achievements group with the switches for badges and the streak (board 6 of the achievements boards), and
 * the notices for a phone that has turned notifications off or a build that cannot show them. The
 * reminders' own words, the ones on the lock screen, are in `trainingReminders` and
 * `foodReminders`.
 */
export const REMINDERS_SCREEN = {
  title: "Reminders",
  back: "Back",
  /** The headings over the three groups of switches. */
  groups: { training: "Training", food: "Food", achievements: "Achievements" },
  /** In the order the screen draws them: train, progress, ease, missed, checkin. The times and the number of days in the helper lines are pinned to the planner's by a test. */
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
    {
      type: "missed",
      title: "Missed a day",
      helper: "The morning after a planned day you missed, a nudge to get back to it.",
    },
    {
      type: "checkin",
      title: "Check in",
      helper: "After three planned days missed in a row, once.",
    },
  ],
  /** The food reminder, in the group after the training ones. */
  food: {
    title: "Log your food",
    helper: "Every day at your chosen time, unless you've already logged.",
  },
  /** The Achievements group, board 6 of the achievements boards: the unlock notifications and the evening streak nudge. */
  achievements: {
    /** The pill beside each of the two switches. */
    newLabel: "New",
    badges: {
      title: "Badges and levels",
      helper: "When you earn a badge or reach a new level while Ki-Lo is closed.",
    },
    streak: {
      title: "Keep your streak",
      helper: "At 8pm, if today is not complete yet.",
    },
  },
  /** The heading over the time field. The field's own name is "Time". */
  timeHeading: "Time to train reminder",
  /** The heading over the food time field. The field's own name is "Time". */
  foodTimeHeading: "Log your food reminder",
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

/** The evening nudge for a day that is not complete yet. `days` is the daily streak it would keep. */
export const streakNudgeNotification = (
  days: number,
): Readonly<{ title: string; body: string }> => ({
  title: REMINDERS_SCREEN.achievements.streak.title,
  body: `Complete today to keep your ${days}-day streak`,
});
