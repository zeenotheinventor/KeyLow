import { planTrainingReminders } from "@keylow/core/training";

import {
  lastDelivered,
  readScheduledReminders,
  writeScheduledReminders,
} from "./scheduledReminders";
import { getPermission, replaceReminders } from "../notifications";

import type { Reminder, ReminderType } from "../notifications";
import type { ReminderSettings } from "../reminderSettings";
import type { TrainingReminderInput } from "@keylow/core/training";

/** What the planner reads besides the settings and the moment. */
export type ReminderPlanInputs = Pick<
  TrainingReminderInput,
  "timeZone" | "plan" | "sessions" | "heatSets" | "weeklyGain"
>;

export type ScheduleReminderPlanInput = {
  now: Date;
  settings: ReminderSettings;
  /** Null while any of it is not loaded yet, which leaves the schedule as it is. */
  inputs: ReminderPlanInputs | null;
};

const hasAnySwitchOn = ({ trainEnabled, progressEnabled, easeEnabled }: ReminderSettings) =>
  trainEnabled || progressEnabled || easeEnabled;

/**
 * Plans the next seven days of reminders and replaces what this app has scheduled with them. With every
 * switch off, or the permission not granted, it cancels ours and schedules nothing, and on a build
 * without the notifications module it does nothing at all. With the inputs not loaded it keeps the
 * schedule it has. The plan is stored with the last wording delivered of each type, so the next plan does
 * not repeat it. A failure is a fixed message: the system's own can quote what was scheduled.
 */
export async function scheduleReminderPlan({
  now,
  settings,
  inputs,
}: ScheduleReminderPlanInput): Promise<void> {
  const permission = await getPermission();
  if (permission === "unavailable") {
    return;
  }
  if (permission !== "granted" || !hasAnySwitchOn(settings)) {
    // Through the queue, so it cannot race a plan that is still being scheduled.
    await replaceReminders([]);
    return;
  }
  if (inputs === null) {
    return;
  }

  const delivered = lastDelivered(await readScheduledReminders(), now);
  // `settings.lastVariant` is kept for older saved settings. The persisted plan is the source.
  const lastVariantOf = (type: ReminderType): string | null =>
    delivered.find((reminder) => reminder.type === type)?.variantId ?? settings.lastVariant[type];

  const planned = planTrainingReminders({
    ...inputs,
    now: now.toISOString(),
    settings,
    lastVariantIds: {
      train: lastVariantOf("train"),
      progress: lastVariantOf("progress"),
      ease: lastVariantOf("ease"),
    },
  });
  const reminders: Reminder[] = planned.map(({ type, fireAt, title, body }) => ({
    type,
    fireAt: new Date(fireAt),
    title,
    body,
    data: { type },
  }));

  await replaceReminders(reminders);
  await writeScheduledReminders([
    ...delivered,
    ...planned.map(({ type, fireAt, variantId }) => ({ type, fireAt, variantId })),
  ]);
}
