import { parseRecoveryRequestedAt } from "@keylow/core/accounts";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const recoveryRequestStorageKey = "auth.recoveryRequestedAt";

/**
 * Notes on this phone that a password reset was requested, as a time and nothing else: no email address and
 * no token. A failed link is told apart from a failed sign-in link by it. A marker that cannot be saved only
 * means the failure shows the sign-in link error, which is still a way forward, so the failure is not raised.
 */
export async function recordRecoveryRequest(now: number = Date.now()): Promise<void> {
  try {
    await AsyncStorage.setItem(recoveryRequestStorageKey, String(now));
  } catch {
    // Nothing to do: the failure path then shows the sign-in link error.
  }
}

/** When a reset was last requested on this phone. Nothing valid saved, or a store that cannot be read, is null. */
export async function readRecoveryRequestedAt(): Promise<number | null> {
  try {
    return parseRecoveryRequestedAt(await AsyncStorage.getItem(recoveryRequestStorageKey));
  } catch {
    return null;
  }
}

/** A marker that cannot be removed only ages out of the link's lifetime, so the failure is not raised. */
export async function clearRecoveryRequest(): Promise<void> {
  try {
    await AsyncStorage.removeItem(recoveryRequestStorageKey);
  } catch {
    // Nothing to do: the marker is ignored once the link's lifetime has passed.
  }
}
