import AsyncStorage from "@react-native-async-storage/async-storage";

export const pendingAccountDeletionStorageKey = "account.deletionPending";

const accountIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Notes on this phone that a deletion of this account was started, so a relaunch can finish the clean-up if
 * the app is killed after the server deleted the account. The value is the account id and nothing else: no
 * email and no health data. Every call swallows a store failure: a marker that cannot be written only costs
 * the relaunch clean-up, and one that cannot be read or removed is tried again at the next start.
 */
export async function markAccountDeletionPending(accountId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(pendingAccountDeletionStorageKey, accountId);
  } catch {
    // Nothing to do: see above.
  }
}

/** The id of the account whose deletion was started, or null for no marker, a value that is not an id, or a failed read. */
export async function readPendingAccountDeletion(): Promise<string | null> {
  try {
    const stored = await AsyncStorage.getItem(pendingAccountDeletionStorageKey);
    return stored !== null && accountIdPattern.test(stored) ? stored : null;
  } catch {
    return null;
  }
}

export async function clearPendingAccountDeletion(): Promise<void> {
  try {
    await AsyncStorage.removeItem(pendingAccountDeletionStorageKey);
  } catch {
    // Nothing to do: see above.
  }
}
