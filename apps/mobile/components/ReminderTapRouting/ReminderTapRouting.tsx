import { useReminderTapRouting } from "../../lib/reminderScheduler";

/** Draws nothing. Opens the screen a tapped reminder is for (`useReminderTapRouting`). */
export function ReminderTapRouting() {
  useReminderTapRouting();

  return null;
}
