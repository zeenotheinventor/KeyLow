import AsyncStorage from "@react-native-async-storage/async-storage";

export const lastSeenUpdateIdStorageKey = "updates.lastSeenId";

/**
 * The id of the update the app last started on and told the person about, or `null` for a first install.
 * A store that cannot be read is `undefined`, which is told apart from a first install so that the toast
 * is never shown from a guess.
 */
export async function readLastSeenUpdateId(): Promise<string | null | undefined> {
  try {
    return await AsyncStorage.getItem(lastSeenUpdateIdStorageKey);
  } catch {
    return undefined;
  }
}

/** An id that cannot be stored is only told again on the next start, so the failure is not raised. */
export async function writeLastSeenUpdateId(updateId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(lastSeenUpdateIdStorageKey, updateId);
  } catch {
    // Nothing to do: the toast may show once more on the next start.
  }
}
