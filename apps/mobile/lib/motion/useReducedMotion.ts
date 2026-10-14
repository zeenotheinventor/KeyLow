import { useSyncExternalStore } from "react";
import { AccessibilityInfo } from "react-native";

import type { EventSubscription } from "react-native";

// One reading of the setting serves every component. The first component to ask starts a single
// system listener and a single read, and the last one to leave stops the listener, so a screen with
// a hundred pressable rows still holds one subscription.
let isReducedMotion = false;
let subscription: EventSubscription | undefined;
let readGeneration = 0;
const listeners = new Set<() => void>();

function setIsReducedMotion(isEnabled: boolean): void {
  if (isEnabled !== isReducedMotion) {
    isReducedMotion = isEnabled;
    listeners.forEach((listener) => {
      listener();
    });
  }
}

function startListening(): void {
  readGeneration += 1;
  const generation = readGeneration;

  AccessibilityInfo.isReduceMotionEnabled()
    .then((isEnabled) => {
      // A read that comes back after everyone left, or after a newer start, is stale.
      if (generation === readGeneration) {
        setIsReducedMotion(isEnabled);
      }
    })
    .catch(() => {
      // The setting cannot be read, which is not a request to reduce: the motion plays.
      if (generation === readGeneration) {
        setIsReducedMotion(false);
      }
    });
  subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setIsReducedMotion);
}

function stopListening(): void {
  readGeneration += 1;
  subscription?.remove();
  subscription = undefined;
  // The last answer is kept: a screen that swaps for another in one commit has a moment with no
  // component reading, and the next one must not draw a frame of motion for a user who asked for none.
  // Its fresh read corrects the answer if the setting changed meanwhile.
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

const getSnapshot = (): boolean => isReducedMotion;

/**
 * Whether the user has asked the system to reduce motion. Every animated primitive reads it and takes
 * its fade or no-movement path when it is true. It follows the setting while the app runs, like
 * `haptic` in lib/haptics, which reads the same setting. It starts false until the system first answers, and keeps its last answer while no component reads it.
 * When the setting cannot be read the motion plays, because a missing answer is not a request.
 * Every component shares one subscription to the system.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
