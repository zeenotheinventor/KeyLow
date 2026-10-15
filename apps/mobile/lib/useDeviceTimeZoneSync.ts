import { useProfileTimeZone, useSyncTimeZone } from "@keylow/api-client";
import { useEffect, useState } from "react";
import { AppState } from "react-native";

import { useReadsEnabled } from "./useReadsEnabled";

const readDeviceTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/**
 * Keeps the profile's time zone equal to the phone's, with no screen of its own. The zone is read when the
 * app opens and again each time it returns to the foreground, since a user can travel with the app in the
 * background. A write that failed is tried again on that return too. Nothing is read or written until the
 * account has accepted the current Terms (the same wait as every other read). Mount it once, where a user
 * is signed in.
 */
export function useDeviceTimeZoneSync(): void {
  const isEnabled = useReadsEnabled();
  const profileTimeZone = useProfileTimeZone({ enabled: isEnabled });
  const [deviceTimeZone, setDeviceTimeZone] = useState(readDeviceTimeZone);
  const [foregroundEventCount, setForegroundEventCount] = useState(0);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        setDeviceTimeZone(readDeviceTimeZone());
        setForegroundEventCount((count) => count + 1);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useSyncTimeZone({
    deviceTimeZone,
    profileTimeZone: profileTimeZone.data,
    enabled: isEnabled,
    foregroundEventCount,
  });
}
