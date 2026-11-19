import { useAchievementState } from "@keylow/api-client";
import { reminderEnabledFrom } from "@keylow/core";
import { useMemo, useState } from "react";

import { useReminderSettings } from "../../lib/reminderSettings";

/**
 * The achievements read for a screen: the engine's view of the stats and the rows held. The phone's own input
 * is whether a reminder is on, read from the settings kept on this device, and the moment is the one the
 * screen opened at, so the read is not worked out again on every render.
 */
export function useAchievementsState({ enabled }: { enabled: boolean }) {
  const { settings } = useReminderSettings();
  const reminderEnabled = reminderEnabledFrom(settings);
  const device = useMemo(() => ({ reminderEnabled }), [reminderEnabled]);
  const [now] = useState(() => new Date());

  return useAchievementState({ device, now, enabled });
}
