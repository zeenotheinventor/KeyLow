import { Platform } from "react-native";

import {
  achievementsChannelId,
  achievementsChannelName,
  reminderChannelId,
  reminderChannelName,
} from "./constants";
import { loadNotifications } from "./loadNotifications";

/** Creates the Android channels (reminders, and badges and levels) and lets a reminder show while the app is open. Safe to call more than once. */
export async function setUpReminderNotifications(): Promise<void> {
  const notifications = loadNotifications();
  if (notifications === null) {
    return;
  }
  notifications.setNotificationHandler({
    handleNotification: () =>
      Promise.resolve({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
  });
  if (Platform.OS === "android") {
    await notifications.setNotificationChannelAsync(reminderChannelId, {
      name: reminderChannelName,
      importance: notifications.AndroidImportance.DEFAULT,
    });
    await notifications.setNotificationChannelAsync(achievementsChannelId, {
      name: achievementsChannelName,
      importance: notifications.AndroidImportance.DEFAULT,
    });
  }
}
