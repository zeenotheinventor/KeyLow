import { useSyncExternalStore } from "react";

import {
  getSuggestionsEnabledSnapshot,
  setSuggestionsEnabled,
  subscribeToSuggestionsEnabled,
} from "./suggestionsPreferenceStore";

/**
 * Whether the Train tab suggests a workout, kept on this device and the same in every component that asks,
 * or undefined while the device is being read, so a reader that must not flash the card waits for it. On
 * unless the person turned it off.
 */
export function useSuggestionsEnabled(): {
  isEnabled: boolean | undefined;
  setEnabled: (isEnabled: boolean) => void;
} {
  const isEnabled = useSyncExternalStore(
    subscribeToSuggestionsEnabled,
    getSuggestionsEnabledSnapshot,
  );

  return { isEnabled, setEnabled: setSuggestionsEnabled };
}
