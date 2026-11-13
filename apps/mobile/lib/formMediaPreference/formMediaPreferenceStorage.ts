import { DEFAULT_FORM_MEDIA_PREFERENCE, formMediaPreferenceOf } from "@keylow/core/training";
import AsyncStorage from "@react-native-async-storage/async-storage";

import type { FormMediaPreference } from "@keylow/core/training";

export const formMediaPreferenceStorageKey = "exerciseForm.mediaPreference";

/** What exercise demos show, as last chosen on this device. Nothing valid saved, or a store that cannot be read, is the default. */
export async function readFormMediaPreference(): Promise<FormMediaPreference> {
  try {
    const stored = await AsyncStorage.getItem(formMediaPreferenceStorageKey);
    return formMediaPreferenceOf(stored) ?? DEFAULT_FORM_MEDIA_PREFERENCE;
  } catch {
    return DEFAULT_FORM_MEDIA_PREFERENCE;
  }
}

/** A preference that cannot be saved still applies for this visit, so the failure is not raised. */
export async function writeFormMediaPreference(preference: FormMediaPreference): Promise<void> {
  try {
    await AsyncStorage.setItem(formMediaPreferenceStorageKey, preference);
  } catch {
    // Nothing to do: the next visit starts from the last preference that did save.
  }
}
