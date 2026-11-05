import AsyncStorage from "@react-native-async-storage/async-storage";
import { z } from "zod";

export const suggestionDismissedStorageKey = "train.suggestionDismissed";

const KEPT_DAYS = 14;

const storedDaysSchema = z.array(z.iso.date());

/**
 * The days (`YYYY-MM-DD`) whose suggestion the person put off with Not now on this device. A date is all
 * that is kept, and it is not health data. A store that cannot be read, or holds anything else, is none put off.
 */
export async function readDismissedDays(): Promise<string[]> {
  try {
    const text = await AsyncStorage.getItem(suggestionDismissedStorageKey);
    if (text === null) {
      return [];
    }
    const parsed = storedDaysSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

/** The days with `day` put off as well: once, and only the newest fourteen, so the list does not grow for ever. */
export function withDayDismissed(days: readonly string[], day: string): readonly string[] {
  return days.includes(day) ? days : [...days, day].slice(-KEPT_DAYS);
}

/** A day that cannot be stored shows the card again on the next open, so the failure is not raised. */
export async function writeDismissedDays(days: readonly string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(suggestionDismissedStorageKey, JSON.stringify(days));
  } catch {
    // Nothing to do: the card may show once more on the next open.
  }
}
