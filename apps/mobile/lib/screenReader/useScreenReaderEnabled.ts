import { useSyncExternalStore } from "react";
import { AccessibilityInfo } from "react-native";

import type { EventSubscription } from "react-native";

// One reading of the setting serves every component, kept as `useReducedMotion` keeps its own: the first
// component to ask starts a single system listener and a single read, and the last one to leave stops it.
let isScreenReaderEnabled = false;
let subscription: EventSubscription | undefined;
let readGeneration = 0;
const listeners = new Set<() => void>();

function setIsScreenReaderEnabled(isEnabled: boolean): void {
  if (isEnabled !== isScreenReaderEnabled) {
    isScreenReaderEnabled = isEnabled;
    listeners.forEach((listener) => {
      listener();
    });
  }
}

function startListening(): void {
  readGeneration += 1;
  const generation = readGeneration;

  AccessibilityInfo.isScreenReaderEnabled()
    .then((isEnabled) => {
      // A read that comes back after everyone left, or after a newer start, is stale.
      if (generation === readGeneration) {
        setIsScreenReaderEnabled(isEnabled);
      }
    })
    .catch(() => {
      // The setting cannot be read, which is not a sign of a screen reader: touch works as it does for the sighted.
      if (generation === readGeneration) {
        setIsScreenReaderEnabled(false);
      }
    });
  subscription = AccessibilityInfo.addEventListener(
    "screenReaderChanged",
    setIsScreenReaderEnabled,
  );
}

function stopListening(): void {
  readGeneration += 1;
  subscription?.remove();
  subscription = undefined;
  // The last answer is kept, so a screen that swaps for another in one commit does not flicker between
  // the two behaviours. Its fresh read corrects the answer if the setting changed meanwhile.
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) {
    startListening();
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      stopListening();
    }
  };
}

const getSnapshot = (): boolean => isScreenReaderEnabled;

/**
 * Whether a screen reader (VoiceOver or TalkBack) is running. It follows the setting while the app runs and
 * starts false until the system first answers. When the setting cannot be read it is false, because a
 * missing answer is not a screen reader. Every component shares one subscription to the system.
 */
export function useScreenReaderEnabled(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
