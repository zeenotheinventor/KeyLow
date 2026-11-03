import { planFoodReminders } from "@keylow/core/nutrition";
import { planTrainingReminders } from "@keylow/core/training";

import {
  lastDelivered,
  readScheduledReminders,
  writeScheduledReminders,
} from "./scheduledReminders";
import { getPermission, replaceReminders } from "../notifications";

import type { Reminder, ReminderType } from "../notifications";
import type { ReminderSettings } from "../reminderSettings";
import type { FoodReminderInput } from "@keylow/core/nutrition";
import type { PlannedTrainingReminder, TrainingReminderInput } from "@keylow/core/training";

/** What the planner reads besides the settings and the moment. */
export type ReminderPlanInputs = Pick<
  TrainingReminderInput,
  "timeZone" | "plan" | "sessions" | "heatSets" | "weeklyGain"
>;

/** What the food planner reads besides the settings and the moment. */
export type FoodReminderPlanInputs = Pick<FoodReminderInput, "timeZone" | "loggedToday">;

export type ScheduleReminderPlanInput = {
  now: Date;
  settings: ReminderSettings;
  /** Null while any of it is not loaded yet, which leaves the schedule as it is. Unread while no training switch is on. */
  inputs: ReminderPlanInputs | null;
  /** Null while it is not loaded yet, which leaves the schedule as it is. Unread while the food switch is off. */
  foodInputs: FoodReminderPlanInputs | null;
};

export const hasTrainingSwitchOn = ({
  trainEnabled,
  progressEnabled,
  easeEnabled,
  missedEnabled,
  checkinEnabled,
}: ReminderSettings) =>
  trainEnabled || progressEnabled || easeEnabled || missedEnabled || checkinEnabled;

/** What the core plans, as the app can schedule it: it does not compile if the core plans a type the app does not know. */
type PlannedReminder = Omit<PlannedTrainingReminder, "type"> & { type: ReminderType };

/**
 * Plans the next seven days of reminders, the training ones (including the missed day and check in ones) and the food one, and replaces what this app
 * has scheduled with them. With every switch off, or the permission not granted, it cancels ours and
 * schedules nothing, and on a build without the notifications module it does nothing at all. With the
 * inputs of a switch that is on not loaded it keeps the schedule it has. The plan is stored with the last
 * wording delivered of each type, so the next plan does not repeat it. A failure is a fixed message: the
 * system's own can quote what was scheduled.
 */
export async function scheduleReminderPlan({
  now,
  settings,
  inputs,
  foodInputs,
}: ScheduleReminderPlanInput): Promise<void> {
  const permission = await getPermission();
  if (permission === "unavailable") {
    return;
  }
  if (permission !== "granted" || !(hasTrainingSwitchOn(settings) || settings.foodEnabled)) {
    // Through the queue, so it cannot race a plan that is still being scheduled.
    await replaceReminders([]);
    // A reminder cancelled while still ahead must not be read as delivered once its time passes.
    await writeScheduledReminders(lastDelivered(await readScheduledReminders(), now));
    return;
  }
  if (
    (inputs === null && hasTrainingSwitchOn(settings)) ||
    (foodInputs === null && settings.foodEnabled)
  ) {
    return;
  }

  const delivered = lastDelivered(await readScheduledReminders(), now);
  // `settings.lastVariant` is kept for older saved settings. The persisted plan is the source.
  const lastVariantOf = (type: ReminderType): string | null =>
    delivered.find((reminder) => reminder.type === type)?.variantId ?? settings.lastVariant[type];

  // The last check in delivered is the only evidence the core has that a streak was asked about.
  const lastCheckInAt = delivered.find((reminder) => reminder.type === "checkin")?.fireAt ?? null;

  const trainingPlanned: PlannedReminder[] =
    inputs === null
      ? []
      : planTrainingReminders({
          ...inputs,
          now: now.toISOString(),
          settings,
          lastVariantIds: {
            train: lastVariantOf("train"),
            progress: lastVariantOf("progress"),
            ease: lastVariantOf("ease"),
            missed: lastVariantOf("missed"),
            checkin: lastVariantOf("checkin"),
          },
          lastCheckInAt,
        });
  const foodPlanned =
    foodInputs === null
      ? []
      : planFoodReminders({
          ...foodInputs,
          now: now.toISOString(),
          settings,
          lastVariantId: lastVariantOf("food"),
        }).map((reminder) => ({ ...reminder, type: "food" as const }));
  const planned = [...trainingPlanned, ...foodPlanned];
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
