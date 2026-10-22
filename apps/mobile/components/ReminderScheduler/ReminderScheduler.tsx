import { useReminderScheduler } from "../../lib/reminderScheduler";

/** Draws nothing. Keeps the scheduled reminders equal to the plan (`useReminderScheduler`). */
export function ReminderScheduler() {
  useReminderScheduler();

  return null;
}
