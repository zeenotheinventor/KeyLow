import AsyncStorage from "@react-native-async-storage/async-storage";

import { reminderTypes } from "../notifications";

import type { ReminderType } from "../notifications";

/** One reminder of the plan last scheduled: when it fires and which wording it used. Never a name or a number from the person's training. */
export type ScheduledReminder = {
  type: ReminderType;
  /** An ISO timestamp in UTC. */
  fireAt: string;
  variantId: string;
};

export const scheduledRemindersStorageKey = "kl-reminders-scheduled";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function reminderTypeOf(value: unknown): ReminderType | undefined {
  return reminderTypes.find((type) => type === value);
}

function scheduledReminderFrom(value: unknown): ScheduledReminder | null {
  if (!isRecord(value)) {
    return null;
  }
  const type = reminderTypeOf(value.type);
  const { fireAt, variantId } = value;
  if (
    type === undefined ||
    typeof fireAt !== "string" ||
    Number.isNaN(Date.parse(fireAt)) ||
    typeof variantId !== "string" ||
    variantId === ""
  ) {
    return null;
  }
  return { type, fireAt, variantId };
}

/** The plan last stored. A record that cannot be read, or an entry that is not valid, counts as nothing stored. */
export async function readScheduledReminders(): Promise<ScheduledReminder[]> {
  try {
    const raw = await AsyncStorage.getItem(scheduledRemindersStorageKey);
    const stored: unknown = raw === null ? [] : JSON.parse(raw);
    if (!Array.isArray(stored)) {
      return [];
    }
    return stored.flatMap((entry: unknown) => scheduledReminderFrom(entry) ?? []);
  } catch {
    return [];
  }
}

/** A plan that cannot be stored costs only the "not the same wording twice" rule, so the failure is not raised. */
export async function writeScheduledReminders(
  reminders: readonly ScheduledReminder[],
): Promise<void> {
  try {
    await AsyncStorage.setItem(scheduledRemindersStorageKey, JSON.stringify(reminders));
  } catch {
    // Nothing to do: the next plan starts from the wording saved with the settings.
  }
}

/** For each type, the stored reminder that fired last by `now`, which is the last one the person was shown. */
export function lastDelivered(
  stored: readonly ScheduledReminder[],
  now: Date,
): ScheduledReminder[] {
  return reminderTypes.flatMap((type) => {
    const [latest] = stored
      .filter((reminder) => reminder.type === type && Date.parse(reminder.fireAt) <= now.getTime())
      .sort((first, second) => Date.parse(second.fireAt) - Date.parse(first.fireAt));
    return latest === undefined ? [] : [latest];
  });
}
