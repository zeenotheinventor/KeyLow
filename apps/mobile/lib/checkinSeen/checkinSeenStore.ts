import AsyncStorage from "@react-native-async-storage/async-storage";

export const checkinSeenStorageKey = "program.checkinSeen";

/**
 * The date (`YYYY-MM-DD`) of the newest check-in whose arrival the Programme screen has shown on this device, or
 * null when it has shown none. A date is all that is kept, and it is not health data. A store that cannot be read
 * is an error to the caller, which then plays nothing, so the motion is never shown from a guess.
 */
export async function readCheckinSeenDate(): Promise<string | null> {
  return AsyncStorage.getItem(checkinSeenStorageKey);
}

/** A date that cannot be stored means the motion may play once more on the next open, so the failure is not raised. */
export async function writeCheckinSeenDate(checkinDate: string): Promise<void> {
  try {
    await AsyncStorage.setItem(checkinSeenStorageKey, checkinDate);
  } catch {
    // Nothing to do: the arrival may show once more on the next open.
  }
}
