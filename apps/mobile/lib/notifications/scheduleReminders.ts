import { reminderChannelId, reminderIdentifierPrefix } from "./constants";
import { loadNotifications } from "./loadNotifications";

import type { Reminder } from "./types";

/** Schedules each reminder that is still ahead. The caller has the permission and cancels the old ones first. */
export async function scheduleReminders(reminders: readonly Reminder[]): Promise<void> {
  const notifications = loadNotifications();
  if (notifications === null) {
    return;
  }
  const now = Date.now();
  for (const { type, fireAt, title, body } of reminders) {
    if (fireAt.getTime() <= now) {
      continue;
    }
    try {
      await notifications.scheduleNotificationAsync({
        identifier: `${reminderIdentifierPrefix}${type}:${fireAt.getTime()}`,
        // Only the type goes in the data, so nothing about the person can ride along in a notification.
        content: { title, body, data: { type } },
        trigger: {
          type: notifications.SchedulableTriggerInputTypes.DATE,
          date: fireAt,
          channelId: reminderChannelId,
        },
      });
    } catch {
      // The system's message can quote the content, which is the person's data, so it is not passed on.
      throw new Error("A reminder could not be scheduled");
    }
  }
}

/** Cancels the reminders this app scheduled and no other notification. */
export async function cancelOurReminders(): Promise<void> {
  const notifications = loadNotifications();
  if (notifications === null) {
    return;
  }
  const scheduled = await notifications.getAllScheduledNotificationsAsync();
  for (const { identifier } of scheduled) {
    if (identifier.startsWith(reminderIdentifierPrefix)) {
      await notifications.cancelScheduledNotificationAsync(identifier);
    }
  }
}

let queue: Promise<void> = Promise.resolve();

/**
 * Replaces the reminders this app has scheduled with the given ones. Calls queue, so two quick calls
 * (a settings change and an app start, say) never interleave and leave both plans pending.
 */
export function replaceReminders(reminders: readonly Reminder[]): Promise<void> {
  const replacement = queue.then(async () => {
    await cancelOurReminders();
    await scheduleReminders(reminders);
  });
  queue = replacement.catch(() => undefined);
  return replacement;
}
