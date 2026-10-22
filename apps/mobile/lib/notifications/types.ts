export const reminderTypes = ["train", "progress", "ease"] as const;

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
