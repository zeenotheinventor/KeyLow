import type { AchievementId, StreakNudge, UnlockNotificationPayload } from "@keylow/core";

export const reminderTypes = ["train", "progress", "ease", "missed", "checkin", "food"] as const;

export type ReminderType = (typeof reminderTypes)[number];

/** "unavailable" means this build has no notifications module, so nothing can be asked or scheduled. */
export type PermissionState = "granted" | "denied" | "undetermined" | "unavailable";

export type Reminder = {
  type: ReminderType;
  fireAt: Date;
  title: string;
  body: string;
  data: { type: ReminderType };
};

/** The one thing a tap on a notification of this app means: a reminder to open, or an unlock (a badge, or a level-up alone as null). */
export type NotificationTap =
  | { kind: "reminder"; type: ReminderType }
  | { kind: "unlock"; achievementId: AchievementId | null };

/** What the unlock notification says, as the core built it. `achievementId` is the badge a tap opens. */
export type UnlockNotification = UnlockNotificationPayload;

export type { StreakNudge };
