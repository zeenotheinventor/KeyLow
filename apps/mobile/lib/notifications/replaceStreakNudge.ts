import { achievementsChannelId, streakNudgeIdentifierPrefix } from "./constants";
import { loadNotifications } from "./loadNotifications";

import type { StreakNudge } from "./types";

let queue: Promise<void> = Promise.resolve();

async function replace(nudge: StreakNudge | null): Promise<void> {
  const notifications = loadNotifications();
  if (notifications === null) {
    return;
  }
  const scheduled = await notifications.getAllScheduledNotificationsAsync();
  for (const { identifier } of scheduled) {
    if (identifier.startsWith(streakNudgeIdentifierPrefix)) {
      await notifications.cancelScheduledNotificationAsync(identifier);
    }
  }
  if (nudge === null || nudge.fireAt.getTime() <= Date.now()) {
    return;
  }
  try {
    await notifications.scheduleNotificationAsync({
      identifier: `${streakNudgeIdentifierPrefix}${nudge.fireAt.getTime()}`,
      content: { title: nudge.title, body: nudge.body },
      trigger: {
        type: notifications.SchedulableTriggerInputTypes.DATE,
        date: nudge.fireAt,
        channelId: achievementsChannelId,
      },
    });
  } catch {
    // The system's message can quote the content, so it is not passed on.
    throw new Error("The streak nudge could not be scheduled");
  }
}

/**
 * Replaces the streak nudge this app scheduled with the given one, or with none. Calls queue, so two
 * quick calls never interleave and leave two nudges pending.
 */
export function replaceStreakNudge(nudge: StreakNudge | null): Promise<void> {
  const replacement = queue.then(() => replace(nudge));
  queue = replacement.catch(() => undefined);
  return replacement;
}
