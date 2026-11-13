import { DEFAULT_FORM_MEDIA_PREFERENCE } from "@keylow/core/training";

import { readFormMediaPreference, writeFormMediaPreference } from "./formMediaPreferenceStorage";

import type { FormMediaPreference } from "@keylow/core/training";

export type FormMediaPreferenceState = {
  preference: FormMediaPreference;
  /** False until the store has been read, and the default until then. */
  isReady: boolean;
};

// How long a reader waits for the stored preference before it uses the default: the phone answers at once,
// so a store that has not is stuck, and a sheet must not wait on it for good. An answer that comes later is
// still applied.
const READ_TIMEOUT_MILLISECONDS = 3000;

const initialState: FormMediaPreferenceState = {
  preference: DEFAULT_FORM_MEDIA_PREFERENCE,
  isReady: false,
};

/**
 * One preference for the whole app, because the More row and the switch on every open sheet must change
 * together. The store is read once, from the first call to `startRead`, and every later call is ignored.
 */
export function createFormMediaPreferenceStore() {
  let state = initialState;
  let isReadStarted = false;
  // Whether the person has picked a preference in this session, which a stored one must never replace.
  let hasChangedPreference = false;
  const listeners = new Set<() => void>();

  const update = (next: FormMediaPreferenceState) => {
    state = next;
    listeners.forEach((listener) => {
      listener();
    });
  };

  const startRead = () => {
    if (isReadStarted) {
      return;
    }
    isReadStarted = true;
    let isSettled = false;
    const settle = (stored: FormMediaPreference) => {
      if (isSettled) {
        if (!hasChangedPreference) {
          update({ ...state, preference: stored });
        }
        return;
      }
      isSettled = true;
      clearTimeout(timer);
      update(
        hasChangedPreference ? { ...state, isReady: true } : { preference: stored, isReady: true },
      );
    };
    const timer = setTimeout(() => {
      settle(DEFAULT_FORM_MEDIA_PREFERENCE);
    }, READ_TIMEOUT_MILLISECONDS);
    void readFormMediaPreference().then(settle);
  };

  return {
    startRead,
    getSnapshot: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setPreference: (preference: FormMediaPreference) => {
      hasChangedPreference = true;
      update({ ...state, preference });
      void writeFormMediaPreference(preference);
    },
  };
}
