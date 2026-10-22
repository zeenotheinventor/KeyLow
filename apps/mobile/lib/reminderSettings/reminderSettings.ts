import AsyncStorage from "@react-native-async-storage/async-storage";

import type { ReminderType } from "../notifications";

export type ReminderSettings = {
  trainEnabled: boolean;
  progressEnabled: boolean;
  easeEnabled: boolean;
  /** The time of day for the train reminder, as 24 hour "HH:MM". */
  trainTime: string;
  /** The id of the wording variant each reminder used last, so the next one can differ. Null before the first. */
  lastVariant: Record<ReminderType, string | null>;
};

export const reminderSettingsStorageKey = "kl-reminders";

export const defaultReminderSettings: ReminderSettings = {
  trainEnabled: false,
  progressEnabled: false,
  easeEnabled: false,
  trainTime: "17:30",
  lastVariant: { train: null, progress: null, ease: null },
};

const timeOfDay = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isTimeOfDay(value: unknown): value is string {
  return typeof value === "string" && timeOfDay.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function booleanOr(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function timeOr(value: unknown, fallback: string): string {
  return isTimeOfDay(value) ? value : fallback;
}

function variantsFrom(value: unknown): ReminderSettings["lastVariant"] {
  const stored = isRecord(value) ? value : {};
  const variant = (type: ReminderType) => {
    const entry = stored[type];
    return typeof entry === "string" && entry !== "" ? entry : null;
  };
  return { train: variant("train"), progress: variant("progress"), ease: variant("ease") };
}

/** Keeps each valid field of a saved record and defaults the rest, so one bad field loses nothing else. */
function parseReminderSettings(raw: string): ReminderSettings {
  let stored: unknown;
  try {
    stored = JSON.parse(raw);
  } catch {
    return defaultReminderSettings;
  }
  if (!isRecord(stored)) {
    return defaultReminderSettings;
  }
  return {
    trainEnabled: booleanOr(stored.trainEnabled, defaultReminderSettings.trainEnabled),
    progressEnabled: booleanOr(stored.progressEnabled, defaultReminderSettings.progressEnabled),
    easeEnabled: booleanOr(stored.easeEnabled, defaultReminderSettings.easeEnabled),
    trainTime: timeOr(stored.trainTime, defaultReminderSettings.trainTime),
    lastVariant: variantsFrom(stored.lastVariant),
  };
}

/** The saved settings, or the defaults (every reminder off) when nothing valid is saved or storage cannot be read. */
export async function readReminderSettings(): Promise<ReminderSettings> {
  try {
    const raw = await AsyncStorage.getItem(reminderSettingsStorageKey);
    return raw === null ? defaultReminderSettings : parseReminderSettings(raw);
  } catch {
    return defaultReminderSettings;
  }
}

/**
 * Settings that cannot be saved still apply for this session, so the failure is not raised. Settings
 * with a train time that is not a time of day are not saved at all.
 */
export async function writeReminderSettings(settings: ReminderSettings): Promise<void> {
  if (!isTimeOfDay(settings.trainTime)) {
    return;
  }
  try {
    await AsyncStorage.setItem(reminderSettingsStorageKey, JSON.stringify(settings));
  } catch {
    // Nothing to do: the next launch starts from the last settings that did save.
  }
}
