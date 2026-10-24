import { UPDATED_TOAST } from "@keylow/core/copy";
import * as Updates from "expo-updates";
import { useEffect } from "react";

import { readLastSeenUpdateId, writeLastSeenUpdateId } from "../../lib/updates/lastSeenUpdateId";
import { useToast } from "../ui";

/**
 * Tells the person, once, that the app has been updated: a toast the first time the app starts on an update
 * id it has not run before, whether it reloaded onto it just now or the update landed on an earlier start.
 * It waits for the splash screen to go, so the toast is never behind it.
 *
 * Nothing is said on a first install (no id is stored yet), on the bundle built into the app, after an
 * emergency launch, in development, or without updates. The bundle built into the app still stores its id,
 * so the first update after an install is told. The id is stored after the toast is shown, so a crash before
 * it does not lose the toast, and never before, so it is never shown twice.
 */
export function useUpdatedToast(isSplashScreenGone: boolean): void {
  const toast = useToast();

  useEffect(() => {
    if (!isSplashScreenGone || __DEV__ || !Updates.isEnabled || Updates.isEmergencyLaunch) {
      return;
    }

    const runningUpdateId = Updates.updateId;
    if (runningUpdateId === null) {
      return;
    }

    let isGone = false;
    void readLastSeenUpdateId().then(async (lastSeenUpdateId) => {
      if (isGone || lastSeenUpdateId === undefined || lastSeenUpdateId === runningUpdateId) {
        return;
      }

      if (lastSeenUpdateId !== null && !Updates.isEmbeddedLaunch) {
        toast.show({ message: UPDATED_TOAST });
      }
      await writeLastSeenUpdateId(runningUpdateId);
    });

    return () => {
      isGone = true;
    };
  }, [isSplashScreenGone, toast]);
}
