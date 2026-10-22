import { useEffect } from "react";

import { writeScheduledReminders } from "./scheduledReminders";
import { replaceReminders } from "../notifications";

/**
 * Cancels the reminders this app scheduled, and forgets the plan they were made from, while nobody is
 * signed in: a reminder is made from one person's training and must not outlive their session. It goes
 * through the queued replace, so it cannot race a plan that is still being scheduled. The switches stay,
 * because they belong to the device and the next sign-in plans from them again. Pass whether the session
 * is known and there is none, so a start that has not read the session yet cancels nothing.
 */
export function useCancelRemindersWhenSignedOut(isSignedOut: boolean): void {
  useEffect(() => {
    if (!isSignedOut) {
      return;
    }
    replaceReminders([])
      .then(() => writeScheduledReminders([]))
      .catch(() => undefined);
  }, [isSignedOut]);
}
