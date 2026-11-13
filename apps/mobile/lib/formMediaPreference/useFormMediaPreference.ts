import { useEffect, useSyncExternalStore } from "react";

import { currentFormMediaPreferenceStore } from "./currentFormMediaPreferenceStore";

import type { FormMediaPreference } from "@keylow/core/training";

/** Starts reading the stored preference, as the app starts, so a reader finds it read. Asking again does nothing. */
export function startFormMediaPreferenceRead(): void {
  currentFormMediaPreferenceStore.store.startRead();
}

const subscribe = (listener: () => void) =>
  currentFormMediaPreferenceStore.store.subscribe(listener);
const getSnapshot = () => currentFormMediaPreferenceStore.store.getSnapshot();
const setPreference = (preference: FormMediaPreference) => {
  currentFormMediaPreferenceStore.store.setPreference(preference);
};

/**
 * What exercise demos show, Video, Photos or Both, remembered per device and shared by every reader. It is
 * the default until the store has been read. A store that cannot be read is the default.
 */
export function useFormMediaPreference(): {
  preference: FormMediaPreference;
  isReady: boolean;
  setPreference: (preference: FormMediaPreference) => void;
} {
  const state = useSyncExternalStore(subscribe, getSnapshot);

  useEffect(() => {
    startFormMediaPreferenceRead();
  }, []);

  return { ...state, setPreference };
}
