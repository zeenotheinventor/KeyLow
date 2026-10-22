import { reminderIdentifierPrefix } from "./constants";
import { loadNotifications } from "./loadNotifications";
import { reminderTypes } from "./types";

import type { ReminderType } from "./types";

type TapResponse = {
  notification: {
    request: { identifier: string; content: { data?: Record<string, unknown> } };
  };
};

function isReminderType(value: unknown): value is ReminderType {
  return reminderTypes.some((type) => type === value);
}

function reminderTypeOf(response: TapResponse): ReminderType | null {
  const { identifier, content } = response.notification.request;
  const type = content.data?.type;
  return identifier.startsWith(reminderIdentifierPrefix) && isReminderType(type) ? type : null;
}

/**
 * Calls the handler with the type of each reminder the person taps, including the tap that opened the
 * app. Returns a function that stops listening.
 */
export function onReminderTap(handler: (type: ReminderType) => void): () => void {
  const notifications = loadNotifications();
  if (notifications === null) {
    return () => undefined;
  }

  const handle = (response: TapResponse) => {
    const type = reminderTypeOf(response);
    if (type !== null) {
      handler(type);
    }
  };

  // A tap the system cannot hand over is lost, but it must not stop the app from starting.
  try {
    const openingTap = notifications.getLastNotificationResponse();
    if (openingTap !== null) {
      notifications.clearLastNotificationResponse();
      handle(openingTap);
    }
  } catch {
    // The listener below still hears every tap from here on.
  }
  const subscription = notifications.addNotificationResponseReceivedListener(handle);
  return () => {
    subscription.remove();
  };
}
