import {
  defaultReminderSettings,
  isTimeOfDay,
  readReminderSettings,
  writeReminderSettings,
} from "./reminderSettings";

import type { ReminderSettings } from "./reminderSettings";

export type ReminderSettingsSnapshot = {
  settings: ReminderSettings;
  isLoaded: boolean;
};

const unloaded: ReminderSettingsSnapshot = { settings: defaultReminderSettings, isLoaded: false };

/*
 * One copy of the settings for the whole app, so a change on the Reminders screen reaches the scheduler
 * at the root. It lives while anything is listening: the first listener starts the load, and when the last
 * one goes the copy is dropped, so the next one reads storage again. The scheduler listens for as long as
 * a person is signed in, so in the app the copy is not dropped.
 */
let snapshot = unloaded;
let load: Promise<void> | null = null;
// Moves on when the copy is dropped, so a read that finishes after that does not bring it back.
let generation = 0;
const listeners = new Set<() => void>();

function publish(next: ReminderSettingsSnapshot): void {
  snapshot = next;
  listeners.forEach((listener) => {
    listener();
  });
}

function startLoad(): Promise<void> {
  if (load === null) {
    const startedIn = generation;
    load = readReminderSettings().then((saved) => {
      if (startedIn === generation) {
        publish({ settings: saved, isLoaded: true });
      }
    });
  }
  return load;
}

export function subscribeToReminderSettings(listener: () => void): () => void {
  listeners.add(listener);
  void startLoad();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      generation += 1;
      load = null;
      snapshot = unloaded;
    }
  };
}

export function getReminderSettingsSnapshot(): ReminderSettingsSnapshot {
  return snapshot;
}

/**
 * Changes the given fields on top of the saved ones, so a change made while loading loses nothing. A train
 * time that is not a time of day is left out and the other changes apply.
 */
export async function updateReminderSettings(changes: Partial<ReminderSettings>): Promise<void> {
  await startLoad();
  const { trainTime, ...otherChanges } = changes;
  const validChanges = isTimeOfDay(trainTime) ? { ...otherChanges, trainTime } : otherChanges;
  const next = { ...snapshot.settings, ...validChanges };
  publish({ settings: next, isLoaded: true });
  await writeReminderSettings(next);
}
