import { useEffect } from "react";
import { AppState } from "react-native";

import { getCelebrationEpoch, rememberNotifiedIds, useCelebrationQueue } from "../achievements";
import { getPermission, postUnlockNotification } from "../notifications";
import { useReminderSettings } from "../reminderSettings";

/**
 * Posts the one notification a run of the achievements engine decided on, when that run finished while the
 * app was not in front, the "Badges and levels" switch is on and the phone allows notifications. The badges
 * the notification names (the ones this device recorded) are then acknowledged, so the toast does not show
 * them again when the person comes back, and their ids are saved on the device so a restart does not toast
 * them either. They stay unseen in the database, so the Achievements screen still
 * marks them new. A held badge another device recorded is not in the notification, so it keeps its toast.
 * The notification is taken out of the queue as soon as it is dealt with, posted or not, so one that was
 * not posted can never be posted later and none is posted twice. A backfill run and the badges another
 * device recorded carry no notification. Nothing is logged: the title and body name the person's badges.
 * Mount it once, where a user is signed in.
 */
export function useUnlockNotificationPoster(accountId: string | null): void {
  const { notification, wasActive, entries, acknowledge, discardNotification } =
    useCelebrationQueue();
  const { settings, isLoaded } = useReminderSettings();
  const { badgesEnabled } = settings;

  useEffect(() => {
    if (notification === null || !isLoaded) {
      return;
    }
    discardNotification();
    if (wasActive || !badgesEnabled || AppState.currentState === "active") {
      return;
    }
    const notifiedIds = entries.filter(({ isNew }) => isNew).map(({ id }) => id);
    // A reset (sign-out or another account) while this runs ends it: the badges are not the next person's.
    const epoch = getCelebrationEpoch();
    getPermission()
      .then(async (permission) => {
        // The person may have come back while the permission was read, and then the toast shows.
        if (
          permission !== "granted" ||
          AppState.currentState === "active" ||
          getCelebrationEpoch() !== epoch
        ) {
          return;
        }
        await postUnlockNotification(notification);
        if (getCelebrationEpoch() === epoch) {
          acknowledge(notifiedIds);
          // Saved too, since the queue is not: after a restart these badges are held and unseen again.
          if (accountId !== null) {
            await rememberNotifiedIds(accountId, notifiedIds);
          }
        }
      })
      .catch(() => {
        // The error is not passed on: the system's message can quote the notification.
        console.warn("The unlock notification could not be posted");
      });
  }, [
    notification,
    wasActive,
    entries,
    isLoaded,
    badgesEnabled,
    acknowledge,
    discardNotification,
    accountId,
  ]);
}
