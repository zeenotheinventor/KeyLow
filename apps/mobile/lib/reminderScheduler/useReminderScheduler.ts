import { useEffect, useState } from "react";
import { AppState } from "react-native";

import { scheduleReminderPlan } from "./scheduleReminderPlan";
import { useFoodReminderInputs } from "./useFoodReminderInputs";
import { useReminderPlanInputs } from "./useReminderPlanInputs";
import { useReminderSettings } from "../reminderSettings";
import { useReadsEnabled } from "../useReadsEnabled";

/** Triggers that land within this long of each other make one plan, not one each. */
export const REMINDER_DEBOUNCE_MILLISECONDS = 1000;

/**
 * Keeps the scheduled reminders equal to the plan, with no screen of its own. It plans when the app opens,
 * each time the app comes back to the foreground, and whenever something the plan is made from changes:
 * the settings, the time zone, the routine, today's sessions (a finished or discarded session, a logged
 * set) and the heat, and for the food reminder whether today's diary has an entry. Those changes arrive
 * through the reads the Train and Diary screens share, which every session, set and food log write already
 * updates. Nothing is planned until the settings are loaded, and the reads of each reminder are made only
 * while one of its switches is on. A failure is reported as one fixed line, with no data in it. Mount it
 * once, where a user is signed in.
 */
export function useReminderScheduler(): void {
  const readsEnabled = useReadsEnabled();
  const { settings, isLoaded } = useReminderSettings();
  const hasTrainingSwitchOn =
    settings.trainEnabled || settings.progressEnabled || settings.easeEnabled;
  const inputs = useReminderPlanInputs({
    enabled: readsEnabled && isLoaded && hasTrainingSwitchOn,
  });
  const foodInputs = useFoodReminderInputs({
    enabled: readsEnabled && isLoaded && settings.foodEnabled,
  });
  const [foregroundCount, setForegroundCount] = useState(0);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        setForegroundCount((count) => count + 1);
      }
    });
    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!isLoaded || !readsEnabled) {
      return undefined;
    }
    const timer = setTimeout(() => {
      scheduleReminderPlan({ now: new Date(), settings, inputs, foodInputs }).catch(() => {
        // The error is not passed on: the system's message can quote what was scheduled.
        console.warn("The reminders could not be scheduled");
      });
    }, REMINDER_DEBOUNCE_MILLISECONDS);
    return () => {
      clearTimeout(timer);
    };
  }, [isLoaded, readsEnabled, settings, inputs, foodInputs, foregroundCount]);
}
