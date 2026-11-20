import { useRouter, useSegments } from "expo-router";
import { useEffect, useRef, useState } from "react";

import { reminderTapPath } from "./reminderTapPath";
import { achievementPath, achievementsPath } from "../achievementRoutes";
import { onNotificationTap } from "../notifications";

import type { NotificationTap } from "../notifications";

// The routes before the person is in the app: the root route that only redirects, and the sign-in ones.
const isInsideApp = (firstSegment: string | undefined) =>
  firstSegment !== undefined && firstSegment !== "(auth)" && firstSegment !== "auth";

/**
 * Opens the screen a notification is for when the person taps it (a reminder's screen, or the badge an
 * unlock notification names), whether the app was running or the tap opened it. A tap that arrives
 * before the person is signed in and inside the app waits, and is followed once they are. Mount it once, where a user is signed in: a tap that opened a closed app is kept by the
 * system until something asks for it, so it is read when this mounts.
 */
export function useReminderTapRouting(): void {
  const router = useRouter();
  const firstSegment: string | undefined = useSegments()[0];
  // Each tap is numbered, so one that is followed is not followed again when the screen it waited for arrives.
  const [latest, setLatest] = useState<{ tap: NotificationTap; number: number } | null>(null);
  const followedNumber = useRef(0);

  useEffect(
    () =>
      onNotificationTap((received) => {
        setLatest((previous) => ({ tap: received, number: (previous?.number ?? 0) + 1 }));
      }),
    [],
  );

  useEffect(() => {
    if (latest === null || latest.number === followedNumber.current || !isInsideApp(firstSegment)) {
      return;
    }
    followedNumber.current = latest.number;
    const received = latest.tap;
    if (received.kind === "unlock") {
      router.push(
        received.achievementId === null
          ? achievementsPath()
          : achievementPath(received.achievementId),
      );
    } else if (
      received.type === "train" ||
      received.type === "missed" ||
      received.type === "food"
    ) {
      // The Train and Diary tabs are switched to, and the others are pushed over the tab that is open.
      router.navigate(reminderTapPath(received.type));
    } else {
      router.push(reminderTapPath(received.type));
    }
  }, [latest, firstSegment, router]);
}
