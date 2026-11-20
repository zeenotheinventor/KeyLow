import { achievementsChannelId, unlockIdentifierPrefix } from "./constants";
import { loadNotifications } from "./loadNotifications";

import type { UnlockNotification } from "./types";

/** Posts the unlock notification at once. The caller has the permission and has decided one is wanted. */
export async function postUnlockNotification({
  title,
  body,
  achievementId,
}: UnlockNotification): Promise<void> {
  const notifications = loadNotifications();
  if (notifications === null) {
    return;
  }
  try {
    await notifications.scheduleNotificationAsync({
      identifier: `${unlockIdentifierPrefix}${Date.now()}`,
      // The badge to open is all that rides along, so nothing about the person's numbers can.
      content: { title, body, data: { kind: "unlock", achievementId } },
      trigger: { channelId: achievementsChannelId },
    });
  } catch {
    // The system's message can quote the content, so it is not passed on.
    throw new Error("An unlock notification could not be posted");
  }
}
