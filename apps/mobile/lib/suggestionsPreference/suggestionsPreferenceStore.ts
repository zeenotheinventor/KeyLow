import AsyncStorage from "@react-native-async-storage/async-storage";
import { z } from "zod";

export const suggestionsPreferenceStorageKey = "train.suggestionsEnabled";

const storedPreferenceSchema = z.boolean();

/** Whether the Train tab suggests a workout. A store that cannot be read, or holds anything else, is on. */
export async function readSuggestionsEnabled(): Promise<boolean> {
  try {
    const text = await AsyncStorage.getItem(suggestionsPreferenceStorageKey);
    if (text === null) {
      return true;
    }
    const parsed = storedPreferenceSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : true;
  } catch {
    return true;
  }
}

/** A choice that cannot be stored still applies for this visit, so the failure is not raised. */
export async function writeSuggestionsEnabled(isEnabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(suggestionsPreferenceStorageKey, JSON.stringify(isEnabled));
  } catch {
    // Nothing to do: the next visit starts from the last choice that did save.
  }
}

/*
 * One copy of the choice for the whole app, so the switch in More and the Train tab, which stays mounted,
 * change together. It is undefined until the device has been read. It lives while anything is listening: the
 * first listener starts the read, and when the last one goes the copy is dropped, so the next one reads again.
 */
let snapshot: boolean | undefined;
let isReading = false;
// Moves on when the copy is dropped, so a read that finishes after that does not bring it back.
let generation = 0;
const listeners = new Set<() => void>();

function publish(next: boolean): void {
  snapshot = next;
  listeners.forEach((listener) => {
    listener();
  });
}

function startRead(): void {
  if (isReading) {
    return;
  }
  isReading = true;
  const startedIn = generation;
  void readSuggestionsEnabled().then((saved) => {
    // A choice made while the device was being read is the newer one.
    if (startedIn === generation && snapshot === undefined) {
      publish(saved);
    }
  });
}

export function subscribeToSuggestionsEnabled(listener: () => void): () => void {
  listeners.add(listener);
  startRead();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      generation += 1;
      isReading = false;
      snapshot = undefined;
    }
  };
}

export function getSuggestionsEnabledSnapshot(): boolean | undefined {
  return snapshot;
}

/** The choice applies at once, for every listener, and is stored. */
export function setSuggestionsEnabled(isEnabled: boolean): void {
  publish(isEnabled);
  void writeSuggestionsEnabled(isEnabled);
}
