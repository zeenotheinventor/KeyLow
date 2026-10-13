import AsyncStorage from "@react-native-async-storage/async-storage";

export type ThemePreference = "dark" | "light" | "system";

export const themeStorageKey = "kl-theme";
export const defaultThemePreference: ThemePreference = "dark";

const themePreferences: readonly string[] = ["dark", "light", "system"] satisfies ThemePreference[];

function isThemePreference(value: string | null): value is ThemePreference {
  return value !== null && themePreferences.includes(value);
}

/** The saved preference, or dark when nothing valid is saved or storage cannot be read. */
export async function readThemePreference(): Promise<ThemePreference> {
  try {
    const stored = await AsyncStorage.getItem(themeStorageKey);
    return isThemePreference(stored) ? stored : defaultThemePreference;
  } catch {
    return defaultThemePreference;
  }
}

/** A preference that cannot be saved still applies for this session, so the failure is not raised. */
export async function writeThemePreference(preference: ThemePreference): Promise<void> {
  try {
    await AsyncStorage.setItem(themeStorageKey, preference);
  } catch {
    // Nothing to do: the next launch starts from the last preference that did save.
  }
}
