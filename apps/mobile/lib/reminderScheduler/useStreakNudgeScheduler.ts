import { keys } from "@keylow/api-client";
import { planStreakNudge } from "@keylow/core";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import { REMINDER_DEBOUNCE_MILLISECONDS } from "./useReminderScheduler";
import { useStreakNudgeInputs } from "./useStreakNudgeInputs";
import { getPermission, replaceStreakNudge } from "../notifications";
import { useReminderSettings } from "../reminderSettings";
import { useReadsEnabled } from "../useReadsEnabled";

import type { StreakNudgeInputs } from "./useStreakNudgeInputs";

async function applyStreakNudge(inputs: StreakNudgeInputs): Promise<void> {
  if ((await getPermission()) !== "granted") {
    await replaceStreakNudge(null);
    return;
  }
  await replaceStreakNudge(
    planStreakNudge({
      now: new Date(),
      timeZone: inputs.timeZone,
      today: inputs.today,
      currentStreak: inputs.currentStreak,
    }),
  );
}

/**
 * Keeps the evening streak nudge right while "Keep your streak" is on: one local notification at 8pm today
 * when today is not complete yet, and none once it is (the core's daily streak says which). It is worked out
 * again when the app opens or comes back, and on a new day (the streak is read fresh then, so a day completed on another
 * screen or device cancels it), when the app goes to the background, and whenever the streak changes.
 * Turning the switch off cancels it. Nothing is read while the switch is off, and nothing is logged: the
 * message names the length of the streak. Mount it once, where a user is signed in.
 */
export function useStreakNudgeScheduler(): void {
  const readsEnabled = useReadsEnabled();
  const queryClient = useQueryClient();
  const { settings, isLoaded } = useReminderSettings();
  const isOn = settings.streakNudgeEnabled;
  const inputs = useStreakNudgeInputs({ enabled: readsEnabled && isLoaded && isOn });
  // Whether this session has scheduled a nudge, so a switch that was never on touches no notification.
  const hasBeenOn = useRef(false);
  const [openCount, setOpenCount] = useState(0);

  useEffect(() => {
    if (!isOn) {
      return undefined;
    }
    const subscription = AppState.addEventListener("change", (state) => {
      void queryClient.invalidateQueries({ queryKey: keys.achievements.state });
      if (state === "active") {
        setOpenCount((count) => count + 1);
      }
    });
    return () => {
      subscription.remove();
    };
  }, [isOn, queryClient]);

  useEffect(() => {
    if (!isLoaded || !readsEnabled) {
      return undefined;
    }
    if (!isOn) {
      if (hasBeenOn.current) {
        hasBeenOn.current = false;
        replaceStreakNudge(null).catch(() => {
          console.warn("The streak nudge could not be cancelled");
        });
      }
      return undefined;
    }
    if (inputs === null) {
      return undefined;
    }
    hasBeenOn.current = true;
    const timer = setTimeout(() => {
      applyStreakNudge(inputs).catch(() => {
        // The error is not passed on: the system's message can quote what was scheduled.
        console.warn("The streak nudge could not be scheduled");
      });
    }, REMINDER_DEBOUNCE_MILLISECONDS);
    return () => {
      clearTimeout(timer);
    };
  }, [isLoaded, readsEnabled, isOn, inputs, openCount]);
}
