import {
  useReminderScheduler,
  useStreakNudgeScheduler,
  useUnlockNotificationPoster,
} from "../../lib/reminderScheduler";

/**
 * Draws nothing. Keeps the scheduled reminders equal to the plan (`useReminderScheduler`), posts the
 * notification for a badge or level earned while the app is closed (`useUnlockNotificationPoster`), and
 * keeps the evening streak nudge right (`useStreakNudgeScheduler`).
 */
export function ReminderScheduler({ accountId }: { accountId: string | null }) {
  useReminderScheduler();
  useUnlockNotificationPoster(accountId);
  useStreakNudgeScheduler();

  return null;
}
