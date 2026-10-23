import AsyncStorage from "@react-native-async-storage/async-storage";

export const bodyMapHintStorageKey = "bodyMap.hintSeen";

/**
 * Whether the first-open hint has been seen on this device. A store that cannot be read counts as seen,
 * so the hint is never shown from a guess.
 */
export async function readBodyMapHintSeen(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(bodyMapHintStorageKey)) === "true";
  } catch {
    return true;
  }
}

/** A hint that cannot be marked seen is still gone for this visit, so the failure is not raised. */
export async function writeBodyMapHintSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(bodyMapHintStorageKey, "true");
  } catch {
    // Nothing to do: the hint may show once more on the next visit.
  }
}
