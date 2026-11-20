import { ACHIEVEMENTS } from "@keylow/core";

import { reminderIdentifierPrefix, unlockIdentifierPrefix } from "./constants";
import { loadNotifications } from "./loadNotifications";
import { reminderTypes } from "./types";

import type { NotificationTap, ReminderType } from "./types";

type TapResponse = {
  notification: {
    request: { identifier: string; content: { data?: Record<string, unknown> } };
  };
};

function isReminderType(value: unknown): value is ReminderType {
  return reminderTypes.some((type) => type === value);
}

function tapOf(response: TapResponse): NotificationTap | null {
  const { identifier, content } = response.notification.request;
  const data = content.data;
  if (identifier.startsWith(reminderIdentifierPrefix) && isReminderType(data?.type)) {
    return { kind: "reminder", type: data.type };
  }
  if (identifier.startsWith(unlockIdentifierPrefix) && data?.kind === "unlock") {
    if (data.achievementId === null) {
      return { kind: "unlock", achievementId: null };
    }
    // Looked up in the catalogue, so a badge it does not know can never become an address.
    const achievementId = ACHIEVEMENTS.find(({ id }) => id === data.achievementId)?.id;
    return achievementId === undefined ? null : { kind: "unlock", achievementId };
  }
  return null;
}

/**
 * Calls the handler with what each tap on one of this app's notifications means, including the tap that
 * opened the app. Returns a function that stops listening.
 */
export function onNotificationTap(handler: (tap: NotificationTap) => void): () => void {
  const notifications = loadNotifications();
  if (notifications === null) {
    return () => undefined;
  }

  const handle = (response: TapResponse) => {
    const tap = tapOf(response);
    if (tap !== null) {
      handler(tap);
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
