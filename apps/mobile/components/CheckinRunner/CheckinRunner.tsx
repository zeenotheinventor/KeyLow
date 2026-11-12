import { useRunCheckinsIfDue } from "@keylow/api-client";
import { captureException } from "@sentry/react-native";
import { useEffect } from "react";
import { AppState } from "react-native";

import { announceNewTargets } from "../../lib/checkinToast";
import { useReadsEnabled } from "../../lib/useReadsEnabled";

function reportFailureCode(code: string) {
  captureException(new Error(`Could not run your check-in (${code})`));
}

/**
 * Draws nothing. Runs the user's due check-ins when the app opens and each time it returns to the
 * foreground, so the new targets are there before the diary is looked at: `useRunCheckinsIfDue` reads the
 * program's next check-in date, and when that day has come in the profile's time zone it runs the
 * check-ins once (a return to the foreground while one runs joins it). Nothing runs in the background, and
 * nothing is read until the Terms are accepted. Offline it does nothing. Any other failure shows nothing
 * and goes to Sentry as a code only, since the daily backstop runs the check-in anyway. When a run recorded
 * check-ins and the calorie target is not what it was, it tells the diary a new target exists. Mount it
 * once, where a person is signed in.
 */
export function CheckinRunner() {
  const isEnabled = useReadsEnabled();
  const runIfDue = useRunCheckinsIfDue({
    onNewTargets: announceNewTargets,
    onFailureCode: reportFailureCode,
  });

  useEffect(() => {
    if (!isEnabled) {
      return undefined;
    }
    void runIfDue();
    const subscription = AppState.addEventListener("change", (appState) => {
      if (appState === "active") {
        void runIfDue();
      }
    });
    return () => {
      subscription.remove();
    };
  }, [isEnabled, runIfDue]);

  return null;
}
