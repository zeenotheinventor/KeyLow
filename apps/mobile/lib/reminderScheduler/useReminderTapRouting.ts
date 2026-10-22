import { useRouter, useSegments } from "expo-router";
import { useEffect, useRef, useState } from "react";

import { reminderTapPath } from "./reminderTapPath";
import { onReminderTap } from "../notifications";

import type { ReminderType } from "../notifications";

// The routes before the person is in the app: the root route that only redirects, and the sign-in ones.
const isInsideApp = (firstSegment: string | undefined) =>
  firstSegment !== undefined && firstSegment !== "(auth)" && firstSegment !== "auth";

/**
 * Opens the screen a reminder is for when the person taps it, whether the app was running or the tap
 * opened it. A tap that arrives before the person is signed in and inside the app waits, and is followed
 * once they are. Mount it once, where a user is signed in: a tap that opened a closed app is kept by the
 * system until something asks for it, so it is read when this mounts.
 */
export function useReminderTapRouting(): void {
  const router = useRouter();
  const firstSegment: string | undefined = useSegments()[0];
  // Each tap is numbered, so one that is followed is not followed again when the screen it waited for arrives.
  const [tap, setTap] = useState<{ type: ReminderType; number: number } | null>(null);
  const followedNumber = useRef(0);

  useEffect(
    () =>
      onReminderTap((type) => {
        setTap((previous) => ({ type, number: (previous?.number ?? 0) + 1 }));
      }),
    [],
  );

  useEffect(() => {
    if (tap === null || tap.number === followedNumber.current || !isInsideApp(firstSegment)) {
      return;
    }
    followedNumber.current = tap.number;
    if (tap.type === "train") {
      router.navigate(reminderTapPath(tap.type));
    } else {
      router.push(reminderTapPath(tap.type));
    }
  }, [tap, firstSegment, router]);
}
