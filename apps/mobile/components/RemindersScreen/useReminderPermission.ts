import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";

import { getPermission, requestPermission } from "../../lib/notifications";

import type { PermissionState } from "../../lib/notifications";

/**
 * The permission to show notifications, read when the screen opens and again each time the app returns
 * to the foreground (the person may have changed it in the phone's settings). It is null until read.
 * `askForPermission` resolves to whether reminders may be turned on: it shows the system prompt only when
 * the person has not been asked yet, never after a refusal, which only the phone's settings can undo.
 */
export function useReminderPermission() {
  const [permission, setPermission] = useState<PermissionState | null>(null);

  useEffect(() => {
    let isCancelled = false;
    const read = () => {
      void getPermission().then((current) => {
        if (!isCancelled) {
          setPermission(current);
        }
      });
    };
    read();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        read();
      }
    });
    return () => {
      isCancelled = true;
      subscription.remove();
    };
  }, []);

  const askForPermission = useCallback(async (): Promise<boolean> => {
    const current = permission ?? (await getPermission());
    if (current === "granted") {
      return true;
    }
    if (current !== "undetermined") {
      setPermission(current);
      return false;
    }
    const answer = await requestPermission();
    setPermission(answer);
    return answer === "granted";
  }, [permission]);

  return { permission, askForPermission };
}
