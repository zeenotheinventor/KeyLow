import { useSyncExternalStore } from "react";

import {
  getReminderSettingsSnapshot,
  subscribeToReminderSettings,
  updateReminderSettings,
} from "./reminderSettingsStore";

/**
 * The reminder settings kept on this device, the same ones in every component that asks. They are the
 * defaults, all off, until the saved ones load.
 */
export function useReminderSettings() {
  const { settings, isLoaded } = useSyncExternalStore(
    subscribeToReminderSettings,
    getReminderSettingsSnapshot,
  );

  return { settings, isLoaded, update: updateReminderSettings };
}
