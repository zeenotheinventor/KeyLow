import { useCallback, useEffect, useRef, useState } from "react";

import {
  defaultReminderSettings,
  isTimeOfDay,
  readReminderSettings,
  writeReminderSettings,
} from "./reminderSettings";

import type { ReminderSettings } from "./reminderSettings";

/** The reminder settings kept on this device. They are the defaults, all off, until the saved ones load. */
export function useReminderSettings() {
  const [settings, setSettings] = useState(defaultReminderSettings);
  const [isLoaded, setIsLoaded] = useState(false);
  const latestSettings = useRef(settings);
  const load = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    load.current = readReminderSettings().then((saved) => {
      latestSettings.current = saved;
      setSettings(saved);
      setIsLoaded(true);
    });
  }, []);

  /** Changes the given fields on top of the saved ones, so a change made while loading loses nothing. */
  const update = useCallback(async (changes: Partial<ReminderSettings>) => {
    await load.current;
    const { trainTime, ...otherChanges } = changes;
    const validChanges = isTimeOfDay(trainTime) ? { ...otherChanges, trainTime } : otherChanges;
    const next = { ...latestSettings.current, ...validChanges };
    latestSettings.current = next;
    setSettings(next);
    await writeReminderSettings(next);
  }, []);

  return { settings, isLoaded, update };
}
